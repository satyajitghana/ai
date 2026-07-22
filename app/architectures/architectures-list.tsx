"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRightIcon, CaretDownIcon } from "@phosphor-icons/react/dist/ssr"

import { ArchDiagram } from "@/components/architectures/registry"
import { cn } from "@/lib/utils"

// Client gallery for /architectures: filter by family (and "has diagram"), sort
// by uniqueness / interest / signal / newest / name — persisted to the URL. Each
// card carries a 1–5 signal badge derived from the entry's own interest +
// uniqueness (see data/architectures.ts). Entries with a vetted distill diagram
// get an inline, collapsible figure.
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

// family display order (roughly by count / importance)
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
  const [open, setOpen] = useState<Record<string, boolean>>({})
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
  const toggle = (slug: string) => setOpen((o) => ({ ...o, [slug]: !o[slug] }))

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

      <ul className="space-y-5" data-stagger>
        {sorted.map((a) => (
          <li key={a.slug} className="rounded-xl border bg-gradient-to-b from-muted/10 to-transparent p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-heading text-lg font-semibold">{a.name}</h2>
              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{a.year}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-muted-foreground">
              <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                {FAMILY_LABEL[a.family]}
              </span>
              <SignalBars level={a.signal} label={a.signalLabel} interest={a.interest} uniqueness={a.uniqueness} />
              <span className="text-muted-foreground/60">
                interest {a.interest}/5 · unique {a.uniqueness}/5
              </span>
            </div>

            <p className="mt-3 leading-7 text-muted-foreground">{a.summary}</p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
              {a.tags.length ? (
                <span className="text-muted-foreground/70">{a.tags.join(" · ")}</span>
              ) : null}
              <span className="ml-auto flex items-center gap-3">
                {a.article ? (
                  <Link
                    href={`/articles/${a.article}`}
                    className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    read the explainer <ArrowUpRightIcon size={12} weight="bold" />
                  </Link>
                ) : a.paper ? (
                  <a
                    href={a.paper}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    paper <ArrowUpRightIcon size={12} weight="bold" />
                  </a>
                ) : null}
                {a.hasDiagram ? (
                  <button
                    type="button"
                    onClick={() => toggle(a.slug)}
                    aria-expanded={!!open[a.slug]}
                    className="flex cursor-pointer items-center gap-1 text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {open[a.slug] ? "hide" : "◈ show"} diagram
                    <CaretDownIcon
                      size={12}
                      weight="bold"
                      className={cn("transition-transform", open[a.slug] && "rotate-180")}
                    />
                  </button>
                ) : null}
              </span>
            </div>

            {a.hasDiagram && open[a.slug] ? (
              <div className="mt-1">
                <ArchDiagram slug={a.slug} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
