import { z } from "zod";

/**
 * Employees sign in from their own phones at the gate, so the phone number is
 * the login — they have no work email. Separators are stripped before storing
 * because the login route matches the column exactly, and "0770 123 4567"
 * typed by the manager would never match "07701234567" typed by the employee.
 */
const phone = z
  .string()
  .trim()
  .min(7)
  .max(24)
  .regex(/^[0-9+][0-9\s-]*$/, "رقم هاتف غير صالح")
  .transform((value) => value.replace(/[\s-]/g, ""));

/** The login route rejects anything shorter, so a weaker password here would
 *  create an account that could never be used. */
const password = z.string().min(8).max(256);

export const createStationEmployeeSchema = z
  .object({
    stationId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    phone,
    password
  })
  .strict();

export const updateStationEmployeeSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: phone.optional(),
    password: password.optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update"
  });
