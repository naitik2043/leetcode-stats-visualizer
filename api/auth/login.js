const bcrypt = require("bcryptjs");
const connectToDatabase = require("../../server/db");
const User = require("../../server/models/User");
const { json, requireSecret, setSessionCookie, enforceSameOrigin, rateLimitShared, methodNotAllowed, isValidEmail, publicUser } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  if (!await rateLimitShared(req, res, "login", 8)) return;

  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isValidEmail(email) || !password || Buffer.byteLength(password, "utf8") > 72) {
    return json(res, 400, { error: "Enter a valid email address and password." });
  }

  try {
    requireSecret();
    await connectToDatabase();
    const user = await User.findOne({ email }).select("+passwordHash");
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid) return json(res, 401, { error: "Email or password is incorrect." });
    setSessionCookie(res, user);
    return json(res, 200, { user: publicUser(user) });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Account login is not available yet. The site database and session settings need to be configured." });
    }
    console.error("login_failed", error.message);
    return json(res, 500, { error: "We could not sign you in. Please try again later." });
  }
};
