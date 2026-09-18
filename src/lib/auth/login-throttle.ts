import { auditActions } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

/**
 * Throttles sign-in by counting *failed* attempts recorded in the audit log.
 *
 * Two reasons this is not an in-memory counter. Serverless instances each keep
 * their own map, so a per-instance count neither blocks an attacker spread
 * across instances nor stays consistent for a legitimate user. And the previous
 * implementation was consulted before the password was checked, so successful
 * sign-ins burned the same quota — five ordinary logins in a quarter of an hour
 * locked the only administrator out of the system.
 *
 * Only failures count, and a success clears the window, so normal use can never
 * trip it.
 */
export async function isLoginThrottled(ipAddress: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);

  const lastSuccess = await prisma.auditLog.findFirst({
    where: {
      action: auditActions.loginSucceeded,
      ipAddress,
      createdAt: { gte: since }
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });

  const failures = await prisma.auditLog.count({
    where: {
      action: auditActions.loginFailed,
      ipAddress,
      createdAt: { gte: lastSuccess?.createdAt ?? since }
    }
  });

  return failures >= MAX_FAILURES;
}
