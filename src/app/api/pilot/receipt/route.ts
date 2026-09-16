import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { autoAllocatePendingVehicles } from "@/lib/allocation";

const schema = z.object({ stationId: z.uuid(), fuelTypeId: z.uuid(), liters: z.number().positive().max(1000000).multipleOf(0.001), reason: z.string().trim().min(3).max(300) });
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user || !["SUPER_ADMIN", "STATION_MANAGER"].includes(user.role)) return NextResponse.json({ error: "غير مصرح." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "أدخل كمية موجبة وسبب الاستلام." }, { status: 400 });
  const { stationId, fuelTypeId, liters, reason } = parsed.data;
  if (user.role !== "SUPER_ADMIN" && !await prisma.stationUser.findUnique({ where: { stationId_userId: { stationId, userId: user.id } } })) return NextResponse.json({ error: "هذه المحطة غير مرتبطة بحسابك." }, { status: 403 });
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.fuelInventory.update({ where: { stationId_fuelTypeId: { stationId, fuelTypeId } }, data: { quantityLiters: { increment: liters } } });
      const movement = await tx.inventoryTransaction.create({ data: { stationId, fuelTypeId, inventoryId: updated.id, actorUserId: user.id, type: "TANKER_RECEIPT", quantityBefore: updated.quantityLiters.minus(liters), quantityChange: liters, quantityAfter: updated.quantityLiters, reason } });
      await tx.auditLog.create({ data: { actorUserId: user.id, action: "PILOT_FUEL_RECEIVED", resourceType: "inventory_transaction", resourceId: movement.id, outcome: "SUCCESS", metadata: { stationId, liters } } });
    });
    const allocation = await autoAllocatePendingVehicles({
      fuelTypeId,
      actorUserId: user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });
    return NextResponse.json({ success: true, allocation });
  } catch {
    return NextResponse.json({ error: "تعذر حفظ الاستلام. تحقق من المحطة ونوع الوقود." }, { status: 400 });
  }
}
