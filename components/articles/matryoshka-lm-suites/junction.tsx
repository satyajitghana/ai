"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The junction between nested sub-models, and why it needs the rescale.
//
// Sub-model m outputs D_m dimensions; sub-model m+1 wants D_{m+1}. The naive fix
// is to concatenate a fresh input embedding covering the new channels:
//
//   next input = concat( e^{m+1}, o^m )
//
// That fails for a reason worth remembering: Transformer outputs have much larger
// norms than input embeddings, so the low-index channels arrive at the next block
// with a magnitude the freshly-initialized channels do not share, and training
// destabilizes there. So the output is rescaled to match the embedding's norm
// first:
//
//   o~ = o * ||e|| / ||o||
//   next input = concat( e, o~ )
//
// The junction adds no parameters at all.
//
// Both halves earn their place, and the 200M ablation prices them. Full recipe
// 20.07 average validation PPL; drop the norm match, 20.22; replace the fresh
// embedding with zeros, 20.61; drop distillation, 20.27. The Vanilla suite is
// 20.05, so the full recipe lands within 0.02 of it.
//
// The norm slider is illustrative — a stand-in for the magnitude mismatch, not a
// measured ratio.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const ABLATION = [
  { l: "Vanilla suite (independent baseline)", v: 20.05, c: MUTED, note: "three separately trained models — the target to land on" },
  { l: "fresh embeddings + norm + distillation", v: 20.07, c: GOOD, note: "the full recipe, within 0.02 PPL of the baseline" },
  { l: "fresh embeddings + norm, no distillation", v: 20.22, c: ACCENT, note: "+0.15 — felt most by the smaller sub-models" },
  { l: "fresh embeddings + distillation, no norm match", v: 20.27, c: ACCENT, note: "+0.20 — the magnitude mismatch, unmanaged" },
  { l: "zero padding instead of fresh embeddings", v: 20.61, c: WARM, note: "+0.54 — off on every sub-model size" },
]

export function Junction() {
  const [rescale, setRescale] = useState(true)
  const [ratio, setRatio] = useState(6)

  // Illustrative magnitudes: the output arrives ~ratio× larger than a fresh embedding.
  const oldMag = rescale ? 1 : ratio
  const newMag = 1

  const W = 720
  const H = 116
  const D1 = 190 // width representing D_m
  const D2 = 150 // width representing the new channels
  const BX = 120
  const BAR_Y = 56

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          õ<sup>m</sup> = o<sup>m</sup> · ‖e<sup>m+1</sup>‖ / ‖o<sup>m</sup>‖ · then concat — no new parameters
        </span>
        <span className="font-mono text-[10px]" style={{ color: rescale ? GOOD : WARM }}>
          {rescale ? "magnitudes matched" : `${ratio}× mismatch across the seam`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              The input to the next sub-model, drawn as two adjoining bands: the previous sub-model&rsquo;s output
              occupying the first D_m channels and a freshly initialized embedding covering the new ones, with
              their relative magnitudes shown as bar heights.
            </title>

            <text x={8} y={20} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              input to sub-model m+1, D
              <tspan fontSize={7} dy={2}>m+1</tspan>
              <tspan dy={-2}> channels wide</tspan>
            </text>

            {/* previous output band */}
            <rect
              x={BX}
              y={BAR_Y - Math.min(46, 8 * oldMag)}
              width={D1}
              height={Math.min(46, 8 * oldMag)}
              fill={ACCENT}
              fillOpacity={0.75}
            />
            <rect x={BX} y={BAR_Y} width={D1} height={22} fill={ACCENT} fillOpacity={0.2} stroke={ACCENT} strokeOpacity={0.6} />
            <text x={BX + D1 / 2} y={BAR_Y + 15} fontSize={10} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
              {rescale ? "õ" : "o"}
              <tspan fontSize={7} dy={-3}>m</tspan>
            </text>
            <text x={BX + D1 / 2} y={BAR_Y + 36} fontSize={8.5} fill={ACCENT} textAnchor="middle" fontFamily="ui-monospace, monospace">
              first D
              <tspan fontSize={6.5} dy={2}>m</tspan>
              <tspan dy={-2}> channels</tspan>
            </text>

            {/* fresh embedding band */}
            <rect x={BX + D1 + 4} y={BAR_Y - 8 * newMag} width={D2} height={8 * newMag} fill={GOOD} fillOpacity={0.75} />
            <rect x={BX + D1 + 4} y={BAR_Y} width={D2} height={22} fill={GOOD} fillOpacity={0.2} stroke={GOOD} strokeOpacity={0.6} />
            <text x={BX + D1 + 4 + D2 / 2} y={BAR_Y + 15} fontSize={10} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
              e
              <tspan fontSize={7} dy={-3}>m+1</tspan>
            </text>
            <text x={BX + D1 + 4 + D2 / 2} y={BAR_Y + 36} fontSize={8.5} fill={GOOD} textAnchor="middle" fontFamily="ui-monospace, monospace">
              the new channels
            </text>

            {/* the seam */}
            <line x1={BX + D1 + 2} y1={BAR_Y - 38} x2={BX + D1 + 2} y2={BAR_Y + 24} stroke={rescale ? GOOD : WARM} strokeWidth={1.5} strokeDasharray="3 2" />
            <text
              x={BX + D1 + 2}
              y={BAR_Y - 43}
              fontSize={8.5}
              fill={rescale ? GOOD : WARM}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {rescale ? "the seam — no discontinuity" : "the seam — a magnitude cliff"}
            </text>

            <text x={8} y={BAR_Y - 4} fontSize={8.5} fill="currentColor" fillOpacity={0.45} textAnchor="start" fontFamily="ui-monospace, monospace">
              ‖ · ‖
            </text>
          </svg>
        </div>

        <div className="mt-1.5 space-y-0.5 font-mono text-[9px] text-muted-foreground">
          <div>
            <span style={{ color: ACCENT }}>õ<sup>m</sup></span> carries information up from the sub-model below;{" "}
            <span style={{ color: GOOD }}>e<sup>m+1</sup></span> is freshly initialized, exactly as a standalone
            model&rsquo;s input embedding would be. Bar height above each band is its magnitude.
          </div>
          <div>
            {rescale
              ? "Both halves arrive at the next block at the same scale, so the low-index channels train like the rest."
              : "Transformer outputs carry much larger norms than input embeddings — training destabilizes in the low-index channels."}
          </div>
          <div>
            Each sub-model also has its own LM head W<sub>m</sub> and its own cross-entropy loss, so every exit
            detaches as a standalone checkpoint with its own depth and KV-cache footprint.
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRescale((v) => !v)}
            aria-pressed={rescale}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-muted/20",
              rescale && "bg-muted/40",
            )}
            style={{ borderColor: rescale ? `${GOOD}66` : `${WARM}66` }}
          >
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: rescale ? GOOD : WARM }} />
            <span className="font-mono text-[10px] text-foreground">
              {rescale ? "norm rescaling on" : "norm rescaling off"}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">mismatch (illustrative)</span>
            <Range
              min={2}
              max={10}
              step={1}
              value={ratio}
              onChange={(e) => setRatio(Number(e.target.value))}
              className="flex-1"
              aria-label="how much larger the output norm is than the embedding norm"
              accent={WARM}
              disabled={rescale}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{ratio}×</span>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            what each half is worth — 200M proxy suite, average validation perplexity, lower is better
          </div>
          <div className="mt-2 space-y-1">
            {ABLATION.map((a) => (
              <div key={a.l}>
                <div className="flex items-center gap-2">
                  <span className="w-64 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{a.l}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${((a.v - 19.9) / 0.8) * 100}%`, background: a.c, opacity: 0.85 }} />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: a.c }}>
                    {a.v.toFixed(2)}
                  </span>
                </div>
                <div className="pl-2 font-mono text-[9px] text-muted-foreground">{a.note}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Turn the rescaling off and the picture shows the actual failure: the first{" "}
          <span className="font-mono text-[11px] text-foreground">D_m</span>{" "}channels arrive carrying Transformer
          output magnitudes while the new ones arrive at embedding scale, and the next block has to learn across a
          cliff.{" "}
          <span className="text-foreground">The fix is one division and it adds no parameters</span>{" "}— rescale the
          output so its norm matches the embedding&rsquo;s, then concatenate.
          <br />
          <br />
          The ablation prices both halves honestly. Zero padding instead of a fresh embedding is the worse mistake
          at +0.54 average perplexity; dropping the norm match costs +0.20. The full recipe lands within{" "}
          <span className="text-foreground">0.02</span>{" "}of the independently-trained baseline — which is the
          number the whole nesting argument rests on, because near-parity at every exit is what makes the 38%
          parameter saving a saving rather than a trade.
        </p>
      </div>
    </figure>
  )
}
