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
  let activeRoadmapId = "";
  let activeUsername = "";
  let savedRoadmaps = [];

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

  function renderPlan(plan, progressOverride, roadmapId) {
    activePlan = plan;
    activeRoadmapId = roadmapId || "";
    activeUsername = plan.username;
    activeKey = storageKey(plan.username, plan.horizonDays);
    const saved = progressOverride && typeof progressOverride === "object" ? progressOverride : readProgress();
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
      activeRoadmapId = "";
      renderPlan(plan);
      await refreshSavedRoadmaps();
      setStatus("Roadmap generated. Save it to your account or keep a browser-local copy.", "success");
    } catch (error) {
      setStatus(error.message || "Unable to generate a roadmap right now.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Generate roadmap →";
    }
  });

  function currentProgress() {
    const progress = {};
    weeksHost.querySelectorAll("[data-week-check]").forEach((checkbox) => {
      progress[checkbox.dataset.weekCheck] = checkbox.checked;
    });
    return progress;
  }

  async function refreshSavedRoadmaps(preferredId) {
    const select = document.getElementById("roadmap-saved-plans");
    if (!select || !activeUsername) return;
    try {
      const response = await fetch("/api/roadmaps?username=" + encodeURIComponent(activeUsername), {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        savedRoadmaps = [];
        select.replaceChildren(el("option", "", response.status === 401
          ? "Sign in to sync plans"
          : "Save this username to your account first"));
        return;
      }
      savedRoadmaps = Array.isArray(payload.roadmaps) ? payload.roadmaps : [];
      select.replaceChildren(el("option", "", "Choose a saved plan"));
      savedRoadmaps.forEach((item) => {
        const date = new Date(item.updatedAt);
        const label = item.title + " · " + item.horizonDays + "d" +
          (Number.isNaN(date.getTime()) ? "" : " · " + date.toLocaleDateString());
        const option = el("option", "", label);
        option.value = item.id;
        select.append(option);
      });
      if (preferredId) select.value = preferredId;
    } catch {
      savedRoadmaps = [];
      select.replaceChildren(el("option", "", "Saved plans unavailable"));
    }
  }

  document.getElementById("roadmap-save").addEventListener("click", async () => {
    if (!activePlan) return;
    const progress = currentProgress();
    try {
      localStorage.setItem(activeKey, JSON.stringify(progress));
    } catch { /* Keep the account-save attempt independent of browser storage. */ }

    const button = document.getElementById("roadmap-save");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const response = await fetch(activeRoadmapId
        ? "/api/roadmaps/" + encodeURIComponent(activeRoadmapId)
        : "/api/roadmaps", {
        method: activeRoadmapId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(activeRoadmapId ? { progress } : {
          username: activePlan.username,
          horizonDays: activePlan.horizonDays,
          plan: activePlan,
          progress
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if ([401, 409, 503].includes(response.status)) {
          setStatus("A browser copy was saved. " + (payload.error || "Sign in and save this profile to synchronize it."), "error");
          return;
        }
        throw new Error(payload.error || "Unable to save this roadmap.");
      }
      activeRoadmapId = payload.roadmap.id;
      await refreshSavedRoadmaps(activeRoadmapId);
      setStatus("Roadmap and weekly completion saved to your LeetMetric account and this browser.", "success");
    } catch (error) {
      setStatus("Browser copy saved. Account sync failed: " + (error.message || "please try again."), "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });

  document.getElementById("roadmap-load-saved").addEventListener("click", () => {
    const id = document.getElementById("roadmap-saved-plans").value;
    const saved = savedRoadmaps.find((item) => item.id === id);
    if (!saved) {
      setStatus("Choose a saved roadmap to load.", "error");
      return;
    }
    activeKey = storageKey(saved.username, saved.horizonDays);
    usernameInput.value = saved.username;
    horizonInput.value = String(saved.horizonDays);
    renderPlan(saved.plan, saved.progress, saved.id);
    setStatus("Loaded the saved roadmap and its account-synchronized completion state.", "success");
  });

  document.getElementById("roadmap-export").addEventListener("click", () => {
    if (!activePlan) return;
    const progress = currentProgress();
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
