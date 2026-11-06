/**
 * Lightweight in-process rate limiter.
 * Suitable as a first line of defence. For multi-instance Workers/serverless,
 * replace with Cloudflare Rate Limiting / Durable Object / Redis counters.
 */
const buckets = new Map();

function keyOf(parts) {
  return parts.filter(Boolean).join('|');
}

export function checkRateLimit({
  scope,
  id,
  limit = 30,
  windowMs = 60_000,
} = {}) {
  const k = keyOf([scope, id]);
  const now = Date.now();
  let bucket = buckets.get(k);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(k, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 5000) {
    // opportunistic prune
    for (const [bk, bv] of buckets) {
      if (now - bv.windowStart >= windowMs * 2) buckets.delete(bk);
    }
  }
  const remaining = Math.max(0, limit - bucket.count);
  const resetMs = Math.max(0, windowMs - (now - bucket.windowStart));
  return {
    allowed: bucket.count <= limit,
    remaining,
    resetMs,
    limit,
  };
}

export function rateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
  };
}
