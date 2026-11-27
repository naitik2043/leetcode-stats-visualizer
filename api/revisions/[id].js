const mongoose = require("mongoose");
const connectToDatabase = require("../../server/db");
const RevisionItem = require("../../server/models/RevisionItem");
const {
  json, getSessionUser, enforceSameOrigin, methodNotAllowed
} = require("../../server/auth");
const { normalizeRevisionUpdate } = require("../../server/revisions");

module.exports = async function handler(req, res) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    return methodNotAllowed(req, res, "PATCH, DELETE");
  }
  if (!enforceSameOrigin(req, res)) return;

  const id = Array.isArray(req.query && req.query.id) ? req.query.id[0] : req.query && req.query.id;
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
    try { update = normalizeRevisionUpdate(req.body || {}); }
    catch (error) { return json(res, 400, { error: error.message }); }

    const item = await RevisionItem.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!item) return json(res, 404, { error: "Revision item not found." });

    return json(res, 200, {
      message: "Revision item updated.",
      revision: {
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
      }
    });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Your revision queue is unavailable until account storage is configured." });
    }
    console.error("revision_item_update_failed", error.name || "UnknownError");
    return json(res, 500, { error: "Unable to update this revision item right now." });
  }
};
