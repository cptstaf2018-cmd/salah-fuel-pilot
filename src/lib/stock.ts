/**
 * Stock health, derived from the quantity a station holds against the minimum
 * threshold already stored on every fuel_inventory row. The console colours a
 * bar from this, so an operator sees which station is about to run dry without
 * comparing numbers.
 */
export type StockState = "ok" | "warn" | "critical";

/** Below this multiple of the threshold a station is close to running out. */
const WARN_MULTIPLIER = 2;

export function getStockState(quantityLiters: number, thresholdLiters: number): StockState {
  if (quantityLiters <= 0) {
    return "critical";
  }

  // With no threshold configured there is nothing to compare against, so the
  // bar stays neutral rather than inventing an alarm.
  if (thresholdLiters <= 0) {
    return "ok";
  }

  if (quantityLiters <= thresholdLiters) {
    return "critical";
  }

  if (quantityLiters <= thresholdLiters * WARN_MULTIPLIER) {
    return "warn";
  }

  return "ok";
}

/**
 * How full the bar should draw, as a 0-1 fraction. Capacity is rarely recorded,
 * so the bar is scaled against the largest holding on screen — it answers
 * "which station has least", which is the question being asked.
 */
export function getStockFraction(quantityLiters: number, scaleMaxLiters: number): number {
  if (scaleMaxLiters <= 0 || quantityLiters <= 0) {
    return 0;
  }

  return Math.min(1, quantityLiters / scaleMaxLiters);
}

export function formatLiters(value: number | string): string {
  return Number(value).toLocaleString("ar-IQ", { maximumFractionDigits: 0 });
}

export function formatCount(value: number): string {
  return value.toLocaleString("ar-IQ");
}
