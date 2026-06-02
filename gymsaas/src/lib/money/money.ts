/**
 * MONEY — integer minor units ONLY. (MANDATORY RULE 2)
 *
 * All monetary values across the system are stored and computed as integers
 * in the smallest currency unit (paise for INR). NEVER use float/decimal for
 * money math. Convert to a display string ONLY at the UI edge.
 *
 * Examples of fields that use this:
 *   price_monthly_minor, joining_fee_minor, renewal_amount_minor,
 *   amount_paid_minor, amount_due_minor, discount_minor
 */

export type MinorUnits = number; // always an integer

const CURRENCY_META: Record<string, { symbol: string; fractionDigits: number; locale: string }> = {
  INR: { symbol: "₹", fractionDigits: 2, locale: "en-IN" },
  USD: { symbol: "$", fractionDigits: 2, locale: "en-US" },
  EUR: { symbol: "€", fractionDigits: 2, locale: "en-IE" },
};

function meta(currencyCode: string) {
  return CURRENCY_META[currencyCode?.toUpperCase()] ?? CURRENCY_META.INR;
}

/** Convert major units (e.g. rupees from a form) to integer minor units. */
export function toMinor(major: number, currencyCode = "INR"): MinorUnits {
  if (!Number.isFinite(major)) return 0;
  const factor = 10 ** meta(currencyCode).fractionDigits;
  // Round to nearest integer minor unit to avoid float drift.
  return Math.round(major * factor);
}

/** Convert integer minor units back to a major-unit number (display/forms only). */
export function toMajor(minor: MinorUnits, currencyCode = "INR"): number {
  const factor = 10 ** meta(currencyCode).fractionDigits;
  return Math.round(minor) / factor;
}

/** Format integer minor units to a localized currency string (UI edge only). */
export function formatMoney(minor: MinorUnits, currencyCode = "INR"): string {
  const m = meta(currencyCode);
  const value = toMajor(minor, currencyCode);
  try {
    return new Intl.NumberFormat(m.locale, {
      style: "currency",
      currency: currencyCode?.toUpperCase() || "INR",
      maximumFractionDigits: m.fractionDigits,
    }).format(value);
  } catch {
    // Fallback if Intl/currency code unsupported — never throw.
    return `${m.symbol}${value.toFixed(m.fractionDigits)}`;
  }
}

/** Safe integer addition of minor units. */
export function addMinor(...amounts: MinorUnits[]): MinorUnits {
  return amounts.reduce((sum, a) => sum + Math.round(a || 0), 0);
}

/** Compute balance due as integer minor units (never negative). */
export function computeDueMinor(totalMinor: MinorUnits, paidMinor: MinorUnits): MinorUnits {
  return Math.max(0, Math.round(totalMinor) - Math.round(paidMinor));
}
