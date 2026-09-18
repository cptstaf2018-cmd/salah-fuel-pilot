import { describe, expect, it } from "vitest";
import { isWithinCooldown } from "@/lib/allocation";

const now = new Date("2026-09-19T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

describe("isWithinCooldown", () => {
  it("blocks a vehicle served an hour ago under a 48 hour rule", () => {
    expect(isWithinCooldown(hoursAgo(1), 48, now)).toBe(true);
  });

  it("blocks right up to the boundary", () => {
    expect(isWithinCooldown(hoursAgo(47.9), 48, now)).toBe(true);
  });

  it("releases the vehicle once the cooldown has elapsed", () => {
    expect(isWithinCooldown(hoursAgo(48), 48, now)).toBe(false);
    expect(isWithinCooldown(hoursAgo(72), 48, now)).toBe(false);
  });

  it("does not block a vehicle that has never been served", () => {
    expect(isWithinCooldown(null, 48, now)).toBe(false);
  });

  it("treats a zero or negative cooldown as no restriction", () => {
    expect(isWithinCooldown(hoursAgo(0.1), 0, now)).toBe(false);
    expect(isWithinCooldown(hoursAgo(0.1), -5, now)).toBe(false);
  });
});
