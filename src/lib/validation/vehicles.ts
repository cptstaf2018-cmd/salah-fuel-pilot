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

export const registerVehicleSchema = z
  .object({
    ownerFullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(24),
    plateNumber: z.string().trim().min(1).max(32),
    plateGovernorate: z.string().trim().min(2).max(80).optional(),
    plateCategory: z.string().trim().min(1).max(40).optional(),
    plateMetadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    vehicleType: z.enum(vehicleTypes),
    fuelTypeId: z.uuid()
  })
  .strict();

export const verifyQrSchema = z
  .object({
    qrPayload: z.string().trim().min(32).max(256)
  })
  .strict();
