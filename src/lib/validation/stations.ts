import { z } from "zod";
import { loginIdentifier } from "@/lib/validation/login";

const stationStatuses = [
  "NORMAL",
  "CROWDED",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "STOPPED",
  "CLOSED"
] as const;

export const createStationSchema = z
  .object({
    governorateId: z.uuid(),
    districtId: z.uuid().optional(),
    code: z.string().trim().min(2).max(32),
    nameAr: z.string().trim().min(2).max(120),
    nameEn: z.string().trim().min(2).max(120).optional(),
    status: z.enum(stationStatuses).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    /**
     * Fuels the station handles, with the level at which it should warn. A
     * station with no inventory row cannot record a receipt at all — the
     * receipt route updates an existing row — so this is required to create a
     * usable station, not an optional extra.
     */
    fuelTypes: z
      .array(
        z.object({
          fuelTypeId: z.uuid(),
          minimumThresholdLiters: z.number().min(0).max(10_000_000)
        })
      )
      .min(1)
      .max(20),
    /**
     * The account that will run this station, created with it. Required, not
     * optional: there is no other way to grant anyone access to a station, so a
     * station created without one is a row nobody can ever open — and the
     * manager is in turn the only person who can add the employees who scan at
     * the gate.
     */
    manager: z
      .object({
        name: z.string().trim().min(2).max(120),
        login: loginIdentifier,
        password: z.string().min(8).max(256)
      })
      .strict()
  })
  .strict();

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

/** Only the reason is editable on a recorded movement — see the route for why. */
export const updateInventoryTransactionSchema = z
  .object({
    reason: z.string().trim().min(3).max(500)
  })
  .strict();
