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
