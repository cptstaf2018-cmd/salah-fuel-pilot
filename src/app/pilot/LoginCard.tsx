"use client";
import type { FormEvent } from "react";

type LoginCardProps = {
  role: "admin" | "station";
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const stationAccounts = ["تكريت الداخل", "القادسية", "العوجة"];

export function LoginCard({ role, busy, error, onSubmit }: LoginCardProps) {
  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <span className="rail-mark" aria-hidden>
            ⛽
          </span>
          <div>
            <strong>منظومة الوقود</strong>
            <br />
            <small style={{ color: "var(--ink-faint)" }}>صلاح الدين</small>
          </div>
        </div>

        <h1>{role === "admin" ? "دخول الإدارة" : "دخول صاحب المحطة"}</h1>
        <p>
          {role === "admin"
            ? "لوحة متابعة المحطات والمخزون والتخصيص."
            : "تسجيل الكميات المستلمة وصرف حصص المواطنين."}
        </p>

        {error && (
          <p className="banner" data-tone="critical" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>الحساب</span>
          <select name="identifier">
            {role === "admin" ? (
              <option value="admin@pilot.local">السوبر أدمن</option>
            ) : (
              stationAccounts.map((name, index) => (
                <option key={name} value={`station${index + 1}@pilot.local`}>
                  {name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="field">
          <span>كلمة المرور</span>
          <input name="password" type="password" required autoComplete="current-password" />
        </label>

        <button className="btn btn-primary" disabled={busy}>
          {busy ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </div>
  );
}
