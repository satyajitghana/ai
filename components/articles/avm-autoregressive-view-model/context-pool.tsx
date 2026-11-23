"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { matan2, mcos, mhypot, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A top-down toy of AVM's context management (paper Sec. 4 and App. E).
//
// A camera walks out of a room's corner along a loop and comes back. Every view it
// generates joins a pool keyed by its pose. For the current target view the model attends
// to: a sink (the prefill image, always kept), the last few views as motion context, and
// views retrieved from the pool by camera pose. Three policies from App. E are drawn:
//   greedy nearest  rank pool views by || P_q^-1 (P_r - P_q) ||_F (here on 2D SE(2) poses)
//   spatial         sample anchor points along the target's rays and greedily take the
//                   pool view that covers the most uncovered anchors
//   spatial+angular the spatial pass, then up to four views that fill the target-relative
//                   headings (parallel, opposite, left, right)
// "Anchored" is the share of anchor points in the target's view that the sink or a retrieved
// view also sees: content the model can copy from an older observation instead of from
// the last few frames it generated itself. It is the toy's stand-in for the paper's overlap. Geometry only, no pixels and no
// image quality: nothing here is a measured AVM number.

type Pose = { x: number; y: number; th: number }
type Policy = "off" | "greedy" | "spatial" | "angular"

const ROOM = { w: 10, h: 7 }
const HALF_FOV = (35 * Math.PI) / 180
const N_VIEWS = 120
const SEE = 6 // metres a view can see in the toy

// Out along the bottom wall, round the far end, back along the top, then home: an
// out-and-back loop like the paper's revisit trajectories.
function poseAt(i: number): Pose {
  const u = i / (N_VIEWS - 1)
  const a = u * 2 * Math.PI
  const x = 5 - 3.6 * mcos(a)
  const y = 3.5 - 2.2 * msin(a)
  const dx = 3.6 * msin(a)
  const dy = -2.2 * mcos(a)
  // look ahead and a little inward, so the camera faces the room it is walking through
  const th = matan2(dy, dx) + 0.6
  return { x, y, th }
}

const POSES = Array.from({ length: N_VIEWS }, (_, i) => poseAt(i))

function sees(v: Pose, px: number, py: number) {
  const dx = px - v.x
  const dy = py - v.y
  const d = mhypot(dx, dy)
  if (d < 0.05 || d > SEE) return false
  let da = matan2(dy, dx) - v.th
  while (da > Math.PI) da -= 2 * Math.PI
  while (da < -Math.PI) da += 2 * Math.PI
  return Math.abs(da) <= HALF_FOV
}

// SE(2) version of the paper's d(q, r) = || P_q^-1 (P_r - P_q) ||_F = || P_q^-1 P_r - I ||_F
function poseDist(q: Pose, r: Pose) {
  const c = mcos(q.th)
  const s = msin(q.th)
  const dx = r.x - q.x
  const dy = r.y - q.y
  const tx = c * dx + s * dy
  const ty = -s * dx + c * dy
  const dth = r.th - q.th
  const cc = mcos(dth) - 1
  const ss = msin(dth)
  return Math.sqrt(2 * cc * cc + 2 * ss * ss + tx * tx + ty * ty)
}

function anchorsFor(q: Pose) {
  const pts: [number, number][] = []
  for (let a = 0; a < 9; a++) {
    const ang = q.th - HALF_FOV + (2 * HALF_FOV * a) / 8
    for (const depth of [1, 2, 3, 4.5]) {
      const px = q.x + depth * mcos(ang)
      const py = q.y + depth * msin(ang)
      if (px > 0 && px < ROOM.w && py > 0 && py < ROOM.h) pts.push([px, py])
    }
  }
  return pts
}

function headingOf(q: Pose, r: Pose) {
  let d = r.th - q.th
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  const a = Math.abs(d)
  if (a < Math.PI / 4) return "parallel"
  if (a > (3 * Math.PI) / 4) return "opposite"
  return d > 0 ? "left" : "right"
}

function retrieve(policy: Policy, t: number, motion: number, budget: number) {
  const q = POSES[t]
  const pool: number[] = []
  for (let i = 1; i < t - motion; i++) pool.push(i)
  if (policy === "off" || pool.length === 0) return []
  if (policy === "greedy") {
    return pool
      .map((i) => ({ i, d: poseDist(q, POSES[i]) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, budget)
      .map((o) => o.i)
  }
  const anchors = anchorsFor(q)
  const covered = new Array(anchors.length).fill(false)
  const radius = 3.2
  const picked: number[] = []
  while (picked.length < budget) {
    let best = -1
    let bestGain = 0
    for (const i of pool) {
      if (picked.includes(i)) continue
      const r = POSES[i]
      if (mhypot(r.x - q.x, r.y - q.y) > radius) continue
      let gain = 0
      anchors.forEach(([px, py], k) => {
        if (!covered[k] && sees(r, px, py)) gain++
      })
      if (gain > bestGain) {
        bestGain = gain
        best = i
      }
    }
    if (best < 0) break
    picked.push(best)
    anchors.forEach(([px, py], k) => {
      if (sees(POSES[best], px, py)) covered[k] = true
    })
  }
  if (policy === "angular") {
    const have = new Set<string>(picked.map((i) => headingOf(q, POSES[i])))
    for (const h of ["parallel", "opposite", "left", "right"]) {
      if (have.has(h)) continue
      const cand = pool
        .filter((i) => !picked.includes(i) && headingOf(q, POSES[i]) === h)
        .map((i) => ({ i, n: anchors.filter(([px, py]) => sees(POSES[i], px, py)).length, d: poseDist(q, POSES[i]) }))
        .filter((o) => o.n > 0)
        .sort((a, b) => b.n - a.n || a.d - b.d)
      if (cand.length) {
        picked.push(cand[0].i)
        have.add(h)
      }
    }
  }
  return picked
}

const MODELS = {
  causal: { label: "causal model", motion: 15, target: 3 },
  base: { label: "base model", motion: 2, target: 19 },
} as const

const C_SINK = "#7c3aed"
const C_MOT = "#64748b"
const C_RTR = "#c8501e"
const C_TGT = "#2563eb"

export function ContextPool() {
  const [t, setT] = useState(110)
  const [policy, setPolicy] = useState<Policy>("angular")
  const [model, setModel] = useState<keyof typeof MODELS>("causal")
  const m = MODELS[model]
  // one toy view stands for one latent frame; the window is motion context then the target block
  const motion = m.motion
  const budget = 3

  const res = useMemo(() => {
    const q = POSES[t]
    const rtr = retrieve(policy, t, motion, budget)
    const mot: number[] = []
    for (let i = Math.max(1, t - motion); i < t; i++) mot.push(i)
    const anchors = anchorsFor(q)
    const old = [0, ...rtr]
    const anchored = anchors.map(([px, py]) => old.some((i) => sees(POSES[i], px, py)))
    const recent = anchors.map(([px, py]) => mot.some((i) => sees(POSES[i], px, py)))
    const seen = anchored.filter(Boolean).length
    const seenLocal = recent.filter(Boolean).length
    return { q, rtr, mot, anchors, anchored, recent, seen, seenLocal }
  }, [t, policy, motion])

  const W = 640
  const H = 448
  const S = 60
  const X = (x: number) => 20 + x * S
  const Y = (y: number) => H - 14 - y * S

  const frustum = (p: Pose, len: number) => {
    const a = p.th - HALF_FOV
    const b = p.th + HALF_FOV
    return `${X(p.x)},${Y(p.y)} ${X(p.x + len * mcos(a)).toFixed(1)},${Y(p.y + len * msin(a)).toFixed(1)} ${X(p.x + len * mcos(b)).toFixed(1)},${Y(p.y + len * msin(b)).toFixed(1)}`
  }

  const share = (n: number) => (res.anchors.length ? Math.round((100 * n) / res.anchors.length) : 0)
  const policies: [Policy, string][] = [
    ["off", "no retrieval"],
    ["greedy", "greedy nearest"],
    ["spatial", "spatial"],
    ["angular", "spatial + angular"],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">the context pool, from above</span>
        <div className="flex flex-wrap gap-1">
          {policies.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPolicy(id)}
              aria-pressed={policy === id}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                policy === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Top view of a room. A camera path loops out and back. The current target view, the motion window, the sink and the retrieved views are drawn as view cones."
          className="w-full rounded-md border bg-muted/20"
        >
          <rect x={X(0)} y={Y(ROOM.h)} width={ROOM.w * S} height={ROOM.h * S} fill="none" stroke="var(--muted-foreground)" strokeWidth="2" opacity="0.5" />
          <polyline
            points={POSES.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ")}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeDasharray="3 4"
            opacity="0.5"
          />
          {POSES.slice(1, t).map((p, i) => (
            <circle key={i} cx={X(p.x).toFixed(1)} cy={Y(p.y).toFixed(1)} r="2" fill="var(--muted-foreground)" opacity="0.35" />
          ))}
          <polygon points={frustum(POSES[0], 2.2)} fill={C_SINK} opacity="0.18" stroke={C_SINK} />
          {res.mot.map((i) => (
            <polygon key={`m${i}`} points={frustum(POSES[i], 1.4)} fill={C_MOT} opacity="0.06" stroke={C_MOT} strokeOpacity="0.3" />
          ))}
          {res.rtr.map((i) => (
            <g key={`r${i}`}>
              <polygon points={frustum(POSES[i], 2.6)} fill={C_RTR} opacity="0.16" stroke={C_RTR} />
              <circle cx={X(POSES[i].x)} cy={Y(POSES[i].y)} r="4" fill={C_RTR} />
            </g>
          ))}
          {res.anchors.map(([px, py], k) => (
            <circle
              key={`a${k}`}
              cx={X(px).toFixed(1)}
              cy={Y(py).toFixed(1)}
              r="2.6"
              fill={res.anchored[k] ? C_RTR : "none"}
              stroke={res.anchored[k] ? C_RTR : C_TGT}
              strokeWidth="1"
            />
          ))}
          <polygon points={frustum(res.q, SEE * 0.75)} fill={C_TGT} opacity="0.1" stroke={C_TGT} strokeWidth="1.5" />
          <circle cx={X(res.q.x)} cy={Y(res.q.y)} r="5" fill={C_TGT} />
          <circle cx={X(POSES[0].x)} cy={Y(POSES[0].y)} r="5" fill={C_SINK} />
          <text x={X(POSES[0].x) + 8} y={Y(POSES[0].y) + 16} fontSize="11" className="font-mono" fill={C_SINK}>
            prefill image (sink)
          </text>
          <text x={10} y={16} fontSize="11" className="fill-muted-foreground font-mono">
            filled dots: points in the target&apos;s view that the sink or a retrieved view also sees
          </text>
        </svg>

        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <div>
            <span style={{ color: C_TGT }}>target view </span>
            {t} of {N_VIEWS - 1}
            <span className="text-muted-foreground"> · pool holds {Math.max(0, t - motion - 1)} older views</span>
          </div>
          <div>
            <span className="text-muted-foreground">attended: </span>
            <span style={{ color: C_SINK }}>1 sink</span> + <span style={{ color: C_RTR }}>{res.rtr.length} retrieved</span> +{" "}
            <span style={{ color: C_MOT }}>{res.mot.length} motion</span> + <span style={{ color: C_TGT }}>{m.target} target</span>
          </div>
          <div>
            <span className="text-muted-foreground">target points the motion window sees </span>
            {share(res.seenLocal)}%
          </div>
          <div>
            <span className="text-muted-foreground">anchored to an older view ({policies.find((p) => p[0] === policy)?.[1]}) </span>
            <span className="text-foreground">{share(res.seen)}%</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-mono text-xs">
            <span>walk the loop: target view {t}</span>
            <Range min={20} max={N_VIEWS - 1} step={1} value={t} accent={C_TGT} onChange={(e) => setT(Number(e.target.value))} />
          </label>
          <div className="grid gap-1 font-mono text-xs">
            <span>local window</span>
            <div className="flex gap-1">
              {(Object.keys(MODELS) as (keyof typeof MODELS)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setModel(k)}
                  aria-pressed={model === k}
                  className={cn(
                    "cursor-pointer rounded border px-2 py-1 transition-colors",
                    model === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {MODELS[k].label}: {MODELS[k].motion} motion + {MODELS[k].target} target
                </button>
              ))}
            </div>
          </div>
        </div>

        <figcaption className="mt-3 text-xs text-muted-foreground">
          Walk the target round the loop. The motion window always sees most of what is ahead, but those are frames the model
          generated a moment ago, so an error in them carries forward. A filled dot is a point that the prefill sink or a
          retrieved view from earlier in the walk also saw: there the model can copy the first observation of the place. Greedy nearest takes the closest poses; the spatial pass takes the views that cover the most of the target&apos;s
          cone, and the angular pass adds views facing other headings. Which policy wins depends on where the target is: this toy
          does not reproduce the paper&apos;s Table 8, where greedy nearest beats the spatial pass alone on overlap. Window
          sizes are the paper&apos;s examples (one toy view per latent frame); the retrieval budget is three slots, as at a
          retriever size of one with three target latents. A geometric toy computed in your browser, not AVM output.
        </figcaption>
      </div>
    </figure>
  )
}
