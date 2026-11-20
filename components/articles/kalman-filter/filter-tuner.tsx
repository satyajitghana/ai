"use client"

import { useEffect, useMemo, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"
import { Range } from "@/components/articles/ui/range"
import { mcos, mlog10, mpow, msin } from "@/lib/dmath"
import { BAND, Q_TRUE, R_TRUE, RUNS, STEPS, ellipse, makeScene, runFilter } from "./kf2d"

// A 2-D constant-velocity Kalman filter you tune by hand. The truth is drawn
// from the filter's own model (process intensity Q_TRUE, position noise
// R_TRUE), so the filter is only "right" when its assumed q and r match those.
// The plot shows one run: truth, fixes, estimate and 95% covariance ellipses.
// The two strips below average NEES and NIS over 16 runs of the same truth
// with fresh measurement noise, against their chi-square bands.

const C_EST = "oklch(0.62 0.15 205)"
const C_EST_FILL = "oklch(0.62 0.15 205 / 0.10)"
const C_BAND = "oklch(0.72 0.12 150 / 0.18)"
const C_BAD = "oklch(0.63 0.19 30)"

const PRESETS: { label: string; q: number; r: number }[] = [
  { label: "matched", q: 0, r: 0 },
  { label: "Q ÷ 100", q: -2, r: 0 },
  { label: "Q × 100", q: 2, r: 0 },
  { label: "R ÷ 10", q: 0, r: -1 },
  { label: "R × 10", q: 0, r: 1 },
]

const W = 640
const H = 300
const PAD = 14
const SW = 640
const SH = 92

function fmtMul(lg: number) {
  const v = mpow(10, lg)
  if (Math.abs(lg) < 0.05) return "× 1"
  return v >= 1 ? `× ${v < 10 ? v.toFixed(1) : v.toFixed(0)}` : `÷ ${(1 / v) < 10 ? (1 / v).toFixed(1) : (1 / v).toFixed(0)}`
}

export function FilterTuner() {
  const [lq, setLq] = useState(0)
  const [lr, setLr] = useState(0)
  const [t, setT] = useState(STEPS)
  const [playing, setPlaying] = useState(false)

  const scene = useMemo(() => makeScene(), [])
  const q = Q_TRUE * mpow(10, lq)
  const r = R_TRUE * mpow(10, lr)
  const runs = useMemo(() => scene.meas.map((m) => runFilter(m, scene.truth, q, r)), [scene, q, r])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x >= STEPS ? 1 : x + 1)), 70)
    return () => clearInterval(id)
  }, [playing])

  const anees = useMemo(() => Array.from({ length: STEPS }, (_, k) => runs.reduce((a, rr) => a + rr.nees[k], 0) / RUNS), [runs])
  const anis = useMemo(() => Array.from({ length: STEPS }, (_, k) => (k === 0 ? NaN : runs.reduce((a, rr) => a + rr.nis[k], 0) / RUNS)), [runs])

  // statistics over steps 10..end (skip the start-up transient)
  const late = anees.slice(10)
  const meanNees = late.reduce((a, b) => a + b, 0) / late.length
  const inBand = late.filter((v) => v >= BAND[0] && v <= BAND[1]).length / late.length
  const lateNis = anis.slice(10)
  const meanNis = lateNis.reduce((a, b) => a + b, 0) / lateNis.length
  const rmse = Math.sqrt(
    runs.reduce((a, rr) => a + rr.x.reduce((b, x, k) => b + (x[0] - scene.truth[k][0]) ** 2 + (x[1] - scene.truth[k][1]) ** 2, 0), 0) / (RUNS * STEPS),
  )
  const verdict =
    meanNees > BAND[1] ? "overconfident: the errors are bigger than P admits" : meanNees < BAND[0] ? "underconfident: P is bigger than the errors" : "consistent: errors the size P says"

  // world -> svg
  const xs = scene.truth.map((p) => p[0])
  const ys = scene.truth.map((p) => p[1])
  const x0 = Math.min(...xs) - 6
  const x1 = Math.max(...xs) + 6
  const y0 = Math.min(...ys) - 6
  const y1 = Math.max(...ys) + 6
  const s = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (y1 - y0))
  const ox = PAD + ((W - 2 * PAD) - s * (x1 - x0)) / 2
  const oy = PAD + ((H - 2 * PAD) - s * (y1 - y0)) / 2
  const sx = (x: number) => ox + (x - x0) * s
  const sy = (y: number) => H - (oy + (y - y0) * s)

  const run = runs[0]
  const n = Math.max(1, Math.min(t, STEPS))
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")

  const ellPath = (k: number) => {
    const [pxx, pxy, pyy] = run.P[k]
    const e = ellipse(pxx, pxy, pyy)
    const c = run.x[k]
    let d = ""
    for (let i = 0; i <= 36; i++) {
      const th = (i / 36) * 2 * Math.PI
      const u = e.a * mcos(th)
      const v = e.b * msin(th)
      const wx = c[0] + u * mcos(e.ang) - v * msin(e.ang)
      const wy = c[1] + u * msin(e.ang) + v * mcos(e.ang)
      d += `${i ? "L" : "M"}${sx(wx).toFixed(1)},${sy(wy).toFixed(1)}`
    }
    return d + "Z"
  }
  const ellSteps = Array.from({ length: n }, (_, k) => k).filter((k) => k % 6 === 3)

  // log-scale strips, 0.1 .. 100
  const ly = (v: number) => {
    const c = Math.min(Math.max(v, 0.1), 100)
    return SH - 8 - ((mlog10(c) + 1) / 3) * (SH - 16)
  }
  const lx = (k: number) => 34 + (k / (STEPS - 1)) * (SW - 44)
  const strip = (vals: number[], label: string, mean: number) => {
    const pts = vals.slice(0, n).map((v, k) => [k, v] as const).filter(([, v]) => Number.isFinite(v))
    const d = pts.map(([k, v], i) => `${i ? "L" : "M"}${lx(k).toFixed(1)},${ly(v).toFixed(1)}`).join(" ")
    const bad = mean > BAND[1] || mean < BAND[0]
    return (
      <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full" role="img" aria-label={`${label} averaged over ${RUNS} runs against its 95% chi-square band, log scale.`}>
        <rect x={34} y={ly(BAND[1])} width={SW - 44} height={ly(BAND[0]) - ly(BAND[1])} fill={C_BAND} />
        {[0.1, 1, 10, 100].map((v) => (
          <g key={v}>
            <line x1={34} x2={SW - 10} y1={ly(v)} y2={ly(v)} stroke="var(--border)" strokeWidth="0.6" />
            <text x={30} y={ly(v) + 3} textAnchor="end" fontFamily="monospace" fontSize="9" fill="var(--muted-foreground)">{v}</text>
          </g>
        ))}
        <line x1={34} x2={SW - 10} y1={ly(2)} y2={ly(2)} stroke="var(--muted-foreground)" strokeWidth="0.8" strokeDasharray="3 3" />
        <path d={d} fill="none" stroke={bad ? C_BAD : C_EST} strokeWidth="1.6" />
        <text x={40} y={14} fontFamily="monospace" fontSize="10" fill="var(--foreground)">{label}</text>
        <text x={SW - 12} y={14} textAnchor="end" fontFamily="monospace" fontSize="10" fill={bad ? C_BAD : "var(--muted-foreground)"}>
          mean {mean.toFixed(2)} · expected 2 · band {BAND[0].toFixed(2)}–{BAND[1].toFixed(2)}
        </text>
      </svg>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>2-D Kalman filter · tune Q and R · {RUNS} seeded runs</span>
        <button type="button" onClick={() => { if (!playing && t >= STEPS) setT(1); setPlaying((p) => !p) }} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "replay"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const on = Math.abs(p.q - lq) < 0.01 && Math.abs(p.r - lr) < 0.01
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => { setLq(p.q); setLr(p.r) }}
                className={`cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${on ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="One run of a 2-D Kalman filter: a dashed true path, scattered position fixes, the filter's estimate and its 95% covariance ellipses every six steps.">
          <path d={path(scene.truth.slice(0, n))} fill="none" stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" />
          {scene.meas[0].slice(0, n).map((m, i) => (
            <circle key={i} cx={sx(m[0])} cy={sy(m[1])} r="1.8" fill="var(--muted-foreground)" opacity="0.55" />
          ))}
          {ellSteps.map((k) => (
            <path key={k} d={ellPath(k)} fill={C_EST_FILL} stroke={C_EST} strokeWidth="0.8" opacity="0.8" />
          ))}
          <path d={path(run.x.slice(0, n))} fill="none" stroke={C_EST} strokeWidth="2" />
          <path d={ellPath(n - 1)} fill="none" stroke="var(--foreground)" strokeWidth="1.2" />
          <circle cx={sx(scene.truth[n - 1][0])} cy={sy(scene.truth[n - 1][1])} r="3" fill="none" stroke="var(--foreground)" strokeWidth="1.2" />
        </svg>

        <div className="mt-1 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-0 w-4 border-t border-dashed border-muted-foreground" />truth</span>
          <span className="flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" />position fixes (σ = 2)</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: C_EST }} />estimate, 95% ellipses</span>
          <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full border border-foreground" />truth now</span>
        </div>

        <div className="mt-3 space-y-1">
          {strip(anees, "NEES, position (2 dof)", meanNees)}
          {strip(anis, "NIS (2 dof)", meanNis)}
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Slider label="filter's Q vs truth" value={lq} onChange={setLq} fmt={fmtMul} />
          <Slider label="filter's R vs truth" value={lr} onChange={setLr} fmt={fmtMul} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <Stat k="avg NEES" v={meanNees.toFixed(2)} />
          <Stat k="steps in band" v={`${(inBand * 100).toFixed(0)}%`} />
          <Stat k="avg NIS" v={meanNis.toFixed(2)} />
          <Stat k="position RMSE" v={rmse.toFixed(2)} />
        </div>
        <p className="mt-2 font-mono text-[11px]" style={{ color: meanNees > BAND[1] || meanNees < BAND[0] ? C_BAD : "var(--muted-foreground)" }}>
          {verdict}
        </p>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The truth is drawn from the filter&rsquo;s own model, so{" "}
          <span className="text-foreground">matched</span>{" "}is the optimal filter and both strips sit near 2, the
          number of degrees of freedom. Starve it of process noise and it lags every turn while its ellipses stay tight:
          NEES climbs out of the band. Inflate Q a hundredfold and NEES barely moves, because the filter simply follows
          the fixes; NIS is what drops below its band. Watch both.
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <div className="text-muted-foreground">{k}</div>
      <div className="tabular-nums text-foreground">{v}</div>
    </div>
  )
}

function Slider({ label, value, onChange, fmt }: { label: string; value: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{fmt(value)}</span>
      </div>
      <Range min={-2} max={2} step={0.1} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full cursor-pointer" aria-label={label} accent="var(--foreground)" />
    </div>
  )
}
