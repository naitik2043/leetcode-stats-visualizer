const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeProblemUrl,
  normalizeRevisionCreate,
  normalizeRevisionUpdate
} = require("./revisions");

test("accepts and canonicalizes a secure LeetCode problem URL", () => {
  assert.equal(
    normalizeProblemUrl("https://leetcode.com/problems/two-sum/?envType=study-plan"),
    "https://leetcode.com/problems/two-sum/"
  );
});

test("rejects non-LeetCode or insecure problem URLs", () => {
  assert.throws(() => normalizeProblemUrl("http://leetcode.com/problems/two-sum/"), { code: "INVALID_REVISION" });
  assert.throws(() => normalizeProblemUrl("https://example.com/problems/two-sum/"), { code: "INVALID_REVISION" });
  assert.throws(() => normalizeProblemUrl("https://leetcode.com/contest/"), { code: "INVALID_REVISION" });
});

test("normalizes new revision items with safe defaults", () => {
  const item = normalizeRevisionCreate({
    title: "Two Sum",
    problemUrl: "https://leetcode.com/problems/two-sum/",
    difficulty: "Easy",
    topic: "Array",
    mistakeType: "edge-cases",
    notes: "I missed duplicate values."
  });
  assert.equal(item.title, "Two Sum");
  assert.equal(item.problemUrl, "https://leetcode.com/problems/two-sum/");
  assert.equal(item.status, undefined);
  assert.equal(item.mistakeType, "edge-cases");
});

test("rejects invalid status and oversized notes during updates", () => {
  assert.throws(() => normalizeRevisionUpdate({ status: "unknown" }), { code: "INVALID_REVISION" });
  assert.throws(() => normalizeRevisionUpdate({ notes: "x".repeat(1001) }), { code: "INVALID_REVISION" });
});

test("marks mastered revisions with a review timestamp", () => {
  const update = normalizeRevisionUpdate({ status: "mastered" });
  assert.equal(update.status, "mastered");
  assert.ok(update.reviewedAt instanceof Date);
});
