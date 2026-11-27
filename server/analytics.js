const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;
const MAX_COUNTER = 10000000;

function asCounter(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_COUNTER) {
    const error = new Error("Invalid " + label + " value.");
    error.code = "INVALID_ANALYTICS";
    throw error;
  }
  return parsed;
}

function normalizeSnapshotInput(username, rawStats) {
  if (!USERNAME_PATTERN.test(username)) {
    const error = new Error("Enter a valid LeetCode username.");
    error.code = "INVALID_USERNAME";
    throw error;
  }
  if (!rawStats || typeof rawStats !== "object" || Array.isArray(rawStats)) {
    const error = new Error("Profile statistics are required.");
    error.code = "INVALID_ANALYTICS";
    throw error;
  }

  const rawSolved = rawStats.solved || {};
  const rawQuestions = rawStats.totalQuestions || {};
  const solved = {
    easy: asCounter(rawSolved.easy ?? 0, "easy solved"),
    medium: asCounter(rawSolved.medium ?? 0, "medium solved"),
    hard: asCounter(rawSolved.hard ?? 0, "hard solved")
  };
  const totalQuestions = {
    easy: asCounter(rawQuestions.easy ?? 0, "easy question total"),
    medium: asCounter(rawQuestions.medium ?? 0, "medium question total"),
    hard: asCounter(rawQuestions.hard ?? 0, "hard question total")
  };

  const totalSolved = solved.easy + solved.medium + solved.hard;
  const acceptedTotal = asCounter(rawStats.acceptedTotal ?? totalSolved, "accepted submissions");
  const submissionTotal = asCounter(rawStats.submissionTotal ?? 0, "total submissions");
  const rawRate = Number(rawStats.acceptanceRate);
  const acceptanceRate = Number.isFinite(rawRate)
    ? Number(Math.max(0, Math.min(100, rawRate)).toFixed(2))
    : (submissionTotal > 0 ? Number(((acceptedTotal / submissionTotal) * 100).toFixed(2)) : 0);

  return {
    username,
    usernameKey: username.toLowerCase(),
    totalSolved,
    solved,
    totalQuestions,
    acceptedTotal,
    submissionTotal,
    acceptanceRate
  };
}

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function calculateGoalProgress(goal, currentValue) {
  const baseline = Math.max(0, Number(goal.baselineValue) || 0);
  const current = Math.max(baseline, Number(currentValue) || 0);
  const completed = Math.max(0, current - baseline);
  const target = Math.max(1, Number(goal.target) || 1);
  const percentage = Math.min(100, Math.round((completed / target) * 100));
  return {
    baseline,
    current,
    completed,
    target,
    percentage,
    remaining: Math.max(0, target - completed),
    isComplete: completed >= target
  };
}

module.exports = { USERNAME_PATTERN, normalizeSnapshotInput, utcDateKey, calculateGoalProgress };
