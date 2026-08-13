export function isPlanExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) && ts <= Date.now();
}

/** 1 month = 30 days, counted from `fromIso`. */
export function planExpiryFromMonths(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  const days = Math.max(1, Math.floor(months)) * 30;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
