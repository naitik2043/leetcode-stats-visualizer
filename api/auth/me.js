const connectToDatabase = require("../../server/db");
const { json, getSessionUser, publicUser, clearSessionCookie, methodNotAllowed } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, "GET");
  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) clearSessionCookie(res);
    return json(res, 200, { user: publicUser(user) });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Account services are not configured on this deployment.", user: null });
    }
    console.error("session_lookup_failed", error.message);
    return json(res, 500, { error: "Unable to check the current session.", user: null });
  }
};
