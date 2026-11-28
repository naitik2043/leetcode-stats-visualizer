const { loadDeveloperProfile, PlatformError } = require("../../../server/developer-platforms");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const platform = String(req.query && req.query.platform || "").toLowerCase();
  const username = String(req.query && req.query.username || "").trim();
  if (platform !== "codeforces" && platform !== "github") {
    return res.status(404).json({ error: "Unsupported developer platform." });
  }

  try {
    const profile = await loadDeveloperProfile(platform, username);
    return res.status(200).json(profile);
  } catch (error) {
    if (error instanceof PlatformError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error("developer_profile_lookup_failed", platform, error && error.name ? error.name : "UnknownError");
    return res.status(502).json({ error: "Unable to load this public developer profile right now." });
  }
};
