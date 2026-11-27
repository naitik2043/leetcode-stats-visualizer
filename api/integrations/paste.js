const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const connectToDatabase = require("../../server/db");
const {
  json,
  getSessionUser,
  enforceSameOrigin,
  requireSecret,
  rateLimit,
  methodNotAllowed
} = require("../../server/auth");
const IntegrationTicket = require("../../server/models/IntegrationTicket");

function pasteAppOrigin() {
  const configured = String(process.env.PASTE_APP_URL || "").trim();
  if (!configured) return null;
  try {
    const parsed = new URL(configured);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  if (!rateLimit(req, res, "paste-vault-launch", 10, 15 * 60 * 1000)) return;

  const appOrigin = pasteAppOrigin();
  if (!appOrigin) {
    return json(res, 503, { error: "Code Vault is not configured on this deployment yet." });
  }

  try {
    await connectToDatabase();
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "Sign in to LeetMetric before opening Code Vault." });

    const signingSecret = requireSecret();
    const ticketId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 90 * 1000);
    const token = jwt.sign({
      sub: String(user._id),
      ver: Number(user.tokenVersion || 0),
      jti: ticketId,
      purpose: "paste-app-sso"
    }, signingSecret, {
      expiresIn: "90s",
      issuer: "leetmetric",
      audience: "paste-app"
    });

    await IntegrationTicket.create({ ticketId, userId: user._id, expiresAt });

    return json(res, 200, {
      launchUrl: appOrigin + "/#sso=" + encodeURIComponent(token),
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
