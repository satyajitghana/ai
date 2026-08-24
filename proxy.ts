import { NextResponse, type NextRequest } from "next/server"

import { prefersHtml, prefersMarkdown } from "@/lib/accept"
import { API_VERSION, DEPRECATION_POLICY_URL, LINK_HEADER } from "@/lib/discovery"
import { NOT_FOUND_MARKDOWN_HEADERS, notFoundMarkdown } from "@/lib/not-found"
import { READ_LIMIT, clientKey, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

// Four agent-facing concerns that have to happen before a route handler runs.
//
// Named `proxy` rather than `middleware`: Next 16.2 deprecated the middleware
// file convention in favour of this one. Same signature, same matcher config.
//
// 1. Markdown content negotiation (acceptmarkdown.com). The site already serves
//    a markdown twin of every page at `<path>.md`. This makes the same content
//    reachable by Accept negotiation, so an agent that sets
//    `Accept: text/markdown` gets markdown from the canonical URL. Every
//    negotiated response carries `Vary: Accept` — without it a CDN can cache the
//    HTML variant and hand it to an agent asking for markdown, or vice versa,
//    depending purely on which one landed in the cache first.
//
// 2. A 404 the caller can act on. Any path that is not a known route is
//    answered here rather than by the HTML not-found page, whenever the client
//    did not explicitly ask for HTML. A browser sends
//    `text/html,...;q=0.9,*/*;q=0.8` and keeps the styled page; curl, a crawler
//    or an SDK sends `*/*` or `text/markdown` and gets the markdown recovery
//    map instead, at a real 404.
//
// 3. Link headers (RFC 8288) advertising the discovery documents. An agent that
//    fetches one page should not have to guess that an OpenAPI spec, an API
//    catalog and an MCP server exist — the relations say so in the response it
//    already has, before it parses a byte of the body.
//
// 4. RateLimit headers (RFC 9331) on every /api/* response, not just the 429s,
//    plus the version and deprecation-policy headers that tell a client which
//    contract it is bound to and where the sunset rules live.

// Paths with a markdown twin, mirroring the rewrites in next.config.ts.
const MD_COLLECTIONS = new Set([
  "blog", "articles", "logs", "projects", "arxiv", "snippets", "notes",
])
const MD_PAGES = new Set(["about", "resume", "health", "now", "uses", "reading"])

// Every top-level path this site actually serves. Used only to decide whether an
// unmatched request should be answered with the markdown 404 — Next still owns
// real routing, and anything listed here falls through untouched.
const KNOWN_TOP = new Set([
  "", "about", "architectures", "articles", "arxiv", "blog", "changelog",
  "colophon", "contact", "developers", "github", "health", "logs", "models",
  "notes", "now", "patents", "privacy", "projects", "publications", "reading",
  "resume", "search", "snippets", "uses",
  // machine-readable documents served as routes or static files
  "ai.txt", "auth.md", "feed.xml", "humans.txt", "llms.txt", "llms-full.txt",
  "openapi.json", "resume.json", "robots.txt", "sitemap.xml",
  "satyajit-ghana-resume.pdf",
])

function markdownTarget(pathname: string): string | null {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)
  if (parts.length === 0) return "/md/home"
  if (parts.length === 1 && MD_PAGES.has(parts[0])) return `/md/${parts[0]}`
  if (parts.length === 2 && MD_COLLECTIONS.has(parts[0])) return `/md/${parts[0]}/${parts[1]}`
  return null
}

// Paths the proxy must never answer itself: build output, static assets, and the
// route namespaces that own their own 404 representations.
function isReserved(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true
  if (pathname.startsWith("/api/")) return true
  if (pathname.startsWith("/md/")) return true
  if (pathname.startsWith("/.well-known/")) return true
  // Anything with a file extension is a static asset or a machine-readable
  // document — including the `.md` twins, which next.config.ts rewrites.
  return /\.[a-z0-9]+$/i.test(pathname)
}

/** True when this path is not a route the site serves, so a 404 is certain. */
function isUnknownPath(pathname: string): boolean {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)
  if (parts.length === 0) return false
  if (!KNOWN_TOP.has(parts[0])) return true
  // Collections take exactly one slug below them; deeper paths do not exist.
  if (parts.length > 2) return true
  return false
}

// Read-only everywhere except the two endpoints that take a body. `/api/mcp/*`
// is the JSON-RPC transport and owns its own method handling.
const METHOD_ALLOWED = new Set(["GET", "HEAD", "OPTIONS"])
const acceptsPost = (pathname: string) =>
  pathname === "/api/ask" ||
  pathname === "/api/v1/ask" ||
  pathname === "/api/chat" ||
  pathname.startsWith("/api/mcp")

/** `Vary: Accept` must survive whatever Next appends for RSC negotiation. */
function varyOnAccept(res: NextResponse) {
  const existing = res.headers.get("vary")
  const parts = existing ? existing.split(",").map((p) => p.trim()).filter(Boolean) : []
  for (const v of ["Accept", "Accept-Encoding"]) {
    if (!parts.some((p) => p.toLowerCase() === v.toLowerCase())) parts.push(v)
  }
  res.headers.set("vary", parts.join(", "))
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // --- /api/*: advertise the rate-limit budget, version and sunset policy ----
  if (pathname.startsWith("/api/")) {
    // Next answers an unhandled method with a bare 405 — no body, no
    // content-type. The spec promises `application/problem+json` on every
    // non-2xx, and a promise the server does not keep is worse than one it
    // never made, so the envelope is applied here rather than by adding stub
    // handlers to nineteen route files.
    if (!METHOD_ALLOWED.has(req.method) && !acceptsPost(pathname)) {
      return NextResponse.json(
        {
          type: "https://ai.thesatyajit.com/developers#error-method_not_allowed",
          title: "Method Not Allowed",
          status: 405,
          code: "method_not_allowed",
          detail: `${req.method} is not supported on ${pathname}.`,
          hint: "Every endpoint here is read-only except POST /api/ask. Use GET.",
          instance: pathname,
          docs: "https://ai.thesatyajit.com/openapi.json",
        },
        {
          status: 405,
          headers: {
            allow: "GET, HEAD, OPTIONS",
            "content-type": "application/problem+json; charset=utf-8",
            "cache-control": "no-store",
            "api-version": API_VERSION,
            vary: "Accept, Accept-Encoding",
          },
        },
      )
    }

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
            "api-version": API_VERSION,
            vary: "Accept, Accept-Encoding",
          },
        },
      )
    }

    const res = NextResponse.next()
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
    res.headers.set("link", `${LINK_HEADER}, <${DEPRECATION_POLICY_URL}>; rel="deprecation"; type="text/html"; title="Versioning and deprecation policy"`)
    // Which contract this response was produced under. No Deprecation/Sunset
    // header accompanies it because v1 is current and unscheduled — when a
    // version is retired those headers appear here alongside this one, which is
    // exactly the signal the policy at DEPRECATION_POLICY_URL promises.
    res.headers.set("api-version", API_VERSION)
    varyOnAccept(res)
    return res
  }

  // --- unknown paths: a 404 with a body a non-browser can use ---------------
  if (!isReserved(pathname) && isUnknownPath(pathname)) {
    const accept = req.headers.get("accept")
    if (!prefersHtml(accept)) {
      return new Response(notFoundMarkdown(pathname), {
        status: 404,
        headers: { ...NOT_FOUND_MARKDOWN_HEADERS, link: LINK_HEADER },
      })
    }
    // A browser: let Next render the styled 404 page, but still say that the
    // representation depends on Accept so a cache keeps the two apart.
    const res = NextResponse.next()
    res.headers.set("link", LINK_HEADER)
    varyOnAccept(res)
    return res
  }

  // --- pages: negotiate markdown, and always vary on Accept -----------------
  const target = markdownTarget(pathname)

  if (target && prefersMarkdown(req.headers.get("accept"))) {
    const res = NextResponse.rewrite(new URL(target, req.url))
    res.headers.set("link", LINK_HEADER)
    varyOnAccept(res)
    return res
  }

  const res = NextResponse.next()
  res.headers.set("link", LINK_HEADER)
  varyOnAccept(res)
  return res
}

export const config = {
  matcher: [
    // Everything except build output and files with an extension, so unknown
    // paths reach the 404 branch above. Route namespaces that own their own
    // error representations are filtered inside `isReserved`.
    "/((?!_next/static|_next/image).*)",
  ],
}
