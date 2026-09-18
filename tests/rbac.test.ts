import { describe, expect, it } from "vitest";
import { getPermissions, hasPermission, requirePermission } from "@/lib/rbac";

describe("rbac", () => {
  it("allows governorate admins to manage crisis mode", () => {
    expect(hasPermission("GOVERNORATE_ADMIN", "crisis:manage")).toBe(true);
  });

  it("prevents station employees from managing crisis mode", () => {
    expect(hasPermission("STATION_EMPLOYEE", "crisis:manage")).toBe(false);
    expect(() => requirePermission("STATION_EMPLOYEE", "crisis:manage")).toThrow(
      "STATION_EMPLOYEE"
    );
  });

  it("prevents citizens from reading audit logs", () => {
    expect(getPermissions("CITIZEN")).toEqual(["citizen:self"]);
    expect(hasPermission("CITIZEN", "audit:read")).toBe(false);
  });

  it("allows only high privilege operational roles to adjust inventory manually", () => {
    expect(hasPermission("GOVERNORATE_ADMIN", "inventory:adjust")).toBe(true);
    expect(hasPermission("DISTRIBUTION_ADMIN", "inventory:adjust")).toBe(true);
    expect(hasPermission("STATION_EMPLOYEE", "inventory:adjust")).toBe(false);
  });
});

/**
 * The permission each API route guards with, so a role gap surfaces here
 * instead of as a 403 once the dashboard is already wired to the route.
 */
const routePermissions = [
  { route: "GET /api/stations", permission: "stations:read" },
  { route: "POST /api/stations", permission: "stations:manage" },
  { route: "GET /api/fuel-types", permission: "inventory:read" },
  { route: "POST /api/fuel-types", permission: "stations:manage" },
  { route: "POST /api/inventory/adjust", permission: "inventory:adjust" },
  { route: "GET /api/crisis-rules", permission: "governorate:read" },
  { route: "POST /api/crisis-rules", permission: "crisis:manage" },
  { route: "POST /api/crisis-rules/activate", permission: "crisis:manage" },
  { route: "POST /api/allocations/assign", permission: "crisis:manage" },
  { route: "POST /api/allocations/auto", permission: "crisis:manage" },
  { route: "POST /api/vehicles/qr/verify", permission: "dispensing:verify" }
] as const;

describe("rbac route matrix", () => {
  it.each(routePermissions)(
    "lets the super admin reach $route",
    ({ permission }) => {
      expect(hasPermission("SUPER_ADMIN", permission)).toBe(true);
    }
  );

  it("lets station managers read their own stations and stock", () => {
    expect(hasPermission("STATION_MANAGER", "stations:read")).toBe(true);
    expect(hasPermission("STATION_MANAGER", "inventory:read")).toBe(true);
  });

  it("keeps station managers out of governorate wide administration", () => {
    expect(hasPermission("STATION_MANAGER", "stations:manage")).toBe(false);
    expect(hasPermission("STATION_MANAGER", "crisis:manage")).toBe(false);
    expect(hasPermission("STATION_MANAGER", "users:manage")).toBe(false);
  });

  it("keeps citizens out of every staff permission", () => {
    for (const { permission } of routePermissions) {
      expect(hasPermission("CITIZEN", permission)).toBe(false);
    }
  });
});
