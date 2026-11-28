(function attachDeveloperPlatforms(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LeetMetricDeveloperPlatforms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDeveloperPlatforms() {
  "use strict";

  const CACHE_TTL_MS = 5 * 60 * 1000;
  const cache = new Map();
  const USERNAME = /^[a-zA-Z0-9_-]{1,39}$/;

  function positiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }

  function normalizeCodeforces(payload) {
    if (!payload || payload.status !== "OK" || !Array.isArray(payload.result) || !payload.result[0]) {
      const error = new Error(payload && payload.comment ? payload.comment : "Codeforces did not return a public user profile.");
      error.code = "PLATFORM_PROFILE_MISSING";
      throw error;
    }
    const user = payload.result[0];
    if (typeof user.handle !== "string" || !user.handle.trim()) {
      throw new Error("Codeforces returned an invalid profile response.");
    }
    return {
      platform: "Codeforces",
      username: user.handle,
      url: "https://codeforces.com/profile/" + encodeURIComponent(user.handle),
      rating: positiveNumber(user.rating),
      maxRating: positiveNumber(user.maxRating),
      rank: typeof user.rank === "string" ? user.rank : "Unrated",
      maxRank: typeof user.maxRank === "string" ? user.maxRank : "Unrated",
      contribution: Number.isFinite(Number(user.contribution)) ? Number(user.contribution) : 0,
      friendOfCount: positiveNumber(user.friendOfCount),
      lastOnlineAt: positiveNumber(user.lastOnlineTimeSeconds),
      registrationAt: positiveNumber(user.registrationTimeSeconds)
    };
  }

  function normalizeGitHub(profile, repositories) {
    if (!profile || typeof profile.login !== "string") {
      throw new Error("GitHub did not return a valid public user profile.");
    }
    const repos = Array.isArray(repositories) ? repositories : [];
    const languages = {};
    let sampledStars = 0;
    repos.forEach((repo) => {
      if (!repo || repo.fork) return;
      sampledStars += positiveNumber(repo.stargazers_count);
      if (typeof repo.language === "string" && repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    });
    const topLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([name, repositoriesCount]) => ({ name, repositoriesCount }));
    const latestRepositories = repos
      .filter((repo) => repo && !repo.fork && typeof repo.name === "string")
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
      .slice(0, 5)
      .map((repo) => ({
        name: repo.name,
        description: typeof repo.description === "string" ? repo.description : "",
        url: typeof repo.html_url === "string" ? repo.html_url : "",
        stars: positiveNumber(repo.stargazers_count),
        language: typeof repo.language === "string" ? repo.language : "Not specified",
        updatedAt: repo.updated_at || null
      }));

    return {
      platform: "GitHub",
      username: profile.login,
      name: typeof profile.name === "string" ? profile.name : "",
      bio: typeof profile.bio === "string" ? profile.bio : "",
      avatarUrl: typeof profile.avatar_url === "string" ? profile.avatar_url : "",
      url: typeof profile.html_url === "string" ? profile.html_url : "https://github.com/" + encodeURIComponent(profile.login),
      publicRepositories: positiveNumber(profile.public_repos),
      followers: positiveNumber(profile.followers),
      following: positiveNumber(profile.following),
      createdAt: profile.created_at || null,
      repositoriesSampled: repos.length,
      sampledStars,
      languagesSampled: topLanguages,
      latestRepositories,
      samplingNote: "Language and star totals are calculated from the latest public repository sample returned by GitHub (up to 100 repositories), not guaranteed account-wide totals. Forks are excluded from language and star summaries."
    };
  }

  async function getJson(url) {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || "Unable to load the public platform profile.");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async function cached(key, loader) {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.value;
    if (entry) cache.delete(key);
    const value = await loader();
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    while (cache.size > 100) cache.delete(cache.keys().next().value);
    return value;
  }

  async function fetchCodeforces(handle) {
    const username = String(handle || "").trim();
    if (!USERNAME.test(username)) throw new Error("Enter a valid Codeforces handle.");
    return cached("cf:" + username.toLowerCase(), () =>
      getJson("/api/developer/codeforces/" + encodeURIComponent(username))
    );
  }

  async function fetchGitHub(username) {
    const handle = String(username || "").trim();
    if (!USERNAME.test(handle)) throw new Error("Enter a valid GitHub username.");
    return cached("gh:" + handle.toLowerCase(), () =>
      getJson("/api/developer/github/" + encodeURIComponent(handle))
    );
  }

  function clearCache() {
    cache.clear();
  }

  return { normalizeCodeforces, normalizeGitHub, fetchCodeforces, fetchGitHub, clearCache };
});
