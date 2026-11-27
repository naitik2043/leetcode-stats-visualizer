const connectToDatabase = require("../server/db");
const RevisionItem = require("../server/models/RevisionItem");
const {
  json, getSessionUser, enforceSameOrigin, rateLimit, methodNotAllowed
} = require("../server/auth");
const { normalizeRevisionCreate } = require("../server/revisions");

function toPublicItem(item) {
  return {
    id: String(item._id),
    title: item.title,
    problemUrl: item.problemUrl || "",
    difficulty: item.difficulty,
    topic: item.topic || "",
    mistakeType: item.mistakeType,
    notes: item.notes || "",
    status: item.status,
    reviewedAt: item.reviewedAt || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  if (req.method === "POST" && !rateLimit(req, res, "revisions", 30, 60 * 60 * 1000)) return;

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
        revisions: items.map(toPublicItem),
        limit: 100
      });
    }

    let normalized;
    try { normalized = normalizeRevisionCreate(req.body || {}); }
    catch (error) { return json(res, 400, { error: error.message }); }

    const totalItems = await RevisionItem.countDocuments({ userId: user._id, usernameKey });
    if (totalItems >= 100) {
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
      revision: toPublicItem(item)
    });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Your revision queue is unavailable until account storage is configured." });
    }
    console.error("revision_queue_failed", error.name || "UnknownError");
    return json(res, 500, { error: "Unable to manage your revision queue right now." });
  }
};
