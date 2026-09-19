"use client";
import type { FormEvent } from "react";
import type { PilotRole } from "./roles";

type LoginCardProps = {
  role: PilotRole;
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const copy: Record<PilotRole, { title: string; blurb: string; identifier: string }> = {
  admin: {
    title: "دخول الإدارة",
    blurb: "لوحة متابعة المحطات والمخزون والتخصيص.",
    identifier: "الحساب"
  },
  station: {
    title: "دخول مدير المحطة",
    blurb: "تسجيل الكميات المستلمة، وإدارة موظفي المحطة، وصرف حصص المواطنين.",
    identifier: "البريد الإلكتروني أو رقم الهاتف"
  },
  employee: {
    title: "دخول موظف المحطة",
    blurb: "افتح الكاميرا وامسح رمز QR الخاص بالسائق عند باب المحطة.",
    identifier: "رقم هاتفك"
  }
};

export function LoginCard({ role, busy, error, onSubmit }: LoginCardProps) {
  const text = copy[role];

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

        <h1>{text.title}</h1>
        <p>{text.blurb}</p>

        {error && (
          <p className="banner" data-tone="critical" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>{text.identifier}</span>
          {/* Typed, not picked from a list. The list was three station names
              written into the build, so every station added from the console —
              and every employee a manager hires — had no way to sign in. */}
          {role === "admin" ? (
            <select name="identifier">
              <option value="admin@pilot.local">السوبر أدمن</option>
            </select>
          ) : (
            <input
              name="identifier"
              required
              minLength={3}
              maxLength={120}
              inputMode={role === "employee" ? "tel" : "text"}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
            />
          )}
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
