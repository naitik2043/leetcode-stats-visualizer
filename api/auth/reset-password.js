const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const connectToDatabase = require("../../server/db");
const User = require("../../server/models/User");
const { json, enforceSameOrigin, rateLimitShared, methodNotAllowed } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  if (!await rateLimitShared(req, res, "reset-password", 5)) return;

  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!/^[a-f0-9]{64}$/.test(token)) return json(res, 400, { error: "This password reset link is invalid or has expired." });
  if (password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
    return json(res, 400, { error: "Password must be at least 10 characters and no more than 72 UTF-8 bytes." });
  }

  try {
    await connectToDatabase();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() }
    }).select("+resetTokenHash +resetTokenExpiresAt");

    if (!user) return json(res, 400, { error: "This password reset link is invalid or has expired." });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    user.tokenVersion += 1;
    await user.save();
    return json(res, 200, { ok: true });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED") return json(res, 503, { error: "Password reset is not available until account storage is configured." });
    console.error("password_reset_failed", error.message);
    return json(res, 500, { error: "Unable to update your password right now." });
  }
};
