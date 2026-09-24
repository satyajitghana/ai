// The Musou as src/musou/musou.js schedules it at 5702d90: a 200-frame script
// in musou frames (t = 1 on the first step after the press).
//
//   MUSOU = { closeup: 30, pullback: 88, chase: 100, contact: 132, finisher: 176, end: 200 }
//
// While t < contact the Musou re-arms game.freeze every step, so crowd AI and
// hit reactions skip: the world is frozen for 132 frames (2.2 s). Damage ticks:
//   contact blast            t = 132, sector 9.5 m × 210°, 12 dmg
//   shock front              every 2nd frame for 24 frames (t = 134..156), 4 → 15 m, 180°
//   dragon head              every 2nd frame, t = 134..174, while the head is below 4.2 m, 16 dmg
//                            (21 scheduled; the path climbs past 4.2 m between its 0.43 s and
//                            0.67 s keys, so the ticks in that stretch are skipped — hence "≤ 21")
//   Zhao Yun's own sweeps    every 3rd frame, t = 135..174, 3 m, 7 dmg
//   finisher ring wave       t = 176..194 (w = 0..18), radius out to 13 m, 60 dmg
// Camera shots (mu.shot): id 1 until 30, 2 until 100, 3 until 166, 4 to the end.
// The dragon exists from contact until it has dissolved tail-first, at 200.
//
// Server-rendered SVG, zero JS, integer arithmetic only.

const W = 760
const X0 = 104
const X1 = 744
const T = 200
const x = (t: number) => X0 + ((X1 - X0) * t) / T

const FROZEN = "oklch(0.62 0.11 235)"
const LIVE = "oklch(0.72 0.14 75)"
const HIT = "oklch(0.6 0.19 27)"
const DRAGON = "oklch(0.6 0.15 250)"

type Seg = { a: number; b: number; label: string; tone?: string }

const LANES: { name: string; segs: Seg[] }[] = [
  {
    name: "world",
    segs: [
      { a: 0, b: 132, label: "frozen: no AI, no reactions", tone: FROZEN },
      { a: 132, b: 200, label: "live", tone: LIVE },
    ],
  },
  {
    name: "hero clip",
    segs: [
      { a: 0, b: 30, label: "act" },
      { a: 30, b: 88, label: "face (close-up)" },
      { a: 88, b: 100, label: "chg" },
      { a: 100, b: 132, label: "chase run" },
      { a: 132, b: 176, label: "rush" },
      { a: 176, b: 200, label: "slam" },
    ],
  },
  {
    name: "camera shot",
    segs: [
      { a: 0, b: 30, label: "1" },
      { a: 30, b: 100, label: "2 · head and shoulders" },
      { a: 100, b: 166, label: "3 · chase, then flank" },
      { a: 166, b: 200, label: "4 · wide" },
    ],
  },
  {
    name: "無雙 cut-in",
    segs: [{ a: 30, b: 98, label: "DOM overlay" }],
  },
  {
    name: "dragon",
    segs: [{ a: 132, b: 200, label: "166 boxes, one InstancedMesh", tone: DRAGON }],
  },
]

const range = (a: number, b: number, step: number) => {
  const out: number[] = []
  for (let t = a; t <= b; t += step) out.push(t)
  return out
}

const TICKS: { name: string; ts: number[]; dmg: string; upTo?: boolean }[] = [
  { name: "shock front", ts: range(134, 156, 2), dmg: "12 dmg" },
  { name: "dragon head", ts: range(134, 174, 2), dmg: "16 dmg", upTo: true },
  { name: "his sweeps", ts: range(135, 174, 3), dmg: "7 dmg" },
  { name: "ring wave", ts: range(176, 194, 1), dmg: "60 dmg" },
]

export function MusouTimeline() {
  const laneH = 22
  const top = 30
  const tickTop = top + LANES.length * laneH + 14
  const H = tickTop + TICKS.length * 16 + 34

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">src/musou/musou.js · one Musou</span>
        <span className="font-mono text-[10px] text-muted-foreground">200 sim frames = 3.33 s · counted from the source</span>
      </div>
      <div className="overflow-x-auto px-2 py-3 sm:px-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label="Timeline of one Musou over 200 sim frames. The world is frozen from frame 0 to frame 132 while the hero poses, the camera cuts to a close-up and a calligraphy cut-in plays, then he runs. At frame 132, contact: the world unfreezes, the dragon appears and damage starts. A shock front hits every second frame until 156, the dragon's head every second frame until 174, Zhao Yun's own sweeps every third frame until 174. From 176 to 194 the finisher ring wave hits every frame for 60 damage. Control returns at 200."
        >
          {[0, 30, 88, 100, 132, 176, 200].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 26} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={x(t)} y={H - 12} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {t}
              </text>
            </g>
          ))}
          <text x={x(132)} y={16} textAnchor="middle" className="font-mono" style={{ fontSize: 9.5, fill: HIT }}>
            contact
          </text>
          <text x={x(176)} y={16} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
            finisher
          </text>

          {LANES.map((lane, i) => {
            const y = top + i * laneH
            return (
              <g key={lane.name}>
                <text x={6} y={y + 13} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                  {lane.name}
                </text>
                {lane.segs.map((s) => (
                  <g key={`${lane.name}-${s.a}`}>
                    <rect
                      x={x(s.a) + 0.5}
                      y={y + 2}
                      width={x(s.b) - x(s.a) - 1}
                      height={laneH - 5}
                      rx={3}
                      className={s.tone ? undefined : "fill-muted/40"}
                      fill={s.tone}
                      fillOpacity={s.tone ? 0.28 : undefined}
                      stroke={s.tone ?? "var(--border)"}
                    />
                    {x(s.b) - x(s.a) > 26 ? (
                      <text x={x(s.a) + 5} y={y + 14} className="fill-foreground font-mono" style={{ fontSize: 8.5 }}>
                        {s.label}
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            )
          })}

          <line x1={x(132)} x2={x(132)} y1={top - 4} y2={H - 26} stroke={HIT} strokeWidth={1.4} />

          {TICKS.map((row, i) => {
            const y = tickTop + i * 16
            return (
              <g key={row.name}>
                <text x={6} y={y + 9} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                  {row.name} {row.upTo ? "≤" : "×"}{row.ts.length}
                </text>
                <text x={x(row.ts[0]) - 5} y={y + 9} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                  {row.dmg}
                </text>
                {row.ts.map((t) => (
                  <rect key={t} x={x(t) - 0.9} y={y} width={1.8} height={11} fill={HIT} />
                ))}
              </g>
            )
          })}
          <text x={6} y={H - 12} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            musou frames
          </text>
        </svg>
      </div>
      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        Two-thirds of the Musou is theatre with the clock stopped: nothing can be hit before frame 132, and the hero has invulnerability
        frames for the whole script. Every damage tick after contact is sampled where something is drawn — the dragon&apos;s hits are
        taken at the head&apos;s position on the same path the renderer follows, and the ring wave&apos;s radius is the radius the light ring is drawn at.
      </p>
    </figure>
  )
}
