import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { canManageEmployee, getManagedStationIds } from "@/lib/station-users";
import { updateStationEmployeeSchema } from "@/lib/validation/station-users";

type Context = { params: Promise<{ id: string }> };

const employeeSelect = {
  id: true,
  name: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true
} as const;

/**
 * Loads the target and checks the caller may touch it, in one place so PATCH
 * and DELETE cannot drift apart on who is reachable.
 */
async function loadManagedEmployee(
  request: NextRequest,
  id: string
): Promise<{ response: NextResponse; actorId?: undefined } | { response: null; actorId: string }> {
  const auth = await requireApiPermission(request, "station-users:manage");
  if (auth.response) return { response: auth.response };

  const employee = await prisma.user.findUnique({
    where: { id },
    include: { stationUsers: { select: { stationId: true } } }
  });

  const managedStationIds = await getManagedStationIds(auth.user);

  // A missing account and an account outside the caller's stations answer the
  // same way. Telling them apart would turn this route into a way of probing
  // which user ids exist.
  if (
    !employee ||
    !canManageEmployee({
      managedStationIds,
      employeeRole: employee.role,
      employeeStationIds: employee.stationUsers.map((link) => link.stationId)
    })
  ) {
    return { response: NextResponse.json({ error: "هذا الموظف غير تابع لمحطتك." }, { status: 404 }) };
  }

  return { response: null, actorId: auth.user.id };
}

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const loaded = await loadManagedEmployee(request, id);
  if (loaded.response) return loaded.response;

  const body = updateStationEmployeeSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات التعديل غير صحيحة." }, { status: 400 });
  }

  const { password, ...fields } = body.data;

  try {
    const employee = await prisma.user.update({
      where: { id },
      data: { ...fields, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
      select: employeeSelect
    });

    // A new password or a suspension has to reach the phone already in the
    // employee's pocket. Without this the open session keeps scanning until it
    // expires on its own, which is the whole point of revoking access.
    if (password || fields.status === "SUSPENDED") {
      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    await createAuditLog({
      actorUserId: loaded.actorId,
      action: "STATION_EMPLOYEE_UPDATED",
      resourceType: "user",
      resourceId: id,
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      // The password itself never reaches the log; that it changed does.
      metadata: { ...fields, passwordChanged: Boolean(password) }
    });

    return NextResponse.json({
      employee,
      message: password
        ? "تم تحديث بيانات الموظف. عليه تسجيل الدخول من جديد بكلمة المرور الجديدة."
        : fields.status === "SUSPENDED"
          ? "تم إيقاف الموظف وإنهاء جلسته على هاتفه."
          : "تم تحديث بيانات الموظف."
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "رقم الهاتف مسجل لحساب آخر." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const loaded = await loadManagedEmployee(request, id);
  if (loaded.response) return loaded.response;

  // Every dispense and every receipt names the employee who performed it, and
  // those references are Restrict — deleting the account would either fail or
  // erase the name from the record that makes the handover auditable. Once an
  // employee has worked a shift he is retired, not deleted.
  const dispensed = await prisma.appointment.count({ where: { dispensedByUserId: id } });
  const moved = await prisma.inventoryTransaction.count({ where: { actorUserId: id } });
  const hasHistory = dispensed > 0 || moved > 0;

  await prisma.$transaction(async (tx) => {
    if (hasHistory) {
      await tx.user.update({ where: { id }, data: { status: "SUSPENDED" } });
      await tx.stationUser.deleteMany({ where: { userId: id } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      return;
    }

    // Sessions and station links cascade with the row.
    await tx.user.delete({ where: { id } });
  });

  await createAuditLog({
    actorUserId: loaded.actorId,
    action: hasHistory ? "STATION_EMPLOYEE_RETIRED" : "STATION_EMPLOYEE_DELETED",
    resourceType: "user",
    resourceId: id,
    outcome: "SUCCESS",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    metadata: { dispensed, moved }
  });

  return NextResponse.json({
    message: hasHistory
      ? `للموظف سجل عمل (${dispensed} صرف)، فأُوقف حسابه وفُصل عن المحطة بدل حذفه حفاظاً على السجل.`
      : "تم حذف الموظف."
  });
}
