import { getAllContent } from "@/lib/content"

export type SearchResult = {
  kind: string
  slug: string
  title: string
  url: string
  field: string
  snippet: string
}

// In-memory substring/tag search across the whole corpus. Shared by the
// /api/search route (JSON for agents) and the /search page (server-rendered
// HTML for humans + crawlers). The corpus is one person's writing, so a linear
// scan is plenty.
export function searchContent(query: string, limit = 20): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchResult[] = []
  for (const item of getAllContent()) {
    const title = String(item.title ?? item.slug)
    const fields: Array<[string, string]> = [
      ["title", title.toLowerCase()],
      ["description", String(item.description ?? "").toLowerCase()],
      ["tags", JSON.stringify(item.tags ?? []).toLowerCase()],
      ["body", item.body.toLowerCase()],
    ]
    for (const [field, text] of fields) {
      const idx = text.indexOf(q)
      if (idx !== -1) {
        const start = Math.max(0, idx - 120)
        results.push({
          kind: item.kind,
          slug: item.slug,
          title,
          url: item.url,
          field,
          snippet: text.slice(start, idx + q.length + 120),
        })
        break
      }
    }
    if (results.length >= limit) break
  }
  return results
}
