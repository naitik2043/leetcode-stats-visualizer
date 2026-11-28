const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRoadmapInput, normalizeRoadmapUpdate } = require("../../server/roadmaps");

function makePlan(horizonDays = 7) {
  return {
    username: "sample_user", horizonDays,
    generatedAt: "2026-11-28T00:00:00.000Z",
    goal: "Build a consistent DSA practice routine.",
    estimatedProblemTarget: 4,
    note: "Adjust to your schedule.",
    weeks: [{
      week: 1, title: "Week 1 — Arrays", focus: "Arrays", secondary: "Strings",
      target: 4, difficulty: "Easy → Medium",
      tasks: ["Review core patterns.", "Solve 4 problems."]
    }]
  };
}

test("normalizes a roadmap and owner progress", () => {
  const result = normalizeRoadmapInput({ username: "sample_user", horizonDays: 7, plan: makePlan(), progress: { "1": true } });
  assert.equal(result.usernameKey, "sample_user");
  assert.deepEqual(result.progress, { "1": true });
  assert.equal(result.plan.weeks.length, 1);
});

test("rejects invalid usernames, horizons and non-sequential weeks", () => {
  assert.throws(() => normalizeRoadmapInput({ username: "bad user", horizonDays: 7, plan: makePlan() }), { code: "INVALID_ROADMAP" });
  assert.throws(() => normalizeRoadmapInput({ username: "sample_user", horizonDays: 14, plan: makePlan() }), { code: "INVALID_ROADMAP" });
  const plan = makePlan(); plan.weeks[0].week = 2;
  assert.throws(() => normalizeRoadmapInput({ username: "sample_user", horizonDays: 7, plan }), { code: "INVALID_ROADMAP" });
});

test("rejects oversized plans and malformed progress", () => {
  const plan = makePlan(); plan.note = "x".repeat(41000);
  assert.throws(() => normalizeRoadmapInput({ username: "sample_user", horizonDays: 7, plan }), { code: "INVALID_ROADMAP" });
  assert.throws(() => normalizeRoadmapInput({ username: "sample_user", horizonDays: 7, plan: makePlan(), progress: { "1": "done" } }), { code: "INVALID_ROADMAP" });
});

test("validates saved roadmap progress updates against week count", () => {
  assert.deepEqual(normalizeRoadmapUpdate({ progress: { "1": false } }, 1), { progress: { "1": false } });
  assert.throws(() => normalizeRoadmapUpdate({ progress: { "2": true } }, 1), { code: "INVALID_ROADMAP" });
  assert.throws(() => normalizeRoadmapUpdate({}, 1), { code: "INVALID_ROADMAP" });
});
