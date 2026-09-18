import { Prisma, type AppointmentStatus } from "@prisma/client";
import { isWithinCooldown } from "@/lib/allocation";
import { auditActions, createAuditLog } from "@/lib/audit";
import { calculateInventoryMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { verifyVehicleQr } from "@/lib/vehicles";

/**
 * Why a dispense was refused. The station screen maps each one to an Arabic
 * message, so the operator learns what to do rather than seeing a generic error.
 */
export type DispenseRefusal =
  | "ALREADY_DISPENSED"
  | "APPOINTMENT_NOT_ACTIVE"
  | "WRONG_STATION"
  | "RULE_ENDED"
  | "TOO_EARLY"
  | "WITHIN_COOLDOWN"
  | "INVALID_QUANTITY"
  | "ABOVE_QUOTA"
  | "INSUFFICIENT_STOCK";

export type EvaluateDispenseInput = {
  appointmentStatus: AppointmentStatus;
  appointmentStationId: string;
  /** Stations the operator is allowed to dispense at. */
  allowedStationIds: string[];
  slotStartsAt: Date;
  ruleEndsAt: Date;
  now: Date;
  quotaLiters: number;
  /** The rule's re-fuelling cooldown, and when this vehicle was last served. */
  cooldownHours: number;
  lastDispensedAt: Date | null;
  /** Operator override when the tank fills before the quota is reached. */
  requestedLiters: number | undefined;
  availableLiters: number;
};

export type EvaluateDispenseResult =
  | { ok: true; liters: number }
  | { ok: false; reason: DispenseRefusal };

/**
 * Decides whether fuel may be handed over, with no database access, so the
 * policy can be tested directly. The caller still performs the write under a
 * conditional update — this function cannot see a concurrent dispense.
 */
export function evaluateDispense(input: EvaluateDispenseInput): EvaluateDispenseResult {
  // Checked first: a double scan is the most likely mistake at the pump, and the
  // operator needs to hear that the fuel already went out before anything else.
  if (input.appointmentStatus === "COMPLETED") {
    return { ok: false, reason: "ALREADY_DISPENSED" };
  }

  if (input.appointmentStatus !== "SCHEDULED" && input.appointmentStatus !== "READY") {
    return { ok: false, reason: "APPOINTMENT_NOT_ACTIVE" };
  }

  if (!input.allowedStationIds.includes(input.appointmentStationId)) {
    return { ok: false, reason: "WRONG_STATION" };
  }

  if (input.now > input.ruleEndsAt) {
    return { ok: false, reason: "RULE_ENDED" };
  }

  // The slot gates how early a citizen may arrive, not how late. Queues run over,
  // and refusing a late arrival would strand someone holding a valid allocation.
  if (input.now < input.slotStartsAt) {
    return { ok: false, reason: "TOO_EARLY" };
  }

  // Section 10: the last handover gates the next one, checked at the pump and
  // not only when the appointment was issued — an allocation can outlive a
  // dispense made under an earlier rule.
  if (isWithinCooldown(input.lastDispensedAt, input.cooldownHours, input.now)) {
    return { ok: false, reason: "WITHIN_COOLDOWN" };
  }

  const liters = input.requestedLiters ?? input.quotaLiters;

  if (!Number.isFinite(liters) || liters <= 0) {
    return { ok: false, reason: "INVALID_QUANTITY" };
  }

  if (liters > input.quotaLiters) {
    return { ok: false, reason: "ABOVE_QUOTA" };
  }

  if (liters > input.availableLiters) {
    return { ok: false, reason: "INSUFFICIENT_STOCK" };
  }

  return { ok: true, liters };
}

/** Reasons that stop a dispense before the appointment is even looked up. */
export type DispenseLookupRefusal = "VEHICLE_NOT_FOUND" | "NO_APPOINTMENT" | "RACE_LOST";

export type ConfirmDispenseResult =
  | {
      ok: true;
      liters: number;
      appointmentId: string;
      vehiclePlate: string;
      ownerName: string;
      fuelName: string;
      remainingLiters: number;
    }
  | { ok: false; reason: DispenseRefusal | DispenseLookupRefusal };

type ConfirmDispenseInput = {
  qrPayload: string;
  /** The station the operator is standing at; already checked against the user. */
  stationId: string;
  liters?: number;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Hands fuel over against a scanned QR code: the step that closes the loop from
 * registration through allocation to an actual tank being filled, and the only
 * place inventory ever decreases.
 *
 * Two writes are conditional rather than read-then-write, because a busy station
 * has several pumps scanning at once: the appointment only completes if it is
 * still outstanding, and stock only decrements if it still covers the quantity.
 */
export async function confirmDispense(input: ConfirmDispenseInput): Promise<ConfirmDispenseResult> {
  const audit = async (outcome: "SUCCESS" | "DENIED", metadata: Prisma.InputJsonObject) =>
    createAuditLog({
      actorUserId: input.actorUserId,
      action: outcome === "SUCCESS" ? auditActions.dispensingConfirmed : auditActions.dispensingRejected,
      resourceType: "appointment",
      resourceId: typeof metadata.appointmentId === "string" ? metadata.appointmentId : null,
      outcome,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata
    });

  const vehicle = await verifyVehicleQr(input.qrPayload);

  if (!vehicle) {
    await audit("DENIED", { reason: "VEHICLE_NOT_FOUND", stationId: input.stationId });
    return { ok: false, reason: "VEHICLE_NOT_FOUND" };
  }

  // The most recent appointment carries the verdict, completed or not, so a
  // second scan reports ALREADY_DISPENSED instead of looking unallocated.
  const appointment = await prisma.appointment.findFirst({
    where: { vehicleId: vehicle.id },
    orderBy: { createdAt: "desc" },
    include: { timeSlot: true, crisisRule: true, fuelType: true }
  });

  if (!appointment) {
    await audit("DENIED", { reason: "NO_APPOINTMENT", vehicleId: vehicle.id });
    return { ok: false, reason: "NO_APPOINTMENT" };
  }

  // The most recent completed handover for this vehicle, whichever rule it
  // was made under, is what the cooldown measures from.
  const lastServed = await prisma.appointment.findFirst({
    where: { vehicleId: vehicle.id, dispensedAt: { not: null } },
    orderBy: { dispensedAt: "desc" },
    select: { dispensedAt: true }
  });

  const inventory = await prisma.fuelInventory.findUnique({
    where: {
      stationId_fuelTypeId: {
        stationId: appointment.stationId,
        fuelTypeId: appointment.fuelTypeId
      }
    }
  });

  const verdict = evaluateDispense({
    appointmentStatus: appointment.status,
    appointmentStationId: appointment.stationId,
    allowedStationIds: [input.stationId],
    slotStartsAt: appointment.timeSlot.startsAt,
    ruleEndsAt: appointment.crisisRule.endsAt,
    now: new Date(),
    quotaLiters: appointment.quotaLiters.toNumber(),
    cooldownHours: appointment.crisisRule.cooldownHours,
    lastDispensedAt: lastServed?.dispensedAt ?? null,
    requestedLiters: input.liters,
    availableLiters: inventory?.quantityLiters.toNumber() ?? 0
  });

  if (!verdict.ok) {
    await audit("DENIED", {
      reason: verdict.reason,
      appointmentId: appointment.id,
      vehicleId: vehicle.id,
      stationId: input.stationId
    });
    return verdict;
  }

  const { liters } = verdict;

  try {
    const remainingLiters = await prisma.$transaction(async (tx) => {
      const claimed = await tx.appointment.updateMany({
        where: { id: appointment.id, status: { in: ["SCHEDULED", "READY"] } },
        data: {
          status: "COMPLETED",
          dispensedAt: new Date(),
          dispensedByUserId: input.actorUserId,
          dispensedLiters: new Prisma.Decimal(liters)
        }
      });

      // Another pump completed it between the check above and this update.
      if (claimed.count !== 1) {
        throw new DispenseRaceError();
      }

      const drawn = await tx.fuelInventory.updateMany({
        where: { id: inventory!.id, quantityLiters: { gte: new Prisma.Decimal(liters) } },
        data: { quantityLiters: { decrement: new Prisma.Decimal(liters) } }
      });

      // Stock fell below the quantity while this dispense was being prepared.
      if (drawn.count !== 1) {
        throw new DispenseStockError();
      }

      const updated = await tx.fuelInventory.findUniqueOrThrow({ where: { id: inventory!.id } });
      const movement = calculateInventoryMovement({
        currentQuantity: updated.quantityLiters.toNumber() + liters,
        quantityChange: -liters,
        type: "DISPENSING"
      });

      await tx.inventoryTransaction.create({
        data: {
          stationId: appointment.stationId,
          fuelTypeId: appointment.fuelTypeId,
          inventoryId: inventory!.id,
          type: "DISPENSING",
          quantityBefore: new Prisma.Decimal(movement.quantityBefore),
          quantityChange: new Prisma.Decimal(movement.quantityChange),
          quantityAfter: new Prisma.Decimal(movement.quantityAfter),
          actorUserId: input.actorUserId,
          reason: `صرف حصة · موعد ${appointment.id.slice(0, 8)}`,
          referenceType: "APPOINTMENT",
          referenceId: appointment.id
        }
      });

      return updated.quantityLiters.toNumber();
    });

    await audit("SUCCESS", {
      appointmentId: appointment.id,
      vehicleId: vehicle.id,
      stationId: appointment.stationId,
      liters
    });

    return {
      ok: true,
      liters,
      appointmentId: appointment.id,
      vehiclePlate: vehicle.plateNumber,
      ownerName: vehicle.owner.fullName,
      fuelName: appointment.fuelType.nameAr,
      remainingLiters
    };
  } catch (error) {
    if (error instanceof DispenseRaceError) {
      await audit("DENIED", { reason: "RACE_LOST", appointmentId: appointment.id });
      return { ok: false, reason: "ALREADY_DISPENSED" };
    }

    if (error instanceof DispenseStockError) {
      await audit("DENIED", { reason: "INSUFFICIENT_STOCK", appointmentId: appointment.id });
      return { ok: false, reason: "INSUFFICIENT_STOCK" };
    }

    throw error;
  }
}

class DispenseRaceError extends Error {}
class DispenseStockError extends Error {}
