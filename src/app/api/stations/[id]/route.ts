import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";
import { updateStationSchema } from "@/lib/validation/stations";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "stations:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = updateStationSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات المحطة غير صحيحة." }, { status: 400 });
  }

  const existing = await prisma.station.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "المحطة غير موجودة." }, { status: 404 });
  }

  try {
    const station = await prisma.station.update({ where: { id }, data: body.data });

    await createAuditLog({
      actorUserId: auth.user.id,
      action: "STATION_UPDATED",
      resourceType: "station",
      resourceId: station.id,
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      // Record what actually moved, so the log explains the change on its own.
      metadata: { changes: body.data as Prisma.InputJsonObject }
    });

    return NextResponse.json({ station });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "رمز المحطة مستخدم لمحطة أخرى." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "stations:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const station = await prisma.station.findUnique({
    where: { id },
    include: {
      _count: { select: { inventoryTransactions: true, appointments: true, allocations: true } }
    }
  });

  if (!station) {
    return NextResponse.json({ error: "المحطة غير موجودة." }, { status: 404 });
  }

  // A station that has moved fuel is part of the ledger. Deleting it would break
  // the audit trail this system exists to keep, so it is closed instead — and
  // the caller is told that explicitly rather than seeing a foreign key error.
  const history =
    station._count.inventoryTransactions + station._count.appointments + station._count.allocations;

  if (history > 0) {
    const closed = await prisma.station.update({ where: { id }, data: { status: "CLOSED" } });

    await createAuditLog({
      actorUserId: auth.user.id,
      action: "STATION_CLOSED",
      resourceType: "station",
      resourceId: id,
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      metadata: { reason: "DELETE_REQUESTED_WITH_HISTORY", historyRecords: history }
    });

    return NextResponse.json({
      station: closed,
      closed: true,
      message: "لهذه المحطة حركات مخزون مسجلة، لذلك تم إغلاقها بدل حذفها للحفاظ على سجل التدقيق."
    });
  }

  await prisma.$transaction([
    prisma.fuelInventory.deleteMany({ where: { stationId: id } }),
    prisma.stationUser.deleteMany({ where: { stationId: id } }),
    prisma.station.delete({ where: { id } })
  ]);

  await createAuditLog({
    actorUserId: auth.user.id,
    action: "STATION_DELETED",
    resourceType: "station",
    resourceId: id,
    outcome: "SUCCESS",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    metadata: { code: station.code, nameAr: station.nameAr }
  });

  return NextResponse.json({ deleted: true });
}
