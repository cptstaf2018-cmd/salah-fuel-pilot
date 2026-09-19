import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import type { Role } from "@/lib/rbac";

/**
 * The stations a user may staff. A station manager owns only the stations he is
 * assigned to; a super admin supervises all of them.
 *
 * Every route that accepts `station-users:manage` narrows through this — the
 * permission says a role may hire, this says where.
 */
export async function getManagedStationIds(user: AuthenticatedUser): Promise<string[]> {
  if (user.role === "SUPER_ADMIN") {
    const stations = await prisma.station.findMany({ select: { id: true } });
    return stations.map((station) => station.id);
  }

  const links = await prisma.stationUser.findMany({
    where: { userId: user.id },
    select: { stationId: true }
  });

  return links.map((link) => link.stationId);
}

/**
 * Whether an existing account is one of the caller's employees.
 *
 * Two conditions, both required: the account must be an employee — so a manager
 * can never reach a colleague, a super admin or a citizen through this route —
 * and it must work at a station the caller runs.
 */
export function canManageEmployee(input: {
  managedStationIds: string[];
  employeeRole: Role;
  employeeStationIds: string[];
}): boolean {
  if (input.employeeRole !== "STATION_EMPLOYEE") {
    return false;
  }

  return input.employeeStationIds.some((id) => input.managedStationIds.includes(id));
}
