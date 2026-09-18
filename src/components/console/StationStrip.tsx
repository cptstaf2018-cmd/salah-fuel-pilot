"use client";
import { Pill, type PillState } from "@/components/ui/Pill";
import { StockBar } from "@/components/ui/StockBar";
import { getStockState } from "@/lib/stock";

export type StationFuel = {
  fuelTypeId: string;
  name: string;
  quantityLiters: number;
  thresholdLiters: number;
};

export type StationRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  fuels: StationFuel[];
};

const statusLabels: Record<string, { label: string; state: PillState }> = {
  NORMAL: { label: "طبيعية", state: "ok" },
  CROWDED: { label: "مزدحمة", state: "warn" },
  LOW_STOCK: { label: "مخزون منخفض", state: "warn" },
  OUT_OF_STOCK: { label: "نفد المخزون", state: "critical" },
  STOPPED: { label: "متوقفة", state: "critical" },
  CLOSED: { label: "مغلقة", state: "idle" }
};

/**
 * The station's headline state is the worst of its declared status and what its
 * tanks actually hold, so a station left marked "NORMAL" while running dry
 * still reads as critical.
 */
function resolveState(station: StationRow): { label: string; state: PillState } {
  const declared = statusLabels[station.status] ?? { label: station.status, state: "idle" as PillState };
  const worstFuel = station.fuels.reduce<PillState>((worst, fuel) => {
    const state = getStockState(fuel.quantityLiters, fuel.thresholdLiters);
    if (worst === "critical" || state === "critical") return "critical";
    if (worst === "warn" || state === "warn") return "warn";
    return worst;
  }, "ok");

  if (declared.state === "critical" || declared.state === "idle") {
    return declared;
  }

  if (worstFuel === "critical") {
    return { label: "مخزون حرج", state: "critical" };
  }

  if (worstFuel === "warn") {
    return { label: "مخزون منخفض", state: "warn" };
  }

  return declared;
}

type StationStripProps = {
  stations: StationRow[];
  onEdit?: (stationId: string) => void;
  onRemove?: (stationId: string) => void;
};

export function StationStrip({ stations, onEdit, onRemove }: StationStripProps) {
  if (!stations.length) {
    return (
      <div className="empty">
        <strong>لا توجد محطات بعد</strong>
        <p>أضف أول محطة لتبدأ بتسجيل الكميات المستلمة ومتابعة المخزون.</p>
      </div>
    );
  }

  // One shared scale across every bar on screen, so the rows compare directly.
  const scaleMaxLiters = Math.max(
    ...stations.flatMap((station) => station.fuels.map((fuel) => fuel.quantityLiters)),
    1
  );

  return (
    <div>
      {stations.map((station) => {
        const state = resolveState(station);

        return (
          <div className="station-row" key={station.id}>
            <div>
              <p className="station-name">
                {station.name}
                <Pill state={state.state}>{state.label}</Pill>
              </p>
              <span className="station-code">{station.code}</span>
            </div>

            <div className="station-fuels">
              {station.fuels.map((fuel) => (
                <StockBar
                  key={fuel.fuelTypeId}
                  label={fuel.name}
                  quantityLiters={fuel.quantityLiters}
                  thresholdLiters={fuel.thresholdLiters}
                  scaleMaxLiters={scaleMaxLiters}
                />
              ))}
            </div>

            <div className="row-actions">
              <button
                type="button"
                className="btn btn-icon"
                aria-label={`تعديل ${station.name}`}
                onClick={() => onEdit?.(station.id)}
              >
                ✎
              </button>
              <button
                type="button"
                className="btn btn-icon btn-danger"
                aria-label={`حذف ${station.name}`}
                onClick={() => onRemove?.(station.id)}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
