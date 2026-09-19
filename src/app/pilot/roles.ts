import type { Role } from "@/lib/rbac";

/** The three dashboards under /pilot, by the segment in their URL. */
export const pilotRoles = ["admin", "station", "employee"] as const;

export type PilotRole = (typeof pilotRoles)[number];

export function isPilotRole(value: string): value is PilotRole {
  return (pilotRoles as readonly string[]).includes(value);
}

/**
 * The account each dashboard expects. A signed-in user who lands on the wrong
 * one is shown the login card again rather than an empty console.
 */
export const pilotRoleAccounts: Record<PilotRole, Role> = {
  admin: "SUPER_ADMIN",
  station: "STATION_MANAGER",
  employee: "STATION_EMPLOYEE"
};
