// A tiny in-memory rate limiter — a mini WAF for the agent endpoints so a burst
// of requests can't run up the model bill or knock the chat over. Two fixed
// windows per client: a short BURST guard and a longer SUSTAINED cap; a request
// must pass both. Keyed by client IP (best-effort from proxy headers).
//
// Caveat: state lives in module memory, so on a serverless/multi-instance host
// each instance limits independently — this stops obvious bombardment, not a
// determined distributed attacker. A global limit needs a shared store (KV /
// Redis); this is deliberately dependency-free.

type Window = { count: number; resetAt: number }
type Entry = { burst: Window; sustained: Window }

const clients = new Map<string, Entry>()
let lastSweep = 0

export type RateLimitRule = {
  burst: { limit: number; windowMs: number }
  sustained: { limit: number; windowMs: number }
}

// Defaults sized for a human at a chat box (or a well-behaved agent): a few
// requests in a burst, a couple dozen a minute. Tune per route.
export const CHAT_LIMIT: RateLimitRule = {
  burst: { limit: 5, windowMs: 10_000 },
  sustained: { limit: 20, windowMs: 60_000 },
}

export const ASK_LIMIT: RateLimitRule = {
  burst: { limit: 8, windowMs: 10_000 },
  sustained: { limit: 30, windowMs: 60_000 },
}

// The loose outer guard applied to every /api/* response in middleware. Sized so
// an agent walking the whole content API never notices it, while a runaway loop
// still gets told to stop. The expensive model endpoints keep their own stricter
// rules on top of this one.
export const READ_LIMIT: RateLimitRule = {
  burst: { limit: 30, windowMs: 10_000 },
  sustained: { limit: 240, windowMs: 60_000 },
}

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  retryAfterMs: number
}

function bump(w: Window | undefined, now: number, windowMs: number): Window {
  if (!w || w.resetAt <= now) return { count: 1, resetAt: now + windowMs }
  w.count += 1
  return w
}

export function rateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  // opportunistic sweep of expired entries so the map can't grow unbounded
  if (now - lastSweep > 30_000) {
    lastSweep = now
    for (const [k, e] of clients) {
      if (e.burst.resetAt <= now && e.sustained.resetAt <= now) clients.delete(k)
    }
  }

  const prev = clients.get(key)
  const burst = bump(prev?.burst, now, rule.burst.windowMs)
  const sustained = bump(prev?.sustained, now, rule.sustained.windowMs)
  clients.set(key, { burst, sustained })

  const burstOk = burst.count <= rule.burst.limit
  const sustainedOk = sustained.count <= rule.sustained.limit
  const ok = burstOk && sustainedOk

  // report against the window that's actually binding
  const retryAfterMs = ok
    ? 0
    : Math.max(
        burstOk ? 0 : burst.resetAt - now,
        sustainedOk ? 0 : sustained.resetAt - now,
      )

  return {
    ok,
    limit: rule.sustained.limit,
    remaining: Math.max(0, rule.sustained.limit - sustained.count),
    retryAfterMs,
  }
}

// Best-effort client identity from the usual proxy headers.
export function clientKey(req: Request): string {
  const h = req.headers
  const xff = h.get("x-forwarded-for")
  const ip =
    (xff ? xff.split(",")[0]?.trim() : "") ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  return ip
}

/**
 * RFC 9331 rate-limit headers, plus the legacy `X-RateLimit-*` trio that most
 * existing clients already read.
 *
 * These go on SUCCESSFUL responses too, not only on 429s — an agent can only
 * pace itself if it learns the budget while it still has one. `RateLimit-Policy`
 * publishes the quota so a client can plan a walk of the API before starting it.
 */
export function rateLimitHeaders(
  result: RateLimitResult,
  rule: RateLimitRule,
  now = Date.now(),
): Record<string, string> {
  const resetSec = Math.max(0, Math.ceil(result.retryAfterMs / 1000)) || Math.ceil(rule.sustained.windowMs / 1000)
  return {
    // RFC 9331 (draft-ietf-httpapi-ratelimit-headers) structured fields.
    "ratelimit": `limit=${result.limit}, remaining=${result.remaining}, reset=${resetSec}`,
    "ratelimit-policy": `${rule.sustained.limit};w=${Math.ceil(rule.sustained.windowMs / 1000)}, ${rule.burst.limit};w=${Math.ceil(rule.burst.windowMs / 1000)}`,
    // Legacy trio, still what most SDKs look for.
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(Math.floor(now / 1000) + resetSec),
  }
}

// A 429 Response with the standard rate-limit headers, ready to return. The body
// is an RFC 9457 problem document, same as every other error on the site.
export function tooMany(result: RateLimitResult, rule: RateLimitRule = ASK_LIMIT): Response {
  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000)
  return new Response(
    JSON.stringify(
      {
        type: "https://ai.thesatyajit.com/developers#error-rate_limited",
        title: "Too Many Requests",
        status: 429,
        code: "rate_limited",
        detail: `Too many requests. Try again in ~${retryAfterSec}s.`,
        hint: "Wait for the interval in Retry-After, then resume. Read the RateLimit header to pace subsequent calls.",
        docs: "https://ai.thesatyajit.com/openapi.json",
      },
      null,
      2,
    ),
    {
      status: 429,
      headers: {
        "content-type": "application/problem+json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": String(retryAfterSec),
        ...rateLimitHeaders(result, rule),
      },
    },
  )
}
