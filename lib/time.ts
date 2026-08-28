// Small time helpers for arrival countdowns.

export function minutesUntil(ms: number, now: number = Date.now()): number {
  return Math.round((ms - now) / 60000);
}

/** "Due" / "1 min" / "12 min" countdown label. */
export function formatCountdown(ms: number, now: number = Date.now()): string {
  const m = minutesUntil(ms, now);
  if (m <= 0) return "Due";
  return `${m} min`;
}
