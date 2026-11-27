const { json, clearSessionCookie, enforceSameOrigin, methodNotAllowed } = require("../../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
};
