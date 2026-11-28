const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("./models/User");

const COOKIE_NAME = "leetmetric_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const MAX_RATE_LIMIT_BUCKETS = 5000;
const rateBuckets = new Map();

function json(res, status, payload) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

function requireSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const error = new Error("Account services are not configured yet.");
    error.code = "AUTH_NOT_CONFIGURED";
    throw error;
  }
  return process.env.JWT_SECRET;
}

function cookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return ["", ""];
    const key = part.slice(0, separator).trim();
    try {
      return [key, decodeURIComponent(part.slice(separator + 1).trim())];
    } catch {
      return [key, ""];
    }
  }).filter(([key]) => key));
}

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: user.id, ver: user.tokenVersion || 0 }, requireSecret(), { expiresIn: SESSION_SECONDS });
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions()}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
}

function isSameOrigin(req) {
  const origin = req.headers?.origin;
  // Modern browsers send Sec-Fetch-Site even when Origin is omitted. Reject an
  // explicitly cross-site request rather than treating a missing Origin as trusted.
  if (!origin) return req.headers?.["sec-fetch-site"] !== "cross-site";

  try {
    const requestHost = String(
      req.headers?.["x-forwarded-host"] || req.headers?.host || ""
    ).split(",")[0].trim().toLowerCase();
    return Boolean(requestHost) && new URL(origin).host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

function enforceSameOrigin(req, res) {
  if (isSameOrigin(req)) return true;
  json(res, 403, { error: "Request origin could not be verified." });
  return false;
}

function rateLimit(req, res, key, maxRequests = 8, windowMs = 15 * 60 * 1000, now = Date.now()) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  const bucketKey = `${key}:${ip}`;
  const current = rateBuckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    rateBuckets.delete(bucketKey);
    // Expired keys are removed on bucket creation so this process-local limiter
    // cannot grow without bound when many unique client IPs make requests.
    for (const [storedKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(storedKey);
    }
    if (rateBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value;
      if (oldestKey !== undefined) rateBuckets.delete(oldestKey);
    }
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    json(res, 429, { error: "Too many attempts. Please wait a little and try again." });
    return false;
  }

  current.count += 1;
  // Keep recently used buckets at the end so capacity eviction removes the oldest.
  rateBuckets.delete(bucketKey);
  rateBuckets.set(bucketKey, current);
  return true;
}


const DISTRIBUTED_LIMIT_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return { current, ttl }"
].join("\n");

async function rateLimitShared(req, res, key, maxRequests = 8, windowMs = 15 * 60 * 1000, options = {}) {
  const url = options.url === undefined ? process.env.UPSTASH_REDIS_REST_URL : options.url;
  const token = options.token === undefined ? process.env.UPSTASH_REDIS_REST_TOKEN : options.token;
  if (!url || !token) return rateLimit(req, res, key, maxRequests, windowMs);

  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  const digest = crypto.createHash("sha256").update(key + ":" + ip).digest("hex");
  const redisKey = "leetmetric:rate-limit:" + digest;
  const fetchImpl = options.fetchImpl || fetch;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(["EVAL", DISTRIBUTED_LIMIT_SCRIPT, "1", redisKey, String(windowMs)]),
      signal: AbortSignal.timeout(options.timeoutMs || 2000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error("Distributed rate limiter request failed.");
    const result = payload.result;
    if (!Array.isArray(result) || result.length < 2) {
      throw new Error("Distributed rate limiter returned an invalid result.");
    }
    const count = Number(result[0]);
    const ttlMs = Number(result[1]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttlMs)) {
      throw new Error("Distributed rate limiter returned invalid counters.");
    }
    if (count > maxRequests) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(Math.max(0, ttlMs) / 1000))));
      json(res, 429, { error: "Too many attempts. Please wait a little and try again." });
      return false;
    }
    return true;
  } catch (error) {
    // Fail open to the bounded process-local limiter so a Redis outage does not
    // lock users out. This fallback is per function instance, not globally shared.
    console.warn("distributed_rate_limit_fallback", error && error.name ? error.name : "UnknownError");
    return rateLimit(req, res, key, maxRequests, windowMs);
  }
}

async function getSessionUser(req) {
  const token = cookies(req)[COOKIE_NAME];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, requireSecret());
  } catch {
    return null;
  }
  const user = await User.findById(payload.sub);
  if (!user || Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) return null;
  return user;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    leetcodeUsername: user.leetcodeUsername || "",
    createdAt: user.createdAt
  };
}

function methodNotAllowed(req, res, method) {
  res.setHeader("Allow", method);
  json(res, 405, { error: "Method not allowed." });
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

module.exports = {
  json, requireSecret, setSessionCookie, clearSessionCookie, enforceSameOrigin,
  isSameOrigin, rateLimit, rateLimitShared, getSessionUser, publicUser, methodNotAllowed, isValidEmail
};
