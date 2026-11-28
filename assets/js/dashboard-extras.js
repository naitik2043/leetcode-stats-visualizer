(() => {
  const planForm = document.getElementById("study-plan-form");
  const planOutput = document.getElementById("study-plan-output");
  const cardButton = document.getElementById("download-card");
  const cardStatus = document.getElementById("card-status");
  let latestProfile = null;

  function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function weakestDifficulty(stats) {
    const solved = stats.solved || {};
    const totals = stats.totalQuestions || {};
    const rows = ["easy", "medium", "hard"].map((name) => {
      const total = Number(totals[name]) || 0;
      const count = Number(solved[name]) || 0;
      return { name, ratio: total > 0 ? count / total : 1 };
    }).filter((item) => Number(stats.totalQuestions && stats.totalQuestions[item.name]) > 0);
    rows.sort((a, b) => a.ratio - b.ratio);
    return rows.length ? rows[0].name : "mixed difficulty";
  }

  function renderPlan(profile) {
    latestProfile = profile;
    if (!planOutput || !profile || !profile.stats) return;
    planOutput.replaceChildren();

    const targetInput = document.getElementById("daily-problem-target");
    const target = Math.max(1, Math.min(10, Number(targetInput && targetInput.value) || 2));
    const difficulty = weakestDifficulty(profile.stats);
    const topics = Array.isArray(profile.topics)
      ? profile.topics.slice().sort((a, b) => (Number(a.solved) || 0) - (Number(b.solved) || 0)).slice(0, 5)
      : [];

    const intro = node("p", "planner-summary",
      "Suggested focus: " + difficulty + ". The schedule uses the lowest solved-to-total difficulty coverage and lower solved-count tags from the public profile. Adjust it to your time and interests.");
    planOutput.append(intro);

    const list = node("div", "planner-days");
    const start = new Date();
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const topic = topics.length ? topics[index % topics.length] : null;
      const card = node("article", "planner-day");
      const heading = node("div", "planner-day-heading");
      heading.append(
        node("span", "planner-day-label", "DAY " + (index + 1)),
        node("strong", "planner-day-date", date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }))
      );
      const focus = node("h4", "", topic ? topic.name : "Mixed-topic revision");
      const details = node("p", "", "Practice " + difficulty + " problems · Target: " + target + " problem" + (target === 1 ? "" : "s"));
      card.append(heading, focus, details);
      if (topic && topic.slug) {
        const link = node("a", "planner-topic-link", "Open topic on LeetCode ↗");
        link.href = "https://leetcode.com/tag/" + encodeURIComponent(topic.slug) + "/";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        card.append(link);
      }
      list.append(card);
    }
    planOutput.append(list);
  }

  function drawRoundedRect(context, x, y, width, height, radius, fill) {
    context.fillStyle = fill;
    if (typeof context.roundRect === "function") {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      context.fill();
    } else {
      context.fillRect(x, y, width, height);
    }
  }

  async function downloadCard() {
    if (!latestProfile || !latestProfile.stats || !cardButton) {
      if (cardStatus) cardStatus.textContent = "Load a LeetCode profile before exporting a card.";
      return;
    }

    cardButton.disabled = true;
    cardButton.textContent = "Preparing card…";
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas export is not supported in this browser.");

      context.fillStyle = "#0b1220";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawRoundedRect(context, 48, 48, 1104, 534, 26, "#121d2c");
      context.fillStyle = "#c7f36b";
      context.font = "700 24px Arial";
      context.fillText("LEETMETRIC", 92, 112);
      context.fillStyle = "#f3f6fb";
      context.font = "700 54px Arial";
      context.fillText("@" + latestProfile.username, 92, 206);
      context.fillStyle = "#93a1b5";
      context.font = "20px Arial";
      context.fillText("PUBLIC LEETCODE PERFORMANCE SNAPSHOT", 92, 246);

      const stats = latestProfile.stats;
      const cards = [
        ["PROBLEMS SOLVED", stats.totalSolved],
        ["ACCEPTED SUBMISSIONS", stats.acceptedTotal],
        ["TOTAL SUBMISSIONS", stats.submissionTotal],
        ["ACCEPTANCE RATE", (Number(stats.acceptanceRate) || 0).toFixed(1) + "%"]
      ];
      cards.forEach((item, index) => {
        const x = 92 + index * 255;
        drawRoundedRect(context, x, 300, 225, 112, 16, "#1b2a3c");
        context.fillStyle = "#93a1b5";
        context.font = "13px Arial";
        context.fillText(item[0], x + 17, 333);
        context.fillStyle = "#ffffff";
        context.font = "700 32px Arial";
        context.fillText(String(item[1] ?? "—"), x + 17, 382);
      });

      const solved = stats.solved || {};
      const barY = 470;
      const difficultyRows = [
        ["Easy", Number(solved.easy) || 0, "#9fdb73"],
        ["Medium", Number(solved.medium) || 0, "#e7c36f"],
        ["Hard", Number(solved.hard) || 0, "#e98282"]
      ];
      difficultyRows.forEach((item, index) => {
        const y = barY + index * 28;
        context.fillStyle = "#aab6c8";
        context.font = "15px Arial";
        context.fillText(item[0], 94, y);
        context.fillStyle = "#2c3a4d";
        context.fillRect(190, y - 13, 700, 12);
        context.fillStyle = item[2];
        const total = Number((stats.totalQuestions || {})[item[0].toLowerCase()]) || item[1] || 1;
        context.fillRect(190, y - 13, Math.min(700, (item[1] / total) * 700), 12);
        context.fillStyle = "#ffffff";
        context.fillText(item[1].toLocaleString(), 920, y);
      });

      context.fillStyle = "#748399";
      context.font = "14px Arial";
      context.fillText("Independent community project · Not affiliated with LeetCode", 92, 556);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not create the image file.")), "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "leetmetric-" + latestProfile.username + "-profile.png";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      if (cardStatus) cardStatus.textContent = "Your profile card is ready.";
    } catch (error) {
      if (cardStatus) cardStatus.textContent = error.message || "Unable to export this profile card.";
    } finally {
      cardButton.disabled = false;
      cardButton.textContent = "Download profile card";
    }
  }

  document.addEventListener("leetmetric:profile-loaded", (event) => {
    renderPlan(event.detail && event.detail.data);
    if (cardButton) cardButton.disabled = false;
  });

  if (planForm) {
    planForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!latestProfile) {
        if (planOutput) planOutput.textContent = "Load a profile before generating a practice plan.";
        return;
      }
      renderPlan(latestProfile);
    });
  }
  if (cardButton) cardButton.addEventListener("click", downloadCard);
})();