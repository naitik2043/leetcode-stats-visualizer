const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;

const LEETCODE_PROFILE_QUERY = `
query userSessionProgress($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) {
    submitStats {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty count submissions }
    }
  }
}`;

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
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

function normalizeLeetCodeProfile(username, result, fetchedAt = new Date()) {
  const user = result?.matchedUser;
  if (!user) return null;

  const accepted = byDifficulty(user.submitStats?.acSubmissionNum);
  const submissions = byDifficulty(user.submitStats?.totalSubmissionNum);
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
    }
  };
}

module.exports = {
  USERNAME_PATTERN,
  LEETCODE_PROFILE_QUERY,
  normalizeLeetCodeProfile,
  safeCount
};
