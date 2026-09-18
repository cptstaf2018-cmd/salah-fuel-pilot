"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Rail, type RailGroup } from "@/components/console/Rail";
import { AdminConsole } from "./AdminConsole";
import { LoginCard } from "./LoginCard";
import { StationConsole } from "./StationConsole";
import type { Dashboard } from "./types";

const adminRail = (pending: number): RailGroup[] => [
  {
    title: "المتابعة",
    items: [
      { href: "#top", label: "غرفة العمليات", icon: "◈" },
      { href: "#stations", label: "المحطات", icon: "⛽" },
      { href: "#movements", label: "حركات المخزون", icon: "⇅" }
    ]
  },
  {
    title: "الإدارة",
    items: [
      { href: "#citizens", label: "المواطنون", icon: "☰", count: pending },
      { href: "#crisis", label: "قواعد الأزمة", icon: "◉" }
    ]
  },
  {
    title: "الرقابة",
    items: [{ href: "#audit", label: "سجل الرقابة", icon: "◴" }]
  }
];

const stationRail: RailGroup[] = [
  {
    title: "التشغيل",
    items: [
      { href: "#dispense", label: "صرف حصة", icon: "◈" },
      { href: "#receive", label: "استلام وقود", icon: "↧" },
      { href: "#stock", label: "المخزون", icon: "⛽" },
      { href: "#movements", label: "الحركات", icon: "⇅" }
    ]
  }
];

export function PilotDashboard({ role }: { role: "admin" | "station" }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [stationId, setStationId] = useState("");
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleFuel, setVehicleFuel] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState("");

  const expectedRole = role === "admin" ? "SUPER_ADMIN" : "STATION_MANAGER";

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        vehiclesPage: String(vehiclesPage),
        vehiclesPageSize: "50",
        vehicleSearch,
        vehicleFuel,
        vehicleStatus
      });
      const response = await fetch(`/api/pilot/dashboard?${query}`);

      if (response.status === 401) {
        setData(null);
        return;
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.user.role !== expectedRole) {
        setData(null);
        return;
      }

      setData(result);
      setStationId((previous) => previous || result.stations[0]?.id || "");
    } catch {
      setError("تعذر تحديث البيانات. تحقق من الاتصال ثم أعد المحاولة.");
    }
  }, [role, expectedRole, vehiclesPage, vehicleSearch, vehicleFuel, vehicleStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stock moves whenever any station reports a receipt, so the console refreshes
  // on a timer rather than waiting for the operator to reload.
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [data, load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/pilot/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.user.role !== expectedRole) {
        throw new Error("استخدم الحساب المخصص لهذه اللوحة.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الدخول.");
    } finally {
      setBusy(false);
    }
  }

  /** Every write goes through here so one place owns busy, errors and reload. */
  async function mutate(url: string, method: "PATCH" | "DELETE", body?: unknown): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      // The API downgrades a delete to a close or suspend when history exists;
      // that decision has to reach the operator, not be swallowed as success.
      if (result.message) setNotice(result.message);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Creates a resource, then reloads so the new row appears immediately. */
  async function create(url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(
        result.station
          ? "تمت إضافة المحطة."
          : `تم إنشاء قاعدة الأزمة وتخصيص ${result.allocation?.allocated ?? 0} مركبة.`
      );
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء السجل.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function command(path: string) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(
        path.includes("activate")
          ? `تم تفعيل وضع الأزمة · ${result.created} قاعدة جديدة.`
          : `تم تخصيص ${result.allocated} مركبة.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية.");
    } finally {
      setBusy(false);
    }
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const element = event.currentTarget;

    try {
      const response = await fetch("/api/pilot/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId,
          fuelTypeId: form.get("fuelTypeId"),
          liters: Number(form.get("liters")),
          reason: form.get("reason")
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      // A warning means the delivery saved but allocation did not run; it must
      // not read as an outright success, or the operator will not re-run it.
      if (result.warning) {
        setNotice("");
        setError(result.warning);
      } else {
        setNotice(
          result.allocation?.allocated
            ? `تمت إضافة الكمية وتخصيص ${result.allocation.allocated} مركبة.`
            : "تمت إضافة الكمية وحفظ الحركة في سجل المراقبة."
        );
      }
      element.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الاستلام.");
    } finally {
      setBusy(false);
    }
  }

  async function dispense(qrPayload: string, liters?: number) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/dispensing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload, stationId, ...(liters ? { liters } : {}) })
      });
      const result = await response.json();

      if (!response.ok) {
        return { tone: "critical" as const, title: result.error ?? "تعذر إتمام الصرف." };
      }

      await load();
      return {
        tone: "ok" as const,
        title: "تم الصرف وخُصم المخزون.",
        detail: {
          plate: result.vehiclePlate,
          owner: result.ownerName,
          fuel: result.fuelName,
          liters: result.liters,
          remaining: result.remainingLiters
        }
      };
    } catch {
      return { tone: "critical" as const, title: "تعذر الاتصال بالخادم." };
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <LoginCard role={role} busy={busy} error={error} onSubmit={login} />;
  }

  const pending =
    data.vehicleSummary.byStatus.find((item) => item.status === "PENDING_ALLOCATION")?.count ?? 0;

  return (
    <div className="console" id="top">
      <Rail
        groups={role === "admin" ? adminRail(pending) : stationRail}
        currentHref="#top"
        userName={data.user.name}
        roleLabel={role === "admin" ? "سوبر أدمن" : "صاحب محطة"}
      />

      <main className="console-main stage">
        {error && (
          <p className="banner" data-tone="critical" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="banner" data-tone="ok" role="status">
            {notice}
          </p>
        )}

        {role === "admin" ? (
          <AdminConsole
            data={data}
            busy={busy}
            vehicleSearch={vehicleSearch}
            vehicleFuel={vehicleFuel}
            vehicleStatus={vehicleStatus}
            onVehicleSearch={(value) => {
              setVehicleSearch(value);
              setVehiclesPage(1);
            }}
            onVehicleFuel={(value) => {
              setVehicleFuel(value);
              setVehiclesPage(1);
            }}
            onVehicleStatus={(value) => {
              setVehicleStatus(value);
              setVehiclesPage(1);
            }}
            onVehiclesPage={(direction) =>
              setVehiclesPage((page) => Math.max(1, page + direction))
            }
            onCommand={command}
            onCreate={create}
            onMutate={mutate}
          />
        ) : (
          <StationConsole
            data={data}
            busy={busy}
            stationId={stationId}
            onStationChange={setStationId}
            onReceive={receive}
            onDispense={dispense}
          />
        )}
      </main>
    </div>
  );
}
