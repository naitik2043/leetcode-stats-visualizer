const workspaceHandler = require("../../server/workspace");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return workspaceHandler(req, res);
};
