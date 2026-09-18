"use client";
import { useState, type FormEvent } from "react";
import { EditDialog } from "@/components/ui/EditDialog";
import { vehicleTypeLabels, type DashboardFuelType, type DashboardStation } from "./types";

type CrisisRuleDialogProps = {
  open: boolean;
  busy: boolean;
  stations: DashboardStation[];
  fuelTypes: DashboardFuelType[];
  onDismiss: () => void;
  onCreate: (body: unknown) => Promise<boolean>;
};

/** Local datetime value for an <input type="datetime-local">, hours from now. */
function localDateTime(hoursFromNow: number): string {
  const at = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * Every figure the specification requires an operations officer to set is a
 * field here. The quick "activate crisis mode" button applies departmental
 * defaults; this is the form for a decision that differs from them, so no quota
 * or capacity is fixed in code.
 */
export function CrisisRuleDialog({
  open,
  busy,
  stations,
  fuelTypes,
  onDismiss,
  onCreate
}: CrisisRuleDialogProps) {
  const [stationIds, setStationIds] = useState<string[]>(() => stations.map((station) => station.id));
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(() => Object.keys(vehicleTypeLabels));
  const [error, setError] = useState("");

  function toggle(list: string[], setList: (next: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!stationIds.length) {
      setError("اختر محطة واحدة على الأقل تشملها القاعدة.");
      return;
    }
    if (!vehicleTypes.length) {
      setError("اختر نوع مركبة واحداً على الأقل.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get("startsAt")));
    const endsAt = new Date(String(form.get("endsAt")));

    if (!(endsAt > startsAt)) {
      setError("وقت الانتهاء يجب أن يكون بعد وقت البداية.");
      return;
    }

    const created = await onCreate({
      name: String(form.get("name")).trim(),
      fuelTypeId: String(form.get("fuelTypeId")),
      stationIds,
      quotaLiters: Number(form.get("quotaLiters")),
      cooldownHours: Number(form.get("cooldownHours")),
      vehiclesPerStationPerHour: Number(form.get("vehiclesPerStationPerHour")),
      includedVehicleTypes: vehicleTypes,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString()
    });

    if (!created) {
      setError("تعذر إنشاء القاعدة. راجع القيم المدخلة.");
    }
  }

  return (
    <EditDialog
      open={open}
      title="قاعدة أزمة جديدة"
      submitLabel="تفعيل القاعدة"
      busy={busy}
      error={error}
      onSubmit={submit}
      onDismiss={onDismiss}
    >
      <div className="field-row">
        <label className="field">
          <span>اسم القرار</span>
          <input name="name" required minLength={3} placeholder="مثال: أزمة بنزين تشرين" />
        </label>
        <label className="field">
          <span>نوع الوقود</span>
          <select name="fuelTypeId" required>
            {fuelTypes.map((fuel) => (
              <option key={fuel.id} value={fuel.id}>
                {fuel.nameAr}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>الحصة لكل مركبة — لتر</span>
          <input name="quotaLiters" type="number" min="1" max="500" step="1" defaultValue={20} required />
        </label>
        <label className="field">
          <span>مدة منع التكرار — ساعة</span>
          <input name="cooldownHours" type="number" min="1" max="1440" step="1" defaultValue={48} required />
        </label>
        <label className="field">
          <span>مركبات لكل محطة / ساعة</span>
          <input
            name="vehiclesPerStationPerHour"
            type="number"
            min="1"
            max="1000"
            step="1"
            defaultValue={30}
            required
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>بداية القرار</span>
          <input name="startsAt" type="datetime-local" defaultValue={localDateTime(0)} required />
        </label>
        <label className="field">
          <span>نهاية القرار</span>
          <input name="endsAt" type="datetime-local" defaultValue={localDateTime(24 * 7)} required />
        </label>
      </div>

      <div className="field">
        <span>المحطات المشمولة</span>
        <div className="chip-picker">
          {stations.map((station) => (
            <label className="chip" key={station.id} data-checked={stationIds.includes(station.id)}>
              <input
                type="checkbox"
                checked={stationIds.includes(station.id)}
                onChange={() => toggle(stationIds, setStationIds, station.id)}
              />
              {station.nameAr}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <span>أنواع المركبات المشمولة</span>
        <div className="chip-picker">
          {Object.entries(vehicleTypeLabels).map(([value, label]) => (
            <label className="chip" key={value} data-checked={vehicleTypes.includes(value)}>
              <input
                type="checkbox"
                checked={vehicleTypes.includes(value)}
                onChange={() => toggle(vehicleTypes, setVehicleTypes, value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </EditDialog>
  );
}
