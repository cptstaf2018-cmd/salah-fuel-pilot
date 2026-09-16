import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createStationSchema } from "@/lib/validation/stations";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission(request, "stations:read");

  if (auth.response) {
    return auth.response;
  }

  const stations = await prisma.station.findMany({
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
