import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";
import { updateInventoryTransactionSchema } from "@/lib/validation/stations";

type Context = { params: Promise<{ id: string }> };

/** Deleting this movement would take the tank below empty. */
class StockUnderflowError extends Error {}

export async function PATCH(request: NextRequest, context: Context) {
  // system:manage, not inventory:adjust: correcting the ledger is the super
  // admin's, not a station manager's, who would be editing his own record.
  const auth = await requireApiPermission(request, "system:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = updateInventoryTransactionSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "السبب غير صحيح." }, { status: 400 });
  }

  const existing = await prisma.inventoryTransaction.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "الحركة غير موجودة." }, { status: 404 });
  }

  // Only the reason is editable. The quantities are the ledger — changing them
  // here would leave the recorded balances disagreeing with the stock they
  // were derived from, with nothing to say which of the two was true.
  const transaction = await prisma.inventoryTransaction.update({
    where: { id },
    data: { reason: body.data.reason }
  });

  await createAuditLog({
    actorUserId: auth.user.id,
    action: "INVENTORY_MOVEMENT_UPDATED",
    resourceType: "inventory_transaction",
    resourceId: id,
    outcome: "SUCCESS",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    metadata: { before: existing.reason, after: body.data.reason }
  });

  return NextResponse.json({ transaction, message: "تم تعديل سبب الحركة." });
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "system:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const movement = await prisma.inventoryTransaction.findUnique({ where: { id } });

  if (!movement) {
    return NextResponse.json({ error: "الحركة غير موجودة." }, { status: 404 });
  }

  // A dispensing movement is the stock half of a handover whose other half is
  // an appointment saying a named citizen was served. Removing it on its own
  // would leave the system claiming fuel left the tank and never left it.
  if (movement.type === "DISPENSING") {
    return NextResponse.json(
      {
        error:
          "هذه حركة صرف مرتبطة بموعد مواطن، ولا تُحذف وحدها — احذف المركبة من جدول المواطنين إن كانت بيانات تجربة."
      },
      { status: 409 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // The movement's effect is undone as it is removed, so the tank reads as
      // though the delivery never arrived. Conditional, because the stock may
      // have been drawn down since and reversing a receipt that is no longer
      // there would push the balance below zero.
      const positive = movement.quantityChange.greaterThan(0);

      const adjusted = await tx.fuelInventory.updateMany({
        where: {
          id: movement.inventoryId,
          ...(positive ? { quantityLiters: { gte: movement.quantityChange } } : {})
        },
        data: { quantityLiters: { decrement: movement.quantityChange } }
      });

      if (adjusted.count !== 1) {
        throw new StockUnderflowError();
      }

      await tx.inventoryTransaction.delete({ where: { id } });
    });
  } catch (error) {
    if (error instanceof StockUnderflowError) {
      return NextResponse.json(
        { error: "لا يمكن حذف هذه الحركة: الكمية صُرفت بالفعل ولا يكفي المخزون لعكسها." },
        { status: 409 }
      );
    }
    throw error;
  }

  await createAuditLog({
    actorUserId: auth.user.id,
    action: "INVENTORY_MOVEMENT_DELETED",
    resourceType: "inventory_transaction",
    resourceId: id,
    outcome: "SUCCESS",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      stationId: movement.stationId,
      type: movement.type,
      quantityChange: new Prisma.Decimal(movement.quantityChange).toString(),
      reason: movement.reason
    }
  });

  return NextResponse.json({ message: "حُذفت الحركة وأُعيد المخزون إلى ما كان عليه قبلها." });
}
