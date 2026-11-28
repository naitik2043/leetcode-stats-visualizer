const test = require("node:test");
const assert = require("node:assert/strict");
const { cacheMetadata } = require("./cache-policy");

test("marks a cache entry fresh inside its soft TTL", () => {
  const result = cacheMetadata(100000, 220000, 300000, 3600000);
  assert.equal(result.state, "fresh");
  assert.equal(result.stale, false);
  assert.equal(result.ageSeconds, 120);
  assert.equal(result.freshForSeconds, 180);
});

test("marks a usable cache entry stale between soft and hard TTLs", () => {
  const result = cacheMetadata(100000, 700000, 300000, 3600000);
  assert.equal(result.state, "stale");
  assert.equal(result.stale, true);
  assert.equal(result.ageSeconds, 600);
  assert.equal(result.expiresInSeconds, 3000);
});

test("marks an entry expired after its hard TTL", () => {
  const result = cacheMetadata(100000, 3700000, 300000, 3600000);
  assert.equal(result.state, "expired");
  assert.equal(result.stale, true);
  assert.equal(result.expiresInSeconds, 0);
});
