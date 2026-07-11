"use client"

import { useState } from "react"
import Link from "next/link"
import { StarIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Client list so we can offer a Featured filter. Articles arrive already
// newest-first from the loader; the filter only hides non-featured items, it
// never reorders, so the list stays chronological. The ★ is a real solid
// Phosphor icon in a warm gold, not an ASCII glyph.
type ArticleCard = {
  slug: string
  title: string
  date: string
  description: string
  readingTimeMins: number
  tags: string[]
  featured: boolean
}

const STAR = "oklch(0.79 0.15 82)" // warm gold

export function ArticlesList({ articles }: { articles: ArticleCard[] }) {
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const featuredCount = articles.filter((a) => a.featured).length
  const shown = featuredOnly ? articles.filter((a) => a.featured) : articles

  const tab = (active: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFeaturedOnly(false)}
          aria-pressed={!featuredOnly}
          className={tab(!featuredOnly)}
        >
          All <span className="tabular-nums opacity-50">{articles.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setFeaturedOnly(true)}
          aria-pressed={featuredOnly}
          className={tab(featuredOnly)}
        >
          <StarIcon size={13} weight="fill" style={{ color: STAR }} />
          Featured{" "}
          <span className="tabular-nums opacity-50">{featuredCount}</span>
        </button>
      </div>

      <ul className="space-y-8" data-stagger>
        {shown.map((a) => (
          <li key={a.slug}>
            <Link href={`/articles/${a.slug}`} className="group block">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-heading text-lg font-semibold underline-offset-4 group-hover:underline">
                  {a.title}
                  {a.featured ? (
                    <StarIcon
                      size={15}
                      weight="fill"
                      aria-label="Featured"
                      className="ml-2 inline-block align-[-0.12em]"
                      style={{ color: STAR }}
                    />
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
    </>
  )
}
