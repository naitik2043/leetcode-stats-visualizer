const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const QUERY = `
query userSessionProgress($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) {
    submitStats {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty count submissions }
    }
  }
}`;

function byDifficulty(rows = []) {
  return Object.fromEntries(rows.map((row) => [String(row.difficulty).toLowerCase(), Number(row.count) || 0]));
}
function findCount(rows = [], difficulty) {
  const row = rows.find((entry) => String(entry.difficulty).toLowerCase() === difficulty);
  return row ? Number(row.count) || 0 : 0;
}
function normalize(username, result) {
  const user = result?.matchedUser;
  if (!user) return null;
  const acceptedRows = user.submitStats?.acSubmissionNum || [];
  const totalRows = user.submitStats?.totalSubmissionNum || [];
  const questionRows = result.allQuestionsCount || [];
  const accepted = byDifficulty(acceptedRows);
  const submissions = byDifficulty(totalRows);
  const solved = {
    easy: findCount(acceptedRows, "easy"),
    medium: findCount(acceptedRows, "medium"),
    hard: findCount(acceptedRows, "hard")
  };
  const totalQuestions = {
    easy: findCount(questionRows, "easy"),
    medium: findCount(questionRows, "medium"),
    hard: findCount(questionRows, "hard")
  };
  const acceptedTotal = accepted.all || 0;
  const submissionTotal = submissions.all || 0;
  return {
    username,
    fetchedAt: new Date().toISOString(),
    stats: {
      totalSolved: solved.easy + solved.medium + solved.hard,
      solved,
      totalQuestions,
      acceptedTotal,
      submissionTotal,
      acceptedSubmissions: accepted,
      totalSubmissions: submissions
    }
  };
}
async function fetchLeetCodeProfile(username) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json", "user-agent": "LeetMetric/1.0 (+https://github.com/naitik2043/leetcode-stats-visualizer)" },
    body: JSON.stringify({ query: QUERY, variables: { username } }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("LeetCode is temporarily unavailable. Please try again.");
  const payload = await response.json();
  if (payload.errors?.length) throw new Error("LeetCode could not process this profile request.");
  return normalize(username, payload.data);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const username = String(req.query.username || "").trim();
  if (!USERNAME_PATTERN.test(username)) return res.status(400).json({ error: "Invalid LeetCode username." });

  const cached = cache.get(username.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) return res.status(200).json(cached.data);

  try {
    const data = await fetchLeetCodeProfile(username);
    if (!data) return res.status(404).json({ error: "Public LeetCode profile not found." });
    cache.set(username.toLowerCase(), { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: error.message || "Unable to fetch LeetCode statistics." });
  }
};
