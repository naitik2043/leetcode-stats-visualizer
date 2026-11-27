const connectToDatabase = require("../../server/db");
const { json, getSessionUser, publicUser, enforceSameOrigin, methodNotAllowed } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");
  if (req.method === "POST" && !enforceSameOrigin(req, res)) return;
  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Please log in to manage your saved profile." });

    if (req.method === "GET") return json(res, 200, { user: publicUser(user) });

    const username = typeof req.body?.leetcodeUsername === "string" ? req.body.leetcodeUsername.trim() : "";
    if (username && !/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
      return json(res, 400, { error: "Enter a valid LeetCode username." });
    }
    user.leetcodeUsername = username;
    await user.save();
    return json(res, 200, { user: publicUser(user) });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Saved profiles are not available until account storage is configured." });
    }
    console.error("saved_profile_failed", error.message);
    return json(res, 500, { error: "Unable to update your saved profile." });
  }
};
