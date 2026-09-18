export const roles = [
  "SUPER_ADMIN",
  "GOVERNORATE_ADMIN",
  "OPERATIONS_MANAGER",
  "DISTRIBUTION_ADMIN",
  "STATION_MANAGER",
  "STATION_EMPLOYEE",
  "TANKER_OPERATOR",
  "CITIZEN"
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "system:manage",
  "users:manage",
  "governorate:read",
  "crisis:manage",
  "stations:read",
  "stations:manage",
  "inventory:read",
  "inventory:adjust",
  "dispensing:verify",
  "dispensing:confirm",
  "distribution:manage",
  "tankers:update",
  "citizen:self",
  "audit:read"
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "system:manage",
    "users:manage",
    "governorate:read",
    "crisis:manage",
    "stations:read",
    "stations:manage",
    "inventory:read",
    "inventory:adjust",
    "dispensing:verify",
    "dispensing:confirm",
    "distribution:manage",
    "audit:read"
  ],
  GOVERNORATE_ADMIN: [
    "governorate:read",
    "crisis:manage",
    "stations:read",
    "stations:manage",
    "inventory:read",
    "inventory:adjust",
    "distribution:manage",
    "audit:read"
  ],
  OPERATIONS_MANAGER: ["governorate:read", "stations:read", "inventory:read", "audit:read"],
  DISTRIBUTION_ADMIN: ["distribution:manage", "stations:read", "inventory:read", "inventory:adjust"],
  STATION_MANAGER: ["stations:read", "inventory:read", "inventory:adjust", "dispensing:verify", "dispensing:confirm"],
  STATION_EMPLOYEE: ["dispensing:verify", "dispensing:confirm"],
  TANKER_OPERATOR: ["tankers:update"],
  CITIZEN: ["citizen:self"]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role ${role} is not allowed to perform ${permission}`);
  }
}

export function getPermissions(role: Role): readonly Permission[] {
  return rolePermissions[role];
}
