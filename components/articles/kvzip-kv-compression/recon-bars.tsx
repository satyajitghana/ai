"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why score by reconstruction instead of by the query's own attention.
//
// KVzip's Figure 5 compares the maximum attention a KV pair receives during
// PREFILL versus during RECONSTRUCTION (the "Repeat the previous context" pass).
// The reconstruction pass surfaces importance that prefill attention misses: a
// token can get little attention while it is being read, yet be exactly what the
// model needs to reproduce the context later. Score on prefill attention and you
// evict those tokens; score on reconstruction and you keep them.
//
// This toy makes that concrete. 48 tokens. recon[i] in [0,1] is the max
// attention token i receives when the model reconstructs the context — broad,
// because almost every token has to come back out. prefill[i] is the max
// attention it got while being read — spiky, concentrated on a few positions.
// "Needed" tokens are those with high recon score. At a fixed keep budget, we
// keep the top tokens by whichever signal is selected and count how many needed
// tokens survive.
//
// Deterministic: integer PRNG, no transcendental calls.

const N = 48

function mulberry32(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Data = { recon: number[]; prefill: number[] }
let DATA: Data | null = null

function build(): Data {
  if (DATA) return DATA
  const rnd = mulberry32(11)
  const recon = new Array<number>(N)
  const prefill = new Array<number>(N)
  for (let i = 0; i < N; i++) {
    // reconstruction attention: broad, most tokens matter
    recon[i] = Math.min(1, 0.42 + 0.5 * rnd())
    // prefill attention: spiky, concentrated
    const spike = rnd() < 0.22 ? 0.55 + 0.45 * rnd() : 0.03 + 0.22 * rnd()
    prefill[i] = Math.min(1, spike)
  }
  // a handful of structurally redundant tokens are low on both
  for (let k = 0; k < 6; k++) {
    const j = Math.floor(rnd() * N)
    recon[j] = 0.08 + 0.14 * rnd()
    prefill[j] = 0.03 + 0.1 * rnd()
  }
  DATA = { recon, prefill }
  return DATA
}

function topKeep(scores: number[], keep: number): boolean[] {
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  const kept = new Array<boolean>(N).fill(false)
  for (let k = 0; k < keep; k++) kept[order[k][1]] = true
  return kept
}

const RECON = "oklch(0.72 0.19 150)"
const PREFILL = "oklch(0.66 0.17 265)"
const MISS = "oklch(0.68 0.21 25)"
const NEED = 0.5

export function ReconBars() {
  const [pct, setPct] = useState(40) // keep budget, percent
  const [signal, setSignal] = useState<"recon" | "prefill">("prefill")

  const { recon, prefill } = build()
  const keep = Math.max(1, Math.round((pct / 100) * N))

  const { kept, needed, nNeed, hit } = useMemo(() => {
    const kept = topKeep(signal === "recon" ? recon : prefill, keep)
    const needed = recon.map((v) => v > NEED)
    let nNeed = 0
    let nHit = 0
    for (let i = 0; i < N; i++)
      if (needed[i]) {
        nNeed++
        if (kept[i]) nHit++
      }
    return { kept, needed, nNeed, hit: nHit }
  }, [signal, keep, recon, prefill])

  const W = 720
  const H = 150
  const PL = 4
  const PB = 18
  const bw = (W - 2 * PL) / N
  const scores = signal === "recon" ? recon : prefill
  const color = signal === "recon" ? RECON : PREFILL

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          score the cache by: {signal === "recon" ? "reconstruction attention" : "prefill attention"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSignal("prefill")}
            aria-pressed={signal === "prefill"}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
              signal === "prefill"
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            prefill
          </button>
          <button
            type="button"
            onClick={() => setSignal("recon")}
            aria-pressed={signal === "recon"}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
              signal === "recon"
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            reconstruction
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>keep budget</span>
          <Range
            min={10}
            max={100}
            step={10}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            aria-label="Keep budget percent"
            accent={color}
            className="w-40"
          />
          <span className="text-foreground tabular-nums">
            {keep}/{N} kept
          </span>
          <span className="tabular-nums" style={{ color: hit === nNeed ? RECON : MISS }}>
            {hit}/{nNeed} needed pairs survive
          </span>
        </label>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Per-token ${signal === "recon" ? "reconstruction" : "prefill"} attention for 48 tokens, keeping the top ${keep}. ${hit} of ${nNeed} tokens that reconstruction marks as needed survive.`}
        >
          {Array.from({ length: N }, (_, i) => {
            const h = scores[i] * (H - PB)
            const x = PL + i * bw
            const isKept = kept[i]
            const isMiss = needed[i] && !isKept
            return (
              <rect
                key={i}
                x={x + 1}
                y={H - PB - h}
                width={bw - 2}
                height={h}
                rx={1.5}
                fill={isMiss ? MISS : color}
                fillOpacity={isKept ? 0.9 : 0.16}
              />
            )
          })}
          <line
            x1={PL}
            y1={H - PB}
            x2={W - PL}
            y2={H - PB}
            stroke="currentColor"
            strokeOpacity="0.2"
          />
          <text x={PL} y={H - 4} fontSize="10" className="fill-muted-foreground font-mono">
            48 context tokens · faded = evicted · red = needed but evicted
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Switch to <span className="text-foreground">prefill</span> at a 40% budget: the signal is spiky, so
          the cache keeps a few heavily-attended tokens and throws away a pile the model actually needs to
          reproduce the context (the red bars). <span className="text-foreground">Reconstruction</span>{" "}
          attention is broad because almost every token has to come back out, so the same budget keeps the
          pairs that matter. KVzip scores on the reconstruction pass for exactly this reason.
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
          Illustrative: synthetic per-token scores, 48 tokens. The prefill-versus-reconstruction contrast is
          the paper&apos;s (Figure 5); the bar heights are the toy&apos;s.
        </p>
      </div>
    </figure>
  )
}
