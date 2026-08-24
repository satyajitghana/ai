import { absoluteUrl, siteUrl } from "@/lib/site"

// The markdown recovery document served for any path that does not exist.
//
// A bare 404 tells a crawler the path is wrong but not where to go instead, so
// it either gives up or guesses. This hands back the same map the HTML 404
// shows a human — sitemap, llms.txt, the API spec, the section indexes — in a
// representation a non-browser client can parse without running JavaScript.
//
// It lives in lib/ rather than in a route because three callers need it: the
// markdown route (`/blog/nope.md`), the proxy (any unmatched path from a client
// that did not explicitly ask for HTML), and the agent-surface check script.

export const SECTIONS = ["articles", "blog", "logs", "projects", "arxiv", "notes", "snippets"] as const

export function notFoundMarkdown(path: string): string {
  return [
    "# 404 — not found",
    "",
    `No page at \`${path}\` on ${siteUrl}.`,
    "",
    "## Where to look next",
    "",
    `- [/llms.txt](${absoluteUrl("/llms.txt")}) — curated index of every page and agent surface`,
    `- [/llms-full.txt](${absoluteUrl("/llms-full.txt")}) — the entire content corpus in one file`,
    `- [/sitemap.xml](${absoluteUrl("/sitemap.xml")}) — every canonical URL`,
    `- [/openapi.json](${absoluteUrl("/openapi.json")}) — the JSON API spec`,
    `- [/developers](${absoluteUrl("/developers")}) — how to call this site programmatically`,
    "",
    "## Sections",
    "",
    ...SECTIONS.map((s) => `- [/${s}](${absoluteUrl(`/${s}`)})`),
    "",
    "## Search",
    "",
    `Full-text search: \`GET ${absoluteUrl("/api/search")}?q=<terms>\``,
    "",
    "Any page also has a markdown twin: append `.md` to its URL, or send `Accept: text/markdown`.",
    "",
  ].join("\n")
}

/** Headers for a markdown 404, shared by every caller that serves one. */
export const NOT_FOUND_MARKDOWN_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  "cache-control": "no-store",
  vary: "Accept, Accept-Encoding",
} as const
