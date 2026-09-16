import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, hashSessionToken, verifySessionToken } from "@/lib/auth/session";

const originalSecret = process.env.SESSION_SECRET;

describe("session tokens", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "a-secure-test-secret-with-more-than-32-chars";
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("creates signed tokens that can be verified", () => {
    const token = createSessionToken({
      sessionId: "session-1",
      userId: "user-1",
      role: "GOVERNORATE_ADMIN"
    });

    expect(verifySessionToken(token)).toMatchObject({
      sessionId: "session-1",
      userId: "user-1",
      role: "GOVERNORATE_ADMIN"
    });
  });

  it("rejects tampered tokens", () => {
    const token = createSessionToken({
      sessionId: "session-1",
      userId: "user-1",
      role: "GOVERNORATE_ADMIN"
    });

    expect(verifySessionToken(`${token}x`)).toBeNull();
  });

  it("hashes session tokens before persistence", () => {
    const token = "raw-token";

    expect(hashSessionToken(token)).toHaveLength(64);
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
