const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectToDatabase = require("../db");
const User = require("../models/User");
const ProfileSnapshot = require("../models/ProfileSnapshot");
const Goal = require("../models/Goal");
const RevisionItem = require("../models/RevisionItem");
const CodePaste = require("../models/CodePaste");
const IntegrationTicket = require("../models/IntegrationTicket");
const Roadmap = require("../models/Roadmap");
const {
  json,
  getSessionUser,
  publicUser,
  clearSessionCookie,
  enforceSameOrigin,
  rateLimitShared,
  methodNotAllowed
} = require("../auth");
const {
  normalizeSnapshotInput,
  utcDateKey,
  USERNAME_PATTERN
} = require("../analytics");
const { calculateGoalProgress } = require("../analytics");
const {
  normalizeRevisionCreate,
  normalizeRevisionUpdate
} = require("../revisions");
const { normalizeRoadmapInput, normalizeRoadmapUpdate } = require("../roadmaps");
const { logEvent } = require("../observability");

function isConfigurationError(error) {
  return error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED";
}

function sendConfigurationError(res, message) {
  return json(res, 503, { error: message });
}

function logFailure(label, error) {
  logEvent(label, {
    component: "workspace",
    errorName: error && error.name ? error.name : "UnknownError"
  }, "error");
}


async function handleHealth(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, "GET");
  const startedAt = Date.now();
  try {
    await connectToDatabase();
    if (!mongoose.connection.db) throw new Error("Database handle unavailable");
    await mongoose.connection.db.admin().ping();
    const durationMs = Date.now() - startedAt;
    logEvent("health_check_succeeded", {
      component: "database",
      route: "/api/health",
      method: "GET",
      statusCode: 200,
      durationMs
    });
    return json(res, 200, {
      status: "ok",
      checks: { database: "ok" },
      timestamp: new Date().toISOString(),
      durationMs
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logEvent("health_check_failed", {
      component: "database",
      route: "/api/health",
      method: "GET",
      statusCode: 503,
      durationMs,
      errorName: error && error.name ? error.name : "UnknownError"
    }, "warn");
    return json(res, 503, {
      status: "degraded",
      checks: { database: "unavailable" },
      message: isConfigurationError(error)
        ? "Account storage is not configured."
        : "The database health check could not complete.",
      timestamp: new Date().toISOString()
    });
  }
}

async function handleProfile(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Please log in to manage your saved profile." });

    if (req.method === "GET") return json(res, 200, { user: publicUser(user) });

    const username = typeof req.body?.leetcodeUsername === "string"
      ? req.body.leetcodeUsername.trim()
      : "";
    if (username && !USERNAME_PATTERN.test(username)) {
      return json(res, 400, { error: "Enter a valid LeetCode username." });
    }

    user.leetcodeUsername = username;
    await user.save();
    return json(res, 200, { user: publicUser(user) });
  } catch (error) {
    if (isConfigurationError(error)) {
      return sendConfigurationError(res, "Saved profiles are not available until account storage is configured.");
    }
    logFailure("saved_profile_failed", error);
    return json(res, 500, { error: "Unable to update your saved profile." });
  }
}

async function handleAccountDeletion(req, res) {
  if (req.method !== "DELETE") return methodNotAllowed(req, res, "DELETE");
  if (!enforceSameOrigin(req, res)) return;

  const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";
  const confirmEmail = typeof req.body?.confirmEmail === "string"
    ? req.body.confirmEmail.trim().toLowerCase()
    : "";
  const currentPassword = typeof req.body?.currentPassword === "string"
    ? req.body.currentPassword
    : "";

  if (confirmation !== "DELETE") {
    return json(res, 400, { error: 'Type DELETE exactly to confirm permanent account deletion.' });
  }
  if (!confirmEmail || !currentPassword) {
    return json(res, 400, { error: "Enter your account email and current LeetMetric password to continue." });
  }

  try {
    await connectToDatabase();
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return json(res, 401, { error: "Sign in again before deleting your account." });

    const user = await User.findById(sessionUser._id).select("+passwordHash");
    if (!user) {
      clearSessionCookie(res);
      return json(res, 401, { error: "This account is no longer available. Please sign in again." });
    }
    if (confirmEmail !== user.email.toLowerCase()) {
      return json(res, 400, { error: "The confirmation email does not match your account." });
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return json(res, 401, { error: "Your current password is incorrect." });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ProfileSnapshot.deleteMany({ userId: user._id }, { session });
        await Goal.deleteMany({ userId: user._id }, { session });
        await RevisionItem.deleteMany({ userId: user._id }, { session });
        await CodePaste.deleteMany({ userId: user._id }, { session });
        await IntegrationTicket.deleteMany({ userId: user._id }, { session });
        await Roadmap.deleteMany({ userId: user._id }, { session });
        await Roadmap.deleteMany({ userId: user._id }, { session });
        await User.deleteOne({ _id: user._id }, { session });
      });
    } finally {
      await session.endSession();
    }

    const remaining = await Promise.all([
      ProfileSnapshot.countDocuments({ userId: user._id }),
      Goal.countDocuments({ userId: user._id }),
      RevisionItem.countDocuments({ userId: user._id }),
      CodePaste.countDocuments({ userId: user._id }),
      IntegrationTicket.countDocuments({ userId: user._id }),
      Roadmap.countDocuments({ userId: user._id }),
      User.countDocuments({ _id: user._id })
    ]);
    const verification = {
      snapshots: remaining[0],
      goals: remaining[1],
      revisions: remaining[2],
      codeVaultItems: remaining[3],
      integrationTickets: remaining[4],
      roadmaps: remaining[5],
      account: remaining[6],
      verified: remaining.every((count) => count === 0)
    };
    clearSessionCookie(res);
    return json(res, verification.verified ? 200 : 500, {
      ok: verification.verified,
      message: verification.verified
        ? "Your account and owned workspace data were deleted. A follow-up database check found zero remaining records."
        : "The deletion transaction completed but verification found remaining records. Contact support before creating a new account.",
      verification
    });
  } catch (error) {
    if (isConfigurationError(error)) {
      return sendConfigurationError(res, "Account deletion is unavailable until account storage is configured.");
    }
    logFailure("account_deletion_failed", error);
    return json(res, 500, {
      error: "We could not complete account deletion. No success was reported; please try again or contact support."
    });
  }
}


async function handleAccountExport(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, "GET");
  if (!enforceSameOrigin(req, res)) return;
  if (!await rateLimitShared(req, res, "account-export", 3, 60 * 60 * 1000)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to export your account data." });

    const userId = user._id;
    const [snapshots, goals, revisions, roadmaps, snippetStats] = await Promise.all([
      ProfileSnapshot.find({ userId }).sort({ dateKey: 1 }).limit(180).lean(),
      Goal.find({ userId }).sort({ createdAt: 1 }).limit(100).lean(),
      RevisionItem.find({ userId }).sort({ createdAt: 1 }).limit(100).lean(),
      Roadmap.find({ userId }).sort({ createdAt: 1 }).limit(20).lean(),
      CodePaste.aggregate([
        { $match: { userId } },
        { $group: {
          _id: null,
          count: { $sum: 1 },
          contentBytes: { $sum: { $strLenBytes: { $ifNull: ["$content", ""] } } }
        } }
      ])
    ]);
    const codeVaultCount = snippetStats[0]?.count || 0;
    const codeVaultContentBytes = snippetStats[0]?.contentBytes || 0;
    if (codeVaultCount > 200 || codeVaultContentBytes > 3 * 1024 * 1024) {
      return json(res, 413, {
        error: "Your Code Vault export exceeds the safe 3 MB snippet-content limit. Export or archive some snippets first, then retry."
      });
    }

    const codeVaultItems = await CodePaste.find({ userId })
      .select("title content language category problemTitle problemUrl difficulty topic approach timeComplexity spaceComplexity keyTakeaway tags visibility isPinned history createdAt updatedAt")
      .sort({ createdAt: 1 }).limit(200).lean();
    const safeCodeVaultItems = codeVaultItems.map((item) => ({
      id: String(item._id),
      title: item.title,
      content: item.content,
      language: item.language,
      category: item.category,
      problemTitle: item.problemTitle,
      problemUrl: item.problemUrl,
      difficulty: item.difficulty,
      topic: item.topic,
      approach: item.approach,
      timeComplexity: item.timeComplexity,
      spaceComplexity: item.spaceComplexity,
      keyTakeaway: item.keyTakeaway,
      tags: item.tags,
      visibility: item.visibility,
      isPinned: item.isPinned,
      history: item.history,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    const payload = {
      schemaVersion: 1,
      product: "LeetMetric",
      exportedAt: new Date().toISOString(),
      account: publicUser(user),
      data: {
        profileSnapshots: snapshots.map(snapshotPayload),
        goals: goals.map((goal) => ({
          id: String(goal._id), title: goal.title, username: goal.username,
          metric: goal.metric, target: goal.target, baselineValue: goal.baselineValue,
          period: goal.period, startsAt: goal.startsAt, dueAt: goal.dueAt,
          status: goal.status, createdAt: goal.createdAt, updatedAt: goal.updatedAt
        })),
        revisionItems: revisions.map(revisionPayload),
        roadmaps: roadmaps.map(roadmapPayload),
        codeVaultItems: safeCodeVaultItems
      },
      exclusions: [
        "Password hashes, session tokens, password-reset tokens and integration launch tickets are never exported.",
        "Unlisted Code Vault share identifiers are not included. The underlying snippet content and visibility setting are included.",
        "Contact messages are not part of this personal workspace export."
      ]
    };
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, "utf8") > 4 * 1024 * 1024) {
      return json(res, 413, { error: "Your account export exceeds the 4 MB response limit. Export or archive some Code Vault content and retry." });
    }
    const filename = "leetmetric-account-export-" + payload.exportedAt.slice(0, 10) + ".json";
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(serialized);
  } catch (error) {
    if (isConfigurationError(error)) return sendConfigurationError(res, "Account export is unavailable until account storage is configured.");
    logFailure("account_data_export_failed", error);
    return json(res, 500, { error: "Unable to export your account data right now." });
  }
}

function snapshotPayload(snapshot) {
  return {
    id: String(snapshot._id),
    username: snapshot.username,
    dateKey: snapshot.dateKey,
    fetchedAt: snapshot.createdAt || snapshot.updatedAt,
    totalSolved: snapshot.totalSolved,
    solved: snapshot.solved,
    totalQuestions: snapshot.totalQuestions,
    acceptedTotal: snapshot.acceptedTotal,
    submissionTotal: snapshot.submissionTotal,
    acceptanceRate: snapshot.acceptanceRate
  };
}

async function handleSnapshots(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  if (req.method === "POST" && !await rateLimitShared(req, res, "snapshot", 30, 60 * 60 * 1000)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to save and view private progress history." });

    const username = String(
      req.method === "POST"
        ? req.body?.username || ""
        : req.query?.username || user.leetcodeUsername || ""
    ).trim();

    if (!USERNAME_PATTERN.test(username)) {
      return json(res, 400, { error: "Save a valid LeetCode username before tracking progress." });
    }
    if (!user.leetcodeUsername || username.toLowerCase() !== user.leetcodeUsername.toLowerCase()) {
      return json(res, 409, { error: "This username is not your saved profile. Save it in Profile Settings before tracking snapshots." });
    }

    if (req.method === "GET") {
      const snapshots = await ProfileSnapshot.find({
        userId: user._id,
        usernameKey: username.toLowerCase()
      }).sort({ dateKey: -1 }).limit(180).lean();

      return json(res, 200, {
        username,
        snapshots: snapshots.reverse().map(snapshotPayload),
        retentionDays: 180
      });
    }

    let normalized;
    try {
      normalized = normalizeSnapshotInput(username, req.body?.stats);
    } catch (error) {
      return json(res, 400, { error: error.message || "Invalid profile statistics." });
    }

    const dateKey = utcDateKey(new Date());
    const filter = {
      userId: user._id,
      usernameKey: normalized.usernameKey,
      dateKey
    };
    const update = {
      $set: {
        username: normalized.username,
        totalSolved: normalized.totalSolved,
        solved: normalized.solved,
        totalQuestions: normalized.totalQuestions,
        acceptedTotal: normalized.acceptedTotal,
        submissionTotal: normalized.submissionTotal,
        acceptanceRate: normalized.acceptanceRate
      },
      $setOnInsert: {
        userId: user._id,
        usernameKey: normalized.usernameKey,
        dateKey
      }
    };

    let snapshot;
    try {
      snapshot = await ProfileSnapshot.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }).lean();
    } catch (error) {
      // Resolve concurrent requests racing against the unique daily snapshot index.
      if (error.code !== 11000) throw error;
      snapshot = await ProfileSnapshot.findOneAndUpdate(filter, { $set: update.$set }, {
        new: true,
        runValidators: true
      }).lean();
    }

    return json(res, 200, {
      message: "Today's progress snapshot has been saved.",
      snapshot: snapshotPayload(snapshot)
    });
  } catch (error) {
    if (isConfigurationError(error)) {
      return sendConfigurationError(res, "Progress history is unavailable until account storage is configured.");
    }
    logFailure("profile_snapshot_failed", error);
    return json(res, 500, { error: "Unable to save or load your progress history right now." });
  }
}

const ALLOWED_GOAL_METRICS = new Set(["totalSolved", "easy", "medium", "hard"]);
const GOAL_PERIOD_DAYS = { "7d": 7, "30d": 30 };

async function handleGoals(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  if (req.method === "POST" && !await rateLimitShared(req, res, "goals", 20, 60 * 60 * 1000)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to manage personal practice goals." });
    if (!user.leetcodeUsername) {
      return json(res, 409, { error: "Save your preferred LeetCode username before creating a progress goal." });
    }

    const usernameKey = user.leetcodeUsername.toLowerCase();
    const latestSnapshot = await ProfileSnapshot.findOne({
      userId: user._id,
      usernameKey
    }).sort({ dateKey: -1 }).lean();

    if (req.method === "GET") {
      const goals = await Goal.find({
        userId: user._id,
        usernameKey,
        status: { $ne: "archived" }
      }).sort({ createdAt: -1 }).limit(50).lean();

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

    if (title.length < 3 || title.length > 80) {
      return json(res, 400, { error: "Goal title must be between 3 and 80 characters." });
    }
    if (!ALLOWED_GOAL_METRICS.has(metric)) {
      return json(res, 400, { error: "Choose a supported problem-solving metric." });
    }
    if (!Number.isSafeInteger(target) || target < 1 || target > 10000) {
      return json(res, 400, { error: "Goal target must be a whole number between 1 and 10,000." });
    }
    if (!Object.prototype.hasOwnProperty.call(GOAL_PERIOD_DAYS, period)) {
      return json(res, 400, { error: "Choose a 7-day or 30-day goal period." });
    }

    const startsAt = new Date();
    const dueAt = new Date(startsAt.getTime() + GOAL_PERIOD_DAYS[period] * 86400000);
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
    if (isConfigurationError(error)) {
      return sendConfigurationError(res, "Practice goals are unavailable until account storage is configured.");
    }
    logFailure("practice_goals_failed", error);
    return json(res, 500, { error: "Unable to manage your practice goals right now." });
  }
}

async function handleGoalItem(req, res, id) {
  if (req.method !== "DELETE") return methodNotAllowed(req, res, "DELETE");
  if (!enforceSameOrigin(req, res)) return;
  if (!mongoose.isValidObjectId(id)) return json(res, 400, { error: "Invalid goal identifier." });

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to manage your practice goals." });

    const deleted = await Goal.findOneAndDelete({ _id: id, userId: user._id });
    if (!deleted) return json(res, 404, { error: "That goal was not found." });
    return json(res, 200, { ok: true, message: "Practice goal deleted." });
  } catch (error) {
    if (isConfigurationError(error)) {
      return sendConfigurationError(res, "Practice goals are unavailable until account storage is configured.");
    }
    logFailure("practice_goal_delete_failed", error);
    return json(res, 500, { error: "Unable to delete this goal right now." });
  }
}

function revisionPayload(item) {
  return {
    id: String(item._id),
    title: item.title,
    problemUrl: item.problemUrl || "",
    difficulty: item.difficulty,
    topic: item.topic || "",
    mistakeType: item.mistakeType,
    attemptsBeforeAccepted: item.attemptsBeforeAccepted ?? null,
    timeSpentMinutes: item.timeSpentMinutes ?? null,
    notes: item.notes || "",
    status: item.status,
    reviewedAt: item.reviewedAt || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function handleRevisions(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  if (req.method === "POST" && !await rateLimitShared(req, res, "revisions", 30, 60 * 60 * 1000)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to manage your private revision queue." });
    if (!user.leetcodeUsername) {
      return json(res, 409, { error: "Save your preferred LeetCode username before adding revision items." });
    }

    const usernameKey = user.leetcodeUsername.toLowerCase();
    if (req.method === "GET") {
      const items = await RevisionItem.find({ userId: user._id, usernameKey })
        .sort({ updatedAt: -1 }).limit(100).lean();
      return json(res, 200, {
        username: user.leetcodeUsername,
        revisions: items.map(revisionPayload),
        limit: 100
      });
    }

    let normalized;
    try {
      normalized = normalizeRevisionCreate(req.body || {});
    } catch (error) {
      return json(res, 400, { error: error.message || "Invalid revision item." });
    }

    const count = await RevisionItem.countDocuments({ userId: user._id, usernameKey });
    if (count >= 100) {
      return json(res, 409, { error: "Your revision queue has reached 100 items. Delete completed items to make room." });
    }

    const item = await RevisionItem.create({
      ...normalized,
      userId: user._id,
      username: user.leetcodeUsername,
      usernameKey
    });

    return json(res, 201, {
      message: "Problem added to your private revision queue.",
      revision: revisionPayload(item)
    });
  } catch (error) {
    if (isConfigurationError(error)) {
      return sendConfigurationError(res, "Your revision queue is unavailable until account storage is configured.");
    }
    logFailure("revision_queue_failed", error);
    return json(res, 500, { error: "Unable to manage your revision queue right now." });
  }
}

async function handleRevisionItem(req, res, id) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    return methodNotAllowed(req, res, "PATCH, DELETE");
  }
  if (!enforceSameOrigin(req, res)) return;
  if (!mongoose.isValidObjectId(id)) return json(res, 400, { error: "Invalid revision item identifier." });

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to manage your private revision queue." });

    if (req.method === "DELETE") {
      const deleted = await RevisionItem.findOneAndDelete({ _id: id, userId: user._id });
      if (!deleted) return json(res, 404, { error: "Revision item not found." });
      return json(res, 200, { ok: true, message: "Revision item deleted." });
    }

    let update;
    try {
      update = normalizeRevisionUpdate(req.body || {});
    } catch (error) {
      return json(res, 400, { error: error.message || "Invalid revision update." });
    }

    const item = await RevisionItem.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!item) return json(res, 404, { error: "Revision item not found." });

    return json(res, 200, {
      message: "Revision item updated.",
      revision: revisionPayload(item)
    });
  } catch (error) {
    if (isConfigurationError(error)) {
      return sendConfigurationError(res, "Your revision queue is unavailable until account storage is configured.");
    }
    logFailure("revision_item_update_failed", error);
    return json(res, 500, { error: "Unable to update this revision item right now." });
  }
}


function roadmapPayload(item) {
  return {
    id: String(item._id),
    username: item.username,
    title: item.title,
    horizonDays: item.horizonDays,
    plan: item.plan,
    progress: item.progress || {},
    version: item.version || 1,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function handleRoadmaps(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  if (req.method === "POST" && !await rateLimitShared(req, res, "roadmaps", 20, 60 * 60 * 1000)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to synchronize roadmaps across devices." });
    if (!user.leetcodeUsername) {
      return json(res, 409, { error: "Save your preferred LeetCode username before synchronizing roadmaps." });
    }
    const usernameKey = user.leetcodeUsername.toLowerCase();

    if (req.method === "GET") {
      const requestedUsername = String(req.query?.username || user.leetcodeUsername).trim();
      if (!USERNAME_PATTERN.test(requestedUsername) || requestedUsername.toLowerCase() !== usernameKey) {
        return json(res, 409, { error: "Roadmaps are available only for the LeetCode username saved to this account." });
      }
      const items = await Roadmap.find({ userId: user._id, usernameKey })
        .sort({ updatedAt: -1 }).limit(20).lean();
      return json(res, 200, {
        username: user.leetcodeUsername,
        roadmaps: items.map(roadmapPayload),
        limit: 20
      });
    }

    let normalized;
    try {
      normalized = normalizeRoadmapInput(req.body || {});
    } catch (error) {
      return json(res, 400, { error: error.message || "Invalid roadmap." });
    }
    if (normalized.usernameKey !== usernameKey) {
      return json(res, 409, { error: "Save this LeetCode username in your profile settings before synchronizing its roadmap." });
    }
    const count = await Roadmap.countDocuments({ userId: user._id, usernameKey });
    if (count >= 20) {
      return json(res, 409, { error: "You have reached the 20-roadmap limit. Delete an older roadmap before saving another." });
    }
    const item = await Roadmap.create({ ...normalized, userId: user._id });
    return json(res, 201, { message: "Roadmap saved to your LeetMetric account.", roadmap: roadmapPayload(item) });
  } catch (error) {
    if (isConfigurationError(error)) return sendConfigurationError(res, "Roadmap synchronization is unavailable until account storage is configured.");
    logFailure("roadmap_list_or_create_failed", error);
    return json(res, 500, { error: "Unable to load or save your roadmaps right now." });
  }
}

async function handleRoadmapItem(req, res, id) {
  if (req.method !== "PATCH" && req.method !== "DELETE") return methodNotAllowed(req, res, "PATCH, DELETE");
  if (!enforceSameOrigin(req, res)) return;
  if (!await rateLimitShared(req, res, "roadmap-item-write", 60, 60 * 60 * 1000)) return;
  if (!mongoose.isValidObjectId(id)) return json(res, 400, { error: "Invalid roadmap identifier." });

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to manage saved roadmaps." });
    const filter = { _id: id, userId: user._id };

    if (req.method === "DELETE") {
      const deleted = await Roadmap.findOneAndDelete(filter);
      if (!deleted) return json(res, 404, { error: "Saved roadmap not found." });
      return json(res, 200, { ok: true, message: "Saved roadmap deleted." });
    }

    const current = await Roadmap.findOne(filter).lean();
    if (!current) return json(res, 404, { error: "Saved roadmap not found." });
    const currentVersion = Number(current.version) || 1;
    if (req.body?.version !== undefined) {
      const expectedVersion = Number(req.body.version);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        return json(res, 400, { error: "Roadmap version must be a positive whole number." });
      }
      if (expectedVersion !== currentVersion) {
        return json(res, 409, {
          error: "This roadmap changed in another session. Reload the saved version before editing it.",
          code: "ROADMAP_VERSION_CONFLICT",
          roadmap: roadmapPayload(current)
        });
      }
    }
    let update;
    try {
      update = normalizeRoadmapUpdate(req.body || {}, current.plan.weeks.length);
    } catch (error) {
      return json(res, 400, { error: error.message || "Invalid roadmap update." });
    }
    const roadmap = await Roadmap.findOneAndUpdate(
      { ...filter, version: currentVersion },
      { $set: update, $inc: { version: 1 } },
      { new: true, runValidators: true }
    ).lean();
    if (!roadmap) {
      return json(res, 409, {
        error: "This roadmap was updated at the same time by another session. Reload the saved version and retry.",
        code: "ROADMAP_VERSION_CONFLICT"
      });
    }
    return json(res, 200, { message: "Saved roadmap updated.", roadmap: roadmapPayload(roadmap) });
  } catch (error) {
    if (isConfigurationError(error)) return sendConfigurationError(res, "Roadmap synchronization is unavailable until account storage is configured.");
    logFailure("roadmap_update_or_delete_failed", error);
    return json(res, 500, { error: "Unable to update this saved roadmap right now." });
  }
}

module.exports = async function workspaceHandler(req, res) {
  const rawPath = req.query?.path;
  const segments = (Array.isArray(rawPath) ? rawPath : [rawPath])
    .filter((part) => typeof part === "string" && part.length > 0);

  if (segments.length === 1 && segments[0] === "health") return handleHealth(req, res);
  if (segments.length === 1 && segments[0] === "profile") return handleProfile(req, res);
  if (segments.length === 1 && segments[0] === "export") return handleAccountExport(req, res);
  if (segments.length === 1 && segments[0] === "roadmaps") return handleRoadmaps(req, res);
  if (segments.length === 2 && segments[0] === "roadmaps") return handleRoadmapItem(req, res, segments[1]);
  if (segments.length === 1 && segments[0] === "account") return handleAccountDeletion(req, res);
  if (segments.length === 1 && segments[0] === "snapshots") return handleSnapshots(req, res);
  if (segments.length === 1 && segments[0] === "goals") return handleGoals(req, res);
  if (segments.length === 2 && segments[0] === "goals") return handleGoalItem(req, res, segments[1]);
  if (segments.length === 1 && segments[0] === "revisions") return handleRevisions(req, res);
  if (segments.length === 2 && segments[0] === "revisions") return handleRevisionItem(req, res, segments[1]);

  return json(res, 404, { error: "Workspace API route not found." });
};
