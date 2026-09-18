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
  // One cookie, chosen by the server. This previously read a cookie named after
  // the client-supplied `x-dashboard-role` header, which let anyone point the
  // lookup at a leftover `..._admin` cookie on a shared station device and
  // inherit a still-valid super admin session without a password.
  const token = request.cookies.get(getSessionCookieName())?.value;
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
