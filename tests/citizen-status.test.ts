import { describe, expect, it } from "vitest";
import { describeCitizen, type DashboardVehicle } from "@/app/pilot/types";

function vehicle(overrides: Partial<DashboardVehicle> = {}): DashboardVehicle {
  return {
    id: "v1",
    plateNumber: "09808",
    owner: { fullName: "سعد عودة" },
    fuelType: { nameAr: "بنزين" },
    registrationStatus: "ACTIVE",
    appointments: [],
    ...overrides
  };
}

const appointment = (overrides: Partial<DashboardVehicle["appointments"][0]> = {}) => ({
  status: "SCHEDULED",
  dispensedAt: null,
  dispensedLiters: null,
  station: { nameAr: "العوجة" },
  ...overrides
});

describe("describeCitizen", () => {
  it("reports a served citizen with the moment fuel was handed over", () => {
    const result = describeCitizen(
      vehicle({
        appointments: [
          appointment({
            status: "COMPLETED",
            dispensedAt: "2026-09-19T08:00:00.000Z",
            dispensedLiters: "40"
          })
        ]
      })
    );

    expect(result.label).toBe("تم التجهيز");
    expect(result.state).toBe("ok");
    expect(result.servedAt).toBe("2026-09-19T08:00:00.000Z");
  });

  it("distinguishes an allocated citizen still waiting at the pump", () => {
    const result = describeCitizen(vehicle({ appointments: [appointment()] }));

    expect(result.label).toBe("مخصَّص · بانتظار التجهيز");
    expect(result.state).toBe("info");
    expect(result.servedAt).toBeNull();
  });

  it("treats a vehicle with no appointment as awaiting allocation", () => {
    const result = describeCitizen(vehicle({ registrationStatus: "PENDING_ALLOCATION" }));

    expect(result.label).toBe("بانتظار التخصيص");
    expect(result.state).toBe("warn");
  });

  it("reports a cancelled appointment as awaiting allocation again", () => {
    const result = describeCitizen(
      vehicle({ appointments: [appointment({ status: "CANCELLED" })] })
    );

    expect(result.label).toBe("بانتظار التخصيص");
  });

  it("puts suspension ahead of any appointment state", () => {
    // A suspended vehicle that was served yesterday is still suspended; showing
    // "تم التجهيز" would hide the decision an administrator made about it.
    const result = describeCitizen(
      vehicle({
        registrationStatus: "SUSPENDED",
        appointments: [
          appointment({ status: "COMPLETED", dispensedAt: "2026-09-18T08:00:00.000Z" })
        ]
      })
    );

    expect(result.label).toBe("موقوفة");
    expect(result.state).toBe("critical");
    expect(result.servedAt).toBeNull();
  });

  it("puts rejection ahead of any appointment state", () => {
    expect(describeCitizen(vehicle({ registrationStatus: "REJECTED" })).label).toBe("مرفوضة");
  });
});
