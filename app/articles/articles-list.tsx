"use client"

import { useRef } from "react"
import Link from "next/link"
import {
  CaretLeftIcon,
  CaretRightIcon,
  StarIcon,
} from "@phosphor-icons/react/dist/ssr"

import { useUrlState } from "@/lib/use-url-state"
import { cn } from "@/lib/utils"

// Client list: filter (All / Featured / High-signal), sort (updated / signal /
// interest / helpful), pagination — all persisted to the URL. Articles arrive
// last-updated-first (see lib/content/index.ts); "updated" keeps that order,
// the other sorts reorder a copy, tie-broken by lastUpdated.
// Each card carries a signal badge: 1–5 bars derived from the article's own
// `interest` + `helpful` frontmatter (see lib/content/schema.ts).
type ArticleCard = {
  slug: string
  title: string
  date: string
  updated: string | null
  lastUpdated: string
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
  { key: "new", label: "updated" },
  { key: "signal", label: "signal" },
  { key: "interest", label: "interesting" },
  { key: "helpful", label: "helpful" },
]

// Filter, sort and page live in the query string so a view is shareable and
// survives a refresh. `featured=1` is the legacy spelling of `filter=featured`
// and is still honoured on read; writes drop it.
function parseUrlState(sp: URLSearchParams): { filter: Filter; sort: Sort; page: number } {
  const f = sp.get("filter")
  const s = sp.get("sort")
  const p = Number(sp.get("page"))
  return {
    filter:
      f === "high" || f === "featured" ? f : sp.get("featured") === "1" ? "featured" : "all",
    sort: s === "signal" || s === "interest" || s === "helpful" ? s : "new",
    page: Number.isFinite(p) && p >= 1 ? p : 1,
  }
}

export function ArticlesList({ articles }: { articles: ArticleCard[] }) {
  const [{ filter, sort, page }, setParams] = useUrlState(parseUrlState)
  const topRef = useRef<HTMLDivElement>(null)

  const featuredCount = articles.filter((a) => a.featured).length
  const highCount = articles.filter((a) => a.signal >= 4).length

  const filtered = articles.filter((a) =>
    filter === "featured" ? a.featured : filter === "high" ? a.signal >= 4 : true,
  )

  // "updated" preserves incoming order (already last-updated-first from the
  // loader); other sorts reorder a copy, tie-broken by lastUpdated.
  const sorted =
    sort === "new"
      ? filtered
      : [...filtered].sort((a, b) => {
          const key = sort === "signal" ? "signal" : sort === "interest" ? "interest" : "helpful"
          return b[key] - a[key] || b.lastUpdated.localeCompare(a.lastUpdated)
        })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * PAGE_SIZE
  const shown = sorted.slice(start, start + PAGE_SIZE)

  const writeUrl = (nextFilter: Filter, nextSort: Sort, nextPage: number) =>
    setParams((sp) => {
      sp.delete("featured") // drop the legacy param
      if (nextFilter !== "all") sp.set("filter", nextFilter)
      else sp.delete("filter")
      if (nextSort !== "new") sp.set("sort", nextSort)
      else sp.delete("sort")
      if (nextPage > 1) sp.set("page", String(nextPage))
      else sp.delete("page")
    })

  const applyFilter = (f: Filter) => writeUrl(f, sort, 1)
  const applySort = (s: Sort) => writeUrl(filter, s, 1)
  const goto = (p: number) => {
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

  // 1 … 6 [7] 8 … 15. Rendering every page number was fine at eight articles and
  // is not at a hundred and seventy: fifteen buttons are ~500px, so the row grew
  // past a phone viewport and made the whole page scroll sideways. The window is
  // fixed-width, so this row costs the same whatever the archive grows to.
  const pages: (number | "gap")[] = []
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) pages.push(p)
  } else {
    const lo = Math.max(2, current - 1)
    const hi = Math.min(totalPages - 1, current + 1)
    pages.push(1)
    if (lo > 2) pages.push("gap")
    for (let p = lo; p <= hi; p++) pages.push(p)
    if (hi < totalPages - 1) pages.push("gap")
    pages.push(totalPages)
  }

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
              {/* On a phone the date is ~30 monospace characters, and as a
                  shrink-0 sibling it left the title about 150px to wrap in —
                  one or two words a line. Stack below the sm breakpoint so the
                  title gets the full column, and only sit them on one baseline
                  once there is room for both. */}
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h2 className="font-heading text-lg font-semibold text-balance underline-offset-4 group-hover:underline">
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
                <span className="font-mono text-xs text-muted-foreground sm:shrink-0">
                  {a.date}
                  {a.updated && a.updated !== a.date ? (
                    <span className="text-muted-foreground/60"> · updated {a.updated}</span>
                  ) : null}
                </span>
              </div>
              {/* the date is a sibling line on mobile, so the description needs
                  a little more air than it does beside it on one baseline */}
              <p className="mt-2 leading-7 text-muted-foreground sm:mt-1">{a.description}</p>
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
          {pages.map((p, i) =>
            p === "gap" ? (
              <span
                key={`gap-${i}`}
                aria-hidden="true"
                className="px-1 text-muted-foreground/40 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goto(p)}
                aria-current={p === current ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  "min-w-8 cursor-pointer rounded-md px-2 py-1 tabular-nums transition-colors",
                  p === current
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {p}
              </button>
            ),
          )}
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
