import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { AppointmentStatus, VehicleRegistrationStatus } from "@prisma/client";

/**
 * Pulls a requested page back into range once the total is known. Deleting the
 * last row on the last page would otherwise leave the operator on a page that
 * no longer exists, staring at an empty table with no way back but the pager.
 */
const clampPage = (page: number, pageSize: number, total: number) =>
  Math.min(page, Math.max(1, Math.ceil(total / pageSize)));

/** The shape every paged list reports back, so one pager component serves all. */
const pageMeta = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize))
});

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  // Station employees reach the same endpoint from their phones: the station
  // scoping below already limits them to where they work, and the admin-only
  // blocks stay empty for them.
  if (!user || !["SUPER_ADMIN", "STATION_MANAGER", "STATION_EMPLOYEE"].includes(user.role)) return NextResponse.json({ error: "سجل الدخول بحساب الإدارة أو المحطة." }, { status: 401 });
  const admin = user.role === "SUPER_ADMIN";
  const vehicleSearch = request.nextUrl.searchParams.get("vehicleSearch")?.trim() || "";
  const vehicleFuel = request.nextUrl.searchParams.get("vehicleFuel") || "";
  const vehicleStatus = request.nextUrl.searchParams.get("vehicleStatus") || "";
  // Every list is paged. The console used to fetch fifty movements and thirty
  // log lines and render the first twelve of each, so the rest were fetched and
  // thrown away, and nothing past them could be reached at all.
  const page = (name: string) => Math.max(1, Number(request.nextUrl.searchParams.get(name) || 1));
  const pageSize = (name: string) => Math.min(50, Math.max(20, Number(request.nextUrl.searchParams.get(name) || 20)));
  const transactionsPage = page("transactionsPage");
  const transactionsPageSize = pageSize("transactionsPageSize");
  const logsPage = page("logsPage");
  const logsPageSize = pageSize("logsPageSize");
  const vehiclesPage = page("vehiclesPage");
  const vehiclesPageSize = pageSize("vehiclesPageSize");
  const stations = await prisma.station.findMany({ where: admin ? {} : { stationUsers: { some: { userId: user.id } } }, include: { fuelInventory: { include: { fuelType: true } } }, orderBy: { code: "asc" } });
  const stationIds = stations.map((station) => station.id);
  // Two of the filter values describe where a citizen is in the handover cycle
  // rather than their registration record, so they filter on appointments. The
  // console derives the same distinction for display; this keeps the two in step.
  const servingFilter =
    vehicleStatus === "SERVED"
      ? { appointments: { some: { dispensedAt: { not: null } } } }
      : vehicleStatus === "AWAITING_DISPENSE"
        ? {
            appointments: {
              some: { dispensedAt: null, status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.READY] } }
            }
          }
        : {};

  const registrationFilter =
    vehicleStatus && Object.values(VehicleRegistrationStatus).includes(vehicleStatus as VehicleRegistrationStatus)
      ? { registrationStatus: vehicleStatus as VehicleRegistrationStatus }
      : {};

  const vehicleWhere = admin
    ? {
        ...(vehicleSearch
          ? {
              OR: [
                { plateNumber: { contains: vehicleSearch, mode: "insensitive" as const } },
                { owner: { fullName: { contains: vehicleSearch, mode: "insensitive" as const } } }
              ]
            }
          : {}),
        ...(vehicleFuel ? { fuelTypeId: vehicleFuel } : {}),
        ...registrationFilter,
        ...servingFilter
      }
    : undefined;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Sequential, deliberately. DATABASE_URL points at the pooler with
  // connection_limit=1, which is correct for serverless, and firing these ten
  // queries through Promise.all made them contend for that single connection
  // until Prisma gave up with P2024 — the dashboard's "تعذر تحديث البيانات".
  // With one connection there is nothing to win by running them concurrently.
  const transactionWhere = { stationId: { in: stationIds } };
  const transactionsTotal = await prisma.inventoryTransaction.count({ where: transactionWhere });
  const transactionsAt = clampPage(transactionsPage, transactionsPageSize, transactionsTotal);
  const transactions = await prisma.inventoryTransaction.findMany({ where: transactionWhere, include: { station: true, fuelType: true, actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (transactionsAt - 1) * transactionsPageSize, take: transactionsPageSize });
  const vehiclesTotal = admin ? await prisma.vehicle.count({ where: vehicleWhere }) : 0;
  const vehiclesAt = clampPage(vehiclesPage, vehiclesPageSize, vehiclesTotal);
  const vehicles = admin ? await prisma.vehicle.findMany({ where: vehicleWhere, include: { owner: true, fuelType: true, appointments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, dispensedAt: true, dispensedLiters: true, station: { select: { nameAr: true } } } } }, orderBy: { createdAt: "desc" }, skip: (vehiclesAt - 1) * vehiclesPageSize, take: vehiclesPageSize }) : [];
  const vehicleFuelSummary = admin ? await prisma.vehicle.groupBy({ by: ["fuelTypeId"], _count: { _all: true } }) : [];
  const vehicleStatusSummary = admin ? await prisma.vehicle.groupBy({ by: ["registrationStatus"], _count: { _all: true } }) : [];
  const logsTotal = admin ? await prisma.auditLog.count() : 0;
  const logsAt = clampPage(logsPage, logsPageSize, logsTotal);
  const logs = admin ? await prisma.auditLog.findMany({ include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (logsAt - 1) * logsPageSize, take: logsPageSize }) : [];
  const governorates = admin ? await prisma.governorate.findMany({ include: { districts: { orderBy: { nameAr: "asc" } } }, orderBy: { nameAr: "asc" } }) : [];
  const fuelTypes = admin ? await prisma.fuelType.findMany({ where: { isActive: true }, orderBy: { nameAr: "asc" } }) : [];
  const crisisRules = await prisma.crisisRule.findMany({ where: { status: { in: ["ACTIVE", "PAUSED"] } }, include: { fuelType: { select: { nameAr: true } }, _count: { select: { stations: true, allocations: true } } }, orderBy: { createdAt: "desc" } });
  // Only dispensing moves fuel out, so today's handover total is the sum of
  // those movements — the figure that proves the loop is actually closing.
  const servedToday = admin ? await prisma.appointment.count({ where: { dispensedAt: { gte: startOfToday } } }) : 0;
  // Only the manager staffs his own gate, so only his console carries the list.
  const stationEmployeeLinks = user.role === "STATION_MANAGER" ? await prisma.stationUser.findMany({ where: { stationId: { in: stationIds }, user: { role: "STATION_EMPLOYEE" } }, include: { user: { select: { id: true, name: true, phone: true, status: true, lastLoginAt: true } }, station: { select: { nameAr: true } } }, orderBy: { createdAt: "desc" } }) : [];
  const dispensedToday = await prisma.inventoryTransaction.aggregate({ where: { stationId: { in: stationIds }, type: "DISPENSING", createdAt: { gte: startOfToday } }, _sum: { quantityChange: true }, _count: { _all: true } });
  const fuelNames = new Map(stations.flatMap((station) => station.fuelInventory.map((item) => [item.fuelTypeId, item.fuelType.nameAr])));
  return NextResponse.json({
    user,
    stations,
    transactions,
    vehicles,
    vehiclesPage: pageMeta(vehiclesAt, vehiclesPageSize, vehiclesTotal),
    vehicleSummary: {
      byFuel: vehicleFuelSummary.map((item) => ({ fuelTypeId: item.fuelTypeId, fuelName: fuelNames.get(item.fuelTypeId) || "غير معروف", count: item._count._all })),
      byStatus: vehicleStatusSummary.map((item) => ({ status: item.registrationStatus, count: item._count._all }))
    },
    transactionsPage: pageMeta(transactionsAt, transactionsPageSize, transactionsTotal),
    logs,
    logsPage: pageMeta(logsAt, logsPageSize, logsTotal),
    governorates,
    fuelTypes,
    crisisRules,
    servedToday,
    stationEmployees: stationEmployeeLinks.map((link) => ({ ...link.user, stationId: link.stationId, stationName: link.station.nameAr })),
    dispensedToday: {
      liters: Math.abs(dispensedToday._sum.quantityChange?.toNumber() ?? 0),
      count: dispensedToday._count._all
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
