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

/** Prisma's unique constraint violation, raised when two registrations race each other. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function registerVehicle(input: RegisterVehicleInput) {
  const qr = createVehicleQrSecret();

  const runRegistration = () => prisma.$transaction(async (tx) => {
    // The upsert comes first so it takes the row lock on this phone number.
    // Reading before writing let two concurrent registrations both see no
    // existing owner, both pass the check, and both create a vehicle — one
    // phone holding two rations, with no database constraint to catch it.
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

    // A concurrent registration for the same phone now blocks on that lock and
    // sees the committed count here rather than a stale empty read.
    const ownedVehicles = await tx.vehicle.count({ where: { ownerId: owner.id } });
    if (ownedVehicles > 0) {
      throw new Error("رقم الهاتف مسجل مسبقاً لمركبة. استخدم صفحة التعديل بدلاً من التسجيل الجديد.");
    }


    // Match the database's uniqueness key exactly. An absent governorate or category is
    // stored as "" rather than NULL, so a plate registered without them still collides.
    const plateGovernorate = input.plateGovernorate ?? "";
    const plateCategory = input.plateCategory ?? "";

    const existingVehicle = await tx.vehicle.findUnique({
      where: {
        plateNumber_plateGovernorate_plateCategory: {
          plateNumber: input.plateNumber,
          plateGovernorate,
          plateCategory
        }
      }
    });
    if (existingVehicle) {
      throw new Error("هذه المركبة مسجلة مسبقاً. استخدم رمز QR الموجود لديك.");
    }

    const vehicle = await tx.vehicle.create({
      data: {
        ownerId: owner.id,
        fuelTypeId: input.fuelTypeId,
        plateNumber: input.plateNumber,
        plateGovernorate,
        plateCategory,
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

  // The pre-flight check above cannot see a registration committing concurrently, so the
  // database constraint is the real guard. Report it as the same duplicate message.
  let result: Awaited<ReturnType<typeof runRegistration>>;
  try {
    result = await runRegistration();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("هذه المركبة مسجلة مسبقاً. استخدم رمز QR الموجود لديك.");
    }
    throw error;
  }

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
