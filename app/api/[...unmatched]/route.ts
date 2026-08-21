import { problem } from "@/lib/api-error"

// Catch-all for unknown /api/* paths.
//
// Without this, an unmatched API path falls through to the App Router's HTML
// 404 page — a browser-shaped response to a machine-shaped request. An agent
// that asked for JSON and got a React shell has to guess whether the endpoint is
// wrong, the payload is malformed, or the service is down. This returns the same
// RFC 9457 problem document every other failure on the site returns, with the
// index of real endpoints as the recovery hint.
//
// Static segments take priority over a catch-all in the App Router, so every
// real route above still wins; only genuinely unknown paths land here.

const KNOWN = [
  "architectures", "articles", "arxiv", "ask", "github", "health", "notes",
  "now", "patents", "posts", "posts/{slug}", "profile", "projects",
  "publications", "reading", "resume", "search", "snippets", "uses",
]

async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url)
  return problem({
    code: "not_found",
    detail: `No API endpoint at ${pathname}.`,
    hint: `Known endpoints: ${KNOWN.map((k) => `/api/${k}`).join(", ")}. The full spec is at /openapi.json; /llms.txt indexes every agent surface on the site.`,
    instance: pathname,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const HEAD = handler
export const OPTIONS = handler
