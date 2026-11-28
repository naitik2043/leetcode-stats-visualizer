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
