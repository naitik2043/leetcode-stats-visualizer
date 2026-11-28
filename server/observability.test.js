const test = require("node:test");
const assert = require("node:assert/strict");
const { logEvent, createRequestTimer, ALLOWED_FIELDS } = require("./observability");

test("logs structured allowlisted fields with a safe event name", () => {
  let line = "";
  const sink = { info(value) { line = value; } };
  const result = logEvent("profile_lookup_completed", {
    component: "leetcode",
    route: "/api/leetcode/:username",
    method: "GET",
    statusCode: 200,
    durationMs: 45.9,
    password: "should-not-be-logged",
    email: "private@example.com"
  }, "info", sink);
  const parsed = JSON.parse(line);
  assert.equal(parsed.event, "profile_lookup_completed");
  assert.equal(parsed.statusCode, 200);
  assert.equal(parsed.durationMs, 45);
  assert.equal("password" in parsed, false);
  assert.equal("email" in parsed, false);
  assert.deepEqual(Object.keys(result).filter(key => key !== "timestamp"), Object.keys(parsed).filter(key => key !== "timestamp"));
});

test("sanitizes newlines and clamps untrusted text fields", () => {
  let line = "";
  const sink = { warn(value) { line = value; } };
  logEvent("bad\nevent", { component: "x\n".repeat(200) }, "warn", sink);
  const parsed = JSON.parse(line);
  assert.equal(parsed.event.includes("\n"), false);
  assert.equal(parsed.component.includes("\n"), false);
  assert.ok(parsed.component.length <= 100);
});

test("allows only known field names", () => {
  assert.deepEqual(ALLOWED_FIELDS.has("email"), false);
  assert.deepEqual(ALLOWED_FIELDS.has("durationMs"), true);
});

test("creates a non-negative duration timer", () => {
  let now = 100;
  const elapsed = createRequestTimer(() => now);
  now = 146;
  assert.equal(elapsed(), 46);
  now = 90;
  assert.equal(elapsed(), 0);
});
