const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;

const LEETCODE_PROFILE_QUERY = [
  "query leetmetricProfile($username: String!) {",
  "  allQuestionsCount { difficulty count }",
  "  matchedUser(username: $username) {",
  "    username",
  "    profile { realName ranking }",
  "    submitStats {",
  "      acSubmissionNum { difficulty count submissions }",
  "      totalSubmissionNum { difficulty count submissions }",
  "    }",
  "    userCalendar { streak totalActiveDays submissionCalendar }",
  "    tagProblemCounts {",
  "      fundamental { tagName tagSlug problemsSolved }",
  "      intermediate { tagName tagSlug problemsSolved }",
  "      advanced { tagName tagSlug problemsSolved }",
  "    }",
  "  }",
  "  userContestRanking(username: $username) { attendedContestsCount rating globalRanking totalParticipants topPercentage }",
  "  userContestRankingHistory(username: $username) {",
  "    attended trendDirection problemsSolved totalProblems rating ranking",
  "    contest { title startTime }",
  "  }",
  "}"
].join("\n");

const LEETCODE_CORE_PROFILE_QUERY = [
  "query userSessionProgress($username: String!) {",
  "  allQuestionsCount { difficulty count }",
  "  matchedUser(username: $username) {",
  "    submitStats {",
  "      acSubmissionNum { difficulty count submissions }",
  "      totalSubmissionNum { difficulty count submissions }",
  "    }",
  "  }",
  "}"
].join("\n");

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function byDifficulty(rows = []) {
  if (!Array.isArray(rows)) return {};
  return rows.reduce((counts, row) => {
    if (!row || typeof row.difficulty !== "string") return counts;
    const difficulty = row.difficulty.toLowerCase();
    if (["easy", "medium", "hard", "all"].includes(difficulty)) {
      counts[difficulty] = safeCount(row.count);
    }
    return counts;
  }, {});
}

function normalizeCalendar(calendar) {
  if (!calendar || typeof calendar !== "object") return null;
  let raw = calendar.submissionCalendar;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};

  const daily = Object.entries(raw).map(([key, value]) => {
    const timestamp = Number(key);
    if (!Number.isFinite(timestamp)) return null;
    const milliseconds = timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) return null;
    return {
      date: date.toISOString().slice(0, 10),
      count: safeCount(value)
    };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));

  return {
    currentStreak: safeCount(calendar.streak),
    totalActiveDays: safeCount(calendar.totalActiveDays),
    daily
  };
}

function normalizeTopics(tagProblemCounts) {
  if (!tagProblemCounts || typeof tagProblemCounts !== "object") return [];
  const groups = ["fundamental", "intermediate", "advanced"];
  const topics = [];
  for (const level of groups) {
    const rows = Array.isArray(tagProblemCounts[level]) ? tagProblemCounts[level] : [];
    for (const row of rows) {
      if (!row || typeof row.tagName !== "string") continue;
      topics.push({
        name: row.tagName,
        slug: typeof row.tagSlug === "string" ? row.tagSlug : "",
        solved: safeCount(row.problemsSolved),
        level
      });
    }
  }
  return topics.sort((a, b) => b.solved - a.solved || a.name.localeCompare(b.name));
}

function normalizeContest(ranking, history = []) {
  const attended = Array.isArray(history)
    ? history.filter((entry) => entry && entry.attended === true).map((entry) => ({
      title: entry.contest && entry.contest.title ? entry.contest.title : "LeetCode contest",
      startTime: safeCount(entry.contest && entry.contest.startTime),
      rating: safeNumber(entry.rating),
      ranking: safeCount(entry.ranking),
      problemsSolved: safeCount(entry.problemsSolved),
      totalProblems: safeCount(entry.totalProblems),
      trendDirection: typeof entry.trendDirection === "string" ? entry.trendDirection : "NONE"
    })).sort((a, b) => a.startTime - b.startTime)
    : [];

  if (!ranking && attended.length === 0) return null;
  const ratings = attended.map((entry) => entry.rating).filter((value) => value !== null);
  const currentRating = safeNumber(ranking && ranking.rating);
  const maxRating = Math.max(...ratings, currentRating === null ? -Infinity : currentRating);
  return {
    attendedContestsCount: safeCount(ranking && ranking.attendedContestsCount),
    rating: currentRating,
    globalRanking: safeCount(ranking && ranking.globalRanking),
    totalParticipants: safeCount(ranking && ranking.totalParticipants),
    topPercentage: safeNumber(ranking && ranking.topPercentage),
    maxRating: Number.isFinite(maxRating) ? maxRating : null,
    history: attended.slice(-30)
  };
}

function normalizeLeetCodeProfile(username, result, fetchedAt = new Date()) {
  const user = result && result.matchedUser;
  if (!user) return null;

  const accepted = byDifficulty(user.submitStats && user.submitStats.acSubmissionNum);
  const submissions = byDifficulty(user.submitStats && user.submitStats.totalSubmissionNum);
  const totalQuestions = byDifficulty(result.allQuestionsCount);
  const solved = {
    easy: accepted.easy || 0,
    medium: accepted.medium || 0,
    hard: accepted.hard || 0
  };
  const totalSolved = solved.easy + solved.medium + solved.hard;
  const acceptedTotal = accepted.all ?? totalSolved;
  const submissionTotal = submissions.all ?? (
    (submissions.easy || 0) + (submissions.medium || 0) + (submissions.hard || 0)
  );
  const acceptanceRate = submissionTotal > 0
    ? Number(((acceptedTotal / submissionTotal) * 100).toFixed(2))
    : 0;

  const profile = user.profile || {};
  return {
    username,
    fetchedAt: fetchedAt instanceof Date ? fetchedAt.toISOString() : new Date(fetchedAt).toISOString(),
    stats: {
      totalSolved,
      solved,
      totalQuestions: {
        easy: totalQuestions.easy || 0,
        medium: totalQuestions.medium || 0,
        hard: totalQuestions.hard || 0
      },
      acceptedTotal,
      submissionTotal,
      acceptanceRate,
      acceptedSubmissions: accepted,
      totalSubmissions: submissions
    },
    profile: {
      realName: typeof profile.realName === "string" ? profile.realName : "",
      ranking: safeCount(profile.ranking)
    },
    activity: normalizeCalendar(user.userCalendar),
    topics: normalizeTopics(user.tagProblemCounts),
    contest: normalizeContest(result.userContestRanking, result.userContestRankingHistory)
  };
}

module.exports = {
  USERNAME_PATTERN,
  LEETCODE_PROFILE_QUERY,
  LEETCODE_CORE_PROFILE_QUERY,
  normalizeLeetCodeProfile,
  normalizeCalendar,
  normalizeTopics,
  normalizeContest,
  safeCount
};
