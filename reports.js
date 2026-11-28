(() => {
  "use strict";
  const form = document.getElementById("report-form");
  const input = document.getElementById("report-username");
  const submit = document.getElementById("report-submit");
  const status = document.getElementById("report-status");
  const results = document.getElementById("report-results");
  let reportPayload = null;

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "report-status" + (kind ? " " + kind : "");
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = el("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    const text = String(value === null || value === undefined ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function buildCsv(payload) {
    const rows = [
      ["Section", "Metric", "Value"],
      ["Profile", "Username", payload.profile.username],
      ["Profile", "Fetched at", payload.profile.fetchedAt || ""],
      ["Problems", "Total solved", payload.profile.stats.totalSolved],
      ["Problems", "Easy solved", payload.profile.stats.solved.easy],
      ["Problems", "Medium solved", payload.profile.stats.solved.medium],
      ["Problems", "Hard solved", payload.profile.stats.solved.hard],
      ["Submissions", "Accepted submissions", payload.profile.stats.acceptedTotal],
      ["Submissions", "Total submissions", payload.profile.stats.submissionTotal],
      ["Submissions", "Acceptance rate", payload.profile.stats.acceptanceRate],
      ["Practice", "Readiness index", payload.insights.readiness.score],
      ["Practice", "Active days last 7", payload.insights.activity.last7.activeDays],
      ["Practice", "Active days last 30", payload.insights.activity.last30.activeDays],
      ["Practice", "Current streak", payload.insights.activity.currentStreak],
      ["History", "Snapshot count", payload.history.snapshots.length],
      ["History", "Solved change", payload.history.solvedChange],
      ["Projection", "Available", payload.history.prediction.available],
      ["Projection", "Average solved per day", payload.history.prediction.averageSolvedPerDay || ""],
      ["Projection", "Next milestone", payload.history.prediction.nextMilestone || ""],
      ["Projection", "Projected milestone date", payload.history.prediction.projectedDate || payload.history.prediction.reason]
    ];
    payload.insights.topics.lowerCoverageCandidates.forEach((topic) => rows.push(["Topic candidate", topic.name, topic.solved]));
    payload.history.snapshots.forEach((snapshot) => rows.push(["Snapshot", snapshot.dateKey, snapshot.totalSolved]));
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  function render(payload) {
    reportPayload = payload;
    results.hidden = false;
    document.getElementById("report-title").textContent = payload.profile.username + " · Progress report";
    document.getElementById("report-solved").textContent = payload.profile.stats.totalSolved.toLocaleString();
    document.getElementById("report-acceptance").textContent = payload.profile.stats.acceptanceRate.toFixed(1) + "%";
    document.getElementById("report-active").textContent = payload.insights.activity.last30.activeDays + " / 30";
    document.getElementById("report-index").textContent = payload.insights.readiness.score + " / 100";

    const difficulty = document.getElementById("report-difficulty");
    difficulty.replaceChildren();
    [["Easy", payload.profile.stats.solved.easy], ["Medium", payload.profile.stats.solved.medium], ["Hard", payload.profile.stats.solved.hard]].forEach(([label, value]) => {
      const row = el("div", "report-data-row");
      row.append(el("span", "", label), el("strong", "", Number(value).toLocaleString()));
      difficulty.append(row);
    });

    const history = document.getElementById("report-history");
    history.replaceChildren();
    if (!payload.history.snapshots.length) {
      history.append(el("p", "report-muted", "No saved history was available. Sign in, save your preferred username and use Save today's snapshot in your dashboard."));
      document.getElementById("report-history-summary").textContent = "Historical data is private and requires a signed-in account.";
    } else {
      const first = payload.history.snapshots[0];
      const last = payload.history.snapshots[payload.history.snapshots.length - 1];
      const change = payload.history.solvedChange;
      document.getElementById("report-history-summary").textContent =
        payload.history.snapshots.length + " saved snapshots · " + (change >= 0 ? "+" : "") + change + " solved since " + first.dateKey;
      payload.history.snapshots.slice(-8).reverse().forEach((item) => {
        const row = el("div", "report-data-row");
        row.append(el("span", "", item.dateKey), el("strong", "", Number(item.totalSolved).toLocaleString()));
        history.append(row);
      });
    }

    const projection = document.getElementById("report-projection");
    projection.replaceChildren();
    if (payload.history.prediction.available) {
      const prediction = payload.history.prediction;
      [
        ["Recent pace", prediction.averageSolvedPerDay + " solved / day"],
        ["Net growth", "+" + prediction.solvedGrowth + " in " + prediction.elapsedDays + " days"],
        ["Next milestone", prediction.nextMilestone.toLocaleString() + " solved"],
        ["Estimated date", prediction.projectedDate]
      ].forEach(([label, value]) => {
        const row = el("div", "report-data-row");
        row.append(el("span", "", label), el("strong", "", value));
        projection.append(row);
      });
    } else {
      projection.append(el("p", "report-muted", payload.history.prediction.reason));
    }

    const topics = document.getElementById("report-topics");
    topics.replaceChildren();
    if (!payload.insights.topics.lowerCoverageCandidates.length) {
      topics.append(el("p", "report-muted", "No public topic tag data was available."));
    } else {
      payload.insights.topics.lowerCoverageCandidates.forEach((topic) => {
        const row = el("div", "report-data-row");
        row.append(el("span", "", topic.name), el("strong", "", Number(topic.solved).toLocaleString()));
        topics.append(row);
      });
    }
    try { localStorage.setItem("leetmetric-last-username", payload.profile.username); } catch { /* Optional. */ }
  }

  async function makeReport(username) {
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) throw new Error("Enter a valid LeetCode username.");
    const response = await fetch("/api/leetcode/" + encodeURIComponent(username), {
      headers: { Accept: "application/json" }, credentials: "same-origin"
    });
    const profile = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(profile.error || "Unable to load this public profile.");
    const insights = window.LeetMetricIntelligence.analyzeProfile(profile);
    let snapshots = [];
    let historyUnavailable = false;
    try {
      const historyResponse = await fetch("/api/analytics/snapshots?username=" + encodeURIComponent(username), {
        headers: { Accept: "application/json" }, credentials: "same-origin"
      });
      const historyBody = await historyResponse.json().catch(() => ({}));
      if (historyResponse.ok) snapshots = Array.isArray(historyBody.snapshots) ? historyBody.snapshots : [];
      else historyUnavailable = true;
    } catch {
      historyUnavailable = true;
    }
    const orderedSnapshots = snapshots.slice().sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
    const solvedChange = orderedSnapshots.length > 1
      ? Number(orderedSnapshots[orderedSnapshots.length - 1].totalSolved) - Number(orderedSnapshots[0].totalSolved)
      : 0;
    const prediction = window.LeetMetricIntelligence.predictProgress(orderedSnapshots);
    return {
      generatedAt: new Date().toISOString(),
      profile,
      insights,
      history: { snapshots: orderedSnapshots, solvedChange, prediction, unavailable: historyUnavailable }
    };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = input.value.trim();
    submit.disabled = true;
    submit.textContent = "Building…";
    results.hidden = true;
    setStatus("Fetching profile metrics and private history where available…");
    try {
      const payload = await makeReport(username);
      render(payload);
      setStatus(payload.history.unavailable
        ? "Report generated. Sign in with the profile owner account to include private snapshots."
        : "Report generated successfully.", "success");
    } catch (error) {
      setStatus(error.message || "Unable to generate the report.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Build report →";
    }
  });

  document.getElementById("report-json").addEventListener("click", () => {
    if (!reportPayload) return;
    download("leetmetric-" + reportPayload.profile.username + "-report.json", JSON.stringify(reportPayload, null, 2), "application/json");
  });
  document.getElementById("report-csv").addEventListener("click", () => {
    if (!reportPayload) return;
    download("leetmetric-" + reportPayload.profile.username + "-report.csv", "\uFEFF" + buildCsv(reportPayload), "text/csv;charset=utf-8");
  });
  document.getElementById("report-print").addEventListener("click", () => {
    if (reportPayload) window.print();
  });

  const queryUsername = new URLSearchParams(window.location.search).get("username");
  if (queryUsername) input.value = queryUsername;
  else {
    try { input.value = localStorage.getItem("leetmetric-last-username") || ""; } catch { /* Optional. */ }
  }
})();
