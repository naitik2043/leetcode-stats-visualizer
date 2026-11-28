(() => {
  const goalForm = document.getElementById("goal-form");
  const goalList = document.getElementById("goal-list");
  const goalStatus = document.getElementById("goal-status");
  const snapshotButton = document.getElementById("save-snapshot-btn");
  const snapshotStatus = document.getElementById("snapshot-status");
  const historyChart = document.getElementById("history-chart");
  const historyTable = document.getElementById("history-table");
  const historyEmpty = document.getElementById("history-empty");
  const historyMeta = document.getElementById("history-meta");

  let savedUsername = "";
  let currentProfile = null;
  let snapshotBusy = false;

  function showMessage(target, message, kind) {
    if (!target) return;
    target.textContent = message;
    target.className = "feature-status show" + (kind ? " " + kind : "");
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value || "")
      : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function resetChart() {
    if (historyChart) historyChart.replaceChildren();
  }

  function renderHistory(snapshots) {
    if (!historyChart || !historyTable) return;
    resetChart();
    historyTable.replaceChildren();

    if (!snapshots.length) {
      if (historyEmpty) historyEmpty.hidden = false;
      if (historyMeta) historyMeta.textContent = "No saved snapshots yet";
      return;
    }

    if (historyEmpty) historyEmpty.hidden = snapshots.length >= 2;
    if (historyMeta) historyMeta.textContent = snapshots.length + " saved day" + (snapshots.length === 1 ? "" : "s");

    const width = 720, height = 230;
    const padding = { top: 18, right: 18, bottom: 34, left: 42 };
    const values = snapshots.map((item) => Number(item.totalSolved) || 0);
    const min = Math.min(...values), max = Math.max(...values);
    const range = Math.max(1, max - min);
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Historical LeetCode problems solved across " + snapshots.length + " saved days");

    function svgNode(name, attributes) {
      const node = document.createElementNS("http://www.w3.org/2000/svg", name);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
      return node;
    }

    [0, 0.5, 1].forEach((fraction) => {
      const y = padding.top + plotHeight * fraction;
      svg.append(svgNode("line", {
        x1: padding.left, y1: y, x2: width - padding.right, y2: y, class: "history-grid-line"
      }));
      const label = svgNode("text", {
        x: padding.left - 10, y: y + 4, "text-anchor": "end", class: "history-axis-label"
      });
      label.textContent = String(Math.round(max - range * fraction));
      svg.append(label);
    });

    const points = snapshots.map((item, index) => ({
      x: snapshots.length === 1 ? padding.left + plotWidth / 2 : padding.left + (index / (snapshots.length - 1)) * plotWidth,
      y: padding.top + ((max - values[index]) / range) * plotHeight,
      item,
      value: values[index]
    }));

    if (points.length > 1) {
      svg.append(svgNode("polyline", {
        points: points.map((point) => point.x + "," + point.y).join(" "),
        class: "history-line",
        fill: "none"
      }));
    }

    points.forEach((point) => {
      const circle = svgNode("circle", { cx: point.x, cy: point.y, r: 4, class: "history-point" });
      const title = svgNode("title", {});
      title.textContent = formatDate(point.item.dateKey) + ": " + point.value + " solved";
      circle.append(title);
      svg.append(circle);
    });

    const firstLabel = svgNode("text", {
      x: points[0].x, y: height - 8, "text-anchor": points.length > 1 ? "start" : "middle", class: "history-axis-label"
    });
    firstLabel.textContent = formatDate(points[0].item.dateKey);
    svg.append(firstLabel);
    if (points.length > 1) {
      const last = points[points.length - 1];
      const lastLabel = svgNode("text", {
        x: last.x, y: height - 8, "text-anchor": "end", class: "history-axis-label"
      });
      lastLabel.textContent = formatDate(last.item.dateKey);
      svg.append(lastLabel);
    }

    historyChart.append(svg);
    snapshots.slice().reverse().slice(0, 10).forEach((snapshot) => {
      const row = element("tr");
      row.append(
        element("td", "", formatDate(snapshot.dateKey)),
        element("td", "", Number(snapshot.totalSolved).toLocaleString()),
        element("td", "", Number(snapshot.acceptanceRate).toFixed(1) + "%")
      );
      historyTable.append(row);
    });
  }

  async function loadHistory() {
    if (!savedUsername) return;
    try {
      const response = await fetch("/api/analytics/snapshots?username=" + encodeURIComponent(savedUsername), {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to load progress history.");
      renderHistory(payload.snapshots || []);
    } catch (error) {
      showMessage(snapshotStatus, error.message || "Unable to load progress history.", "error");
    }
  }

  async function loadGoals() {
    if (!goalList) return;
    try {
      const response = await fetch("/api/goals", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to load practice goals.");
      renderGoals(payload.goals || [], payload.hasSnapshot);
    } catch (error) {
      showMessage(goalStatus, error.message || "Unable to load practice goals.", "error");
    }
  }

  function renderGoals(goals, hasSnapshot) {
    goalList.replaceChildren();
    if (!goals.length) {
      goalList.append(element("p", "workspace-empty-state",
        hasSnapshot
          ? "No goals yet. Create a small, measurable practice goal above."
          : "Save your first progress snapshot before creating a goal. The snapshot creates an accurate starting point."));
      return;
    }

    const labels = {
      totalSolved: "Total problems solved",
      easy: "Easy problems solved",
      medium: "Medium problems solved",
      hard: "Hard problems solved"
    };

    goals.forEach((goal) => {
      const card = element("article", "goal-item");
      const top = element("div", "goal-item-top");
      const titleGroup = element("div");
      titleGroup.append(
        element("h4", "", goal.title),
        element("p", "goal-item-subtitle", labels[goal.metric] + " · " + (goal.period === "7d" ? "7-day goal" : "30-day goal"))
      );
      top.append(titleGroup, element("strong", "goal-percent", goal.progress.percentage + "%"));

      const track = element("div", "goal-track");
      const fill = element("span", "goal-fill");
      fill.style.width = goal.progress.percentage + "%";
      track.append(fill);

      const detail = element("div", "goal-detail");
      detail.append(
        element("span", "", goal.progress.completed.toLocaleString() + " / " + goal.target.toLocaleString() + " completed"),
        element("span", "", goal.progress.remaining.toLocaleString() + " to go")
      );

      const footer = element("div", "goal-item-footer");
      footer.append(
        element("span", "", goal.status === "completed" ? "Goal achieved" : "Due " + formatDate(goal.dueAt)),
        element("button", "goal-delete", "Delete")
      );
      footer.querySelector("button").addEventListener("click", () => deleteGoal(goal.id));
      card.append(top, track, detail, footer);
      goalList.append(card);
    });
  }

  async function deleteGoal(id) {
    if (!window.confirm("Delete this practice goal?")) return;
    try {
      const response = await fetch("/api/goals/" + encodeURIComponent(id), {
        method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to delete this goal.");
      showMessage(goalStatus, "Goal deleted.", "success");
      await loadGoals();
    } catch (error) {
      showMessage(goalStatus, error.message || "Unable to delete this goal.", "error");
    }
  }

  async function saveSnapshot() {
    if (!currentProfile || snapshotBusy) return;
    if (currentProfile.username.toLowerCase() !== savedUsername.toLowerCase()) {
      showMessage(snapshotStatus, "Save this username as your preferred profile before tracking its history.", "error");
      return;
    }

    snapshotBusy = true;
    snapshotButton.disabled = true;
    snapshotButton.textContent = "Saving…";
    try {
      const response = await fetch("/api/analytics/snapshots", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: currentProfile.username, stats: currentProfile.data.stats })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to save today's snapshot.");
      showMessage(snapshotStatus, payload.message || "Today's snapshot has been saved.", "success");
      await Promise.all([loadHistory(), loadGoals()]);
    } catch (error) {
      showMessage(snapshotStatus, error.message || "Unable to save today's snapshot.", "error");
    } finally {
      snapshotBusy = false;
      snapshotButton.disabled = !currentProfile || !savedUsername ||
        currentProfile.username.toLowerCase() !== savedUsername.toLowerCase();
      snapshotButton.textContent = "Save today's snapshot";
    }
  }

  function renderActivity(activity) {
    const container = document.getElementById("activity-heatmap");
    const summary = document.getElementById("activity-summary");
    if (!container) return;
    container.replaceChildren();

    if (!activity || !Array.isArray(activity.daily) || activity.daily.length === 0) {
      container.append(element("p", "workspace-empty-state", "LeetCode did not return calendar data for this profile."));
      if (summary) summary.textContent = "Calendar unavailable";
      container.setAttribute("aria-label", "No activity calendar data available");
      return;
    }

    const counts = new Map(activity.daily.map((entry) => [entry.date, Number(entry.count) || 0]));
    const max = Math.max(1, ...counts.values());
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 364);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    let totalSubmissions = 0;
    let activeDays = 0;
    counts.forEach((count) => {
      totalSubmissions += count;
      if (count > 0) activeDays += 1;
    });

    const fragment = document.createDocumentFragment();
    for (let cursor = new Date(start); cursor <= today; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const count = counts.get(date) || 0;
      const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
      const cell = element("span", "activity-cell level-" + level);
      const label = date + ": " + count + " submissions";
      cell.title = label;
      cell.setAttribute("aria-label", label);
      fragment.append(cell);
    }
    container.append(fragment);
    container.setAttribute("aria-label", "Submission activity over the past year. " + activeDays + " active days and " + totalSubmissions + " submissions.");
    if (summary) {
      summary.textContent = activity.totalActiveDays.toLocaleString() + " active days · " +
        activity.currentStreak.toLocaleString() + "-day current streak";
    }
  }

  function renderTopics(topics) {
    const list = document.getElementById("topics-list");
    const summary = document.getElementById("topics-summary");
    if (!list) return;
    list.replaceChildren();

    if (!Array.isArray(topics) || topics.length === 0) {
      list.append(element("p", "workspace-empty-state", "Topic-level problem counts are not available for this profile."));
      if (summary) summary.textContent = "No public topic data returned";
      return;
    }

    const ranked = topics.slice().sort((a, b) => Number(b.solved) - Number(a.solved)).slice(0, 8);
    const max = Math.max(1, ...ranked.map((topic) => Number(topic.solved) || 0));
    if (summary) summary.textContent = "Top " + ranked.length + " tags by solved-problem count. These are coverage signals, not mastery scores.";

    ranked.forEach((topic) => {
      const row = element("div", "topic-row");
      const heading = element("div", "topic-row-heading");
      heading.append(
        element("span", "topic-name", topic.name),
        element("strong", "topic-count", Number(topic.solved || 0).toLocaleString())
      );
      const track = element("div", "topic-track");
      const fill = element("span", "topic-fill");
      fill.style.width = Math.min(100, ((Number(topic.solved) || 0) / max) * 100) + "%";
      track.append(fill);
      row.append(heading, track);
      list.append(row);
    });
  }

  function renderContest(contest) {
    const metrics = document.getElementById("contest-metrics");
    const chart = document.getElementById("contest-chart");
    const table = document.getElementById("contest-history");
    if (!metrics || !chart || !table) return;
    metrics.replaceChildren();
    chart.replaceChildren();
    table.replaceChildren();

    if (!contest) {
      metrics.append(element("p", "workspace-empty-state", "No contest rating data is available. This usually means the profile has not attended a rated contest."));
      chart.append(element("p", "workspace-empty-state", "Contest history will appear here after a rated contest."));
      return;
    }

    const metricRows = [
      ["Current rating", contest.rating === null ? "—" : Math.round(contest.rating).toLocaleString()],
      ["Peak rating", contest.maxRating === null ? "—" : Math.round(contest.maxRating).toLocaleString()],
      ["Global rank", contest.globalRanking ? contest.globalRanking.toLocaleString() : "—"],
      ["Contests attended", (contest.attendedContestsCount || 0).toLocaleString()],
      ["Top percentage", contest.topPercentage === null ? "—" : contest.topPercentage.toFixed(2) + "%"]
    ];
    metricRows.forEach(([label, value]) => {
      const item = element("div", "contest-metric");
      item.append(element("span", "", label), element("strong", "", value));
      metrics.append(item);
    });

    const history = Array.isArray(contest.history) ? contest.history : [];
    const rated = history.filter((entry) => Number.isFinite(Number(entry.rating)));
    if (rated.length > 0) {
      const width = 640, height = 180, padding = 24;
      const ratings = rated.map((entry) => Number(entry.rating));
      const min = Math.min(...ratings), max = Math.max(...ratings);
      const range = Math.max(1, max - min);
      const points = rated.map((entry, index) => ({
        x: rated.length === 1 ? width / 2 : padding + (index / (rated.length - 1)) * (width - padding * 2),
        y: padding + ((max - ratings[index]) / range) * (height - padding * 2),
        entry
      }));
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 " + width + " " + height);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Contest rating history across " + rated.length + " attended contests");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", points.map((point) => point.x + "," + point.y).join(" "));
      line.setAttribute("class", "contest-rating-line");
      line.setAttribute("fill", "none");
      svg.append(line);
      points.forEach((point) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        circle.setAttribute("r", "3.5");
        circle.setAttribute("class", "contest-rating-point");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = point.entry.title + ": " + Math.round(Number(point.entry.rating)) + " rating";
        circle.append(title);
        svg.append(circle);
      });
      chart.append(svg);
    } else {
      chart.append(element("p", "workspace-empty-state", "Contest rating history was not returned for this profile."));
    }

    history.slice().reverse().slice(0, 6).forEach((entry) => {
      const row = element("tr");
      const contestDate = entry.startTime ? new Date(Number(entry.startTime) * 1000) : null;
      const formattedDate = contestDate && !Number.isNaN(contestDate.getTime())
        ? contestDate.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
        : "—";
      row.append(
        element("td", "", (entry.title || "Contest") + " · " + formattedDate),
        element("td", "", entry.rating === null ? "—" : Math.round(entry.rating).toLocaleString()),
        element("td", "", entry.ranking ? Number(entry.ranking).toLocaleString() : "—")
      );
      table.append(row);
    });
  }

  function renderExtendedAnalytics(data) {
    renderActivity(data && data.activity);
    renderTopics(data && data.topics);
    renderContest(data && data.contest);
  }

  document.addEventListener("leetmetric:profile-loaded", (event) => {
    currentProfile = event.detail || null;
    renderExtendedAnalytics(currentProfile && currentProfile.data);
    if (snapshotButton) {
      snapshotButton.disabled = !currentProfile || !savedUsername ||
        currentProfile.username.toLowerCase() !== savedUsername.toLowerCase();
    }
    if (snapshotStatus && currentProfile && currentProfile.username.toLowerCase() !== savedUsername.toLowerCase()) {
      showMessage(snapshotStatus, "Save this username in Profile Settings to build a private history for it.", "");
    }
  });

  document.addEventListener("leetmetric:workspace-ready", (event) => {
    savedUsername = String(event.detail && event.detail.username || "").trim();
    if (snapshotButton) snapshotButton.disabled = !savedUsername;
    if (savedUsername) loadHistory();
    loadGoals();
  });

  if (snapshotButton) snapshotButton.addEventListener("click", saveSnapshot);

  if (goalForm) {
    goalForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(goalForm).entries());
      const button = goalForm.querySelector('button[type="submit"]');
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Creating…";
      try {
        const response = await fetch("/api/goals", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Unable to create this goal.");
        goalForm.reset();
        showMessage(goalStatus, payload.message || "Your goal has been created.", "success");
        await loadGoals();
      } catch (error) {
        showMessage(goalStatus, error.message || "Unable to create this goal.", "error");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  }
})();