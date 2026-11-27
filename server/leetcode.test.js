const test = require("node:test");
const assert = require("node:assert/strict");
const {
  USERNAME_PATTERN,
  normalizeLeetCodeProfile,
  safeCount,
  normalizeCalendar,
  normalizeTopics,
  normalizeContest
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

test("normalizes activity calendar entries into sorted ISO dates", () => {
  const calendar = normalizeCalendar({
    streak: 4,
    totalActiveDays: 2,
    submissionCalendar: JSON.stringify({ "1704153600": 3, "1704067200": 2 })
  });
  assert.equal(calendar.currentStreak, 4);
  assert.equal(calendar.totalActiveDays, 2);
  assert.deepEqual(calendar.daily, [
    { date: "2024-01-01", count: 2 },
    { date: "2024-01-02", count: 3 }
  ]);
});

test("normalizes topic coverage and sorts by solved count", () => {
  const topics = normalizeTopics({
    fundamental: [{ tagName: "Array", tagSlug: "array", problemsSolved: 25 }],
    intermediate: [{ tagName: "Dynamic Programming", tagSlug: "dynamic-programming", problemsSolved: 12 }],
    advanced: [{ tagName: "Graph", tagSlug: "graph", problemsSolved: 18 }]
  });
  assert.deepEqual(topics.map((topic) => topic.name), ["Array", "Graph", "Dynamic Programming"]);
});

test("normalizes contest rating and filters unattended contests", () => {
  const contest = normalizeContest({
    attendedContestsCount: 2,
    rating: 1620.5,
    globalRanking: 12000,
    totalParticipants: 500000,
    topPercentage: 2.4
  }, [
    { attended: true, rating: 1500, ranking: 30000, problemsSolved: 2, totalProblems: 4, contest: { title: "Weekly 1", startTime: 1704067200 } },
    { attended: false, rating: 0, ranking: 0, problemsSolved: 0, totalProblems: 4, contest: { title: "Weekly 2", startTime: 1704672000 } },
    { attended: true, rating: 1620.5, ranking: 12000, problemsSolved: 3, totalProblems: 4, contest: { title: "Biweekly 1", startTime: 1705276800 } }
  ]);
  assert.equal(contest.attendedContestsCount, 2);
  assert.equal(contest.rating, 1620.5);
  assert.equal(contest.maxRating, 1620.5);
  assert.equal(contest.history.length, 2);
});
