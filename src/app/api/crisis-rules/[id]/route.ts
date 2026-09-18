import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { auditActions, createAuditLog } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

/**
 * A rule's schedule and quota are not editable once it is running: vehicles
 * already hold appointments issued under the old numbers. Posture changes only.
 */
const updateCrisisRuleSchema = z
  .object({
    status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]),
    name: z.string().trim().min(3).max(160).optional()
  })
  .strict();

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "crisis:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = updateCrisisRuleSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "حالة القاعدة غير صحيحة." }, { status: 400 });
  }

  const existing = await prisma.crisisRule.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "قاعدة الأزمة غير موجودة." }, { status: 404 });
  }

  if (existing.status === "CANCELLED") {
    return NextResponse.json({ error: "القاعدة ملغاة ولا يمكن تعديلها." }, { status: 409 });
  }

  const rule = await prisma.crisisRule.update({ where: { id }, data: body.data });

  await createAuditLog({
    actorUserId: auth.user.id,
    action: auditActions.crisisModeChanged,
    resourceType: "crisis_rule",
    resourceId: id,
    outcome: "SUCCESS",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    metadata: { from: existing.status, to: body.data.status }
  });

  return NextResponse.json({ rule });
}
