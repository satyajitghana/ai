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

const SEGMENTS = [
  { label: "intent call", secs: 0.7174, tone: "fill-foreground/75" },
  { label: "motor call", secs: 0.6969, tone: "fill-foreground/45" },
  { label: "physics, IK, logging", secs: 0.195, tone: "fill-foreground/20" },
]

const RATES = [
  { label: "recorded run, via OpenRouter", hz: 0.62, kind: "measured" },
  { label: "two calls at 338.6 ms direct", hz: 1.15, kind: "inferred" },
  { label: "one fused call at 338.6 ms", hz: 1.87, kind: "inferred" },
  { label: "real time for this task", hz: 3.13, kind: "target" },
]

export function ControlLoop() {
  const W = 760
  const PAD = 16
  const barW = W - PAD * 2
  const cycle = 1.6093
  const barY = 52
  const barH = 40
  const rateTop = 168
  const rowH = 30
  const H = rateTop + rowH * RATES.length + 30

  let acc = 0
  const segs = SEGMENTS.map((s) => {
    const x = PAD + (acc / cycle) * barW
    acc += s.secs
    return { ...s, x, w: (s.secs / cycle) * barW }
  })
  const simX = PAD + (0.32 / cycle) * barW
  const maxHz = 3.13

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-md border">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="One decision cycle takes 1.61 seconds of wall clock, of which 1.41 seconds is waiting for two sequential Jev calls and 0.20 seconds is physics and inverse kinematics. The cycle buys only 0.32 seconds of simulated time. Below, four control rates: 0.62 hertz recorded, 1.15 and 1.87 hertz inferred from a faster direct API, and 3.13 hertz needed to run in real time."
        >
          <text x={PAD} y={22} className="fill-foreground font-mono text-[12px] font-semibold">
            one decision cycle — 1.609 s of wall clock
          </text>
          <text x={PAD} y={38} className="fill-muted-foreground font-mono text-[11px]">
            mean over the 113 recorded cycles of the seed-0 Jev run
          </text>

          {segs.map((s) => (
            <g key={s.label}>
              <rect x={s.x} y={barY} width={s.w} height={barH} className={s.tone} />
              <text
                x={s.x + s.w / 2}
                y={barY + barH + 15}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {s.secs.toFixed(3)}s
              </text>
            </g>
          ))}
          <rect
            x={PAD}
            y={barY}
            width={barW}
            height={barH}
            className="fill-none stroke-foreground/30"
            strokeWidth={1}
          />

          {segs.map((s) => (
            <text
              key={`l-${s.label}`}
              x={s.x + 6}
              y={barY + 24}
              className="fill-background font-mono text-[10px]"
            >
              {s.w > 110 ? s.label : ""}
            </text>
          ))}

          <line
            x1={simX}
            y1={barY - 10}
            x2={simX}
            y2={barY + barH + 22}
            className="stroke-foreground"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text
            x={simX + 6}
            y={barY + barH + 34}
            className="fill-foreground font-mono text-[10px]"
          >
            0.32 s — the simulated time this cycle buys
          </text>
          <text
            x={PAD}
            y={barY + barH + 34}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            87.9% model wait
          </text>

          <text
            x={PAD}
            y={rateTop - 14}
            className="fill-foreground font-mono text-[12px] font-semibold"
          >
            closed-loop rate
          </text>

          {RATES.map((r, i) => {
            const y = rateTop + i * rowH
            const w = (r.hz / maxHz) * (barW - 250)
            return (
              <g key={r.label}>
                <text
                  x={PAD}
                  y={y + 14}
                  className="fill-muted-foreground font-mono text-[11px]"
                >
                  {r.label}
                </text>
                <rect
                  x={PAD + 240}
                  y={y + 4}
                  width={w}
                  height={14}
                  className={
                    r.kind === "measured"
                      ? "fill-foreground/75"
                      : r.kind === "target"
                        ? "fill-foreground/15 stroke-foreground/50"
                        : "fill-foreground/35"
                  }
                  strokeWidth={r.kind === "target" ? 1 : 0}
                  strokeDasharray={r.kind === "target" ? "3 3" : undefined}
                />
                <text
                  x={PAD + 248 + w}
                  y={y + 15}
                  className="fill-foreground font-mono text-[11px]"
                >
                  {r.hz.toFixed(2)} Hz
                  {r.kind === "inferred" ? " (inferred)" : ""}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="mt-2 font-mono text-xs leading-5 text-muted-foreground">
        Nearly nine tenths of the clock is spent waiting for two sequential model calls,
        and the cycle still buys less simulated time than it consumes real time — the
        arm moves at about a fifth of real speed. Fusing the two calls into one and going
        direct instead of through OpenRouter would close most of that gap, and neither
        change requires a faster model.
      </figcaption>
    </figure>
  )
}
