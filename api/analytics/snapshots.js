const connectToDatabase = require("../../server/db");
const ProfileSnapshot = require("../../server/models/ProfileSnapshot");
const {
  json, getSessionUser, enforceSameOrigin, rateLimit, methodNotAllowed
} = require("../../server/auth");
const { normalizeSnapshotInput, utcDateKey, USERNAME_PATTERN } = require("../../server/analytics");

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

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  if (req.method === "POST" && !rateLimit(req, res, "snapshot", 30, 60 * 60 * 1000)) return;

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to save and view private progress history." });

    const username = String(
      req.method === "POST" ? req.body?.username || "" : req.query?.username || user.leetcodeUsername || ""
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
    let snapshot;
    try {
      snapshot = await ProfileSnapshot.findOneAndUpdate(
        { userId: user._id, usernameKey: normalized.usernameKey, dateKey },
      {
        $set: {
          username: normalized.username,
          totalSolved: normalized.totalSolved,
          solved: normalized.solved,
          totalQuestions: normalized.totalQuestions,
          acceptedTotal: normalized.acceptedTotal,
          submissionTotal: normalized.submissionTotal,
          acceptanceRate: normalized.acceptanceRate
        },
        $setOnInsert: { userId: user._id, usernameKey: normalized.usernameKey, dateKey }
      },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      ).lean();
    } catch (error) {
      // Two simultaneous saves can race on the one-snapshot-per-day unique index.
      if (error.code !== 11000) throw error;
      snapshot = await ProfileSnapshot.findOneAndUpdate(
        { userId: user._id, usernameKey: normalized.usernameKey, dateKey },
        { $set: {
          username: normalized.username,
          totalSolved: normalized.totalSolved,
          solved: normalized.solved,
          totalQuestions: normalized.totalQuestions,
          acceptedTotal: normalized.acceptedTotal,
          submissionTotal: normalized.submissionTotal,
          acceptanceRate: normalized.acceptanceRate
        } },
        { new: true, runValidators: true }
      ).lean();
    }

    return json(res, 200, {
      message: "Today's progress snapshot has been saved.",
      snapshot: snapshotPayload(snapshot)
    });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Progress history is unavailable until account storage is configured." });
    }
    console.error("profile_snapshot_failed", error.name || "UnknownError");
    return json(res, 500, { error: "Unable to save or load your progress history right now." });
  }
};
