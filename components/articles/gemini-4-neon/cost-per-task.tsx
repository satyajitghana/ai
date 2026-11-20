"use client"

import { useState } from "react"

import { COLOR, GEMINI, ROWS, type Row } from "./data"

// Cost per Artificial Analysis index task, split into what it is paid for:
// input at the full rate, input read from the cache, and output (reasoning plus
// answer). Every component is AA's own (see data.ts). The price sheet only
// rescales Carbon and Argon: Google lists both at $2/$10 through 2026-11-30 and
// $4/$20 from 2026-12-01, cache reads at a tenth of input either way, so the
// whole bill scales by the same factor. AA prices Carbon at $4/$20 and Argon at
// $2/$10 today.

type Sheet = "aa" | "intro" | "standard"

const SHEETS: { id: Sheet; label: string; note: string }[] = [
  { id: "aa", label: "as AA prices them", note: "Carbon $4/$20, Argon $2/$10" },
  { id: "intro", label: "through Nov 30", note: "Carbon and Argon $2/$10" },
  { id: "standard", label: "from Dec 1", note: "Carbon and Argon $4/$20" },
]

function factor(r: Row, s: Sheet) {
  if (s === "intro" && r.fam === "carbon") return 0.5
  if (s === "standard" && r.fam === "argon") return 2
  return 1
}

const usd = (n: number) => `$${n.toFixed(2)}`

export function CostPerTask() {
  const [sheet, setSheet] = useState<Sheet>("aa")
  const [rivals, setRivals] = useState(true)
  const [sel, setSel] = useState("Neon xhigh")

  const rows = ROWS.filter((r) => rivals || GEMINI.includes(r.fam))
    .map((r) => {
      const f = factor(r, sheet)
      return { ...r, full: r.full * f, cached: r.cached * f, out: r.out * f, total: r.total * f }
    })
    .sort((a, b) => a.total - b.total)

  const max = Math.max(...rows.map((r) => r.total))
  const cur = rows.find((r) => `${r.name} ${r.effort}` === sel) ?? rows[0]
  const share = (x: number) => `${Math.round((x / cur.total) * 100)}%`

  const W = 640
  const L = 150
  const R = 92
  const rowH = 24
  const T = 8
  const H = T + rows.length * rowH + 8
  const sx = (v: number) => (v / max) * (W - L - R)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Cost per AA index task, split by what it pays for</span>
        <span className="text-muted-foreground/60">artificialanalysis.ai, 2026-11-20</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">price sheet:</span>
          {SHEETS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSheet(s.id)}
              aria-pressed={sheet === s.id}
              className={`rounded-md border px-2.5 py-1 ${sheet === s.id ? "bg-muted" : "bg-background"}`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRivals((v) => !v)}
            aria-pressed={rivals}
            className={`rounded-md border px-2.5 py-1 ${rivals ? "bg-muted" : "bg-background"}`}
          >
            {rivals ? "with rivals" : "Gemini 4 only"}
          </button>
        </div>
        <p className="mb-2 font-mono text-xs text-muted-foreground/80">{SHEETS.find((s) => s.id === sheet)?.note}</p>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Cost per index task, cheapest first: ${rows.map((r) => `${r.name} ${r.effort} ${usd(r.total)} at index ${r.idx}`).join("; ")}.`}
        >
          {rows.map((r, i) => {
            const y = T + i * rowH
            const key = `${r.name} ${r.effort}`
            const hot = key === sel
            const c = COLOR[r.fam]
            const w1 = sx(r.full)
            const w2 = sx(r.cached)
            const w3 = sx(r.out)
            return (
              <g key={key} onClick={() => setSel(key)} style={{ cursor: "pointer" }}>
                <rect x={0} y={y} width={W} height={rowH} fill={hot ? "var(--muted)" : "transparent"} opacity={0.6} />
                <text x={L - 8} y={y + 16} textAnchor="end" fontSize={12} className={`font-mono ${r.fam === "neon" ? "fill-foreground" : "fill-muted-foreground"}`}>
                  {`${r.name} ${r.effort}`}
                </text>
                <rect x={L} y={y + 5} width={w1} height={rowH - 10} fill={c} />
                <rect x={L + w1} y={y + 5} width={w2} height={rowH - 10} fill={c} opacity={0.45} />
                <rect x={L + w1 + w2} y={y + 5} width={w3} height={rowH - 10} fill={c} opacity={0.75} stroke="var(--background)" strokeWidth={1} />
                <text x={L + w1 + w2 + w3 + 6} y={y + 16} fontSize={12} className="fill-foreground font-mono">
                  {usd(r.total)}
                </text>
                <text x={W - 4} y={y + 16} textAnchor="end" fontSize={11} className="fill-muted-foreground font-mono">
                  {r.idx.toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>solid: input at the full rate</span>
          <span>faint: input read from cache</span>
          <span>mid: output (reasoning + answer)</span>
          <span>right column: index score</span>
        </div>

        <div className="mt-3 rounded-lg border px-3 py-2 font-mono text-xs">
          <span style={{ color: COLOR[cur.fam] }}>{`${cur.name} (${cur.effort})`}</span>
          <span className="text-muted-foreground">
            {` index ${cur.idx.toFixed(2)}, ${usd(cur.total)} per task: full-rate input ${usd(cur.full)} (${share(cur.full)}), cache reads ${usd(cur.cached)} (${share(cur.cached)}), output ${usd(cur.out)} (${share(cur.out)}); ${cur.outTok.toLocaleString("en-US")} output tokens and ${cur.secs.toLocaleString("en-US")} s per task`}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          One bar per model and thinking level; click a bar for its split. Agent tasks re-read their context on every
          step, so input is most of every Gemini bill even at a 95% cache discount. Switch to the introductory sheet and
          Carbon at its default medium setting drops under Neon at high until November 30; switch to December and Argon
          doubles. Rivals are at their own list prices: GPT-6.2 Astra charges more per token than Neon and still costs
          less per task, because at xhigh it writes about a sixth of Neon&apos;s output tokens.
        </p>
      </div>
    </figure>
  )
}
