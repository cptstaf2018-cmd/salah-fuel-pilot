"use client";
import { useEffect, useRef, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { formatLiters } from "@/lib/stock";
import { vehicleTypeLabels } from "./types";

type VehicleDetail = {
  id: string;
  plateNumber: string;
  plateGovernorate: string;
  plateCategory: string;
  vehicleType: string;
  registrationStatus: string;
  createdAt: string;
  fuelName: string;
  owner: { fullName: string; phone: string };
  documentStatus: string | null;
  qrIssuedAt: string | null;
  appointments: {
    id: string;
    status: string;
    stationName: string;
    fuelName: string;
    quotaLiters: string;
    dispensedLiters: string | null;
    dispensedAt: string | null;
    dispensedBy: string | null;
    slotStartsAt: string;
    slotEndsAt: string;
    ruleName: string;
    cooldownHours: number;
  }[];
};

const documentLabels: Record<string, string> = {
  PENDING: "بانتظار المراجعة",
  APPROVED: "مقبولة",
  REJECTED: "مرفوضة"
};

const at = (value: string) => new Date(value).toLocaleString("ar-IQ");

export function VehicleDetailDialog({
  vehicleId,
  onDismiss
}: {
  vehicleId: string | null;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<VehicleDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (vehicleId && !dialog.open) dialog.showModal();
    if (!vehicleId && dialog.open) dialog.close();
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicleId) {
      setDetail(null);
      setError("");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/vehicles/${vehicleId}`);
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(result.error);
        setDetail(result.vehicle);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر جلب بيانات المركبة.");
      }
    })();

    // The dialog can be closed before the request lands; without this the
    // response would populate a panel the operator has already dismissed.
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const served = detail?.appointments.filter((item) => item.dispensedAt) ?? [];
  const lastServed = served[0];

  return (
    <dialog ref={ref} className="dialog dialog-wide" onCancel={onDismiss} onClose={onDismiss}>
      <div className="dialog-body">
        {error && (
          <p className="banner" data-tone="critical" role="alert">
            {error}
          </p>
        )}

        {!detail && !error && <p className="skeleton" style={{ height: 180 }} aria-label="جارٍ التحميل" />}

        {detail && (
          <>
            <div>
              <h2>{detail.owner.fullName}</h2>
              <p style={{ margin: "var(--s1) 0 0", color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>
                {detail.plateNumber}
                {detail.plateGovernorate ? ` · ${detail.plateGovernorate}` : ""}
                {detail.plateCategory ? ` · ${detail.plateCategory}` : ""}
              </p>
            </div>

            {lastServed ? (
              <p className="banner" data-tone="ok">
                <span>
                  <strong>آخر تجهيز: {at(lastServed.dispensedAt!)}</strong>
                  <br />
                  {formatLiters(lastServed.dispensedLiters ?? lastServed.quotaLiters)} لتر{" "}
                  {lastServed.fuelName} · محطة {lastServed.stationName}
                  {lastServed.dispensedBy ? ` · بواسطة ${lastServed.dispensedBy}` : ""}
                </span>
              </p>
            ) : (
              <p className="banner" data-tone="info">
                لم يُجهَّز هذا المواطن بعد.
              </p>
            )}

            <div className="scan-result">
              <dl>
                <dt>الهاتف</dt>
                <dd>{detail.owner.phone}</dd>
                <dt>نوع المركبة</dt>
                <dd>{vehicleTypeLabels[detail.vehicleType] ?? detail.vehicleType}</dd>
                <dt>الوقود</dt>
                <dd>{detail.fuelName}</dd>
                <dt>البطاقة الوطنية</dt>
                <dd>{detail.documentStatus ? documentLabels[detail.documentStatus] : "لم تُرفع"}</dd>
                <dt>تاريخ التسجيل</dt>
                <dd>{at(detail.createdAt)}</dd>
                <dt>إصدار QR</dt>
                <dd>{detail.qrIssuedAt ? at(detail.qrIssuedAt) : "—"}</dd>
              </dl>
            </div>

            <div>
              <h3 style={{ margin: "0 0 var(--s2)", fontSize: "var(--text-base)" }}>سجل الحصص</h3>
              {detail.appointments.length ? (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>الحالة</th>
                        <th>المحطة</th>
                        <th>الحصة</th>
                        <th>المصروف</th>
                        <th>وقت التجهيز</th>
                        <th>بواسطة</th>
                        <th>القرار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.appointments.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <Pill state={item.dispensedAt ? "ok" : item.status === "SCHEDULED" ? "info" : "idle"}>
                              {item.dispensedAt ? "تم التجهيز" : item.status === "SCHEDULED" ? "مخصَّص" : item.status}
                            </Pill>
                          </td>
                          <td>{item.stationName}</td>
                          <td className="num">{formatLiters(item.quotaLiters)}</td>
                          <td className="num">
                            {item.dispensedLiters ? formatLiters(item.dispensedLiters) : "—"}
                          </td>
                          <td>{item.dispensedAt ? at(item.dispensedAt) : "—"}</td>
                          <td>{item.dispensedBy ?? "—"}</td>
                          <td>{item.ruleName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>
                  لم تُخصَّص لهذه المركبة أي حصة بعد.
                </p>
              )}
            </div>
          </>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onDismiss}>
            إغلاق
          </button>
        </div>
      </div>
    </dialog>
  );
}
