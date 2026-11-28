(() => {
  "use strict";
  const form = document.getElementById("roadmap-form");
  const usernameInput = document.getElementById("roadmap-username");
  const horizonInput = document.getElementById("roadmap-horizon");
  const submit = document.getElementById("roadmap-submit");
  const status = document.getElementById("roadmap-status");
  const results = document.getElementById("roadmap-results");
  const weeksHost = document.getElementById("roadmap-weeks");
  let activePlan = null;
  let activeKey = "";

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = "roadmap-status" + (type ? " " + type : "");
  }

  function storageKey(username, horizon) {
    return "leetmetric-roadmap:" + username.toLowerCase() + ":" + horizon;
  }

  function readProgress() {
    try { return JSON.parse(localStorage.getItem(activeKey) || "{}"); }
    catch { return {}; }
  }

  function renderProgress() {
    const boxes = Array.from(weeksHost.querySelectorAll("[data-week-check]"));
    const complete = boxes.filter((box) => box.checked).length;
    document.getElementById("roadmap-progress").textContent = complete + " / " + boxes.length + " weeks completed";
  }

  function renderPlan(plan) {
    activePlan = plan;
    activeKey = storageKey(plan.username, plan.horizonDays);
    const saved = readProgress();
    weeksHost.replaceChildren();
    document.getElementById("roadmap-title").textContent = plan.username + " · " + plan.horizonDays + "-day roadmap";
    document.getElementById("roadmap-description").textContent = plan.goal + " " + plan.note;
    document.getElementById("roadmap-target").textContent = plan.estimatedProblemTarget.toLocaleString();

    plan.weeks.forEach((week) => {
      const card = el("article", "roadmap-week");
      const header = el("div", "roadmap-week-header");
      const heading = el("div");
      heading.append(el("span", "roadmap-week-label", "WEEK " + String(week.week).padStart(2, "0")), el("h3", "", week.focus));
      header.append(heading, el("span", "roadmap-week-target", week.target + " problem target"));
      const meta = el("p", "roadmap-week-meta", "Also practice: " + week.secondary + " · Difficulty: " + week.difficulty);
      const tasks = el("ul", "roadmap-task-list");
      week.tasks.forEach((task) => tasks.append(el("li", "", task)));
      const footer = el("label", "roadmap-complete");
      const checkbox = el("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(saved[week.week]);
      checkbox.dataset.weekCheck = String(week.week);
      checkbox.addEventListener("change", renderProgress);
      footer.append(checkbox, el("span", "", "Mark this week complete"));
      card.append(header, meta, tasks, footer);
      weeksHost.append(card);
    });
    renderProgress();
    results.hidden = false;
    try { localStorage.setItem("leetmetric-last-username", plan.username); } catch { /* Optional. */ }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const horizonDays = Number(horizonInput.value);
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
      setStatus("Enter a valid LeetCode username.", "error");
      usernameInput.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = "Building…";
    results.hidden = true;
    setStatus("Fetching public profile and selecting practice priorities…");
    try {
      const response = await fetch("/api/leetcode/" + encodeURIComponent(username), {
        headers: { Accept: "application/json" }, credentials: "same-origin"
      });
      const profile = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(profile.error || "Unable to fetch this profile.");
      const plan = window.LeetMetricIntelligence.createRoadmap(profile, { horizonDays });
      renderPlan(plan);
      setStatus("Roadmap generated. You can adjust the plan and save weekly progress.", "success");
    } catch (error) {
      setStatus(error.message || "Unable to generate a roadmap right now.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Generate roadmap →";
    }
  });

  document.getElementById("roadmap-save").addEventListener("click", () => {
    if (!activePlan) return;
    const progress = {};
    weeksHost.querySelectorAll("[data-week-check]").forEach((checkbox) => {
      progress[checkbox.dataset.weekCheck] = checkbox.checked;
    });
    try {
      localStorage.setItem(activeKey, JSON.stringify(progress));
      setStatus("Your roadmap progress has been saved in this browser.", "success");
    } catch {
      setStatus("Browser storage is unavailable. You can still export your plan.", "error");
    }
  });

  document.getElementById("roadmap-export").addEventListener("click", () => {
    if (!activePlan) return;
    const progress = {};
    weeksHost.querySelectorAll("[data-week-check]").forEach((checkbox) => {
      progress[checkbox.dataset.weekCheck] = checkbox.checked;
    });
    const blob = new Blob([JSON.stringify({ ...activePlan, progress }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = el("a");
    link.href = url;
    link.download = "leetmetric-roadmap-" + activePlan.username + "-" + activePlan.horizonDays + "d.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("username");
  if (fromQuery) usernameInput.value = fromQuery;
  else {
    try { usernameInput.value = localStorage.getItem("leetmetric-last-username") || ""; } catch { /* Optional. */ }
  }
})();
