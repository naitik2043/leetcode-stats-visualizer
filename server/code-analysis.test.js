const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeCode } = require("../code-analysis");

test("rejects empty snippets and unsupported languages", () => {
  assert.match(analyzeCode("  ", "cpp").error, /Paste a code snippet/);
  assert.match(analyzeCode("int main() {}", "ruby").error, /supported programming language/);
});

test("detects nested C++ loops as a likely quadratic pattern", () => {
  const result = analyzeCode("for (int i=0; i<n; i++) { for (int j=0; j<n; j++) { work(); } }", "cpp");
  assert.equal(result.detected.loopDepth, 2);
  assert.equal(result.timeComplexity, "O(n^2) likely");
  assert.ok(result.findings.some((item) => /Nested iteration/.test(item.title)));
});

test("detects Python loop nesting using indentation", () => {
  const result = analyzeCode("for i in range(n):\n    for j in range(n):\n        print(i, j)", "python");
  assert.equal(result.detected.loopDepth, 2);
  assert.equal(result.timeComplexity, "O(n^2) likely");
});

test("recognizes sorting and dynamic collection signals", () => {
  const result = analyzeCode("vector<int> values; sort(values.begin(), values.end());", "cpp");
  assert.equal(result.detected.sorting, true);
  assert.equal(result.detected.dynamicCollection, true);
  assert.equal(result.timeComplexity, "O(n log n) likely");
  assert.equal(result.spaceComplexity, "O(n) possible");
});

test("does not present heuristic feedback as executed verification", () => {
  const result = analyzeCode("function solve(nums) { return nums.length; }", "javascript");
  assert.match(result.disclaimer, /does not compile, execute or prove/);
  assert.ok(result.findings.some((item) => /Validate edge cases/.test(item.title)));
});

test("enforces an input-size limit", () => {
  const result = analyzeCode("x".repeat(30001), "python");
  assert.match(result.error, /30,000 characters/);
});
