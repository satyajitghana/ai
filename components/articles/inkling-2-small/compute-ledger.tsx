"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Training compute for Inkling 2 Small from the post's own token counts.
// Pre-training phases use 6 * N_active * D (forward + backward on every token).
// The RL run's tokens are both sampled (forward, 2ND) and trained on (6ND), so
// 8ND is the like-for-like estimate for the post's "learner + sampler FLOPs".
// Attention FLOPs and the 292M vision encoder are left out, which is why these
// are floors, not totals.
//
// Stated inputs (thinkingmachines.ai/news/inkling-2-small, Nov 5 2026):
//   H1 8.4T tokens, 68 hours on GB300 NVL72 · H2 3.8T at 512K context
//   H3 ~320B at 1M context · H4 ~34B · RL 3T+ tokens, 2,048 GPUs, 9 days,
//   "Over 4 x 10^23 FLOPs".
// Assumed (not stated): a dense NVFP4 peak per GPU, adjustable below.

const PHASES = [
  { id: "H1", tokensT: 8.4, color: "oklch(0.70 0.10 250)" },
  { id: "H2", tokensT: 3.8, color: "oklch(0.62 0.13 250)" },
  { id: "H3", tokensT: 0.32, color: "oklch(0.54 0.15 255)" },
  { id: "H4", tokensT: 0.034, color: "oklch(0.47 0.16 260)" },
] as const

const RL_TOKENS_T = 3
const RL_STATED = 4e23
const H1_HOURS = 68
const RL_GPUS = 2048
const RL_SECONDS = 9 * 86400

const RL_COLOR = "oklch(0.70 0.15 55)"

function sci(x: number) {
  if (x === 0) return "0"
  const s = x.toExponential(2)
  const [m, e] = s.split("e")
  return `${m} × 10^${Number(e)}`
}

export function ComputeLedger() {
  const [activeB, setActiveB] = useState(17)
  const [rlMode, setRlMode] = useState<"8" | "6">("8")
  const [peakPf, setPeakPf] = useState(15)
  const [mfu, setMfu] = useState(30)

  const n = activeB * 1e9
  const rows = PHASES.map((p) => ({ ...p, flops: 6 * n * p.tokensT * 1e12 }))
  const pre = rows.reduce((a, r) => a + r.flops, 0)
  const rl = Number(rlMode) * n * RL_TOKENS_T * 1e12
  const total = pre + rl
  const max = total

  const h1Rate = rows[0].flops / (H1_HOURS * 3600)
  const h1Gpus = h1Rate / (peakPf * 1e15 * (mfu / 100))
  const h2Hours = (H1_HOURS * 3.8) / 8.4
  const rlPerGpu = RL_STATED / (RL_GPUS * RL_SECONDS)
  const rlUtil = (rlPerGpu / (peakPf * 1e15)) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>compute ledger: 6ND per phase, from the post&apos;s token counts</span>
        <span className="text-muted-foreground/60">reasoned from reported inputs</span>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="flex h-8 w-full overflow-hidden rounded-sm bg-muted/30">
            {rows.map((r) => (
              <div
                key={r.id}
                title={`${r.id}: ${sci(r.flops)} FLOPs`}
                style={{ width: `${((r.flops / max) * 100).toFixed(3)}%`, background: r.color }}
              />
            ))}
            <div
              title={`RL: ${sci(rl)} FLOPs`}
              style={{ width: `${((rl / max) * 100).toFixed(3)}%`, background: RL_COLOR }}
            />
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse font-mono text-[11px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-normal">phase</th>
                  <th className="py-1 pr-2 font-normal">tokens</th>
                  <th className="py-1 pr-2 font-normal">FLOPs</th>
                  <th className="py-1 font-normal">share</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1 pr-2">
                      <span style={{ color: r.color }}>■</span> {r.id}
                    </td>
                    <td className="py-1 pr-2">{r.tokensT >= 1 ? `${r.tokensT}T` : `${Math.round(r.tokensT * 1000)}B`}</td>
                    <td className="py-1 pr-2">{sci(r.flops)}</td>
                    <td className="py-1">{((r.flops / total) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
                <tr className="border-b border-border/40">
                  <td className="py-1 pr-2">
                    <span style={{ color: RL_COLOR }}>■</span> RL ({rlMode}ND)
                  </td>
                  <td className="py-1 pr-2">3T+</td>
                  <td className="py-1 pr-2">{sci(rl)}</td>
                  <td className="py-1">{((rl / total) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 font-semibold">total</td>
                  <td className="py-1 pr-2">15.55T</td>
                  <td className="py-1 pr-2 font-semibold">{sci(total)}</td>
                  <td className="py-1">pre-train {sci(pre)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            The post states the RL run as &ldquo;Over 4 × 10²³ FLOPs&rdquo; of learner plus sampler compute. The {rlMode}ND
            estimate is {sci(rl)}, {rl >= RL_STATED ? "at or above" : "below"} it
            {rlMode === "6" ? "; counting only the backward-and-forward pass leaves out every sampled token's forward pass." : "."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>active parameters: {activeB.toFixed(1)}B</span>
            <Range
              min={16.5}
              max={17.5}
              step={0.1}
              value={activeB}
              onChange={(e) => setActiveB(Number(e.target.value))}
              aria-label="Active parameters in billions"
            />
          </label>
          <div className="font-mono text-[11px] text-muted-foreground">
            <span>count RL tokens as</span>
            <div className="mt-1 inline-flex rounded-lg border p-0.5">
              {(["8", "6"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRlMode(m)}
                  aria-pressed={rlMode === m}
                  className={
                    "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                    (rlMode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {m === "8" ? "8ND sampled + trained" : "6ND trained only"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">what the wall clock implies</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-mono text-[11px] text-muted-foreground">
              <span>assumed dense NVFP4 peak per GPU: {peakPf} PFLOP/s</span>
              <Range
                min={10}
                max={20}
                step={1}
                value={peakPf}
                onChange={(e) => setPeakPf(Number(e.target.value))}
                accent={RL_COLOR}
                aria-label="Assumed peak PFLOP/s per GPU"
              />
            </label>
            <label className="block font-mono text-[11px] text-muted-foreground">
              <span>assumed H1 utilisation (MFU): {mfu}%</span>
              <Range
                min={15}
                max={50}
                step={1}
                value={mfu}
                onChange={(e) => setMfu(Number(e.target.value))}
                accent={RL_COLOR}
                aria-label="Assumed model FLOP utilisation"
              />
            </label>
          </div>
          <ul className="mt-3 space-y-1 font-mono text-[11px] tabular-nums">
            <li>
              H1: {sci(rows[0].flops)} in 68 h is {sci(h1Rate)} FLOP/s sustained, or about{" "}
              <span className="font-semibold">{Math.round(h1Gpus).toLocaleString("en-US")} GPUs</span> (
              {(h1Gpus / 72).toFixed(1)} NVL72 racks) at these assumptions. The post does not give the count.
            </li>
            <li>
              H2 at H1&apos;s token rate would take {h2Hours.toFixed(1)} h. The post gives no duration for it.
            </li>
            <li>
              RL: 4 × 10²³ over 2,048 GPUs and 9 days is {sci(rlPerGpu)} FLOP/s per GPU, about{" "}
              <span className="font-semibold">{rlUtil.toFixed(1)}%</span> of the assumed peak.
            </li>
          </ul>
        </div>
      </div>
    </figure>
  )
}
