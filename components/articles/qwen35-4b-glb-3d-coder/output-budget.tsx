"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { TOKENS } from "./data"

// What an output cap does to these answers. Every row of the 417-row validation split, counted with the model's
// own tokenizer.json: the thinking trace (`reasoning_content`) and the answer (`content`, which holds the HTML).
// A generation that stops at the cap is sorted by where it stops: inside the thinking (no HTML at all), inside
// the code (an HTML file with no end), or after both. MEASURED on the teacher's answers; the student's own
// lengths are reported by the card as "around 20K tokens" on average, which these rows match.

const C_SHORT = "oklch(0.64 0.14 255)"
const C_LONG = "oklch(0.68 0.15 55)"
const C_CAP = "oklch(0.6 0.2 25)"

const W = 640
const H = 210
const L = 36
const R = 10
const T = 14
const B = 30
const BIN = 2000
const XMAX = 54000
const NB = XMAX / BIN
const PRESETS = [8192, 16384, 32768, 65536]

const sx = (t: number) => L + (Math.min(t, XMAX) / XMAX) * (W - L - R)

export function OutputBudget() {
  const [cap, setCap] = useState(16384)
  const [only, setOnly] = useState<"all" | "short" | "long">("all")

  const rows = useMemo(
    () => TOKENS.filter((r) => only === "all" || (only === "long" ? r[2] === 1 : r[2] === 0)),
    [only],
  )
  const bins = useMemo(() => {
    const b = Array.from({ length: NB }, () => [0, 0])
    for (const [th, c, lp] of TOKENS) {
      const i = Math.min(NB - 1, Math.floor((th + c) / BIN))
      b[i][lp] += 1
    }
    return b
  }, [])
  const ymax = Math.max(...bins.map((b) => b[0] + b[1]))
  const sy = (n: number) => T + (H - T - B) * (1 - n / ymax)

  let inThink = 0
  let inCode = 0
  let done = 0
  for (const [th, c] of rows) {
    if (th >= cap) inThink += 1
    else if (th + c > cap) inCode += 1
    else done += 1
  }
  const pct = (n: number) => `${((100 * n) / rows.length).toFixed(0)}%`
  const bw = (W - L - R) / NB

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          thinking + code tokens per answer · 417 validation rows · measured
        </span>
        <span className="font-mono text-xs tabular-nums">cap {cap.toLocaleString("en-US")}</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Histogram of answer length in tokens, thinking plus code, in 2,000-token bins. The middle 80% of answers sit between about
            13,000 and 26,000 tokens; the longest is 52,737. Blue are short prompts of ten words or fewer, orange are
            long briefs. A red line marks the chosen output cap.
          </title>
          {[0, 10000, 20000, 30000, 40000, 50000].map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.1} />
              <text x={sx(t)} y={H - B + 14} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {t === 0 ? "0" : `${t / 1000}k`}
              </text>
            </g>
          ))}
          {bins.map((b, i) => {
            const x = L + i * bw + 0.5
            const yS = sy(b[0])
            const yL = sy(b[0] + b[1])
            return (
              <g key={i} opacity={only === "all" ? 1 : 0.9}>
                <rect x={x} y={yS} width={bw - 1} height={H - B - yS} fill={C_SHORT} opacity={only === "long" ? 0.2 : 1} />
                <rect x={x} y={yL} width={bw - 1} height={yS - yL} fill={C_LONG} opacity={only === "short" ? 0.2 : 1} />
              </g>
            )
          })}
          <line x1={sx(cap)} x2={sx(cap)} y1={T - 4} y2={H - B} stroke={C_CAP} strokeWidth={2} />
          <rect x={sx(cap)} y={T} width={Math.max(0, W - R - sx(cap))} height={H - T - B} fill={C_CAP} opacity={0.07} />
          <text x={L - 6} y={T + 8} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            {ymax}
          </text>
          <text x={W - R} y={H - 4} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            tokens
          </text>
        </svg>
        <label className="mt-2 flex items-center gap-3 text-xs">
          <span className="w-24 shrink-0 font-mono text-muted-foreground">output cap</span>
          <Range
            min={4096}
            max={65536}
            step={1024}
            value={cap}
            accent={C_CAP}
            onChange={(e) => setCap(Number(e.target.value))}
            aria-label="Maximum output tokens"
            className="w-full"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCap(p)}
              aria-pressed={cap === p}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px]",
                cap === p ? "bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              {p.toLocaleString("en-US")}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" />
          {(["all", "short", "long"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setOnly(k)}
              aria-pressed={only === k}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px]",
                only === k ? "bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              {k === "all" ? "all prompts" : k === "short" ? "short prompts" : "long briefs"}
            </button>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 font-mono text-xs">
          <div>
            <dt className="text-muted-foreground">stops while thinking</dt>
            <dd className="tabular-nums">{inThink} ({pct(inThink)})</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">stops inside the HTML</dt>
            <dd className="tabular-nums">{inCode} ({pct(inCode)})</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">finishes</dt>
            <dd className="tabular-nums">{done} of {rows.length} ({pct(done)})</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          The histogram always shows all 417 rows; the counts follow the prompt filter. With the card&apos;s warning
          case, an 8,192-token cap, 4 of 417 answers would finish. Long briefs think longer (median 12,038 tokens
          against 8,246) and write less code (7,933 against 9,916).
        </p>
      </div>
    </figure>
  )
}
