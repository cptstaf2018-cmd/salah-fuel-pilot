import { Prisma, type InventoryTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditActions, createAuditLog } from "@/lib/audit";

type InventoryMovementInput = {
  currentQuantity: number;
  quantityChange: number;
  type: InventoryTransactionType;
  reason?: string;
};

export function calculateInventoryMovement(input: InventoryMovementInput) {
  if (input.type === "MANUAL_ADJUSTMENT" && !input.reason?.trim()) {
    throw new Error("Manual inventory adjustments require a reason");
  }

  const quantityAfter = Number((input.currentQuantity + input.quantityChange).toFixed(3));

  if (quantityAfter < 0) {
    throw new Error("Inventory quantity cannot become negative");
  }

  return {
    quantityBefore: Number(input.currentQuantity.toFixed(3)),
    quantityChange: Number(input.quantityChange.toFixed(3)),
    quantityAfter
  };
}

type ManualAdjustmentInput = {
  stationId: string;
  fuelTypeId: string;
  quantityChange: number;
  reason: string;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createManualInventoryAdjustment(input: ManualAdjustmentInput) {
  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.fuelInventory.upsert({
      where: {
        stationId_fuelTypeId: {
          stationId: input.stationId,
          fuelTypeId: input.fuelTypeId
        }
      },
      create: {
        stationId: input.stationId,
        fuelTypeId: input.fuelTypeId,
        quantityLiters: 0
      },
      update: {}
    });

    const movement = calculateInventoryMovement({
      currentQuantity: inventory.quantityLiters.toNumber(),
      quantityChange: input.quantityChange,
      type: "MANUAL_ADJUSTMENT",
      reason: input.reason
    });

    const updated = await tx.fuelInventory.update({
      where: { id: inventory.id },
      data: {
        quantityLiters: new Prisma.Decimal(movement.quantityAfter)
      }
    });

    const transaction = await tx.inventoryTransaction.create({
      data: {
        stationId: input.stationId,
        fuelTypeId: input.fuelTypeId,
        inventoryId: inventory.id,
        type: "MANUAL_ADJUSTMENT",
        quantityBefore: new Prisma.Decimal(movement.quantityBefore),
        quantityChange: new Prisma.Decimal(movement.quantityChange),
        quantityAfter: new Prisma.Decimal(movement.quantityAfter),
        actorUserId: input.actorUserId,
        reason: input.reason,
        referenceType: "MANUAL"
      }
    });

    return { updated, transaction };
  });

  await createAuditLog({
    actorUserId: input.actorUserId,
    action: auditActions.manualInventoryAdjustment,
    resourceType: "fuel_inventory",
    resourceId: result.updated.id,
    outcome: "SUCCESS",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      stationId: input.stationId,
      fuelTypeId: input.fuelTypeId,
      quantityChange: input.quantityChange,
      transactionId: result.transaction.id
    }
  });

  return result;
}
