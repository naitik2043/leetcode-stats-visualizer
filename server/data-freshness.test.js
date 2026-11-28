const test = require("node:test");
const assert = require("node:assert/strict");
const freshness = require("../data-freshness");

test("describes a recently fetched public profile", () => {
  const message = freshness.describe({ cache: { state: "fresh", ageSeconds: 15, stale: false } });
  assert.match(message, /less than a minute/);
  assert.equal(freshness.isStale({ cache: { stale: false } }), false);
});

test("clearly labels stale-if-error profile snapshots", () => {
  const profile = { cache: { state: "stale-if-error", ageSeconds: 7200, stale: true } };
  assert.match(freshness.describe(profile), /LeetCode could not refresh/);
  assert.equal(freshness.isStale(profile), true);
});

test("combines multiple profile freshness states for comparison", () => {
  const result = freshness.combine([
    { cache: { state: "fresh", stale: false, ageSeconds: 2 } },
    { cache: { state: "stale-if-error", stale: true, ageSeconds: 900 } }
  ]);
  assert.equal(result.stale, true);
  assert.equal((result.message.match(/Public profile snapshot|Showing a cached/g) || []).length, 2);
});

test("handles missing freshness metadata without fabricating a timestamp", () => {
  assert.match(freshness.describe({}), /not supplied/);
});
