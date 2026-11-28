const ALLOWED_LEVELS = new Set(["info", "warn", "error"]);
const ALLOWED_FIELDS = new Set([
  "component", "route", "method", "statusCode", "durationMs",
  "requestId", "errorName", "operation"
]);

function safeText(value, maxLength = 100) {
  return typeof value === "string" ? value.replace(/[\r\n\t]/g, " ").slice(0, maxLength) : undefined;
}

function logEvent(event, fields = {}, level = "info", sink = console) {
  const normalizedLevel = ALLOWED_LEVELS.has(level) ? level : "info";
  const payload = {
    timestamp: new Date().toISOString(),
    event: safeText(event, 80) || "application_event"
  };
  for (const [key, value] of Object.entries(fields || {})) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (key === "statusCode" || key === "durationMs") {
      const number = Number(value);
      if (!Number.isFinite(number)) continue;
      payload[key] = Math.max(0, Math.floor(number));
    } else {
      const text = safeText(String(value), key === "requestId" ? 80 : 100);
      if (text) payload[key] = text;
    }
  }
  const output = JSON.stringify(payload);
  const writer = typeof sink[normalizedLevel] === "function" ? sink[normalizedLevel] : sink.log;
  writer.call(sink, output);
  return payload;
}

function createRequestTimer(now = Date.now) {
  const startedAt = now();
  return () => Math.max(0, Math.floor(now() - startedAt));
}

module.exports = { logEvent, createRequestTimer, ALLOWED_FIELDS };
