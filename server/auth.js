const jwt = require("jsonwebtoken");
const User = require("./models/User");

const COOKIE_NAME = "leetmetric_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
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
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
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
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const requestHost = req.headers["x-forwarded-host"] || req.headers.host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

function enforceSameOrigin(req, res) {
  if (isSameOrigin(req)) return true;
  json(res, 403, { error: "Request origin could not be verified." });
  return false;
}

function rateLimit(req, res, key, maxRequests = 8, windowMs = 15 * 60 * 1000) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const current = rateBuckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= maxRequests) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    json(res, 429, { error: "Too many attempts. Please wait a little and try again." });
    return false;
  }
  current.count += 1;
  return true;
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
  rateLimit, getSessionUser, publicUser, methodNotAllowed, isValidEmail
};
