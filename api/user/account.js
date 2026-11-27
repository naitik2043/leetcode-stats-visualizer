const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectToDatabase = require("../../server/db");
const User = require("../../server/models/User");
const ProfileSnapshot = require("../../server/models/ProfileSnapshot");
const Goal = require("../../server/models/Goal");
const RevisionItem = require("../../server/models/RevisionItem");
const {
  json, getSessionUser, clearSessionCookie, enforceSameOrigin, methodNotAllowed
} = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "DELETE") return methodNotAllowed(req, res, "DELETE");
  if (!enforceSameOrigin(req, res)) return;

  const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";
  const confirmEmail = typeof req.body?.confirmEmail === "string" ? req.body.confirmEmail.trim().toLowerCase() : "";
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";

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
    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      return json(res, 401, { error: "Your current password is incorrect." });
    }

    // All account-owned data is removed in one MongoDB transaction before access is revoked.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ProfileSnapshot.deleteMany({ userId: user._id }, { session });
        await Goal.deleteMany({ userId: user._id }, { session });
        await RevisionItem.deleteMany({ userId: user._id }, { session });
        await User.deleteOne({ _id: user._id }, { session });
      });
    } finally {
      await session.endSession();
    }

    clearSessionCookie(res);
    return json(res, 200, {
      ok: true,
      message: "Your account and its saved profiles, snapshots, goals and revision items have been deleted."
    });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Account deletion is unavailable until account storage is configured." });
    }
    console.error("account_deletion_failed", error.name || "UnknownError");
    return json(res, 500, {
      error: "We could not complete account deletion. No success was reported; please try again or contact support."
    });
  }
};
