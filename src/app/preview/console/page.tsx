import { Kpi } from "@/components/console/Kpi";
import { Rail, type RailGroup } from "@/components/console/Rail";
import { StationStrip, type StationRow } from "@/components/console/StationStrip";
import { Pill } from "@/components/ui/Pill";
import { formatCount, formatLiters } from "@/lib/stock";

/**
 * Design preview for the operations console, rendered from fixtures so the
 * layout can be reviewed without a database. It mirrors the pilot's real
 * stations and figures; nothing here is wired to the live data.
 */

const railGroups: RailGroup[] = [
  {
    title: "المتابعة",
    items: [
      { href: "/preview/console", label: "غرفة العمليات", icon: "◈" },
      { href: "#stations", label: "المحطات", icon: "⛽" },
      { href: "#movements", label: "حركات المخزون", icon: "⇅" }
    ]
  },
  {
    title: "الإدارة",
    items: [
      { href: "#citizens", label: "المواطنون", icon: "☰" },
      { href: "#documents", label: "مراجعة الهويات", icon: "▣", count: 3 },
      { href: "#crisis", label: "قواعد الأزمة", icon: "◉" },
      { href: "#users", label: "الحسابات", icon: "◍" }
    ]
  },
  {
    title: "الرقابة",
    items: [
      { href: "#reports", label: "التقارير", icon: "▤" },
      { href: "#audit", label: "سجل الرقابة", icon: "◴" }
    ]
  }
];

const stations: StationRow[] = [
  {
    id: "1",
    name: "تكريت الداخل",
    code: "PILOT-1",
    status: "NORMAL",
    fuels: [
      { fuelTypeId: "g", name: "بنزين", quantityLiters: 185_000, thresholdLiters: 40_000 },
      { fuelTypeId: "d", name: "كاز", quantityLiters: 150_000, thresholdLiters: 30_000 }
    ]
  },
  {
    id: "2",
    name: "القادسية",
    code: "PILOT-2",
    status: "NORMAL",
    fuels: [
      { fuelTypeId: "g", name: "بنزين", quantityLiters: 180_000, thresholdLiters: 40_000 },
      { fuelTypeId: "d", name: "كاز", quantityLiters: 150_000, thresholdLiters: 30_000 }
    ]
  },
  {
    id: "3",
    name: "العوجة",
    code: "PILOT-3",
    status: "NORMAL",
    fuels: [
      { fuelTypeId: "g", name: "بنزين", quantityLiters: 180_000, thresholdLiters: 40_000 },
      { fuelTypeId: "d", name: "كاز", quantityLiters: 50_000, thresholdLiters: 30_000 }
    ]
  }
];

const citizens = [
  { id: "1", name: "سعد عودة محمد", plate: "978", fuel: "بنزين", status: "بانتظار التخصيص", state: "warn" as const },
  { id: "2", name: "علي حسن جاسم", plate: "4471 أ", fuel: "بنزين", status: "مخصصة", state: "ok" as const },
  { id: "3", name: "مروان خليل", plate: "20983", fuel: "كاز", status: "بانتظار التخصيص", state: "warn" as const },
  { id: "4", name: "نور الهدى صالح", plate: "7712 ب", fuel: "بنزين", status: "موقوفة", state: "critical" as const }
];

const movements = [
  { id: "1", at: "٢٠٢٦/٩/١٧ ١٠:٤١", station: "العوجة", fuel: "بنزين", change: 100_000, after: 180_000, by: "صاحب محطة العوجة", reason: "حصة" },
  { id: "2", at: "٢٠٢٦/٩/١٧ ٠١:٥٧", station: "القادسية", fuel: "بنزين", change: 100_000, after: 180_000, by: "صاحب محطة القادسية", reason: "حصة" },
  { id: "3", at: "٢٠٢٦/٩/١٧ ٠١:٥٥", station: "القادسية", fuel: "كاز", change: 100_000, after: 150_000, by: "صاحب محطة القادسية", reason: "حصة" },
  { id: "4", at: "٢٠٢٦/٩/١٧ ٠١:٥١", station: "تكريت الداخل", fuel: "بنزين", change: -20, after: 184_980, by: "موظف تكريت", reason: "صرف — موعد ٠٨:٠٠" }
];

export default function ConsolePreviewPage() {
  const totalLiters = stations.reduce(
    (sum, station) => sum + station.fuels.reduce((inner, fuel) => inner + fuel.quantityLiters, 0),
    0
  );

  return (
    <div className="console">
      <Rail
        groups={railGroups}
        currentHref="/preview/console"
        userName="مدير التجربة"
        roleLabel="سوبر أدمن"
      />

      <main className="console-main stage">
        <header className="console-head">
          <div>
            <p className="console-eyebrow">BAGHDAD FUTURE AI · منظومة صلاح الدين</p>
            <h1>غرفة العمليات</h1>
          </div>
          <div className="console-head-actions">
            <button type="button" className="btn">
              ↧ تصدير تقرير
            </button>
            <button type="button" className="btn btn-command">
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
            note="عبر ٣ محطات · نوعا وقود"
          />
          <Kpi label="صُرف اليوم" value={formatLiters(20)} unit="لتر" note="موعد واحد مكتمل" />
          <Kpi label="بانتظار التخصيص" value={formatCount(8)} unit="مركبة" note="لا توجد أزمة فعّالة" />
          <Kpi label="المحطات العاملة" value="٣ / ٣" note="لا توجد محطة متوقفة" />
        </section>

        <div className="toolbar">
          <span className="live-dot" aria-hidden />
          يُحدَّث تلقائيًا · آخر تحديث ٢٠:١٤
          <button type="button" className="btn btn-sm" style={{ marginInlineStart: "auto" }}>
            تحديث الآن
          </button>
        </div>

        <section className="panel" id="stations">
          <div className="panel-head">
            <div>
              <h2>المحطات والمخزون</h2>
              <p>الشريط يقارن المحطات على مقياس واحد · العلامة تشير إلى حد التنبيه</p>
            </div>
            <div className="panel-actions">
              <button type="button" className="btn btn-primary">
                + إضافة محطة
              </button>
            </div>
          </div>
          <StationStrip stations={stations} />
        </section>

        <section className="panel" id="crisis">
          <div className="panel-head">
            <div>
              <h2>قاعدة الأزمة</h2>
              <p>الحصة ومدة التبريد وسعة المحطة في الساعة</p>
            </div>
            <div className="panel-actions">
              <button type="button" className="btn btn-primary">
                + قاعدة جديدة
              </button>
            </div>
          </div>
          <div className="panel-body">
            <div className="empty">
              <strong>لا توجد قاعدة أزمة فعّالة</strong>
              <p>
                ٨ مركبات تنتظر التخصيص ولن يُصرف لها وقود حتى تُفعَّل قاعدة تحدد الحصة
                والمحطات المشمولة ومدة القرار.
              </p>
              <button type="button" className="btn btn-command">
                ◉ تفعيل وضع الأزمة
              </button>
            </div>
          </div>
        </section>

        <section className="panel" id="citizens">
          <div className="panel-head">
            <div>
              <h2>المواطنون المسجلون</h2>
              <p>عرض ١ إلى ٤ من أصل ٨ مركبة</p>
            </div>
            <div className="panel-actions">
              <label className="field">
                <input placeholder="بحث بالاسم أو رقم اللوحة" aria-label="بحث" />
              </label>
              <button type="button" className="btn btn-primary">
                + تسجيل مركبة
              </button>
            </div>
          </div>
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
                {citizens.map((citizen) => (
                  <tr key={citizen.id}>
                    <td>{citizen.name}</td>
                    <td className="num">{citizen.plate}</td>
                    <td>{citizen.fuel}</td>
                    <td>
                      <Pill state={citizen.state}>{citizen.status}</Pill>
                    </td>
                    <td className="col-actions">
                      <span className="row-actions">
                        <button type="button" className="btn btn-icon" aria-label="تعديل">
                          ✎
                        </button>
                        <button type="button" className="btn btn-icon" aria-label="عرض">
                          ◎
                        </button>
                        <button type="button" className="btn btn-icon btn-danger" aria-label="حذف">
                          ✕
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.at}</td>
                    <td>{movement.station}</td>
                    <td>{movement.fuel}</td>
                    <td className={movement.change < 0 ? "num num-negative" : "num num-positive"}>
                      {movement.change < 0 ? "−" : "+"}
                      {formatLiters(Math.abs(movement.change))}
                    </td>
                    <td className="num">{formatLiters(movement.after)}</td>
                    <td>{movement.by}</td>
                    <td>{movement.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
