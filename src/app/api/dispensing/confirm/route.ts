import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api";
import { confirmDispense } from "@/lib/dispensing";
import { prisma } from "@/lib/prisma";
import { confirmDispenseSchema } from "@/lib/validation/vehicles";

/** What the operator at the pump is told, and what to do about it. */
const refusalMessages: Record<string, string> = {
  VEHICLE_NOT_FOUND: "رمز QR غير صالح أو ملغى. اطلب من المواطن فتح صفحة مركبته من جديد.",
  NO_APPOINTMENT: "لا يوجد موعد مخصص لهذه المركبة بعد. لم تُخصَّص لها حصة.",
  ALREADY_DISPENSED: "تم صرف هذه الحصة مسبقاً. لا يمكن صرفها مرة أخرى.",
  APPOINTMENT_NOT_ACTIVE: "الموعد ملغى أو منتهٍ. راجع الإدارة.",
  WRONG_STATION: "موعد هذه المركبة في محطة أخرى. لا يمكن الصرف هنا.",
  RULE_ENDED: "انتهت مدة قرار الأزمة. لا يمكن الصرف بموجبه.",
  TOO_EARLY: "لم يبدأ موعد هذه المركبة بعد. اطلب منها العودة في وقتها.",
  WITHIN_COOLDOWN: "هذه المركبة استلمت حصتها مؤخراً ولم تنقضِ مدة المنع بعد.",
  INVALID_QUANTITY: "أدخل كمية صحيحة أكبر من صفر.",
  ABOVE_QUOTA: "الكمية المطلوبة تتجاوز الحصة المخصصة لهذه المركبة.",
  INSUFFICIENT_STOCK: "مخزون المحطة لا يكفي لهذه الحصة."
};

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "dispensing:confirm");
  if (auth.response) return auth.response;

  const body = confirmDispenseSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات الصرف غير صحيحة." }, { status: 400 });
  }

  // An operator dispenses only where they work. Super admins are not bound to a
  // station, so they are allowed through for supervision and correction.
  if (auth.user.role !== "SUPER_ADMIN") {
    const assigned = await prisma.stationUser.findUnique({
      where: { stationId_userId: { stationId: body.data.stationId, userId: auth.user.id } }
    });

    if (!assigned) {
      return NextResponse.json({ error: "هذه المحطة غير مرتبطة بحسابك." }, { status: 403 });
    }
  }

  const result = await confirmDispense({
    ...body.data,
    actorUserId: auth.user.id,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent")
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: refusalMessages[result.reason] ?? "تعذر إتمام الصرف.", reason: result.reason },
      { status: result.reason === "VEHICLE_NOT_FOUND" ? 404 : 409 }
    );
  }

  return NextResponse.json(result);
}
