import Link from "next/link"

import type { Article } from "@/lib/content"
import { getArticles } from "@/lib/content"
import { linkPlan } from "@/lib/related"

// Renders the "Related articles" block from the build-time link plan in
// `lib/related.ts` — see that file for why the plan is global rather than
// per-page.
//
// The anchor text is the related article's own title: descriptive, and unique
// per target, which is what an audit means when it complains about repeated or
// over-long anchors. Deliberately NOT "read more" or a truncated sentence.
export function RelatedArticles({ slug }: { slug: string }) {
  const bySlug = new Map(getArticles().map((a) => [a.slug, a]))
  const related = (linkPlan().related.get(slug) ?? [])
    .map((s) => bySlug.get(s))
    .filter((a): a is Article => Boolean(a))

  if (related.length === 0) return null

  return (
    <nav aria-labelledby="related-heading" className="mt-16 border-t pt-8">
      <h2
        id="related-heading"
        className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
      >
        Related articles
      </h2>
      <ul className="mt-4 space-y-4">
        {related.map((a) => (
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
