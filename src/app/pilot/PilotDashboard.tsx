"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Station = {
  id: string;
  nameAr: string;
  fuelInventory: {
    fuelTypeId: string;
    quantityLiters: string;
    fuelType: { nameAr: string };
  }[];
};
type Dashboard = {
  user: { name: string; role: string };
  stations: Station[];
  transactions: {
    id: string;
    createdAt: string;
    station: { nameAr: string };
    fuelType: { nameAr: string };
    quantityChange: string;
    quantityAfter: string;
    reason: string;
    actor: { name: string };
  }[];
  vehicles: {
    id: string;
    plateNumber: string;
    owner: { fullName: string };
    fuelType: { nameAr: string };
    registrationStatus: string;
  }[];
  vehiclesPage: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  vehicleSummary: {
    byFuel: { fuelTypeId: string; fuelName: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  logs: {
    id: string;
    action: string;
    createdAt: string;
    outcome: string;
    actor: { name: string } | null;
  }[];
};
const number = (value: string | number) =>
  Number(value).toLocaleString("ar-IQ");
const distribute = (total: number, buckets: number, index: number) =>
  Math.floor(total / buckets) + (index < total % buckets ? 1 : 0);

export function PilotDashboard({ role }: { role: "admin" | "station" }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [stationId, setStationId] = useState("");
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleFuel, setVehicleFuel] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState("");
  const [planningCars, setPlanningCars] = useState(50000);
  const [quotaLiters, setQuotaLiters] = useState(20);
  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        vehiclesPage: String(vehiclesPage),
        vehiclesPageSize: "50",
        vehicleSearch,
        vehicleFuel,
        vehicleStatus,
      });
      const response = await fetch(`/api/pilot/dashboard?${query}`, {
        headers: { "x-dashboard-role": role },
      });
      const result = await response.json();
      if (response.status === 401) {
        setData(null);
        return;
      }
      if (!response.ok) throw new Error(result.error);
      if (
        result.user.role !==
        (role === "admin" ? "SUPER_ADMIN" : "STATION_MANAGER")
      ) {
        setData(null);
        return;
      }
      setData(result);
      setStationId((previous) => previous || result.stations[0]?.id || "");
    } catch {
      setError("تعذر تحديث البيانات. تحقق من الاتصال ثم أعد المحاولة.");
    }
  }, [role, vehiclesPage, vehicleSearch, vehicleFuel, vehicleStatus]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/pilot/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (
        result.user.role !==
        (role === "admin" ? "SUPER_ADMIN" : "STATION_MANAGER")
      )
        throw new Error("استخدم الحساب المخصص لهذه اللوحة.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الدخول.");
    } finally {
      setBusy(false);
    }
  }
  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/pilot/receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-role": role,
        },
        body: JSON.stringify({
          stationId,
          fuelTypeId: form.get("fuelTypeId"),
          liters: Number(form.get("liters")),
          reason: form.get("reason"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage("تمت إضافة الكمية وحفظ الحركة في سجل المراقبة.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الاستلام.");
    } finally {
      setBusy(false);
    }
  }
  const station = data?.stations.find((item) => item.id === stationId);
  const pageStart = data?.vehiclesPage.total
    ? (data.vehiclesPage.page - 1) * data.vehiclesPage.pageSize + 1
    : 0;
  const pageEnd = data
    ? Math.min(
        data.vehiclesPage.page * data.vehiclesPage.pageSize,
        data.vehiclesPage.total,
      )
    : 0;
  return (
    <div className={`dashboard-app ${data ? "dashboard-authenticated" : "dashboard-login"}`}>
      {data && <aside className="dashboard-sidebar">
        <div className="dashboard-brand"><span className="brand-symbol">⛽</span><div><strong>نظام توزيع الوقود</strong><small>صلاح الدين</small></div></div>
        <nav className="dashboard-nav" aria-label="التنقل الرئيسي">
          <a className="dashboard-nav-item active" href="#top">الرئيسية</a>
          <a className="dashboard-nav-item" href="#transactions">المعاملات</a>
          <a className="dashboard-nav-item" href="#allocations">المخصصات</a>
          <a className="dashboard-nav-item" href="#vehicles">المركبات</a>
          <a className="dashboard-nav-item" href="#reports">التقارير</a>
          <a className="dashboard-nav-item" href="#alerts">الإشعارات</a>
        </nav>
        <div className="dashboard-user"><span className="avatar">{data?.user.name?.slice(0, 1) || "م"}</span><div><strong>{data?.user.name || "مستخدم النظام"}</strong><small>{role === "admin" ? "سوبر أدمن" : "صاحب محطة"}</small></div></div>
      </aside>}
    <main id="top" className="pilot-shell">
      <header className="pilot-header dashboard-topbar">
        <div>
          <p className="eyebrow">Baghdad Future AI · تجربة صلاح الدين</p>
          <h1>{role === "admin" ? "لوحة السوبر أدمن" : "لوحة صاحب المحطة"}</h1>
          <p>
            {data
              ? `مرحبًا ${data.user.name} · تحديث كل 5 ثوانٍ`
              : "سجّل الدخول لبدء التجربة"}
          </p>
        </div>
        <a className="inline-action" href="/">
          اللوحات الثلاث
        </a>
      </header>
      <p className="pilot-notice">
        بيئة تجريبية — استخدم بيانات مواطنين وهمية. الحصة الافتتاحية لكل محطة:
        80,000 لتر بنزين و50,000 لتر كاز.
      </p>
      {data && <div className="dashboard-toolbar"><span className="live-dot" /> آخر تحديث تلقائي كل 5 ثوانٍ <button type="button" className="toolbar-action" onClick={() => void load()}>تحديث الآن</button></div>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="pilot-notice">
          {message}
        </p>
      )}
      {!data ? (
        <form className="citizen-form panel pilot-login" onSubmit={login}>
          <h2>دخول {role === "admin" ? "الإدارة" : "صاحب المحطة"}</h2>
          <label>
            الحساب
            <select name="identifier">
              {role === "admin" ? (
                <option value="admin@pilot.local">السوبر أدمن</option>
              ) : (
                ["تكريت الداخل", "القادسية", "العوجة"].map((name, i) => (
                  <option key={name} value={`station${i + 1}@pilot.local`}>
                    {name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            كلمة المرور
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button className="primary-action" disabled={busy}>
            {busy ? "جاري الدخول…" : "دخول"}
          </button>
        </form>
      ) : (
        <>
          <section className="pilot-stations">
            {data.stations.map((item) => (
              <article className="panel" key={item.id}>
                <p className="eyebrow">المخزون المتوفر</p>
                <h2>{item.nameAr}</h2>
                {item.fuelInventory.map((fuel) => (
                  <div className="pilot-balance" key={fuel.fuelTypeId}>
                    <span>{fuel.fuelType.nameAr}</span>
                    <strong>
                      {number(fuel.quantityLiters)} <small>لتر</small>
                    </strong>
                  </div>
                ))}
              </article>
            ))}
          </section>
          <section id="transactions" className="panel">
            <h2>إضافة وقود مستلم</h2>
            <p>يسجل النظام صاحب الإضافة والكمية قبل وبعد الاستلام.</p>
            <form className="citizen-form" onSubmit={receive}>
              <div className="form-row">
                <label>
                  المحطة
                  <select
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                  >
                    {data.stations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nameAr}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  الوقود
                  <select name="fuelTypeId" key={stationId} required>
                    {station?.fuelInventory.map((fuel) => (
                      <option key={fuel.fuelTypeId} value={fuel.fuelTypeId}>
                        {fuel.fuelType.nameAr}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  الكمية باللتر
                  <input
                    name="liters"
                    type="number"
                    min="0.001"
                    max="1000000"
                    step="0.001"
                    required
                  />
                </label>
                <label>
                  سبب الاستلام / رقم الوصل
                  <input name="reason" minLength={3} maxLength={300} required />
                </label>
              </div>
              <button className="primary-action" disabled={busy || !station}>
                {busy ? "جاري الحفظ…" : "إضافة الكمية"}
              </button>
            </form>
          </section>
          {role === "station" && (
            <section className="panel">
              <h2>إضافة مواطن ومركبته</h2>
              <p>يمكن مساعدة المواطن بتعبئة استمارة التسجيل وإصدار رمز QR.</p>
              <a
                className="inline-action"
                href="/citizen/register"
                target="_blank"
                rel="noreferrer"
              >
                فتح تسجيل المواطن
              </a>
            </section>
          )}
          <section className="panel">
            <h2>حركات المخزون · آخر 50 حركة</h2>
            <div className="pilot-table">
              <table>
                <thead>
                  <tr>
                    {[
                      "الوقت",
                      "المحطة",
                      "الوقود",
                      "الإضافة / لتر",
                      "الرصيد / لتر",
                      "بواسطة",
                      "السبب",
                    ].map((name) => (
                      <th key={name}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.slice(0, 10).map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.createdAt).toLocaleString("ar-IQ")}
                      </td>
                      <td>{item.station.nameAr}</td>
                      <td>{item.fuelType.nameAr}</td>
                      <td>{number(item.quantityChange)}</td>
                      <td>{number(item.quantityAfter)}</td>
                      <td>{item.actor.name}</td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
      {role === "admin" && (
        <>
          <section className="panel pilot-filter-panel">
            <h2>بحث وتصفية المواطنين</h2>
            <p>ابحث بالاسم أو رقم اللوحة، ثم اختر نوع الوقود أو حالة التسجيل.</p>
            <div className="pilot-filters">
              <input aria-label="بحث بالاسم أو رقم اللوحة" placeholder="بحث بالاسم أو رقم اللوحة" value={vehicleSearch} onChange={(event) => { setVehicleSearch(event.target.value); setVehiclesPage(1); }} />
              <select aria-label="فلترة الوقود" value={vehicleFuel} onChange={(event) => { setVehicleFuel(event.target.value); setVehiclesPage(1); }}><option value="">كل أنواع الوقود</option>{data.vehicleSummary.byFuel.map((item) => <option key={item.fuelTypeId} value={item.fuelTypeId}>{item.fuelName}</option>)}</select>
              <select aria-label="فلترة الحالة" value={vehicleStatus} onChange={(event) => { setVehicleStatus(event.target.value); setVehiclesPage(1); }}><option value="">كل الحالات</option>{data.vehicleSummary.byStatus.map((item) => <option key={item.status} value={item.status}>{item.status === "PENDING_ALLOCATION" ? "بانتظار التخصيص" : item.status}</option>)}</select>
            </div>
          </section>
              <section id="allocations" className="panel">
                <div className="pilot-section-head">
                  <div>
                    <h2>تقسيم السيارات على المحطات</h2>
                    <p>
                      مثال: 50,000 سيارة لا تظهر كقائمة واحدة؛ تتوزع على المحطات
                      وتظهر في الجدول كصفحات.
                    </p>
                  </div>
                  <span className="badge">{number(planningCars)} سيارة</span>
                </div>
                <div className="form-row">
                  <label>
                    عدد السيارات للتخطيط
                    <input
                      value={planningCars}
                      onChange={(event) =>
                        setPlanningCars(Math.max(0, Number(event.target.value)))
                      }
                      type="number"
                      min="0"
                      step="1"
                    />
                  </label>
                  <label>
                    حصة السيارة باللتر
                    <input
                      value={quotaLiters}
                      onChange={(event) =>
                        setQuotaLiters(Math.max(1, Number(event.target.value)))
                      }
                      type="number"
                      min="1"
                      step="1"
                    />
                  </label>
                </div>
                <div className="pilot-stations">
                  {data.stations.map((item, index) => {
                    const cars = distribute(
                      planningCars,
                      data.stations.length,
                      index,
                    );
                    return (
                      <article className="pilot-mini-card" key={item.id}>
                        <span>{item.nameAr}</span>
                        <strong>{number(cars)} سيارة</strong>
                        <small>
                          تحتاج تقريباً {number(cars * quotaLiters)} لتر
                        </small>
                      </article>
                    );
                  })}
                </div>
              </section>
              <section id="vehicles" className="panel">
                <div className="pilot-section-head">
                  <div>
                    <h2>المواطنون المسجلون</h2>
                    <p>
                      {data.vehiclesPage.total
                        ? `عرض ${number(pageStart)} إلى ${number(pageEnd)} من أصل ${number(data.vehiclesPage.total)} مركبة`
                        : "لم يسجل مواطن بعد. افتح لوحة المواطن وسجّل مركبة لتظهر هنا."}
                    </p>
                  </div>
                  <div className="pilot-pager">
                    <button
                      type="button"
                      disabled={vehiclesPage <= 1}
                      onClick={() =>
                        setVehiclesPage((page) => Math.max(1, page - 1))
                      }
                    >
                      السابق
                    </button>
                    <span>
                      صفحة {number(data.vehiclesPage.page)} /{" "}
                      {number(data.vehiclesPage.totalPages)}
                    </span>
                    <button
                      type="button"
                      disabled={vehiclesPage >= data.vehiclesPage.totalPages}
                      onClick={() => setVehiclesPage((page) => page + 1)}
                    >
                      التالي
                    </button>
                  </div>
                </div>
                <div className="pilot-summary">
                  {data.vehicleSummary.byFuel.map((item) => (
                    <span key={item.fuelTypeId}>
                      {item.fuelName}: {number(item.count)}
                    </span>
                  ))}
                  {data.vehicleSummary.byStatus.map((item) => (
                    <span key={item.status}>
                      {item.status === "PENDING_ALLOCATION"
                        ? "بانتظار التخصيص"
                        : item.status}
                      : {number(item.count)}
                    </span>
                  ))}
                </div>
                {!data.vehicles.length && <p>لا توجد مركبات في هذه الصفحة.</p>}
                <div className="pilot-table">
                  <table>
                    <thead>
                      <tr>
                        <th>اسم المواطن</th>
                        <th>اللوحة</th>
                        <th>الوقود</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.vehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td>{vehicle.owner.fullName}</td>
                          <td>{vehicle.plateNumber}</td>
                          <td>{vehicle.fuelType.nameAr}</td>
                          <td>
                            {vehicle.registrationStatus === "PENDING_ALLOCATION"
                              ? "بانتظار التخصيص"
                              : vehicle.registrationStatus}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section id="reports" className="panel">
                <h2>سجل الرقابة · آخر 30 إجراء</h2>
                {data.logs.slice(0, 10).map((log) => (
                  <p key={log.id}>
                    {new Date(log.createdAt).toLocaleString("ar-IQ")} ·{" "}
                    {log.actor?.name || "تسجيل مواطن"} · {log.action} ·{" "}
                    {log.outcome}
                  </p>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </main>
    </div>
  );
}
