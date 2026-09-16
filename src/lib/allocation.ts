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

export async function assignVehicleToCrisisRule(input: {
  crisisRuleId: string;
  vehicleId: string;
  actorUserId: string;
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

    const slots = await tx.timeSlot.findMany({
      where: {
        crisisRuleId: rule.id,
        fuelTypeId: rule.fuelTypeId,
        startsAt: { gte: new Date() },
        stationId: { in: rule.stations.map((station) => station.stationId) }
      },
      orderBy: [{ startsAt: "asc" }, { bookedCount: "asc" }]
    });

    const selected = selectBestSlot(slots);

    if (!selected) {
      throw new Error("No available time slot");
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
      throw new Error("Time slot is already full");
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
