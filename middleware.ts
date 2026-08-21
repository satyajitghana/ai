import { NextResponse, type NextRequest } from "next/server"

import { prefersMarkdown } from "@/lib/accept"
import { READ_LIMIT, clientKey, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

// Two agent-facing concerns that have to happen before a route handler runs.
//
// 1. Markdown content negotiation (acceptmarkdown.com). The site already serves
//    a markdown twin of every page at `<path>.md`. This makes the same content
//    reachable by Accept negotiation, so an agent that sets
//    `Accept: text/markdown` gets markdown from the canonical URL. Every
//    negotiated response carries `Vary: Accept` — without it a CDN can cache the
//    HTML variant and hand it to an agent asking for markdown, or vice versa,
//    depending purely on which one landed in the cache first.
//
// 2. RateLimit headers (RFC 9331) on every /api/* response, not just the 429s.
//    An agent can only self-throttle if it learns its budget while it is still
//    inside it. The expensive model endpoints keep their own stricter in-handler
//    limits; this is the loose outer guard that makes the policy visible.

// Paths with a markdown twin, mirroring the rewrites in next.config.ts.
const MD_COLLECTIONS = new Set([
  "blog", "articles", "logs", "projects", "arxiv", "snippets", "notes",
])
const MD_PAGES = new Set(["about", "resume", "health", "now", "uses", "reading"])

function markdownTarget(pathname: string): string | null {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/")
  if (parts.length === 1 && MD_PAGES.has(parts[0])) return `/md/${parts[0]}`
  if (parts.length === 2 && MD_COLLECTIONS.has(parts[0])) return `/md/${parts[0]}/${parts[1]}`
  return null
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // --- /api/*: advertise the rate-limit budget on every response -------------
  if (pathname.startsWith("/api/")) {
    const result = rateLimit(`read:${clientKey(req)}`, READ_LIMIT)
    const headers = rateLimitHeaders(result, READ_LIMIT)

    if (!result.ok) {
      const retryAfter = Math.ceil(result.retryAfterMs / 1000)
      return NextResponse.json(
        {
          type: "https://ai.thesatyajit.com/developers#error-rate_limited",
          title: "Too Many Requests",
          status: 429,
          code: "rate_limited",
          detail: `Too many requests. Try again in ~${retryAfter}s.`,
          hint: "Read the RateLimit header for your remaining budget. Static JSON under /api/* is cacheable — cache it rather than re-fetching.",
          instance: pathname,
          docs: "https://ai.thesatyajit.com/openapi.json",
        },
        {
          status: 429,
          headers: {
            ...headers,
            "retry-after": String(retryAfter),
            "content-type": "application/problem+json; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      )
    }

    const res = NextResponse.next()
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
    return res
  }

  // --- pages: negotiate markdown, and always vary on Accept -----------------
  const target = markdownTarget(pathname)

  if (target && prefersMarkdown(req.headers.get("accept"))) {
    const res = NextResponse.rewrite(new URL(target, req.url))
    res.headers.set("vary", "Accept, Accept-Encoding")
    return res
  }

  const res = NextResponse.next()
  if (target) res.headers.set("vary", "Accept, Accept-Encoding")
  return res
}

export const config = {
  matcher: [
    "/api/:path*",
    "/about", "/resume", "/health", "/now", "/uses", "/reading",
    "/blog/:slug", "/articles/:slug", "/logs/:slug",
    "/projects/:slug", "/arxiv/:slug", "/snippets/:slug", "/notes/:slug",
  ],
}
