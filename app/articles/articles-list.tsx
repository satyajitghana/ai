"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  CaretLeftIcon,
  CaretRightIcon,
  StarIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Client list: filter (All / Featured / High-signal), sort (newest / signal /
// interest / helpful), pagination — all persisted to the URL. Articles arrive
// newest-first; "newest" keeps that order, the other sorts reorder a copy.
// Each card carries a signal badge: 1–5 bars derived from the article's own
// `interest` + `helpful` frontmatter (see lib/content/schema.ts).
type ArticleCard = {
  slug: string
  title: string
  date: string
  description: string
  readingTimeMins: number
  tags: string[]
  featured: boolean
  interest: number
  helpful: number
  signal: number // 1–5 level, 0 = unrated
  signalLabel: string
}

const STAR = "oklch(0.79 0.15 82)" // warm gold
const PAGE_SIZE = 12

// signal level → color for the filled bars (green = high signal, fading down)
const SIGNAL_COLOR: Record<number, string> = {
  5: "oklch(0.7 0.17 145)",
  4: "oklch(0.68 0.14 155)",
  3: "oklch(0.66 0.12 230)",
  2: "oklch(0.7 0.06 250)",
  1: "oklch(0.6 0.03 260)",
}

function SignalBars({ level, label, interest, helpful }: { level: number; label: string; interest: number; helpful: number }) {
  if (!level) return null
  const color = SIGNAL_COLOR[level] ?? SIGNAL_COLOR[1]
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Signal: ${label} · interest ${interest}/5 · helpful ${helpful}/5`}
    >
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((b) => (
          <span
            key={b}
            className="w-[3px] rounded-[1px]"
            style={{
              height: `${3 + b * 2}px`,
              background: b <= level ? color : "var(--muted)",
              opacity: b <= level ? 1 : 0.6,
            }}
          />
        ))}
      </span>
      <span className="font-mono text-[10px]" style={{ color }}>{label}</span>
    </span>
  )
}

type Filter = "all" | "featured" | "high"
type Sort = "new" | "signal" | "interest" | "helpful"

const SORTS: { key: Sort; label: string }[] = [
  { key: "new", label: "newest" },
  { key: "signal", label: "signal" },
  { key: "interest", label: "interesting" },
  { key: "helpful", label: "helpful" },
]

export function ArticlesList({ articles }: { articles: ArticleCard[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<Sort>("new")
  const [page, setPage] = useState(1)
  const topRef = useRef<HTMLDivElement>(null)

  const featuredCount = articles.filter((a) => a.featured).length
  const highCount = articles.filter((a) => a.signal >= 4).length

  const filtered = articles.filter((a) =>
    filter === "featured" ? a.featured : filter === "high" ? a.signal >= 4 : true,
  )

  // "newest" preserves incoming order; other sorts reorder a copy, tie-broken by date.
  const sorted =
    sort === "new"
      ? filtered
      : [...filtered].sort((a, b) => {
          const key = sort === "signal" ? "signal" : sort === "interest" ? "interest" : "helpful"
          return b[key] - a[key] || b.date.localeCompare(a.date)
        })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * PAGE_SIZE
  const shown = sorted.slice(start, start + PAGE_SIZE)

  // Restore filter + sort + page from the URL on mount (shareable, refresh-safe).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const f = sp.get("filter")
    if (f === "high" || f === "featured") setFilter(f)
    else if (sp.get("featured") === "1") setFilter("featured") // back-compat
    const s = sp.get("sort")
    if (s === "signal" || s === "interest" || s === "helpful") setSort(s)
    const p = Number(sp.get("page"))
    if (Number.isFinite(p) && p >= 1) setPage(p)
  }, [])

  const writeUrl = (nextFilter: Filter, nextSort: Sort, nextPage: number) => {
    const sp = new URLSearchParams(window.location.search)
    sp.delete("featured") // drop the legacy param
    if (nextFilter !== "all") sp.set("filter", nextFilter)
    else sp.delete("filter")
    if (nextSort !== "new") sp.set("sort", nextSort)
    else sp.delete("sort")
    if (nextPage > 1) sp.set("page", String(nextPage))
    else sp.delete("page")
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  const applyFilter = (f: Filter) => {
    setFilter(f)
    setPage(1)
    writeUrl(f, sort, 1)
  }
  const applySort = (s: Sort) => {
    setSort(s)
    setPage(1)
    writeUrl(filter, s, 1)
  }
  const goto = (p: number) => {
    setPage(p)
    writeUrl(filter, sort, p)
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => applyFilter("all")} aria-pressed={filter === "all"} className={tab(filter === "all")}>
          All <span className="tabular-nums opacity-50">{articles.length}</span>
        </button>
        <button type="button" onClick={() => applyFilter("featured")} aria-pressed={filter === "featured"} className={tab(filter === "featured")}>
          <StarIcon size={13} weight="fill" style={{ color: STAR }} />
          Featured <span className="tabular-nums opacity-50">{featuredCount}</span>
        </button>
        <button type="button" onClick={() => applyFilter("high")} aria-pressed={filter === "high"} className={tab(filter === "high")}>
          <span className="flex items-end gap-[2px]" aria-hidden="true">
            {[1, 2, 3].map((b) => (
              <span key={b} className="w-[3px] rounded-[1px]" style={{ height: `${3 + b * 2}px`, background: SIGNAL_COLOR[4] }} />
            ))}
          </span>
          High signal <span className="tabular-nums opacity-50">{highCount}</span>
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground/70">sort</span>
        {SORTS.map((s) => (
          <button key={s.key} type="button" onClick={() => applySort(s.key)} aria-pressed={sort === s.key} className={tab(sort === s.key)}>
            {s.label}
          </button>
        ))}
        {sorted.length ? (
          <span className="ml-auto font-mono text-xs text-muted-foreground/70 tabular-nums">
            {start + 1}–{start + shown.length} of {sorted.length}
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
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{a.date}</span>
              </div>
              <p className="mt-1 leading-7 text-muted-foreground">{a.description}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
                <SignalBars level={a.signal} label={a.signalLabel} interest={a.interest} helpful={a.helpful} />
                {a.signal ? <span className="text-muted-foreground/40">·</span> : null}
                <span>
                  {a.readingTimeMins} min
                  {a.tags.length ? ` · ${a.tags.join(" · ")}` : ""}
                </span>
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
