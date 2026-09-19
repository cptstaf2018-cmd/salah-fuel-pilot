import { z } from "zod";

const phonePattern = /^[0-9+][0-9\s-]*$/;

const stripSeparators = (value: string) => value.replace(/[\s-]/g, "");

/**
 * One field for both kinds of sign-in name.
 *
 * Managers were seeded with an email and employees sign in with a phone, and
 * the login route already matches either column — so whoever creates the
 * account types whichever they will actually hand over, and the server files
 * it in the right column rather than forcing a fake address on a man who only
 * has a phone.
 */
export const loginIdentifier = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .refine(
    (value) =>
      value.includes("@")
        ? z.email().safeParse(value).success
        : phonePattern.test(value) && stripSeparators(value).length >= 7,
    "اسم الدخول يجب أن يكون بريداً إلكترونياً أو رقم هاتف"
  );

/**
 * Which column a sign-in name belongs in. Separators are stripped from a phone
 * because the login route matches it exactly, and "0770 123 4567" dictated by
 * an admin would never match "07701234567" typed by its owner.
 */
export function toLoginIdentity(login: string): { email: string | null; phone: string | null } {
  const trimmed = login.trim();

  return trimmed.includes("@")
    ? { email: trimmed.toLowerCase(), phone: null }
    : { email: null, phone: stripSeparators(trimmed) };
}
