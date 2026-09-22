// Why the bundle adjustment is fp64 even though fp32 would be ~2x faster.
//
// The Schur and Jacobian kernels accumulate with floating-point atomics, so no
// two solves agree in their last bits. At fp64 the perturbation is ~1e-16 and
// never crosses a decision threshold — Levenberg-Marquardt's accept/reject, the
// mapper's filters — so the whole pipeline is bit-reproducible. At fp32 it is
// ~1e-7 and crosses them constantly, and a last-bit difference becomes a
// different reconstruction.
//
// The numbers are Spirula Studio's own, from src/sfm/README.md: three identical
// runs of a 379-image capture, scored by AUC@10. Server-rendered, zero JS.

const F64 = "oklch(0.55 0.16 155)"
const F32 = "oklch(0.58 0.19 27)"

const RUNS = [
  { label: "run 1", f64: 96.1, f32: 96.5 },
  { label: "run 2", f64: 96.1, f32: 92.3 },
  { label: "run 3", f64: 96.1, f32: 91.5 },
]

const MEAN64 = 96.1
const MEAN32 = (96.5 + 92.3 + 91.5) / 3 // 93.433…

const W = 700
const H = 248
const LO = 90
const HI = 98
const PLOT_L = 92
const PLOT_R = 560
const UNIT = (PLOT_R - PLOT_L) / (HI - LO)
const x = (v: number) => PLOT_L + (v - LO) * UNIT
const ROW_H = 40
const TOP = 56

export function FpDeterminism() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>bundle adjustment · three identical runs, 379 images</span>
        <span className="text-muted-foreground/60">AUC@10</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Three identical runs of a 379-image capture. In fp64 all three score 96.1 AUC at 10. In fp32 they score 96.5, 92.3 and 91.5 — a spread of five points across runs that differ in nothing but floating-point atomic ordering, and a mean 2.7 points worse."
        >
          {[90, 92, 94, 96, 98].map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={TOP - 14}
                y2={TOP + RUNS.length * ROW_H - 12}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={x(t)}
                y={TOP - 20}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {t}
              </text>
            </g>
          ))}

          {RUNS.map((r, i) => {
            const y = TOP + i * ROW_H
            return (
              <g key={r.label}>
                <text
                  x={16}
                  y={y + 8}
                  className="fill-muted-foreground font-mono"
                  fontSize={9.5}
                >
                  {r.label}
                </text>
                <line
                  x1={x(LO)}
                  x2={x(HI)}
                  y1={y + 4}
                  y2={y + 4}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <circle cx={x(r.f64)} cy={y} r={5} fill={F64} />
                <circle cx={x(r.f32)} cy={y + 10} r={5} fill={F32} />
                <text
                  x={x(r.f64)}
                  y={y - 9}
                  textAnchor="middle"
                  fill={F64}
                  className="font-mono"
                  fontSize={9}
                >
                  {r.f64.toFixed(1)}
                </text>
                <text
                  x={x(r.f32)}
                  y={y + 25}
                  textAnchor="middle"
                  fill={F32}
                  className="font-mono"
                  fontSize={9}
                >
                  {r.f32.toFixed(1)}
                </text>
              </g>
            )
          })}

          <g>
            <circle cx={584} cy={TOP + 2} r={5} fill={F64} />
            <text
              x={596}
              y={TOP + 6}
              fill={F64}
              className="font-mono"
              fontSize={10}
            >
              fp64
            </text>
            <text
              x={596}
              y={TOP + 20}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              mean {MEAN64.toFixed(1)}
            </text>
            <text
              x={596}
              y={TOP + 32}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              spread 0.0
            </text>

            <circle cx={584} cy={TOP + 58} r={5} fill={F32} />
            <text
              x={596}
              y={TOP + 62}
              fill={F32}
              className="font-mono"
              fontSize={10}
            >
              fp32
            </text>
            <text
              x={596}
              y={TOP + 76}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              mean {MEAN32.toFixed(1)}
            </text>
            <text
              x={596}
              y={TOP + 88}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              spread 5.0
            </text>
          </g>

          <line
            x1={16}
            x2={W - 16}
            y1={H - 46}
            y2={H - 46}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />
          <text
            x={16}
            y={H - 33}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            Same capture, same flags, same machine — only the scalar differs.
          </text>
          <text
            x={16}
            y={H - 20}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            fp32 would be worth 25–35% of the mapping stage.
          </text>
          <text
            x={16}
            y={H - 7}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            It is not taken: --ba-real-coarse float exists, and is not the
            default.
          </text>
        </svg>
      </div>
    </figure>
  )
}
