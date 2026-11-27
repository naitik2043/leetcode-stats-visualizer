const crypto = require("crypto");
const connectToDatabase = require("../../server/db");
const User = require("../../server/models/User");
const { json, enforceSameOrigin, rateLimit, methodNotAllowed, isValidEmail } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  if (!rateLimit(req, res, "forgot-password", 4)) return;

  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) return json(res, 400, { error: "Enter a valid email address." });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return json(res, 503, { error: "Password reset email delivery has not been configured for this site yet." });
  }

  try {
    await connectToDatabase();
    const user = await User.findOne({ email });
    const generic = { message: "If that email address is registered, password reset instructions will be sent shortly." };
    if (!user) return json(res, 200, generic);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const forwardedProto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const baseUrl = (process.env.APP_URL || `${forwardedProto}://${host}`).replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password.html?token=${rawToken}`;

    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [user.email],
        subject: "Reset your LeetMetric password",
        html: `<p>Hello ${user.name.replace(/[&<>"]/g, "")},</p><p>Use the link below to choose a new LeetMetric password. This link expires in 15 minutes and can only be used once.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!mailResponse.ok) {
      user.resetTokenHash = undefined;
      user.resetTokenExpiresAt = undefined;
      await user.save();
      return json(res, 502, { error: "We could not send the reset email right now. Please try again later." });
    }
    return json(res, 200, generic);
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED") return json(res, 503, { error: "Password reset is not available until account storage is configured." });
    console.error("password_reset_request_failed", error.message);
    return json(res, 500, { error: "Unable to process the password reset request." });
  }
};
