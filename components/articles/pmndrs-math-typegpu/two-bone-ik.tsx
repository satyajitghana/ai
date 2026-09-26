"use client"

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"

import { Range } from "@/components/articles/ui/range"
import { macos, matan2 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { fabrikSolve, solveAlloc, solveOut, type Arm, type V2 } from "./ik-solvers"

// A two-bone arm you drag by its hand. The pose is the closed-form solve
// (circle intersection, square roots only); the readout adds the joint angles a
// rig would need (atan2 and acos, through lib/dmath so SSR and the browser
// print the same digits), what FABRIK with math/ik's defaults does with the same
// target, and how many vectors the solve creates in each of two styles.

const W = 640
const H = 420
const S = 88 // pixels per world unit
const BX = 300 // shoulder, in SVG pixels
const BY = 214
const L1 = 1
const ACCENT = "oklch(0.62 0.16 45)"
const GHOST = "oklch(0.6 0.12 250)"

// Scratch owned by the widget, allocated once at module load, reused by every
// solve. This is the caller-owned state math's out-parameter style assumes.
const _scene_elbow: V2 = [0, 0]
const _scene_hand: V2 = [0, 0]
const _scene_fabElbow: V2 = [0, 0]
const _scene_fabHand: V2 = [0, 0]
const _scene_origin: V2 = [0, 0]

type Style = "out" | "alloc"

type Scene = {
  ex: number
  ey: number
  hx: number
  hy: number
  fx: number
  fy: number
  gx: number
  gy: number
  d0: number
  shoulderDeg: number
  bendDeg: number
  lawDeg: number
  allocs: number
  fabIterations: number
  fabResidual: number
  shortfall: number
}

function computeScene(target: V2, arm: Arm, style: Style): Scene {
  let ex: number
  let ey: number
  let hx: number
  let hy: number
  let allocs = 0
  let dClamped: number

  if (style === "out") {
    dClamped = solveOut(_scene_elbow, _scene_hand, target, arm)
    ex = _scene_elbow[0]
    ey = _scene_elbow[1]
    hx = _scene_hand[0]
    hy = _scene_hand[1]
  } else {
    const r = solveAlloc(_scene_origin, target, arm)
    ex = r.elbow[0]
    ey = r.elbow[1]
    hx = r.hand[0]
    hy = r.hand[1]
    allocs = r.allocs
    dClamped = Math.sqrt(hx * hx + hy * hy)
  }

  const d0 = Math.sqrt(target[0] * target[0] + target[1] * target[1])

  // the angle form: shoulder heading from atan2, elbow bend from the two bone
  // directions, and the same bend from the law of cosines as a cross-check
  const shoulder = matan2(ey, ex)
  const lx = hx - ex
  const ly = hy - ey
  const bend = matan2(ex * ly - ey * lx, ex * lx + ey * ly)
  const cosBend = (dClamped * dClamped - arm.l1 * arm.l1 - arm.l2 * arm.l2) / (2 * arm.l1 * arm.l2)
  const law = macos(cosBend < -1 ? -1 : cosBend > 1 ? 1 : cosBend)

  const fab = fabrikSolve(_scene_fabElbow, _scene_fabHand, target, arm)

  return {
    ex,
    ey,
    hx,
    hy,
    fx: _scene_fabElbow[0],
    fy: _scene_fabElbow[1],
    gx: _scene_fabHand[0],
    gy: _scene_fabHand[1],
    d0,
    shoulderDeg: (shoulder * 180) / Math.PI,
    bendDeg: (bend * 180) / Math.PI,
    lawDeg: (law * 180) / Math.PI,
    allocs,
    fabIterations: fab.iterations,
    fabResidual: fab.residual,
    shortfall: Math.max(0, d0 - dClamped),
  }
}

// 216000 -> "216,000", without depending on the runtime's locale data
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const px = (x: number) => Math.round((BX + x * S) * 100) / 100
const py = (y: number) => Math.round((BY - y * S) * 100) / 100

export function TwoBoneIk() {
  const [target, setTarget] = useState<V2>([0.45, 0.15])
  const [l2, setL2] = useState(0.8)
  const [bend, setBend] = useState<1 | -1>(1)
  const [style, setStyle] = useState<Style>("out")
  const [limbs, setLimbs] = useState(400)
  const [ghost, setGhost] = useState(true)
  const dragging = useRef(false)

  const scene = useMemo(() => computeScene(target, { l1: L1, l2, bend }, style), [target, l2, bend, style])

  const toWorld = (ev: PointerEvent<SVGSVGElement>): V2 => {
    const r = ev.currentTarget.getBoundingClientRect()
    const sx = ((ev.clientX - r.left) / r.width) * W
    const sy = ((ev.clientY - r.top) / r.height) * H
    const x = Math.min(W - 8, Math.max(8, sx))
    const y = Math.min(H - 8, Math.max(8, sy))
    return [Math.round(((x - BX) / S) * 1000) / 1000, Math.round(((BY - y) / S) * 1000) / 1000]
  }

  const onKey = (ev: KeyboardEvent<SVGGElement>) => {
    const step = ev.shiftKey ? 0.2 : 0.05
    const move: Record<string, V2> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const m = move[ev.key]
    if (!m) return
    ev.preventDefault()
    setTarget(([x, y]) => [Math.round((x + m[0]) * 1000) / 1000, Math.round((y + m[1]) * 1000) / 1000])
  }

  const reachOuter = L1 + l2
  const reachInner = Math.abs(L1 - l2)
  const perSecond = scene.allocs * limbs * 60

  const btn = (active: boolean) =>
    cn(
      "rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
    )

  const row = (label: string, value: string, note: string) => (
    <div key={label} className="contents">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
      <span className="text-muted-foreground">{note}</span>
    </div>
  )

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      aria-label="A two-bone arm solved in closed form: drag the target, switch between an out-parameter solver and an allocating one, and compare with FABRIK"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair select-none"
        style={{ touchAction: "none" }}
        role="group"
        aria-label={`Arm reaching for (${target[0].toFixed(2)}, ${target[1].toFixed(2)}): shoulder at ${scene.shoulderDeg.toFixed(1)} degrees, elbow bent ${Math.abs(scene.bendDeg).toFixed(1)} degrees`}
        onPointerDown={(ev) => {
          dragging.current = true
          ev.currentTarget.setPointerCapture(ev.pointerId)
          setTarget(toWorld(ev))
        }}
        onPointerMove={(ev) => {
          if (dragging.current) setTarget(toWorld(ev))
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
      >
        {/* reach: the ring the hand can occupy */}
        <circle cx={BX} cy={BY} r={reachOuter * S} fill="none" stroke="var(--border)" strokeWidth={1.5} strokeDasharray="5 5" />
        {reachInner > 0.001 ? (
          <circle cx={BX} cy={BY} r={reachInner * S} fill="var(--muted)" fillOpacity={0.35} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="5 5" />
        ) : null}
        <text x={BX + reachOuter * S * 0.72 + 6} y={BY + reachOuter * S * 0.72 + 4} fontSize={11} fill="var(--muted-foreground)" className="font-mono">
          reach {reachOuter.toFixed(2)}
        </text>

        {/* FABRIK's pose for the same target, from a cold start */}
        {ghost ? (
          <g opacity={0.8}>
            <polyline
              points={`${px(0)},${py(0)} ${px(scene.fx)},${py(scene.fy)} ${px(scene.gx)},${py(scene.gy)}`}
              fill="none"
              stroke={GHOST}
              strokeWidth={4}
              strokeDasharray="7 5"
              strokeLinecap="round"
            />
            <circle cx={px(scene.fx)} cy={py(scene.fy)} r={4} fill={GHOST} />
          </g>
        ) : null}

        {/* the closed-form arm */}
        <polyline
          points={`${px(0)},${py(0)} ${px(scene.ex)},${py(scene.ey)} ${px(scene.hx)},${py(scene.hy)}`}
          fill="none"
          stroke={ACCENT}
          strokeWidth={9}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={px(0)} cy={py(0)} r={9} fill="var(--foreground)" />
        <circle cx={px(scene.ex)} cy={py(scene.ey)} r={7} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2} />
        <circle cx={px(scene.hx)} cy={py(scene.hy)} r={5} fill="var(--foreground)" />
        <text x={px(0) - 14} y={py(0) + 26} fontSize={11} fill="var(--muted-foreground)" className="font-mono">
          shoulder
        </text>
        <text x={px(scene.ex) + 10} y={py(scene.ey) - 10} fontSize={11} fill="var(--muted-foreground)" className="font-mono">
          elbow
        </text>

        {/* the target, draggable and keyboard-movable */}
        <g
          tabIndex={0}
          role="button"
          aria-roledescription="draggable target"
          aria-label={`IK target at x ${target[0].toFixed(2)}, y ${target[1].toFixed(2)}; arrow keys move it, shift for bigger steps`}
          onKeyDown={onKey}
          className="cursor-grab"
        >
          <circle cx={px(target[0])} cy={py(target[1])} r={13} fill="none" stroke={ACCENT} strokeWidth={2} />
          <line x1={px(target[0]) - 18} x2={px(target[0]) + 18} y1={py(target[1])} y2={py(target[1])} stroke={ACCENT} strokeWidth={1.5} />
          <line x1={px(target[0])} x2={px(target[0])} y1={py(target[1]) - 18} y2={py(target[1]) + 18} stroke={ACCENT} strokeWidth={1.5} />
        </g>

        <text x={12} y={22} fontSize={12} fill="var(--muted-foreground)" className="font-mono">
          drag anywhere: the crosshair is the target
        </text>
        {ghost ? (
          <text x={12} y={40} fontSize={12} fill={GHOST} className="font-mono">
            dashed: FABRIK, cold start, math/ik defaults
          </text>
        ) : null}
      </svg>

      <div className="space-y-3 border-y px-4 py-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="solver style">
          <button type="button" aria-pressed={style === "out"} onClick={() => setStyle("out")} className={btn(style === "out")}>
            out-parameters
          </button>
          <button type="button" aria-pressed={style === "alloc"} onClick={() => setStyle("alloc")} className={btn(style === "alloc")}>
            allocating
          </button>
          <span className="mx-1 text-muted-foreground">·</span>
          <button type="button" aria-pressed={bend === 1} onClick={() => setBend(1)} className={btn(bend === 1)}>
            elbow ccw
          </button>
          <button type="button" aria-pressed={bend === -1} onClick={() => setBend(-1)} className={btn(bend === -1)}>
            elbow cw
          </button>
          <span className="mx-1 text-muted-foreground">·</span>
          <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.currentTarget.checked)} />
            <span className={ghost ? "text-foreground" : undefined}>FABRIK ghost</span>
          </label>
        </div>
        <div className="grid gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground sm:grid-cols-2">
          <label className="flex items-center gap-3">
            <span className="w-32 shrink-0">lower bone {l2.toFixed(2)}</span>
            <Range min={0.4} max={1.2} step={0.05} value={l2} onChange={(e) => setL2(Number(e.currentTarget.value))} accent={ACCENT} aria-label="lower bone length" className="w-full" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-32 shrink-0">limbs / frame {limbs}</span>
            <Range min={1} max={1000} step={1} value={limbs} onChange={(e) => setLimbs(Number(e.currentTarget.value))} accent={ACCENT} aria-label="limbs solved per frame" className="w-full" />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <div className="grid min-w-[36rem] grid-cols-[10rem_7rem_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px] leading-4 tabular-nums">
          {row(
            "target distance",
            scene.d0.toFixed(3),
            scene.shortfall > 0.0005
              ? `outside the ring [${reachInner.toFixed(2)}, ${reachOuter.toFixed(2)}]: clamped, hand falls ${scene.shortfall.toFixed(3)} short`
              : `inside the ring [${reachInner.toFixed(2)}, ${reachOuter.toFixed(2)}]: placed exactly`
          )}
          {row("shoulder angle", `${scene.shoulderDeg.toFixed(1)}°`, "atan2(elbow.y, elbow.x)")}
          {row("elbow bend", `${Math.abs(scene.bendDeg).toFixed(1)}°`, `law of cosines gives ${scene.lawDeg.toFixed(1)}°`)}
          {row("closed form", "1 step", "sqrt only: a = (l1² − l2² + d²) / 2d, h = √(l1² − a²)")}
          {row(
            "FABRIK",
            `${scene.fabIterations} ${scene.fabIterations === 1 ? "pass" : "passes"}`,
            scene.fabResidual <= 0.01
              ? `within 0.01 of the target (${scene.fabResidual.toFixed(4)})`
              : `stopped ${scene.fabResidual.toFixed(3)} from the target`
          )}
          {row(
            "vectors created",
            String(scene.allocs),
            style === "out" ? "the solve writes into arrays the caller already owns" : "each op returns a fresh [x, y]"
          )}
          {row(
            "per second",
            grouped(perSecond),
            scene.allocs === 0
              ? `${limbs} limbs × 60 frames, and nothing for the garbage collector`
              : `${scene.allocs} × ${limbs} limbs × 60 frames: short-lived garbage for the young generation`
          )}
        </div>
      </div>
    </figure>
  )
}
