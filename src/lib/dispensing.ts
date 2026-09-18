import type { AppointmentStatus } from "@prisma/client";

/**
 * Why a dispense was refused. The station screen maps each one to an Arabic
 * message, so the operator learns what to do rather than seeing a generic error.
 */
export type DispenseRefusal =
  | "ALREADY_DISPENSED"
  | "APPOINTMENT_NOT_ACTIVE"
  | "WRONG_STATION"
  | "RULE_ENDED"
  | "TOO_EARLY"
  | "INVALID_QUANTITY"
  | "ABOVE_QUOTA"
  | "INSUFFICIENT_STOCK";

export type EvaluateDispenseInput = {
  appointmentStatus: AppointmentStatus;
  appointmentStationId: string;
  /** Stations the operator is allowed to dispense at. */
  allowedStationIds: string[];
  slotStartsAt: Date;
  ruleEndsAt: Date;
  now: Date;
  quotaLiters: number;
  /** Operator override when the tank fills before the quota is reached. */
  requestedLiters: number | undefined;
  availableLiters: number;
};

export type EvaluateDispenseResult =
  | { ok: true; liters: number }
  | { ok: false; reason: DispenseRefusal };

/**
 * Decides whether fuel may be handed over, with no database access, so the
 * policy can be tested directly. The caller still performs the write under a
 * conditional update — this function cannot see a concurrent dispense.
 */
export function evaluateDispense(input: EvaluateDispenseInput): EvaluateDispenseResult {
  // Checked first: a double scan is the most likely mistake at the pump, and the
  // operator needs to hear that the fuel already went out before anything else.
  if (input.appointmentStatus === "COMPLETED") {
    return { ok: false, reason: "ALREADY_DISPENSED" };
  }

  if (input.appointmentStatus !== "SCHEDULED" && input.appointmentStatus !== "READY") {
    return { ok: false, reason: "APPOINTMENT_NOT_ACTIVE" };
  }

  if (!input.allowedStationIds.includes(input.appointmentStationId)) {
    return { ok: false, reason: "WRONG_STATION" };
  }

  if (input.now > input.ruleEndsAt) {
    return { ok: false, reason: "RULE_ENDED" };
  }

  // The slot gates how early a citizen may arrive, not how late. Queues run over,
  // and refusing a late arrival would strand someone holding a valid allocation.
  if (input.now < input.slotStartsAt) {
    return { ok: false, reason: "TOO_EARLY" };
  }

  const liters = input.requestedLiters ?? input.quotaLiters;

  if (!Number.isFinite(liters) || liters <= 0) {
    return { ok: false, reason: "INVALID_QUANTITY" };
  }

  if (liters > input.quotaLiters) {
    return { ok: false, reason: "ABOVE_QUOTA" };
  }

  if (liters > input.availableLiters) {
    return { ok: false, reason: "INSUFFICIENT_STOCK" };
  }

  return { ok: true, liters };
}
