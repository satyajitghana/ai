"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The ZUNA 1.1 core: a transformer encoder–decoder diffusion autoencoder.
// 0.125s EEG segments (32 samples @256Hz) become continuous-valued tokens; the
// encoder compresses them to a latent that conditions every decoder layer via
// adaptive-RMS norm; the decoder is trained with a rectified-flow objective and
// transports a noise sample in a straight line to the clean signal at the target
// coordinate. Drag the pipeline scrubber to run encode → latent → flow-decode;
// pick reconstruct / denoise / upsample to change what the target channel is.
// Waveforms are synthetic and the residual is illustrative, not a measured NMSE.

const ACCENT = "oklch(0.66 0.17 45)"

const W = 620
const H = 340

type Task = "reconstruct" | "denoise" | "upsample"
const TASKS: Record<Task, string> = {
  reconstruct: "missing channel",
  denoise: "noisy channel",
  upsample: "new position",
}

// deterministic pseudo-noise so SSR and client render identically
const hash = (i: number, s: number) => {
  const v = Math.sin(i * 127.1 + s * 8.17) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}
const clean = (u: number) =>
  0.5 * Math.sin(2 * Math.PI * 3 * u + 0.6) +
  0.26 * Math.sin(2 * Math.PI * 7 * u + 1.2) +
  0.12 * Math.sin(2 * Math.PI * 12 * u)

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

// focus-panel geometry
const PX0 = 46
const PX1 = 602
const YB = 234
const AMP = 42
const N = 120

export function DiffusionAutoencoder() {
  const [tau, setTau] = useState(1)
  const [task, setTask] = useState<Task>("reconstruct")

  const seed = task === "reconstruct" ? 3 : task === "denoise" ? 7 : 11
  const p = clamp((tau - 0.45) / 0.55)
  const encActive = tau > 0.04 && tau < 0.44
  const latentLit = tau >= 0.26
  const decActive = tau > 0.45

  const start = (u: number, i: number) =>
    task === "denoise" ? clean(u) + 0.8 * hash(i, seed) : hash(i, seed)
  const recon = (u: number, i: number) => (1 - p) * start(u, i) + p * clean(u)

  const toXY = (i: number, val: number) => {
    const x = PX0 + (i / (N - 1)) * (PX1 - PX0)
    const y = YB - clamp(val, -1.35, 1.35) * AMP
    return [x, y] as const
  }
  const pathOf = (fn: (u: number, i: number) => number) => {
    let d = ""
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      const [x, y] = toXY(i, fn(u, i))
      d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `
    }
    return d
  }

  // illustrative residual: rms(recon − clean) / rms(clean)
  let se = 0, sc = 0
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1)
    const c = clean(u)
    se += (recon(u, i) - c) ** 2
    sc += c * c
  }
  const residual = Math.sqrt(se / sc)

  const stageLabel = tau < 0.24 ? "encode · 0.125s segments → tokens" : tau < 0.45 ? "latent · AdaRMS conditioning" : "rectified-flow decode"

  const arrow = (x1: number, x2: number, y: number) =>
    `M ${x1} ${y} C ${(x1 + x2) / 2} ${y}, ${(x1 + x2) / 2} ${y}, ${x2 - 2} ${y}`

  const miniRows = (bx: number, by: number, w: number, output: boolean) =>
    [0, 1, 2, 3].map((r) => {
      const yy = by + 8 + r * 13
      const target = r === 2
      let d = ""
      for (let k = 0; k <= 16; k++) {
        const xx = bx + 6 + (k / 16) * (w - 12)
        const base = 3.2 * Math.sin(k * 0.7 + r * 1.9)
        let v = base
        if (target && !output) {
          if (task === "denoise") v = base + 3.6 * hash(k + r, seed)
          else v = 0 // missing / new position → flat placeholder
        }
        d += `${k === 0 ? "M" : "L"} ${xx.toFixed(1)} ${(yy - v).toFixed(1)} `
      }
      const isAccent = target && (output || task === "denoise")
      const dashed = target && !output && task !== "denoise"
      return (
        <path key={r} d={d} fill="none" stroke={isAccent ? ACCENT : "var(--muted-foreground)"} strokeWidth={target ? 1.4 : 1} strokeDasharray={dashed ? "2 2" : undefined} opacity={target ? 0.95 : 0.5} />
      )
    })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>diffusion autoencoder · encode → latent → rectified-flow decode</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`EEG segments encoded to a latent, then a rectified-flow decoder reconstructs the ${TASKS[task]}; flow progress ${(p * 100).toFixed(0)} percent.`}>
          <defs>
            <marker id="zd-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="zd-arrow-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="zd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* ---- Band A: pipeline ---- */}
          {/* input stack */}
          <rect x={18} y={40} width={70} height={70} rx={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
          {miniRows(18, 40, 70, false)}
          <text x={53} y={124} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>segments</text>

          {/* input → encoder */}
          <path d={arrow(88, 104, 75)} fill="none" stroke={encActive ? ACCENT : "var(--muted-foreground)"} strokeWidth={1.5} markerEnd={`url(#zd-arrow${encActive ? "" : "-m"})`} opacity={encActive ? 0.9 : 0.4} />

          {/* encoder trapezoid (compresses) */}
          <path d="M 106 46 L 150 62 L 150 96 L 106 112 Z" fill={ACCENT} fillOpacity={encActive ? 0.16 : 0.08} stroke={encActive ? ACCENT : "var(--border)"} strokeWidth={1.5} filter="url(#zd-soft)" />
          <text x={128} y={82} textAnchor="middle" className="fill-foreground font-mono" fontSize={8.5}>enc</text>

          {/* encoder → latent */}
          <path d={arrow(150, 172, 79)} fill="none" stroke={latentLit ? ACCENT : "var(--muted-foreground)"} strokeWidth={1.5} markerEnd={`url(#zd-arrow${latentLit ? "" : "-m"})`} opacity={latentLit ? 0.9 : 0.4} />

          {/* latent */}
          <rect x={174} y={52} width={54} height={54} rx={7} fill="var(--background)" stroke={latentLit ? ACCENT : "var(--border)"} strokeWidth={1.5} filter="url(#zd-soft)" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={201} cy={64 + i * 11} r={3.4} fill={ACCENT} opacity={latentLit ? 0.9 : 0.3} className="transition-opacity duration-300" />
          ))}
          <text x={201} y={44} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>latent</text>
          <text x={201} y={122} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7.5}>AdaRMS →</text>

          {/* latent → decoder */}
          <path d={arrow(228, 250, 79)} fill="none" stroke={decActive ? ACCENT : "var(--muted-foreground)"} strokeWidth={1.5} markerEnd={`url(#zd-arrow${decActive ? "" : "-m"})`} opacity={decActive ? 0.9 : 0.4} />

          {/* decoder trapezoid (expands) */}
          <path d="M 252 62 L 296 46 L 296 112 L 252 96 Z" fill={ACCENT} fillOpacity={decActive ? 0.16 : 0.08} stroke={decActive ? ACCENT : "var(--border)"} strokeWidth={1.5} filter="url(#zd-soft)" />
          <text x={274} y={82} textAnchor="middle" className="fill-foreground font-mono" fontSize={8.5}>dec</text>

          {/* decoder → output */}
          <path d={arrow(296, 318, 79)} fill="none" stroke={decActive ? ACCENT : "var(--muted-foreground)"} strokeWidth={1.5} markerEnd={`url(#zd-arrow${decActive ? "" : "-m"})`} opacity={decActive ? 0.9 : 0.4} />

          {/* output stack */}
          <rect x={320} y={40} width={70} height={70} rx={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
          {miniRows(320, 40, 70, true)}
          <text x={355} y={124} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>reconstruction</text>

          {/* rectified-flow inset */}
          <rect x={406} y={40} width={196} height={70} rx={7} fill="var(--muted)" fillOpacity={0.15} stroke="var(--border)" strokeWidth={1.5} />
          <text x={416} y={57} className="fill-muted-foreground font-mono" fontSize={8}>rectified flow</text>
          <line x1={432} y1={82} x2={576} y2={82} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} />
          <circle cx={432} cy={82} r={4} fill="var(--muted-foreground)" opacity={0.6} />
          <circle cx={576} cy={82} r={4.5} fill={ACCENT} />
          <circle cx={432 + (576 - 432) * p} cy={82} r={4.5} fill={ACCENT} filter="url(#zd-soft)" className="transition-all duration-150" />
          <text x={432} y={101} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7.5}>noise</text>
          <text x={576} y={101} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7.5}>signal</text>

          {/* ---- Band B: target-channel focus ---- */}
          <text x={PX0} y={170} className="fill-muted-foreground font-mono" fontSize={10}>target channel · {TASKS[task]}</text>
          <text x={PX1} y={170} textAnchor="end" className="font-mono" fontSize={10} fill={ACCENT}>flow τ = {tau.toFixed(2)}</text>
          <line x1={PX0} y1={YB} x2={PX1} y2={YB} stroke="var(--border)" strokeWidth={1} opacity={0.6} />
          {/* clean reference */}
          <path d={pathOf((u) => clean(u))} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} strokeDasharray="4 3" opacity={0.45} />
          {/* reconstruction */}
          <path d={pathOf(recon)} fill="none" stroke={ACCENT} strokeWidth={1.8} className="transition-all duration-150" />
          <text x={PX0} y={YB + AMP + 18} className="fill-muted-foreground/70 font-mono" fontSize={8}>— — clean target (reference)</text>
          <text x={PX1} y={YB + AMP + 18} textAnchor="end" className="font-mono" fontSize={8} fill={ACCENT}>reconstruction</text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">task</span>
            {(Object.keys(TASKS) as Task[]).map((k) => (
              <button key={k} type="button" onClick={() => setTask(k)} aria-pressed={task === k}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", task === k ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={task === k ? { background: ACCENT } : undefined}>
                {k}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">jump</span>
            {([["encode", 0.14], ["latent", 0.32], ["decode", 1]] as [string, number][]).map(([lbl, v]) => (
              <button key={lbl} type="button" onClick={() => setTau(v)}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", Math.abs(tau - v) < 0.02 ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>pipeline (drag) · {stageLabel}</span>
            <span className="tabular-nums">residual (illustrative) <span className="text-foreground">{residual.toFixed(2)}</span></span>
          </div>
          <input type="range" min={0} max={100} value={Math.round(tau * 100)} onChange={(e) => setTau(Number(e.target.value) / 100)} className="w-full cursor-pointer accent-[oklch(0.66_0.17_45)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each 0.125-second segment (32 samples at 256 Hz) becomes one continuous-valued token. The encoder compresses the
          clean context into a <span className="text-foreground">latent</span>, which conditions every decoder layer through
          adaptive-RMS norm. The decoder is trained with a <span style={{ color: ACCENT }}>rectified-flow</span> objective:
          it learns a straight-line transport from a noise sample to the true signal at the requested coordinate. Drag τ from
          0 to 1 and the reconstruction (solid) walks off the noise field and onto the clean target (dashed). The same decoder
          fills a <span className="text-foreground">missing</span> channel, cleans a <span className="text-foreground">noisy</span>{" "}
          one, or predicts a position that was never recorded — only the conditioning changes.
        </p>
      </div>
    </figure>
  )
}
