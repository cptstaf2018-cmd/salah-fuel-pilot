import { describe, expect, test } from "vitest";
import { loginIdentifier, toLoginIdentity } from "@/lib/validation/login";

describe("loginIdentifier", () => {
  test("accepts an email address", () => {
    expect(loginIdentifier.safeParse("station4@pilot.local").success).toBe(true);
  });

  test("accepts a phone number with separators", () => {
    expect(loginIdentifier.safeParse("0770 123 4567").success).toBe(true);
  });

  test("rejects a name that is neither", () => {
    expect(loginIdentifier.safeParse("omar").success).toBe(false);
  });

  test("rejects a malformed email", () => {
    expect(loginIdentifier.safeParse("omar@").success).toBe(false);
  });

  test("rejects digits too few to be a phone number", () => {
    expect(loginIdentifier.safeParse("07701").success).toBe(false);
  });
});

describe("toLoginIdentity", () => {
  test("files an email in the email column, lowercased", () => {
    expect(toLoginIdentity("Station4@Pilot.Local")).toEqual({
      email: "station4@pilot.local",
      phone: null
    });
  });

  test("files a phone in the phone column with separators stripped", () => {
    expect(toLoginIdentity("0770 123-4567")).toEqual({ email: null, phone: "07701234567" });
  });

  test("keeps a leading plus, which is part of the number", () => {
    expect(toLoginIdentity("+964 770 1234567")).toEqual({
      email: null,
      phone: "+9647701234567"
    });
  });
});
