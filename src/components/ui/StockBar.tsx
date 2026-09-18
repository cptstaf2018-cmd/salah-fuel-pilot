import { formatLiters, getStockFraction, getStockState } from "@/lib/stock";

type StockBarProps = {
  label: string;
  quantityLiters: number;
  thresholdLiters: number;
  /** Largest holding on screen, so every bar reads against one scale. */
  scaleMaxLiters: number;
};

export function StockBar({ label, quantityLiters, thresholdLiters, scaleMaxLiters }: StockBarProps) {
  const state = getStockState(quantityLiters, thresholdLiters);
  const fraction = getStockFraction(quantityLiters, scaleMaxLiters);
  const thresholdFraction = getStockFraction(thresholdLiters, scaleMaxLiters);

  return (
    <div className="stock">
      <span className="stock-label">{label}</span>
      <div
        className="stock-track"
        role="meter"
        aria-label={`${label}: ${formatLiters(quantityLiters)} لتر`}
        aria-valuenow={Math.round(quantityLiters)}
        aria-valuemin={0}
        aria-valuemax={Math.round(scaleMaxLiters)}
      >
        <div
          className="stock-fill"
          data-state={state}
          style={{ width: `${(fraction * 100).toFixed(2)}%` }}
        />
        {thresholdFraction > 0 && thresholdFraction < 1 && (
          <span
            className="stock-threshold"
            style={{ insetInlineStart: `${(thresholdFraction * 100).toFixed(2)}%` }}
            aria-hidden
          />
        )}
      </div>
      <span className="stock-value">{formatLiters(quantityLiters)}</span>
    </div>
  );
}
