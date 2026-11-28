const test = require("node:test");
const assert = require("node:assert/strict");
const { enforceSameOrigin, isSameOrigin, rateLimit, rateLimitShared, publicUser } = require("../../server/auth");

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


test("uses the shared Upstash limiter and sends a hashed bucket key", async () => {
  let command = null;
  const fetchImpl = async (_url, options) => {
    command = JSON.parse(options.body);
    return { ok: true, async json() { return { result: [1, 60000] }; } };
  };
  const res = responseRecorder();
  const allowed = await rateLimitShared(
    { headers: { "x-forwarded-for": "203.0.113.45" } },
    res,
    "login-test",
    4,
    60000,
    { url: "https://redis.example", token: "test-token", fetchImpl }
  );
  assert.equal(allowed, true);
  assert.equal(command[0], "EVAL");
  assert.equal(command[2], "1");
  assert.match(command[3], /^leetmetric:rate-limit:[a-f0-9]{64}$/);
  assert.equal(command[3].includes("203.0.113.45"), false);
  assert.equal(command[4], "60000");
});

test("blocks a request when the shared limiter count exceeds the configured threshold", async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() { return { result: [6, 3500] }; }
  });
  const res = responseRecorder();
  const allowed = await rateLimitShared(
    { headers: { "x-forwarded-for": "203.0.113.46" } },
    res,
    "shared-limit-test",
    5,
    60000,
    { url: "https://redis.example", token: "test-token", fetchImpl }
  );
  assert.equal(allowed, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "4");
});

test("falls back to the bounded process-local limiter if Upstash is unavailable", async () => {
  const fetchImpl = async () => { throw new TypeError("network unavailable"); };
  const req = { headers: { "x-forwarded-for": "203.0.113.47" } };
  const first = responseRecorder();
  const second = responseRecorder();
  assert.equal(await rateLimitShared(req, first, "fallback-test", 1, 60000, {
    url: "https://redis.example", token: "test-token", fetchImpl
  }), true);
  assert.equal(await rateLimitShared(req, second, "fallback-test", 1, 60000, {
    url: "https://redis.example", token: "test-token", fetchImpl
  }), false);
  assert.equal(second.statusCode, 429);
});

test("uses the local limiter when distributed rate-limit credentials are not configured", async () => {
  const req = { headers: { "x-forwarded-for": "203.0.113.48" } };
  const res = responseRecorder();
  assert.equal(await rateLimitShared(req, res, "local-env-test", 2, 60000, {
    url: "", token: ""
  }), true);
});
