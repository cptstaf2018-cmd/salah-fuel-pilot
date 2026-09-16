import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes with argon2 and verifies the original password", async () => {
    const hash = await hashPassword("StrongPassword123!");

    expect(hash).toContain("$argon2id$");
    await expect(verifyPassword(hash, "StrongPassword123!")).resolves.toBe(true);
    await expect(verifyPassword(hash, "WrongPassword123!")).resolves.toBe(false);
  });
});
