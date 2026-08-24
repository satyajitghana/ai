// Accept-header negotiation for the markdown variants (acceptmarkdown.com).
//
// The rule that matters: an agent sending `Accept: text/markdown` should get
// markdown, and a browser sending the usual `text/html,...;q=0.9,*/*;q=0.8`
// should keep getting HTML. So we parse q-values properly rather than substring
// matching — `*/*` must NOT count as a request for markdown, or every browser on
// earth starts receiving .md files.

type Ranked = { type: string; q: number }

function parseAccept(header: string): Ranked[] {
  return header
    .split(",")
    .map((part) => {
      const [type, ...params] = part.trim().split(";")
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      const q = qParam ? Number(qParam.slice(2)) : 1
      return { type: type.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter((r) => r.type && r.q > 0)
}

const MARKDOWN = new Set(["text/markdown", "text/x-markdown", "text/plain"])

/**
 * True when the client explicitly asked for markdown and did not ask for HTML
 * at an equal-or-higher quality. Wildcards never win — only a named markdown
 * type does.
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false
  const ranked = parseAccept(acceptHeader)

  let md = 0
  let html = 0
  for (const { type, q } of ranked) {
    if (MARKDOWN.has(type)) md = Math.max(md, q)
    if (type === "text/html" || type === "application/xhtml+xml") html = Math.max(html, q)
  }

  return md > 0 && md > html
}

/**
 * True when the client explicitly named an HTML type — i.e. it is a browser.
 * A wildcard does not count: the `star/star` Accept that curl, crawlers and most
 * SDKs send names no type at all, and those callers are better served a
 * machine-readable representation than a styled page. Used to decide which 404
 * body to return.
 */
export function prefersHtml(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false
  return parseAccept(acceptHeader).some(
    ({ type }) => type === "text/html" || type === "application/xhtml+xml",
  )
}
