export type PillState = "ok" | "warn" | "critical" | "info" | "idle";

export function Pill({ state = "idle", children }: { state?: PillState; children: React.ReactNode }) {
  return (
    <span className="pill" data-state={state}>
      {children}
    </span>
  );
}
