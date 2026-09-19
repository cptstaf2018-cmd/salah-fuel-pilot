"use client";
import { Kpi } from "@/components/console/Kpi";
import { DispensePanel, type DispenseOutcome } from "./DispensePanel";
import { formatCount, formatLiters } from "@/lib/stock";
import type { Dashboard } from "./types";

type EmployeeConsoleProps = {
  data: Dashboard;
  busy: boolean;
  stationId: string;
  onStationChange: (id: string) => void;
  onDispense: (qrPayload: string, liters?: number) => Promise<DispenseOutcome>;
};

/**
 * What a station employee sees on his own phone: the scanner and nothing else.
 *
 * No receipts, no stock adjustment, no citizen register — he is at the gate to
 * read a driver's code, and every extra control here is one more thing to press
 * by mistake with a queue waiting.
 */
export function EmployeeConsole({
  data,
  busy,
  stationId,
  onStationChange,
  onDispense
}: EmployeeConsoleProps) {
  const station = data.stations.find((item) => item.id === stationId);

  return (
    <>
      <header className="console-head">
        <div>
          <p className="console-eyebrow">BAGHDAD FUTURE AI · منظومة صلاح الدين</p>
          <h1>{station?.nameAr ?? "محطة"} · مسح الحصص</h1>
        </div>
      </header>

      <section className="kpi-band" aria-label="مؤشرات المحطة">
        <Kpi
          hero
          label="صُرف اليوم في محطتك"
          value={formatLiters(data.dispensedToday.liters)}
          unit="لتر"
          note={`${formatCount(data.dispensedToday.count)} مركبة`}
        />
      </section>

      {/* An employee is normally attached to one station; the picker appears
          only when he actually works at more than one. */}
      {data.stations.length > 1 && (
        <label className="field" style={{ maxWidth: "24rem" }}>
          <span>المحطة</span>
          <select value={stationId} onChange={(event) => onStationChange(event.target.value)}>
            {data.stations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nameAr}
              </option>
            ))}
          </select>
        </label>
      )}

      <DispensePanel busy={busy} onDispense={onDispense} />
    </>
  );
}
