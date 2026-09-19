import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { getManagedStationIds } from "@/lib/station-users";
import { createStationEmployeeSchema } from "@/lib/validation/station-users";

const employeeSelect = {
  id: true,
  name: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission(request, "station-users:manage");
  if (auth.response) return auth.response;

  const stationIds = await getManagedStationIds(auth.user);

  const links = await prisma.stationUser.findMany({
    where: { stationId: { in: stationIds }, user: { role: "STATION_EMPLOYEE" } },
    include: { user: { select: employeeSelect }, station: { select: { nameAr: true } } },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({
    employees: links.map((link) => ({
      ...link.user,
      stationId: link.stationId,
      stationName: link.station.nameAr
    }))
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "station-users:manage");
  if (auth.response) return auth.response;

  const body = createStationEmployeeSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json(
      { error: "بيانات الموظف غير صحيحة. تحقق من الاسم ورقم الهاتف وكلمة مرور لا تقل عن 8 خانات." },
      { status: 400 }
    );
  }

  const stationIds = await getManagedStationIds(auth.user);

  if (!stationIds.includes(body.data.stationId)) {
    return NextResponse.json({ error: "هذه المحطة غير مرتبطة بحسابك." }, { status: 403 });
  }

  // Hashed before the transaction, deliberately: argon2 is tuned to take tens
  // of milliseconds, and holding a pooled connection open for that on every
  // hire is wasted on a database limited to a single connection.
  const passwordHash = await hashPassword(body.data.password);

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: body.data.name,
          phone: body.data.phone,
          passwordHash,
          role: "STATION_EMPLOYEE"
        },
        select: employeeSelect
      });

      await tx.stationUser.create({
        data: { stationId: body.data.stationId, userId: created.id }
      });

      return created;
    });

    await createAuditLog({
      actorUserId: auth.user.id,
      action: "STATION_EMPLOYEE_CREATED",
      resourceType: "user",
      resourceId: employee.id,
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      metadata: { stationId: body.data.stationId, name: employee.name }
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "رقم الهاتف مسجل لحساب آخر." }, { status: 409 });
    }
    throw error;
  }
}
