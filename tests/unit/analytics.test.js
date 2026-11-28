const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSnapshotInput, utcDateKey, calculateGoalProgress } = require("../../server/analytics");

test("normalizes public profile metrics and recomputes unique solved total", () => {
  const value = normalizeSnapshotInput("Naitik_Gupta", {
    solved: { easy: 20, medium: 30, hard: 10 },
    totalQuestions: { easy: 900, medium: 1800, hard: 700 },
    acceptedTotal: 60,
    submissionTotal: 120,
    acceptanceRate: 50
  });
  assert.equal(value.totalSolved, 60);
  assert.equal(value.acceptanceRate, 50);
  assert.equal(value.usernameKey, "naitik_gupta");
});

test("rejects invalid usernames and invalid counters", () => {
  assert.throws(() => normalizeSnapshotInput("bad username", { solved: {} }), { code: "INVALID_USERNAME" });
  assert.throws(() => normalizeSnapshotInput("valid_user", { solved: { easy: -1 } }), { code: "INVALID_ANALYTICS" });
  assert.throws(() => normalizeSnapshotInput("valid_user", { solved: { easy: 1.5 } }), { code: "INVALID_ANALYTICS" });
});

test("calculates progress from a saved baseline", () => {
  assert.deepEqual(calculateGoalProgress({ baselineValue: 100, target: 20 }, 112), {
    baseline: 100, current: 112, completed: 12, target: 20,
    percentage: 60, remaining: 8, isComplete: false
  });
});

test("caps completed goal progress at 100 percent", () => {
  const progress = calculateGoalProgress({ baselineValue: 100, target: 10 }, 125);
  assert.equal(progress.percentage, 100);
  assert.equal(progress.remaining, 0);
  assert.equal(progress.isComplete, true);
});

test("derives the goal baseline and daily key deterministically", () => {
  const goal = calculateGoalProgress({ baselineValue: 20, target: 5 }, 23);
  assert.equal(goal.completed, 3);
  assert.equal(goal.remaining, 2);
});

test("uses UTC date keys consistently", () => {
  assert.equal(utcDateKey(new Date("2026-11-28T23:00:00.000Z")), "2026-11-28");
});
