"use client";
import { useState, type FormEvent } from "react";
import { Kpi } from "@/components/console/Kpi";
import { StationStrip, type StationRow } from "@/components/console/StationStrip";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { EditDialog } from "@/components/ui/EditDialog";
import { Pill } from "@/components/ui/Pill";
import { CrisisRuleDialog } from "./CrisisRuleDialog";
import { StationCreateDialog } from "./StationCreateDialog";
import { formatCount, formatLiters } from "@/lib/stock";
import {
  auditLabels,
  registrationLabels,
  type Dashboard,
  type DashboardStation,
  type DashboardVehicle
} from "./types";

type AdminConsoleProps = {
  data: Dashboard;
  busy: boolean;
  vehicleSearch: string;
  vehicleFuel: string;
  vehicleStatus: string;
  onVehicleSearch: (value: string) => void;
  onVehicleFuel: (value: string) => void;
  onVehicleStatus: (value: string) => void;
  onVehiclesPage: (direction: -1 | 1) => void;
  onCommand: (path: string) => Promise<void>;
  onCreate: (url: string, body: unknown) => Promise<boolean>;
  onMutate: (url: string, method: "PATCH" | "DELETE", body?: unknown) => Promise<boolean>;
};

const stationStatuses = [
  ["NORMAL", "طبيعية"],
  ["CROWDED", "مزدحمة"],
  ["LOW_STOCK", "مخزون منخفض"],
  ["OUT_OF_STOCK", "نفد المخزون"],
  ["STOPPED", "متوقفة"],
  ["CLOSED", "مغلقة"]
] as const;

function toStationRows(stations: DashboardStation[]): StationRow[] {
  return stations.map((station) => ({
    id: station.id,
    name: station.nameAr,
    code: station.code,
    status: station.status,
    fuels: station.fuelInventory.map((fuel) => ({
      fuelTypeId: fuel.fuelTypeId,
      name: fuel.fuelType.nameAr,
      quantityLiters: Number(fuel.quantityLiters),
      thresholdLiters: Number(fuel.minimumThresholdLiters)
    }))
  }));
}

export function AdminConsole(props: AdminConsoleProps) {
  const { data, busy } = props;
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [editingStation, setEditingStation] = useState<DashboardStation | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<DashboardVehicle | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [addingStation, setAddingStation] = useState(false);
  const [addingRule, setAddingRule] = useState(false);

  const totalLiters = data.stations.reduce(
    (sum, station) =>
      sum + station.fuelInventory.reduce((inner, fuel) => inner + Number(fuel.quantityLiters), 0),
    0
  );
  const pending =
    data.vehicleSummary.byStatus.find((item) => item.status === "PENDING_ALLOCATION")?.count ?? 0;
  const openStations = data.stations.filter((station) => station.status !== "CLOSED").length;
  const activeRule = data.crisisRules.find((rule) => rule.status === "ACTIVE");

  const pageStart = data.vehiclesPage.total
    ? (data.vehiclesPage.page - 1) * data.vehiclesPage.pageSize + 1
    : 0;
  const pageEnd = Math.min(
    data.vehiclesPage.page * data.vehiclesPage.pageSize,
    data.vehiclesPage.total
  );

  async function saveStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStation) return;
    const form = new FormData(event.currentTarget);
    setDialogError("");

    const saved = await props.onMutate(`/api/stations/${editingStation.id}`, "PATCH", {
      nameAr: String(form.get("nameAr")),
      code: String(form.get("code")),
      status: String(form.get("status"))
    });

    if (saved) setEditingStation(null);
    else setDialogError("تعذر حفظ التعديل. تحقق من البيانات.");
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVehicle) return;
    const form = new FormData(event.currentTarget);
    setDialogError("");

    const saved = await props.onMutate(`/api/vehicles/${editingVehicle.id}`, "PATCH", {
      ownerFullName: String(form.get("ownerFullName")),
      plateNumber: String(form.get("plateNumber")),
      registrationStatus: String(form.get("registrationStatus"))
    });

    if (saved) setEditingVehicle(null);
    else setDialogError("تعذر حفظ التعديل. تحقق من البيانات.");
  }

  return (
    <>
      <header className="console-head">
        <div>
          <p className="console-eyebrow">BAGHDAD FUTURE AI · منظومة صلاح الدين</p>
          <h1>غرفة العمليات</h1>
        </div>
        <div className="console-head-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void props.onCommand("/api/allocations/auto")}
          >
            ⇄ تخصيص الحصص
          </button>
          <button
            type="button"
            className="btn btn-command"
            disabled={busy}
            onClick={() => void props.onCommand("/api/crisis-rules/activate")}
          >
            ◉ تفعيل وضع الأزمة
          </button>
        </div>
      </header>

      <section className="kpi-band" aria-label="المؤشرات الرئيسية">
        <Kpi
          hero
          label="المخزون الكلي"
          value={formatLiters(totalLiters)}
          unit="لتر"
          note={`عبر ${formatCount(data.stations.length)} محطة`}
        />
        <Kpi
          label="صُرف اليوم"
          value={formatLiters(data.dispensedToday.liters)}
          unit="لتر"
          note={`${formatCount(data.dispensedToday.count)} عملية صرف`}
        />
        <Kpi
          label="بانتظار التخصيص"
          value={formatCount(pending)}
          unit="مركبة"
          note={activeRule ? "قاعدة أزمة فعّالة" : "لا توجد أزمة فعّالة"}
        />
        <Kpi
          label="المحطات العاملة"
          value={`${formatCount(openStations)} / ${formatCount(data.stations.length)}`}
          note={openStations === data.stations.length ? "لا توجد محطة مغلقة" : "توجد محطة مغلقة"}
        />
      </section>

      <section className="panel" id="crisis">
        <div className="panel-head">
          <div>
            <h2>قاعدة الأزمة</h2>
            <p>الحصة ومدة التبريد وسعة المحطة في الساعة</p>
          </div>
          <div className="panel-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setAddingRule(true)}>
              + قاعدة جديدة
            </button>
          </div>
        </div>
        {activeRule ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>القاعدة</th>
                  <th>الوقود</th>
                  <th>الحصة</th>
                  <th>سعة/ساعة</th>
                  <th>المحطات</th>
                  <th>المخصص</th>
                  <th>تنتهي</th>
                  <th className="col-actions">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.crisisRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      {rule.name}{" "}
                      <Pill state={rule.status === "ACTIVE" ? "ok" : "warn"}>
                        {rule.status === "ACTIVE" ? "فعّالة" : "موقوفة"}
                      </Pill>
                    </td>
                    <td>{rule.fuelType.nameAr}</td>
                    <td className="num">{formatLiters(rule.quotaLiters)} لتر</td>
                    <td className="num">{formatCount(rule.vehiclesPerStationPerHour)}</td>
                    <td className="num">{formatCount(rule._count.stations)}</td>
                    <td className="num">{formatCount(rule._count.allocations)}</td>
                    <td>{new Date(rule.endsAt).toLocaleDateString("ar-IQ")}</td>
                    <td className="col-actions">
                      <span className="row-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() =>
                            void props.onMutate(`/api/crisis-rules/${rule.id}`, "PATCH", {
                              status: rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE"
                            })
                          }
                        >
                          {rule.status === "ACTIVE" ? "إيقاف مؤقت" : "استئناف"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              title: "إلغاء قاعدة الأزمة",
                              body: `سيتوقف التخصيص بموجب «${rule.name}». المواعيد الصادرة سابقاً تبقى كما هي.`,
                              confirmLabel: "إلغاء القاعدة",
                              danger: true,
                              onConfirm: async () => {
                                await props.onMutate(`/api/crisis-rules/${rule.id}`, "PATCH", {
                                  status: "CANCELLED"
                                });
                                setConfirm(null);
                              }
                            })
                          }
                        >
                          إلغاء
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-body">
            <div className="empty">
              <strong>لا توجد قاعدة أزمة فعّالة</strong>
              <p>
                {formatCount(pending)} مركبة تنتظر التخصيص ولن يُصرف لها وقود حتى تُفعَّل قاعدة
                تحدد الحصة والمحطات المشمولة ومدة القرار.
              </p>
              <button
                type="button"
                className="btn btn-command"
                disabled={busy}
                onClick={() => void props.onCommand("/api/crisis-rules/activate")}
              >
                ◉ تفعيل وضع الأزمة
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel" id="stations">
        <div className="panel-head">
          <div>
            <h2>المحطات والمخزون</h2>
            <p>الشريط يقارن المحطات على مقياس واحد · العلامة تشير إلى حد التنبيه</p>
          </div>
          <div className="panel-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setAddingStation(true)}>
              + إضافة محطة
            </button>
          </div>
        </div>
        <StationStrip
          stations={toStationRows(data.stations)}
          onEdit={(id) => {
            setDialogError("");
            setEditingStation(data.stations.find((station) => station.id === id) ?? null);
          }}
          onRemove={(id) => {
            const station = data.stations.find((item) => item.id === id);
            if (!station) return;
            setConfirm({
              title: `حذف محطة ${station.nameAr}`,
              body: "إن كانت للمحطة حركات مخزون مسجلة فسيتم إغلاقها بدل حذفها، حفاظاً على سجل التدقيق.",
              confirmLabel: "حذف المحطة",
              danger: true,
              onConfirm: async () => {
                await props.onMutate(`/api/stations/${id}`, "DELETE");
                setConfirm(null);
              }
            });
          }}
        />
      </section>

      <section className="panel" id="citizens">
        <div className="panel-head">
          <div>
            <h2>المواطنون المسجلون</h2>
            <p>
              {data.vehiclesPage.total
                ? `عرض ${formatCount(pageStart)} إلى ${formatCount(pageEnd)} من أصل ${formatCount(data.vehiclesPage.total)} مركبة`
                : "لم يسجل مواطن بعد."}
            </p>
          </div>
          <div className="panel-actions">
            <label className="field">
              <input
                placeholder="بحث بالاسم أو رقم اللوحة"
                aria-label="بحث بالاسم أو رقم اللوحة"
                value={props.vehicleSearch}
                onChange={(event) => props.onVehicleSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="تصفية الوقود"
              value={props.vehicleFuel}
              onChange={(event) => props.onVehicleFuel(event.target.value)}
            >
              <option value="">كل أنواع الوقود</option>
              {data.vehicleSummary.byFuel.map((item) => (
                <option key={item.fuelTypeId} value={item.fuelTypeId}>
                  {item.fuelName}
                </option>
              ))}
            </select>
            <select
              aria-label="تصفية الحالة"
              value={props.vehicleStatus}
              onChange={(event) => props.onVehicleStatus(event.target.value)}
            >
              <option value="">كل الحالات</option>
              {data.vehicleSummary.byStatus.map((item) => (
                <option key={item.status} value={item.status}>
                  {registrationLabels[item.status]?.label ?? item.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {data.vehicles.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>اسم المواطن</th>
                  <th>اللوحة</th>
                  <th>الوقود</th>
                  <th>الحالة</th>
                  <th className="col-actions">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.vehicles.map((vehicle) => {
                  const status = registrationLabels[vehicle.registrationStatus] ?? {
                    label: vehicle.registrationStatus,
                    state: "idle" as const
                  };

                  return (
                    <tr key={vehicle.id}>
                      <td>{vehicle.owner.fullName}</td>
                      <td className="num">{vehicle.plateNumber}</td>
                      <td>{vehicle.fuelType.nameAr}</td>
                      <td>
                        <Pill state={status.state}>{status.label}</Pill>
                      </td>
                      <td className="col-actions">
                        <span className="row-actions">
                          <button
                            type="button"
                            className="btn btn-icon"
                            aria-label={`تعديل ${vehicle.plateNumber}`}
                            disabled={busy}
                            onClick={() => {
                              setDialogError("");
                              setEditingVehicle(vehicle);
                            }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon btn-danger"
                            aria-label={`حذف ${vehicle.plateNumber}`}
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                title: `حذف مركبة ${vehicle.plateNumber}`,
                                body: `ستُحذف مركبة ${vehicle.owner.fullName} ورمز QR الخاص بها. إن كانت لها حصة مخصصة فسيتم إيقافها بدل حذفها.`,
                                confirmLabel: "حذف المركبة",
                                danger: true,
                                onConfirm: async () => {
                                  await props.onMutate(`/api/vehicles/${vehicle.id}`, "DELETE");
                                  setConfirm(null);
                                }
                              })
                            }
                          >
                            ✕
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <strong>لا توجد مركبات مطابقة</strong>
            <p>غيّر كلمة البحث أو أعد ضبط التصفية لعرض المركبات المسجلة.</p>
          </div>
        )}

        {data.vehiclesPage.totalPages > 1 && (
          <div className="panel-body" style={{ display: "flex", gap: "var(--s3)", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={data.vehiclesPage.page <= 1}
              onClick={() => props.onVehiclesPage(-1)}
            >
              السابق
            </button>
            <span style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>
              صفحة {formatCount(data.vehiclesPage.page)} / {formatCount(data.vehiclesPage.totalPages)}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={data.vehiclesPage.page >= data.vehiclesPage.totalPages}
              onClick={() => props.onVehiclesPage(1)}
            >
              التالي
            </button>
          </div>
        )}
      </section>

      <section className="panel" id="movements">
        <div className="panel-head">
          <div>
            <h2>حركات المخزون</h2>
            <p>كل حركة تسجل الرصيد قبلها وبعدها ومَن نفّذها</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>المحطة</th>
                <th>الوقود</th>
                <th>التغيير</th>
                <th>الرصيد بعدها</th>
                <th>بواسطة</th>
                <th>السبب</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 12).map((item) => {
                const change = Number(item.quantityChange);
                return (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("ar-IQ")}</td>
                    <td>{item.station.nameAr}</td>
                    <td>{item.fuelType.nameAr}</td>
                    <td className={change < 0 ? "num num-negative" : "num num-positive"}>
                      {change < 0 ? "−" : "+"}
                      {formatLiters(Math.abs(change))}
                    </td>
                    <td className="num">{formatLiters(item.quantityAfter)}</td>
                    <td>{item.actor.name}</td>
                    <td>{item.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" id="audit">
        <div className="panel-head">
          <div>
            <h2>سجل الرقابة</h2>
            <p>آخر الإجراءات الحساسة ومَن نفّذها</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>المستخدم</th>
                <th>الإجراء</th>
                <th>النتيجة</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.slice(0, 12).map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString("ar-IQ")}</td>
                  <td>{log.actor?.name ?? "تسجيل مواطن"}</td>
                  <td>{auditLabels[log.action] ?? log.action}</td>
                  <td>
                    <Pill state={log.outcome === "SUCCESS" ? "ok" : "critical"}>
                      {log.outcome === "SUCCESS" ? "ناجح" : "مرفوض"}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <StationCreateDialog
        open={addingStation}
        busy={busy}
        governorates={data.governorates}
        fuelTypes={data.fuelTypes}
        onDismiss={() => setAddingStation(false)}
        onCreate={async (body) => {
          const ok = await props.onCreate("/api/stations", body);
          if (ok) setAddingStation(false);
          return ok;
        }}
      />

      <CrisisRuleDialog
        open={addingRule}
        busy={busy}
        stations={data.stations}
        fuelTypes={data.fuelTypes}
        onDismiss={() => setAddingRule(false)}
        onCreate={async (body) => {
          const ok = await props.onCreate("/api/crisis-rules", body);
          if (ok) setAddingRule(false);
          return ok;
        }}
      />

      <ConfirmDialog request={confirm} busy={busy} onDismiss={() => setConfirm(null)} />

      <EditDialog
        open={Boolean(editingStation)}
        title={`تعديل محطة ${editingStation?.nameAr ?? ""}`}
        busy={busy}
        error={dialogError}
        onSubmit={saveStation}
        onDismiss={() => setEditingStation(null)}
      >
        <label className="field">
          <span>اسم المحطة</span>
          <input name="nameAr" defaultValue={editingStation?.nameAr} required minLength={2} />
        </label>
        <label className="field">
          <span>رمز المحطة</span>
          <input name="code" defaultValue={editingStation?.code} required minLength={2} />
        </label>
        <label className="field">
          <span>الحالة</span>
          <select name="status" defaultValue={editingStation?.status}>
            {stationStatuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </EditDialog>

      <EditDialog
        open={Boolean(editingVehicle)}
        title={`تعديل مركبة ${editingVehicle?.plateNumber ?? ""}`}
        busy={busy}
        error={dialogError}
        onSubmit={saveVehicle}
        onDismiss={() => setEditingVehicle(null)}
      >
        <label className="field">
          <span>اسم صاحب المركبة</span>
          <input
            name="ownerFullName"
            defaultValue={editingVehicle?.owner.fullName}
            required
            minLength={2}
          />
        </label>
        <label className="field">
          <span>رقم اللوحة</span>
          <input name="plateNumber" defaultValue={editingVehicle?.plateNumber} required />
        </label>
        <label className="field">
          <span>حالة التسجيل</span>
          <select name="registrationStatus" defaultValue={editingVehicle?.registrationStatus}>
            {Object.entries(registrationLabels).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </EditDialog>
    </>
  );
}
