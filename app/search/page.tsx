import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { searchContent } from "@/lib/search"
import { SearchBox } from "./search-box"

export const metadata: Metadata = {
  title: "Search",
  description: "Search across projects, articles, blog posts, and arXiv digests.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
}

// Server component: reads ?q= and renders results in the initial HTML, so the
// schema.org SearchAction target works for crawlers and there's no loading flash.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = "" } = await searchParams
  const query = q.trim()
  const results = query ? searchContent(query) : []

  const toPath = (url: string) => {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  }

  return (
    <PageShell
      title="Search"
      lede="Search across everything — projects, articles, blog, daily arXiv digests, snippets, and notes."
      agentPath={{ json: "/api/search?q=" }}
    >
      <SearchBox initial={query} />

      <div className="mt-8">
        {query && results.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">
            no matches for “{query}”.
          </p>
        ) : (
          <ul className="space-y-5">
            {results.map((r) => (
              <li key={`${r.kind}-${r.slug}-${r.field}`}>
                <Link href={toPath(r.url)} className="group block">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="underline-offset-4 group-hover:underline">
                      {r.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {r.kind}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-muted-foreground">
                    {r.snippet}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  )
}
