export function utcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnight(date: string): string {
  const midnight = new Date(`${date}T00:00:00.000Z`);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  return midnight.toISOString();
}

export function secondsUntilNextUtcMidnight(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, Math.floor((next - now.getTime()) / 1_000));
}
