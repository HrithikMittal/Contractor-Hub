/** Formats an amount stored in cents. */
export function money(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** "12.50" (what someone typed) -> 1250 cents. */
export function toCents(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** 1250 cents -> "12.5" for an input field. */
export function fromCents(cents: number): string {
  return String(cents / 100);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** YYYY-MM-DD in local time. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

export type ExpiryState = "none" | "ok" | "expiring" | "expired";

export const EXPIRY_WARNING_DAYS = 30;

export function expiryState(expiry: string | null, today: string): ExpiryState {
  if (!expiry) return "none";
  if (expiry < today) return "expired";
  if (expiry <= addDays(today, EXPIRY_WARNING_DAYS)) return "expiring";
  return "ok";
}

/** Line amount in cents. */
export function lineTotal(qty: number, unitCents: number): number {
  return Math.round(qty * unitCents);
}

/** All amounts in cents. taxRate is a percentage (18 = 18%). */
export function invoiceTotals(items: { quantity: number; unit_price_cents: number }[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + lineTotal(i.quantity, i.unit_price_cents), 0);
  const tax = Math.round((subtotal * taxRate) / 100);
  return { subtotal, tax, total: subtotal + tax };
}
