(function attachLeetMetricFreshness(root) {
  "use strict";
  function describe(profile) {
    const cache = profile && profile.cache;
    if (!cache || !Number.isFinite(Number(cache.ageSeconds))) {
      return "Profile freshness details were not supplied by the data source.";
    }
    const seconds = Math.max(0, Number(cache.ageSeconds));
    let age;
    if (seconds < 60) age = "less than a minute";
    else if (seconds < 3600) age = Math.floor(seconds / 60) + " minute(s)";
    else age = Math.floor(seconds / 3600) + " hour(s)";
    if (cache.state === "stale-if-error") {
      return "Showing a cached public snapshot last fetched " + age + " ago because LeetCode could not refresh right now.";
    }
    return "Public profile snapshot last fetched " + age + " ago.";
  }

  function isStale(profile) {
    return Boolean(profile && profile.cache && profile.cache.stale);
  }

  function combine(profiles) {
    const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
    return {
      stale: list.some(isStale),
      message: list.map((profile) => describe(profile)).join(" ")
    };
  }

  root.LeetMetricFreshness = { describe, isStale, combine };
})(window);
