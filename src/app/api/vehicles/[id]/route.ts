import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";
import { maskPhone } from "@/lib/format";
import { updateVehicleSchema } from "@/lib/validation/vehicles";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "stations:read");
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      owner: true,
      fuelType: true,
      qrTokens: { where: { revokedAt: null }, select: { publicId: true, createdAt: true } },
      nationalIdDocument: { select: { status: true, createdAt: true } },
      appointments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          station: { select: { nameAr: true } },
          fuelType: { select: { nameAr: true } },
          timeSlot: { select: { startsAt: true, endsAt: true } },
          crisisRule: { select: { name: true, cooldownHours: true } },
          dispensedBy: { select: { name: true } }
        }
      }
    }
  });

  if (!vehicle) {
    return NextResponse.json({ error: "المركبة غير موجودة." }, { status: 404 });
  }

  // The owner's phone is the citizen's own contact detail; the console only
  // needs enough of it to recognise the right person.
  return NextResponse.json({
    vehicle: {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      plateGovernorate: vehicle.plateGovernorate,
      plateCategory: vehicle.plateCategory,
      vehicleType: vehicle.vehicleType,
      registrationStatus: vehicle.registrationStatus,
      createdAt: vehicle.createdAt,
      fuelName: vehicle.fuelType.nameAr,
      owner: { fullName: vehicle.owner.fullName, phone: maskPhone(vehicle.owner.phone) },
      documentStatus: vehicle.nationalIdDocument?.status ?? null,
      qrIssuedAt: vehicle.qrTokens[0]?.createdAt ?? null,
      appointments: vehicle.appointments.map((appointment) => ({
        id: appointment.id,
        status: appointment.status,
        stationName: appointment.station.nameAr,
        fuelName: appointment.fuelType.nameAr,
        quotaLiters: appointment.quotaLiters.toString(),
        dispensedLiters: appointment.dispensedLiters?.toString() ?? null,
        dispensedAt: appointment.dispensedAt,
        dispensedBy: appointment.dispensedBy?.name ?? null,
        slotStartsAt: appointment.timeSlot.startsAt,
        slotEndsAt: appointment.timeSlot.endsAt,
        ruleName: appointment.crisisRule.name,
        cooldownHours: appointment.crisisRule.cooldownHours
      }))
    }
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "users:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = updateVehicleSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات المركبة غير صحيحة." }, { status: 400 });
  }

  const existing = await prisma.vehicle.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "المركبة غير موجودة." }, { status: 404 });
  }

  const { ownerFullName, plateNumber, plateGovernorate, plateCategory, ...vehicleFields } = body.data;

  try {
    const vehicle = await prisma.$transaction(async (tx) => {
      if (ownerFullName) {
        await tx.vehicleOwner.update({
          where: { id: existing.ownerId },
          data: { fullName: ownerFullName }
        });
      }

      return tx.vehicle.update({
        where: { id },
        data: {
          ...vehicleFields,
          ...(plateNumber === undefined ? {} : { plateNumber: plateNumber.replace(/\s+/g, "").toUpperCase() }),
          ...(plateGovernorate === undefined ? {} : { plateGovernorate }),
          ...(plateCategory === undefined ? {} : { plateCategory })
        },
        include: { owner: true, fuelType: true }
      });
    });

    await createAuditLog({
      actorUserId: auth.user.id,
      action: "VEHICLE_UPDATED",
      resourceType: "vehicle",
      resourceId: id,
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      metadata: { changes: body.data as Prisma.InputJsonObject }
    });

    return NextResponse.json({ vehicle });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "رقم اللوحة مسجل لمركبة أخرى." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "users:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { _count: { select: { allocations: true, appointments: true } } }
  });

  if (!vehicle) {
    return NextResponse.json({ error: "المركبة غير موجودة." }, { status: 404 });
  }

  // A vehicle that holds an allocation has been promised fuel. Removing it would
  // drop that promise silently, so it is suspended instead and the caller is told.
  if (vehicle._count.allocations + vehicle._count.appointments > 0) {
    const suspended = await prisma.vehicle.update({
      where: { id },
      data: { registrationStatus: "SUSPENDED" }
    });

    await createAuditLog({
      actorUserId: auth.user.id,
      action: "VEHICLE_SUSPENDED",
      resourceType: "vehicle",
      resourceId: id,
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      metadata: { reason: "DELETE_REQUESTED_WITH_ALLOCATION" }
    });

    return NextResponse.json({
      vehicle: suspended,
      suspended: true,
      message: "لهذه المركبة حصة مخصصة، لذلك تم إيقافها بدل حذفها. ألغِ التخصيص أولاً لحذفها نهائياً."
    });
  }

  // QR tokens and the national ID document cascade with the vehicle.
  await prisma.vehicle.delete({ where: { id } });

  await createAuditLog({
    actorUserId: auth.user.id,
    action: "VEHICLE_DELETED",
    resourceType: "vehicle",
    resourceId: id,
    outcome: "SUCCESS",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    metadata: { plateNumber: vehicle.plateNumber }
  });

  return NextResponse.json({ deleted: true });
}
