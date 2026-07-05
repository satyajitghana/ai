"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The speed–quality tradeoff, from the paper's Pareto plot (Figure 5), made draggable.
// X = speedup over the native sampler; Y = GenEval score. Two baselines matter: the
// "native-steps" curve (just run the model with fewer steps — quality falls off a cliff)
// and MrFlow's frontier (+1 / +2 / +3 HR refine steps), which stays high much further
// right. The honest caveat baked into the prose: this frontier is the *good* case — the
// same idea pushed harder, or on a less forgiving model, degrades more (e.g. FLUX at the
// aggressive (12,1) config drops ~18% on OneIG). Values read off the paper's Figure 5.

const ACCENT = "oklch(0.58 0.19 25)" // MrFlow (red, matches paper)
const GRAY = "oklch(0.55 0.03 260)" // native-steps baseline
const STAR = "oklch(0.72 0.15 85)" // native (full quality)

type Model = "flux" | "qwen"

// [speedup, GenEval] points, approximate, read from paper Figure 5.
const DATA: Record<Model, {
  name: string
  native: number // native GenEval (speedup 1)
  yMin: number
  yMax: number
  baseline: [number, number][] // native-steps curve
  frontier: { label: string; s: number; q: number }[] // MrFlow +N
}> = {
  flux: {
    name: "FLUX.1-dev",
    native: 0.665,
    yMin: 0.45,
    yMax: 0.7,
    baseline: [[2.4, 0.665], [3.5, 0.64], [4.6, 0.6], [6.2, 0.58], [7.8, 0.54], [9.6, 0.51]],
    frontier: [
      { label: "+3", s: 5.6, q: 0.645 },
      { label: "+2", s: 7.0, q: 0.632 },
      { label: "+1", s: 8.9, q: 0.62 },
    ],
  },
  qwen: {
    name: "Qwen-Image",
    native: 0.875,
    yMin: 0.6,
    yMax: 0.9,
    baseline: [[3.3, 0.875], [4.5, 0.85], [6.0, 0.79], [7.6, 0.76], [8.8, 0.73], [9.8, 0.65]],
    frontier: [
      { label: "+3", s: 6.1, q: 0.87 },
      { label: "+2", s: 7.6, q: 0.862 },
      { label: "+1", s: 9.6, q: 0.855 },
    ],
  },
}

// ── scene geometry ──
const W = 680
const H = 320
const PL = 46
const PR = 96
const PT = 20
const PB = 40
const XMAX = 11 // speedup axis

export function SpeedQuality() {
  const [model, setModel] = useState<Model>("flux")
  const [sel, setSel] = useState(0) // index into frontier (starts at +3)
  const d = DATA[model]
  const cur = d.frontier[sel]

  const x = (s: number) => PL + (s / XMAX) * (W - PL - PR)
  const y = (q: number) => PT + (1 - (q - d.yMin) / (d.yMax - d.yMin)) * (H - PT - PB)

  const yTicks = 4
  const ticks = Array.from({ length: yTicks + 1 }, (_, k) => d.yMin + (k / yTicks) * (d.yMax - d.yMin))

  const line = (pts: [number, number][]) =>
    pts.map((p, k) => `${k === 0 ? "M" : "L"} ${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ")
  const frontierPts: [number, number][] = d.frontier.map((f) => [f.s, f.q])

  // retention vs native, at the selected config
  const retention = (cur.q / d.native) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>speed vs quality · the Pareto frontier</span>
        <span className="text-muted-foreground/60">GenEval · paper Fig. 5</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">MrFlow ({cur.label}) speedup</div>
            <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: ACCENT }}>{cur.s.toFixed(1)}×</div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">GenEval</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{cur.q.toFixed(3)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">of native ({d.native.toFixed(3)})</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: retention >= 97 ? ACCENT : STAR }}>{retention.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`On ${d.name}, MrFlow ${cur.label} reaches ${cur.s.toFixed(1)}× speedup at GenEval ${cur.q.toFixed(3)}, versus the native-steps baseline which falls off far faster.`}>
          {/* y gridlines + labels */}
          {ticks.map((t, k) => (
            <g key={k}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} opacity={k === 0 ? 0.8 : 0.4} strokeDasharray={k === 0 ? undefined : "2 3"} />
              <text x={PL - 8} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={9}>{t.toFixed(2)}</text>
            </g>
          ))}
          {/* x ticks */}
          {[1, 3, 5, 7, 9, 11].map((s) => (
            <text key={s} x={x(s)} y={H - PB + 16} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={9}>{s}×</text>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>speedup over native →</text>

          {/* native (full quality) star at speedup 1 */}
          <g>
            <circle cx={x(1)} cy={y(d.native)} r={4} fill={STAR} />
            <text x={x(1) + 8} y={y(d.native) + 3} className="font-mono" fontSize={9} style={{ fill: STAR }}>native</text>
          </g>

          {/* native-steps baseline */}
          <path d={line(d.baseline)} fill="none" stroke={GRAY} strokeWidth={2} strokeDasharray="4 3" opacity={0.9} />
          <text x={x(d.baseline[d.baseline.length - 1][0])} y={y(d.baseline[d.baseline.length - 1][1]) + 14} textAnchor="end" className="font-mono" fontSize={9} style={{ fill: GRAY }}>fewer native steps</text>

          {/* MrFlow frontier */}
          <path d={line(frontierPts)} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />
          {d.frontier.map((f, k) => (
            <g key={f.label}>
              <circle cx={x(f.s)} cy={y(f.q)} r={k === sel ? 6 : 3.5} fill={ACCENT} stroke="var(--background)" strokeWidth={k === sel ? 2 : 0} />
              <text x={x(f.s)} y={y(f.q) - 10} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={k === sel ? 700 : 400} fill={k === sel ? "var(--foreground)" : "var(--muted-foreground)"}>{f.label}</text>
            </g>
          ))}
          <text x={x(d.frontier[0].s) - 8} y={y(d.frontier[0].q) - 2} textAnchor="end" className="font-mono" fontSize={10} fontWeight={700} style={{ fill: ACCENT }}>MrFlow</text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">model</span>
            {(["flux", "qwen"] as Model[]).map((m) => (
              <button key={m} type="button" onClick={() => { setModel(m); setSel(Math.min(sel, DATA[m].frontier.length - 1)) }} aria-pressed={model === m}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", model === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={model === m ? { background: ACCENT } : undefined}>
                {DATA[m].name}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">refine steps</span>
            {d.frontier.map((f, k) => (
              <button key={f.label} type="button" onClick={() => setSel(k)} aria-pressed={sel === k}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", sel === k ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Just running the model with <span style={{ color: GRAY }}>fewer native steps</span> trades quality away
          fast. MrFlow&apos;s <span style={{ color: ACCENT }}>frontier</span> stays near native quality much further to
          the right — but this is the <span className="text-foreground">good</span> case. Add refine steps (+3) and you
          buy back quality at the cost of speed; push the split harder and degradation climbs. On a less forgiving model
          or an aggressive config (FLUX at (12,1) drops ~18% on OneIG), the &ldquo;within 1%&rdquo; headline no longer
          holds.
        </p>
      </div>
    </figure>
  )
}
