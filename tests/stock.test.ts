import { describe, expect, it } from "vitest";
import { getStockFraction, getStockState } from "@/lib/stock";

describe("getStockState", () => {
  it("reports healthy stock well above the threshold", () => {
    expect(getStockState(180_000, 20_000)).toBe("ok");
  });

  it("warns while stock is within twice the threshold", () => {
    expect(getStockState(35_000, 20_000)).toBe("warn");
    expect(getStockState(40_000, 20_000)).toBe("warn");
  });

  it("escalates once stock reaches the threshold", () => {
    expect(getStockState(20_000, 20_000)).toBe("critical");
    expect(getStockState(5_000, 20_000)).toBe("critical");
  });

  it("treats an empty tank as critical regardless of threshold", () => {
    expect(getStockState(0, 0)).toBe("critical");
    expect(getStockState(0, 20_000)).toBe("critical");
  });

  it("stays neutral when no threshold is configured", () => {
    // Inventing an alarm from an unset threshold would train operators to
    // ignore the colour entirely.
    expect(getStockState(5_000, 0)).toBe("ok");
  });
});

describe("getStockFraction", () => {
  it("scales against the largest holding on screen", () => {
    expect(getStockFraction(90_000, 180_000)).toBeCloseTo(0.5);
    expect(getStockFraction(180_000, 180_000)).toBe(1);
  });

  it("never exceeds a full bar", () => {
    expect(getStockFraction(200_000, 180_000)).toBe(1);
  });

  it("returns an empty bar for empty or unscalable input", () => {
    expect(getStockFraction(0, 180_000)).toBe(0);
    expect(getStockFraction(50_000, 0)).toBe(0);
  });
});
