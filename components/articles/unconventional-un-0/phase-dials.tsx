"use client"

import { useEffect, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"
import { Range } from "@/components/articles/ui/range"

const COLS = 6
const ROWS = 4
const N = COLS * ROWS
const CELL = 96
const RD = 30 // dial radius

const frac = (x: number) => x - Math.floor(x)
// deterministic spreads (no Math.random) → SSR and first client render match
const OMEGA = Array.from({ length: N }, (_, i) => 1.1 + 1.7 * (frac((i + 1) * 0.61803398875) - 0.5))
const INIT = Array.from({ length: N }, (_, i) => 2 * Math.PI * frac((i + 1) * 0.41421356))
// Hue encodes each oscillator's *phase* (a circular quantity → circular hue), so
// the dials share one colormap: as coupling locks the phases together the colors
// converge too — a meaningful encoding, not an arbitrary per-dial rainbow.
const TAU = 2 * Math.PI
const phaseHue = (p: number) => ((((p % TAU) + TAU) % TAU) / TAU) * 360

// round derived coords so the server/client SVG strings are identical
const rnd = (v: number) => Math.round(v * 100) / 100

// Each oscillator drawn as its own dial: a phase hand sweeping a clock face, with
// a short trail. Under mean-field Kuramoto coupling
//   θ̇ᵢ = ωᵢ + K·r·sin(ψ − θᵢ)
// raising K pulls every hand toward the common phase ψ and the order parameter
// r → 1. This is the per-oscillator view of the same physics the colour field
// shows in aggregate. Hand-tuned to read like Un-0's own oscillator animation.
export function PhaseDials() {
  const [k, setK] = useState(0.6)
  const [playing, setPlaying] = useState(true)
  const phases = useRef<number[]>([...INIT])
  const [, force] = useState(0)
  const kRef = useRef(k)
  kRef.current = k

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = 0
    const step = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016
      last = t
      const th = phases.current
      // order parameter (mean field)
      let sx = 0
      let sy = 0
      for (let i = 0; i < N; i++) {
        sx += Math.cos(th[i])
        sy += Math.sin(th[i])
      }
      sx /= N
      sy /= N
      const r = Math.hypot(sx, sy)
      const psi = Math.atan2(sy, sx)
      const K = kRef.current
      const next = new Array(N)
      for (let i = 0; i < N; i++) {
        next[i] = th[i] + dt * (OMEGA[i] + K * r * Math.sin(psi - th[i]))
      }
      phases.current = next
      force((c) => c + 1)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const th = phases.current
  let sx = 0
  let sy = 0
  for (let i = 0; i < N; i++) {
    sx += Math.cos(th[i])
    sy += Math.sin(th[i])
  }
  const r = Math.hypot(sx / N, sy / N)

  const W = COLS * CELL
  const H = ROWS * CELL

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>oscillator phases · θ̇ᵢ = ωᵢ + K·r·sin(ψ − θᵢ)</span>
        <span className="tabular-nums">r = {r.toFixed(2)}</span>
      </div>

      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="A grid of oscillator dials; each hand shows one oscillator's phase, and raising coupling locks them together."
          className="w-full"
        >
          {th.map((p, i) => {
            const col = i % COLS
            const row = Math.floor(i / COLS)
            const cx = col * CELL + CELL / 2
            const cy = row * CELL + CELL / 2
            const tipX = cx + Math.cos(p) * RD
            const tipY = cy + Math.sin(p) * RD
            // trailing arc: a few points behind the hand along the rim
            const trail = Array.from({ length: 6 }, (_, s) => {
              const a = p - (s / 5) * 1.1
              return `${rnd(cx + Math.cos(a) * RD)},${rnd(cy + Math.sin(a) * RD)}`
            }).join(" ")
            const col2 = `oklch(0.7 0.14 ${phaseHue(p).toFixed(0)})`
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={RD} fill="none" stroke="var(--border)" strokeWidth="1" />
                <polyline points={trail} fill="none" stroke={col2} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
                <line x1={cx} y1={cy} x2={rnd(tipX)} y2={rnd(tipY)} stroke={col2} strokeWidth="2" strokeLinecap="round" />
                <circle cx={rnd(tipX)} cy={rnd(tipY)} r="3.5" fill={col2} />
              </g>
            )
          })}
        </svg>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>coupling strength K</span>
              <span className="text-foreground tabular-nums">{k.toFixed(2)}</span>
            </div>
            <Range
              min={0}
              max={4}
              step={0.05}
              value={k}
              onChange={(e) => setK(parseFloat(e.target.value))}
              className="w-full cursor-pointer "
              aria-label="coupling strength" accent="var(--foreground)" />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>each to its own rhythm</span>
              <span>locked in step</span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
              {playing ? "pause" : "play"}
            </button>
            <button
              type="button"
              onClick={() => {
                phases.current = [...INIT]
                force((c) => c + 1)
              }}
              className="cursor-pointer rounded border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              reset phases
            </button>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            At K=0 every dial runs at its own natural frequency ωᵢ and the hands smear
            across all phases (r≈0). Raise K and each hand feels a pull toward the
            population&rsquo;s mean phase proportional to how synchronized it already is —
            a positive feedback that snaps the whole grid into lockstep past a critical
            coupling. Un-0 shapes exactly this settling to encode an image.
          </p>
        </div>
      </div>
    </figure>
  )
}
