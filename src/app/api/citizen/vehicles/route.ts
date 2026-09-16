import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { registerVehicleSchema } from "@/lib/validation/vehicles";
import { registerVehicle } from "@/lib/vehicles";

function normalizeVehicleInput(data: ReturnType<typeof registerVehicleSchema.parse>) {
  return {
    ...data,
    phone: data.phone.replace(/\s+/g, ""),
    plateNumber: data.plateNumber.replace(/\s+/g, "").toUpperCase(),
    plateMetadata: data.plateMetadata as Prisma.InputJsonObject | undefined
  };
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user || user.role !== "CITIZEN") {
    return NextResponse.json({ error: "يجب تسجيل دخول المواطن." }, { status: 401 });
  }

  const owner = await prisma.vehicleOwner.findFirst({
    where: {
      OR: [{ userId: user.id }, ...(user.phone ? [{ phone: user.phone }] : [])]
    },
    include: {
      vehicles: {
        include: {
          fuelType: true,
          qrTokens: {
            where: { revokedAt: null },
            select: { publicId: true, createdAt: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return NextResponse.json({ vehicles: owner?.vehicles ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  const body = registerVehicleSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات المركبة غير صحيحة." }, { status: 400 });
  }

  try {
    const result = await registerVehicle({
      ...normalizeVehicleInput(body.data),
      actorUserId: user?.role === "CITIZEN" ? user.id : null,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    return NextResponse.json(
      {
        vehicle: {
          id: result.vehicle.id,
          plateNumber: result.vehicle.plateNumber,
          registrationStatus: result.vehicle.registrationStatus
        },
        qr: {
          publicId: result.qrToken.publicId,
          payload: result.qrPayload,
          svg: result.qrSvg
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تسجيل المركبة." },
      { status: 400 }
    );
  }
}
