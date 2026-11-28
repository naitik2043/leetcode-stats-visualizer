(function attachCodeAnalysis(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LeetMetricCodeAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCodeAnalysis() {
  "use strict";

  const MAX_SOURCE_LENGTH = 30000;
  const LOOP_PATTERN = /\b(?:for|while)\s*(?:\([^)]*\)|[^\n:]+:)/g;
  const HASH_PATTERN = /\b(?:unordered_map|unordered_set|map|set|HashMap|HashSet|TreeMap|TreeSet|dict|set)\b|\bnew\s+(?:Map|Set)\s*</i;
  const ARRAY_PATTERN = /\b(?:vector|ArrayList|LinkedList|Array|list|append|push_back|push)\b|\[\s*\]/i;
  const SORT_PATTERN = /\b(?:sort|sorted|stable_sort)\s*\(|(?:Arrays|Collections)\.sort\s*\(/i;

  function countPythonLoopDepth(source) {
    const stack = [];
    let maximum = 0;
    source.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^(\s*)(?:for|while)\b.*:\s*$/);
      if (!match) return;
      const indent = match[1].replace(/\t/g, "    ").length;
      while (stack.length && stack[stack.length - 1] >= indent) stack.pop();
      stack.push(indent);
      maximum = Math.max(maximum, stack.length);
    });
    return maximum;
  }

  function matchingBrace(source, openIndex) {
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  function countBraceLoopDepth(source) {
    const loops = [];
    let match;
    LOOP_PATTERN.lastIndex = 0;
    while ((match = LOOP_PATTERN.exec(source)) !== null) loops.push(match.index);
    if (!loops.length) return 0;

    function depthWithin(start, end) {
      let max = 0;
      for (const loopIndex of loops) {
        if (loopIndex < start || loopIndex >= end) continue;
        const open = source.indexOf("{", loopIndex);
        if (open < 0 || open >= end) {
          max = Math.max(max, 1);
          continue;
        }
        const close = matchingBrace(source, open);
        if (close < 0 || close > end) {
          max = Math.max(max, 1);
          continue;
        }
        max = Math.max(max, 1 + depthWithin(open + 1, close));
      }
      return max;
    }

    return depthWithin(0, source.length);
  }

  function analyzeCode(source, language) {
    if (typeof source !== "string" || !source.trim()) {
      return { error: "Paste a code snippet before running the analysis." };
    }
    if (source.length > MAX_SOURCE_LENGTH) {
      return { error: "Keep the snippet under 30,000 characters for this browser-based analysis." };
    }
    const supported = ["cpp", "java", "python", "javascript", "c"];
    if (!supported.includes(language)) {
      return { error: "Choose a supported programming language." };
    }

    const isPython = language === "python";
    const loopDepth = isPython ? countPythonLoopDepth(source) : countBraceLoopDepth(source);
    const hasSort = SORT_PATTERN.test(source);
    const hasHashStructure = HASH_PATTERN.test(source);
    const hasDynamicArray = ARRAY_PATTERN.test(source);
    const hasRecursionSignal = /\breturn\s+[A-Za-z_$][\w$]*\s*\(/.test(source) ||
      /\b[A-Za-z_$][\w$]*\s*\([^;]*\)\s*;\s*\/\/\s*recursive/i.test(source);

    let timeComplexity = "O(1) likely";
    let timeReason = "No loop or sorting pattern was detected. Helper functions and library calls may still change the actual complexity.";
    if (loopDepth >= 2) {
      timeComplexity = "O(n^" + loopDepth + ") likely";
      timeReason = "The heuristic found nested loop structure. The real bound depends on loop limits and early exits.";
    } else if (loopDepth === 1 && hasSort) {
      timeComplexity = "O(n log n) to O(n²) likely";
      timeReason = "A loop and a sorting operation were both detected; their order and input sizes determine the dominant cost.";
    } else if (loopDepth === 1) {
      timeComplexity = "O(n) likely";
      timeReason = "A loop was detected. Its iteration count may or may not be linear in the input size.";
    } else if (hasSort) {
      timeComplexity = "O(n log n) likely";
      timeReason = "A sorting call was detected. The bound depends on the language runtime and comparator.";
    } else if (hasRecursionSignal) {
      timeComplexity = "Not inferable from this snippet";
      timeReason = "A possible recursive call was detected, but the recurrence and input reduction cannot be proven with pattern matching.";
    }

    let spaceComplexity = "O(1) likely";
    let spaceReason = "No obvious auxiliary collection was detected. Hidden allocations and helper functions are not fully analyzed.";
    if (hasHashStructure || hasDynamicArray) {
      spaceComplexity = "O(n) possible";
      spaceReason = "A map, set, or dynamic collection was detected. Confirm whether it grows with the input.";
    } else if (hasRecursionSignal) {
      spaceComplexity = "O(depth) possible";
      spaceReason = "Recursive calls may add stack space proportional to recursion depth.";
    }

    const findings = [];
    if (loopDepth >= 2) findings.push({
      severity: "review",
      title: "Nested iteration detected",
      detail: "Check whether repeated scans can be replaced with a hash lookup, two-pointer technique, prefix computation or sorting."
    });
    if (hasSort) findings.push({
      severity: "info",
      title: "Sorting call detected",
      detail: "Include sorting in the end-to-end complexity and verify that sorting is necessary for the required output."
    });
    if (hasHashStructure) findings.push({
      severity: "info",
      title: "Hash or ordered collection detected",
      detail: "Account for auxiliary memory and expected lookup complexity. Ordered maps and hash maps have different trade-offs."
    });
    if (hasRecursionSignal) findings.push({
      severity: "review",
      title: "Possible recursion",
      detail: "Verify base cases, progress toward termination and maximum recursion depth."
    });
    findings.push({
      severity: "check",
      title: "Validate edge cases",
      detail: "Test empty input, a single element, duplicates, already sorted data, reverse order and boundary values where relevant."
    });
    findings.push({
      severity: "check",
      title: "Verify correctness with tests",
      detail: "Run the solution against examples and adversarial cases. This tool does not compile, execute or prove the submitted code."
    });

    return {
      language,
      timeComplexity,
      timeReason,
      spaceComplexity,
      spaceReason,
      detected: {
        loopDepth,
        sorting: hasSort,
        hashStructure: hasHashStructure,
        dynamicCollection: hasDynamicArray,
        possibleRecursion: hasRecursionSignal
      },
      findings,
      disclaimer: "Static heuristic only. This is not an AST-based compiler, runtime benchmark, correctness proof or AI review. Verify the result with language-specific tests and profiling."
    };
  }

  return { analyzeCode, MAX_SOURCE_LENGTH };
});
