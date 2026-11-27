const connectToDatabase = require("../server/db");
const Goal = require("../server/models/Goal");
const ProfileSnapshot = require("../server/models/ProfileSnapshot");
const {
  json, getSessionUser, enforceSameOrigin, rateLimit, methodNotAllowed
} = require("../server/auth");
const { calculateGoalProgress } = require("../server/analytics");

const ALLOWED_METRICS = new Set(["totalSolved", "easy", "medium", "hard"]);
const PERIOD_DAYS = { "7d": 7, "30d": 30 };

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  if (req.method === "POST" && !rateLimit(req, res, "goals", 20, 60 * 60 * 1000)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to manage personal practice goals." });
    if (!user.leetcodeUsername) {
      return json(res, 409, { error: "Save your preferred LeetCode username before creating a progress goal." });
    }

    const usernameKey = user.leetcodeUsername.toLowerCase();
    const latestSnapshot = await ProfileSnapshot.findOne({ userId: user._id, usernameKey })
      .sort({ dateKey: -1 }).lean();

    if (req.method === "GET") {
      const goals = await Goal.find({ userId: user._id, usernameKey, status: { $ne: "archived" } })
        .sort({ createdAt: -1 }).limit(50).lean();
      const current = latestSnapshot?.solved || {};
      const currentValues = {
        totalSolved: latestSnapshot?.totalSolved || 0,
        easy: current.easy || 0,
        medium: current.medium || 0,
        hard: current.hard || 0
      };

      return json(res, 200, {
        username: user.leetcodeUsername,
        hasSnapshot: Boolean(latestSnapshot),
        goals: goals.map((goal) => {
          const progress = calculateGoalProgress(goal, currentValues[goal.metric]);
          return {
            id: String(goal._id),
            title: goal.title,
            username: goal.username,
            metric: goal.metric,
            target: goal.target,
            baselineValue: goal.baselineValue,
            period: goal.period,
            startsAt: goal.startsAt,
            dueAt: goal.dueAt,
            status: progress.isComplete ? "completed" : goal.status,
            progress
          };
        })
      });
    }

    if (!latestSnapshot) {
      return json(res, 409, { error: "Save your first progress snapshot before creating a goal. This creates an accurate starting point." });
    }

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const metric = typeof req.body?.metric === "string" ? req.body.metric : "";
    const target = Number(req.body?.target);
    const period = typeof req.body?.period === "string" ? req.body.period : "";

    if (title.length < 3 || title.length > 80) return json(res, 400, { error: "Goal title must be between 3 and 80 characters." });
    if (!ALLOWED_METRICS.has(metric)) return json(res, 400, { error: "Choose a supported problem-solving metric." });
    if (!Number.isSafeInteger(target) || target < 1 || target > 10000) {
      return json(res, 400, { error: "Goal target must be a whole number between 1 and 10,000." });
    }
    if (!Object.prototype.hasOwnProperty.call(PERIOD_DAYS, period)) {
      return json(res, 400, { error: "Choose a 7-day or 30-day goal period." });
    }

    const startsAt = new Date();
    const dueAt = new Date(startsAt.getTime() + PERIOD_DAYS[period] * 86400000);
    const baselineValue = metric === "totalSolved"
      ? latestSnapshot.totalSolved
      : latestSnapshot.solved?.[metric] || 0;

    const goal = await Goal.create({
      userId: user._id,
      username: user.leetcodeUsername,
      usernameKey,
      title,
      metric,
      target,
      baselineValue,
      baselineSnapshotId: latestSnapshot._id,
      period,
      startsAt,
      dueAt
    });

    return json(res, 201, {
      message: "Your practice goal has been created.",
      goal: {
        id: String(goal._id),
        title: goal.title,
        metric: goal.metric,
        target: goal.target,
        baselineValue: goal.baselineValue,
        period: goal.period,
        startsAt: goal.startsAt,
        dueAt: goal.dueAt,
        progress: calculateGoalProgress(goal, baselineValue)
      }
    });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Practice goals are unavailable until account storage is configured." });
    }
    console.error("practice_goals_failed", error.name || "UnknownError");
    return json(res, 500, { error: "Unable to manage your practice goals right now." });
  }
};
