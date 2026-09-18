import { Prisma } from "@prisma/client";
import { auditActions, createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type CandidateSlot = {
  id: string;
  stationId: string;
  startsAt: Date;
  capacity: number;
  bookedCount: number;
};

export function selectBestSlot(slots: CandidateSlot[]): CandidateSlot | null {
  const available = slots.filter((slot) => slot.bookedCount < slot.capacity);

  if (available.length === 0) {
    return null;
  }

  return available.sort((a, b) => {
    const timeDiff = a.startsAt.getTime() - b.startsAt.getTime();

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const aLoad = a.bookedCount / a.capacity;
    const bLoad = b.bookedCount / b.capacity;

    return aLoad - bLoad;
  })[0];
}

export function buildHourlySlots(input: {
  stationIds: string[];
  fuelTypeId: string;
  crisisRuleId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
}) {
  const slots: Array<{
    crisisRuleId: string;
    stationId: string;
    fuelTypeId: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
  }> = [];

  for (const stationId of input.stationIds) {
    let cursor = new Date(input.startsAt);

    while (cursor < input.endsAt) {
      const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000);
      slots.push({
        crisisRuleId: input.crisisRuleId,
        stationId,
        fuelTypeId: input.fuelTypeId,
        startsAt: cursor,
        endsAt: slotEnd > input.endsAt ? input.endsAt : slotEnd,
        capacity: input.capacity
      });
      cursor = slotEnd;
    }
  }

  return slots;
}

export async function createCrisisRule(input: {
  name: string;
  fuelTypeId: string;
  stationIds: string[];
  quotaLiters: number;
  cooldownHours: number;
  vehiclesPerStationPerHour: number;
  includedVehicleTypes: Array<"PRIVATE_CAR" | "TAXI" | "BUS" | "TRUCK" | "MOTORCYCLE" | "GOVERNMENT" | "OTHER">;
  eligibilityRules?: Prisma.InputJsonObject;
  startsAt: Date;
  endsAt: Date;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const rule = await prisma.$transaction(async (tx) => {
    const crisisRule = await tx.crisisRule.create({
      data: {
        name: input.name,
        fuelTypeId: input.fuelTypeId,
        createdByUserId: input.actorUserId,
        status: "ACTIVE",
        quotaLiters: new Prisma.Decimal(input.quotaLiters),
        cooldownHours: input.cooldownHours,
        vehiclesPerStationPerHour: input.vehiclesPerStationPerHour,
        includedVehicleTypes: input.includedVehicleTypes,
        eligibilityRules: input.eligibilityRules,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        stations: {
          create: input.stationIds.map((stationId) => ({ stationId }))
        }
      }
    });

    await tx.timeSlot.createMany({
      data: buildHourlySlots({
        stationIds: input.stationIds,
        fuelTypeId: input.fuelTypeId,
        crisisRuleId: crisisRule.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        capacity: input.vehiclesPerStationPerHour
      }),
      skipDuplicates: true
    });

    return crisisRule;
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: auditActions.crisisRuleCreated,
    resourceType: "crisis_rule",
    resourceId: rule.id,
    outcome: "SUCCESS",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      fuelTypeId: input.fuelTypeId,
      stationCount: input.stationIds.length,
      vehiclesPerStationPerHour: input.vehiclesPerStationPerHour
    }
  });

  return rule;
}

/** Raised when a vehicle is still inside its rule's re-fuelling cooldown. */
export class CooldownError extends Error {}
/** Raised when no eligible station has an open slot. */
export class NoSlotError extends Error {}

export async function assignVehicleToCrisisRule(input: {
  crisisRuleId: string;
  vehicleId: string;
  actorUserId: string;
  /**
   * Stations that can actually serve this vehicle. Omitted means every station
   * on the rule; the auto-allocator narrows it to those still holding enough
   * fuel, so a citizen is never booked into a station with an empty tank.
   */
  eligibleStationIds?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findUniqueOrThrow({
      where: { id: input.vehicleId }
    });
    const rule = await tx.crisisRule.findUniqueOrThrow({
      where: { id: input.crisisRuleId },
      include: { stations: true }
    });

    if (rule.status !== "ACTIVE") {
      throw new Error("Crisis rule is not active");
    }

    if (vehicle.fuelTypeId !== rule.fuelTypeId) {
      throw new Error("Vehicle fuel type is not eligible for this rule");
    }

    if (!rule.includedVehicleTypes.includes(vehicle.vehicleType)) {
      throw new Error("Vehicle type is not eligible for this rule");
    }

    // Section 10: a vehicle served recently is not eligible again yet. Checked
    // here so both the auto-allocator and a manual assignment are bound by it.
    const lastServed = await tx.appointment.findFirst({
      where: { vehicleId: vehicle.id, dispensedAt: { not: null } },
      orderBy: { dispensedAt: "desc" },
      select: { dispensedAt: true }
    });

    if (isWithinCooldown(lastServed?.dispensedAt ?? null, rule.cooldownHours, new Date())) {
      throw new CooldownError("Vehicle is still within its refuelling cooldown");
    }

    const ruleStationIds = rule.stations.map((station) => station.stationId);
    const stationIds = input.eligibleStationIds
      ? ruleStationIds.filter((id) => input.eligibleStationIds!.includes(id))
      : ruleStationIds;

    if (!stationIds.length) {
      throw new NoSlotError("No station with enough fuel for this rule");
    }

    const slots = await tx.timeSlot.findMany({
      where: {
        crisisRuleId: rule.id,
        fuelTypeId: rule.fuelTypeId,
        startsAt: { gte: new Date() },
        stationId: { in: stationIds }
      },
      orderBy: [{ startsAt: "asc" }, { bookedCount: "asc" }]
    });

    const selected = selectBestSlot(slots);

    if (!selected) {
      throw new NoSlotError("No available time slot");
    }

    const updated = await tx.timeSlot.updateMany({
      where: {
        id: selected.id,
        bookedCount: { lt: selected.capacity }
      },
      data: {
        bookedCount: { increment: 1 }
      }
    });

    if (updated.count !== 1) {
      throw new NoSlotError("Time slot is already full");
    }

    const allocation = await tx.allocation.create({
      data: {
        crisisRuleId: rule.id,
        vehicleId: vehicle.id,
        stationId: selected.stationId,
        timeSlotId: selected.id,
        reason: "RULE_BASED_CAPACITY_ALLOCATION"
      }
    });

    const appointment = await tx.appointment.create({
      data: {
        crisisRuleId: rule.id,
        vehicleId: vehicle.id,
        stationId: selected.stationId,
        fuelTypeId: rule.fuelTypeId,
        timeSlotId: selected.id,
        quotaLiters: rule.quotaLiters
      }
    });

    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { registrationStatus: "ACTIVE" }
    });

    return { allocation, appointment };
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: auditActions.allocationCreated,
    resourceType: "allocation",
    resourceId: result.allocation.id,
    outcome: "SUCCESS",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      vehicleId: input.vehicleId,
      crisisRuleId: input.crisisRuleId,
      appointmentId: result.appointment.id
    }
  });

  return result;
}

/** Allocate waiting vehicles whenever a station reports newly received fuel. */
export async function autoAllocatePendingVehicles(input: {
  fuelTypeId: string;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const rules = await prisma.crisisRule.findMany({
    where: { fuelTypeId: input.fuelTypeId, status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    orderBy: { createdAt: "asc" },
    include: { stations: true }
  });
  let allocated = 0;

  for (const rule of rules) {
    const quotaLiters = rule.quotaLiters.toNumber();
    if (quotaLiters <= 0) continue;

    const inventory = await prisma.fuelInventory.findMany({
      where: { fuelTypeId: rule.fuelTypeId, stationId: { in: rule.stations.map((station) => station.stationId) } },
      select: { stationId: true, quantityLiters: true }
    });

    // Per station, not pooled. Summing every station into one figure made the
    // loop believe a rule could serve N vehicles while sending some of them to
    // a station holding nothing — they queued and were refused at the pump.
    const remainingByStation = new Map(
      inventory.map((item) => [item.stationId, item.quantityLiters.toNumber()])
    );

    const stationsWithFuel = () =>
      [...remainingByStation.entries()]
        .filter(([, liters]) => liters >= quotaLiters)
        .map(([stationId]) => stationId);

    if (!stationsWithFuel().length) continue;

    const vehicles = await prisma.vehicle.findMany({
      where: { fuelTypeId: rule.fuelTypeId, registrationStatus: "PENDING_ALLOCATION", vehicleType: { in: rule.includedVehicleTypes }, allocations: { none: { crisisRuleId: rule.id } } },
      orderBy: { createdAt: "asc" },
      take: 1000
    });

    for (const vehicle of vehicles) {
      const eligibleStationIds = stationsWithFuel();
      if (!eligibleStationIds.length) break;

      try {
        const { allocation } = await assignVehicleToCrisisRule({
          ...input,
          crisisRuleId: rule.id,
          vehicleId: vehicle.id,
          eligibleStationIds
        });

        allocated += 1;
        // Reserve against the station that actually took the booking.
        remainingByStation.set(
          allocation.stationId,
          (remainingByStation.get(allocation.stationId) ?? 0) - quotaLiters
        );
      } catch (error) {
        // A full slot or a vehicle still in cooldown is an ordinary outcome for
        // one vehicle in the queue. Anything else is a fault, and swallowing it
        // silently would leave a broken allocation sweep reporting success.
        if (error instanceof NoSlotError || error instanceof CooldownError) continue;

        await createAuditLog({
          actorUserId: input.actorUserId,
          action: auditActions.allocationCreated,
          resourceType: "allocation",
          resourceId: vehicle.id,
          outcome: "FAILED",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            crisisRuleId: rule.id,
            vehicleId: vehicle.id,
            reason: error instanceof Error ? error.message : "UNKNOWN"
          }
        });
      }
    }
  }
  return { allocated };
}

/**
 * Whether a vehicle is still inside the re-fuelling cooldown its rule sets.
 *
 * Section 10 of the specification — "منع تكرار الاستلام" — requires this to be
 * checked server-side before a vehicle is served again, and it is one of the
 * six problems the system exists to solve. cooldownHours was stored on every
 * crisis rule and read by nothing.
 */
export function isWithinCooldown(
  lastDispensedAt: Date | null,
  cooldownHours: number,
  now: Date
): boolean {
  if (!lastDispensedAt || cooldownHours <= 0) {
    return false;
  }

  const elapsedHours = (now.getTime() - lastDispensedAt.getTime()) / (60 * 60 * 1000);
  return elapsedHours < cooldownHours;
}
