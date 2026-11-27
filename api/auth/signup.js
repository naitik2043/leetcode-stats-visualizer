const bcrypt = require("bcryptjs");
const connectToDatabase = require("../../server/db");
const User = require("../../server/models/User");
const { json, setSessionCookie, enforceSameOrigin, rateLimit, methodNotAllowed, isValidEmail, publicUser } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  if (!rateLimit(req, res, "signup", 5)) return;

  const { name, email, password } = req.body || {};
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (cleanName.length < 2 || cleanName.length > 80) return json(res, 400, { error: "Enter a name between 2 and 80 characters." });
  if (!isValidEmail(cleanEmail)) return json(res, 400, { error: "Enter a valid email address." });
  if (typeof password !== "string" || password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
    return json(res, 400, { error: "Password must be at least 10 characters and no more than 72 UTF-8 bytes." });
  }

  try {
    await connectToDatabase();
    const exists = await User.exists({ email: cleanEmail });
    if (exists) return json(res, 409, { error: "An account with this email already exists. Try logging in instead." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: cleanName, email: cleanEmail, passwordHash });
    setSessionCookie(res, user);
    return json(res, 201, { user: publicUser(user) });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Account registration is not available yet. The site database and session settings need to be configured." });
    }
    if (error.code === 11000) return json(res, 409, { error: "An account with this email already exists." });
    console.error("signup_failed", error.message);
    return json(res, 500, { error: "We could not create your account. Please try again later." });
  }
};
