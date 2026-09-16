import { describe, expect, it } from "vitest";
import { buildHourlySlots, selectBestSlot } from "@/lib/allocation";

describe("allocation engine", () => {
  it("selects the earliest available slot and balances load within that time", () => {
    const startsAt = new Date("2026-09-16T08:00:00.000Z");
    const later = new Date("2026-09-16T09:00:00.000Z");

    const selected = selectBestSlot([
      { id: "full", stationId: "station-a", startsAt, capacity: 2, bookedCount: 2 },
      { id: "busier", stationId: "station-b", startsAt, capacity: 10, bookedCount: 8 },
      { id: "lighter", stationId: "station-c", startsAt, capacity: 10, bookedCount: 2 },
      { id: "later", stationId: "station-d", startsAt: later, capacity: 10, bookedCount: 0 }
    ]);

    expect(selected?.id).toBe("lighter");
  });

  it("returns null when all slots are full", () => {
    expect(
      selectBestSlot([
        { id: "full", stationId: "station-a", startsAt: new Date(), capacity: 1, bookedCount: 1 }
      ])
    ).toBeNull();
  });

  it("builds hourly slots for each station without exceeding the rule end time", () => {
    const slots = buildHourlySlots({
      stationIds: ["station-a", "station-b"],
      fuelTypeId: "fuel",
      crisisRuleId: "rule",
      startsAt: new Date("2026-09-16T08:00:00.000Z"),
      endsAt: new Date("2026-09-16T10:30:00.000Z"),
      capacity: 50
    });

    expect(slots).toHaveLength(6);
    expect(slots[2].endsAt.toISOString()).toBe("2026-09-16T10:30:00.000Z");
    expect(slots.every((slot) => slot.capacity === 50)).toBe(true);
  });
});
