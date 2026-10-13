"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// Every milestone the DiffusionART paper (arXiv:2610.12572) reports with both
// a step count and a GPU-hour count on HunyuanVideo-13B, plus the two ratios
// printed on Figure 1. Sources:
//   VQ 5.5 (TA:VQ:MQ = 7:2:1)  Section 5.2, "Performance."
//   VQ 6, MQ 3 (VQ:MQ = 1:1)    Appendix A.5
//   late-stage mean (1:1)       Figure 1 labels (5.2x, 22.1x, 12.02x, 11.72x)
// Optimizer updates per rollout come from the repo's docs/paper-video.md:
// "ART/Fast/Dance make two disjoint updates per rollout (200 rollouts for
// U400); NFT/ReFL make one (400 rollouts)." Rollouts = steps / updates.
// The GPU-hour counts include evaluation and waiting time (README.review.md
// in the repo; the line was dropped from the public README).

type Method = "DiffusionART" | "DiffusionNFT (EMA)" | "Flow-GRPO-Fast" | "DanceGRPO"

const PER_ROLLOUT: Record<Method, number> = {
  DiffusionART: 2,
  "DiffusionNFT (EMA)": 1,
  "Flow-GRPO-Fast": 2,
  DanceGRPO: 2,
}

const COL: Record<Method, string> = {
  DiffusionART: "oklch(0.62 0.18 15)",
  "DiffusionNFT (EMA)": "oklch(0.55 0.12 290)",
  "Flow-GRPO-Fast": "oklch(0.55 0.11 220)",
  DanceGRPO: "oklch(0.55 0.11 160)",
}

type Row = { m: Method; steps: number; hours: number }
type Milestone = { id: string; label: string; source: string; rows: Row[] }

const MILESTONES: Milestone[] = [
  {
    id: "vq55",
    label: "VQ 5.5 · weights 7:2:1",
    source: "Section 5.2",
    rows: [
      { m: "DiffusionART", steps: 24, hours: 63.4 },
      { m: "DiffusionNFT (EMA)", steps: 273, hours: 1401.4 },
    ],
  },
  {
    id: "vq6",
    label: "VQ 6 · weights 1:1",
    source: "Appendix A.5",
    rows: [
      { m: "DiffusionART", steps: 20, hours: 44.2 },
      { m: "DiffusionNFT (EMA)", steps: 50, hours: 250.2 },
      { m: "Flow-GRPO-Fast", steps: 427, hours: 502.5 },
      { m: "DanceGRPO", steps: 821, hours: 1805.5 },
    ],
  },
  {
    id: "mq3",
    label: "MQ 3 · weights 1:1",
    source: "Appendix A.5",
    rows: [
      { m: "DiffusionART", steps: 19, hours: 42.9 },
      { m: "DiffusionNFT (EMA)", steps: 33, hours: 165.6 },
      { m: "Flow-GRPO-Fast", steps: 117, hours: 149.4 },
    ],
  },
]

const FIG1 = [
  { m: "DiffusionNFT (EMA)" as Method, steps: 5.2, hours: 12.02 },
  { m: "Flow-GRPO-Fast" as Method, steps: 22.1, hours: 11.72 },
]

function Pill({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function StepsVsHours() {
  const [id, setId] = useState<string>("vq6")
  const ms = MILESTONES.find((x) => x.id === id)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          what one &ldquo;training step&rdquo; costs · HunyuanVideo-13B, paper&rsquo;s own counts
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">rollouts = steps ÷ updates per rollout</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MILESTONES.map((x) => (
            <Pill key={x.id} on={id === x.id} onClick={() => setId(x.id)}>
              {x.label}
            </Pill>
          ))}
          <Pill on={id === "fig1"} onClick={() => setId("fig1")}>
            Figure 1 ratios · 1:1
          </Pill>
        </div>

        {ms ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse font-mono text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-normal">method</th>
                  <th className="py-1 pr-2 text-right font-normal">steps</th>
                  <th className="py-1 pr-2 text-right font-normal">GPU-h</th>
                  <th className="py-1 pr-2 text-right font-normal">rollouts</th>
                  <th className="py-1 pr-2 text-right font-normal">GPU-h / step</th>
                  <th className="py-1 text-right font-normal">GPU-h / rollout</th>
                </tr>
              </thead>
              <tbody>
                {ms.rows.map((r) => {
                  const roll = r.steps / PER_ROLLOUT[r.m]
                  return (
                    <tr key={r.m} className="border-t border-border/60">
                      <td className="py-1.5 pr-2" style={{ color: COL[r.m] }}>
                        {r.m}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{r.steps}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{roll % 1 === 0 ? roll : roll.toFixed(1)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{(r.hours / r.steps).toFixed(2)}</td>
                      <td className="py-1.5 text-right tabular-nums">{(r.hours / roll).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-3 space-y-1.5">
              {ms.rows
                .filter((r) => r.m !== "DiffusionART")
                .map((r) => {
                  const art = ms.rows[0]
                  const s = r.steps / art.steps
                  const h = r.hours / art.hours
                  const ro = r.steps / PER_ROLLOUT[r.m] / (art.steps / 2)
                  const max = Math.max(s, h, ro)
                  return (
                    <div key={r.m} className="grid grid-cols-[9.5rem_1fr] items-center gap-2 text-[10px]">
                      <span className="font-mono" style={{ color: COL[r.m] }}>
                        ART vs {r.m.replace(" (EMA)", "")}
                      </span>
                      <div className="space-y-0.5">
                        {[
                          { k: "steps", v: s },
                          { k: "rollouts", v: ro },
                          { k: "GPU-h", v: h },
                        ].map((b) => (
                          <div key={b.k} className="flex items-center gap-2">
                            <span className="w-14 shrink-0 font-mono text-muted-foreground">{b.k}</span>
                            <div className="h-2.5 flex-1 rounded-sm bg-muted/40">
                              <div
                                className="h-2.5 rounded-sm"
                                style={{ width: `${((b.v / max) * 100).toFixed(1)}%`, background: b.k === "GPU-h" ? COL.DiffusionART : COL[r.m], opacity: b.k === "GPU-h" ? 1 : 0.55 }}
                              />
                            </div>
                            <span className="w-12 shrink-0 text-right font-mono tabular-nums">{b.v.toFixed(1)}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">source: paper, {ms.source}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {FIG1.map((r) => {
              const ro = (r.steps * 2) / PER_ROLLOUT[r.m]
              const max = Math.max(r.steps, r.hours, ro)
              return (
                <div key={r.m} className="grid grid-cols-[9.5rem_1fr] items-center gap-2 text-[10px]">
                  <span className="font-mono" style={{ color: COL[r.m] }}>
                    ART vs {r.m.replace(" (EMA)", "")}
                  </span>
                  <div className="space-y-0.5">
                    {[
                      { k: "steps", v: r.steps, d: 1 },
                      { k: "rollouts", v: ro, d: 1 },
                      { k: "GPU-h", v: r.hours, d: 2 },
                    ].map((b) => (
                      <div key={b.k} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 font-mono text-muted-foreground">{b.k}</span>
                        <div className="h-2.5 flex-1 rounded-sm bg-muted/40">
                          <div
                            className="h-2.5 rounded-sm"
                            style={{ width: `${((b.v / max) * 100).toFixed(1)}%`, background: b.k === "GPU-h" ? COL.DiffusionART : COL[r.m], opacity: b.k === "GPU-h" ? 1 : 0.55 }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right font-mono tabular-nums">{b.v.toFixed(b.d)}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              source: paper, Figure 1 labels; the rollout ratio is derived from the step ratio
            </p>
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A &ldquo;step&rdquo; in the paper is one optimizer update, and the methods do not take the same
          number of updates per batch of 256 generated videos. DiffusionART and the GRPO variants take two;
          DiffusionNFT takes one. Read the GPU-hour column per rollout instead of per step and DiffusionART
          and DiffusionNFT cost about the same, near 5 GPU-hours a rollout: against NFT, the whole win is
          needing fewer rollouts. Flow-GRPO-Fast is the opposite case. It trains on two denoising
          positions per video instead of nine, so a rollout costs roughly half as much, and its step-count
          gap overstates the compute gap by nearly 2×.
        </p>
      </div>
    </figure>
  )
}
