import { z } from "zod";

export const createStationSchema = z
  .object({
    governorateId: z.uuid(),
    districtId: z.uuid().optional(),
    code: z.string().trim().min(2).max(32),
    nameAr: z.string().trim().min(2).max(120),
    nameEn: z.string().trim().min(2).max(120).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional()
  })
  .strict();

const stationStatuses = [
  "NORMAL",
  "CROWDED",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "STOPPED",
  "CLOSED"
] as const;

/** Every field optional, but an empty body is a mistake rather than a no-op. */
export const updateStationSchema = z
  .object({
    code: z.string().trim().min(2).max(32).optional(),
    nameAr: z.string().trim().min(2).max(120).optional(),
    nameEn: z.string().trim().min(2).max(120).nullable().optional(),
    status: z.enum(stationStatuses).optional(),
    districtId: z.uuid().nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update"
  });

export const createFuelTypeSchema = z
  .object({
    code: z.string().trim().min(2).max(32),
    nameAr: z.string().trim().min(2).max(80),
    nameEn: z.string().trim().min(2).max(80).optional()
  })
  .strict();

export const manualInventoryAdjustmentSchema = z
  .object({
    stationId: z.uuid(),
    fuelTypeId: z.uuid(),
    quantityChange: z.number().finite().refine((value) => value !== 0, "quantityChange cannot be zero"),
    reason: z.string().trim().min(10).max(500)
  })
  .strict();
