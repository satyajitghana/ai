// Static diagram: what GOFish does for one training view, and which of its terms are stored in the scene and
// which are rebuilt per view and thrown away. Content follows Sections 4.1-4.5 and Appendix A of the paper
// (arXiv 2610.37818) and the config keys in the released repository. No computed numbers.

const STEPS: { title: string; body: string; tag: "scene" | "view" | "both" }[] = [
  { title: "1  calibrated domain", body: "valid pixels = those with a unique ray, up to θ_max where ρ′(θ) stops being positive", tag: "view" },
  { title: "2  complete admission", body: "a Gaussian goes to every tile whose rays can reach it; three tests may reject, only with proof", tag: "view" },
  { title: "3  sort by ray distance", body: "per pixel, near to far along the ray; camera depth goes negative past 90°", tag: "view" },
  { title: "4  composite", body: "α = min(α_max, o·exp(−δ²/2)) with covariance Σ + Q_v and opacity m·o", tag: "both" },
  { title: "5  appearance", body: "PPISP exposure and colour, times W = w(ρ)·exp(−a(u)) for the steep rim falloff", tag: "view" },
  { title: "6  loss, densify", body: "image loss; densification measured in image space through the calibrated Jacobian", tag: "scene" },
]

const W = 520
const BOX_H = 58
const GAP = 14
const X0 = 14
const BW = 372
const TOP = 44

const tagStyle = {
  scene: { label: "stored in the scene", fill: "oklch(0.6 0.15 255)" },
  view: { label: "rebuilt per view", fill: "oklch(0.62 0.16 35)" },
  both: { label: "scene Σ + per-view Q_v", fill: "oklch(0.55 0.1 160)" },
} as const

export function GofishPipeline() {
  const meshY = TOP + STEPS.length * (BOX_H + GAP) + 6
  const H = meshY + 100
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">one training view, and what survives it · from the paper</div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Six steps GOFish runs for each training view: calibrated domain, complete admission, sort by ray distance,
            composite, appearance, and loss with densification. Each step is tagged as stored in the Gaussian scene or
            rebuilt for the view. The mesh is extracted from the stored scene alone.
          </title>
          <text x={X0} y={26} fontSize={12} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
            fisheye image + OPENCV_FISHEYE calibration
          </text>
          {STEPS.map((s, i) => {
            const y = TOP + i * (BOX_H + GAP)
            const tag = tagStyle[s.tag]
            return (
              <g key={s.title}>
                {i > 0 && <line x1={X0 + 20} x2={X0 + 20} y1={y - GAP} y2={y} stroke="currentColor" strokeOpacity={0.4} />}
                <rect x={X0} y={y} width={BW} height={BOX_H} rx={8} fill="currentColor" fillOpacity={0.04} stroke="currentColor" strokeOpacity={0.3} />
                <text x={X0 + 12} y={y + 22} fontSize={14} fontWeight={600} fontFamily="ui-monospace, monospace" fill="currentColor">
                  {s.title}
                </text>
                <foreignObject x={X0 + 12} y={y + 27} width={BW - 24} height={BOX_H - 28}>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.25, opacity: 0.8 }}>{s.body}</p>
                </foreignObject>
                <rect x={X0 + BW + 12} y={y + BOX_H / 2 - 14} width={W - BW - X0 * 2 - 12} height={28} rx={6} fill={tag.fill} fillOpacity={0.14} stroke={tag.fill} strokeOpacity={0.5} />
                <foreignObject x={X0 + BW + 16} y={y + BOX_H / 2 - 12} width={W - BW - X0 * 2 - 20} height={24}>
                  <p style={{ margin: 0, fontSize: 10, lineHeight: 1.15, textAlign: "center" }}>{tag.label}</p>
                </foreignObject>
              </g>
            )
          })}
          <line x1={X0 + 20} x2={X0 + 20} y1={meshY - GAP - 6} y2={meshY} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 3" />
          <rect x={X0} y={meshY} width={W - X0 * 2} height={80} rx={8} fill="oklch(0.6 0.15 255)" fillOpacity={0.1} stroke="oklch(0.6 0.15 255)" strokeOpacity={0.6} />
          <text x={X0 + 12} y={meshY + 24} fontSize={14} fontWeight={600} fontFamily="ui-monospace, monospace" fill="currentColor">
            mesh, from the stored scene only
          </text>
          <foreignObject x={X0 + 12} y={meshY + 30} width={W - X0 * 2 - 24} height={48}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.25, opacity: 0.85 }}>
              O(x) = min over views of the alpha seen from that view, evaluated with stored Σ and o: no Q_v, no m, no W, so
              no view&apos;s blur or lens falloff ends up in the surface
            </p>
          </foreignObject>
        </svg>
      </div>
    </figure>
  )
}
