import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  const station = await prisma.station.create({
    data: {
      ...body.data,
      latitude: body.data.latitude,
      longitude: body.data.longitude
    }
  });

  return NextResponse.json({ station }, { status: 201 });
}
