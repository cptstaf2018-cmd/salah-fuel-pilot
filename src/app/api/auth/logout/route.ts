import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditActions, createAuditLog } from "@/lib/audit";
import { getSessionCookieName, hashSessionToken, verifySessionToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;

  if (token) {
    const payload = verifySessionToken(token);

    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await createAuditLog({
      actorUserId: payload?.userId,
      action: auditActions.logout,
      resourceType: "auth",
      outcome: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(getSessionCookieName());
  return response;
}
