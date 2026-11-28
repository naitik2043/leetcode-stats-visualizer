(() => {
  "use strict";
  const form = document.getElementById("code-review-form");
  const source = document.getElementById("code-source");
  const language = document.getElementById("code-language");
  const count = document.getElementById("code-character-count");
  const results = document.getElementById("code-review-results");
  const status = document.getElementById("code-review-status");

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function render(result) {
    results.hidden = false;
    document.getElementById("code-time").textContent = result.timeComplexity;
    document.getElementById("code-time-reason").textContent = result.timeReason;
    document.getElementById("code-space").textContent = result.spaceComplexity;
    document.getElementById("code-space-reason").textContent = result.spaceReason;

    const signals = document.getElementById("code-signals");
    signals.replaceChildren();
    const signalLabels = [
      ["loopDepth", "Loop nesting", (value) => value ? value + " level(s)" : "Not detected"],
      ["sorting", "Sorting call", (value) => value ? "Detected" : "Not detected"],
      ["hashStructure", "Map / set", (value) => value ? "Detected" : "Not detected"],
      ["dynamicCollection", "Dynamic collection", (value) => value ? "Detected" : "Not detected"],
      ["possibleRecursion", "Possible recursion", (value) => value ? "Detected" : "Not detected"]
    ];
    signalLabels.forEach(([key, label, format]) => {
      const chip = el("span", result.detected[key] ? "code-signal active" : "code-signal", label + ": " + format(result.detected[key]));
      signals.append(chip);
    });

    const findings = document.getElementById("code-findings-list");
    findings.replaceChildren();
    result.findings.forEach((finding) => {
      const card = el("article", "code-finding " + finding.severity);
      card.append(el("h4", "", finding.title), el("p", "", finding.detail));
      findings.append(card);
    });
    document.getElementById("code-disclaimer").textContent = result.disclaimer;
  }

  source.addEventListener("input", () => {
    count.textContent = source.value.length.toLocaleString() + " / 30,000 characters";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = window.LeetMetricCodeAnalysis.analyzeCode(source.value, language.value);
    if (result.error) {
      status.textContent = result.error;
      status.className = "code-review-status error";
      results.hidden = true;
      return;
    }
    render(result);
    status.textContent = "Heuristic review completed for " + language.options[language.selectedIndex].text + ". No code was executed.";
    status.className = "code-review-status success";
  });
})();
