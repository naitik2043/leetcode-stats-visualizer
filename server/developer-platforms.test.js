const test = require("node:test");
const assert = require("node:assert/strict");
const platforms = require("../developer-platforms");

test("normalizes a public Codeforces user without inventing unrated values", () => {
  const result = platforms.normalizeCodeforces({
    status: "OK",
    result: [{
      handle: "tourist",
      rating: 3900,
      maxRating: 4000,
      rank: "legendary grandmaster",
      maxRank: "legendary grandmaster",
      contribution: 120,
      friendOfCount: 2000
    }]
  });
  assert.equal(result.username, "tourist");
  assert.equal(result.rating, 3900);
  assert.equal(result.maxRating, 4000);
  assert.equal(result.rank, "legendary grandmaster");
  assert.equal(result.url, "https://codeforces.com/profile/tourist");
});

test("handles Codeforces unrated accounts and failed responses", () => {
  const result = platforms.normalizeCodeforces({
    status: "OK",
    result: [{ handle: "new_user", contribution: 0 }]
  });
  assert.equal(result.rating, 0);
  assert.equal(result.rank, "Unrated");
  assert.throws(() => platforms.normalizeCodeforces({ status: "FAILED", comment: "not found" }), /not found/);
});

test("normalizes GitHub public profile and labels sampled repository metrics", () => {
  const result = platforms.normalizeGitHub({
    login: "octocat",
    name: "Mona",
    public_repos: 150,
    followers: 20,
    following: 5,
    html_url: "https://github.com/octocat"
  }, [
    { name: "app", language: "JavaScript", stargazers_count: 5, updated_at: "2026-11-20T00:00:00Z", fork: false, html_url: "https://github.com/octocat/app" },
    { name: "api", language: "Python", stargazers_count: 3, updated_at: "2026-11-22T00:00:00Z", fork: false, html_url: "https://github.com/octocat/api" },
    { name: "forked", language: "JavaScript", stargazers_count: 50, fork: true, updated_at: "2026-11-24T00:00:00Z" }
  ]);
  assert.equal(result.publicRepositories, 150);
  assert.equal(result.repositoriesSampled, 3);
  assert.equal(result.sampledStars, 8);
  assert.equal(result.languagesSampled[0].name, "JavaScript");
  assert.equal(result.latestRepositories.length, 2);
  assert.match(result.samplingNote, /up to 100 repositories/);
});

test("rejects malformed platform profile payloads", () => {
  assert.throws(() => platforms.normalizeGitHub(null, []), /valid public user profile/);
  assert.throws(() => platforms.normalizeCodeforces({ status: "OK", result: [] }), /public user profile/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadCodeforces,
  loadGitHub,
  loadDeveloperProfile,
  clearDeveloperProfileCache,
  PlatformError
} = require("./developer-platforms");

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
