import { NextRequest, NextResponse } from "next/server";
import { auditActions, createAuditLog } from "@/lib/audit";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { hasPermission, type Permission } from "@/lib/rbac";

export async function requireApiPermission(request: NextRequest, permission: Permission) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 })
    };
  }

  if (!hasPermission(user.role, permission)) {
    await createAuditLog({
      actorUserId: user.id,
      action: auditActions.permissionDenied,
      resourceType: "permission",
      resourceId: permission,
      outcome: "DENIED",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    return {
      user,
      response: NextResponse.json({ error: "ليست لديك صلاحية لتنفيذ هذا الإجراء." }, { status: 403 })
    };
  }

  return { user, response: null };
}
