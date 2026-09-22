// "Critic-free RL on continuous control with only coarse outcome feedback."
//
// True, and this chart is the price. A critic is a learned function that
// estimates the value of an action WITHOUT executing it. Remove it and something
// still has to do that job, and here the something is the simulator: every
// candidate is run, and a hand-written evaluator grades what happened.
//
// So the budget is the mechanism. All figures are Rei Labs' own accounting from
// the Adapt-1 Machina post, 21 September 2026 — the YAM learning-episode table
// and the AIM per-seed learning-budget bars, both of which count PHYSICAL
// executions admitted to learning. Frozen evaluations are counted separately and
// are not in here.
//
// The five stages are a search over sequences, not a gradient method:
//   acquisition  propose, execute, record; revisions edit a recorded parent
//   selection    run candidates on further training layouts, keep what completes
//   deletion     try removing contiguous command spans
//   ordering     try changing when neighbouring coordinate changes occur
//   refinement   the one learned part - bounded offsets from the start observation
//
// Zero JS, exact arithmetic, linear axis.

type Stage = { key: string; label: string; learned: boolean }

const STAGES: Stage[] = [
  { key: "acq", label: "acquisition", learned: false },
  { key: "sel", label: "selection", learned: false },
  { key: "del", label: "deletion / reduction", learned: false },
  { key: "ord", label: "ordering", learned: false },
  { key: "ref", label: "contextual refinement", learned: true },
]

type Run = {
  name: string
  detail: string
  acq: number
  sel: number
  del: number
  ord: number
  ref: number
}

const RUNS: Run[] = [
  { name: "YAM", detail: "MuJoCo pick-and-place · 62 placements", acq: 7680, sel: 4032, del: 2240, ord: 2400, ref: 2048 },
  { name: "AIM seed 0", detail: "sentry turret · 36 refinement updates", acq: 1024, sel: 40, del: 184, ord: 168, ref: 18432 },
  { name: "AIM seed 1", detail: "96 refinement updates", acq: 1024, sel: 80, del: 40, ord: 72, ref: 49152 },
  { name: "AIM seed 2", detail: "96 refinement updates", acq: 1024, sel: 24, del: 40, ord: 72, ref: 49152 },
  { name: "Rail A", detail: "carriage · structural split unpublished", acq: 300, sel: 352, del: 0, ord: 0, ref: 768 },
  { name: "Rail B", detail: "suspended load · structural split unpublished", acq: 500, sel: 352, del: 0, ord: 0, ref: 768 },
]

const X_MAX = 50400

export function WhatReplacesTheCritic() {
  const W = 840
  const L = 168
  const R = 700
  const top = 92
  const rowH = 40
  const H = top + RUNS.length * rowH + 66
  const x = (v: number) => L + (v / X_MAX) * (R - L)

  const ticks = [0, 10000, 20000, 30000, 40000, 50000]

  const shade = (s: Stage, i: number) =>
    s.learned ? "fill-destructive" : i % 2 === 0 ? "fill-foreground/80" : "fill-foreground/45"

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        executed attempts admitted to learning · frozen evaluation counted separately
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Stacked bars of physical executions admitted to learning for six runs. YAM totals 18,400, dominated by 7,680 acquisition attempts and with 2,048 in contextual refinement. AIM seed 0 totals 19,848 and seeds 1 and 2 total 50,368 and 50,312, each with 1,024 acquisition attempts and 18,432 or 49,152 executions in refinement, so refinement is almost the whole budget. Rail A totals 1,420 and Rail B 1,620, both far smaller. Only the refinement segment, marked in a separate colour, corresponds to anything learned; the rest is a search over recorded sequences, executed in the simulator."
      >
        <text x={16} y={24} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          the critic&apos;s job is done by running it
        </text>
        <text x={16} y={38} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          no value network, no baseline, no learned reward model — a search over recorded sequences, each candidate executed and graded
        </text>

        <g className="font-mono" style={{ fontSize: 9 }}>
          {STAGES.map((s, i) => (
            <g key={s.key}>
              <rect x={16 + i * 148} y={56} width={9} height={9} className={shade(s, i)} />
              <text x={30 + i * 148} y={64} className={s.learned ? "fill-foreground" : "fill-muted-foreground"}>
                {s.label}
                {s.learned ? " — learned" : ""}
              </text>
            </g>
          ))}
        </g>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={top - 10} x2={x(t)} y2={top + RUNS.length * rowH - 12} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={x(t)} y={top - 16} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t === 0 ? "0" : `${t / 1000}k`}
            </text>
          </g>
        ))}

        {RUNS.map((r, ri) => {
          const y = top + ri * rowH
          const total = r.acq + r.sel + r.del + r.ord + r.ref
          let cursor = 0
          return (
            <g key={r.name}>
              <text x={L - 12} y={y + 10} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {r.name}
              </text>
              <text x={L - 12} y={y + 21} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                {r.detail}
              </text>
              {STAGES.map((s, si) => {
                const v = r[s.key as keyof Run] as number
                const x0 = x(cursor)
                cursor += v
                const x1 = x(cursor)
                return <rect key={s.key} x={x0} y={y} width={Math.max(0.5, x1 - x0)} height={16} className={shade(s, si)} />
              })}
              <text x={x(total) + 8} y={y + 12.5} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {total.toLocaleString()}
              </text>
            </g>
          )
        })}

        <line x1={16} y1={H - 48} x2={W - 16} y2={H - 48} className="stroke-border" strokeWidth={1} />
        <text x={16} y={H - 32} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          YAM: <tspan className="fill-foreground">7,680 acquisition attempts produced 62 completed placements</tspan>, the first on attempt 1,394 — 0.81% of attempts
        </text>
        <text x={16} y={H - 18} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the full verification record is 19,808 physical episodes and 251,186 executed commands, all in simulation
        </text>
      </svg>
    </figure>
  )
}
