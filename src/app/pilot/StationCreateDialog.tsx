"use client";
import { useState, type FormEvent } from "react";
import { EditDialog } from "@/components/ui/EditDialog";
import type { DashboardFuelType, DashboardGovernorate } from "./types";

type StationCreateDialogProps = {
  open: boolean;
  busy: boolean;
  governorates: DashboardGovernorate[];
  fuelTypes: DashboardFuelType[];
  onDismiss: () => void;
  onCreate: (body: unknown) => Promise<boolean>;
};

/**
 * Creating a station also declares which fuels it carries and the level at
 * which each should warn. Both are required rather than optional: a station
 * with no inventory row cannot record a delivery, and a threshold of zero
 * leaves the stock bars permanently green no matter how low the tanks run.
 */
export function StationCreateDialog({
  open,
  busy,
  governorates,
  fuelTypes,
  onDismiss,
  onCreate
}: StationCreateDialogProps) {
  const [governorateId, setGovernorateId] = useState("");
  const [selectedFuels, setSelectedFuels] = useState<string[]>(() => fuelTypes.map((fuel) => fuel.id));
  const [error, setError] = useState("");

  const governorate = governorates.find((item) => item.id === governorateId) ?? governorates[0];

  function toggleFuel(id: string) {
    setSelectedFuels((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedFuels.length) {
      setError("اختر نوع وقود واحداً على الأقل، وإلا لن تستطيع المحطة تسجيل أي استلام.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const districtId = String(form.get("districtId") || "");
    const latitude = String(form.get("latitude") || "").trim();
    const longitude = String(form.get("longitude") || "").trim();

    const created = await onCreate({
      governorateId: String(form.get("governorateId")),
      ...(districtId ? { districtId } : {}),
      code: String(form.get("code")).trim(),
      nameAr: String(form.get("nameAr")).trim(),
      status: String(form.get("status")),
      ...(latitude ? { latitude: Number(latitude) } : {}),
      ...(longitude ? { longitude: Number(longitude) } : {}),
      fuelTypes: selectedFuels.map((fuelTypeId) => ({
        fuelTypeId,
        minimumThresholdLiters: Number(form.get(`threshold_${fuelTypeId}`) || 0)
      }))
    });

    if (created) {
      setSelectedFuels(fuelTypes.map((fuel) => fuel.id));
    } else {
      setError("تعذر إنشاء المحطة. تأكد أن رمز المحطة غير مستخدم.");
    }
  }

  return (
    <EditDialog
      open={open}
      title="إضافة محطة جديدة"
      submitLabel="إنشاء المحطة"
      busy={busy}
      error={error}
      onSubmit={submit}
      onDismiss={onDismiss}
    >
      <div className="field-row">
        <label className="field">
          <span>اسم المحطة</span>
          <input name="nameAr" required minLength={2} placeholder="مثال: تكريت الداخل" />
        </label>
        <label className="field">
          <span>رمز المحطة</span>
          <input name="code" required minLength={2} placeholder="مثال: SD-04" />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>المحافظة</span>
          <select
            name="governorateId"
            value={governorate?.id ?? ""}
            onChange={(event) => setGovernorateId(event.target.value)}
            required
          >
            {governorates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>القضاء — اختياري</span>
          <select name="districtId" defaultValue="">
            <option value="">بدون تحديد</option>
            {governorate?.districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.nameAr}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>الحالة</span>
          <select name="status" defaultValue="NORMAL">
            <option value="NORMAL">طبيعية</option>
            <option value="CLOSED">مغلقة</option>
            <option value="STOPPED">متوقفة</option>
          </select>
        </label>
        <label className="field">
          <span>خط العرض — اختياري</span>
          <input name="latitude" type="number" step="0.000001" min="-90" max="90" placeholder="34.6" />
        </label>
        <label className="field">
          <span>خط الطول — اختياري</span>
          <input name="longitude" type="number" step="0.000001" min="-180" max="180" placeholder="43.6" />
        </label>
      </div>

      <div className="field">
        <span>أنواع الوقود وحد التنبيه باللتر</span>
        <div className="fuel-picker">
          {fuelTypes.map((fuel) => {
            const checked = selectedFuels.includes(fuel.id);
            return (
              <div className="fuel-row" key={fuel.id}>
                <label className="fuel-check">
                  <input type="checkbox" checked={checked} onChange={() => toggleFuel(fuel.id)} />
                  {fuel.nameAr}
                </label>
                <input
                  name={`threshold_${fuel.id}`}
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={20000}
                  disabled={!checked}
                  aria-label={`حد التنبيه لـ ${fuel.nameAr}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </EditDialog>
  );
}
