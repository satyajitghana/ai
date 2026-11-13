"use client"

import { useState } from "react"

import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Two kinds of evidence side by side.
//
// Left: the 27 query cards in MultiSet's RobotCar Seasons video, read frame by frame
// from @sawlaninik's post (2120842368404365660). Each card names the condition and
// prints "<cm> · <deg> from the reference pose". Three queries per condition.
//
// Right: rows of the public RobotCar Seasons v2 leaderboard at visuallocalization.net
// (read 2026-11-13), percentage of the hidden test queries within each threshold,
// day and night. Only rows with a name that says what they are; the top row has no
// paper attached.
//
// The readout multiplies p_day^21 x p_night^6: the chance that 27 queries drawn at
// random from the test set (21 day, 6 night, the video's mix) would all land inside
// the chosen threshold, for a system exactly as good as that row. It is arithmetic
// on the board's numbers, not a measurement of MultiSet.

type Q = { n: number; cond: string; cm: number; deg: number }

const QUERIES: Q[] = [
  { n: 1, cond: "Overcast, winter", cm: 5, deg: 0.6 },
  { n: 2, cond: "Overcast, winter", cm: 8, deg: 0.6 },
  { n: 3, cond: "Overcast, winter", cm: 9, deg: 0.6 },
  { n: 4, cond: "Rain", cm: 19, deg: 0.9 },
  { n: 5, cond: "Rain", cm: 10, deg: 0.9 },
  { n: 6, cond: "Rain", cm: 12, deg: 1.1 },
  { n: 7, cond: "Dawn", cm: 19, deg: 0.3 },
  { n: 8, cond: "Dawn", cm: 18, deg: 0.3 },
  { n: 9, cond: "Dawn", cm: 13, deg: 0.3 },
  { n: 10, cond: "Sun", cm: 14, deg: 0.6 },
  { n: 11, cond: "Sun", cm: 8, deg: 0.4 },
  { n: 12, cond: "Sun", cm: 17, deg: 0.6 },
  { n: 13, cond: "Night", cm: 18, deg: 0.8 },
  { n: 14, cond: "Night", cm: 22, deg: 0.9 },
  { n: 15, cond: "Night", cm: 24, deg: 0.6 },
  { n: 16, cond: "Dusk", cm: 20, deg: 0.5 },
  { n: 17, cond: "Dusk", cm: 20, deg: 0.5 },
  { n: 18, cond: "Dusk", cm: 14, deg: 0.5 },
  { n: 19, cond: "Snow", cm: 21, deg: 0.6 },
  { n: 20, cond: "Snow", cm: 13, deg: 0.6 },
  { n: 21, cond: "Snow", cm: 20, deg: 0.6 },
  { n: 22, cond: "Overcast, summer", cm: 14, deg: 0.9 },
  { n: 23, cond: "Overcast, summer", cm: 7, deg: 0.9 },
  { n: 24, cond: "Overcast, summer", cm: 8, deg: 0.9 },
  { n: 25, cond: "Night, rain", cm: 14, deg: 0.1 },
  { n: 26, cond: "Night, rain", cm: 19, deg: 0.1 },
  { n: 27, cond: "Night, rain", cm: 17, deg: 0.2 },
]

const NIGHT = new Set(["Night", "Night, rain"])
const CONDS = Array.from(new Set(QUERIES.map((q) => q.cond)))

// [day, night] per threshold: (0.25 m, 2°), (0.5 m, 5°), (5 m, 10°)
type Row = { name: string; note: string; day: [number, number, number]; night: [number, number, number] }
const ROWS: Row[] = [
  { name: "FUSED_inl_clsgeo_krr_pub", note: "top of the board, Sept 2026, no paper attached", day: [69.2, 95.4, 100], night: [66.2, 95.3, 100] },
  { name: "MegLoc", note: "Oct 2021", day: [66.6, 95.4, 100], night: [51.5, 90.0, 100] },
  { name: "KAPTURE-R2D2-FUSION", note: "Sept 2020", day: [66.0, 95.1, 100], night: [46.2, 76.5, 91.4] },
  { name: "hloc SuperPoint+SuperGlue, multi-camera", note: "Aug 2020, uses the car's three cameras", day: [63.8, 95.0, 100], night: [45.0, 86.2, 94.6] },
  { name: "hloc SuperPoint+SuperGlue, single camera", note: "Nov 2020, one photo per query", day: [64.8, 94.5, 99.9], night: [39.2, 80.0, 92.3] },
]

const BANDS = ["0.25 m, 2°", "0.5 m, 5°", "5 m, 10°"]
const LIM = [
  { cm: 25, deg: 2 },
  { cm: 50, deg: 5 },
]

// Scatter frame: 0..60 cm, 0..6 degrees.
const W = 360
const H = 260
const PAD = 34
const px = (cm: number) => PAD + (cm / 60) * (W - PAD - 8)
const py = (deg: number) => H - PAD - (deg / 6) * (H - PAD - 10)

function pct(p: number) {
  if (p >= 0.01) return `${(p * 100).toFixed(1)}%`
  if (p >= 0.0001) return `${(p * 100).toFixed(3)}%`
  return `${(p * 100).toExponential(1)}%`
}

export function DemoVsBoard() {
  const [band, setBand] = useState(0)
  const [cond, setCond] = useState<string | null>(null)

  const nDay = QUERIES.filter((q) => !NIGHT.has(q.cond)).length
  const nNight = QUERIES.length - nDay

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        27 showcased queries vs the RobotCar Seasons v2 board
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-xs">
        <button
          type="button"
          onClick={() => setCond(null)}
          aria-pressed={cond === null}
          className={cn("rounded border px-2 py-0.5", cond === null ? "bg-foreground text-background" : "bg-background text-muted-foreground")}
        >
          all nine
        </button>
        {CONDS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCond(c === cond ? null : c)}
            aria-pressed={cond === c}
            className={cn("rounded border px-2 py-0.5", cond === c ? "bg-foreground text-background" : "bg-background text-muted-foreground")}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border bg-background" role="img"
            aria-label="Scatter of the 27 showcased queries: position error 5 to 24 centimetres, rotation error 0.1 to 1.1 degrees, all inside the 0.25 metre and 2 degree box.">
            {LIM.map((l, i) => (
              <g key={l.cm}>
                <rect x={px(0)} y={py(l.deg)} width={px(l.cm) - px(0)} height={py(0) - py(l.deg)}
                  fill={i === 0 ? "#2E8B57" : "#E0A030"} fillOpacity={i === band ? 0.12 : 0.04}
                  stroke={i === 0 ? "#2E8B57" : "#E0A030"} strokeOpacity={0.7} strokeDasharray="4 3" />
                <text x={px(l.cm) - 4} y={py(l.deg) - 4} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
                  {BANDS[i]}
                </text>
              </g>
            ))}
            <line x1={px(0)} y1={py(0)} x2={px(60)} y2={py(0)} stroke="currentColor" strokeOpacity={0.4} />
            <line x1={px(0)} y1={py(0)} x2={px(0)} y2={py(6)} stroke="currentColor" strokeOpacity={0.4} />
            {[0, 10, 20, 30, 40, 50, 60].map((c) => (
              <text key={c} x={px(c)} y={H - PAD + 13} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
                {c}
              </text>
            ))}
            {[0, 2, 4, 6].map((d) => (
              <text key={d} x={PAD - 6} y={py(d) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
                {d}°
              </text>
            ))}
            <text x={(px(0) + px(60)) / 2} y={H - 4} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
              position error, cm
            </text>
            {QUERIES.map((q) => {
              const on = cond === null || cond === q.cond
              return (
                <circle key={q.n} cx={px(q.cm)} cy={py(q.deg)} r={on ? 4 : 2.5}
                  fill={NIGHT.has(q.cond) ? "#3B4FB8" : "#D9822B"} fillOpacity={on ? 0.85 : 0.15}
                  stroke="white" strokeWidth={on ? 0.8 : 0}>
                  <title>{`${q.n}/27 ${q.cond}: ${q.cm} cm, ${q.deg}°`}</title>
                </circle>
              )
            })}
          </svg>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            orange: day ({nDay}) · blue: night and night-rain ({nNight}) · the 5 m, 10° box is off the chart
          </div>
          {cond && (
            <div className="mt-2 font-mono text-xs tabular-nums">
              {QUERIES.filter((q) => q.cond === cond).map((q) => (
                <div key={q.n}>
                  {String(q.n).padStart(2, "0")}/27 · {q.cm} cm · {q.deg}°
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-1 font-mono text-xs">
            {BANDS.map((b, i) => (
              <button key={b} type="button" onClick={() => setBand(i)} aria-pressed={band === i}
                className={cn("rounded border px-2 py-0.5", band === i ? "bg-foreground text-background" : "bg-background text-muted-foreground")}>
                {b}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {ROWS.map((r) => {
              const d = r.day[band]
              const nt = r.night[band]
              const all = mpow(d / 100, nDay) * mpow(nt / 100, nNight)
              return (
                <div key={r.name}>
                  <div className="font-mono text-xs text-foreground">{r.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{r.note}</div>
                  {([["day", d, "#D9822B"], ["night", nt, "#3B4FB8"]] as const).map(([lab, v, col]) => (
                    <div key={lab} className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                      <span className="w-9 text-muted-foreground">{lab}</span>
                      <div className="h-2.5 flex-1 rounded bg-muted">
                        <div className="h-2.5 rounded" style={{ width: `${v}%`, background: col }} />
                      </div>
                      <span className="w-10 text-right tabular-nums">{v.toFixed(1)}</span>
                    </div>
                  ))}
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                    odds 27 random queries all pass: {pct(all)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Left: errors printed on the 27 query cards of MultiSet&apos;s video, against reference poses whose own
        alignment has a median RMS error under 10 cm and 0.5°. Right: visuallocalization.net, RobotCar Seasons v2, read
        13 November 2026. The odds assume a random draw from the test set and a system exactly as good as the row;
        the 27 were picked for a video, so they are not that.
      </p>
    </div>
  )
}
