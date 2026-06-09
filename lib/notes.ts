import type { Note } from "@/lib/content"

// Digital-garden plumbing: parse [[wikilinks]] in note bodies, resolve the
// backlink graph, and rewrite links to markdown for rendering.

// Match [[Link Text]] — captures the inner text (non-greedy, no nested brackets).
const WIKILINK_RE = /\[\[([^\]]+?)\]\]/g

// "Point Cloud Registration" → "point-cloud-registration". Matches the note
// file slugs (kebab-case), so a [[wikilink]] resolves to a note by slug.
export function slugifyLink(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// All wikilink targets in a body, as slugs, de-duplicated and order-preserved.
export function extractWikilinks(body: string): string[] {
  const slugs: string[] = []
  const seen = new Set<string>()
  for (const match of body.matchAll(WIKILINK_RE)) {
    const slug = slugifyLink(match[1])
    if (slug && !seen.has(slug)) {
      seen.add(slug)
      slugs.push(slug)
    }
  }
  return slugs
}

// slug → notes that link TO it. The inverse of each note's outbound wikilinks.
export function resolveBacklinks(notes: Note[]): Map<string, Note[]> {
  const backlinks = new Map<string, Note[]>()
  for (const note of notes) {
    for (const target of extractWikilinks(note.body)) {
      const list = backlinks.get(target) ?? []
      list.push(note)
      backlinks.set(target, list)
    }
  }
  return backlinks
}

// Replace [[Link Text]] with [Link Text](/notes/link-text) so a markdown
// renderer (or our minimal parser) can turn them into real links.
export function renderWikilinksToMarkdown(body: string): string {
  return body.replace(WIKILINK_RE, (_, text: string) => {
    const slug = slugifyLink(text)
    return `[${text.trim()}](/notes/${slug})`
  })
}
