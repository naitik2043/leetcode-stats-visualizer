(() => {
  "use strict";

  const form = document.getElementById("intelligence-lookup");
  const input = document.getElementById("intel-username");
  const button = document.getElementById("intel-submit");
  const status = document.getElementById("intel-status");
  const results = document.getElementById("intel-results");
  const number = (value) => Number(value || 0).toLocaleString();
  let mistakeRequestId = 0;

  function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "intel-status" + (kind ? " " + kind : "");
  }

  function render(report, profile) {
    results.hidden = false;
    document.getElementById("intel-profile-title").textContent = (report.username || profile.username) + " · Performance overview";
    document.getElementById("intel-fetched-at").textContent = profile.fetchedAt
      ? "UPDATED " + new Date(profile.fetchedAt).toLocaleString()
      : "PUBLIC PROFILE DATA";
    document.getElementById("intel-score").textContent = report.readiness.score;
    document.getElementById("intel-score-label").textContent = report.readiness.label;
    document.getElementById("intel-score-fill").style.width = report.readiness.score + "%";
    document.getElementById("intel-active-days").textContent = report.activity.last30.activeDays + " / 30";
    document.getElementById("intel-week-days").textContent = report.activity.last7.activeDays + " / 7";
    document.getElementById("intel-week-submissions").textContent = number(report.activity.last7.submissions);
    document.getElementById("intel-streak").textContent = number(report.activity.currentStreak) + " days";
    document.getElementById("intel-solved-total").textContent = number(report.totals.solved);
    document.getElementById("intel-easy").textContent = number(report.totals.easy);
    document.getElementById("intel-medium").textContent = number(report.totals.medium);
    document.getElementById("intel-hard").textContent = number(report.totals.hard);

    const recommendationHost = document.getElementById("intel-recommendations");
    recommendationHost.replaceChildren();
    report.recommendations.forEach((item, index) => {
      const card = node("article", "intel-recommendation");
      card.append(node("span", "intel-recommendation-index", String(index + 1).padStart(2, "0")));
      const content = node("div", "intel-recommendation-copy");
      content.append(node("h3", "", item.title), node("p", "", item.detail), node("small", "", "Signal: " + item.evidence));
      card.append(content);
      recommendationHost.append(card);
    });

    const topicHost = document.getElementById("intel-topics");
    topicHost.replaceChildren();
    if (!report.topics.lowerCoverageCandidates.length) {
      topicHost.append(node("p", "intel-empty", "No usable topic tag data was returned for this profile."));
    } else {
      report.topics.lowerCoverageCandidates.forEach((topic) => {
        const row = node("div", "intel-topic-row");
        const title = node("div", "intel-topic-title");
        title.append(node("span", "", topic.name), node("strong", "", number(topic.solved)));
        row.append(title, node("small", "", topic.level + " · lower recorded count"));
        topicHost.append(row);
      });
    }

    const components = document.getElementById("intel-components");
    components.replaceChildren();
    report.readiness.components.forEach((item) => {
      const row = node("div", "intel-component");
      const title = node("div", "intel-component-title");
      title.append(node("span", "", item.label), node("strong", "", Math.round(item.score) + "%"));
      const track = node("div", "intel-component-track");
      const fill = node("span");
      fill.style.width = item.score + "%";
      track.append(fill);
      row.append(title, track);
      components.append(row);
    });
    document.getElementById("intel-methodology").textContent = report.readiness.methodology;

    const notes = document.getElementById("intel-notes");
    notes.replaceChildren();
    report.dataNotes.forEach((item) => notes.append(node("li", "", item)));
    const params = new URLSearchParams(window.location.search);
    params.set("username", report.username);
    window.history.replaceState({}, "", window.location.pathname + "?" + params.toString());
    try { localStorage.setItem("leetmetric-last-username", report.username); } catch { /* Storage is optional. */ }
    loadMistakePatterns();
  }

  async function loadMistakePatterns() {
    const requestId = ++mistakeRequestId;
    const statusNode = document.getElementById("intel-mistake-status");
    const content = document.getElementById("intel-mistake-content");
    const types = document.getElementById("intel-mistake-types");
    if (!statusNode || !content || !types) return;
    content.hidden = true;
    statusNode.textContent = "Loading private revision patterns…";
    try {
      const response = await fetch("/api/revisions", {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== mistakeRequestId) return;
      if (response.status === 401 || response.status === 409) {
        statusNode.textContent = "Sign in and save your preferred LeetCode username to analyze your private revision queue.";
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Unable to load revision insights.");
      const summary = window.LeetMetricIntelligence.summarizeMistakes(payload.revisions || []);
      if (!summary.total) {
        statusNode.textContent = "Your revision queue is empty. Add problems and record why you want to revisit them to build mistake-pattern insights.";
        return;
      }
      statusNode.textContent = "Aggregated from your private revision items. These counts reflect what you recorded, not every submission you made.";
      content.hidden = false;
      document.getElementById("intel-mistake-total").textContent = number(summary.total);
      document.getElementById("intel-mistake-open").textContent = number(summary.open);
      document.getElementById("intel-mistake-mastered").textContent = number(summary.mastered);
      types.replaceChildren();
      summary.byType.forEach((item) => {
        const row = node("div", "intel-mistake-type");
        const heading = node("div", "intel-mistake-type-heading");
        heading.append(node("span", "", item.type.replace(/-/g, " ")), node("strong", "", number(item.count)));
        const track = node("div", "intel-component-track");
        const fill = node("span");
        fill.style.width = Math.round((item.count / summary.total) * 100) + "%";
        track.append(fill);
        row.append(heading, track);
        types.append(row);
      });
    } catch (error) {
      if (requestId !== mistakeRequestId) return;
      statusNode.textContent = error.message || "Revision insights are temporarily unavailable.";
    }
  }

  async function analyze(username) {
    const normalized = String(username || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(normalized)) {
      setStatus("Enter a valid LeetCode username using letters, numbers, underscores or hyphens.", "error");
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = "Analyzing…";
    results.hidden = true;
    setStatus("Fetching public profile statistics and analyzing available signals…");
    try {
      const response = await fetch("/api/leetcode/" + encodeURIComponent(normalized), {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      const profile = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(profile.error || "Unable to load this LeetCode profile.");
      const report = window.LeetMetricIntelligence.analyzeProfile(profile);
      render(report, profile);
      setStatus("Analysis ready. Suggestions are based on the data returned for this profile.", "success");
    } catch (error) {
      setStatus(error.message || "A network error occurred. Please try again.", "error");
    } finally {
      button.disabled = false;
      button.innerHTML = 'Analyze profile <span aria-hidden="true">→</span>';
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    analyze(input.value);
  });

  const initial = new URLSearchParams(window.location.search).get("username");
  if (initial) {
    input.value = initial;
    analyze(initial);
  } else {
    try { input.value = localStorage.getItem("leetmetric-last-username") || ""; } catch { /* Storage is optional. */ }
  }
})();
