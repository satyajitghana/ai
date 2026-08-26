"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The Whittle carve, drawn from the shapes in the checkpoint rather than the card.
//
// config.json (logic65/Qwen3.8-Whittle-MoE-27B-A17.8B):
//   hidden_size 5120 · intermediate_size 17408 · num_hidden_layers 64
//   num_experts 64 · num_experts_per_tok 16
//   moe_intermediate_size 192 · shared_expert_intermediate_size 5120
//
// and 64 * 192 + 5120 = 17408 exactly, so the parent's dense FFN is partitioned,
// not rebuilt. moe27_plan.py decides which neurons go where: it streams real
// tokens, records how often each neuron lands in a token's top-5% activation
// slice ("hotness"), sends the `--shared` hottest to an always-on shared expert,
// and balanced-k-means-clusters the rest into equal-size routed slivers.
//
// Parameter groups summed tensor-by-tensor from model.safetensors.index.json plus
// the 15 shard headers (read by HTTP range request, 8-byte length prefix then the
// JSON header):
//   routed expert pool            12,079,595,520   (64 layers x 64 x 2,949,120)
//   everything else, always on    14,837,702,144
//   total                         26,917,297,664
//
// So active(k) = 14,837,702,144 + k * 188,743,680, which is linear in k and never
// drops below 55.8% of the model. That is the point of the second strip.

const SHARED = "oklch(0.60 0.15 255)"
const FIRED = "oklch(0.55 0.16 155)"
const SKIPPED = "oklch(0.58 0.19 27)"

const N_FF = 17408
const N_SHARED = 5120
const N_EXP = 64
const W_EXP = 192

const FLOOR = 14_837_702_144
const PER_K = 188_743_680
const TOTAL = 26_917_297_664

const TOKENS = ["the", "SELECT", "∫"] as const

// deterministic per-token expert affinity — a seeded LCG, never Math.random
function affinity(seed: number): number[] {
  let s = (seed * 7919 + 12345) % 2147483647
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  return Array.from({ length: N_EXP }, () => rnd())
}

const AFFINITY = TOKENS.map((_, i) => affinity(i + 1))

export function FfnSplit() {
  const [k, setK] = useState(16)
  const [tok, setTok] = useState(0)

  const aff = AFFINITY[tok]
  const cutoff = [...aff].sort((a, b) => b - a)[k - 1]
  const fired = aff.map((v) => v >= cutoff)

  const activeWidth = N_SHARED + k * W_EXP
  const activeParams = FLOOR + k * PER_K

  const W = 700
  const X0 = 16
  const SPAN = W - X0 - 16
  const px = (n: number) => (n / N_FF) * SPAN
  const sharedW = px(N_SHARED)
  const expW = px(W_EXP)

  const pp = (n: number) => (n / TOTAL) * SPAN
  const floorW = pp(FLOOR)
  const firedW = pp(k * PER_K)
  const skipW = pp((N_EXP - k) * PER_K)

  const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          17408 = 5120 + 64 × 192 — one layer&rsquo;s FFN, partitioned
        </span>
        <span className="font-mono text-[10px]" style={{ color: FIRED }}>
          top-{k} · {activeWidth.toLocaleString()} of 17408 neurons ·{" "}
          {(activeParams / 1e9).toFixed(2)}B active
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">token</span>
          {TOKENS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTok(i)}
              aria-pressed={tok === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tok === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
          <span className="ml-1 font-mono text-[9px] text-muted-foreground">
            (illustrative routing — the geometry is real, the choice of experts is seeded)
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} 178`}
            width={W}
            height={178}
            role="img"
            className="min-w-[660px] max-w-full"
          >
            <title>
              {`One FFN layer of 17408 neurons split into a 5120-wide always-on shared expert and 64 routed slivers of 192. At top-${k}, ${activeWidth} of 17408 neurons run for this token, which is ${pct(activeWidth, N_FF)} of the layer; across the whole model that is ${(activeParams / 1e9).toFixed(2)} billion of 26.92 billion parameters, or ${pct(activeParams, TOTAL)}.`}
            </title>

            <text
              x={X0}
              y={12}
              fontSize={8.5}
              fill="currentColor"
              fillOpacity={0.55}
              fontFamily="ui-monospace, monospace"
            >
              one layer&rsquo;s FFN neurons
            </text>

            <rect x={X0} y={20} width={sharedW} height={30} rx={3} fill={SHARED} fillOpacity={0.85} />
            {Array.from({ length: N_EXP }, (_, j) => (
              <rect
                key={j}
                x={X0 + sharedW + j * expW + 0.5}
                y={20}
                width={Math.max(1, expW - 1)}
                height={30}
                rx={1}
                fill={fired[j] ? FIRED : "currentColor"}
                fillOpacity={fired[j] ? 0.9 : 0.13}
              />
            ))}

            <text
              x={X0 + sharedW / 2}
              y={39}
              fontSize={8.5}
              textAnchor="middle"
              fill="white"
              fontFamily="ui-monospace, monospace"
            >
              5120 always on
            </text>

            <line x1={X0} y1={57} x2={X0 + sharedW} y2={57} stroke={SHARED} strokeWidth={1.2} />
            <text x={X0} y={69} fontSize={8} fill={SHARED} fontFamily="ui-monospace, monospace">
              shared expert — the 5120 hottest neurons, never skipped
            </text>
            <line
              x1={X0 + sharedW}
              y1={57}
              x2={X0 + SPAN}
              y2={57}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1.2}
            />
            <text
              x={X0 + SPAN}
              y={69}
              fontSize={8}
              textAnchor="end"
              fill="currentColor"
              fillOpacity={0.55}
              fontFamily="ui-monospace, monospace"
            >
              64 routed slivers × 192 — {k} lit, {N_EXP - k} dark
            </text>

            <text
              x={X0}
              y={100}
              fontSize={8.5}
              fill="currentColor"
              fillOpacity={0.55}
              fontFamily="ui-monospace, monospace"
            >
              the whole model, 26,917,297,664 parameters
            </text>

            <rect x={X0} y={108} width={floorW} height={30} rx={3} fill="currentColor" fillOpacity={0.18} />
            <rect x={X0 + floorW} y={108} width={firedW} height={30} fill={FIRED} fillOpacity={0.9} />
            <rect
              x={X0 + floorW + firedW}
              y={108}
              width={skipW}
              height={30}
              rx={3}
              fill={SKIPPED}
              fillOpacity={0.1}
              stroke={SKIPPED}
              strokeOpacity={0.5}
              strokeDasharray="3 2"
            />

            <text
              x={X0 + floorW / 2}
              y={127}
              fontSize={8.5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.7}
              fontFamily="ui-monospace, monospace"
            >
              always-on floor 14.84B
            </text>

            <line
              x1={X0 + floorW + firedW}
              y1={104}
              x2={X0 + floorW + firedW}
              y2={148}
              stroke={FIRED}
              strokeWidth={1.2}
            />
            <text
              x={X0 + floorW + firedW - 6}
              y={160}
              fontSize={9}
              textAnchor="end"
              fill={FIRED}
              fontFamily="ui-monospace, monospace"
            >
              {(activeParams / 1e9).toFixed(2)}B active — {pct(activeParams, TOTAL)}
            </text>
            {k < 58 ? (
              <text
                x={X0 + floorW + firedW + 6}
                y={160}
                fontSize={8}
                fill={SKIPPED}
                fillOpacity={0.85}
                fontFamily="ui-monospace, monospace"
              >
                {(((N_EXP - k) * PER_K) / 1e9).toFixed(2)}B skipped
              </text>
            ) : null}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            experts per token
          </span>
          <Range
            min={1}
            max={64}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="flex-1"
            aria-label="how many of the 64 routed experts fire for each token"
            accent={FIRED}
          />
          <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            k = {k}
          </span>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          active(k) = 14,837,702,144 + k × 188,743,680 — the shipped model is{" "}
          <span className="text-foreground">k = 16</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The split is exact: <span className="text-foreground">64 × 192 + 5120 = 17408</span>, the
          parent&rsquo;s FFN width to the neuron, with no weights invented and none thrown away. What
          changes is only how much of it runs per token.
          <br />
          <br />
          Now drag <span className="font-mono text-[11px] text-foreground">k</span>{" "}down. The green
          slice shrinks and the strip barely moves, because the routed pool is only{" "}
          <span style={{ color: SKIPPED }}>44.9%</span>{" "}of the parameters and the shared expert
          alone is 5.03B of what is left. Even{" "}
          <span className="font-mono text-[11px] text-foreground">k = 1</span>{" "}still runs 55.8% of
          the model. There is no setting of this slider at which the word{" "}
          <em>sparse</em>{" "}applies.
        </p>
      </div>
    </figure>
  )
}
