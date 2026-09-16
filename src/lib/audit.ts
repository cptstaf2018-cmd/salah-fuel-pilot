import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const auditActions = {
  loginSucceeded: "AUTH_LOGIN_SUCCEEDED",
  loginFailed: "AUTH_LOGIN_FAILED",
  logout: "AUTH_LOGOUT",
  permissionDenied: "PERMISSION_DENIED",
  userCreated: "USER_CREATED",
  roleChanged: "ROLE_CHANGED",
  crisisModeChanged: "CRISIS_MODE_CHANGED",
  manualInventoryAdjustment: "MANUAL_INVENTORY_ADJUSTMENT",
  dispensingConfirmed: "DISPENSING_CONFIRMED",
  dispensingRejected: "DISPENSING_REJECTED",
  vehicleRegistered: "VEHICLE_REGISTERED",
  vehicleQrIssued: "VEHICLE_QR_ISSUED",
  crisisRuleCreated: "CRISIS_RULE_CREATED",
  allocationCreated: "ALLOCATION_CREATED",
  overbookingPrevented: "OVERBOOKING_PREVENTED"
} as const;

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: "SUCCESS" | "FAILED" | "DENIED";
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonObject;
};

export async function createAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? undefined
    }
  });
}
