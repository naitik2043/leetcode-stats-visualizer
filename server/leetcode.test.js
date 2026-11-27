const test = require("node:test");
const assert = require("node:assert/strict");
const {
  USERNAME_PATTERN,
  normalizeLeetCodeProfile,
  safeCount
} = require("./leetcode");

test("validates the public LeetCode username format", () => {
  assert.equal(USERNAME_PATTERN.test("Naitik_Gupta"), true);
  assert.equal(USERNAME_PATTERN.test("coder-42"), true);
  assert.equal(USERNAME_PATTERN.test("invalid username"), false);
  assert.equal(USERNAME_PATTERN.test(""), false);
  assert.equal(USERNAME_PATTERN.test("a".repeat(31)), false);
});

test("normalizes solved problems, submissions and acceptance rate", () => {
  const data = normalizeLeetCodeProfile("sample_user", {
    allQuestionsCount: [
      { difficulty: "All", count: 3400 },
      { difficulty: "Easy", count: 900 },
      { difficulty: "Medium", count: 1800 },
      { difficulty: "Hard", count: 700 }
    ],
    matchedUser: {
      submitStats: {
        acSubmissionNum: [
          { difficulty: "All", count: 220 },
          { difficulty: "Easy", count: 90 },
          { difficulty: "Medium", count: 100 },
          { difficulty: "Hard", count: 30 }
        ],
        totalSubmissionNum: [
          { difficulty: "All", count: 500 },
          { difficulty: "Easy", count: 180 },
          { difficulty: "Medium", count: 240 },
          { difficulty: "Hard", count: 80 }
        ]
      }
    }
  }, new Date("2026-11-28T00:00:00.000Z"));

  assert.equal(data.username, "sample_user");
  assert.equal(data.fetchedAt, "2026-11-28T00:00:00.000Z");
  assert.equal(data.stats.totalSolved, 220);
  assert.deepEqual(data.stats.solved, { easy: 90, medium: 100, hard: 30 });
  assert.equal(data.stats.acceptedTotal, 220);
  assert.equal(data.stats.submissionTotal, 500);
  assert.equal(data.stats.acceptanceRate, 44);
  assert.deepEqual(data.stats.totalQuestions, { easy: 900, medium: 1800, hard: 700 });
});

test("falls back to difficulty totals when aggregate rows are absent", () => {
  const data = normalizeLeetCodeProfile("fallback_user", {
    allQuestionsCount: [],
    matchedUser: {
      submitStats: {
        acSubmissionNum: [
          { difficulty: "Easy", count: "4" },
          { difficulty: "Medium", count: 3 },
          { difficulty: "Hard", count: 1 }
        ],
        totalSubmissionNum: [
          { difficulty: "Easy", count: 10 },
          { difficulty: "Medium", count: 15 },
          { difficulty: "Hard", count: 5 }
        ]
      }
    }
  });

  assert.equal(data.stats.totalSolved, 8);
  assert.equal(data.stats.acceptedTotal, 8);
  assert.equal(data.stats.submissionTotal, 30);
  assert.equal(data.stats.acceptanceRate, 26.67);
});

test("returns null when LeetCode has no matching public profile", () => {
  assert.equal(normalizeLeetCodeProfile("missing_user", { matchedUser: null }), null);
});

test("converts missing, invalid and negative counters to safe non-negative integers", () => {
  assert.equal(safeCount("12"), 12);
  assert.equal(safeCount(-4), 0);
  assert.equal(safeCount("not-a-number"), 0);
  assert.equal(safeCount(undefined), 0);
});
