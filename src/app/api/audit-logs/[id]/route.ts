import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

/**
 * Removes one audit entry.
 *
 * There is no PATCH beside it on purpose: an audit record that can be edited
 * records nothing. Deletion exists so the pilot's own test noise can be cleared
 * before the log is handed to anyone as a record of real operations, and the
 * deletion is itself logged — the log can be shortened, never silently.
 */
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireApiPermission(request, "system:manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const log = await prisma.auditLog.findUnique({ where: { id } });

  if (!log) {
    return NextResponse.json({ error: "السجل غير موجود." }, { status: 404 });
  }

  await prisma.auditLog.delete({ where: { id } });

  await createAuditLog({
    actorUserId: auth.user.id,
    action: "AUDIT_LOG_DELETED",
    resourceType: "audit_log",
    resourceId: id,
    outcome: "SUCCESS",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    // What was removed, so the gap it leaves is explainable.
    metadata: { action: log.action, outcome: log.outcome, createdAt: log.createdAt.toISOString() }
  });

  return NextResponse.json({ message: "حُذف السجل." });
}
