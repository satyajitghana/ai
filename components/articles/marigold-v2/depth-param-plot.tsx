import { mlog } from "@/lib/dmath"

// Table 4 in the paper ablates three ways to squeeze metric depth into the
// [-1, 1] range the VAE encodes: Uniform (linear depth, Marigold V1's
// choice), Disparity (linear in 1/D), and Log. All three are affine-
// normalized the same way (Eq. 1) — clip to a robust range, rescale to
// [-1, 1] — so the only difference is *which function of D* gets rescaled.
// That function decides where the encoder's finite value resolution gets
// spent. This plot makes that spending visible: same illustrative depth
// range (0.3–20 m) run through all three, normalized identically.
//
// Server-rendered, zero JS. The log curve goes through `mlog` (lib/dmath) —
// its y-coordinate reaches the DOM as an SVG path, so it has to be pinned to
// the same value on the server and in the browser.

const D_MIN = 0.3
const D_MAX = 20
const N = 240

function normalize(values: number[]): number[] {
  const lo = values[0]
  const hi = values[values.length - 1]
  return values.map((v) => 2 * ((v - lo) / (hi - lo) - 0.5))
}

const depths: number[] = []
for (let i = 0; i <= N; i++) depths.push(D_MIN + ((D_MAX - D_MIN) * i) / N)

const uniform = normalize(depths.map((d) => d))
const disparity = normalize(depths.map((d) => 1 / d))
const log = normalize(depths.map((d) => mlog(d)))

const W = 640
const H = 320
const PAD_L = 46
const PAD_B = 30
const PAD_T = 14
const PAD_R = 14
const plotW = W - PAD_L - PAD_R
const plotH = H - PAD_T - PAD_B

const px = (d: number) => PAD_L + ((d - D_MIN) / (D_MAX - D_MIN)) * plotW
const py = (v: number) => PAD_T + (1 - (v + 1) / 2) * plotH

function pathFor(values: number[]): string {
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${px(depths[i]).toFixed(2)},${py(v).toFixed(2)}`)
    .join(" ")
}

const CURVES = [
  { key: "uniform", label: "Uniform (linear depth)", color: "oklch(0.62 0.02 260)", values: uniform },
  { key: "disparity", label: "Disparity (1 / depth)", color: "oklch(0.70 0.16 45)", values: disparity },
  { key: "log", label: "Log depth (the paper's default)", color: "oklch(0.68 0.15 195)", values: log },
] as const

// Depth at which each curve has used up half of its output range (crosses
// the normalized value 0), i.e. where the "near half" of the value budget
// ends. Smaller = more of the [-1, 1] budget burned on close-range depth.
function halfBudgetDepth(values: number[]): number {
  const idx = values.findIndex((v) => v >= 0)
  return depths[Math.max(idx, 0)]
}

export function DepthParamPlot() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          same 0.3–20 m range, three ways to fit it into [-1, 1]
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">Table 4 ablation, illustrated</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[480px] max-w-full">
            <title>
              Normalized encoded value versus metric depth for three parameterizations. Disparity
              spends nearly its whole [-1, 1] range on the closest few meters and goes flat beyond
              that; log depth spends its range proportionally to distance; linear depth spends it
              uniformly regardless of distance.
            </title>

            {/* zero line */}
            <line x1={PAD_L} y1={py(0)} x2={W - PAD_R} y2={py(0)} stroke="var(--border)" strokeDasharray="3 3" />
            {/* axes */}
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--border)" />
            <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--border)" />

            {/* x ticks */}
            {[0.3, 5, 10, 15, 20].map((d) => (
              <g key={d}>
                <line x1={px(d)} y1={H - PAD_B} x2={px(d)} y2={H - PAD_B + 4} stroke="var(--border)" />
                <text x={px(d)} y={H - PAD_B + 16} fontSize={9} textAnchor="middle" fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
                  {d}m
                </text>
              </g>
            ))}
            {/* y ticks */}
            {[-1, 0, 1].map((v) => (
              <text key={v} x={PAD_L - 8} y={py(v) + 3} fontSize={9} textAnchor="end" fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
                {v}
              </text>
            ))}

            {CURVES.map((c) => (
              <path key={c.key} d={pathFor(c.values)} fill="none" stroke={c.color} strokeWidth={2} />
            ))}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
          {CURVES.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.label}
            </span>
          ))}
        </div>

        <div className="mt-2 grid gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-3">
          {CURVES.map((c) => (
            <span key={c.key}>
              {c.label.split(" (")[0]}: half the value range is gone by{" "}
              <span className="text-foreground">{halfBudgetDepth(c.values).toFixed(1)}m</span>
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Disparity (orange) is <code>1/D</code> rescaled to [-1, 1]: it burns most of its output
          range on the first couple of meters, then goes almost flat — depth beyond ~5m gets
          barely any distinct encoder values, which is fine for close-up robotics but wastes the
          VAE&apos;s precision on a KITTI street scene. Uniform (gray) spends the range evenly in
          meters, so a 1cm error at 1m and a 1cm error at 19m cost the loss function the same,
          even though the second one is 19&times; less of a relative error. Log (teal) is the
          compromise the paper picks: because <code>d(log D) = dD / D</code>, an equal slice of
          the value range always corresponds to an equal <em>relative</em> change in depth — which
          is exactly what AbsRel measures. That is the derivation behind Eq. 11 in the paper: an{" "}
          <code>L1</code> loss on log-depth is a first-order approximation of the AbsRel metric
          itself, so training on it and being scored on it point the same way.
        </p>
      </div>
    </figure>
  )
}
