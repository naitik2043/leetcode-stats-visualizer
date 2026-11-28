const test = require("node:test");
const assert = require("node:assert/strict");
const intelligence = require("../intelligence-engine");

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
