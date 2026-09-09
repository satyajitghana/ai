"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Where the 4.5x actually comes from.
//
// Ground truth, all read from the released code:
//   - cfm_edit.py CFMEdit.sample(steps=32, cfg_strength=1.0) is the default the
//     paper calls "32 NFE"; infer_cli.py's --nfe defaults to 32, --cfg to 2.0.
//   - CFG at inference (cfg_infer=True in flux2_edit.py) concatenates the
//     conditional and unconditional batches (`x = torch.cat((x_cond, x_uncond),
//     dim=0)`) and runs ONE forward over 2x the batch -- so a CFG step costs
//     ~2x a non-CFG step, not a separate second pass with separate overhead.
//   - README: "AuK-Flash use 4 fixed time steps and set CFG=0."
//   - Paper abstract: "4.5x wall-clock speedup over the full model under
//     matched conditions" -- it does not disclose batch size, hardware, or
//     sequence length for that number.
//
// Naive step-cost ratio: (32 steps x 2 for CFG) / (4 steps x 1, no CFG) = 16x.
// Measured: 4.5x. The paper does not explain the gap. The gap has to be a
// fixed cost that does NOT shrink when you cut steps or drop CFG -- and
// cfm_edit.py shows exactly one candidate: `encode_text()` runs the frozen
// Qwen2.5-Omni-3B thinker ONCE per request, before the odeint loop, and its
// output is reused unchanged across every step via the transformer's
// `cache=True` path. VAE decode is likewise a single fixed pass at the end.
// Neither cost is touched by NFE or CFG.
//
// Solving "what fixed cost, added to both sides, turns a 16x step-cost ratio
// into a measured 4.5x" is one equation in one unknown:
//   (FULL_STEPS*FULL_CFG + F) = 4.5 * (FLASH_STEPS*FLASH_CFG + F)
// This is OUR reconstruction of where the gap goes, not a number the paper
// states -- flagged as such below and in the prose.
const FULL_STEPS = 32
const FULL_CFG_MULT = 2 // batch doubles under CFG
const FLASH_STEPS = 4
const FLASH_CFG_MULT = 1
const MEASURED_SPEEDUP = 4.5

const FULL_UNITS = FULL_STEPS * FULL_CFG_MULT // 64
const FLASH_UNITS = FLASH_STEPS * FLASH_CFG_MULT // 4
// F solved from (FULL_UNITS + F) = MEASURED_SPEEDUP * (FLASH_UNITS + F)
const FIXED_COST = (FULL_UNITS - MEASURED_SPEEDUP * FLASH_UNITS) / (MEASURED_SPEEDUP - 1)
const FULL_TOTAL = FULL_UNITS + FIXED_COST

const DIFF_COLOR = "oklch(0.62 0.15 255)"
const FIXED_COLOR = "oklch(0.55 0.01 255)"

function fmt1(n: number) {
  return n.toFixed(1)
}

export function StepBudget() {
  const [steps, setSteps] = useState(FLASH_STEPS)
  const [cfgOn, setCfgOn] = useState(false)

  const diffUnits = steps * (cfgOn ? FULL_CFG_MULT : FLASH_CFG_MULT)
  const total = diffUnits + FIXED_COST
  const speedup = FULL_TOTAL / total
  const naiveSpeedup = FULL_UNITS / diffUnits

  const W = 560
  const barMax = W - 120
  const scale = (units: number) => (units / FULL_TOTAL) * barMax

  const rows = useMemo(
    () => [
      { label: "AuK (full)", diff: FULL_UNITS, fixed: FIXED_COST, ref: false },
      { label: `steps=${steps}, CFG ${cfgOn ? "on" : "off"}`, diff: diffUnits, fixed: FIXED_COST, ref: true },
    ],
    [steps, cfgOn, diffUnits]
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          cfm_edit.py sample() &middot; README (32 NFE + CFG=2.0 vs Flash&rsquo;s 4 steps, CFG=0)
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">reconstructed, not paper-stated</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} 108`} width={W} height={108} role="img" className="w-full">
          <title>
            {`At ${steps} steps with CFG ${cfgOn ? "on" : "off"}: naive step-cost ratio ${fmt1(naiveSpeedup)}x, but with the fixed text-encoder-plus-VAE-decode cost included, estimated wall-clock speedup ${fmt1(speedup)}x.`}
          </title>
          {rows.map((row, i) => {
            const y = 14 + i * 42
            const diffW = scale(row.diff)
            const fixedW = scale(row.fixed)
            return (
              <g key={row.label}>
                <text x={0} y={y - 4} fontSize={9} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                  {row.label}
                </text>
                <rect x={0} y={y} width={fixedW} height={18} rx={2} fill={FIXED_COLOR} fillOpacity={0.55} />
                <rect x={fixedW} y={y} width={diffW} height={18} rx={2} fill={DIFF_COLOR} fillOpacity={row.ref ? 0.9 : 0.55} />
                <text x={fixedW + diffW + 8} y={y + 13} fontSize={9} fill="currentColor" fontFamily="ui-monospace, monospace">
                  {(row.diff + row.fixed).toFixed(1)} units
                </text>
              </g>
            )
          })}
          <text x={0} y={100} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
            <tspan fill={FIXED_COLOR}>&#9632;</tspan> fixed (text encoder + VAE decode, ~{fmt1(FIXED_COST)} units)
            &nbsp;&nbsp;
            <tspan fill={DIFF_COLOR}>&#9632;</tspan> diffusion steps (scales with NFE &times; CFG)
          </text>
        </svg>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-1 items-center gap-3">
            <span className="w-16 shrink-0 font-mono text-[10.5px] text-muted-foreground">steps={steps}</span>
            <Range
              min={1}
              max={32}
              step={1}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              accent={DIFF_COLOR}
              className="flex-1"
              aria-label="Diffusion sampling steps (NFE)"
            />
          </div>
          <button
            type="button"
            onClick={() => setCfgOn((v) => !v)}
            aria-pressed={cfgOn}
            className="cursor-pointer rounded-full border px-3 py-1 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground data-[on=true]:border-foreground/30 data-[on=true]:bg-muted/50 data-[on=true]:text-foreground"
            data-on={cfgOn}
          >
            CFG {cfgOn ? "on (×2)" : "off"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10.5px]">
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">naive step-cost ratio</div>
            <div className="text-foreground">{fmt1(naiveSpeedup)}&times;</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">with fixed cost included</div>
            <div className="text-foreground">{fmt1(speedup)}&times;</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Set steps to {FLASH_STEPS} and CFG off &mdash; AuK-Flash&rsquo;s actual release config &mdash; and the
          reconstructed speedup lands at {fmt1(speedup)}&times;, matching the paper&rsquo;s stated 4.5&times;. The
          naive ratio for the same setting is {fmt1(naiveSpeedup)}&times;, because dropping CFG halves the cost of
          each step and cutting 32 steps to 4 divides by 8 more. The gap between the two numbers only closes if
          something costs the same no matter how many diffusion steps you take &mdash; and the code shows exactly
          one thing that fits: <code className="font-mono text-xs">encode_text()</code> runs the frozen
          Qwen2.5-Omni-3B thinker once per request, before the sampling loop, and its output is cached across every
          step. Drag steps back toward 32 with CFG still off and both numbers fall toward 1&times; &mdash; there is
          less step-count left to cut &mdash; but the realized speedup stays below the naive one at every setting,
          because the {fmt1(FIXED_COST)}-unit fixed cost never goes away; it&rsquo;s just a shrinking share of a
          shrinking total.
        </p>
      </div>
    </figure>
  )
}
