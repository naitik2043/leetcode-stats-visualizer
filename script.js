const API_BASE = (window.LEETMETRIC_CONFIG && window.LEETMETRIC_CONFIG.apiBase) || "/api";
const $ = (selector) => document.querySelector(selector);
const form = $("#lookup"), input = $("#user-input"), searchButton = $("#search-btn");
const statusBox = $("#status"), copyButton = $("#copy-link");
let activeUsername = "";
const yearElement = $("#year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

function setStatus(message, kind = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `status-message ${kind}`.trim();
}
function setMetric(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
function formatNumber(value) { return (Number(value) || 0).toLocaleString(); }
function setProgress(labelId, barId, solved, total) {
  const safeTotal = Number(total) || 0, safeSolved = Number(solved) || 0;
  setMetric(labelId, `${formatNumber(safeSolved)} / ${formatNumber(safeTotal)}`);
  const bar = document.getElementById(barId);
  if (bar) bar.style.width = `${safeTotal > 0 ? Math.min(100, safeSolved / safeTotal * 100) : 0}%`;
}
function renderStats(data, username) {
  const stats = data.stats || data, solved = stats.solved || {}, totals = stats.totalQuestions || {};
  const accepted = stats.acceptedSubmissions || {}, submissions = stats.totalSubmissions || {};
  const easy = Number(solved.easy || 0), medium = Number(solved.medium || 0), hard = Number(solved.hard || 0);
  const solvedTotal = Number(stats.totalSolved ?? easy + medium + hard);
  const acceptedTotal = Number(stats.acceptedTotal ?? accepted.all ?? 0);
  const submissionTotal = Number(stats.submissionTotal ?? submissions.all ?? 0);
  setMetric("total-solved", formatNumber(solvedTotal));
  setMetric("accepted-count", formatNumber(acceptedTotal));
  setMetric("submission-count", formatNumber(submissionTotal));
  setMetric("acceptance-rate", `${submissionTotal ? (acceptedTotal / submissionTotal * 100).toFixed(1) : "0.0"}%`);
  setProgress("easy-label", "easy-bar", easy, totals.easy);
  setProgress("medium-label", "medium-bar", medium, totals.medium);
  setProgress("hard-label", "hard-bar", hard, totals.hard);
  const rows = [["Easy accepted", accepted.easy || 0], ["Medium accepted", accepted.medium || 0],
    ["Hard accepted", accepted.hard || 0], ["All submissions", submissions.all ?? submissionTotal]];
  $("#submission-breakdown").innerHTML = rows.map(([label, value]) =>
    `<div class="submission-line"><span>${label}</span><strong>${formatNumber(value)}</strong></div>`).join("");
  $("#profile-caption").textContent = `A snapshot of @${username}'s public LeetCode activity.`;
  $("#leetcode-link").href = `https://leetcode.com/u/${encodeURIComponent(username)}/`;
  copyButton.disabled = false;
  activeUsername = username;
}
async function fetchStats(username) {
  const response = await fetch(`${API_BASE}/leetcode/${encodeURIComponent(username)}`, {headers:{Accept:"application/json"}});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || (response.status === 404
    ? "That public LeetCode profile could not be found." : "Unable to retrieve profile statistics."));
  return payload;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = input.value.trim();
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
    setStatus("Enter a valid LeetCode username (letters, numbers, underscores or hyphens).", "error");
    input.focus(); return;
  }
  searchButton.disabled = true;
  searchButton.innerHTML = "Loading <span>…</span>";
  document.body.classList.add("loading");
  setStatus(`Fetching public stats for @${username}…`);
  try {
    const data = await fetchStats(username);
    renderStats(data, username);
    setStatus("Profile statistics loaded successfully.", "success");
    const insights = $("#insights");
    if (insights) insights.scrollIntoView({behavior:"smooth", block:"start"});
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again later.", "error");
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'View stats <span>→</span>';
    document.body.classList.remove("loading");
  }
});
copyButton.addEventListener("click", async () => {
  if (!activeUsername) return;
  try {
    await navigator.clipboard.writeText(`https://leetcode.com/u/${encodeURIComponent(activeUsername)}/`);
    setStatus("LeetCode profile link copied to clipboard.", "success");
  } catch { setStatus("Clipboard access is unavailable in this browser.", "error"); }
});