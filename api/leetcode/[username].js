const {
  USERNAME_PATTERN,
  LEETCODE_PROFILE_QUERY,
  LEETCODE_CORE_PROFILE_QUERY,
  normalizeLeetCodeProfile
} = require("../../server/leetcode");

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const cache = new Map();
const inFlight = new Map();

function readCache(key, now = Date.now()) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function writeCache(key, data, now = Date.now()) {
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }
  cache.delete(key);
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
}

async function requestLeetCode(query, username) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      referer: "https://leetcode.com/",
      "user-agent": "LeetMetric/1.2 (+https://github.com/naitik2043/leetcode-stats-visualizer)"
    },
    body: JSON.stringify({ query, variables: { username } }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const error = new Error("LeetCode returned an unsuccessful response.");
    error.code = "LEETCODE_UPSTREAM_STATUS";
    throw error;
  }
  return response.json();
}

async function fetchLeetCodeProfile(username) {
  const payload = await requestLeetCode(LEETCODE_PROFILE_QUERY, username);

  // LeetCode can return HTTP 200 with GraphQL errors for an unknown profile.
  if (payload && payload.data && payload.data.matchedUser === null) return null;

  if (payload && payload.errors && payload.errors.length) {
    // A newly added analytics field may change without notice. Keep core stats usable.
    const fallback = await requestLeetCode(LEETCODE_CORE_PROFILE_QUERY, username);
    if (fallback && fallback.data && fallback.data.matchedUser) {
      return normalizeLeetCodeProfile(username, fallback.data);
    }
    if (fallback && fallback.data && fallback.data.matchedUser === null) return null;
    const error = new Error("LeetCode could not process this profile request.");
    error.code = "LEETCODE_UPSTREAM_PAYLOAD";
    throw error;
  }

  if (!payload || !payload.data) {
    const error = new Error("LeetCode returned an incomplete profile response.");
    error.code = "LEETCODE_UPSTREAM_PAYLOAD";
    throw error;
  }
  return normalizeLeetCodeProfile(username, payload.data);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const routeUsername = Array.isArray(req.query && req.query.username)
    ? req.query.username[0]
    : req.query && req.query.username;
  const username = String(routeUsername || "").trim();
  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      error: "Enter a valid LeetCode username using letters, numbers, underscores or hyphens."
    });
  }

  const cacheKey = username.toLowerCase();
  const cached = readCache(cacheKey);
  if (cached) return res.status(200).json(cached);

  try {
    let request = inFlight.get(cacheKey);
    if (!request) {
      request = fetchLeetCodeProfile(username);
      inFlight.set(cacheKey, request);
    }

    const data = await request;
    if (!data) return res.status(404).json({ error: "Public LeetCode profile not found." });
    writeCache(cacheKey, data);
    return res.status(200).json(data);
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({ error: "LeetCode took too long to respond. Please try again." });
    }
    if (error.code === "LEETCODE_UPSTREAM_STATUS" || error.code === "LEETCODE_UPSTREAM_PAYLOAD") {
      return res.status(502).json({ error: "LeetCode is temporarily unable to provide this profile. Please try again later." });
    }
    console.error("leetcode_profile_fetch_failed", error.name || "UnknownError");
    return res.status(502).json({ error: "Unable to reach LeetCode right now. Please try again later." });
  } finally {
    inFlight.delete(cacheKey);
  }
};
