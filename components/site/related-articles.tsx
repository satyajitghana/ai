import Link from "next/link"

import { getArticles } from "@/lib/content"

// Related articles, computed from tag overlap at build time.
//
// This exists for two reasons, one for readers and one for crawlers.
//
// Readers: an article that ends in nothing is a dead end. 36% of this corpus
// had no outbound link to another article.
//
// Crawlers: 48% of articles had no *inbound* internal link at all, which is
// what an orphan page is. Orphans get crawled less and rank worse, and the
// problem lands hardest on the newest work, which has had least time to be
// linked to by hand. Tag overlap fixes that automatically and keeps fixing it.
//
// The anchor text is the related article's own title — descriptive, and unique
// per target, which is what an audit means when it complains about repeated or
// over-long anchors. Deliberately NOT "read more" or a truncated sentence.
function score(a: readonly string[], b: readonly string[]): number {
  const B = new Set(b)
  let shared = 0
  for (const t of a) if (B.has(t)) shared++
  if (shared === 0) return 0
  // Jaccard, so an article tagged with five things does not out-rank a tightly
  // matched pair just by having more tags to collide on.
  return shared / (a.length + b.length - shared)
}

export function RelatedArticles({ slug, limit = 4 }: { slug: string; limit?: number }) {
  const all = getArticles()
  const self = all.find((a) => a.slug === slug)
  if (!self) return null

  const tags = self.tags ?? []
  const ranked = all
    .filter((a) => a.slug !== slug)
    .map((a) => ({ a, s: score(tags, a.tags ?? []) }))
    .filter((r) => r.s > 0)
    // tie-break by recency so the set stays fresh as the corpus grows
    .sort((x, y) => y.s - x.s || y.a.date.localeCompare(x.a.date))
    .slice(0, limit)

  if (ranked.length === 0) return null

  return (
    <nav aria-labelledby="related-heading" className="mt-16 border-t pt-8">
      <h2
        id="related-heading"
        className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
      >
        Related articles
      </h2>
      <ul className="mt-4 space-y-4">
        {ranked.map(({ a }) => (
          <li key={a.slug}>
            <Link
              href={`/articles/${a.slug}`}
              className="font-heading text-lg font-semibold tracking-tight underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
            >
              {a.title}
            </Link>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {a.description}
            </p>
          </li>
        ))}
      </ul>
    </nav>
  )
}
