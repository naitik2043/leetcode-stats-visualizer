function getPasteAppOrigin(value) {
  const configured = String(value || "").trim();
  if (!configured) return null;

  try {
    const parsed = new URL(configured);
    const localHttp = parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

module.exports = { getPasteAppOrigin };
