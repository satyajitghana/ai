// What sampling costs the native geometry.
//
// The same codec, the same frozen DA3 head, the same metrics — twice. Once on
// latents encoded from real frames (paper Table 4), once on latents the flow
// model produced from noise and a camera path (Table 7). The gap between the
// hollow dot and the filled one is everything the generator gives up, isolated
// from the codec, because the codec is identical on both ends.
//
// δ₁ is plotted as 1 − δ₁ so every row reads the same direction: lower is
// better. The dashed tick on the two camera rows is Pi3 run on the *real*
// target frames — the reference the paper itself scores against, and the only
// honest answer to "is 0.010 good?".
//
// RealEstate10K, GAE-64. Server-rendered, zero JS.

type Row = {
  label: string
  unit?: string
  recon: number
  gen: number
  max: number
  ref?: number
  fmt: (v: number) => string
}

const f3 = (v: number) => v.toFixed(3)
const f2 = (v: number) => v.toFixed(2)

const ROWS: Row[] = [
  { label: "AbsRel", recon: 0.09, gen: 0.134, max: 0.2, fmt: f3 },
  { label: "1 − δ₁", recon: 0.095, gen: 0.143, max: 0.2, fmt: f3 },
  { label: "Chamfer", recon: 0.386, gen: 0.501, max: 0.6, fmt: f3 },
  { label: "point map", recon: 0.691, gen: 0.924, max: 1.1, fmt: f3 },
  { label: "camera ATE", recon: 0.007, gen: 0.01, max: 0.016, ref: 0.009, fmt: f3 },
  { label: "camera RPEr", unit: "°", recon: 0.2, gen: 0.33, max: 0.42, ref: 0.17, fmt: f2 },
]

const RECON = "oklch(0.55 0.15 250)"
const GEN = "oklch(0.58 0.17 30)"

const W = 700
const ROW_H = 42
const TOP = 26
const PLOT_L = 126
const PLOT_R = 500

export function GeometryGap() {
  const H = TOP + ROWS.length * ROW_H + 34

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>geometry decoded from the latent · RealEstate10K, GAE-64</span>
        <span className="text-muted-foreground/60">each row on its own scale</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Six geometry metrics for GAE-64 on RealEstate10K, comparing latents encoded from real frames with latents sampled by the flow model. AbsRel goes from 0.090 to 0.134, one minus delta-1 from 0.095 to 0.143, Chamfer from 0.386 to 0.501, point-map error from 0.691 to 0.924, camera trajectory error from 0.007 to 0.010 against a Pi3-on-real reference of 0.009, and relative rotation error from 0.20 to 0.33 degrees against a reference of 0.17 degrees."
        >
          {ROWS.map((r, i) => {
            const y = TOP + i * ROW_H
            const cy = y + 14
            const unit = (PLOT_R - PLOT_L) / r.max
            const xr = PLOT_L + r.recon * unit
            const xg = PLOT_L + r.gen * unit
            const pct = Math.round(((r.gen - r.recon) / r.recon) * 100)
            return (
              <g key={r.label}>
                <text
                  x={PLOT_L - 12}
                  y={cy + 4}
                  textAnchor="end"
                  className="fill-foreground font-mono"
                  fontSize={11}
                >
                  {r.label}
                </text>

                <line
                  x1={PLOT_L}
                  x2={PLOT_R}
                  y1={cy}
                  y2={cy}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth={1}
                />

                {r.ref !== undefined ? (
                  <g>
                    <line
                      x1={PLOT_L + r.ref * unit}
                      x2={PLOT_L + r.ref * unit}
                      y1={cy - 11}
                      y2={cy + 11}
                      stroke="currentColor"
                      className="text-foreground/45"
                      strokeWidth={1.4}
                      strokeDasharray="3 2"
                    />
                    <text
                      x={PLOT_L + r.ref * unit}
                      y={cy + 24}
                      textAnchor="middle"
                      className="fill-muted-foreground font-mono"
                      fontSize={8}
                    >
                      Pi3 on real
                    </text>
                  </g>
                ) : null}

                <line x1={xr} x2={xg} y1={cy} y2={cy} stroke={GEN} strokeWidth={2.5} opacity={0.45} />
                <circle cx={xr} cy={cy} r={5} fill="var(--background)" stroke={RECON} strokeWidth={2} />
                <circle cx={xg} cy={cy} r={5} fill={GEN} />

                <text
                  x={W - 8}
                  y={cy + 4}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  fontSize={10}
                >
                  {r.fmt(r.recon)}
                  {r.unit ?? ""} → {r.fmt(r.gen)}
                  {r.unit ?? ""}
                </text>
                <text
                  x={W - 8}
                  y={cy + 17}
                  textAnchor="end"
                  className="font-mono"
                  fill={GEN}
                  fontSize={9}
                >
                  +{pct}%
                </text>
              </g>
            )
          })}

          <g>
            <circle cx={PLOT_L + 6} cy={H - 16} r={5} fill="var(--background)" stroke={RECON} strokeWidth={2} />
            <text x={PLOT_L + 18} y={H - 12} className="fill-muted-foreground font-mono" fontSize={9}>
              encoded from real frames
            </text>
            <circle cx={PLOT_L + 190} cy={H - 16} r={5} fill={GEN} />
            <text x={PLOT_L + 202} y={H - 12} className="fill-muted-foreground font-mono" fontSize={9}>
              sampled from noise + a camera path
            </text>
          </g>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        DL3DV is worse across the board: AbsRel +63%, Chamfer +81%, ATE +75%.
        The camera track is the one that survives — sampled geometry recovers the
        trajectory to within 0.001 of Pi3 reading the real frames.
      </figcaption>
    </figure>
  )
}
