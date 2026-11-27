const API_BASE = (window.LEETMETRIC_CONFIG && window.LEETMETRIC_CONFIG.apiBase) || "/api";
const $ = (selector) => document.querySelector(selector);
const form = $("#lookup");
const input = $("#user-input");
const searchButton = $("#search-btn");
const statusBox = $("#status");
const copyButton = $("#copy-link");
let activeUsername = "";
let requestSequence = 0;

const yearElement = $("#year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

function setStatus(message, kind = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `status-message ${kind}`.trim();
  statusBox.setAttribute("data-state", kind || "idle");
}

function setMetric(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function formatNumber(value) {
  return safeCount(value).toLocaleString();
}

function setProgress(labelId, barId, solved, total) {
  const safeTotal = safeCount(total);
  const safeSolved = safeCount(solved);
  const percentage = safeTotal > 0 ? Math.min(100, (safeSolved / safeTotal) * 100) : 0;

  setMetric(labelId, `${formatNumber(safeSolved)} / ${formatNumber(safeTotal)}`);
  const bar = document.getElementById(barId);
  if (!bar) return;

  bar.style.width = `${percentage.toFixed(2)}%`;
  const progressTrack = bar.closest('[role="progressbar"]');
  if (progressTrack) progressTrack.setAttribute("aria-valuenow", String(Math.round(percentage)));
}

function renderSubmissionBreakdown(rows) {
  const container = $("#submission-breakdown");
  if (!container) return;

  const fragment = document.createDocumentFragment();
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "submission-line";

    const name = document.createElement("span");
    name.textContent = label;

    const count = document.createElement("strong");
    count.textContent = formatNumber(value);

    row.append(name, count);
    fragment.append(row);
  });

  container.replaceChildren(fragment);
}

function renderDifficultyChart(solved, solvedTotal) {
  const chart = $("#difficulty-chart");
  if (!chart) return;

  const easy = safeCount(solved.easy);
  const medium = safeCount(solved.medium);
  const hard = safeCount(solved.hard);

  if (solvedTotal > 0) {
    const easyEnd = (easy / solvedTotal) * 360;
    const mediumEnd = ((easy + medium) / solvedTotal) * 360;
    chart.style.background = `conic-gradient(
      var(--easy) 0deg ${easyEnd}deg,
      var(--medium) ${easyEnd}deg ${mediumEnd}deg,
      var(--hard) ${mediumEnd}deg 360deg
    )`;
  } else {
    chart.style.background = "conic-gradient(var(--surface-inset) 0deg 360deg)";
  }

  chart.setAttribute(
    "aria-label",
    `Difficulty distribution: ${easy} Easy, ${medium} Medium and ${hard} Hard problems solved.`
  );
  setMetric("donut-total", formatNumber(solvedTotal));
  setMetric("easy-legend", formatNumber(easy));
  setMetric("medium-legend", formatNumber(medium));
  setMetric("hard-legend", formatNumber(hard));
}

function renderStats(data, username) {
  const stats = data?.stats || data || {};
  const solved = stats.solved || {};
  const totals = stats.totalQuestions || {};
  const accepted = stats.acceptedSubmissions || {};
  const submissions = stats.totalSubmissions || {};

  const easy = safeCount(solved.easy);
  const medium = safeCount(solved.medium);
  const hard = safeCount(solved.hard);
  const solvedTotal = safeCount(stats.totalSolved ?? (easy + medium + hard));
  const acceptedTotal = safeCount(stats.acceptedTotal ?? accepted.all ?? (easy + medium + hard));
  const submissionTotal = safeCount(stats.submissionTotal ?? submissions.all);
  const derivedRate = submissionTotal > 0 ? (acceptedTotal / submissionTotal) * 100 : 0;
  const reportedRate = Number(stats.acceptanceRate);
  const acceptanceRate = Number.isFinite(reportedRate) ? reportedRate : derivedRate;
  const totalQuestionCount = safeCount(totals.easy) + safeCount(totals.medium) + safeCount(totals.hard);
  const coverage = totalQuestionCount > 0 ? (solvedTotal / totalQuestionCount) * 100 : null;

  setMetric("total-solved", formatNumber(solvedTotal));
  setMetric("accepted-count", formatNumber(acceptedTotal));
  setMetric("submission-count", formatNumber(submissionTotal));
  setMetric("acceptance-rate", `${Math.max(0, Math.min(100, acceptanceRate)).toFixed(1)}%`);
  setMetric("overall-coverage", coverage === null ? "Not available" : `${coverage.toFixed(1)}%`);
  setMetric("leetcode-ranking", data?.profile?.ranking ? formatNumber(data.profile.ranking) : "Not available");

  setProgress("easy-label", "easy-bar", easy, totals.easy);
  setProgress("medium-label", "medium-bar", medium, totals.medium);
  setProgress("hard-label", "hard-bar", hard, totals.hard);
  renderDifficultyChart({ easy, medium, hard }, solvedTotal);

  renderSubmissionBreakdown([
    ["Easy accepted", accepted.easy],
    ["Medium accepted", accepted.medium],
    ["Hard accepted", accepted.hard],
    ["Easy submissions", submissions.easy],
    ["Medium submissions", submissions.medium],
    ["Hard submissions", submissions.hard]
  ]);

  setMetric("profile-caption", `A public LeetCode profile snapshot for @${username}.`);
  const updatedAt = data?.fetchedAt ? new Date(data.fetchedAt) : new Date();
  setMetric("last-updated", Number.isNaN(updatedAt.getTime()) ? "Just now" : updatedAt.toLocaleString());
  const leetcodeLink = $("#leetcode-link");
  if (leetcodeLink) leetcodeLink.href = `https://leetcode.com/u/${encodeURIComponent(username)}/`;

  activeUsername = username;
  if (copyButton) copyButton.disabled = false;
}

async function fetchStats(username) {
  const response = await fetch(`${API_BASE}/leetcode/${encodeURIComponent(username)}`, {
    headers: { Accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || (response.status === 404
      ? "That public LeetCode profile could not be found."
      : "Unable to retrieve profile statistics. Please try again."));
  }

  if (!payload || typeof payload !== "object" || !payload.stats) {
    throw new Error("LeetCode returned an unexpected profile response. Please try again.");
  }

  return payload;
}

if (form && input && searchButton && statusBox) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = input.value.trim();

    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
      setStatus("Enter a valid LeetCode username (letters, numbers, underscores or hyphens).", "error");
      input.focus();
      return;
    }

    const requestId = ++requestSequence;
    searchButton.disabled = true;
    searchButton.textContent = "Loading…";
    document.body.classList.add("loading");
    setStatus(`Fetching public stats for @${username}…`);

    try {
      const data = await fetchStats(username);
      if (requestId !== requestSequence) return;

      renderStats(data, username);
      document.dispatchEvent(new CustomEvent("leetmetric:profile-loaded", {
        detail: { username, data }
      }));
      setStatus("Profile statistics loaded successfully.", "success");

      const analytics = $("#analytics") || $("#insights");
      if (analytics) analytics.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (requestId !== requestSequence) return;
      setStatus(error.message || "Something went wrong. Please try again later.", "error");
    } finally {
      if (requestId === requestSequence) {
        searchButton.disabled = false;
        searchButton.textContent = "View stats →";
        document.body.classList.remove("loading");
      }
    }
  });
}

if (copyButton) {
  copyButton.addEventListener("click", async () => {
    if (!activeUsername) return;

    const profileUrl = `https://leetcode.com/u/${encodeURIComponent(activeUsername)}/`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setStatus("LeetCode profile link copied to clipboard.", "success");
    } catch {
      setStatus("Clipboard access is unavailable in this browser.", "error");
    }
  });
}
