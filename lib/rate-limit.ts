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

// A 429 Response with the standard rate-limit headers, ready to return.
export function tooMany(result: RateLimitResult): Response {
  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000)
  return Response.json(
    {
      error: "rate limited",
      detail: `Too many requests. Try again in ~${retryAfterSec}s.`,
    },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfterSec),
        "x-ratelimit-limit": String(result.limit),
        "x-ratelimit-remaining": "0",
      },
    },
  )
}
