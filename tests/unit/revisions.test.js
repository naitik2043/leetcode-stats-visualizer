const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeProblemUrl,
  normalizeRevisionCreate,
  normalizeRevisionUpdate
} = require("../../server/revisions");

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

test("normalizes optional user-recorded attempts and time spent", () => {
  const item = normalizeRevisionCreate({
    title: "Coin Change",
    difficulty: "Medium",
    attemptsBeforeAccepted: "3",
    timeSpentMinutes: "24"
  });
  assert.equal(item.attemptsBeforeAccepted, 3);
  assert.equal(item.timeSpentMinutes, 24);
});

test("rejects invalid attempt and duration values on create or update", () => {
  assert.throws(() => normalizeRevisionCreate({
    title: "Bad attempts", difficulty: "Easy", attemptsBeforeAccepted: "0"
  }), { code: "INVALID_REVISION" });
  assert.throws(() => normalizeRevisionCreate({
    title: "Too long", difficulty: "Hard", timeSpentMinutes: "601"
  }), { code: "INVALID_REVISION" });
  assert.throws(() => normalizeRevisionUpdate({ attemptsBeforeAccepted: "1.5" }), { code: "INVALID_REVISION" });
  assert.throws(() => normalizeRevisionUpdate({ timeSpentMinutes: "-1" }), { code: "INVALID_REVISION" });
});

test("allows clearing previously recorded attempt and time fields", () => {
  const update = normalizeRevisionUpdate({ attemptsBeforeAccepted: "", timeSpentMinutes: null });
  assert.equal(update.attemptsBeforeAccepted, null);
  assert.equal(update.timeSpentMinutes, null);
});
