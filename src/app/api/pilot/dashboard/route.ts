import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { VehicleRegistrationStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user || !["SUPER_ADMIN", "STATION_MANAGER"].includes(user.role)) return NextResponse.json({ error: "سجل الدخول بحساب الإدارة أو المحطة." }, { status: 401 });
  const admin = user.role === "SUPER_ADMIN";
  const vehiclesPage = Math.max(1, Number(request.nextUrl.searchParams.get("vehiclesPage") || 1));
  const vehiclesPageSize = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get("vehiclesPageSize") || 50)));
  const vehicleSearch = request.nextUrl.searchParams.get("vehicleSearch")?.trim() || "";
  const vehicleFuel = request.nextUrl.searchParams.get("vehicleFuel") || "";
  const vehicleStatus = request.nextUrl.searchParams.get("vehicleStatus") || "";
  const stations = await prisma.station.findMany({ where: admin ? {} : { stationUsers: { some: { userId: user.id } } }, include: { fuelInventory: { include: { fuelType: true } } }, orderBy: { code: "asc" } });
  const stationIds = stations.map((station) => station.id);
  const vehicleWhere = admin ? { ...(vehicleSearch ? { OR: [{ plateNumber: { contains: vehicleSearch, mode: "insensitive" as const } }, { owner: { fullName: { contains: vehicleSearch, mode: "insensitive" as const } } }] } : {}), ...(vehicleFuel ? { fuelTypeId: vehicleFuel } : {}), ...(vehicleStatus && Object.values(VehicleRegistrationStatus).includes(vehicleStatus as VehicleRegistrationStatus) ? { registrationStatus: vehicleStatus as VehicleRegistrationStatus } : {}) } : undefined;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Sequential, deliberately. DATABASE_URL points at the pooler with
  // connection_limit=1, which is correct for serverless, and firing these ten
  // queries through Promise.all made them contend for that single connection
  // until Prisma gave up with P2024 — the dashboard's "تعذر تحديث البيانات".
  // With one connection there is nothing to win by running them concurrently.
  const transactions = await prisma.inventoryTransaction.findMany({ where: { stationId: { in: stationIds } }, include: { station: true, fuelType: true, actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
  const vehicles = admin ? await prisma.vehicle.findMany({ where: vehicleWhere, include: { owner: true, fuelType: true }, orderBy: { createdAt: "desc" }, skip: (vehiclesPage - 1) * vehiclesPageSize, take: vehiclesPageSize }) : [];
  const vehiclesTotal = admin ? await prisma.vehicle.count({ where: vehicleWhere }) : 0;
  const vehicleFuelSummary = admin ? await prisma.vehicle.groupBy({ by: ["fuelTypeId"], _count: { _all: true } }) : [];
  const vehicleStatusSummary = admin ? await prisma.vehicle.groupBy({ by: ["registrationStatus"], _count: { _all: true } }) : [];
  const logs = admin ? await prisma.auditLog.findMany({ include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }) : [];
  const governorates = admin ? await prisma.governorate.findMany({ include: { districts: { orderBy: { nameAr: "asc" } } }, orderBy: { nameAr: "asc" } }) : [];
  const fuelTypes = admin ? await prisma.fuelType.findMany({ where: { isActive: true }, orderBy: { nameAr: "asc" } }) : [];
  const crisisRules = await prisma.crisisRule.findMany({ where: { status: { in: ["ACTIVE", "PAUSED"] } }, include: { fuelType: { select: { nameAr: true } }, _count: { select: { stations: true, allocations: true } } }, orderBy: { createdAt: "desc" } });
  // Only dispensing moves fuel out, so today's handover total is the sum of
  // those movements — the figure that proves the loop is actually closing.
  const dispensedToday = await prisma.inventoryTransaction.aggregate({ where: { stationId: { in: stationIds }, type: "DISPENSING", createdAt: { gte: startOfToday } }, _sum: { quantityChange: true }, _count: { _all: true } });
  const fuelNames = new Map(stations.flatMap((station) => station.fuelInventory.map((item) => [item.fuelTypeId, item.fuelType.nameAr])));
  return NextResponse.json({
    user,
    stations,
    transactions,
    vehicles,
    vehiclesPage: { page: vehiclesPage, pageSize: vehiclesPageSize, total: vehiclesTotal, totalPages: Math.max(1, Math.ceil(vehiclesTotal / vehiclesPageSize)) },
    vehicleSummary: {
      byFuel: vehicleFuelSummary.map((item) => ({ fuelTypeId: item.fuelTypeId, fuelName: fuelNames.get(item.fuelTypeId) || "غير معروف", count: item._count._all })),
      byStatus: vehicleStatusSummary.map((item) => ({ status: item.registrationStatus, count: item._count._all }))
    },
    logs,
    governorates,
    fuelTypes,
    crisisRules,
    dispensedToday: {
      liters: Math.abs(dispensedToday._sum.quantityChange?.toNumber() ?? 0),
      count: dispensedToday._count._all
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
