"use client";
import { useState, type FormEvent } from "react";
import { Kpi } from "@/components/console/Kpi";
import { StationStrip, type StationRow } from "@/components/console/StationStrip";
import { formatCount, formatLiters } from "@/lib/stock";
import type { Dashboard } from "./types";

type DispenseOutcome = {
  tone: "ok" | "critical";
  title: string;
  detail?: { plate: string; owner: string; fuel: string; liters: number; remaining: number };
};

type StationConsoleProps = {
  data: Dashboard;
  busy: boolean;
  stationId: string;
  onStationChange: (id: string) => void;
  onReceive: (event: FormEvent<HTMLFormElement>) => void;
  onDispense: (qrPayload: string, liters?: number) => Promise<DispenseOutcome>;
};

export function StationConsole(props: StationConsoleProps) {
  const { data, busy, stationId } = props;
  const [outcome, setOutcome] = useState<DispenseOutcome | null>(null);
  const station = data.stations.find((item) => item.id === stationId);

  const stationRows: StationRow[] = data.stations.map((item) => ({
    id: item.id,
    name: item.nameAr,
    code: item.code,
    status: item.status,
    fuels: item.fuelInventory.map((fuel) => ({
      fuelTypeId: fuel.fuelTypeId,
      name: fuel.fuelType.nameAr,
      quantityLiters: Number(fuel.quantityLiters),
      thresholdLiters: Number(fuel.minimumThresholdLiters)
    }))
  }));

  const totalLiters = data.stations.reduce(
    (sum, item) =>
      sum + item.fuelInventory.reduce((inner, fuel) => inner + Number(fuel.quantityLiters), 0),
    0
  );

  async function dispense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const litersRaw = String(data.get("liters") ?? "").trim();

    const result = await props.onDispense(
      String(data.get("qrPayload") ?? "").trim(),
      litersRaw ? Number(litersRaw) : undefined
    );

    setOutcome(result);
    if (result.tone === "ok") form.reset();
  }

  return (
    <>
      <header className="console-head">
        <div>
          <p className="console-eyebrow">BAGHDAD FUTURE AI · منظومة صلاح الدين</p>
          <h1>لوحة المحطة</h1>
        </div>
      </header>

      <section className="kpi-band" aria-label="مؤشرات المحطة">
        <Kpi
          hero
          label="مخزون محطتك"
          value={formatLiters(totalLiters)}
          unit="لتر"
          note={station?.nameAr ?? "—"}
        />
        <Kpi
          label="صُرف اليوم"
          value={formatLiters(data.dispensedToday.liters)}
          unit="لتر"
          note={`${formatCount(data.dispensedToday.count)} مركبة`}
        />
      </section>

      {/* First panel on the page: at a pump this is the only screen that matters. */}
      <section className="panel" id="dispense">
        <div className="panel-head">
          <div>
            <h2>صرف حصة مواطن</h2>
            <p>امسح رمز QR الخاص بالمركبة · يُخصم المخزون تلقائياً عند التأكيد</p>
          </div>
        </div>
        <div className="panel-body">
          {outcome && (
            <p className="banner" data-tone={outcome.tone} role="status" style={{ marginBottom: "var(--s4)" }}>
              <strong>{outcome.title}</strong>
            </p>
          )}

          {outcome?.detail && (
            <div className="scan-result" style={{ marginBottom: "var(--s4)" }}>
              <dl>
                <dt>المواطن</dt>
                <dd>{outcome.detail.owner}</dd>
                <dt>اللوحة</dt>
                <dd>{outcome.detail.plate}</dd>
                <dt>الوقود</dt>
                <dd>{outcome.detail.fuel}</dd>
                <dt>الكمية المصروفة</dt>
                <dd>{formatLiters(outcome.detail.liters)} لتر</dd>
                <dt>الرصيد المتبقي</dt>
                <dd>{formatLiters(outcome.detail.remaining)} لتر</dd>
              </dl>
            </div>
          )}

          <form className="scan-form" onSubmit={dispense}>
            <label className="field">
              <span>رمز QR للمركبة</span>
              <input
                name="qrPayload"
                required
                minLength={32}
                maxLength={256}
                autoComplete="off"
                placeholder="امسح الرمز أو ألصقه هنا"
              />
            </label>
            <label className="field">
              <span>الكمية باللتر — اتركها فارغة لصرف الحصة كاملة</span>
              <input name="liters" type="number" min="0.001" max="500" step="0.001" />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "جارٍ التأكيد…" : "تأكيد الصرف"}
            </button>
          </form>
        </div>
      </section>

      <section className="panel" id="receive">
        <div className="panel-head">
          <div>
            <h2>إضافة وقود مستلم</h2>
            <p>يسجل النظام الكمية قبل الاستلام وبعده ومَن أضافها</p>
          </div>
        </div>
        <div className="panel-body">
          <form className="field-row" onSubmit={props.onReceive} style={{ alignItems: "end" }}>
            <label className="field">
              <span>المحطة</span>
              <select
                value={stationId}
                onChange={(event) => props.onStationChange(event.target.value)}
              >
                {data.stations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>الوقود</span>
              <select name="fuelTypeId" key={stationId} required>
                {station?.fuelInventory.map((fuel) => (
                  <option key={fuel.fuelTypeId} value={fuel.fuelTypeId}>
                    {fuel.fuelType.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>الكمية باللتر</span>
              <input name="liters" type="number" min="0.001" max="1000000" step="0.001" required />
            </label>
            <label className="field">
              <span>رقم الوصل / سبب الاستلام</span>
              <input name="reason" minLength={3} maxLength={300} required />
            </label>
            <button className="btn btn-primary" disabled={busy || !station}>
              {busy ? "جارٍ الحفظ…" : "إضافة الكمية"}
            </button>
          </form>
        </div>
      </section>

      <section className="panel" id="stock">
        <div className="panel-head">
          <div>
            <h2>المخزون</h2>
            <p>العلامة على الشريط تشير إلى حد التنبيه</p>
          </div>
        </div>
        <StationStrip stations={stationRows} />
      </section>

      <section className="panel" id="movements">
        <div className="panel-head">
          <div>
            <h2>آخر الحركات</h2>
            <p>الاستلام والصرف في محطتك</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>الوقود</th>
                <th>التغيير</th>
                <th>الرصيد بعدها</th>
                <th>السبب</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 12).map((item) => {
                const change = Number(item.quantityChange);
                return (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("ar-IQ")}</td>
                    <td>{item.fuelType.nameAr}</td>
                    <td className={change < 0 ? "num num-negative" : "num num-positive"}>
                      {change < 0 ? "−" : "+"}
                      {formatLiters(Math.abs(change))}
                    </td>
                    <td className="num">{formatLiters(item.quantityAfter)}</td>
                    <td>{item.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
