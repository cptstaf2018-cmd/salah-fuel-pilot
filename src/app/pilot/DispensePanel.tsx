"use client";
import { useState, type FormEvent } from "react";
import { QrScanner } from "@/components/ui/QrScanner";
import { formatLiters } from "@/lib/stock";

export type DispenseOutcome = {
  tone: "ok" | "critical";
  title: string;
  detail?: { plate: string; owner: string; fuel: string; liters: number; remaining: number };
};

type DispensePanelProps = {
  busy: boolean;
  onDispense: (qrPayload: string, liters?: number) => Promise<DispenseOutcome>;
};

/**
 * The gate screen: camera, manual fallback, verdict.
 *
 * Shared between the manager's console and the employee's phone because it is
 * the same act — the account behind it is all that differs, and the server
 * records which one performed the handover.
 */
export function DispensePanel({ busy, onDispense }: DispensePanelProps) {
  const [outcome, setOutcome] = useState<DispenseOutcome | null>(null);
  const [scannedPayload, setScannedPayload] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const litersRaw = String(data.get("liters") ?? "").trim();

    const result = await onDispense(
      String(data.get("qrPayload") ?? "").trim(),
      litersRaw ? Number(litersRaw) : undefined
    );

    setOutcome(result);
    if (result.tone === "ok") {
      form.reset();
      setScannedPayload("");
    }
  }

  return (
    <section className="panel" id="dispense">
      <div className="panel-head">
        <div>
          <h2>صرف حصة مواطن</h2>
          <p>امسح رمز QR الخاص بالمركبة · يُخصم المخزون تلقائياً عند التأكيد</p>
        </div>
      </div>
      <div className="panel-body">
        {outcome && (
          <p
            className="banner"
            data-tone={outcome.tone}
            role="status"
            style={{ marginBottom: "var(--s4)" }}
          >
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

        <QrScanner
          onResult={(payload) => {
            setScannedPayload(payload);
            setOutcome(null);
          }}
        />

        <p className="scanner-divider">أو أدخل الرمز يدوياً</p>

        <form className="scan-form" onSubmit={submit}>
          <label className="field">
            <span>رمز QR للمركبة</span>
            <input
              name="qrPayload"
              required
              minLength={32}
              maxLength={256}
              autoComplete="off"
              placeholder="امسح الرمز أو ألصقه هنا"
              value={scannedPayload}
              onChange={(event) => setScannedPayload(event.target.value)}
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
  );
}
