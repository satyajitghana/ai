"use client"

// The thesis in one chart: "scaling the horizon, not the parameters." Each model is
// placed by total parameters (log x) and a representative agentic score (y = average of
// five headline benchmarks: BrowseComp, Seal-0, GAIA, IFBench, FrontierScience-Olympiad).
// Agents-A1 and its own base (Qwen3.5-35B-A3B) sit at the SAME 35B size — the whole
// vertical gap between them is the horizon-scaling training, and it lifts the 35B model
// into the band occupied by the ~1T-parameter frontier. Static SVG: renders fully without
// JS. Numbers are real (InternScience tech report, arXiv 2606.30616).

type M = { name: string; params: number; plabel: string; score: number; kind: "base" | "a1" | "frontier" }

// score = mean(BrowseComp, Seal-0, GAIA, IFBench, FrontierScience-Olympiad)
const MODELS: M[] = [
  { name: "Qwen3.5-35B-A3B (base)", params: 35, plabel: "35B", score: 59.4, kind: "base" },
  { name: "Kimi-K2.6", params: 1000, plabel: "~1T", score: 71.8, kind: "frontier" },
  { name: "GPT-5.5", params: 1500, plabel: "frontier", score: 73.6, kind: "frontier" },
  { name: "DeepSeek-V4-pro", params: 1000, plabel: "~1T", score: 77.2, kind: "frontier" },
  { name: "Agents-A1", params: 35, plabel: "35B", score: 77.5, kind: "a1" },
]

const A1 = "oklch(0.72 0.15 195)"
const FRONTIER = "oklch(0.65 0.02 260)"
const BASE = "oklch(0.7 0.14 50)"

export function HorizonScaling() {
  const W = 640
  const H = 380
  const padL = 52
  const padR = 24
  const padT = 28
  const padB = 52
  const x0 = Math.log10(20)
  const x1 = Math.log10(2500)
  const sx = (p: number) => padL + ((Math.log10(p) - x0) / (x1 - x0)) * (W - padL - padR)
  const y0 = 50
  const y1 = 85
  const sy = (v: number) => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB)

  const ticks = [
    { p: 35, label: "35B" },
    { p: 100, label: "100B" },
    { p: 300, label: "300B" },
    { p: 1000, label: "1T" },
  ]
  const yticks = [55, 65, 75, 85]

  const base = MODELS.find((m) => m.kind === "base")!
  const a1 = MODELS.find((m) => m.kind === "a1")!

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        scaling the horizon, not the parameters · params vs representative agentic score
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Scatter of model size versus a representative agentic benchmark score. Agents-A1 and its base Qwen3.5-35B-A3B both sit at 35B parameters, but Agents-A1 scores ~18 points higher, reaching the band occupied by trillion-parameter models DeepSeek-V4-pro, GPT-5.5, and Kimi-K2.6.">
          {/* grid + axes */}
          {yticks.map((v) => (
            <g key={v}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="currentColor" strokeOpacity="0.08" />
              <text x={padL - 8} y={sy(v) + 3} textAnchor="end" className="font-mono" fontSize="9" fill="currentColor" fillOpacity="0.5">{v}</text>
            </g>
          ))}
          {ticks.map((t) => (
            <text key={t.p} x={sx(t.p)} y={H - padB + 16} textAnchor="middle" className="font-mono" fontSize="9" fill="currentColor" fillOpacity="0.5">{t.label}</text>
          ))}
          <text x={(W) / 2} y={H - 6} textAnchor="middle" className="font-mono" fontSize="9" fill="currentColor" fillOpacity="0.45">total parameters (log)</text>
          <text x={14} y={H / 2} textAnchor="middle" className="font-mono" fontSize="9" fill="currentColor" fillOpacity="0.45" transform={`rotate(-90 14 ${H / 2})`}>agentic score (5-bench avg)</text>

          {/* the lift arrow: base -> A1 at the same x */}
          <line x1={sx(base.params)} y1={sy(base.score) - 6} x2={sx(a1.params)} y2={sy(a1.score) + 10} stroke={A1} strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow)" />
          <defs>
            <marker id="arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" refX="7" refY="0" orient="auto">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={A1} strokeWidth={1.5} />
            </marker>
          </defs>
          <text x={sx(base.params) + 8} y={(sy(base.score) + sy(a1.score)) / 2} className="font-mono" fontSize="9" fill={A1}>+18 from training</text>

          {/* frontier band */}
          <line x1={padL} y1={sy(77.5)} x2={W - padR} y2={sy(77.5)} stroke={FRONTIER} strokeOpacity="0.25" strokeDasharray="2 4" />

          {/* points */}
          {MODELS.map((m) => {
            const c = m.kind === "a1" ? A1 : m.kind === "base" ? BASE : FRONTIER
            const r = m.kind === "a1" ? 8 : 6
            const labelLeft = m.name === "DeepSeek-V4-pro" || m.name === "GPT-5.5"
            return (
              <g key={m.name}>
                <circle cx={sx(m.params)} cy={sy(m.score)} r={r} fill={c} fillOpacity={m.kind === "frontier" ? 0.55 : 0.9} stroke="var(--background)" strokeWidth="1.5" />
                <text
                  x={labelLeft ? sx(m.params) - 11 : sx(m.params) + 11}
                  y={sy(m.score) + 3}
                  textAnchor={labelLeft ? "end" : "start"}
                  className="font-mono"
                  fontSize={m.kind === "a1" ? "10.5" : "9.5"}
                  fontWeight={m.kind === "a1" ? 700 : 400}
                  fill="currentColor"
                  fillOpacity={m.kind === "frontier" ? 0.7 : 0.95}
                >
                  {m.name}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Agents-A1 and <span className="text-foreground">Qwen3.5-35B-A3B</span> are the{" "}
          <span className="text-foreground">same 35B model</span> (~3B active). The ~18-point vertical
          jump is entirely the three-stage horizon-scaling training — and it lands the 35B student in
          the band held by the <span className="text-foreground">~1T-parameter</span> frontier models.
          Score = mean of BrowseComp, Seal-0, GAIA, IFBench, and FrontierScience-Olympiad.
        </p>
      </div>
    </figure>
  )
}
