const { normalizeCodeforces, normalizeGitHub } = require("../assets/js/developer-platforms");

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const cache = new Map();
const inFlight = new Map();
let codeforcesQueue = Promise.resolve();
let lastCodeforcesRequestAt = 0;

class PlatformError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "PlatformError";
    this.status = status || 502;
    this.code = code || "PLATFORM_UPSTREAM_ERROR";
  }
}

function validateUsername(platform, username) {
  if (!/^[a-zA-Z0-9_-]{1,39}$/.test(username)) {
    throw new PlatformError("Enter a valid public platform username.", 400, "INVALID_USERNAME");
  }
  if (platform === "github" && !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    throw new PlatformError("Enter a valid GitHub username.", 400, "INVALID_USERNAME");
  }
}

async function requestJson(url, headers, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: Object.assign({ Accept: "application/json" }, headers || {}),
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new PlatformError("The upstream platform took too long to respond.", 504, "UPSTREAM_TIMEOUT");
    }
    throw new PlatformError("Unable to reach the upstream platform right now.", 502, "UPSTREAM_UNAVAILABLE");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new PlatformError("That public profile was not found.", 404, "PROFILE_NOT_FOUND");
    }
    if (response.status === 403 || response.status === 429) {
      throw new PlatformError("The upstream platform rate limit was reached. Try again later.", 429, "UPSTREAM_RATE_LIMIT");
    }
    throw new PlatformError("The upstream platform returned HTTP " + response.status + ".", 502, "UPSTREAM_ERROR");
  }
  return body;
}

function requestCodeforces(url, fetchImpl) {
  const task = codeforcesQueue.then(async () => {
    const elapsed = Date.now() - lastCodeforcesRequestAt;
    const wait = Math.max(0, 2000 - elapsed);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCodeforcesRequestAt = Date.now();
    return requestJson(url, {}, fetchImpl);
  });
  codeforcesQueue = task.catch(() => undefined);
  return task;
}

async function loadCodeforces(username, fetchImpl = fetch) {
  validateUsername("codeforces", username);
  const url = new URL("https://codeforces.com/api/user.info");
  url.searchParams.set("handles", username);
  const payload = await requestCodeforces(url.toString(), fetchImpl);
  if (payload && payload.status === "FAILED") {
    const comment = String(payload.comment || "Codeforces could not find this public profile.");
    if (/call limit exceeded|rate limit|too many requests/i.test(comment)) {
      throw new PlatformError("Codeforces request limit reached. Try again in a moment.", 429, "UPSTREAM_RATE_LIMIT");
    }
    if (/not found|no such user|invalid handle/i.test(comment)) {
      throw new PlatformError("That Codeforces public profile was not found.", 404, "PROFILE_NOT_FOUND");
    }
    throw new PlatformError("Codeforces could not complete the profile request.", 502, "UPSTREAM_ERROR");
  }
  try {
    return normalizeCodeforces(payload);
  } catch (error) {
    throw new PlatformError(error.message || "Codeforces returned an invalid profile response.", 502, "UPSTREAM_PAYLOAD");
  }
}

async function loadGitHub(username, fetchImpl = fetch) {
  validateUsername("github", username);
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10"
  };
  const profileUrl = "https://api.github.com/users/" + encodeURIComponent(username);
  const profile = await requestJson(profileUrl, headers, fetchImpl);
  const repositoriesUrl = profileUrl + "/repos?per_page=100&sort=updated&type=owner";
  const repositories = await requestJson(repositoriesUrl, headers, fetchImpl);
  return normalizeGitHub(profile, repositories);
}

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
  for (const [cacheKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cacheKey);
  }
  cache.delete(key);
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
}

async function loadDeveloperProfile(platform, username, fetchImpl = fetch) {
  const normalized = String(username || "").trim();
  validateUsername(platform, normalized);
  const key = platform + ":" + normalized.toLowerCase();
  const cached = readCache(key);
  if (cached) return cached;
  let request = inFlight.get(key);
  if (!request) {
    request = platform === "codeforces"
      ? loadCodeforces(normalized, fetchImpl)
      : platform === "github"
        ? loadGitHub(normalized, fetchImpl)
        : Promise.reject(new PlatformError("Unsupported developer platform.", 404, "PLATFORM_NOT_SUPPORTED"));
    inFlight.set(key, request);
  }
  try {
    const data = await request;
    writeCache(key, data);
    return data;
  } finally {
    inFlight.delete(key);
  }
}

function clearDeveloperProfileCache() {
  cache.clear();
  inFlight.clear();
}

module.exports = {
  PlatformError,
  validateUsername,
  loadCodeforces,
  loadGitHub,
  loadDeveloperProfile,
  clearDeveloperProfileCache
};
