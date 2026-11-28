const test = require("node:test");
const assert = require("node:assert/strict");
const { enforceSameOrigin, isSameOrigin, rateLimit, publicUser } = require("./auth");

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test("accepts an exact same-origin request using the forwarded host", () => {
  assert.equal(isSameOrigin({
    headers: {
      origin: "https://leetmetric.example",
      host: "internal-vercel-host",
      "x-forwarded-host": "leetmetric.example"
    }
  }), true);
});

test("rejects cross-origin, malformed-origin and hostless state changes", () => {
  assert.equal(isSameOrigin({
    headers: { origin: "https://attacker.example", host: "leetmetric.example" }
  }), false);
  assert.equal(isSameOrigin({
    headers: { origin: "not-a-url", host: "leetmetric.example" }
  }), false);
  assert.equal(isSameOrigin({ headers: { origin: "https://leetmetric.example" } }), false);
});

test("rejects a cross-site request when the Origin header is absent", () => {
  assert.equal(isSameOrigin({
    headers: { "sec-fetch-site": "cross-site", host: "leetmetric.example" }
  }), false);
  assert.equal(isSameOrigin({
    headers: { "sec-fetch-site": "same-origin", host: "leetmetric.example" }
  }), true);
});

test("enforceSameOrigin returns a no-store 403 response for a rejected request", () => {
  const res = responseRecorder();
  assert.equal(enforceSameOrigin({
    headers: { origin: "https://attacker.example", host: "leetmetric.example" }
  }, res), false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("rate limiting blocks bursts, reports retry time and resets on expiry", () => {
  const request = { headers: { "x-forwarded-for": "198.51.100.231" } };
  const res = responseRecorder();

  assert.equal(rateLimit(request, res, "auth-test", 2, 1000, 10000), true);
  assert.equal(rateLimit(request, res, "auth-test", 2, 1000, 10000), true);
  assert.equal(rateLimit(request, res, "auth-test", 2, 1000, 10500), false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "1");
  assert.equal(rateLimit(request, res, "auth-test", 2, 1000, 11000), true);
});

test("public session payload never exposes authentication secrets", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const payload = publicUser({
    _id: "user-id",
    name: "Developer",
    email: "developer@example.com",
    leetcodeUsername: "developer",
    createdAt,
    passwordHash: "never-return-this",
    resetTokenHash: "never-return-this-either",
    tokenVersion: 12
  });

  assert.deepEqual(payload, {
    id: "user-id",
    name: "Developer",
    email: "developer@example.com",
    leetcodeUsername: "developer",
    createdAt
  });
});
