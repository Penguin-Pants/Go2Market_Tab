/* Summary numbers for the spike load test (T8). Pure functions. */

/* Nearest-rank percentile of a sorted list. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/* results: [{ index, ok, errorClass, status, ms }] in completion order.
   `index` is the order in which the request started (0 = first request). */
export function summarizeLoad(results) {
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const errors = {};
  for (const r of results) {
    if (r.ok) continue;
    const key = r.status ? `${r.errorClass} (HTTP ${r.status})` : r.errorClass;
    errors[key] = (errors[key] || 0) + 1;
  }
  const first = results.find((r) => r.index === 0);
  return {
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    errors,
    minMs: ms[0] ?? 0,
    p50Ms: percentile(ms, 50),
    p90Ms: percentile(ms, 90),
    p99Ms: percentile(ms, 99),
    maxMs: ms[ms.length - 1] ?? 0,
    /* The first request can meet a cold connector, so it is reported alone.
       null until it completes. */
    firstMs: first ? first.ms : null,
  };
}
