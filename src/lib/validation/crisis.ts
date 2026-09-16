import { z } from "zod";

const vehicleTypes = [
  "PRIVATE_CAR",
  "TAXI",
  "BUS",
  "TRUCK",
  "MOTORCYCLE",
  "GOVERNMENT",
  "OTHER"
] as const;

export const createCrisisRuleSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    fuelTypeId: z.uuid(),
    stationIds: z.array(z.uuid()).min(1),
    quotaLiters: z.number().positive().max(500),
    cooldownHours: z.number().int().min(1).max(24 * 60),
    vehiclesPerStationPerHour: z.number().int().min(1).max(1000),
    includedVehicleTypes: z.array(z.enum(vehicleTypes)).min(1),
    eligibilityRules: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date()
  })
  .strict()
  .refine((data) => data.endsAt > data.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"]
  });

export const assignVehicleSchema = z
  .object({
    crisisRuleId: z.uuid(),
    vehicleId: z.uuid()
  })
  .strict();
