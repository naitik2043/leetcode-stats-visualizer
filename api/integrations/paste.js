const crypto = require("node:crypto");
const connectToDatabase = require("../../server/db");
const {
  json,
  getSessionUser,
  enforceSameOrigin,
  rateLimit,
  methodNotAllowed
} = require("../../server/auth");
const { getPasteAppOrigin } = require("../../server/pasteAppConfig");
const IntegrationTicket = require("../../server/models/IntegrationTicket");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  if (!rateLimit(req, res, "paste-vault-launch", 10, 15 * 60 * 1000)) return;

  const appOrigin = getPasteAppOrigin(process.env.PASTE_APP_URL);
  if (!appOrigin) {
    return json(res, 503, { error: "Code Vault is not configured on this deployment yet." });
  }

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to LeetMetric before opening Code Vault." });

    // Use an opaque 256-bit one-time ticket. Store only its SHA-256 hash;
    // the ticket itself is delivered in the URL fragment and never logged by HTTP.
    const opaqueTicket = crypto.randomBytes(32).toString("base64url");
    const ticketId = crypto.createHash("sha256").update(opaqueTicket).digest("hex");
    const expiresAt = new Date(Date.now() + 90 * 1000);

    await IntegrationTicket.create({
      ticketId,
      userId: user._id,
      tokenVersion: Number(user.tokenVersion || 0),
      expiresAt
    });

    return json(res, 200, {
      launchUrl: appOrigin + "/#sso=" + encodeURIComponent(opaqueTicket),
      expiresInSeconds: 90
    });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "AUTH_NOT_CONFIGURED") {
      return json(res, 503, { error: "Code Vault is unavailable until account storage is configured." });
    }
    console.error("paste_vault_launch_failed", error.name || "UnknownError");
    return json(res, 500, { error: "Unable to open Code Vault right now. Please try again." });
  }
};
