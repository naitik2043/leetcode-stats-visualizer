(() => {
  const form = document.getElementById("compare-form");
  const inputA = document.getElementById("compare-user-a");
  const inputB = document.getElementById("compare-user-b");
  const button = document.getElementById("compare-submit");
  const status = document.getElementById("compare-status");
  const results = document.getElementById("comparison-results");
  const body = document.getElementById("comparison-rows");
  const topicBody = document.getElementById("topic-comparison-rows");
  const activityBody = document.getElementById("activity-comparison-rows");
  let currentComparison = null;

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "status-message" + (kind ? " " + kind : "");
  }

  async function fetchProfile(username) {
    const response = await fetch("/api/leetcode/" + encodeURIComponent(username), {
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || ("Unable to load @" + username + "."));
    if (!payload.stats) throw new Error("The profile response for @" + username + " was incomplete.");
    return payload;
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function appendRow(label, valueA, valueB, percent) {
    const row = document.createElement("tr");
    const name = document.createElement("td");
    const a = document.createElement("td");
    const b = document.createElement("td");
    const difference = document.createElement("td");
    name.textContent = label;
    a.textContent = percent ? number(valueA).toFixed(1) + "%" : number(valueA).toLocaleString();
    b.textContent = percent ? number(valueB).toFixed(1) + "%" : number(valueB).toLocaleString();
    const missingA = valueA === null || valueA === undefined;
    const missingB = valueB === null || valueB === undefined;
    if (missingA || missingB) {
      a.textContent = missingA ? "—" : (percent ? number(valueA).toFixed(1) + "%" : number(valueA).toLocaleString());
      b.textContent = missingB ? "—" : (percent ? number(valueB).toFixed(1) + "%" : number(valueB).toLocaleString());
      difference.textContent = "—";
    } else {
      const delta = number(valueA) - number(valueB);
      difference.textContent = (delta > 0 ? "+" : "") + (percent ? delta.toFixed(1) + " pp" : delta.toLocaleString());
    }
    row.append(name, a, b, difference);
    body.append(row);
  }

  function appendCustomRow(host, label, valueA, valueB) {
    const row = document.createElement("tr");
    [label, valueA, valueB].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
      row.append(cell);
    });
    host.append(row);
  }

  function renderTopics(nameA, dataA, nameB, dataB) {
    topicBody.replaceChildren();
    document.getElementById("topic-name-a").textContent = "@" + nameA;
    document.getElementById("topic-name-b").textContent = "@" + nameB;
    const map = new Map();
    [dataA, dataB].forEach((profile, profileIndex) => {
      (Array.isArray(profile.topics) ? profile.topics : []).forEach((topic) => {
        const key = String(topic.slug || topic.name || "").toLowerCase();
        if (!key) return;
        if (!map.has(key)) map.set(key, { name: topic.name || key, a: null, b: null });
        map.get(key)[profileIndex === 0 ? "a" : "b"] = number(topic.solved);
      });
    });
    const rows = Array.from(map.values()).sort((left, right) =>
      ((right.a || 0) + (right.b || 0)) - ((left.a || 0) + (left.b || 0))
    ).slice(0, 12);
    document.getElementById("topic-comparison-empty").hidden = rows.length > 0;
    rows.forEach((item) => appendCustomRow(topicBody, item.name, item.a === null ? null : item.a.toLocaleString(), item.b === null ? null : item.b.toLocaleString()));
  }

  function renderActivity(nameA, dataA, nameB, dataB) {
    activityBody.replaceChildren();
    document.getElementById("activity-name-a").textContent = "@" + nameA;
    document.getElementById("activity-name-b").textContent = "@" + nameB;
    const now = new Date();
    const a7 = window.LeetMetricIntelligence.activityWindow(dataA.activity && dataA.activity.daily, 7, now);
    const b7 = window.LeetMetricIntelligence.activityWindow(dataB.activity && dataB.activity.daily, 7, now);
    const a30 = window.LeetMetricIntelligence.activityWindow(dataA.activity && dataA.activity.daily, 30, now);
    const b30 = window.LeetMetricIntelligence.activityWindow(dataB.activity && dataB.activity.daily, 30, now);
    const rows = [
      ["Active days · last 7", a7.activeDays, b7.activeDays],
      ["Submissions · last 7", a7.submissions, b7.submissions],
      ["Active days · last 30", a30.activeDays, b30.activeDays],
      ["Current streak", number(dataA.activity && dataA.activity.currentStreak), number(dataB.activity && dataB.activity.currentStreak)],
      ["Peak contest rating", dataA.contest && dataA.contest.maxRating, dataB.contest && dataB.contest.maxRating],
      ["Contest top percentage", dataA.contest && dataA.contest.topPercentage !== null ? dataA.contest.topPercentage + "%" : null, dataB.contest && dataB.contest.topPercentage !== null ? dataB.contest.topPercentage + "%" : null]
    ];
    rows.forEach((row) => appendCustomRow(activityBody, row[0], row[1], row[2]));
  }

  function render(nameA, dataA, nameB, dataB) {
    const statsA = dataA.stats;
    const statsB = dataB.stats;
    const solvedA = statsA.solved || {};
    const solvedB = statsB.solved || {};
    currentComparison = { nameA, dataA, nameB, dataB };

    document.getElementById("profile-a-name").textContent = "@" + nameA;
    document.getElementById("profile-b-name").textContent = "@" + nameB;
    document.getElementById("profile-a-solved").textContent = number(statsA.totalSolved).toLocaleString();
    document.getElementById("profile-b-solved").textContent = number(statsB.totalSolved).toLocaleString();
    document.getElementById("table-name-a").textContent = "@" + nameA;
    document.getElementById("table-name-b").textContent = "@" + nameB;
    document.getElementById("comparison-time").textContent = "Fetched " + new Date().toLocaleString();

    body.replaceChildren();
    appendRow("Total problems solved", statsA.totalSolved, statsB.totalSolved, false);
    appendRow("Easy solved", solvedA.easy, solvedB.easy, false);
    appendRow("Medium solved", solvedA.medium, solvedB.medium, false);
    appendRow("Hard solved", solvedA.hard, solvedB.hard, false);
    appendRow("Accepted submissions", statsA.acceptedTotal, statsB.acceptedTotal, false);
    appendRow("Total submissions", statsA.submissionTotal, statsB.submissionTotal, false);
    appendRow("Acceptance rate", statsA.acceptanceRate, statsB.acceptanceRate, true);
    appendRow("LeetCode global rank", dataA.profile && dataA.profile.ranking || null, dataB.profile && dataB.profile.ranking || null, false);
    appendRow("Current contest rating", dataA.contest && dataA.contest.rating, dataB.contest && dataB.contest.rating, false);
    appendRow("Peak contest rating", dataA.contest && dataA.contest.maxRating, dataB.contest && dataB.contest.maxRating, false);
    appendRow("Contests attended", dataA.contest && dataA.contest.attendedContestsCount, dataB.contest && dataB.contest.attendedContestsCount, false);
    renderTopics(nameA, dataA, nameB, dataB);
    renderActivity(nameA, dataA, nameB, dataB);

    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("comparison-copy-link").addEventListener("click", async () => {
    if (!currentComparison) return;
    const url = new URL(window.location.href);
    url.searchParams.set("a", currentComparison.nameA);
    url.searchParams.set("b", currentComparison.nameB);
    try {
      await navigator.clipboard.writeText(url.toString());
      setStatus("A shareable comparison link was copied.", "success");
    } catch {
      setStatus("Clipboard access is unavailable in this browser. Copy the page URL after comparing.", "error");
    }
  });

  document.getElementById("comparison-export").addEventListener("click", () => {
    if (!currentComparison) return;
    const rows = [["Metric", currentComparison.nameA, currentComparison.nameB]];
    body.querySelectorAll("tr").forEach((row) => rows.push(Array.from(row.cells).slice(0, 3).map((cell) => cell.textContent)));
    topicBody.querySelectorAll("tr").forEach((row) => rows.push(["Topic: " + row.cells[0].textContent, row.cells[1].textContent, row.cells[2].textContent]));
    activityBody.querySelectorAll("tr").forEach((row) => rows.push(["Activity: " + row.cells[0].textContent, row.cells[1].textContent, row.cells[2].textContent]));
    const csv = rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leetmetric-comparison-" + currentComparison.nameA + "-vs-" + currentComparison.nameB + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const a = inputA.value.trim();
    const b = inputB.value.trim();
    const pattern = /^[a-zA-Z0-9_-]{1,30}$/;

    if (!pattern.test(a) || !pattern.test(b)) {
      setStatus("Enter two valid usernames using letters, numbers, underscores or hyphens.", "error");
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setStatus("Enter two different LeetCode usernames to compare.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Loading profiles…";
    setStatus("Fetching both public profiles. This can take a few seconds.", "");
    results.hidden = true;
    try {
      const profiles = await Promise.all([fetchProfile(a), fetchProfile(b)]);
      render(a, profiles[0], b, profiles[1]);
      setStatus("Both public profiles were loaded successfully.", "success");
    } catch (error) {
      setStatus(error.message || "Unable to compare these profiles right now.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Compare profiles →";
    }
  });
  const query = new URLSearchParams(window.location.search);
  if (query.get("a")) inputA.value = query.get("a");
  if (query.get("b")) inputB.value = query.get("b");
  if (query.get("a") && query.get("b")) form.requestSubmit();
})();
