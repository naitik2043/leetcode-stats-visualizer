function cacheMetadata(fetchedAtMs, now = Date.now(), freshTtlMs = 5 * 60 * 1000, staleTtlMs = 60 * 60 * 1000) {
  const ageMs = Math.max(0, now - Number(fetchedAtMs));
  const ageSeconds = Math.floor(ageMs / 1000);
  const fresh = ageMs < freshTtlMs;
  const usable = ageMs < staleTtlMs;
  return {
    state: fresh ? "fresh" : usable ? "stale" : "expired",
    stale: !fresh,
    ageSeconds,
    fetchedAt: new Date(Number(fetchedAtMs)).toISOString(),
    freshForSeconds: Math.max(0, Math.ceil((freshTtlMs - ageMs) / 1000)),
    expiresInSeconds: Math.max(0, Math.ceil((staleTtlMs - ageMs) / 1000))
  };
}

module.exports = { cacheMetadata };
