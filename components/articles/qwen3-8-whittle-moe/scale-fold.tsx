"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The identity the carve depends on, and the one condition under which it holds.
//
// moe27_build.py (logic65/Qwen3.8-Whittle-dev, moe/moe27_build.py) writes the
// split checkpoint and applies two scale corrections on the way out:
//
//   # Two scale corrections, because the graph does not simply add up what it runs.
//   # The shared expert is multiplied by sigmoid(gate), and a zero gate gives exactly
//   # 0.5, so its down_proj is doubled and the product comes back to the original.
//   # The routed branch normalises its top-k weights, making it an average of the k
//   # experts rather than their sum, so their down_proj carries a factor of k. Both
//   # are exact at uniform weights and the distillation pass refines the rest.
//   ...
//   add(out + "shared_expert.down_proj.weight", (d[:, sh].float()*2.0).to(torch.bfloat16))
//   ...
//   dn.append((d[:, sel].float()*A.topk).to(torch.bfloat16))
//
// The dense FFN the slivers came from computes a plain SUM over its neurons. The MoE
// layer computes a normalised weighted AVERAGE over the k it picked. Multiplying every
// routed down_proj by k converts one into the other — exactly, and only, when the
// router puts weight 1/k on each of its k choices. A softmax never does.
//
// So each selected expert's contribution enters the residual stream scaled by k·w_j
// rather than 1. This widget is that coefficient vector. The activations themselves
// are not something you can read out of a checkpoint, so this is the coefficient
// error, not an output error — but the coefficients are what the fold gets wrong.

const OK = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"
const INK = "oklch(0.62 0.03 250)"

const K = 16
const BASE_LOGITS = Array.from({ length: K }, (_, j) => -j * 0.42 - (j % 3) * 0.11)

const PRESETS = [
  ["uniform", 400],
  ["mild", 120],
  ["confident", 42],
  ["peaked", 16],
] as const

export function ScaleFold() {
  const [tau100, setTau100] = useState(120) // softmax temperature × 100

  const tau = tau100 / 100
  const ex = BASE_LOGITS.map((l) => mexp(l / tau))
  const z = ex.reduce((a, b) => a + b, 0)
  const w = ex.map((v) => v / z)
  const coef = w.map((v) => K * v) // what each expert is actually multiplied by

  const maxC = coef[0]
  const minC = coef[K - 1]
  const rms = Math.sqrt(coef.reduce((a, c) => a + (c - 1) * (c - 1), 0) / K)
  const exact = rms < 0.005

  const W = 700
  const X0 = 54
  const XW = W - X0 - 18
  const BW = XW / K
  const TOP = 26
  const BOT = 132
  const CAP = 4
  const y = (v: number) => BOT - (Math.min(v, CAP) / CAP) * (BOT - TOP)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          every routed <span className="text-foreground">down_proj</span> was multiplied by k = 16
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: exact ? OK : BAD }}
        >
          {exact
            ? "k·wⱼ = 1 for every expert — reconstruction exact"
            : `loudest expert ×${maxC.toFixed(2)} · quietest ×${minC.toFixed(2)} · rms error ${(100 * rms).toFixed(0)}%`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([label, v]) => (
            <button
              key={label}
              type="button"
              onClick={() => setTau100(v)}
              aria-pressed={tau100 === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tau100 === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} 162`}
            width={W}
            height={162}
            role="img"
            className="min-w-[660px] max-w-full"
          >
            <title>
              {`Sixteen bars, one per selected expert, showing the factor k times w that each expert's output is multiplied by. The loudest is ${maxC.toFixed(2)} times and the quietest ${minC.toFixed(2)} times, against the 1.0 the reconstruction assumes; root-mean-square deviation ${(100 * rms).toFixed(0)} percent.`}
            </title>

            {[0, 1, 2, 3, 4].map((t) => (
              <g key={t}>
                <line
                  x1={X0}
                  y1={y(t)}
                  x2={X0 + XW}
                  y2={y(t)}
                  stroke={t === 1 ? OK : "currentColor"}
                  strokeOpacity={t === 1 ? 0.75 : 0.12}
                  strokeWidth={t === 1 ? 1.3 : 1}
                  strokeDasharray={t === 1 ? "4 3" : undefined}
                />
                <text
                  x={X0 - 8}
                  y={y(t) + 3}
                  fontSize={8}
                  textAnchor="end"
                  fill={t === 1 ? OK : "currentColor"}
                  fillOpacity={t === 1 ? 1 : 0.45}
                  fontFamily="ui-monospace, monospace"
                  fontWeight={t === 1 ? 600 : 400}
                >
                  {t === 1 ? "1.0×" : `${t}×`}
                </text>
              </g>
            ))}

            {coef.map((c, j) => {
              const bx = X0 + j * BW + 2.5
              const bw = BW - 5
              const clipped = c > CAP
              const col = Math.abs(c - 1) < 0.02 ? OK : BAD
              return (
                <g key={j}>
                  <rect
                    x={bx}
                    y={y(c)}
                    width={bw}
                    height={Math.max(1.2, BOT - y(c))}
                    rx={1.5}
                    fill={col}
                    fillOpacity={clipped ? 0.95 : 0.8}
                  />
                  {clipped ? (
                    <text
                      x={bx + bw / 2}
                      y={TOP - 6}
                      fontSize={8}
                      textAnchor="middle"
                      fill={BAD}
                      fontFamily="ui-monospace, monospace"
                      fontWeight={600}
                    >
                      ×{c.toFixed(1)}
                    </text>
                  ) : null}
                </g>
              )
            })}

            <line x1={X0} y1={BOT} x2={X0 + XW} y2={BOT} stroke="currentColor" strokeOpacity={0.3} />
            <text
              x={X0}
              y={BOT + 13}
              fontSize={8}
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              expert 1
            </text>
            <text
              x={X0 + XW}
              y={BOT + 13}
              fontSize={8}
              textAnchor="end"
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              expert 16
            </text>
            <text
              x={X0 + XW / 2}
              y={BOT + 26}
              fontSize={8.5}
              textAnchor="middle"
              fill={exact ? OK : BAD}
              fontFamily="ui-monospace, monospace"
            >
              {exact
                ? "every contribution enters at its original strength"
                : "each expert enters the residual stream at k·wⱼ times its original strength"}
            </text>
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            router softmax
          </span>
          <Range
            min={16}
            max={400}
            step={2}
            value={tau100}
            onChange={(e) => setTau100(Number(e.target.value))}
            className="flex-1"
            aria-label="router softmax temperature: high is flat and uniform, low is peaked and confident"
            accent={exact ? OK : BAD}
          />
          <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            τ = {tau.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          drag left for a confident router, right for a flat one — the exact point is the far right
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A dense FFN <em>sums</em>{" "}its neurons. An MoE layer takes a normalised weighted{" "}
          <em>average</em>{" "}of the k experts it picked. To turn one into the other the build
          multiplies every routed{" "}
          <span className="font-mono text-[11px] text-foreground">down_proj</span>{" "}by k, so each
          expert lands in the residual stream scaled by{" "}
          <span className="font-mono text-[11px] text-foreground">k·wⱼ</span>{" "}rather than 1.
          <br />
          <br />
          That is an identity <span className="text-foreground">only at wⱼ = 1/k</span> — a router
          that is perfectly indifferent between its sixteen choices. Every step away from
          indifference is reconstruction error, and it arrives before you ask whether the router
          picked the <em>right</em>{" "}experts. This is why a freshly carved model is broken by
          construction, and it reframes what &ldquo;router healing&rdquo; has to buy: not better
          taste, just enough flatness that the fold stops lying.
        </p>
      </div>
    </figure>
  )
}
