"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"

// The crux of the performance claim, made switchable. Same eight benchmarks,
// same measurements -- but "speedup vs itself" (what HVM/Bend 1's marketing
// showed) and "absolute wall-clock against C/TypeScript/Lean" (what BendRT's
// own paper adds) tell very different stories. Flip the toggle on any bench
// and watch how much the framing alone changes the picture.
//
// All numbers are real, from bench/runtime/_pin_/apple_m4_max.txt in
// bendlang/bend, pin of 2026-09-17 (commit d0db7b3e), one Apple M4 Max.
// seq/par/gpu are Bend; c/ts/lean are hand-written twins, one per language.

type Row = { key: string; label: string; seq: number; par: number; gpu: number; c: number; ts: number; lean: number }

const ROWS: Row[] = [
  { key: "bfs", label: "bfs", seq: 3.918, par: 0.343, gpu: 0.207, c: 3.585, ts: 6.534, lean: 9.274 },
  { key: "gol", label: "game of life", seq: 7.803, par: 0.647, gpu: 0.063, c: 6.776, ts: 18.754, lean: 13.849 },
  { key: "hashmap", label: "hashmap", seq: 2.741, par: 0.238, gpu: 0.521, c: 0.622, ts: 0.892, lean: 1.526 },
  { key: "kmeans", label: "k-means", seq: 2.069, par: 0.268, gpu: 0.191, c: 2.062, ts: 17.455, lean: 5.686 },
  { key: "mandel", label: "mandelbrot", seq: 4.473, par: 0.395, gpu: 0.057, c: 3.750, ts: 3.837, lean: 4.575 },
  { key: "queens", label: "n-queens", seq: 5.406, par: 0.455, gpu: 0.933, c: 3.599, ts: 6.979, lean: 7.704 },
  { key: "symreg", label: "symbolic regr.", seq: 3.014, par: 0.266, gpu: 0.529, c: 2.208, ts: 5.924, lean: 2.457 },
  { key: "bitonic", label: "tree bitonic sort", seq: 6.043, par: 0.799, gpu: 0.450, c: 5.719, ts: 33.910, lean: 38.123 },
]

const ACCENT = "oklch(0.70 0.16 250)"
const BASE = "oklch(0.62 0.02 260)"

type Mode = "speedup" | "absolute"

// log-scale position in [0,1] over a fixed domain, via the deterministic
// log10 (an SSR/client ULP drift here would move an SVG bar's width by a
// hair and trip the hydration check).
function logPos(v: number, lo: number, hi: number): number {
  const p = (mlog10(v) - mlog10(lo)) / (mlog10(hi) - mlog10(lo))
  return Math.min(1, Math.max(0, p))
}

const ABS_DOMAIN = [0.05, 40] as const
const ABS_TICKS = [0.1, 1, 10, 40]
const SPD_DOMAIN = [1, 150] as const
const SPD_TICKS = [1, 10, 100]

function fmtS(v: number) {
  return v >= 10 ? `${v.toFixed(1)}s` : v >= 1 ? `${v.toFixed(2)}s` : `${v.toFixed(3)}s`
}
function fmtX(v: number) {
  return `${v.toFixed(v >= 10 ? 0 : 1)}x`
}

function Bar({
  value, lo, hi, ticks, label, sub, color, dim = false,
}: { value: number; lo: number; hi: number; ticks: number[]; label: string; sub: string; color: string; dim?: boolean }) {
  const pct = logPos(value, lo, hi) * 100
  return (
    <div className="flex items-center gap-3">
      <span className={cn("w-[92px] shrink-0 truncate text-right font-mono text-[11px] sm:w-[108px]",
        dim ? "text-muted-foreground" : "font-medium text-foreground")}>
        {label}
      </span>
      <div className="relative h-5 flex-1">
        <div className="absolute inset-0">
          {ticks.map((t) => (
            <span key={t} className="absolute top-0 bottom-0 w-px bg-border/40" style={{ left: `${logPos(t, lo, hi) * 100}%` }} />
          ))}
        </div>
        <div className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm transition-all duration-300"
          style={{ width: `${Math.max(pct, 1.2)}%`, background: color, opacity: dim ? 0.55 : 0.95 }} />
      </div>
      <span className="w-14 shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">{sub}</span>
    </div>
  )
}

export function PerfChart() {
  const [key, setKey] = useState("gol")
  const [mode, setMode] = useState<Mode>("speedup")
  const row = ROWS.find((r) => r.key === key) ?? ROWS[1]

  const [lo, hi] = mode === "speedup" ? SPD_DOMAIN : ABS_DOMAIN
  const ticks = mode === "speedup" ? SPD_TICKS : ABS_TICKS

  const cOverSeq = row.seq / row.c
  const flagOutlier = cOverSeq > 1.5

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>bench/runtime · Apple M4 Max · pin 2026-09-17</span>
        <span className="text-muted-foreground/50">lower is better</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ROWS.map((r) => (
            <button key={r.key} type="button" onClick={() => setKey(r.key)} aria-pressed={key === r.key}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                key === r.key ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <div className="space-y-1.5">
            {mode === "absolute" ? (
              <>
                <Bar value={row.ts} lo={lo} hi={hi} ticks={ticks} label="TypeScript" sub={fmtS(row.ts)} color={BASE} dim />
                <Bar value={row.lean} lo={lo} hi={hi} ticks={ticks} label="Lean" sub={fmtS(row.lean)} color={BASE} dim />
                <Bar value={row.c} lo={lo} hi={hi} ticks={ticks} label="C" sub={fmtS(row.c)} color={BASE} dim />
                <Bar value={row.seq} lo={lo} hi={hi} ticks={ticks} label="Bend · 1 core" sub={fmtS(row.seq)} color={ACCENT} />
                <Bar value={row.par} lo={lo} hi={hi} ticks={ticks} label="Bend · 16 cores" sub={fmtS(row.par)} color={ACCENT} />
                <Bar value={row.gpu} lo={lo} hi={hi} ticks={ticks} label="Bend · GPU" sub={fmtS(row.gpu)} color={ACCENT} />
              </>
            ) : (
              <>
                <Bar value={1} lo={lo} hi={hi} ticks={ticks} label="Bend · 1 core" sub="1x" color={ACCENT} />
                <Bar value={row.seq / row.par} lo={lo} hi={hi} ticks={ticks} label="Bend · 16 cores" sub={fmtX(row.seq / row.par)} color={ACCENT} />
                <Bar value={row.seq / row.gpu} lo={lo} hi={hi} ticks={ticks} label="Bend · GPU" sub={fmtX(row.seq / row.gpu)} color={ACCENT} />
              </>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-3">
            <span className="w-[92px] shrink-0 sm:w-[108px]" aria-hidden />
            <div className="relative h-4 flex-1">
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 -translate-x-1/2 font-mono text-[9.5px] text-muted-foreground tabular-nums"
                  style={{ left: `${logPos(t, lo, hi) * 100}%` }}>
                  {mode === "speedup" ? fmtX(t) : fmtS(t)}
                </span>
              ))}
            </div>
            <span className="w-14 shrink-0" aria-hidden />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">view</span>
            {(["speedup", "absolute"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={mode === m ? { background: ACCENT } : undefined}>
                {m === "speedup" ? "speedup vs 1 core" : "absolute seconds"}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            Bend/1-core ÷ C = <span className={cn(flagOutlier ? "text-foreground" : undefined)}>{cOverSeq.toFixed(2)}x</span>
            {flagOutlier ? " — outside the paper's claimed 0.8–1.5x" : ""}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "speedup" ? (
            <>This is the chart HVM1 and Bend 1 shipped: a curve against{" "}
              <span className="text-foreground">itself</span>. It looks the same shape for every
              bench, because it can&apos;t show what it&apos;s scaling <em>from</em>.</>
          ) : (
            <>Same run, grounded against hand-written C, TypeScript and Lean twins. Most benches put
              Bend&apos;s single core within 0.8–1.5x of C, per BendRT&apos;s own table.{" "}
              {flagOutlier ? (
                <>Not this one: on <span className="text-foreground">{row.label}</span>, Bend/1-core runs{" "}
                  <span className="text-foreground">{cOverSeq.toFixed(1)}x</span> slower than C — likely the
                  cost of reference-counting a hot, pointer-chasing structure.</>
              ) : (
                <>Try <span className="text-foreground">hashmap</span>, though — Bend/1-core there runs 4.4x
                  slower than C, the one bench in this set the paper&apos;s own table leaves out.</>
              )}
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
