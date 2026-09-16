import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const fuelTypes = await prisma.fuelType.findMany({
    where: { isActive: true },
    orderBy: { nameAr: "asc" },
    select: {
      id: true,
      code: true,
      nameAr: true
    }
  });

  return NextResponse.json({ fuelTypes });
}
