"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Every perplexity and accuracy below is LOOM's own reported number
// (arXiv 2610.01153, Tables 2, 3 and 4). Nothing is interpolated: the slider
// only stops on loop counts the paper trained. What this widget adds is
// arithmetic on those tables, labelled "reasoned" in the article:
//   - effective depth = M x H (the paper's own definition)
//   - the iso-FLOP cost f(H, k) = H(6 + 3k) in units of d^2 (paper Eq. 5),
//     split into its attention part (6H) and its expert part (3kH)
//   - KV cache grows with H, because every loop re-runs attention on a new
//     hidden state and so writes its own keys and values
//   - optimizer updates per global batch = ceil(H / 3) under segmented
//     backprop (Algorithm 1; run_segmented_global_step in pretrain.py)

type ModeKey = "iso" | "p350" | "p17"

type Mode = {
  label: string
  blurb: string
  m: number
  loops: number[]
  ppl: number[]
  acc: number[]
  naive?: (number | null)[] // "No tech." perplexity; null = unrecoverable spike
  naiveSpike?: number[]
  topk: number[]
  flop?: number[] // f(H, k) for iso-FLOP
  segmented: boolean
}

const MODES: Record<ModeKey, Mode> = {
  iso: {
    label: "iso-FLOP · 700M",
    blurb: "M=10, 80 routed experts, 10B tokens. top-k shrinks as loops grow so f(H,k) stays near 84. Full backprop, no segmentation.",
    m: 10,
    loops: [1, 2, 3, 4, 5, 6],
    topk: [26, 12, 8, 5, 4, 3],
    flop: [84, 84, 90, 84, 90, 90],
    ppl: [18.36, 17.37, 16.91, 16.58, 16.54, 16.57],
    acc: [38.84, 39.0, 39.34, 39.53, 39.53, 39.5],
    segmented: false,
  },
  p350: {
    label: "iso-param · 350M",
    blurb: "M=10, top-8 (6 routed + 2 shared), 10B tokens. Same weights, more loops, more compute. Segmented backprop, K=3.",
    m: 10,
    loops: [1, 3, 6, 9, 12],
    topk: [8, 8, 8, 8, 8],
    ppl: [20.07, 18.27, 15.35, 14.8, 14.86],
    acc: [37.96, 39.38, 40.88, 41.15, 41.42],
    naive: [20.07, 23.75, null, null, null],
    naiveSpike: [0, 0, 1312, 1313, 1528],
    segmented: true,
  },
  p17: {
    label: "iso-param · 1.7B",
    blurb: "M=15, top-8, about 60B tokens. Same weights, more loops, more compute. Segmented backprop, K=3.",
    m: 15,
    loops: [1, 3, 6, 9, 12],
    topk: [8, 8, 8, 8, 8],
    ppl: [9.62, 8.94, 7.91, 7.77, 7.84],
    acc: [42.4, 43.9, 46.7, 47.7, 47.5],
    segmented: true,
  },
}

const ORDER: ModeKey[] = ["iso", "p350", "p17"]
const ACCENT = "oklch(0.68 0.17 300)"
const ATTN = "oklch(0.7 0.14 220)"
const EXPERT = "oklch(0.72 0.16 50)"

const W = 560
const H = 170
const PX = 40
const PT = 16
const PB = 28

function ceilDiv(a: number, b: number) {
  return Math.floor((a + b - 1) / b)
}

export function LoopLedger() {
  const [modeKey, setModeKey] = useState<ModeKey>("iso")
  const [idx, setIdx] = useState(4)
  const mode = MODES[modeKey]
  const i = Math.min(idx, mode.loops.length - 1)
  const loops = mode.loops[i]
  const base = 0
  const best = mode.ppl.indexOf(Math.min(...mode.ppl))

  const lo = Math.min(...mode.ppl)
  const hi = Math.max(...mode.ppl, ...(mode.naive ?? []).filter((v): v is number => v != null))
  const pad = (hi - lo) * 0.15
  const yLo = lo - pad
  const yHi = hi + pad
  const n = mode.loops.length
  const xAt = (j: number) => PX + ((W - 2 * PX) * j) / (n - 1)
  const yAt = (v: number) => PT + (H - PT - PB) * (1 - (v - yLo) / (yHi - yLo))
  const path = mode.ppl.map((v, j) => `${j === 0 ? "M" : "L"} ${xAt(j).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ")

  const effDepth = mode.m * loops
  const optSteps = mode.segmented ? ceilDiv(loops, 3) : 1
  const dPpl = mode.ppl[i] - mode.ppl[base]
  const dAcc = mode.acc[i] - mode.acc[base]

  let attnShare = 0
  if (mode.flop) attnShare = (6 * loops) / mode.flop[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">loop ledger · LOOM tables 2-4</span>
        <div className="flex flex-wrap gap-1">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setModeKey(k)
                setIdx(k === "iso" ? 4 : 3)
              }}
              aria-pressed={modeKey === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                modeKey === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {MODES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{mode.blurb}</p>

        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs">
            <span>loops H</span>
            <span className="text-base font-semibold" style={{ color: ACCENT }}>
              {loops}
            </span>
          </span>
          <Range
            min={0}
            max={n - 1}
            step={1}
            value={i}
            accent={ACCENT}
            onChange={(e) => setIdx(Number(e.target.value))}
            aria-label="Number of loops"
            className="mt-1 w-full"
          />
          <span className="flex justify-between font-mono text-[10px] text-muted-foreground">
            {mode.loops.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat k="effective depth" v={`${mode.m} x ${loops} = ${effDepth}`} tag="paper" />
          <Stat
            k="per-token compute"
            v={mode.flop ? `f = ${mode.flop[i]} d² (top-${mode.topk[i]})` : `≈ ${loops}x the blocks`}
            tag="reasoned"
          />
          <Stat k="KV cache" v={`${loops}x baseline`} tag="reasoned" />
          <Stat
            k="optimizer steps / batch"
            v={mode.segmented ? `${optSteps}` : "1 (full backprop)"}
            tag="code"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            k="validation PPL"
            v={`${mode.ppl[i].toFixed(2)}${i === base ? "" : ` (${dPpl > 0 ? "+" : ""}${dPpl.toFixed(2)})`}`}
            tag="reported"
            hl={i === best}
          />
          <Stat
            k="7-task avg acc"
            v={`${mode.acc[i].toFixed(2)}%${i === base ? "" : ` (${dAcc > 0 ? "+" : ""}${dAcc.toFixed(2)})`}`}
            tag="reported"
          />
        </div>

        {mode.flop ? (
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span style={{ color: ATTN }}>attention {(attnShare * 100).toFixed(0)}%</span>
              <span style={{ color: EXPERT }}>experts {((1 - attnShare) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full border">
              <div style={{ width: `${(attnShare * 100).toFixed(1)}%`, background: ATTN }} />
              <div style={{ width: `${((1 - attnShare) * 100).toFixed(1)}%`, background: EXPERT }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Where the fixed budget goes (reasoned from Eq. 5): attention costs 6 per pass, experts 3 per
              selected expert per pass. Looping at iso-FLOP moves compute out of experts and into attention.
            </p>
          </div>
        ) : null}

        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Validation perplexity by loop count">
          <line x1={PX} x2={W - PX} y1={H - PB} y2={H - PB} stroke="currentColor" strokeOpacity={0.2} />
          {mode.naive
            ? mode.naive.map((v, j) =>
                v == null ? (
                  <text
                    key={`n${j}`}
                    x={xAt(j)}
                    y={PT + 8}
                    textAnchor="middle"
                    fontSize={9}
                    fill="currentColor"
                    fillOpacity={0.6}
                    className="font-mono"
                  >
                    naive: {mode.naiveSpike?.[j]}†
                  </text>
                ) : (
                  <circle key={`n${j}`} cx={xAt(j)} cy={yAt(v)} r={3.5} fill="none" stroke="currentColor" strokeOpacity={0.55} />
                ),
              )
            : null}
          <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} />
          {mode.ppl.map((v, j) => (
            <g key={j}>
              <circle cx={xAt(j)} cy={yAt(v)} r={j === i ? 6 : 3.5} fill={ACCENT} fillOpacity={j === i ? 1 : 0.6} />
              <text x={xAt(j)} y={yAt(v) - 9} textAnchor="middle" fontSize={10} fill="currentColor" className="font-mono">
                {v.toFixed(2)}
              </text>
              <text x={xAt(j)} y={H - 10} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6} className="font-mono">
                {mode.loops[j]}x
              </text>
            </g>
          ))}
        </svg>
        <p className="text-[11px] text-muted-foreground">
          Filled: LOOM validation perplexity, lower is better.
          {mode.naive ? " Hollow: the same backbone looped with no technique; † marks an unrecoverable loss spike." : ""}
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v, tag, hl }: { k: string; v: string; tag: string; hl?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", hl ? "border-foreground/40 bg-muted/40" : "")}>
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
        <span>{k}</span>
        <span className="rounded border px-1 text-[9px] uppercase tracking-wide">{tag}</span>
      </div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  )
}
