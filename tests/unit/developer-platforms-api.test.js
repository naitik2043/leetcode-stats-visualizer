const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadCodeforces,
  loadGitHub,
  loadDeveloperProfile,
  clearDeveloperProfileCache,
  PlatformError
} = require("../../server/developer-platforms");

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

test("loads Codeforces public profile through the documented user.info endpoint", async () => {
  clearDeveloperProfileCache();
  let requestedUrl = "";
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return fakeResponse({
      status: "OK",
      result: [{ handle: "tourist", rating: 3900, maxRating: 4000, rank: "legendary grandmaster" }]
    });
  };
  const profile = await loadCodeforces("tourist", fetchImpl);
  assert.equal(profile.username, "tourist");
  assert.equal(profile.rating, 3900);
  assert.match(requestedUrl, /^https:\/\/codeforces\.com\/api\/user\.info\?/);
});

test("maps Codeforces API rate-limit and missing-handle responses accurately", async () => {
  clearDeveloperProfileCache();
  const rateLimited = async () => fakeResponse({ status: "FAILED", comment: "Call limit exceeded" });
  await assert.rejects(loadCodeforces("handle1", rateLimited), (error) => error.status === 429);

  clearDeveloperProfileCache();
  const missing = async () => fakeResponse({ status: "FAILED", comment: "handles: Not found: unknown" });
  await assert.rejects(loadCodeforces("unknown", missing), (error) => error.status === 404);
});

test("loads GitHub public profile and a bounded owner repository sample", async () => {
  clearDeveloperProfileCache();
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    if (urls.length === 1) return fakeResponse({ login: "octocat", public_repos: 2, followers: 10, following: 4 });
    return fakeResponse([
      { name: "app", language: "JavaScript", stargazers_count: 5, updated_at: "2026-11-20T00:00:00Z", fork: false, html_url: "https://github.com/octocat/app" }
    ]);
  };
  const profile = await loadGitHub("octocat", fetchImpl);
  assert.equal(profile.username, "octocat");
  assert.equal(profile.repositoriesSampled, 1);
  assert.equal(profile.sampledStars, 5);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /per_page=100/);
});

test("rejects invalid usernames before contacting an upstream service", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return fakeResponse({}); };
  await assert.rejects(loadCodeforces("bad user", fetchImpl), PlatformError);
  await assert.rejects(loadGitHub("-invalid-", fetchImpl), PlatformError);
  assert.equal(calls, 0);
});

test("maps missing profiles and upstream rate limits to explicit errors", async () => {
  clearDeveloperProfileCache();
  const missing = async () => fakeResponse({}, 404);
  await assert.rejects(loadGitHub("not-a-user", missing), (error) => error.status === 404);

  clearDeveloperProfileCache();
  const limited = async () => fakeResponse({ message: "rate limited" }, 403);
  await assert.rejects(loadGitHub("octocat", limited), (error) => error.status === 429);
});

test("caches successful profile loads and deduplicates concurrent requests", async () => {
  clearDeveloperProfileCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return fakeResponse({ status: "OK", result: [{ handle: "cached_user", rating: 1000 }] });
  };
  const [first, second] = await Promise.all([
    loadDeveloperProfile("codeforces", "cached_user", fetchImpl),
    loadDeveloperProfile("codeforces", "cached_user", fetchImpl)
  ]);
  assert.equal(calls, 1);
  assert.equal(first.username, second.username);
  const third = await loadDeveloperProfile("codeforces", "cached_user", fetchImpl);
  assert.equal(calls, 1);
  assert.equal(third.rating, 1000);
});
