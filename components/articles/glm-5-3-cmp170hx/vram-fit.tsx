"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"

// "Does a 320B W4A16 MoE fit?" — the resident-weight arithmetic for
// GLM-5.3-Flash across N cards of a chosen size.
//
// GLM-5.3-Flash is 320B total parameters (reported, base model card). An MoE
// activates only 18B of them per token, but EVERY expert must be resident, so
// the whole parameter count sets the weight footprint. The weight bytes are a
// reasoned estimate: parameters x bits-per-weight / 8. W4A16 is 4-bit packed
// weights with one FP16 scale per group of 128 (confirmed group_size 128,
// num_bits 4, symmetric int in the quant config of
// canada-quant/GLM-5.3-Flash-W4A16-MTP), so ~4 + 16/128 = 4.125 effective
// bits/weight. BF16 and FP8 are shown for contrast; neither is what the recipe
// runs.
//
// Usable fraction is the recipe's --gpu-memory-utilization 0.95 (reported). The
// remainder after weights is what is left per setup for the full-precision KV
// pool, activations and CUDA-graph scratch.
//
// Only + - * / and Math.round / Math.ceil / Math.min / Math.max below, all exact
// per IEEE-754, so server and client render identical numbers (no lib/dmath
// transcendentals reach the DOM).

const GIB = 1073741824
const PARAMS = 320_000_000_000
const UTIL = 0.95

type BpwId = "w4a16" | "fp8" | "bf16"
const BPW: { id: BpwId; name: string; sub: string; bpw: number }[] = [
  { id: "w4a16", name: "W4A16", sub: "4.125 bpw", bpw: 4.125 },
  { id: "fp8", name: "FP8", sub: "8 bpw", bpw: 8 },
  { id: "bf16", name: "BF16", sub: "16 bpw", bpw: 16 },
]

// Per-card VRAM choices, GiB. 8 is the retail CMP 170HX; 64 is the modified
// ("ex-mining, re-populated") card the recipe assumes; 40/80 are the A100 SKUs
// the GA100 die also ships as.
const CARDS = [8, 16, 24, 40, 48, 64, 80]

const C_W = "oklch(0.60 0.15 255)" // weights
const C_FREE = "oklch(0.68 0.13 165)" // headroom
const C_OVER = "oklch(0.63 0.21 25)" // overflow / miss
const C_LINE = "oklch(0.63 0.20 25)"

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors " +
        (active
          ? "border-foreground/40 bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/40")
      }
    >
      {children}
    </button>
  )
}

const gib = (b: number) => b / GIB

export function VramFit() {
  const [bpwId, setBpwId] = useState<BpwId>("w4a16")
  const [card, setCard] = useState(64)
  const [cards, setCards] = useState(4)

  const bpw = (BPW.find((x) => x.id === bpwId) ?? BPW[0]).bpw
  const weights = (PARAMS * bpw) / 8 // bytes
  const perCardUsable = card * GIB * UTIL
  const totalUsable = cards * perCardUsable
  const free = totalUsable - weights
  const fits = free >= 0
  // cards needed to hold the weights with ~20% left over for KV + runtime
  const needWeights = Math.ceil(weights / perCardUsable)
  const needServe = Math.ceil(weights / (perCardUsable * 0.8))

  // chart: a stacked bar of total usable VRAM, weights filling it from the left
  const W = 640
  const H = 150
  const L = 16
  const R = 16
  const BAR_Y = 54
  const BAR_H = 34
  const scaleMax = Math.max(totalUsable, weights)
  const px = (bytes: number) => ((W - L - R) * bytes) / scaleMax
  const weightsW = Math.min(px(weights), W - L - R)
  const authorConfig = card === 64 && cards === 4 && bpwId === "w4a16"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Does a 320B MoE fit? Resident weights vs the VRAM you give it
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          weights reasoned · 0.95 usable
        </span>
      </div>

      <div className="space-y-2.5 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-16 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            precision
          </span>
          {BPW.map((b) => (
            <Pill key={b.id} active={bpwId === b.id} onClick={() => setBpwId(b.id)}>
              {b.name} <span className="opacity-60">{b.sub}</span>
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-16 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            per card
          </span>
          {CARDS.map((c) => (
            <Pill key={c} active={card === c} onClick={() => setCard(c)}>
              {c} GiB
              {c === 8 ? <span className="opacity-60"> retail</span> : null}
              {c === 64 ? <span className="opacity-60"> mod</span> : null}
            </Pill>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="w-16 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            cards
          </span>
          <Range
            min={1}
            max={24}
            step={1}
            value={cards}
            onChange={(e) => setCards(Number(e.target.value))}
            accent={C_W}
            className="flex-1"
            aria-label="number of cards"
          />
          <span className="w-10 text-right font-mono text-[12px] tabular-nums">{cards}</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${cards} cards of ${card} GiB give ${gib(totalUsable).toFixed(0)} GiB usable; ${bpwId} weights are ${gib(weights).toFixed(0)} GiB. ${fits ? `fits, ${gib(free).toFixed(0)} GiB left for KV and runtime` : `does not fit, short by ${gib(-free).toFixed(0)} GiB`}.`}
        >
          <text x={L} y={28} fontSize={11} fill="var(--muted-foreground)" className="font-mono">
            {cards} x {card} GiB x 0.95 = {gib(totalUsable).toFixed(0)} GiB usable
          </text>
          <text
            x={W - R}
            y={28}
            textAnchor="end"
            fontSize={11}
            className="font-mono"
            fill={fits ? C_FREE : C_OVER}
          >
            {fits
              ? `fits · ${gib(free).toFixed(0)} GiB for KV + runtime`
              : `short by ${gib(-free).toFixed(0)} GiB`}
          </text>

          {/* total usable track */}
          <rect
            x={L}
            y={BAR_Y}
            width={W - L - R}
            height={BAR_H}
            rx={5}
            fill={fits ? C_FREE : "var(--muted)"}
            opacity={fits ? 0.28 : 0.4}
          />
          {/* weights */}
          <rect x={L} y={BAR_Y} width={weightsW} height={BAR_H} rx={5} fill={fits ? C_W : C_OVER}>
            <title>{`weights ${gib(weights).toFixed(1)} GiB`}</title>
          </rect>
          {/* usable edge marker */}
          <line
            x1={L + px(totalUsable)}
            x2={L + px(totalUsable)}
            y1={BAR_Y - 5}
            y2={BAR_Y + BAR_H + 5}
            stroke={C_LINE}
            strokeWidth={2}
          />
          <text
            x={L + 8}
            y={BAR_Y + BAR_H / 2 + 4}
            fontSize={11.5}
            fill="var(--background)"
            className="font-mono"
          >
            weights {gib(weights).toFixed(0)} GiB
          </text>

          {/* legend / needed-cards readout */}
          <text x={L} y={BAR_Y + BAR_H + 30} fontSize={11} fill="var(--muted-foreground)" className="font-mono">
            {`weights alone need ${needWeights} card${needWeights === 1 ? "" : "s"} of ${card} GiB · to serve (KV headroom) ${needServe}`}
          </text>
          {authorConfig && (
            <text x={W - R} y={BAR_Y + BAR_H + 30} textAnchor="end" fontSize={11} fill="var(--foreground)" className="font-mono">
              the recipe&rsquo;s config
            </text>
          )}
        </svg>

        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          {card === 8 ? (
            <>
              <span className="text-foreground">Retail CMP 170HX is 8 GiB.</span> At W4A16 the
              320B weights ({gib((PARAMS * 4.125) / 8).toFixed(0)} GiB) need {Math.ceil((PARAMS * 4.125) / 8 / (8 * GIB * UTIL))} of
              them just to hold the weights &mdash; before a single KV token. That is why four
              retail cards cannot run this model, and the recipe assumes the 64 GiB modified card.
            </>
          ) : (
            <>
              320B total parameters, {gib((PARAMS * 4.125) / 8).toFixed(0)} GiB resident at W4A16.
              Only 18B activate per token, but all 288 experts must stay in memory, so the full
              count sets the footprint. KV is full precision and not counted here &mdash; it lives
              in whatever is left.
            </>
          )}
        </p>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Weight bytes are a reasoned estimate (320B x bits-per-weight / 8); W4A16 counts 4 bits plus
        one FP16 scale per 128 weights. Usable VRAM is the recipe&rsquo;s 0.95 utilisation. The
        full-precision KV pool, activations and CUDA-graph scratch come out of the headroom, not shown.
      </figcaption>
    </figure>
  )
}
