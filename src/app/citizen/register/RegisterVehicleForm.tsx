"use client";

import { FormEvent, useEffect, useState } from "react";

type FuelType = {
  id: string;
  code: string;
  nameAr: string;
};

type RegistrationResult = {
  vehicle: {
    id: string;
    plateNumber: string;
    registrationStatus: string;
  };
  qr: {
    publicId: string;
    payload: string;
    svg: string;
  };
  appointment?: {
    status: string;
    stationName: string;
    fuelName: string;
    quotaLiters: string;
    startsAt: string;
    endsAt: string;
    dispensedAt: string | null;
    dispensedLiters: string | null;
    cooldownHours: number;
  } | null;
};

const at = (value: string) => new Date(value).toLocaleString("ar-IQ");

/** When this vehicle becomes eligible again, per its rule's cooldown. */
function eligibleAgainAt(dispensedAt: string, cooldownHours: number): string {
  return at(new Date(new Date(dispensedAt).getTime() + cooldownHours * 3600_000).toISOString());
}

const vehicleTypes = [
  ["PRIVATE_CAR", "سيارة خصوصي"],
  ["TAXI", "أجرة"],
  ["BUS", "حافلة"],
  ["TRUCK", "حمل"],
  ["MOTORCYCLE", "دراجة"],
  ["GOVERNMENT", "حكومي"],
  ["OTHER", "أخرى"]
];

export function RegisterVehicleForm() {
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState(false);

  useEffect(() => {
    fetch("/api/public/fuel-types")
      .then((response) => response.json())
      .then((data: { fuelTypes: FuelType[] }) => setFuelTypes(data.fuelTypes))
      .catch(() => setError("تعذر تحميل أنواع الوقود."));
    const saved = window.localStorage.getItem("pilot-registration-result");
    if (saved) {
      try { setResult(JSON.parse(saved) as RegistrationResult); } catch { window.localStorage.removeItem("pilot-registration-result"); }
    }
  }, []);

  useEffect(() => {
    if (!result?.qr.payload) return;
    const refresh = async () => {
      // Proves ownership with the QR secret rather than the vehicle id.
      const response = await fetch(`/api/citizen/vehicles?qrPayload=${encodeURIComponent(result.qr.payload)}`);
      if (!response.ok) return;
      const data = await response.json() as { appointment: RegistrationResult["appointment"] };
      if (data.appointment) setResult((current) => current ? { ...current, appointment: data.appointment } : current);
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [result?.qr.payload]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData(event.currentTarget);
    const front = form.get("front");
    const back = form.get("back");
    const payload = {
      ownerFullName: String(form.get("ownerFullName") || ""),
      phone: String(form.get("phone") || ""),
      plateNumber: String(form.get("plateNumber") || ""),
      plateGovernorate: String(form.get("plateGovernorate") || "") || undefined,
      plateCategory: String(form.get("plateCategory") || "") || undefined,
      vehicleType: String(form.get("vehicleType") || "PRIVATE_CAR"),
      fuelTypeId: String(form.get("fuelTypeId") || "")
    };

    const response = await fetch("/api/citizen/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "تعذر تسجيل المركبة.");
      setLoading(false);
      return;
    }

    setResult(data);
    window.localStorage.setItem("pilot-registration-result", JSON.stringify(data));
    if (front instanceof File && back instanceof File && front.size > 0 && back.size > 0) {
      const documents = new FormData();
      documents.set("vehicleId", data.vehicle.id);
      documents.set("qrPayload", data.qr.payload);
      documents.set("front", front);
      documents.set("back", back);
      const upload = await fetch("/api/citizen/documents", { method: "POST", body: documents });
      if (!upload.ok) { const uploadData = await upload.json(); setError(uploadData.error || "تعذر رفع البطاقة الوطنية."); }
      else setDocuments(true);
    }
    setLoading(false);
  }

  async function uploadDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result) return;
    setLoading(true); setError(null);
    const response = await fetch("/api/citizen/documents", { method: "POST", body: (() => { const data = new FormData(event.currentTarget); data.set("vehicleId", result.vehicle.id); data.set("qrPayload", result.qr.payload); return data; })() });
    const data = await response.json();
    if (!response.ok) setError(data.error || "تعذر رفع البطاقة."); else setDocuments(true);
    setLoading(false);
  }

  return (
    <div className="registration-grid">
      {!result && <form className="citizen-form" onSubmit={onSubmit}>
        <label>
          اسم صاحب المركبة
          <input name="ownerFullName" required minLength={2} maxLength={120} autoComplete="name" />
        </label>
        <label>
          رقم الهاتف
          <input name="phone" required minLength={7} maxLength={24} inputMode="tel" autoComplete="tel" />
        </label>
        <label>
          رقم اللوحة
          <input name="plateNumber" required maxLength={32} />
        </label>
        <div className="form-row">
          <label>
            محافظة اللوحة
            <input name="plateGovernorate" maxLength={80} />
          </label>
          <label>
            الصنف أو الرمز
            <input name="plateCategory" maxLength={40} />
          </label>
        </div>
        <div className="form-row">
          <label>
            نوع المركبة
            <select name="vehicleType">
              {vehicleTypes.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            نوع الوقود
            <select name="fuelTypeId" required disabled={fuelTypes.length === 0}>
              <option value="">اختر نوع الوقود</option>
              {fuelTypes.map((fuelType) => (
                <option value={fuelType.id} key={fuelType.id}>
                  {fuelType.nameAr}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="document-inline"><strong>البطاقة الوطنية</strong><span>ارفع الوجهين داخل التسجيل — JPG أو PNG فقط، حد أقصى 5MB</span><div className="document-upload-fields"><label><span>الوجه الأمامي</span><input name="front" type="file" accept="image/jpeg,image/png" required /></label><label><span>الوجه الخلفي</span><input name="back" type="file" accept="image/jpeg,image/png" required /></label></div></div>
        <button className="primary-action" type="submit" disabled={loading || fuelTypes.length === 0}>
          {loading ? "جاري التسجيل..." : "تسجيل المركبة وإصدار QR"}
        </button>
        {fuelTypes.length === 0 ? (
          <p className="form-note">لا توجد أنواع وقود معرفة بعد. شغل seed التطوير أو أضف نوع وقود من لوحة الإدارة.</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </form>}

      <aside className="qr-result">
        {result ? (
          <>
            <p className="eyebrow">تم التسجيل</p>
            <h2>QR المركبة جاهز</h2>
            <div className="qr-box" dangerouslySetInnerHTML={{ __html: result.qr.svg }} />
            <dl>
              <div>
                <dt>Vehicle ID</dt>
                <dd>{result.vehicle.id}</dd>
              </div>
              <div>
                <dt>حالة التسجيل</dt>
                {/* Derived, not fixed text. This used to read "بانتظار التخصيص"
                    even while the panel below it announced an allocation. */}
                <dd>
                  {result.appointment?.dispensedAt
                    ? "تم التجهيز"
                    : result.appointment
                      ? "تم تخصيص حصتك"
                      : "بانتظار التخصيص"}
                </dd>
              </div>
            </dl>
            {result.appointment?.dispensedAt ? (
              <div className="citizen-allocation-message citizen-served" role="status">
                <strong>تم تجهيز حصتك</strong>
                <p>
                  {result.appointment.dispensedLiters ?? result.appointment.quotaLiters} لتر{" "}
                  {result.appointment.fuelName}
                </p>
                <p>المحطة: {result.appointment.stationName}</p>
                <p>وقت التجهيز: {at(result.appointment.dispensedAt)}</p>
                <p className="citizen-eligibility">
                  رمز QR لا يصلح للصرف مرة أخرى. تعود مؤهلاً في{" "}
                  {eligibleAgainAt(result.appointment.dispensedAt, result.appointment.cooldownHours)}
                </p>
              </div>
            ) : result.appointment ? (
              <div className="citizen-allocation-message" role="status">
                <strong>تم تخصيص حصتك</strong>
                <p>
                  {result.appointment.quotaLiters} لتر {result.appointment.fuelName}
                </p>
                <p>المحطة: {result.appointment.stationName}</p>
                <p>
                  الموعد: {at(result.appointment.startsAt)} إلى{" "}
                  {new Date(result.appointment.endsAt).toLocaleTimeString("ar-IQ", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
            ) : (
              <p className="allocation-pending">
                بانتظار تخصيص المحطة والموعد من الإدارة. ستتحدث الصفحة تلقائياً.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="eyebrow">Secure QR</p>
            <h2>لا يحتوي QR على بيانات حساسة</h2>
            <p>
              عند التسجيل سيظهر رمز QR يحتوي معرفًا عامًا وسرًا عشوائيًا فقط. التحقق الحقيقي يتم من السيرفر.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
