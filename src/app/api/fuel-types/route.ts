import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createFuelTypeSchema } from "@/lib/validation/stations";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission(request, "inventory:read");

  if (auth.response) {
    return auth.response;
  }

  const fuelTypes = await prisma.fuelType.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ fuelTypes });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "stations:manage");

  if (auth.response) {
    return auth.response;
  }

  const body = createFuelTypeSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات نوع الوقود غير صحيحة." }, { status: 400 });
  }

  const fuelType = await prisma.fuelType.create({
    data: body.data
  });

  return NextResponse.json({ fuelType }, { status: 201 });
}
