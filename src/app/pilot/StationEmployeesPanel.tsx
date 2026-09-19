"use client";
import { useState, type FormEvent } from "react";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { EditDialog } from "@/components/ui/EditDialog";
import { Pill } from "@/components/ui/Pill";
import type { DashboardStation, StationEmployee } from "./types";

type StationEmployeesPanelProps = {
  employees: StationEmployee[];
  stations: DashboardStation[];
  busy: boolean;
  onCreate: (url: string, body: unknown) => Promise<boolean>;
  onMutate: (url: string, method: "PATCH" | "DELETE", body?: unknown) => Promise<boolean>;
};

const never = "لم يدخل بعد";

/**
 * The station manager's staff list.
 *
 * These accounts exist for one purpose: the employee opens the system on his
 * own phone at the gate and scans the driver's QR. So the form asks for the
 * three things that makes that possible — a name to appear on the handover
 * record, the phone number he signs in with, and a first password.
 */
export function StationEmployeesPanel(props: StationEmployeesPanelProps) {
  const { employees, stations, busy } = props;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StationEmployee | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const ok = await props.onCreate("/api/station-users", {
      stationId: String(form.get("stationId")),
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      password: String(form.get("password"))
    });

    if (ok) setAdding(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "").trim();

    const ok = await props.onMutate(`/api/station-users/${editing.id}`, "PATCH", {
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      // Left blank means "leave it alone" — sending an empty string would fail
      // validation and make an ordinary rename impossible.
      ...(password ? { password } : {})
    });

    if (ok) setEditing(null);
  }

  return (
    <section className="panel" id="employees">
      <div className="panel-head">
        <div>
          <h2>موظفو المحطة</h2>
          <p>لكل موظف حساب يفتحه من هاتفه ليمسح رمز السائق · اسمه يُسجَّل مع كل عملية صرف</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || stations.length === 0}
          onClick={() => setAdding(true)}
        >
          + إضافة موظف
        </button>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>رقم الدخول</th>
              <th>المحطة</th>
              <th>الحالة</th>
              <th>آخر دخول</th>
              <th className="col-actions">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={6}>لا يوجد موظفون بعد. أضف موظفاً ليتمكن من مسح رموز السائقين.</td>
              </tr>
            )}

            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.name}</td>
                {/* Unmasked on purpose: this is the number the manager dictates
                    to the employee so he can sign in, not a citizen's number. */}
                <td className="num">{employee.phone ?? "—"}</td>
                <td>{employee.stationName}</td>
                <td>
                  <Pill state={employee.status === "ACTIVE" ? "ok" : "critical"}>
                    {employee.status === "ACTIVE" ? "فعّال" : "موقوف"}
                  </Pill>
                </td>
                <td>
                  {employee.lastLoginAt
                    ? new Date(employee.lastLoginAt).toLocaleString("ar-IQ")
                    : never}
                </td>
                <td className="col-actions">
                  <span className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => setEditing(employee)}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void props.onMutate(`/api/station-users/${employee.id}`, "PATCH", {
                          status: employee.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                        })
                      }
                    >
                      {employee.status === "ACTIVE" ? "إيقاف" : "تفعيل"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: "حذف الموظف",
                          body: `سيفقد «${employee.name}» إمكانية الدخول فوراً. إذا سبق له صرف حصص فسيُوقَف حسابه بدل حذفه، حفاظاً على سجل عمليات الصرف.`,
                          confirmLabel: "حذف",
                          danger: true,
                          onConfirm: async () => {
                            await props.onMutate(`/api/station-users/${employee.id}`, "DELETE");
                            setConfirm(null);
                          }
                        })
                      }
                    >
                      حذف
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditDialog
        open={adding}
        title="إضافة موظف محطة"
        submitLabel="إضافة"
        busy={busy}
        onSubmit={add}
        onDismiss={() => setAdding(false)}
      >
        <label className="field">
          <span>اسم الموظف</span>
          <input name="name" required minLength={2} maxLength={120} />
        </label>
        <label className="field">
          <span>رقم الهاتف — يدخل به إلى النظام</span>
          <input name="phone" required minLength={7} maxLength={24} inputMode="tel" />
        </label>
        <label className="field">
          <span>كلمة المرور الأولى — 8 خانات فأكثر</span>
          <input name="password" type="password" required minLength={8} maxLength={256} />
        </label>
        <label className="field">
          <span>المحطة</span>
          <select name="stationId" required>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.nameAr}
              </option>
            ))}
          </select>
        </label>
        <p className="form-note">
          يفتح الموظف <strong>/pilot/employee</strong> من هاتفه، ويدخل برقمه وكلمة المرور هذه.
        </p>
      </EditDialog>

      <EditDialog
        open={Boolean(editing)}
        title={`تعديل ${editing?.name ?? ""}`}
        busy={busy}
        onSubmit={save}
        onDismiss={() => setEditing(null)}
      >
        <label className="field">
          <span>اسم الموظف</span>
          <input name="name" defaultValue={editing?.name} required minLength={2} maxLength={120} />
        </label>
        <label className="field">
          <span>رقم الهاتف</span>
          <input
            name="phone"
            defaultValue={editing?.phone ?? ""}
            required
            minLength={7}
            maxLength={24}
            inputMode="tel"
          />
        </label>
        <label className="field">
          <span>كلمة مرور جديدة — اتركها فارغة لإبقاء الحالية</span>
          <input name="password" type="password" minLength={8} maxLength={256} />
        </label>
      </EditDialog>

      <ConfirmDialog request={confirm} busy={busy} onDismiss={() => setConfirm(null)} />
    </section>
  );
}
