import { describe, expect, it } from "vitest";
import { evaluateDispense, type EvaluateDispenseInput } from "@/lib/dispensing";

const slotStartsAt = new Date("2026-09-18T08:00:00.000Z");
const ruleEndsAt = new Date("2026-09-25T08:00:00.000Z");

function input(overrides: Partial<EvaluateDispenseInput> = {}): EvaluateDispenseInput {
  return {
    appointmentStatus: "SCHEDULED",
    appointmentStationId: "station-1",
    allowedStationIds: ["station-1"],
    slotStartsAt,
    ruleEndsAt,
    now: new Date("2026-09-18T08:30:00.000Z"),
    quotaLiters: 20,
    cooldownHours: 48,
    lastDispensedAt: null,
    requestedLiters: undefined,
    availableLiters: 5000,
    ...overrides
  };
}

describe("evaluateDispense", () => {
  it("dispenses the full quota when the vehicle arrives inside its slot", () => {
    expect(evaluateDispense(input())).toEqual({ ok: true, liters: 20 });
  });

  it("refuses a second dispense for an appointment already completed", () => {
    expect(evaluateDispense(input({ appointmentStatus: "COMPLETED" }))).toEqual({
      ok: false,
      reason: "ALREADY_DISPENSED"
    });
  });

  it("refuses a cancelled or expired appointment", () => {
    expect(evaluateDispense(input({ appointmentStatus: "CANCELLED" }))).toEqual({
      ok: false,
      reason: "APPOINTMENT_NOT_ACTIVE"
    });
    expect(evaluateDispense(input({ appointmentStatus: "EXPIRED" }))).toEqual({
      ok: false,
      reason: "APPOINTMENT_NOT_ACTIVE"
    });
  });

  it("refuses when the vehicle is booked at a different station", () => {
    expect(
      evaluateDispense(input({ appointmentStationId: "station-2" }))
    ).toEqual({ ok: false, reason: "WRONG_STATION" });
  });

  it("refuses a citizen arriving before the slot opens", () => {
    expect(
      evaluateDispense(input({ now: new Date("2026-09-18T07:59:59.000Z") }))
    ).toEqual({ ok: false, reason: "TOO_EARLY" });
  });

  it("still serves a citizen who arrives after the slot but inside the crisis window", () => {
    // Queues run late; refusing a late arrival would strand a citizen who holds
    // a valid allocation, so the slot only gates how early they may arrive.
    expect(
      evaluateDispense(input({ now: new Date("2026-09-20T12:00:00.000Z") }))
    ).toEqual({ ok: true, liters: 20 });
  });

  it("refuses once the crisis rule window has closed", () => {
    expect(
      evaluateDispense(input({ now: new Date("2026-09-26T08:00:00.000Z") }))
    ).toEqual({ ok: false, reason: "RULE_ENDED" });
  });

  it("allows dispensing less than the quota when the tank fills early", () => {
    expect(evaluateDispense(input({ requestedLiters: 12.5 }))).toEqual({
      ok: true,
      liters: 12.5
    });
  });

  it("refuses a request above the allocated quota", () => {
    expect(evaluateDispense(input({ requestedLiters: 25 }))).toEqual({
      ok: false,
      reason: "ABOVE_QUOTA"
    });
  });

  it("refuses a non positive quantity", () => {
    expect(evaluateDispense(input({ requestedLiters: 0 }))).toEqual({
      ok: false,
      reason: "INVALID_QUANTITY"
    });
    expect(evaluateDispense(input({ requestedLiters: -5 }))).toEqual({
      ok: false,
      reason: "INVALID_QUANTITY"
    });
  });

  it("refuses a vehicle served again inside its cooldown", () => {
    // Section 10 of the specification: the pump is the last gate, so an
    // allocation issued before an earlier handover cannot slip through.
    expect(
      evaluateDispense(
        input({ lastDispensedAt: new Date("2026-09-18T06:00:00.000Z") })
      )
    ).toEqual({ ok: false, reason: "WITHIN_COOLDOWN" });
  });

  it("serves a vehicle whose cooldown has elapsed", () => {
    expect(
      evaluateDispense(
        input({ lastDispensedAt: new Date("2026-09-15T06:00:00.000Z") })
      )
    ).toEqual({ ok: true, liters: 20 });
  });

  it("refuses when the station cannot cover the quantity", () => {
    expect(evaluateDispense(input({ availableLiters: 19 }))).toEqual({
      ok: false,
      reason: "INSUFFICIENT_STOCK"
    });
  });

  it("dispenses when stock exactly covers the quota", () => {
    expect(evaluateDispense(input({ availableLiters: 20 }))).toEqual({
      ok: true,
      liters: 20
    });
  });

  it("reports the completed appointment before any other problem", () => {
    // A double scan at the wrong station is still a double scan; the operator
    // needs to be told the fuel was already handed over, not to move stations.
    expect(
      evaluateDispense(
        input({
          appointmentStatus: "COMPLETED",
          appointmentStationId: "station-2",
          availableLiters: 0
        })
      )
    ).toEqual({ ok: false, reason: "ALREADY_DISPENSED" });
  });
});
