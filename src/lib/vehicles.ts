import { Prisma } from "@prisma/client";
import { auditActions, createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createVehicleQrSecret, hashQrSecret, parseVehicleQrPayload, renderQrSvg } from "@/lib/qr";

type RegisterVehicleInput = {
  ownerFullName: string;
  phone: string;
  plateNumber: string;
  plateGovernorate?: string;
  plateCategory?: string;
  plateMetadata?: Prisma.InputJsonObject;
  vehicleType: "PRIVATE_CAR" | "TAXI" | "BUS" | "TRUCK" | "MOTORCYCLE" | "GOVERNMENT" | "OTHER";
  fuelTypeId: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function registerVehicle(input: RegisterVehicleInput) {
  const qr = createVehicleQrSecret();

  const result = await prisma.$transaction(async (tx) => {
    const existingOwner = await tx.vehicleOwner.findUnique({ where: { phone: input.phone }, include: { vehicles: { take: 1 } } });
    if (existingOwner?.vehicles.length) {
      throw new Error("رقم الهاتف مسجل مسبقاً لمركبة. استخدم صفحة التعديل بدلاً من التسجيل الجديد.");
    }
    const owner = await tx.vehicleOwner.upsert({
      where: { phone: input.phone },
      create: {
        fullName: input.ownerFullName,
        phone: input.phone,
        userId: input.actorUserId ?? undefined
      },
      update: {
        fullName: input.ownerFullName
      }
    });


    const existingVehicle = await tx.vehicle.findFirst({
      where: {
        plateNumber: input.plateNumber,
        ...(input.plateGovernorate ? { plateGovernorate: input.plateGovernorate } : {})
      },
      include: { qrTokens: { where: { revokedAt: null }, orderBy: { createdAt: "desc" }, take: 1 } }
    });
    if (existingVehicle) {
      throw new Error("هذه المركبة مسجلة مسبقاً. استخدم رمز QR الموجود لديك.");
    }

    const vehicle = await tx.vehicle.create({
      data: {
        ownerId: owner.id,
        fuelTypeId: input.fuelTypeId,
        plateNumber: input.plateNumber,
        plateGovernorate: input.plateGovernorate,
        plateCategory: input.plateCategory,
        plateMetadata: input.plateMetadata,
        vehicleType: input.vehicleType
      }
    });

    const qrToken = await tx.vehicleQrToken.create({
      data: {
        vehicleId: vehicle.id,
        publicId: qr.publicId,
        tokenHash: hashQrSecret(qr.secret)
      }
    });

    return { owner, vehicle, qrToken };
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: auditActions.vehicleRegistered,
    resourceType: "vehicle",
    resourceId: result.vehicle.id,
    outcome: "SUCCESS",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      qrTokenId: result.qrToken.id,
      fuelTypeId: input.fuelTypeId
    }
  });

  return {
    ...result,
    qrPayload: qr.payload,
    qrSvg: await renderQrSvg(qr.payload)
  };
}

export async function verifyVehicleQr(qrPayload: string) {
  const parsed = parseVehicleQrPayload(qrPayload);

  if (!parsed) {
    return null;
  }

  const qrToken = await prisma.vehicleQrToken.findFirst({
    where: {
      publicId: parsed.publicId,
      tokenHash: hashQrSecret(parsed.secret),
      revokedAt: null
    },
    include: {
      vehicle: {
        include: {
          owner: true,
          fuelType: true
        }
      }
    }
  });

  return qrToken?.vehicle ?? null;
}
