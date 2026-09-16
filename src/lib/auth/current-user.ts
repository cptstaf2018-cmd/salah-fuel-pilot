import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, hashSessionToken, verifySessionToken } from "@/lib/auth/session";
import type { Role } from "@/lib/rbac";

export type AuthenticatedUser = {
  id: string;
  name: string;
  phone: string | null;
  role: Role;
};

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const scope = request.headers.get("x-dashboard-role");
  const cookieName = scope === "admin" || scope === "station" ? `${getSessionCookieName()}_${scope}` : getSessionCookieName();
  const token = request.cookies.get(cookieName)?.value;
  const payload = token ? verifySessionToken(token) : null;

  if (!token || !payload) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      id: payload.sessionId,
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });

  if (!session || session.user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    phone: session.user.phone,
    role: session.user.role
  };
}
