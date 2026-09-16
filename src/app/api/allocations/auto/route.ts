import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api";
import { autoAllocatePendingVehicles } from "@/lib/allocation";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "crisis:manage");
  if (auth.response) return auth.response;
  const fuelTypes = await prisma.fuelType.findMany({ where: { isActive: true }, select: { id: true } });
  let allocated = 0;
  for (const fuelType of fuelTypes) {
    const result = await autoAllocatePendingVehicles({ fuelTypeId: fuelType.id, actorUserId: auth.user.id, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") });
    allocated += result.allocated;
  }
  return NextResponse.json({ allocated });
}
