(() => {
  const form = document.getElementById("compare-form");
  const inputA = document.getElementById("compare-user-a");
  const inputB = document.getElementById("compare-user-b");
  const button = document.getElementById("compare-submit");
  const status = document.getElementById("compare-status");
  const results = document.getElementById("comparison-results");
  const body = document.getElementById("comparison-rows");

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

  function render(nameA, dataA, nameB, dataB) {
    const statsA = dataA.stats;
    const statsB = dataB.stats;
    const solvedA = statsA.solved || {};
    const solvedB = statsB.solved || {};

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
    appendRow("Contest rating", dataA.contest && dataA.contest.rating, dataB.contest && dataB.contest.rating, false);
    appendRow("Contests attended", dataA.contest && dataA.contest.attendedContestsCount, dataB.contest && dataB.contest.attendedContestsCount, false);

    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
})();
