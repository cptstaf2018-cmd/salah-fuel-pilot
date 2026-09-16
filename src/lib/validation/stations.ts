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
