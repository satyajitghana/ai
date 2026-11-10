"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What two stated numbers (594B total, 17B active) plus the model card's
// "48 layers, 8 of 384 experts" pin down about Inkling 2 Small's MoE, and how
// well the same arithmetic does on a model whose config we can read.
//
// For any MoE where shared experts, attention and embeddings are counted in
// both totals:  total - active = L_moe * (n - k) * E,  so the routed pool
// (n * L_moe * E) and its active slice (k * L_moe * E) follow without knowing
// the hidden size. Everything left over is always on.
//
// Inkling-Small's row is computed from its released config.json
// (hidden 4096, 42 layers, first 2 dense, 256 routed + 2 shared experts,
// top-6, expert width 2048): 25.17M per expert, 257.7B routed, 263.6B total,
// 11.9B active. The weights' safetensors index says 531,912,898,740 bytes,
// about 265.96B bf16 parameters. Inkling 2 Small's row is solved from the
// stated, rounded figures; its config is not public (HF returns 401).

const ROUTED = "oklch(0.58 0.14 255)"
const ACTIVE = "oklch(0.70 0.15 55)"
const ALWAYS = "oklch(0.62 0.12 160)"

const N = 384
const K = 8
const TOTAL = 594

// Inkling-Small, from config.json (measured) and from its stated 276B / 12B.
const SMALL = {
  perExpertM: 25.166,
  routedB: 257.698,
  routedActiveB: 6.04,
  alwaysOnB: 5.866,
  solvedPerExpertM: ((276 - 12) * 1000) / (40 * (256 - 6)),
}

const COLS = 32
const ROWS = N / COLS

// A fixed, illustrative pick of 8 lit experts per layer (the real router
// chooses per token); the count of 8 out of 384 is the stated one.
function lit(layer: number) {
  const s = new Set<number>()
  let i = 0
  while (s.size < K) {
    s.add((layer * 53 + i * 97 + 11) % N)
    i++
  }
  return s
}

export function ExpertBudget() {
  const [active, setActive] = useState(17)
  const [moeLayers, setMoeLayers] = useState(46)
  const [layer, setLayer] = useState(0)

  const diff = TOTAL - active
  const routedB = (diff * N) / (N - K)
  const routedActiveB = (diff * K) / (N - K)
  const alwaysOnB = active - routedActiveB
  const perExpertM = (diff * 1000) / (moeLayers * (N - K))
  const on = lit(layer)

  const routedPct = (routedB / TOTAL) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>where 594B parameters sit, solved from the stated counts</span>
        <span className="text-muted-foreground/60">reasoned; Inkling-Small row measured from config</span>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>one MoE layer: 384 experts, 8 fire per token</span>
            <span>layer {layer + 1}</span>
          </div>
          <svg
            viewBox={`0 0 ${COLS * 12} ${ROWS * 12}`}
            className="w-full"
            role="img"
            aria-label="A grid of 384 experts with 8 highlighted, the experts one token uses in one layer"
          >
            {Array.from({ length: N }, (_, i) => {
              const c = i % COLS
              const r = (i - c) / COLS
              const isOn = on.has(i)
              return (
                <rect
                  key={i}
                  x={c * 12 + 1}
                  y={r * 12 + 1}
                  width={10}
                  height={10}
                  rx={2}
                  fill={isOn ? ACTIVE : ROUTED}
                  opacity={isOn ? 1 : 0.22}
                />
              )
            })}
          </svg>
          <label className="mt-2 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span className="w-24 shrink-0">step a layer</span>
            <Range
              min={0}
              max={moeLayers - 1}
              value={Math.min(layer, moeLayers - 1)}
              onChange={(e) => setLayer(Number(e.target.value))}
              accent={ACTIVE}
              aria-label="Layer"
            />
          </label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Which eight light up is illustrative. The router picks them per token; only the count is stated.
          </p>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">all 594B, split</div>
          <div className="flex h-6 w-full overflow-hidden rounded-sm bg-muted/30">
            <div style={{ width: `${routedPct.toFixed(3)}%`, background: ROUTED }} />
            <div style={{ width: `${(100 - routedPct).toFixed(3)}%`, background: ALWAYS }} />
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-1 font-mono text-[11px] sm:grid-cols-3">
            <span>
              <span style={{ color: ROUTED }}>■</span> routed experts {routedB.toFixed(1)}B ({routedPct.toFixed(1)}%)
            </span>
            <span>
              <span style={{ color: ACTIVE }}>■</span> of them per token {routedActiveB.toFixed(2)}B
            </span>
            <span>
              <span style={{ color: ALWAYS }}>■</span> always on {alwaysOnB.toFixed(2)}B
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>
              stated active count, read as {active.toFixed(1)}B (rounding of &ldquo;17B&rdquo;)
            </span>
            <Range
              min={16.5}
              max={17.5}
              step={0.1}
              value={active}
              onChange={(e) => setActive(Number(e.target.value))}
              accent={ALWAYS}
              aria-label="Active parameters in billions"
            />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>MoE layers out of 48: {moeLayers} ({48 - moeLayers} dense)</span>
            <Range
              min={44}
              max={48}
              step={1}
              value={moeLayers}
              onChange={(e) => {
                const v = Number(e.target.value)
                setMoeLayers(v)
                if (layer > v - 1) setLayer(v - 1)
              }}
              accent={ROUTED}
              aria-label="Number of MoE layers"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 pr-2 font-normal">model</th>
                <th className="py-1.5 pr-2 font-normal">experts</th>
                <th className="py-1.5 pr-2 font-normal">params / expert</th>
                <th className="py-1.5 pr-2 font-normal">routed pool</th>
                <th className="py-1.5 font-normal">always on</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-2">Inkling 2 Small (solved)</td>
                <td className="py-1.5 pr-2">384, top-8</td>
                <td className="py-1.5 pr-2">{perExpertM.toFixed(2)}M</td>
                <td className="py-1.5 pr-2">{routedB.toFixed(1)}B</td>
                <td className="py-1.5">{alwaysOnB.toFixed(2)}B</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-2">Inkling-Small (config)</td>
                <td className="py-1.5 pr-2">256+2, top-6</td>
                <td className="py-1.5 pr-2">{SMALL.perExpertM.toFixed(2)}M</td>
                <td className="py-1.5 pr-2">{SMALL.routedB.toFixed(1)}B</td>
                <td className="py-1.5">{SMALL.alwaysOnB.toFixed(2)}B</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-2 text-muted-foreground">Inkling-Small (solved from 276/12)</td>
                <td className="py-1.5 pr-2 text-muted-foreground">same</td>
                <td className="py-1.5 pr-2 text-muted-foreground">{SMALL.solvedPerExpertM.toFixed(2)}M</td>
                <td className="py-1.5 pr-2 text-muted-foreground">–</td>
                <td className="py-1.5 text-muted-foreground">–</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The last row is the check. Run on Inkling-Small&apos;s own rounded figures, the same solve gives 26.40M per
          expert against the 25.17M its config says, about 5% high. Read Inkling 2 Small&apos;s figure with that error
          bar.
        </p>
      </div>
    </figure>
  )
}
