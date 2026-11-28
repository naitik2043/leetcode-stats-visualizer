const DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);
const MISTAKE_TYPES = new Set([
  "pattern-recognition", "edge-cases", "complexity", "implementation", "recall", "other"
]);
const REVISION_STATUSES = new Set(["queued", "reviewing", "mastered"]);

function invalid(message) {
  const error = new Error(message);
  error.code = "INVALID_REVISION";
  return error;
}

function normalizeProblemUrl(value) {
  const input = typeof value === "string" ? value.trim() : "";
  if (!input) return "";
  if (input.length > 250) throw invalid("Problem URL must be 250 characters or fewer.");

  let url;
  try { url = new URL(input); }
  catch { throw invalid("Enter a valid LeetCode problem URL."); }

  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !["leetcode.com", "www.leetcode.com"].includes(host) ||
      !/^\/problems\/[a-z0-9-]+\/?$/i.test(url.pathname)) {
    throw invalid("Use a secure LeetCode problem URL such as https://leetcode.com/problems/two-sum/.");
  }
  return "https://leetcode.com" + url.pathname.replace(/\/$/, "") + "/";
}

function normalizeOptionalInteger(value, label, minimum, maximum) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw invalid(label + " must be a whole number between " + minimum + " and " + maximum + ", or left blank.");
  }
  return parsed;
}

function normalizeRevisionCreate(body = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const difficulty = typeof body.difficulty === "string" ? body.difficulty : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const mistakeType = typeof body.mistakeType === "string" ? body.mistakeType : "other";
  const attemptsBeforeAccepted = normalizeOptionalInteger(body.attemptsBeforeAccepted, "Attempts before accepted", 1, 100);
  const timeSpentMinutes = normalizeOptionalInteger(body.timeSpentMinutes, "Time spent", 1, 600);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (title.length < 2 || title.length > 120) throw invalid("Problem title must be between 2 and 120 characters.");
  if (!DIFFICULTIES.has(difficulty)) throw invalid("Choose Easy, Medium or Hard difficulty.");
  if (topic.length > 60) throw invalid("Topic must be 60 characters or fewer.");
  if (!MISTAKE_TYPES.has(mistakeType)) throw invalid("Choose a valid revision category.");
  if (notes.length > 1000) throw invalid("Revision notes must be 1,000 characters or fewer.");

  return {
    title,
    problemUrl: normalizeProblemUrl(body.problemUrl),
    difficulty,
    topic,
    mistakeType,
    attemptsBeforeAccepted,
    timeSpentMinutes,
    notes
  };
}

function normalizeRevisionUpdate(body = {}) {
  const update = {};
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 2 || title.length > 120) throw invalid("Problem title must be between 2 and 120 characters.");
    update.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, "problemUrl")) update.problemUrl = normalizeProblemUrl(body.problemUrl);
  if (Object.prototype.hasOwnProperty.call(body, "difficulty")) {
    if (!DIFFICULTIES.has(body.difficulty)) throw invalid("Choose Easy, Medium or Hard difficulty.");
    update.difficulty = body.difficulty;
  }
  if (Object.prototype.hasOwnProperty.call(body, "topic")) {
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (topic.length > 60) throw invalid("Topic must be 60 characters or fewer.");
    update.topic = topic;
  }
  if (Object.prototype.hasOwnProperty.call(body, "attemptsBeforeAccepted")) {
    update.attemptsBeforeAccepted = normalizeOptionalInteger(body.attemptsBeforeAccepted, "Attempts before accepted", 1, 100);
  }
  if (Object.prototype.hasOwnProperty.call(body, "timeSpentMinutes")) {
    update.timeSpentMinutes = normalizeOptionalInteger(body.timeSpentMinutes, "Time spent", 1, 600);
  }
  if (Object.prototype.hasOwnProperty.call(body, "mistakeType")) {
    if (!MISTAKE_TYPES.has(body.mistakeType)) throw invalid("Choose a valid revision category.");
    update.mistakeType = body.mistakeType;
  }
  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > 1000) throw invalid("Revision notes must be 1,000 characters or fewer.");
    update.notes = notes;
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!REVISION_STATUSES.has(body.status)) throw invalid("Choose a valid revision status.");
    update.status = body.status;
    update.reviewedAt = body.status === "mastered" ? new Date() : null;
  }
  if (Object.keys(update).length === 0) throw invalid("Provide at least one supported field to update.");
  return update;
}

module.exports = {
  DIFFICULTIES,
  MISTAKE_TYPES,
  REVISION_STATUSES,
  normalizeProblemUrl,
  normalizeRevisionCreate,
  normalizeRevisionUpdate
};
