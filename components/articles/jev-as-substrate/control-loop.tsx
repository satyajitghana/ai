// What one decision cycle of the xArm7 pick-and-place actually costs, from the
// recorded run in openroboto-ai/jev-robot-control (seed 0, Jev 1.13, 113 cycles).
//
// Measured, straight out of the run's own JSON:
//   wall_seconds        181.847  -> 1.6093 s per cycle
//   model_wait_seconds  159.810  -> 87.9% of the wall clock
//   intent call         0.7174 s mean latency over 113 calls
//   motor call          0.6969 s mean latency over 113 calls
//   everything else     0.1950 s  (MuJoCo step, IK, contact checks, logging)
//   physics increment   0.32 s of simulated time bought per cycle
//
// So the loop closes at 113 / 181.847 = 0.62 Hz while the simulated robot lives at
// 1 / 0.32 = 3.125 Hz. The two dashed rates are inferences, not measurements: they
// substitute the 338.6 ms median direct-to-TypeSafe latency an independent benchmark
// reported, which was measured on much smaller payloads than a 2,636-token motor
// request, and they assume the non-model 0.195 s is unchanged.
//
// Server-rendered SVG, zero JS, +-*/ only.

const CYCLE = 1.6093

const SEGMENTS = [
  { label: "intent call", secs: 0.7174, tone: "fill-foreground/70" },
  { label: "motor call", secs: 0.6969, tone: "fill-foreground/40" },
  { label: "physics, IK", secs: 0.195, tone: "fill-foreground/15" },
]

const RATES = [
  { label: "recorded run, via OpenRouter", hz: 0.62, kind: "measured" },
  { label: "two calls at 338.6 ms direct", hz: 1.15, kind: "inferred" },
  { label: "one fused call at 338.6 ms", hz: 1.87, kind: "inferred" },
  { label: "real time for this task", hz: 3.13, kind: "target" },
]

const W = 760
const PAD = 16
const BAR_W = W - PAD * 2
const BAR_Y = 56
const BAR_H = 40
const NOTE_Y = 142
const RATE_TOP = 192
const ROW_H = 30
const LABEL_W = 236
const RATE_MAX_W = 380
const H = RATE_TOP + ROW_H * RATES.length + 16

export function ControlLoop() {
  let acc = 0
  const segs = SEGMENTS.map((s) => {
    const x = PAD + (acc / CYCLE) * BAR_W
    acc += s.secs
    return { ...s, x, w: (s.secs / CYCLE) * BAR_W }
  })
  const simX = PAD + (0.32 / CYCLE) * BAR_W

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-md border">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="One decision cycle takes 1.61 seconds of wall clock, of which 1.41 seconds is waiting for two sequential Jev calls and 0.20 seconds is physics and inverse kinematics. The cycle buys only 0.32 seconds of simulated time. Below, four control rates: 0.62 hertz recorded, 1.15 and 1.87 hertz inferred from a faster direct API, and 3.13 hertz needed to run in real time."
        >
          <text
            x={PAD}
            y={24}
            className="fill-foreground font-mono text-[13px] font-semibold"
          >
            one decision cycle — 1.609 s of wall clock
          </text>
          <text x={PAD} y={42} className="fill-muted-foreground font-mono text-[11px]">
            mean over the 113 recorded cycles of the seed-0 Jev run
          </text>

          {segs.map((s) => (
            <g key={s.label}>
              <rect x={s.x} y={BAR_Y} width={s.w} height={BAR_H} className={s.tone} />
              <text
                x={s.x + s.w / 2}
                y={BAR_Y + BAR_H + 17}
                textAnchor="middle"
                className="fill-foreground font-mono text-[11px]"
              >
                {s.secs.toFixed(3)}s
              </text>
              <text
                x={s.x + s.w / 2}
                y={BAR_Y + BAR_H + 31}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {s.label}
              </text>
            </g>
          ))}
          <rect
            x={PAD}
            y={BAR_Y}
            width={BAR_W}
            height={BAR_H}
            className="fill-none stroke-foreground/30"
            strokeWidth={1}
          />

          <line
            x1={simX}
            y1={BAR_Y - 8}
            x2={simX}
            y2={BAR_Y + BAR_H + 36}
            className="stroke-foreground"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text
            x={simX + 7}
            y={NOTE_Y}
            className="fill-foreground font-mono text-[10px]"
          >
            0.32 s — the simulated time this cycle buys
          </text>
          <text x={PAD} y={NOTE_Y} className="fill-muted-foreground font-mono text-[10px]">
            87.9% model wait
          </text>

          <text
            x={PAD}
            y={RATE_TOP - 14}
            className="fill-foreground font-mono text-[13px] font-semibold"
          >
            closed-loop rate
          </text>

          {RATES.map((r, i) => {
            const y = RATE_TOP + i * ROW_H
            const w = (r.hz / 3.13) * RATE_MAX_W
            return (
              <g key={r.label}>
                <text
                  x={PAD}
                  y={y + 15}
                  className="fill-muted-foreground font-mono text-[11px]"
                >
                  {r.label}
                </text>
                <rect
                  x={PAD + LABEL_W}
                  y={y + 4}
                  width={w}
                  height={15}
                  className={
                    r.kind === "measured"
                      ? "fill-foreground/75"
                      : r.kind === "target"
                        ? "fill-foreground/10 stroke-foreground/50"
                        : "fill-foreground/35"
                  }
                  strokeWidth={r.kind === "target" ? 1 : 0}
                  strokeDasharray={r.kind === "target" ? "3 3" : undefined}
                />
                <text
                  x={PAD + LABEL_W + 8 + w}
                  y={y + 16}
                  className="fill-foreground font-mono text-[11px]"
                >
                  {r.hz.toFixed(2)} Hz{r.kind === "inferred" ? " (inferred)" : ""}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="mt-2 font-mono text-xs leading-5 text-muted-foreground">
        Nearly nine tenths of the clock is spent waiting for two sequential model calls,
        and the cycle still buys less simulated time than it consumes real time — the arm
        moves at about a fifth of real speed. Fusing the two calls into one and going
        direct instead of through OpenRouter would close most of that gap, and neither
        change requires a faster model.
      </figcaption>
    </figure>
  )
}
