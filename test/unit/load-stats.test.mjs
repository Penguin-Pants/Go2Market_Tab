import { test } from "node:test";
import assert from "node:assert/strict";

import { percentile, summarizeLoad } from "../../extension/dev/load-stats.js";

test("percentile uses the nearest rank", () => {
  const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(sorted, 50), 50);
  assert.equal(percentile(sorted, 90), 90);
  assert.equal(percentile(sorted, 99), 99);
  assert.equal(percentile([7], 99), 7);
  assert.equal(percentile([], 50), 0);
});

test("summarizeLoad counts results and groups errors", () => {
  const summary = summarizeLoad([
    { index: 1, ok: true, ms: 300 },
    { index: 3, ok: true, ms: 100 },
    { index: 2, ok: false, errorClass: "UNKNOWN", status: 429, ms: 50 },
    { index: 4, ok: false, errorClass: "UNKNOWN", status: 429, ms: 60 },
    { index: 0, ok: false, errorClass: "NOT_SIGNED_IN", status: 0, ms: 900 },
  ]);
  assert.deepEqual(summary, {
    total: 5,
    ok: 2,
    failed: 3,
    errors: { "UNKNOWN (HTTP 429)": 2, NOT_SIGNED_IN: 1 },
    minMs: 50,
    p50Ms: 100,
    p90Ms: 900,
    p99Ms: 900,
    maxMs: 900,
    firstMs: 900,
  });
});

test("summarizeLoad reports the first request by start order, not finish order", () => {
  assert.equal(summarizeLoad([{ index: 1, ok: true, ms: 40 }]).firstMs, null);
  const summary = summarizeLoad([
    { index: 1, ok: true, ms: 40 },
    { index: 0, ok: true, ms: 1800 },
  ]);
  assert.equal(summary.firstMs, 1800);
});
