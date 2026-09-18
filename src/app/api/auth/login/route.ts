import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditActions, createAuditLog } from "@/lib/audit";
import { createSessionToken, getSessionCookieName, getSessionExpiration, hashSessionToken } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { isLoginThrottled } from "@/lib/auth/login-throttle";
import { loginSchema } from "@/lib/validation/auth";

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  if (await isLoginThrottled(ipAddress)) {
    await createAuditLog({
      action: auditActions.loginFailed,
      resourceType: "auth",
      outcome: "DENIED",
      ipAddress,
      userAgent,
      metadata: { reason: "RATE_LIMITED" }
    });

    return NextResponse.json({ error: "تم تجاوز عدد محاولات الدخول." }, { status: 429 });
  }

  const body = loginSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 400 });
  }

  const identifier = body.data.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: body.data.identifier }]
    }
  });

  const validPassword = user ? await verifyPassword(user.passwordHash, body.data.password) : false;

  if (!user || !validPassword || user.status !== "ACTIVE") {
    await createAuditLog({
      actorUserId: user?.id,
      action: auditActions.loginFailed,
      resourceType: "auth",
      outcome: "FAILED",
      ipAddress,
      userAgent,
      metadata: { identifier }
    });

    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const token = createSessionToken({ sessionId, userId: user.id, role: user.role });

  await prisma.$transaction([
    prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: getSessionExpiration()
      }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: auditActions.loginSucceeded,
        resourceType: "auth",
        outcome: "SUCCESS",
        ipAddress,
        userAgent
      }
    })
  ]);

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role
    }
  });

  response.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: getSessionExpiration(),
    path: "/"
  });

  return response;
}
