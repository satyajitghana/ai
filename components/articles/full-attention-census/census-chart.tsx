"use client"

import { useMemo, useState } from "react"

import { tablistKeys } from "@/components/articles/ui/tablist-keys"
import { cn } from "@/lib/utils"

import { ROWS, type Code, type Period, type Row } from "./census-data"

// The census, live. Every row is one open-weight release, its layers read from config.json
// (census-data.ts is generated from public/articles/full-attention-census/data/census.json).
// The three bars recompute from whatever the filters leave in; the list under them draws each
// model's token-mixing layers as a strip of cells, one per layer, in config order. Arithmetic
// is counting and division only, so server and client agree.

const PERIODS: { id: Period; label: string; chartLabel: string }[] = [
  { id: "2025", label: "2025", chartLabel: "2025" },
  { id: "2026a", label: "2026, Jan 1 to Aug 25", chartLabel: "2026, Jan 1 to Aug 25" },
  { id: "2026b", label: "2026, Aug 26 to Nov 13", chartLabel: "2026, Aug 26 to Nov 5" },
]

const CODE: Record<Code, { label: string; tone: string }> = {
  F: { label: "full attention", tone: "oklch(0.6 0.17 30)" },
  P: { label: "index-selected sparse", tone: "oklch(0.55 0.16 300)" },
  H: { label: "compressed (HCA)", tone: "oklch(0.74 0.13 75)" },
  S: { label: "sliding window / chunked", tone: "oklch(0.78 0.08 230)" },
  L: { label: "linear / recurrent state", tone: "oklch(0.7 0.12 155)" },
  C: { label: "short convolution", tone: "oklch(0.86 0.05 155)" },
}
const ORDER: Code[] = ["F", "P", "H", "S", "L", "C"]

type ClassKey = "all" | "some" | "none"
const CLS: Record<ClassKey, { tone: string }> = {
  all: { tone: "oklch(0.82 0.01 260)" },
  some: { tone: "oklch(0.8 0.06 230)" },
  none: { tone: "oklch(0.8 0.08 70)" },
}

type List = "chart" | "mine"
type Conv = "strict" | "reach"
type Size = "all" | "small" | "mid" | "large"
const SIZES: { id: Size; label: string; test: (b: number | null) => boolean }[] = [
  { id: "all", label: "all sizes", test: () => true },
  { id: "small", label: "under 40B", test: (b) => b != null && b < 40 },
  { id: "mid", label: "40B to 300B", test: (b) => b != null && b >= 40 && b <= 300 },
  { id: "large", label: "over 300B", test: (b) => b != null && b > 300 },
]

const name = (r: Row) => r[0]
const lab = (r: Row) => r[1]
const date = (r: Row) => r[2]
const period = (r: Row) => r[3]
const size = (r: Row) => r[4]
const pattern = (r: Row) => r[5]
const counts = (r: Row) => r[6]
const derivative = (r: Row) => r[8] === 1
const inGallery = (r: Row) => r[9] === 1
const layers = (r: Row) => ORDER.reduce((s, c) => s + (counts(r)[c] ?? 0), 0)

function classOf(r: Row, conv: Conv): ClassKey {
  const c = counts(r)
  const n = layers(r)
  const hit = conv === "strict" ? c.F ?? 0 : (c.F ?? 0) + (c.P ?? 0) + (c.H ?? 0)
  return hit === n ? "all" : hit === 0 ? "none" : "some"
}

const CLS_LABEL: Record<Conv, Record<ClassKey, string>> = {
  strict: { all: "full attention throughout", some: "some full attention", none: "no full attention" },
  reach: { all: "global reach in every layer", some: "global reach in some layers", none: "no global layer" },
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((1000 * n) / d) / 10
}

function Strip({ r }: { r: Row }) {
  const p = pattern(r)
  const cells: Code[] = p
    ? (p.split("") as Code[])
    : ORDER.flatMap((c) => Array.from({ length: counts(r)[c] ?? 0 }, () => c))
  return (
    <span
      className={cn("flex h-3 min-w-0 flex-1 overflow-hidden rounded-[2px]", !p && "outline-1 outline-dashed outline-foreground/30")}
      aria-hidden
    >
      {cells.map((c, i) => (
        <span key={i} className="h-full flex-1" style={{ background: CODE[c].tone, minWidth: 1 }} />
      ))}
    </span>
  )
}

function describe(r: Row): string {
  const c = counts(r)
  const parts = ORDER.filter((k) => c[k]).map((k) => `${c[k]} ${CODE[k].label}`)
  return parts.join(", ")
}

export function CensusChart() {
  const [list, setList] = useState<List>("mine")
  const [conv, setConv] = useState<Conv>("strict")
  const [sz, setSz] = useState<Size>("all")
  const [weight, setWeight] = useState<"count" | "params">("count")
  const [labSel, setLabSel] = useState("all labs")
  const [open, setOpen] = useState<Period>("2026b")
  const [hover, setHover] = useState<string | null>(null)

  const labs = useMemo(() => {
    const s = new Set<string>()
    for (const r of ROWS) s.add(lab(r))
    return ["all labs", ...Array.from(s).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))]
  }, [])

  const rows = useMemo(() => {
    const test = SIZES.find((s) => s.id === sz)?.test ?? (() => true)
    return ROWS.filter((r) => {
      if (list === "chart") {
        if (!inGallery(r) || date(r) > "2026-11-05" || name(r).startsWith("ERNIE 5.5")) return false
      } else if (derivative(r)) return false
      if (!test(size(r))) return false
      if (labSel !== "all labs" && lab(r) !== labSel) return false
      return true
    })
  }, [list, sz, labSel])

  const bars = PERIODS.map((p) => {
    const rs = rows.filter((r) => period(r) === p.id)
    const w = (r: Row) => (weight === "params" ? size(r) ?? 0 : 1)
    const tot = rs.reduce((s, r) => s + w(r), 0)
    const by: Record<ClassKey, number> = { all: 0, some: 0, none: 0 }
    const n: Record<ClassKey, number> = { all: 0, some: 0, none: 0 }
    for (const r of rs) {
      const k = classOf(r, conv)
      by[k] += w(r)
      n[k] += 1
    }
    return { p, rs, tot, by, n }
  })

  const shown = rows
    .filter((r) => period(r) === open)
    .slice()
    .sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : name(a) < name(b) ? -1 : name(a) > name(b) ? 1 : 0))
  const hovered = hover ? ROWS.find((r) => name(r) === hover) : null

  const btn = (on: boolean) =>
    cn(
      "rounded border px-2 py-0.5 font-mono text-[11px]",
      on ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        {rows.length} releases · every layer read from config.json · {list === "chart" ? "the chart's own list" : "this census"}
      </div>

      <div className="space-y-2 border-b px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Which list" onKeyDown={tablistKeys()}>
          <span className="w-20 shrink-0 font-mono text-muted-foreground">list</span>
          {(
            [
              ["chart", "the chart's 113 (Raschka's gallery)"],
              ["mine", "this census, no fine-tunes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={list === id}
              tabIndex={list === id ? 0 : -1}
              onClick={() => setList(id)}
              className={btn(list === id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="How sparse layers count" onKeyDown={tablistKeys()}>
          <span className="w-20 shrink-0 font-mono text-muted-foreground">count as full</span>
          {(
            [
              ["strict", "dense full attention only"],
              ["reach", "any layer that can read every token"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={conv === id}
              tabIndex={conv === id ? 0 : -1}
              onClick={() => setConv(id)}
              className={btn(conv === id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 shrink-0 font-mono text-muted-foreground">size</span>
          {SIZES.map((s) => (
            <button key={s.id} type="button" aria-pressed={sz === s.id} onClick={() => setSz(s.id)} className={btn(sz === s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 shrink-0 font-mono text-muted-foreground">weight</span>
          {(
            [
              ["count", "one vote per model"],
              ["params", "by total parameters"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={weight === id} onClick={() => setWeight(id)} className={btn(weight === id)}>
              {label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            lab
            <select
              value={labSel}
              onChange={(e) => setLabSel(e.target.value)}
              className="rounded border bg-background px-1 py-0.5 text-[11px] text-foreground"
            >
              {labs.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 text-xs">
        {bars.map(({ p, rs, tot, by, n }) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p.id)}
            aria-pressed={open === p.id}
            className={cn(
              "block w-full rounded px-1 py-1 text-left",
              open === p.id ? "bg-muted/60 ring-1 ring-foreground/20" : "hover:bg-muted/40"
            )}
          >
            <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>
                {list === "chart" ? p.chartLabel : p.label} · {rs.length} models
              </span>
              <span>{open === p.id ? "listed below" : "click to list"}</span>
            </div>
            <div className="flex h-6 overflow-hidden rounded-sm bg-muted">
              {(["all", "some", "none"] as const).map((k) => {
                const v = pct(by[k], tot)
                return v > 0 ? (
                  <span
                    key={k}
                    className="flex items-center justify-center font-mono text-[11px] tabular-nums text-black/80"
                    style={{ width: `${v}%`, background: CLS[k].tone }}
                    title={`${CLS_LABEL[conv][k]}: ${n[k]} models`}
                  >
                    {v >= 7 ? `${v}%` : ""}
                  </span>
                ) : null
              })}
            </div>
          </button>
        ))}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          {(["all", "some", "none"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CLS[k].tone }} />
              {CLS_LABEL[conv][k]}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t px-4 py-3 text-xs">
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {ORDER.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CODE[c].tone }} />
              {CODE[c].label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm outline-1 outline-dashed outline-foreground/40" />
            order not in config, counts only
          </span>
        </div>
        <div className="min-h-[2.5rem] rounded border border-dashed px-2 py-1.5 font-mono text-[11px]" aria-live="polite">
          {hovered ? (
            <>
              <span className="text-foreground">{name(hovered)}</span>
              <span className="text-muted-foreground">
                {" "}
                · {lab(hovered)} · {date(hovered)} · {layers(hovered)} layers: {describe(hovered)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Hover or focus a model to read its layer mix. Strips run first layer to last.</span>
          )}
        </div>
        <ul className="mt-2 max-h-[26rem] space-y-0.5 overflow-y-auto pr-1">
          {shown.map((r) => (
            <li key={name(r)}>
              <button
                type="button"
                onMouseEnter={() => setHover(name(r))}
                onFocus={() => setHover(name(r))}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
                className={cn("flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/60", hover === name(r) && "bg-muted/60")}
                aria-label={`${name(r)}: ${describe(r)}`}
              >
                <span className="w-44 shrink-0 truncate text-[11px] sm:w-56">{name(r)}</span>
                <Strip r={r} />
                <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{layers(r)}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 ? <li className="py-2 text-muted-foreground">No model in this period passes the filters.</li> : null}
        </ul>
      </div>
      <figcaption className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        The chart&apos;s list is the 113 gallery cards in its three windows; this census adds 65 releases and drops 13 fine-tunes and
        re-uploads. MTP and draft layers, vision towers and FFN-only blocks are not drawn.
      </figcaption>
    </figure>
  )
}
