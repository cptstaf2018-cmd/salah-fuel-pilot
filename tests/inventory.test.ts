import { describe, expect, it } from "vitest";
import { calculateInventoryMovement } from "@/lib/inventory";

describe("inventory ledger calculations", () => {
  it("records before, change, and after quantities", () => {
    expect(
      calculateInventoryMovement({
        currentQuantity: 1250.125,
        quantityChange: 300.255,
        type: "TANKER_RECEIPT"
      })
    ).toEqual({
      quantityBefore: 1250.125,
      quantityChange: 300.255,
      quantityAfter: 1550.38
    });
  });

  it("rejects movements that would create negative inventory", () => {
    expect(() =>
      calculateInventoryMovement({
        currentQuantity: 100,
        quantityChange: -150,
        type: "DISPENSING"
      })
    ).toThrow("negative");
  });

  it("requires a reason for manual adjustments", () => {
    expect(() =>
      calculateInventoryMovement({
        currentQuantity: 100,
        quantityChange: 10,
        type: "MANUAL_ADJUSTMENT"
      })
    ).toThrow("reason");
  });
});
