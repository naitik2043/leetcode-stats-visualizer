const test = require("node:test");
const assert = require("node:assert/strict");
const intelligence = require("../../assets/js/intelligence-engine");

function makeProfile(overrides = {}) {
  return {
    username: "sample_user",
    stats: {
      totalSolved: 120,
      solved: { easy: 40, medium: 60, hard: 20 },
      totalQuestions: { easy: 900, medium: 1900, hard: 800 },
      acceptedTotal: 135,
      submissionTotal: 220,
      acceptanceRate: 61.36
    },
    activity: { currentStreak: 3, totalActiveDays: 45, daily: [] },
    topics: [
      { name: "Array", slug: "array", solved: 50, level: "fundamental" },
      { name: "Dynamic Programming", slug: "dynamic-programming", solved: 4, level: "advanced" },
      { name: "Graph", slug: "graph", solved: 8, level: "intermediate" }
    ],
    contest: { attendedContestsCount: 4 },
    ...overrides
  };
}

test("normalizes invalid profile values without producing NaN", () => {
  const result = intelligence.analyzeProfile({
    username: "broken",
    stats: { solved: { easy: "not-a-number", medium: -2, hard: 5 } },
    activity: { daily: "invalid" },
    topics: [{ name: "Tree", solved: "?" }]
  }, { today: "2026-11-28T00:00:00.000Z" });

  assert.equal(result.totals.solved, 5);
  assert.equal(result.totals.easy, 0);
  assert.equal(result.activity.last7.activeDays, 0);
  assert.ok(Number.isFinite(result.readiness.score));
});

test("calculates activity windows from UTC calendar dates", () => {
  const result = intelligence.activityWindow([
    { date: "2026-11-28", count: 4 },
    { date: "2026-11-27", count: 2 },
    { date: "2026-11-01", count: 9 }
  ], 7, new Date("2026-11-28T12:00:00.000Z"));

  assert.equal(result.activeDays, 2);
  assert.equal(result.submissions, 6);
  assert.equal(result.averageSubmissionsPerActiveDay, 3);
});

test("readiness score is deterministic and exposes its methodology", () => {
  const result = intelligence.analyzeProfile(makeProfile(), { today: "2026-11-28T00:00:00.000Z" });
  assert.equal(result.readiness.score, 40);
  assert.equal(result.readiness.components.length, 4);
  assert.match(result.readiness.disclaimer, /not a hiring prediction/);
  assert.match(result.readiness.methodology, /Equal weights/);
});

test("topic recommendations are described as lower-coverage candidates, not mastery claims", () => {
  const result = intelligence.analyzeProfile(makeProfile(), { today: "2026-11-28T00:00:00.000Z" });
  assert.equal(result.topics.lowerCoverageCandidates[0].name, "Dynamic Programming");
  assert.match(result.topics.lowerCoverageCandidates[0].reason, /Lower recorded solved count/);
  assert.ok(result.recommendations.some((item) => /Broaden topic coverage/.test(item.title)));
});

test("roadmap generation returns six editable weekly blocks", () => {
  const result = intelligence.createRoadmap(makeProfile(), { today: "2026-11-28T00:00:00.000Z" });
  assert.equal(result.weeks.length, 6);
  assert.equal(result.weeks[0].focus, "Dynamic Programming");
  assert.ok(result.weeks[0].tasks.length >= 3);
});

test("mistake summary aggregates recorded mistake types and statuses", () => {
  const result = intelligence.summarizeMistakes([
    { mistakeType: "edge-cases", status: "queued" },
    { mistakeType: "edge-cases", status: "mastered" },
    { mistakeType: "complexity", status: "reviewing" }
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.mastered, 1);
  assert.equal(result.open, 2);
  assert.equal(result.topPattern, "edge-cases");
});

test("missing topics and activity produce cautious recommendations", () => {
  const result = intelligence.analyzeProfile({
    username: "new_user",
    stats: { solved: { easy: 0, medium: 0, hard: 0 } }
  }, { today: "2026-11-28T00:00:00.000Z" });
  assert.ok(result.recommendations.some((item) => /Start with a small baseline/.test(item.title)));
  assert.ok(result.recommendations.some((item) => /Collect more topic data/.test(item.title)));
  assert.ok(result.dataNotes.some((item) => /No public activity calendar/.test(item)));
});

test("predicts the next 100-problem milestone only with seven days of positive history", () => {
  const result = intelligence.predictProgress([
    { dateKey: "2026-11-01", totalSolved: 90 },
    { dateKey: "2026-11-15", totalSolved: 104 }
  ]);
  assert.equal(result.available, true);
  assert.equal(result.elapsedDays, 14);
  assert.equal(result.solvedGrowth, 14);
  assert.equal(result.nextMilestone, 200);
  assert.equal(result.averageSolvedPerDay, 1);
  assert.equal(result.projectedDate, "2027-02-19");
});

test("withholds progress projections when history is short or has no net growth", () => {
  const short = intelligence.predictProgress([
    { dateKey: "2026-11-01", totalSolved: 100 },
    { dateKey: "2026-11-05", totalSolved: 105 }
  ]);
  const stagnant = intelligence.predictProgress([
    { dateKey: "2026-10-01", totalSolved: 100 },
    { dateKey: "2026-11-01", totalSolved: 100 }
  ]);
  assert.equal(short.available, false);
  assert.match(short.reason, /at least 7 days/);
  assert.equal(stagnant.available, false);
  assert.match(stagnant.reason, /positive net growth/);
});

test("summarizes only user-recorded attempt and time signals", () => {
  const result = intelligence.summarizeMistakes([
    { mistakeType: "edge-cases", status: "queued", attemptsBeforeAccepted: 1, timeSpentMinutes: 12 },
    { mistakeType: "complexity", status: "mastered", attemptsBeforeAccepted: 3, timeSpentMinutes: 20 },
    { mistakeType: "other", status: "reviewing", attemptsBeforeAccepted: null, timeSpentMinutes: null },
    { mistakeType: "other", status: "queued", attemptsBeforeAccepted: 0, timeSpentMinutes: 900 }
  ]);
  assert.equal(result.behavior.attemptRecords, 2);
  assert.equal(result.behavior.firstAttemptAccepted, 1);
  assert.equal(result.behavior.firstAttemptRate, 50);
  assert.equal(result.behavior.averageAttemptsToAccepted, 2);
  assert.equal(result.behavior.timeRecords, 2);
  assert.equal(result.behavior.totalTimeSpentMinutes, 32);
  assert.equal(result.behavior.averageTimeSpentMinutes, 16);
});
