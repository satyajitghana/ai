"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Where "35B-A3B" actually comes from, summed over real tensor shapes.
//
// Shapes read from ornith-ai/Ornith-1.5-35B-A3B's safetensors headers (the
// first 8 bytes of each shard give the JSON header length; the header lists
// every tensor's dtype and shape). Per block, from config.json and those
// shapes:
//
//   experts.gate_up_proj  [256, 1024, 2048]  -> 2,097,152 per expert
//   experts.down_proj     [256, 2048,  512]  -> 1,048,576 per expert
//                                            => 3,145,728 per expert
//   mlp.gate.weight       [256, 2048]        ->   524,288  router, all 40 blocks
//   shared_expert         gate/up/down + gate ->  3,147,776  all 40 blocks
//   linear_attn (30 blocks)                  ->  33,718,464 each
//   self_attn   (10 blocks)                  ->  27,263,488 each
//   embed_tokens / lm_head [248320, 2048]    -> 508,559,360 each
//
// Summing every language-model tensor gives 34,660,610,688 — which is exactly
// the `gguf.total` the Hub reports for the GGUF repo, and exactly the full
// checkpoint (35,951,822,704) minus the vision tower (446,571,248) and the MTP
// block (844,640,768). Neither of those two ships in these GGUFs.
//
// Active per token, k = num_experts_per_tok = 8:
//   40 blocks x 8 x 3,145,728              = 1,006,632,960  routed experts
//   30 x 33,718,464                        = 1,011,553,920  linear attention
//   lm_head                                =   508,559,360
//   10 x 27,263,488                        =   272,634,880  full attention
//   40 x 3,147,776                         =   125,911,040  shared expert
//   40 x 524,288                           =    20,971,520  router
//   layer norms                            =       165,888
//                                          = 2,946,429,568  -> "A3B" checks out
//
// The embedding matrix is excluded: it is a row lookup, not a matmul.

const EXPERTS = "oklch(0.68 0.13 85)"
const LINEAR = "oklch(0.60 0.15 255)"
const HEAD = "oklch(0.55 0.16 155)"
const FULL = "oklch(0.58 0.19 27)"
const SHARED = "oklch(0.62 0.03 250)"
const ROUTER = "currentColor"

const PER_EXPERT = 3145728
const BLOCKS = 40
const N_EXPERTS = 256
const TOTAL = 34660610688
const EXPERT_BANK = 32212254720 // 256 x 40 x PER_EXPERT

const FIXED = [
  { k: "linear", label: "linear attention", n: 1011553920, c: LINEAR, note: "30 of 40 blocks" },
  { k: "head", label: "output head", n: 508559360, c: HEAD, note: "248,320 x 2,048" },
  { k: "full", label: "full attention", n: 272634880, c: FULL, note: "10 of 40 blocks" },
  { k: "shared", label: "shared expert", n: 125911040, c: SHARED, note: "always on, every block" },
  { k: "router", label: "router", n: 20971520 + 165888, c: ROUTER, note: "+ norms, kept at F32" },
]
const FIXED_SUM = FIXED.reduce((a, b) => a + b.n, 0)

// A fixed shuffle so the lit cells look scattered but never move between
// renders — SSR and the browser must agree, so no Math.random().
const ORDER = (() => {
  let s = 12345
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const a = Array.from({ length: N_EXPERTS }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
})()

const W = 700
const H = 214
const GX = 14
const GY = 30
const CELL = 7
const PITCH = 8.5
const PX = 190
const PW = 496

const bn = (n: number) => (n / 1e9).toFixed(3)
const mn = (n: number) => {
  const v = Math.round(n / 1e6)
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export function ActiveBudget() {
  const [k, setK] = useState(8)

  const routed = k * PER_EXPERT * BLOCKS
  const active = FIXED_SUM + routed
  const segs = [{ k: "routed", label: `routed experts (${k} of 256)`, n: routed, c: EXPERTS, note: `${((k / N_EXPERTS) * 100).toFixed(1)}% of the bank` }, ...FIXED]

  const lit = new Set(ORDER.slice(0, k))
  const totalScale = PW / TOTAL
  const activeScale = PW / active

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          34.661 B total · {bn(active)} B active per token
        </span>
        <span className="font-mono text-[10px]" style={{ color: k === 8 ? EXPERTS : SHARED }}>
          {((active / TOTAL) * 100).toFixed(1)}% of the weights run{k === 8 ? " — the shipped setting" : ""}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`One block's bank of 256 routed experts with ${k} lit, next to the parameter budget: ${bn(
                TOTAL,
              )} billion parameters in total, of which ${bn(active)} billion run for a given token. Routed experts are ${(
                (routed / active) *
                100
              ).toFixed(0)}% of that active budget.`}
            </title>

            <text x={GX} y={16} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              one block · 256 experts
            </text>
            {ORDER.map((_, idx) => {
              const on = lit.has(idx)
              return (
                <rect
                  key={idx}
                  x={GX + (idx % 16) * PITCH}
                  y={GY + Math.floor(idx / 16) * PITCH}
                  width={CELL}
                  height={CELL}
                  rx={1}
                  fill={on ? EXPERTS : "currentColor"}
                  fillOpacity={on ? 0.95 : 0.1}
                />
              )
            })}
            <text
              x={GX}
              y={GY + 16 * PITCH + 12}
              fontSize={8}
              fill={EXPERTS}
              fontFamily="ui-monospace, monospace"
            >
              {k} lit · {mn(k * PER_EXPERT)} M of {mn(N_EXPERTS * PER_EXPERT)} M
            </text>
            <text
              x={GX}
              y={GY + 16 * PITCH + 24}
              fontSize={7}
              fill="currentColor"
              fillOpacity={0.42}
              fontFamily="ui-monospace, monospace"
            >
              a different {k} for every token, in every block
            </text>

            {/* row A: total */}
            <text x={PX} y={16} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              all parameters in the file · 34.661 B
            </text>
            <rect x={PX} y={22} width={EXPERT_BANK * totalScale} height={16} fill={EXPERTS} fillOpacity={0.35} />
            <rect
              x={PX + EXPERT_BANK * totalScale}
              y={22}
              width={PW - EXPERT_BANK * totalScale}
              height={16}
              fill={LINEAR}
              fillOpacity={0.5}
            />
            <text
              x={PX + 6}
              y={33}
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.75}
              fontFamily="ui-monospace, monospace"
            >
              256 experts per block · 32.212 B · 93%
            </text>

            {/* row B: active, same scale */}
            <text x={PX} y={58} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              what a single token touches · {bn(active)} B
            </text>
            <rect x={PX} y={64} width={PW} height={16} fill="currentColor" fillOpacity={0.06} />
            <rect x={PX} y={64} width={active * totalScale} height={16} fill={EXPERTS} fillOpacity={0.9} />
            <text
              x={PX + active * totalScale + 8}
              y={75}
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              {((active / TOTAL) * 100).toFixed(1)}% — the rest of the bank sits idle
            </text>

            {/* row C: the active budget, expanded */}
            <line x1={PX} y1={84} x2={PX} y2={98} stroke="currentColor" strokeOpacity={0.25} />
            <line
              x1={PX + active * totalScale}
              y1={84}
              x2={PX + PW}
              y2={98}
              stroke="currentColor"
              strokeOpacity={0.25}
            />
            <text x={PX} y={110} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              that {bn(active)} B, expanded
            </text>
            {(() => {
              let cur = PX
              return segs.map((s) => {
                const w = s.n * activeScale
                const x = cur
                cur += w
                return <rect key={s.k} x={x} y={116} width={Math.max(0.8, w)} height={18} fill={s.c} fillOpacity={s.k === "router" ? 0.35 : 0.85} />
              })
            })()}

            {segs.map((s, i) => (
              <g key={s.k} transform={`translate(${PX + (i % 3) * 168}, ${Math.floor(i / 3) * 20 + 152})`}>
                <rect x={0} y={-7} width={7} height={7} rx={1} fill={s.c} fillOpacity={s.k === "router" ? 0.35 : 0.85} />
                <text x={11} y={0} fontSize={7.5} fill="currentColor" fillOpacity={0.72} fontFamily="ui-monospace, monospace">
                  {mn(s.n)} M
                </text>
                <text x={11} y={9} fontSize={6.5} fill="currentColor" fillOpacity={0.42} fontFamily="ui-monospace, monospace">
                  {s.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            experts per token
          </span>
          <Range
            min={1}
            max={32}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="flex-1"
            aria-label="number of routed experts activated per token"
            accent={EXPERTS}
          />
          <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            k = {k}
          </span>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          config.json ships <span className="text-foreground">num_experts_per_tok: 8</span>{" "}
          against <span className="text-foreground">num_experts: 256</span>. Every other bar is fixed
          by the architecture.
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The A3B arithmetic survives contact with the tensor shapes: 2.946 B parameters do work on
          each token, out of 34.661 B stored. What surprised me is the composition. Only{" "}
          <span style={{ color: EXPERTS }}>34%</span>{" "}of that active budget is the mixture. An
          equal share is <span style={{ color: LINEAR }}>linear attention</span>, because the 30
          gated-delta blocks are dense and every one of them runs; another 17% is the output head
          against a 248,320-token vocabulary.
          <br />
          <br />
          Which is why turning k down does less than you would guess. Drag it to 1 and 0.88 B of
          the 2.95 B goes away; 2.07 B still runs, because that part was never sparse to begin
          with.
        </p>
      </div>
    </figure>
  )
}
