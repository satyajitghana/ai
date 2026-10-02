"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// RecursiveMAS drawn as a looped Transformer whose LAYERS are whole agents.
// Three heterogeneous agents (Planner, Solver, Critic) form a sequential loop.
// Within an agent the INNER link feeds its last-layer embedding back as the next
// input embedding (latent thoughts, no decoding). Between agents the OUTER link
// transfers latent states across different hidden widths. After the last agent,
// its latents loop back to the first — that is the recursion round r. Only the
// final round decodes to text. Scrub r and flip the channel between latent
// (RecursiveMAS) and text (Recursive-TextMAS) to watch speed and token cost move.
// Every number here is from the paper and is also stated in the prose.

const ACCENT = "oklch(0.60 0.13 250)" // RecursiveMAS indigo
const WARM = "oklch(0.64 0.15 35)" // text-decoding channel (warm)

const W = 820
const H = 360

// agent band geometry
const BW = 150
const BH = 66
const BY = 150
const CX = [170, 410, 650] // agent centres
const bx = (i: number) => CX[i] - BW / 2
const bcy = BY + BH / 2

const AGENTS = [
  { name: "A₁ · Planner", model: "Qwen3-1.7B" },
  { name: "A₂ · Solver", model: "Qwen2.5-Math-1.5B" },
  { name: "A₃ · Critic", model: "Llama3.2-1B" },
]

// per-round, per-channel readouts (all drawn from the paper)
const LATENT: Record<number, { speedup: string; tokens: string; acc: string }> = {
  1: { speedup: "1.2×", tokens: "−34.6%", acc: "+3.4" },
  2: { speedup: "1.9×", tokens: "−65.5%", acc: "+6.0" },
  3: { speedup: "2.4×", tokens: "−75.6%", acc: "+7.2" },
}

export function RecursionStepper() {
  const [r, setR] = useState(3)
  const [latent, setLatent] = useState(true)
  const channel = latent ? ACCENT : WARM
  const stats = latent
    ? LATENT[r]
    : { speedup: "1.0× (base)", tokens: "0% (base)", acc: "±0 (base)" }

  // feedback arc appears once there is more than one round
  const looped = r > 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>multi-agent system as a looped transformer</span>
        <span className="text-muted-foreground/50">{latent ? "latent channel" : "text channel"}</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            `Three agents — Planner, Solver, Critic — chained as the layers of a looped transformer. ` +
            `Each agent refines its own latent thoughts through an inner link, then passes latent states to the ` +
            `next agent through an outer link. After the last agent, its latents loop back to the first for ` +
            `recursion round ${r} of ${r}. ` +
            (latent
              ? `In the latent channel, cross-agent transfer stays in embedding space: ${stats.speedup} end-to-end speedup, ${stats.tokens} tokens, ${stats.acc} accuracy points over the text baseline.`
              : `In the text channel, every hop re-decodes to words and is re-encoded, the baseline cost.`)
          }
        >
          <defs>
            <marker id="rm-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={channel} strokeWidth={1.6} />
            </marker>
            <marker id="rm-arrow-mut" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="rm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* round track */}
          <g>
            <text x={24} y={40} className="fill-muted-foreground font-mono" fontSize={10}>
              recursion rounds
            </text>
            {[1, 2, 3].map((k) => {
              const on = k <= r
              return (
                <g key={k}>
                  <circle
                    cx={150 + (k - 1) * 30}
                    cy={36}
                    r={9}
                    fill={on ? channel : "var(--muted)"}
                    stroke={on ? channel : "var(--border)"}
                    strokeWidth={1.4}
                    className="transition-colors duration-300"
                    opacity={on ? 1 : 0.5}
                  />
                  <text
                    x={150 + (k - 1) * 30}
                    y={40}
                    textAnchor="middle"
                    fontSize={10}
                    className="font-mono"
                    fill={on ? "var(--background)" : "var(--muted-foreground)"}
                  >
                    {k}
                  </text>
                </g>
              )
            })}
            <text x={252} y={40} className="fill-muted-foreground font-mono" fontSize={10}>
              {looped ? "last agent → first agent, refine" : "single pass"}
            </text>
          </g>

          {/* input prompt */}
          <g>
            <rect x={14} y={bcy - 22} width={46} height={44} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.4} filter="url(#rm-soft)" />
            <text x={37} y={bcy - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>Q</text>
            <text x={37} y={bcy + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7}>prompt</text>
          </g>
          <path d={`M 60 ${bcy} L ${bx(0)} ${bcy}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#rm-arrow-mut)" opacity={0.6} />

          {/* agents */}
          {AGENTS.map((a, i) => (
            <g key={a.name}>
              {/* inner-link self loop above the box */}
              <path
                d={`M ${CX[i] - 26} ${BY} C ${CX[i] - 26} ${BY - 34}, ${CX[i] + 26} ${BY - 34}, ${CX[i] + 26} ${BY}`}
                fill="none"
                stroke={channel}
                strokeWidth={1.5}
                markerEnd="url(#rm-arrow)"
                opacity={latent ? 0.9 : 0.3}
                className="transition-opacity duration-300"
              />
              <text x={CX[i]} y={BY - 38} textAnchor="middle" fontSize={8.5} className="font-mono" fill={channel} opacity={latent ? 0.95 : 0.4}>
                inner link
              </text>

              <rect x={bx(i)} y={BY} width={BW} height={BH} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={1.6} filter="url(#rm-soft)" />
              <text x={CX[i]} y={BY + 26} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>{a.name}</text>
              <text x={CX[i]} y={BY + 44} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{a.model}</text>
              <text x={CX[i]} y={BY + 58} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={7.5}>frozen · layer {i + 1}</text>
            </g>
          ))}

          {/* outer links between agents */}
          {[0, 1].map((i) => {
            const x1 = bx(i) + BW
            const x2 = bx(i + 1)
            const midx = (x1 + x2) / 2
            return (
              <g key={i}>
                <path d={`M ${x1} ${bcy} L ${x2} ${bcy}`} fill="none" stroke={channel} strokeWidth={1.8} markerEnd="url(#rm-arrow)" className="transition-colors duration-300" />
                <rect x={midx - 34} y={bcy - 26} width={68} height={16} rx={4} fill="var(--background)" opacity={0.95} />
                <text x={midx} y={bcy - 14} textAnchor="middle" fontSize={8.5} className="font-mono" fill={channel}>
                  outer link
                </text>
                <text x={midx} y={bcy + 20} textAnchor="middle" fontSize={8} className="font-mono fill-muted-foreground">
                  {latent ? "latent state" : "decode→re-encode"}
                </text>
              </g>
            )
          })}

          {/* decode to text, only the final round */}
          <path d={`M ${bx(2) + BW} ${bcy} L ${bx(2) + BW + 44} ${bcy}`} fill="none" stroke={ACCENT} strokeWidth={1.6} markerEnd="url(#rm-arrow)" opacity={0.9} />
          <g>
            <rect x={bx(2) + BW + 44} y={bcy - 22} width={96} height={44} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.4} filter="url(#rm-soft)" />
            <text x={bx(2) + BW + 44 + 48} y={bcy - 3} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>text answer</text>
            <text x={bx(2) + BW + 44 + 48} y={bcy + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7}>final round only</text>
          </g>

          {/* feedback arc: A3 -> A1 (recurrence) */}
          <g opacity={looped ? 1 : 0.14} className="transition-opacity duration-300">
            <path
              d={`M ${CX[2]} ${BY + BH} C ${CX[2]} ${BY + BH + 86}, ${CX[0]} ${BY + BH + 86}, ${CX[0]} ${BY + BH}`}
              fill="none"
              stroke={channel}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              markerEnd="url(#rm-arrow)"
            />
            <text x={(CX[0] + CX[2]) / 2} y={BY + BH + 80} textAnchor="middle" fontSize={9.5} className="font-mono" fill={channel}>
              recurrence · last agent → first agent
            </text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">channel</span>
            {([["latent (RecursiveMAS)", true], ["text (baseline)", false]] as [string, boolean][]).map(([label, v]) => (
              <button
                key={label}
                type="button"
                onClick={() => setLatent(v)}
                aria-pressed={latent === v}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (latent === v ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">round r</span>
            {[1, 2, 3].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setR(k)}
                aria-pressed={r === k}
                className={
                  "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors " +
                  (r === k ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2">
          <Range
            min={1}
            max={3}
            value={r}
            onChange={(e) => setR(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={latent ? ACCENT : WARM}
            aria-label="recursion round"
          />
        </div>

        {/* stat tiles */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { k: "end-to-end speedup", v: stats.speedup },
            { k: "token usage", v: stats.tokens },
            { k: "acc. vs text-MAS (pts)", v: stats.acc },
          ].map((t) => (
            <div key={t.k} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-base font-semibold" style={{ color: latent ? ACCENT : "var(--muted-foreground)" }}>{t.v}</div>
              <div className="mt-0.5 font-mono text-[9px] leading-tight text-muted-foreground">{t.k}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each agent is a <span className="text-foreground">layer</span>{" "}of one looped network. The{" "}
          <span style={{ color: ACCENT }}>inner link</span>{" "}feeds an agent&apos;s last-layer embedding back as its next
          input embedding — latent thoughts, no decoding. The{" "}<span style={{ color: ACCENT }}>outer link</span>{" "}carries
          those latent states to the next agent, across different hidden widths. After the{" "}
          <span className="font-mono">A₃</span>{" "}the latents loop back to{" "}<span className="font-mono">A₁</span>{" "}— one
          recursion round — and only the final round decodes to text. Flip to the{" "}
          <span style={{ color: WARM }}>text channel</span>{" "}and every hop pays to re-decode and re-encode; that is the
          baseline the speedup and token numbers are measured against.
        </p>
      </div>
    </figure>
  )
}
