const mongoose = require("mongoose");
const connectToDatabase = require("../../server/db");
const Goal = require("../../server/models/Goal");
const { json, getSessionUser, enforceSameOrigin, methodNotAllowed } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "DELETE") return methodNotAllowed(req, res, "DELETE");
  if (!enforceSameOrigin(req, res)) return;

  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!mongoose.isValidObjectId(id)) return json(res, 400, { error: "Invalid goal identifier." });

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to manage your practice goals." });
    const deleted = await Goal.findOneAndDelete({ _id: id, userId: user._id });
    if (!deleted) return json(res, 404, { error: "That goal was not found." });
    return json(res, 200, { ok: true, message: "Practice goal deleted." });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Practice goals are unavailable until account storage is configured." });
    }
    console.error("practice_goal_delete_failed", error.name || "UnknownError");
    return json(res, 500, { error: "Unable to delete this goal right now." });
  }
};
