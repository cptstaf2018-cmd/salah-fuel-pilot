import { describe, expect, test } from "vitest";
import { canManageEmployee } from "@/lib/station-users";
import {
  createStationEmployeeSchema,
  updateStationEmployeeSchema
} from "@/lib/validation/station-users";

const stationA = "11111111-1111-4111-8111-111111111111";
const stationB = "22222222-2222-4222-8222-222222222222";

describe("canManageEmployee", () => {
  test("allows a manager to reach an employee at a station he runs", () => {
    expect(
      canManageEmployee({
        managedStationIds: [stationA],
        employeeRole: "STATION_EMPLOYEE",
        employeeStationIds: [stationA]
      })
    ).toBe(true);
  });

  test("refuses an employee who works only at another station", () => {
    expect(
      canManageEmployee({
        managedStationIds: [stationA],
        employeeRole: "STATION_EMPLOYEE",
        employeeStationIds: [stationB]
      })
    ).toBe(false);
  });

  test("refuses a fellow manager even at the same station", () => {
    expect(
      canManageEmployee({
        managedStationIds: [stationA],
        employeeRole: "STATION_MANAGER",
        employeeStationIds: [stationA]
      })
    ).toBe(false);
  });

  test("refuses a super admin account reachable through a shared station", () => {
    expect(
      canManageEmployee({
        managedStationIds: [stationA],
        employeeRole: "SUPER_ADMIN",
        employeeStationIds: [stationA]
      })
    ).toBe(false);
  });

  test("refuses an account attached to no station at all", () => {
    expect(
      canManageEmployee({
        managedStationIds: [stationA],
        employeeRole: "STATION_EMPLOYEE",
        employeeStationIds: []
      })
    ).toBe(false);
  });
});

describe("createStationEmployeeSchema", () => {
  const valid = {
    stationId: stationA,
    name: "علي حسن",
    phone: "0770 123 4567",
    password: "employee-pass"
  };

  test("strips separators so the typed number matches the stored one", () => {
    const parsed = createStationEmployeeSchema.parse(valid);
    expect(parsed.phone).toBe("07701234567");
  });

  test("rejects a password the login route would refuse", () => {
    expect(createStationEmployeeSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(
      false
    );
  });

  test("rejects a phone number that is not a phone number", () => {
    expect(createStationEmployeeSchema.safeParse({ ...valid, phone: "ali@work" }).success).toBe(
      false
    );
  });

  test("rejects a role smuggled in alongside the employee's details", () => {
    expect(
      createStationEmployeeSchema.safeParse({ ...valid, role: "SUPER_ADMIN" }).success
    ).toBe(false);
  });
});

describe("updateStationEmployeeSchema", () => {
  test("accepts a rename on its own", () => {
    expect(updateStationEmployeeSchema.safeParse({ name: "علي حسن" }).success).toBe(true);
  });

  test("rejects an empty body, which would be a silent no-op", () => {
    expect(updateStationEmployeeSchema.safeParse({}).success).toBe(false);
  });

  test("does not let a suspension be turned into a deletion of the account's role", () => {
    expect(updateStationEmployeeSchema.safeParse({ status: "LOCKED" }).success).toBe(false);
  });
});
