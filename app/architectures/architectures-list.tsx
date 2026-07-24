"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowsOutIcon,
  ArrowUpRightIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr"

import { ArchDiagram } from "@/components/architectures/registry"
import { cn } from "@/lib/utils"

// Client gallery for /architectures: a grid of architecture "blocks". Diagrams
// render inline by default; cards lift on hover and expand into a full-size
// modal on click. Filter by family (and "has diagram"), sort by uniqueness /
// interest / signal / newest / name — persisted to the URL. Each card carries a
// 1–5 signal badge derived from the entry's own interest + uniqueness.
type ArchCard = {
  slug: string
  name: string
  family: string
  year: number
  tags: string[]
  interest: number
  uniqueness: number
  summary: string
  article: string | null
  paper: string | null
  signal: number // 1–5
  signalLabel: string
  score: number
  hasDiagram: boolean
}

// signal level → color for the filled bars (green = high, fading down)
const SIGNAL_COLOR: Record<number, string> = {
  5: "oklch(0.7 0.17 145)",
  4: "oklch(0.68 0.14 155)",
  3: "oklch(0.66 0.12 230)",
  2: "oklch(0.7 0.06 250)",
  1: "oklch(0.6 0.03 260)",
}

const FAMILY_LABEL: Record<string, string> = {
  transformer: "Transformer",
  attention: "Attention",
  moe: "MoE",
  ssm: "SSM / RNN",
  positional: "Positional",
  diffusion: "Diffusion",
  training: "Training",
  other: "Other",
}

const FAMILY_ORDER = [
  "transformer",
  "attention",
  "moe",
  "positional",
  "ssm",
  "diffusion",
  "training",
  "other",
]

function SignalBars({ level, label, interest, uniqueness }: { level: number; label: string; interest: number; uniqueness: number }) {
  const color = SIGNAL_COLOR[level] ?? SIGNAL_COLOR[1]
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Signal: ${label} · interest ${interest}/5 · uniqueness ${uniqueness}/5`}
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

// Shared metadata row (family chip + signal + raw scores).
function MetaRow({ a }: { a: ArchCard }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-muted-foreground">
      <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
        {FAMILY_LABEL[a.family]}
      </span>
      <SignalBars level={a.signal} label={a.signalLabel} interest={a.interest} uniqueness={a.uniqueness} />
      <span className="text-muted-foreground/60">interest {a.interest}/5 · unique {a.uniqueness}/5</span>
    </div>
  )
}

// article / paper link (used in both card + modal); stops propagation so it
// navigates instead of expanding the card.
function SourceLink({ a }: { a: ArchCard }) {
  if (a.article) {
    return (
      <Link
        href={`/articles/${a.article}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        read the explainer <ArrowUpRightIcon size={12} weight="bold" />
      </Link>
    )
  }
  if (a.paper) {
    return (
      <a
        href={a.paper}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        paper <ArrowUpRightIcon size={12} weight="bold" />
      </a>
    )
  }
  return null
}

type Sort = "unique" | "interest" | "signal" | "new" | "name"

const SORTS: { key: Sort; label: string }[] = [
  { key: "unique", label: "unique" },
  { key: "interest", label: "interesting" },
  { key: "signal", label: "signal" },
  { key: "new", label: "newest" },
  { key: "name", label: "a–z" },
]

export function ArchitecturesList({ items }: { items: ArchCard[] }) {
  const [family, setFamily] = useState<string>("all")
  const [sort, setSort] = useState<Sort>("unique")
  const [expanded, setExpanded] = useState<ArchCard | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const diagramCount = items.filter((a) => a.hasDiagram).length
  const families = FAMILY_ORDER.filter((f) => items.some((a) => a.family === f))
  const familyCounts = Object.fromEntries(
    families.map((f) => [f, items.filter((a) => a.family === f).length]),
  )

  const filtered = items.filter((a) =>
    family === "all" ? true : family === "diagram" ? a.hasDiagram : a.family === family,
  )

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "unique":
        return b.uniqueness - a.uniqueness || b.score - a.score || a.name.localeCompare(b.name)
      case "interest":
        return b.interest - a.interest || b.score - a.score || a.name.localeCompare(b.name)
      case "signal":
        return b.score - a.score || a.name.localeCompare(b.name)
      case "new":
        return b.year - a.year || b.score - a.score
      case "name":
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  // Restore filter + sort from the URL on mount (shareable, refresh-safe).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const f = sp.get("family")
    if (f && (f === "diagram" || FAMILY_ORDER.includes(f))) setFamily(f)
    const s = sp.get("sort")
    if (s === "interest" || s === "signal" || s === "new" || s === "name") setSort(s)
  }, [])

  // Modal: close on Escape, lock body scroll while open.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null)
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [expanded])

  const writeUrl = (nextFamily: string, nextSort: Sort) => {
    const sp = new URLSearchParams(window.location.search)
    if (nextFamily !== "all") sp.set("family", nextFamily)
    else sp.delete("family")
    if (nextSort !== "unique") sp.set("sort", nextSort)
    else sp.delete("sort")
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  const applyFamily = (f: string) => {
    setFamily(f)
    writeUrl(f, sort)
  }
  const applySort = (s: Sort) => {
    setSort(s)
    writeUrl(family, s)
  }

  const chip = (active: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => applyFamily("all")} aria-pressed={family === "all"} className={chip(family === "all")}>
          All <span className="tabular-nums opacity-50">{items.length}</span>
        </button>
        {families.map((f) => (
          <button key={f} type="button" onClick={() => applyFamily(f)} aria-pressed={family === f} className={chip(family === f)}>
            {FAMILY_LABEL[f]} <span className="tabular-nums opacity-50">{familyCounts[f]}</span>
          </button>
        ))}
        <button type="button" onClick={() => applyFamily("diagram")} aria-pressed={family === "diagram"} className={chip(family === "diagram")}>
          ◈ diagram <span className="tabular-nums opacity-50">{diagramCount}</span>
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground/70">sort</span>
        {SORTS.map((s) => (
          <button key={s.key} type="button" onClick={() => applySort(s.key)} aria-pressed={sort === s.key} className={chip(sort === s.key)}>
            {s.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-muted-foreground/70 tabular-nums">
          {sorted.length} of {items.length}
        </span>
      </div>

      {/* grid — diagram blocks span full width (readable), text blocks pair 2-up */}
      <div className="grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-2">
        {sorted.map((a) => (
          <div
            key={a.slug}
            onClick={() => setExpanded(a)}
            className={cn(
              "group relative flex cursor-pointer flex-col rounded-xl border bg-gradient-to-b from-muted/10 to-transparent p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md sm:p-5",
              a.hasDiagram && "sm:col-span-2",
            )}
          >
            {/* expand affordance — keyboard-focusable, visible on hover */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(a)
              }}
              aria-label={`Expand ${a.name}`}
              className="absolute right-2.5 top-2.5 z-10 rounded-md border bg-background/70 p-1 text-muted-foreground opacity-0 backdrop-blur transition-all hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ArrowsOutIcon size={14} weight="bold" />
            </button>

            <div className="flex items-baseline justify-between gap-4 pr-6">
              <h2 className="font-heading text-lg font-semibold group-hover:text-foreground">{a.name}</h2>
              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{a.year}</span>
            </div>

            <div className="mt-2">
              <MetaRow a={a} />
            </div>

            <p className="mt-3 leading-7 text-muted-foreground">{a.summary}</p>

            {a.hasDiagram ? (
              <div className="mt-4 overflow-hidden rounded-lg border transition-shadow [&>figure]:my-0 [&>figure]:rounded-none [&>figure]:border-0 [&>figure]:bg-transparent">
                <ArchDiagram slug={a.slug} />
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
              {a.tags.length ? <span className="text-muted-foreground/70">{a.tags.join(" · ")}</span> : null}
              <span className="ml-auto">
                <SourceLink a={a} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* expanded block modal */}
      {expanded ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 pt-[6vh] backdrop-blur-sm sm:p-6"
          onClick={() => setExpanded(null)}
          role="dialog"
          aria-modal="true"
          aria-label={expanded.name}
        >
          <div
            className="w-full max-w-4xl rounded-xl border bg-background p-5 shadow-lg sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-bold tracking-tight">{expanded.name}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{expanded.year}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                aria-label="Close"
                className="shrink-0 rounded-md border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon size={16} weight="bold" />
              </button>
            </div>

            <div className="mt-3">
              <MetaRow a={expanded} />
            </div>

            <p className="mt-4 leading-7 text-muted-foreground">{expanded.summary}</p>

            {expanded.hasDiagram ? <ArchDiagram slug={expanded.slug} /> : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 font-mono text-xs">
              {expanded.tags.length ? (
                <span className="text-muted-foreground/70">{expanded.tags.join(" · ")}</span>
              ) : null}
              <span className="ml-auto">
                <SourceLink a={expanded} />
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
