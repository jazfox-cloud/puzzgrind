const url = "https://puzzgrind-staging.jazfoxbrook.workers.dev/api/lexi/today";
const counts = new Map();
let limitedAt = null;
for (let attempt = 1; attempt <= 90; attempt += 1) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  counts.set(response.status, (counts.get(response.status) ?? 0) + 1);
  const body = await response.json().catch(() => ({}));
  if (response.status === 429) {
    if (body.error !== "rate_limit_exceeded") throw new Error("Rate limiter returned an unstable error body");
    limitedAt = attempt;
    break;
  }
}
if (limitedAt === null) throw new Error("Staging Lexi read limiter did not return 429 within 90 sequential requests");
console.log(JSON.stringify({ limiter: "RATE_LIMIT_LEXI_READ", limitedAt, statuses: Object.fromEntries(counts) }, null, 2));
