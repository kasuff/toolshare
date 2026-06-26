const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO timestamp for N calendar days from now at a fixed UTC hour. */
export function isoDaysFromNow(days: number, hourUtc = 10): string {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}
