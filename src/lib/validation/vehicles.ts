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

const registrationStatuses = [
  "PENDING_ALLOCATION",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED"
] as const;

export const updateVehicleSchema = z
  .object({
    ownerFullName: z.string().trim().min(2).max(120).optional(),
    plateNumber: z.string().trim().min(1).max(32).optional(),
    plateGovernorate: z.string().trim().max(80).optional(),
    plateCategory: z.string().trim().max(40).optional(),
    vehicleType: z.enum(vehicleTypes).optional(),
    fuelTypeId: z.uuid().optional(),
    registrationStatus: z.enum(registrationStatuses).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update"
  });

export const confirmDispenseSchema = z
  .object({
    qrPayload: z.string().trim().min(32).max(256),
    stationId: z.uuid(),
    /** Omitted means hand over the full allocated quota. */
    liters: z.number().positive().max(500).multipleOf(0.001).optional()
  })
  .strict();

export const verifyQrSchema = z
  .object({
    qrPayload: z.string().trim().min(32).max(256)
  })
  .strict();
