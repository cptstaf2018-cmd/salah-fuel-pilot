import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireApiPermission } from "@/lib/api";
import { createStationSchema } from "@/lib/validation/stations";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission(request, "stations:read");

  if (auth.response) {
    return auth.response;
  }

  // stations:read is granted to station managers too, so the listing is scoped
  // to the stations a user actually works at. Without this a single manager
  // could read every station's live stock across the governorate.
  const governorateWide = ["SUPER_ADMIN", "GOVERNORATE_ADMIN", "OPERATIONS_MANAGER", "DISTRIBUTION_ADMIN"].includes(
    auth.user.role
  );

  const stations = await prisma.station.findMany({
    where: governorateWide ? {} : { stationUsers: { some: { userId: auth.user.id } } },
    orderBy: { createdAt: "desc" },
    include: {
      governorate: true,
      district: true,
      fuelInventory: {
        include: { fuelType: true }
      }
    }
  });

  return NextResponse.json({ stations });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "stations:manage");

  if (auth.response) {
    return auth.response;
  }

  const body = createStationSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات المحطة غير صحيحة." }, { status: 400 });
  }

  const { fuelTypes, ...stationData } = body.data;

  try {
    // The inventory rows are created with the station, not later: the receipt
    // route updates an existing row, so a station without them cannot record a
    // delivery and would look broken the first time it was used.
    const station = await prisma.$transaction(async (tx) => {
      const created = await tx.station.create({ data: stationData });

      await tx.fuelInventory.createMany({
        data: fuelTypes.map((fuel) => ({
          stationId: created.id,
          fuelTypeId: fuel.fuelTypeId,
          quantityLiters: 0,
          minimumThresholdLiters: fuel.minimumThresholdLiters
        }))
      });

      return tx.station.findUniqueOrThrow({
        where: { id: created.id },
        include: { fuelInventory: { include: { fuelType: true } } }
      });
    });

    await createAuditLog({
      actorUserId: auth.user.id,
      action: "STATION_CREATED",
      resourceType: "station",
      resourceId: station.id,
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      metadata: { code: station.code, nameAr: station.nameAr, fuelTypes: fuelTypes.length }
    });

    return NextResponse.json({ station }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "رمز المحطة مستخدم لمحطة أخرى." }, { status: 409 });
    }
    throw error;
  }
}
