import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api";
import { createManualInventoryAdjustment } from "@/lib/inventory";
import { manualInventoryAdjustmentSchema } from "@/lib/validation/stations";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "inventory:adjust");

  if (auth.response) {
    return auth.response;
  }

  const body = manualInventoryAdjustmentSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات تعديل المخزون غير صحيحة أو السبب غير كاف." }, { status: 400 });
  }

  try {
    const result = await createManualInventoryAdjustment({
      ...body.data,
      actorUserId: auth.user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    return NextResponse.json({
      inventory: result.updated,
      transaction: result.transaction
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تعديل المخزون." },
      { status: 400 }
    );
  }
}
