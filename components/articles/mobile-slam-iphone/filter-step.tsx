"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { run, SCENES } from "./filter-core"
import { ellipse, f1, rot, wrap, type V2 } from "./toy-geom"

const W = 448
const H = 328
const ACCENT = "oklch(0.62 0.17 250)"
const BAD = "oklch(0.64 0.2 25)"

export function FilterStep() {
  const [sceneIx, setSceneIx] = useState(0)
  const [tau, setTau] = useState(1.2)
  const [stage, setStage] = useState(0)
  const sc = SCENES[sceneIx]
  const res = useMemo(() => run(sc, tau), [sc, tau])
  const last = res.stages.length - 1
  const k = Math.min(stage, last)
  const st = res.stages[k]
  const final = k === last
  const Pshow = final ? res.Ppost : res.P

  const s = W / sc.view.w
  const X = (x: number) => f1((x - sc.view.x0) * s)
  const Y = (y: number) => f1(H - (y - sc.view.y0) * s)

  const ex = st.p[0] - sc.truth.p[0]
  const ey = st.p[1] - sc.truth.p[1]
  const perr = Math.sqrt(ex * ex + ey * ey)
  const herr = (Math.abs(wrap(st.th - sc.truth.th)) * 180) / Math.PI
  const el = ellipse(Pshow[4], Pshow[5], Pshow[8], 2)
  const sx = Math.sqrt(Pshow[4])
  const sy = Math.sqrt(Pshow[8])

  const pose = (th: number, p: V2, col: string, dash?: boolean) => {
    const tip = rot(th, [0.45, 0])
    const l = rot(th, [-0.25, 0.22])
    const r = rot(th, [-0.25, -0.22])
    const pts = [tip, l, r].map((q) => `${X(p[0] + q[0])},${Y(p[1] + q[1])}`).join(" ")
    return <polygon points={pts} fill={dash ? "none" : col} stroke={col} strokeWidth="1.4" strokeDasharray={dash ? "3 2" : undefined} />
  }

  const label = (i: number) => (i === 0 ? "IMU prior" : `iteration ${i}`)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>one scan through an iterated error-state filter · planar toy</span>
        <span className="tabular-nums">
          {sc.name} · {res.rays} points · {label(k)}
          {final ? (res.degenerate ? " · skipped" : " · done") : ""}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Top view of a ${sc.name}. The filter's estimate is ${(perr * 100).toFixed(0)} centimetres and ${herr.toFixed(1)} degrees from the true pose at ${label(k)}.`}
          className="w-full"
        >
          {sc.walls.map((w, i) => (
            <line key={i} x1={X(w.a[0])} y1={Y(w.a[1])} x2={X(w.b[0])} y2={Y(w.b[1])} stroke="var(--foreground)" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
          ))}
          <ellipse
            cx={X(st.p[0])}
            cy={Y(st.p[1])}
            rx={f1(Math.max(el.rx * s, 0.5))}
            ry={f1(Math.max(el.ry * s, 0.5))}
            transform={`rotate(${f1(-el.ang)} ${X(st.p[0])} ${Y(st.p[1])})`}
            fill={ACCENT}
            fillOpacity="0.12"
            stroke={ACCENT}
            strokeDasharray="4 3"
          />
          {st.pts.map((q, i) => (
            <circle
              key={i}
              cx={X(q.w[0])}
              cy={Y(q.w[1])}
              r={q.s === "used" ? 2.1 : 1.6}
              fill={q.s === "used" ? ACCENT : q.s === "gated" ? BAD : "var(--muted-foreground)"}
              opacity={q.s === "none" ? 0.45 : 0.9}
            />
          ))}
          {pose(sc.truth.th, sc.truth.p, "var(--muted-foreground)", true)}
          {pose(st.th, st.p, ACCENT)}
        </svg>

        <div className="flex flex-col gap-3 font-mono text-xs text-muted-foreground">
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 tabular-nums">
            <dt>position error</dt>
            <dd className="text-right text-foreground">{(perr * 100).toFixed(1)} cm</dd>
            <dt>heading error</dt>
            <dd className="text-right text-foreground">{herr.toFixed(2)}°</dd>
            <dt>effective points</dt>
            <dd className="text-right text-foreground">{st.eff}</dd>
            <dt>residual rms</dt>
            <dd className="text-right text-foreground">{(st.rms * 100).toFixed(1)} cm</dd>
            <dt>σ x / σ y</dt>
            <dd className="text-right text-foreground">
              {(sx * 100).toFixed(1)} / {(sy * 100).toFixed(1)} cm
            </dd>
          </dl>
          <p className="leading-5">
            <span style={{ color: ACCENT }}>●</span> used in the update · <span style={{ color: BAD }}>●</span> rejected by the
            residual gate · <span>●</span> no wall within √5 m. Dashed outline: the true pose. The ellipse is 2σ of position and
            only shrinks once the iterations finish{res.degenerate ? "; this scan had fewer than 20 usable points and was skipped" : ""}.
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>seconds on the IMU alone</span>
            <span className="tabular-nums text-foreground">{tau.toFixed(1)} s</span>
          </div>
          <Range
            min={0.1}
            max={2.5}
            step={0.1}
            value={tau}
            onChange={(e) => {
              setTau(parseFloat(e.target.value))
              setStage(0)
            }}
            className="w-full cursor-pointer"
            aria-label="seconds of IMU-only propagation before this scan"
            accent="var(--foreground)"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 font-mono text-xs">
          {SCENES.map((x, i) => (
            <button
              key={x.name}
              type="button"
              aria-pressed={sceneIx === i}
              onClick={() => {
                setSceneIx(i)
                setStage(0)
              }}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                sceneIx === i ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {x.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStage((v) => (v >= last ? 0 : v + 1))}
            className="cursor-pointer rounded border border-transparent px-2 py-1 text-white"
            style={{ background: ACCENT }}
          >
            {k >= last ? "back to the prior" : `step: ${label(k + 1)}`}
          </button>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        A planar caricature of <code>iekfUpdate()</code>, not the app&apos;s code: three states instead of fifteen, walls instead
        of five-point plane fits. The prior is the true pose pushed off by a 3°/s gyro bias and a 0.3 m/s² accelerometer bias for
        the chosen time. Each step re-associates every point at the current estimate, applies the code&apos;s residual gate and
        takes one information-form Kalman step. In the room the scan pins all three states. In the corridor every wall normal
        points across it, so nothing in the scan says where along the corridor you are: the error and σ along it stay exactly
        where the IMU left them. At 2.5 s the prior is 94 cm and 7.5° out, only 12 points pass the gate, and the code skips the
        update: under 20 usable points it counts the scan as degenerate.
      </figcaption>
    </figure>
  )
}
