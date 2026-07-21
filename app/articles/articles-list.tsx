"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  CaretLeftIcon,
  CaretRightIcon,
  StarIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Client list: a Featured filter + pagination. Articles arrive already
// newest-first from the loader; filtering only hides non-featured items and
// paging only windows the list — neither reorders, so it stays chronological.
// The ★ is a real solid Phosphor icon in a warm gold, not an ASCII glyph.
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
const PAGE_SIZE = 12

export function ArticlesList({ articles }: { articles: ArticleCard[] }) {
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const topRef = useRef<HTMLDivElement>(null)

  const featuredCount = articles.filter((a) => a.featured).length
  const filtered = featuredOnly
    ? articles.filter((a) => a.featured)
    : articles

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * PAGE_SIZE
  const shown = filtered.slice(start, start + PAGE_SIZE)

  // Restore page + filter from the URL on mount, so a refresh (or a shared/
  // bookmarked link) keeps you where you were instead of snapping back to page 1.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const p = Number(sp.get("page"))
    if (Number.isFinite(p) && p >= 1) setPage(p)
    if (sp.get("featured") === "1") setFeaturedOnly(true)
  }, [])

  // Reflect state back into the URL on user action (replaceState — no history spam).
  const writeUrl = (nextPage: number, nextFeatured: boolean) => {
    const sp = new URLSearchParams(window.location.search)
    if (nextPage > 1) sp.set("page", String(nextPage))
    else sp.delete("page")
    if (nextFeatured) sp.set("featured", "1")
    else sp.delete("featured")
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  const setFilter = (f: boolean) => {
    setFeaturedOnly(f)
    setPage(1)
    writeUrl(1, f)
  }
  const goto = (p: number) => {
    setPage(p)
    writeUrl(p, featuredOnly)
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const tab = (active: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )

  const arrow = (disabled: boolean) =>
    cn(
      "flex items-center rounded-md px-2 py-1 transition-colors",
      disabled
        ? "cursor-not-allowed text-muted-foreground/40"
        : "cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50",
    )

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter(false)}
          aria-pressed={!featuredOnly}
          className={tab(!featuredOnly)}
        >
          All <span className="tabular-nums opacity-50">{articles.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter(true)}
          aria-pressed={featuredOnly}
          className={tab(featuredOnly)}
        >
          <StarIcon size={13} weight="fill" style={{ color: STAR }} />
          Featured{" "}
          <span className="tabular-nums opacity-50">{featuredCount}</span>
        </button>
        {filtered.length ? (
          <span className="ml-auto font-mono text-xs text-muted-foreground/70 tabular-nums">
            {start + 1}–{start + shown.length} of {filtered.length}
          </span>
        ) : null}
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

      {totalPages > 1 ? (
        <nav
          className="mt-10 flex items-center justify-center gap-1 font-mono text-xs"
          aria-label="Pagination"
        >
          <button
            type="button"
            onClick={() => current > 1 && goto(current - 1)}
            disabled={current === 1}
            aria-label="Previous page"
            className={arrow(current === 1)}
          >
            <CaretLeftIcon size={14} weight="bold" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goto(p)}
              aria-current={p === current ? "page" : undefined}
              className={cn(
                "min-w-8 cursor-pointer rounded-md px-2 py-1 tabular-nums transition-colors",
                p === current
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => current < totalPages && goto(current + 1)}
            disabled={current === totalPages}
            aria-label="Next page"
            className={arrow(current === totalPages)}
          >
            <CaretRightIcon size={14} weight="bold" />
          </button>
        </nav>
      ) : null}
    </div>
  )
}
