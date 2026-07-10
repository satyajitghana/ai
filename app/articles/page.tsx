import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { getArticles } from "@/lib/content"

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Curated long-form writing on AI — explainers and essays.",
  alternates: { canonical: "/articles" },
}

export default function Page() {
  // Strictly newest-first by date (from the loader). `featured` is shown as a ★
  // badge but does NOT change ordering — the list stays chronological.
  const articles = getArticles()

  return (
    <PageShell
      title="Articles"
      lede="Curated long-form writing on AI — explainers and essays."
      agentPath={{ json: "/api/articles" }}
    >
      <ul className="space-y-8" data-stagger>
        {articles.map((a) => (
          <li key={a.slug}>
            <Link href={`/articles/${a.slug}`} className="group block">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-heading text-lg font-semibold underline-offset-4 group-hover:underline">
                  {a.title}
                  {a.featured ? (
                    <span
                      className="ml-2 font-mono text-xs text-muted-foreground"
                      title="Featured"
                    >
                      ★
                    </span>
                  ) : null}
                </h2>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {a.date}
                </span>
              </div>
              <p className="mt-1 leading-7 text-muted-foreground">
                {a.description}
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {a.readingTimeMins} min
                {a.tags.length ? ` · ${a.tags.join(" · ")}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
