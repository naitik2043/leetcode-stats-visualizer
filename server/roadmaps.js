const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;
const HORIZONS = new Set([7, 30, 90]);
const MAX_PLAN_BYTES = 40000;
const MAX_WEEKS = 13;

function invalid(message) {
  const error = new Error(message);
  error.code = "INVALID_ROADMAP";
  return error;
}

function cleanText(value, label, maxLength, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw invalid(label + " is required.");
  if (result.length > maxLength) throw invalid(label + " must be " + maxLength + " characters or fewer.");
  return result;
}

function normalizeProgress(progress, weekCount) {
  if (progress === undefined || progress === null) return {};
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
    throw invalid("Roadmap progress must be an object keyed by week number.");
  }
  const normalized = {};
  for (const [key, value] of Object.entries(progress)) {
    if (!/^\d{1,2}$/.test(key)) throw invalid("Roadmap progress contains an invalid week number.");
    const week = Number(key);
    if (week < 1 || week > weekCount || typeof value !== "boolean") {
      throw invalid("Roadmap progress contains an invalid completion value.");
    }
    normalized[String(week)] = value;
  }
  return normalized;
}

function normalizeRoadmapInput(body = {}) {
  const username = cleanText(body.username, "LeetCode username", 30, true);
  if (!USERNAME_PATTERN.test(username)) throw invalid("Enter a valid LeetCode username.");
  const horizonDays = Number(body.horizonDays);
  if (!HORIZONS.has(horizonDays)) throw invalid("Choose a 7, 30 or 90-day roadmap.");
  const rawPlan = body.plan;
  if (!rawPlan || typeof rawPlan !== "object" || Array.isArray(rawPlan)) {
    throw invalid("A generated roadmap plan is required.");
  }
  if (Buffer.byteLength(JSON.stringify(rawPlan), "utf8") > MAX_PLAN_BYTES) {
    throw invalid("The roadmap is too large to save.");
  }
  if (!Array.isArray(rawPlan.weeks) || rawPlan.weeks.length < 1 || rawPlan.weeks.length > MAX_WEEKS) {
    throw invalid("The roadmap must contain between 1 and 13 weekly sections.");
  }
  if (Number(rawPlan.horizonDays) !== horizonDays) {
    throw invalid("The roadmap duration does not match the selected duration.");
  }

  const weeks = rawPlan.weeks.map((week, index) => {
    if (!week || typeof week !== "object" || Number(week.week) !== index + 1) {
      throw invalid("Roadmap weeks must be sequential and start at week 1.");
    }
    const target = Number(week.target);
    if (!Number.isSafeInteger(target) || target < 0 || target > 100) {
      throw invalid("Each weekly target must be a whole number between 0 and 100.");
    }
    const tasks = Array.isArray(week.tasks) ? week.tasks : [];
    if (tasks.length > 8) throw invalid("Each week can contain at most 8 tasks.");
    return {
      week: index + 1,
      title: cleanText(week.title, "Week title", 100),
      focus: cleanText(week.focus, "Focus topic", 80, true),
      secondary: cleanText(week.secondary, "Secondary topic", 80),
      target,
      difficulty: cleanText(week.difficulty, "Difficulty", 40),
      tasks: tasks.map((task) => cleanText(task, "Task", 240, true))
    };
  });

  const plan = {
    username,
    generatedAt: typeof rawPlan.generatedAt === "string" ? rawPlan.generatedAt.slice(0, 40) : new Date().toISOString(),
    horizonDays,
    goal: cleanText(rawPlan.goal, "Roadmap goal", 300),
    estimatedProblemTarget: Number.isSafeInteger(Number(rawPlan.estimatedProblemTarget))
      ? Math.max(0, Math.min(10000, Number(rawPlan.estimatedProblemTarget)))
      : weeks.reduce((sum, week) => sum + week.target, 0),
    note: cleanText(rawPlan.note, "Roadmap note", 1000),
    weeks
  };
  return {
    username,
    usernameKey: username.toLowerCase(),
    title: cleanText(body.title || (username + " · " + horizonDays + "-day DSA roadmap"), "Saved roadmap title", 100, true),
    horizonDays,
    plan,
    progress: normalizeProgress(body.progress, weeks.length)
  };
}

function normalizeRoadmapUpdate(body = {}, weekCount) {
  const update = {};
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    update.title = cleanText(body.title, "Saved roadmap title", 100, true);
  }
  if (Object.prototype.hasOwnProperty.call(body, "progress")) {
    update.progress = normalizeProgress(body.progress, weekCount);
  }
  if (Object.keys(update).length === 0) throw invalid("Provide a roadmap title or progress update.");
  return update;
}

module.exports = { normalizeRoadmapInput, normalizeRoadmapUpdate, normalizeProgress, MAX_PLAN_BYTES, MAX_WEEKS };
