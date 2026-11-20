"use client"

// How one photo becomes Gaussians, in a side view of one column of pixels. A camera looks at a
// low wall in front of a back wall, over a floor. Step by step: the pixels, a depth for each, the
// rays that carry each pixel out to its depth, a Gaussian per pixel sized by depth over focal
// length, SHARP's second layer behind the pillar's edge, and a camera that moves. The new view on
// the right is rendered from the Gaussians alone, so whatever no Gaussian covers comes out as a
// hole. Geometry only (a toy scene in metres, not a model's output).

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

type Hit = { z: number; y: number; kind: "pillar" | "floor" | "wall" }

// the scene, in metres: camera at z = 0, 1.5 m above the floor; y grows downward like an image
const CAM_H = 1.5
const PILLAR = { z0: 4.5, z1: 5, top: -0.25 }
const WALL_Z = 8
const N = 28
const T0 = -0.42
const T1 = 0.42
const FOCAL = 1 / ((T1 - T0) / N) // pixels per unit tangent: one pixel per row

const COLORS = { pillar: "#cdb98f", floor: "#b08a5a", wall: "#6f8fa8" } as const

const cast = (oz: number, oy: number, t: number, skipPillar = false): Hit => {
  // pillar front face, then floor, then back wall
  if (!skipPillar && oz < PILLAR.z0) {
    const y = oy + t * (PILLAR.z0 - oz)
    if (y >= PILLAR.top && y <= CAM_H) return { z: PILLAR.z0, y, kind: "pillar" }
  }
  if (t > 1e-6) {
    const z = oz + (CAM_H - oy) / t
    if (z < WALL_Z) return { z, y: CAM_H, kind: "floor" }
  }
  return { z: WALL_Z, y: oy + t * (WALL_Z - oz), kind: "wall" }
}

type Splat = { z: number; y: number; r: number; kind: Hit["kind"]; layer: 0 | 1 }

const STEPS = [
  { t: "Pixels", d: "One column of the photo: 28 pixels, each a colour and nothing else. The camera sits 1.5 m above the floor, looking at a low wall in front of the back wall." },
  { t: "A depth for each", d: "The depth network gives every pixel a distance along the view. Near pixels on the floor, then the low wall, then the back wall above it." },
  { t: "Back-project", d: "Each pixel travels out along its own ray to its depth. With the depth and the focal length, a pixel at row v lands at y = (v - cy) Z / f." },
  { t: "A Gaussian per pixel", d: "Put a Gaussian on each point, about one pixel wide where it sits: radius proportional to Z / f, so far ones are bigger. This alone is a 2.5D relief of the photo." },
  { t: "A second layer", d: "SHARP predicts a second depth per pixel and a second Gaussian there, for what lies behind an edge. Behind the low wall it places floor the camera never saw, in colours it invents." },
  { t: "Move the camera", d: "Step up 0.6 m and render from the Gaussians alone. Without the second layer the floor behind the low wall is a hole; with it, the hole fills. Move further and it opens again." },
] as const

export function LiftSteps() {
  const [step, setStep] = useState(0)
  const [layer2, setLayer2] = useState(true)
  const [lift, setLift] = useState(0.6)

  const rows = useMemo(() => Array.from({ length: N }, (_, i) => T0 + ((i + 0.5) * (T1 - T0)) / N), [])
  const first = useMemo(() => rows.map((t) => cast(0, 0, t)), [rows])
  const splats = useMemo(() => {
    const out: Splat[] = []
    rows.forEach((t, i) => {
      const h = first[i]
      out.push({ z: h.z, y: h.y, r: (0.5 * h.z) / FOCAL, kind: h.kind, layer: 0 })
      // second layer: only where the first one stops on the low wall's face
      if (h.kind === "pillar") {
        const b = cast(0, 0, t, true)
        out.push({ z: b.z, y: b.y, r: (0.5 * b.z) / FOCAL, kind: b.kind, layer: 1 })
      }
    })
    return out
  }, [rows, first])

  // the new view: from a camera lifted by `lift` metres, the nearest Gaussian each ray passes
  // within its radius of; nothing within reach is a hole
  const render = (useLayer2: boolean) =>
    rows.map((t) => {
      const oy = -lift
      let best: Splat | null = null
      let bz = Infinity
      for (const s of splats) {
        if (s.layer === 1 && !useLayer2) continue
        const dz = s.z
        const dy = s.y - oy
        // distance from the point to the ray (0,oy) + k (1, t)
        const k = (dz + dy * t) / (1 + t * t)
        if (k <= 0) continue
        const ex = dz - k
        const ey = dy - k * t
        const d = Math.sqrt(ex * ex + ey * ey)
        if (d <= s.r * 1.6 && k < bz) {
          bz = k
          best = s
        }
      }
      return best
    })

  const W = 560
  const H = 300
  const sx = (z: number) => 30 + z * 52
  const sy = (y: number) => 190 + y * 52
  const show = (n: number) => step >= n
  const view = render(layer2)
  const viewNo2 = render(false)

  return (
    <figure data-lift-steps="" className="not-prose my-8 rounded-xl border p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s.t}
            type="button"
            aria-pressed={i === step}
            onClick={() => setStep(i)}
            className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${i === step ? "" : "hover:bg-muted"} ${i === step ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
          >
            {`${i + 1}. ${s.t}`}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Side view, step ${step + 1}: ${STEPS[step].t}`}>
        <rect x={0} y={0} width={W} height={H} className="fill-muted/30" />
        {/* the true scene, faint */}
        <line x1={sx(0)} y1={sy(CAM_H)} x2={sx(WALL_Z)} y2={sy(CAM_H)} stroke={COLORS.floor} strokeOpacity={0.35} strokeWidth={2} />
        <line x1={sx(WALL_Z)} y1={sy(-2)} x2={sx(WALL_Z)} y2={sy(CAM_H)} stroke={COLORS.wall} strokeOpacity={0.35} strokeWidth={2} />
        <rect x={sx(PILLAR.z0)} y={sy(PILLAR.top)} width={sx(PILLAR.z1) - sx(PILLAR.z0)} height={sy(CAM_H) - sy(PILLAR.top)} fill={COLORS.pillar} fillOpacity={0.35} stroke="currentColor" strokeOpacity={0.2} />
        {/* camera and its image plane */}
        <circle cx={sx(0)} cy={sy(0)} r={5} className="fill-foreground" />
        <text x={sx(0) - 14} y={sy(0) + 18} className="fill-muted-foreground font-mono" fontSize={10}>
          camera
        </text>
        {rows.map((t, i) => (
          <rect key={`px${i}`} x={sx(0.35) - 3} y={sy(0.35 * t) - 1.5} width={6} height={3.2} fill={COLORS[first[i].kind]} />
        ))}
        {show(1) &&
          rows.map((t, i) => (
            <text key={`d${i}`} x={sx(0.35) + 6} y={sy(0.35 * t) + 2} fontSize={5.5} className="fill-muted-foreground font-mono">
              {first[i].z.toFixed(1)}
            </text>
          ))}
        {show(2) && rows.map((t, i) => <line key={`r${i}`} x1={sx(0)} y1={sy(0)} x2={sx(first[i].z)} y2={sy(first[i].y)} stroke={COLORS[first[i].kind]} strokeOpacity={step === 2 ? 0.55 : 0.18} strokeWidth={0.8} />)}
        {show(2) && step < 3 && first.map((h, i) => <circle key={`p${i}`} cx={sx(h.z)} cy={sy(h.y)} r={2} fill={COLORS[h.kind]} />)}
        {show(3) &&
          splats
            .filter((s) => s.layer === 0 || (show(4) && layer2))
            .map((s, i) => (
              <circle
                key={`s${i}`}
                cx={sx(s.z)}
                cy={sy(s.y)}
                r={Math.max(1.5, s.r * 52)}
                fill={COLORS[s.kind]}
                fillOpacity={s.layer ? 0.45 : 0.75}
                stroke={s.layer ? "#7c3aed" : "none"}
                strokeWidth={s.layer ? 0.8 : 0}
                strokeDasharray={s.layer ? "2 1.5" : undefined}
              />
            ))}
        {show(5) && (
          <>
            <circle cx={sx(0)} cy={sy(-lift)} r={5} fill="#7c3aed" />
            {rows.map((t, i) => {
              const s = view[i]
              const end = s ? { z: s.z, y: s.y } : { z: WALL_Z, y: -lift + t * WALL_Z }
              return <line key={`n${i}`} x1={sx(0)} y1={sy(-lift)} x2={sx(end.z)} y2={sy(end.y)} stroke="#7c3aed" strokeOpacity={0.16} strokeWidth={0.8} />
            })}
          </>
        )}
        {/* the strips: the photo's column, and the column rendered from the moved camera */}
        <g transform="translate(486 0)">
          <text x={0} y={16} fontSize={9} className="fill-muted-foreground font-mono">
            photo
          </text>
          {first.map((h, i) => (
            <rect key={`a${i}`} x={0} y={24 + i * 9} width={24} height={8.4} fill={COLORS[h.kind]} />
          ))}
          {show(5) && (
            <>
              <text x={34} y={16} fontSize={9} className="fill-muted-foreground font-mono">
                new
              </text>
              {(layer2 ? view : viewNo2).map((s, i) =>
                s ? (
                  <rect key={`b${i}`} x={34} y={24 + i * 9} width={24} height={8.4} fill={COLORS[s.kind]} fillOpacity={s.layer ? 0.6 : 1} />
                ) : (
                  <g key={`b${i}`}>
                    <rect x={34} y={24 + i * 9} width={24} height={8.4} fill="none" stroke="#dc2626" strokeWidth={0.8} />
                    <line x1={34} y1={24 + i * 9 + 8.4} x2={58} y2={24 + i * 9} stroke="#dc2626" strokeWidth={0.8} />
                  </g>
                ),
              )}
            </>
          )}
        </g>
      </svg>
      <p className="mt-2 min-h-[3.5rem] text-sm">
        <span className="font-semibold">{`${step + 1}. ${STEPS[step].t}. `}</span>
        {STEPS[step].d}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-md border px-2.5 py-1 hover:bg-muted disabled:opacity-40">
          Back
        </button>
        <button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1} className="rounded-md border px-2.5 py-1 hover:bg-muted disabled:opacity-40">
          Next
        </button>
        {step >= 4 && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={layer2} onChange={(e) => setLayer2(e.target.checked)} />
            second layer
          </label>
        )}
        {step === 5 && (
          <label className="flex items-center gap-1.5">
            lift
            <Range className="w-28" min={0.1} max={1.4} step={0.1} value={lift} onChange={(e) => setLift(Number(e.target.value))} aria-label="How far the camera moves up, metres" />
            <span className="w-10">{lift.toFixed(1)} m</span>
          </label>
        )}
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        A toy scene in metres, drawn to scale, to show the mechanism; it is not a model&apos;s output. Red boxes in the new view are rays that meet no Gaussian: the holes a single-photo splat opens when the camera leaves the photo&apos;s viewpoint.
      </figcaption>
    </figure>
  )
}
