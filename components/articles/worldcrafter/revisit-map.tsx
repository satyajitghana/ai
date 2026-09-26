"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin, mtan } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Which past frames does WorldCrafter hand its memory encoder, and why those?
//
// Every chunk is nine latent frames. Before generating chunk k, the model takes
// the four camera poses it is about to render (latent slots 2, 4, 6 and 8 of
// the chunk), samples each one's viewing frustum as a 10 x 10 x 10 grid of
// points, and asks which history frames' frusta contain those points. The
// latest frame is always in. Then eight more are picked greedily, each time
// taking the candidate that most raises the WORST-covered target view — not
// the one that individually overlaps the targets most. That is
// `select_trajectory_fov_history` in worldcrafter/repencoder/trajectory_fov.py.
//
// This is a top-down, 2D port of that function on a toy courtyard walk of 18
// chunks. The lexicographic key is the code's: sorted per-target coverage,
// then the last target's frontier ratio, sorted frontier ratios, new cells,
// new frontier cells, then recency. Candidates must share covered cells with
// what is already chosen ("connected") unless none do. The frustum test is the
// code's too, including what it leaves out: there is no occlusion — a
// pavilion between two cameras does not stop them "seeing" the same point.
//
// Toy geometry, not the paper's: the code's frustum is 100 x 71.13 degrees
// from 0.1 m to 30 m; here the horizontal half-angle is the same 50 degrees but
// the far plane is 11 units so the frusta fit a courtyard. The 10-point grid
// becomes 10 x 10 in the plane. The alternative mode ranks candidates by their
// own overlap with the targets and takes the top eight — the "similarity-based
// history retrieval" row of the paper's ablation. Coverage numbers are this
// toy's, not measurements of the model.
//
// Transcendentals go through lib/dmath so server and client agree bit for bit.

const LATENTS = 9
const SLOTS = [2, 4, 6, 8] as const
const BUDGET = 8
const SAMPLES = 10
const NEAR = 0.3
const FAR = 11
const DEG = Math.PI / 180
const TAN_H = mtan(50 * DEG)

const OURS = "oklch(0.60 0.15 255)"
const SIM = "oklch(0.68 0.13 85)"
const TARGET = "oklch(0.55 0.16 155)"
const MISS = "oklch(0.58 0.19 27)"

type Mode = "coverage" | "similarity"

// Chunk c runs from K[c] to K[c + 1]: x, y in courtyard units, heading in
// degrees clockwise from north. Headings are unwrapped so turns interpolate the
// short way. The walk leaves the pavilion, circles the courtyard, and in the
// last chunk turns back to face the pavilion from where it started.
const K: [number, number, number][] = [
  [0, 0, 0],
  [0, 1.5, 0],
  [0, 3, 45],
  [2.5, 3.5, 90],
  [6, 3.5, 90],
  [9, 3.5, 45],
  [10, 6, 0],
  [10, 10, 0],
  [10, 13, -45],
  [8, 15, -90],
  [4, 16, -90],
  [-2, 16, -90],
  [-7, 15, -135],
  [-9, 11, -180],
  [-9, 6, -180],
  [-8, 2, -225],
  [-5, 0, -270],
  [-1.5, -0.5, -270],
  [0, 0, -360],
]
const CHUNKS = K.length - 1 // 18

type Pose = { x: number; y: number; h: number; fx: number; fy: number; rx: number; ry: number }

function pose(x: number, y: number, h: number): Pose {
  const s = msin(h * DEG)
  const c = mcos(h * DEG)
  // forward = (sin h, cos h); right = (cos h, -sin h)
  return { x, y, h, fx: s, fy: c, rx: c, ry: -s }
}

const POSES: Pose[] = (() => {
  const out: Pose[] = []
  for (let c = 0; c < CHUNKS; c++) {
    const [x0, y0, h0] = K[c]
    const [x1, y1, h1] = K[c + 1]
    for (let j = 0; j < LATENTS; j++) {
      const t = (j + 1) / LATENTS
      out.push(pose(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, h0 + (h1 - h0) * t))
    }
  }
  return out
})()

type Pt = { x: number; y: number }

function samples(p: Pose): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const u = -1 + (2 * i) / (SAMPLES - 1)
    for (let j = 0; j < SAMPLES; j++) {
      const z = NEAR + ((FAR - NEAR) * j) / (SAMPLES - 1)
      const lat = u * z * TAN_H
      pts.push({ x: p.x + p.fx * z + p.rx * lat, y: p.y + p.fy * z + p.ry * lat })
    }
  }
  return pts
}

function sees(s: Pose, q: Pt): boolean {
  const dx = q.x - s.x
  const dy = q.y - s.y
  const fwd = dx * s.fx + dy * s.fy
  const lat = dx * s.rx + dy * s.ry
  return fwd >= NEAR && fwd <= FAR && Math.abs(lat) <= fwd * TAN_H
}

type Grid = boolean[][] // [target][point]

function visibility(s: Pose, pts: Pt[][]): Grid {
  return pts.map((row) => row.map((q) => sees(s, q)))
}

const count = (row: boolean[]) => row.reduce((a, b) => a + (b ? 1 : 0), 0)

function lexGreater(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

export type Retrieval = {
  anchor: number
  targets: number[]
  selected: number[]
  covered: Grid
  perTarget: number[]
  union: number
  chunks: number
}

export function retrieve(k: number, mode: Mode): Retrieval & { latestOnly: number } {
  const hist = k * LATENTS
  const anchor = hist - 1
  const candidates = Array.from({ length: hist - 1 }, (_, i) => i)
  const targets = SLOTS.map((s) => k * LATENTS + s)
  const pts = targets.map((t) => samples(POSES[t]))
  const vis = new Map<number, Grid>()
  const V = (i: number) => {
    let g = vis.get(i)
    if (!g) {
      g = visibility(POSES[i], pts)
      vis.set(i, g)
    }
    return g
  }

  const anchorVis = V(anchor)
  const latestOnly = anchorVis.reduce((a, r) => a + count(r), 0) / (SLOTS.length * SAMPLES * SAMPLES)

  // Frontier: target cells not already visible from the anchor or from an
  // earlier target pose in the same chunk — the parts the chunk reveals.
  const priors = [POSES[anchor], ...targets.slice(0, -1).map((t) => POSES[t])]
  const frontier: Grid = pts.map((row, t) =>
    row.map((q) => !priors.slice(0, t + 1).some((p) => sees(p, q))),
  )
  const frontierCells = frontier.map(count)
  const frontierRatio = (g: Grid) =>
    g.map((row, t) =>
      frontierCells[t] > 0
        ? row.reduce((a, v, p) => a + (v && frontier[t][p] ? 1 : 0), 0) / frontierCells[t]
        : 1,
    )

  let covered: Grid = anchorVis.map((r) => r.slice())
  let selected: number[]

  if (candidates.length <= BUDGET) {
    selected = candidates.slice()
  } else if (mode === "similarity") {
    selected = candidates
      .map((c) => ({ c, s: V(c).reduce((a, r) => a + count(r), 0) }))
      .sort((a, b) => b.s - a.s || b.c - a.c)
      .slice(0, BUDGET)
      .map((o) => o.c)
  } else {
    selected = []
    const avail = new Set(candidates)
    for (let slot = 0; slot < BUDGET; slot++) {
      const rows = [...avail].map((c) => {
        const v = V(c)
        let bridge = 0
        let newCells = 0
        let newFrontier = 0
        const res: Grid = covered.map((row, t) =>
          row.map((was, p) => {
            const now = v[t][p]
            if (now && was) bridge++
            if (now && !was) {
              newCells++
              if (frontier[t][p]) newFrontier++
            }
            return was || now
          }),
        )
        const full = res.map(count).sort((a, b) => a - b)
        const fr = frontierRatio(res)
        const frSorted = fr.slice().sort((a, b) => a - b)
        return { c, res, connected: bridge > 0, key: [...full, fr[fr.length - 1], ...frSorted, newCells, newFrontier, c] }
      })
      const anyConnected = rows.some((r) => r.connected)
      let best: (typeof rows)[number] | null = null
      for (const r of rows) {
        if (anyConnected && !r.connected) continue
        if (!best || lexGreater(r.key, best.key)) best = r
      }
      if (!best) break
      selected.push(best.c)
      avail.delete(best.c)
      covered = best.res
    }
  }

  if (mode === "similarity" || candidates.length <= BUDGET) {
    for (const c of selected) {
      const v = V(c)
      covered = covered.map((row, t) => row.map((was, p) => was || v[t][p]))
    }
  }

  const perTarget = covered.map((r) => count(r) / (SAMPLES * SAMPLES))
  const union = perTarget.reduce((a, b) => a + b, 0) / SLOTS.length
  const chunks = new Set(selected.map((i) => Math.floor(i / LATENTS))).size
  return { anchor, targets, selected, covered, perTarget, union, chunks, latestOnly }
}

// ---- drawing -------------------------------------------------------------

const W = 700
const H = 468
const XMIN = -12.5
const XMAX = 12.5
const YMIN = -2.5
const YMAX = 18
const S = 15
const MAP_X = 16
const MAP_Y = 44
const MAP_W = (XMAX - XMIN) * S
const MAP_H = (YMAX - YMIN) * S
const MX = (x: number) => MAP_X + (x - XMIN) * S
const MY = (y: number) => MAP_Y + (YMAX - y) * S

function wedge(p: Pose): string {
  const corner = (z: number, side: number) => {
    const lat = side * z * TAN_H
    return `${MX(p.x + p.fx * z + p.rx * lat).toFixed(1)},${MY(p.y + p.fy * z + p.ry * lat).toFixed(1)}`
  }
  return [corner(NEAR, -1), corner(FAR, -1), corner(FAR, 1), corner(NEAR, 1)].join(" ")
}

function cam(p: Pose, size: number): string {
  const tip = { x: p.x + p.fx * size, y: p.y + p.fy * size }
  const l = { x: p.x - p.rx * size * 0.55, y: p.y - p.ry * size * 0.55 }
  const r = { x: p.x + p.rx * size * 0.55, y: p.y + p.ry * size * 0.55 }
  return [tip, l, r].map((q) => `${MX(q.x).toFixed(1)},${MY(q.y).toFixed(1)}`).join(" ")
}

const pct = (v: number) => `${Math.round(v * 100)}%`

const PANEL_X = 424
const BAR_X = 424
const BAR_W = 250
const STRIP_Y = 380
const STRIP_X = 20
const CELL = (W - 40) / (CHUNKS * LATENTS)
const NOW_X = (k: number) => STRIP_X + (k + 0.5) * LATENTS * CELL

export function RevisitMap() {
  const [k, setK] = useState(CHUNKS - 1)
  const [mode, setMode] = useState<Mode>("coverage")

  const both = useMemo(
    () => ({ coverage: retrieve(k, "coverage"), similarity: retrieve(k, "similarity") }),
    [k],
  )
  const r = both[mode]
  const accent = mode === "coverage" ? OURS : SIM
  const picked = new Set(r.selected)
  const tset = new Set(r.targets)
  const pts = r.targets.map((t) => samples(POSES[t]))

  const summary = [
    { label: "latest frame only", v: both.coverage.latestOnly, c: "currentColor", on: false },
    { label: "similarity top-8", v: both.similarity.union, c: SIM, on: mode === "similarity" },
    { label: "max-coverage (WorldCrafter)", v: both.coverage.union, c: OURS, on: mode === "coverage" },
  ]

  const desc =
    `Top-down courtyard walk, generating chunk ${k} of ${CHUNKS - 1}. ` +
    `With ${mode === "coverage" ? "max-coverage" : "similarity"} retrieval the latest frame plus eight chosen history frames cover ` +
    `${pct(r.union)} of the four upcoming views' frustum sample points, drawn from ${r.chunks} distinct past chunks. ` +
    `The latest frame alone covers ${pct(both.coverage.latestOnly)}; similarity top-8 covers ${pct(both.similarity.union)}; max-coverage covers ${pct(both.coverage.union)}.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>which past frames reach the memory encoder</span>
        <span className="text-muted-foreground/60">toy 2D port of trajectory_fov.py</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="shrink-0">chunk {String(k).padStart(2, "0")}</span>
          <Range
            min={2}
            max={CHUNKS - 1}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            accent={accent}
            aria-label="Which chunk is being generated"
            className="flex-1"
          />
        </label>
        <div className="flex gap-1.5">
          {(
            [
              ["coverage", "max-coverage"],
              ["similarity", "similarity top-8"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[620px]" role="img" aria-label={desc}>
          <defs>
            <clipPath id="wc-revisit-clip">
              <rect x={MAP_X} y={MAP_Y} width={MAP_W} height={MAP_H} rx={6} />
            </clipPath>
          </defs>

          <text x={MAP_X} y={24} className="fill-foreground font-mono" fontSize={10.5}>
            courtyard, top-down · generating chunk {k}
          </text>

          <rect
            x={MAP_X}
            y={MAP_Y}
            width={MAP_W}
            height={MAP_H}
            rx={6}
            fill="currentColor"
            className="text-muted/40"
            stroke="currentColor"
            strokeOpacity={0.15}
          />

          <g clipPath="url(#wc-revisit-clip)">
            {/* landmarks */}
            <g className="text-muted-foreground" stroke="currentColor" fill="none" strokeOpacity={0.55}>
              <rect x={MX(-2.5)} y={MY(13)} width={5 * S} height={3 * S} rx={2} strokeWidth={1.4} />
              <ellipse cx={MX(5.5)} cy={MY(7.5)} rx={2.2 * S} ry={1.4 * S} strokeWidth={1.2} />
              <circle cx={MX(-5.5)} cy={MY(7)} r={1.1 * S} strokeWidth={1.2} />
              <circle cx={MX(3.8)} cy={MY(13.2)} r={0.4 * S} strokeWidth={1.2} />
            </g>
            <g className="fill-muted-foreground font-mono" fontSize={8.5}>
              <text x={MX(0)} y={MY(11.5) + 3} textAnchor="middle">
                pavilion
              </text>
              <text x={MX(5.5)} y={MY(7.5) + 3} textAnchor="middle">
                pond
              </text>
              <text x={MX(-5.5)} y={MY(7) + 3} textAnchor="middle">
                tree
              </text>
            </g>

            {/* selected history frusta */}
            {[r.anchor, ...r.selected].map((i) => (
              <polygon
                key={`w${i}`}
                points={wedge(POSES[i])}
                fill={i === r.anchor ? "currentColor" : accent}
                fillOpacity={i === r.anchor ? 0.06 : 0.07}
                stroke={i === r.anchor ? "currentColor" : accent}
                strokeOpacity={0.35}
                strokeWidth={0.8}
                className={i === r.anchor ? "text-foreground" : undefined}
              />
            ))}

            {/* upcoming target frusta */}
            {r.targets.map((t) => (
              <polygon
                key={`t${t}`}
                points={wedge(POSES[t])}
                fill="none"
                stroke={TARGET}
                strokeWidth={1.1}
                strokeDasharray="4 3"
              />
            ))}

            {/* frustum sample points: covered or not */}
            {pts.map((row, t) =>
              row.map((q, p) => (
                <circle
                  key={`p${t}-${p}`}
                  cx={MX(q.x)}
                  cy={MY(q.y)}
                  r={1.3}
                  fill={r.covered[t][p] ? accent : MISS}
                  fillOpacity={r.covered[t][p] ? 0.75 : 0.6}
                />
              )),
            )}

            {/* the path: every latent frame's pose */}
            {POSES.map((p, i) => {
              const future = i >= k * LATENTS + LATENTS
              const isTarget = tset.has(i)
              const isPicked = picked.has(i) || i === r.anchor
              if (future) {
                return <circle key={`c${i}`} cx={MX(p.x)} cy={MY(p.y)} r={0.9} className="fill-muted-foreground" fillOpacity={0.25} />
              }
              if (isTarget || isPicked) {
                return (
                  <polygon
                    key={`c${i}`}
                    points={cam(p, 0.75)}
                    fill={isTarget ? TARGET : i === r.anchor ? "currentColor" : accent}
                    className={i === r.anchor ? "text-foreground" : undefined}
                  />
                )
              }
              return <circle key={`c${i}`} cx={MX(p.x)} cy={MY(p.y)} r={1.1} className="fill-muted-foreground" fillOpacity={i >= k * LATENTS ? 0.35 : 0.7} />
            })}
          </g>

          {/* right panel */}
          <text x={PANEL_X} y={24} className="fill-foreground font-mono" fontSize={10.5}>
            coverage of the next four views
          </text>
          <text x={PANEL_X} y={MAP_Y + 4} className="fill-muted-foreground font-mono" fontSize={8.5}>
            share of frustum sample points seen by
          </text>
          <text x={PANEL_X} y={MAP_Y + 16} className="fill-muted-foreground font-mono" fontSize={8.5}>
            the latest frame plus eight retrieved frames
          </text>
          {summary.map((b, i) => {
            const y = MAP_Y + 38 + i * 34
            return (
              <g key={b.label}>
                <text
                  x={BAR_X}
                  y={y}
                  className={b.on ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={9}
                >
                  {b.label}
                </text>
                <rect x={BAR_X} y={y + 5} width={BAR_W} height={9} rx={2} fill="currentColor" className="text-muted" />
                <rect
                  x={BAR_X}
                  y={y + 5}
                  width={Math.max(1, BAR_W * b.v)}
                  height={9}
                  rx={2}
                  fill={b.c}
                  fillOpacity={b.on ? 0.9 : 0.45}
                  className={b.c === "currentColor" ? "text-muted-foreground" : undefined}
                />
                <text x={BAR_X + BAR_W + 6} y={y + 13} className="fill-muted-foreground font-mono" fontSize={9}>
                  {pct(b.v)}
                </text>
              </g>
            )
          })}

          <text x={PANEL_X} y={MAP_Y + 152} className="fill-foreground font-mono" fontSize={9.5}>
            per target view ({mode === "coverage" ? "max-coverage" : "similarity"})
          </text>
          {r.perTarget.map((v, i) => {
            const y = MAP_Y + 166 + i * 20
            return (
              <g key={`pt${i}`}>
                <text x={BAR_X} y={y + 8} className="fill-muted-foreground font-mono" fontSize={8.5}>
                  slot {SLOTS[i]}
                </text>
                <rect x={BAR_X + 40} y={y} width={BAR_W - 40} height={8} rx={2} fill="currentColor" className="text-muted" />
                <rect x={BAR_X + 40} y={y} width={Math.max(1, (BAR_W - 40) * v)} height={8} rx={2} fill={accent} fillOpacity={0.85} />
                <text x={BAR_X + BAR_W + 6} y={y + 8} className="fill-muted-foreground font-mono" fontSize={8.5}>
                  {pct(v)}
                </text>
              </g>
            )
          })}

          <text x={PANEL_X} y={MAP_Y + 260} className="fill-muted-foreground font-mono" fontSize={8.5}>
            recalled from {r.chunks} distinct past chunk{r.chunks === 1 ? "" : "s"}
          </text>
          <g fontSize={8.5} className="font-mono">
            <line x1={PANEL_X} x2={PANEL_X + 16} y1={MAP_Y + 280} y2={MAP_Y + 280} stroke={TARGET} strokeDasharray="4 3" strokeWidth={1.2} />
            <text x={PANEL_X + 22} y={MAP_Y + 283} className="fill-muted-foreground">
              views about to be generated
            </text>
            <circle cx={PANEL_X + 8} cy={MAP_Y + 296} r={2} fill={MISS} fillOpacity={0.7} />
            <text x={PANEL_X + 22} y={MAP_Y + 299} className="fill-muted-foreground">
              point no retrieved frame sees
            </text>
          </g>

          {/* history strip: 18 chunks x 9 latent frames */}
          <text x={STRIP_X} y={STRIP_Y - 8} className="fill-muted-foreground font-mono" fontSize={8.5}>
            history, one cell per latent frame · the latest frame is always kept
          </text>
          {POSES.map((_, i) => {
            const chunk = Math.floor(i / LATENTS)
            const x = STRIP_X + i * CELL
            const future = chunk > k
            const isTarget = tset.has(i)
            const isAnchor = i === r.anchor
            const isPicked = picked.has(i)
            let fill = "currentColor"
            let cls = "text-muted-foreground"
            let op = 0.28
            if (future) op = 0.08
            else if (chunk === k) op = 0.12
            if (isPicked) {
              fill = accent
              cls = ""
              op = 0.95
            }
            if (isAnchor) {
              cls = "text-foreground"
              op = 0.95
            }
            return (
              <g key={`s${i}`}>
                <rect
                  x={x + 0.4}
                  y={STRIP_Y}
                  width={CELL - 0.8}
                  height={16}
                  fill={fill}
                  fillOpacity={op}
                  className={cls || undefined}
                />
                {isTarget ? (
                  <rect x={x + 0.4} y={STRIP_Y} width={CELL - 0.8} height={16} fill={TARGET} fillOpacity={0.9} />
                ) : null}
              </g>
            )
          })}
          {Array.from({ length: CHUNKS + 1 }, (_, c) => (
            <line
              key={`b${c}`}
              x1={STRIP_X + c * LATENTS * CELL}
              x2={STRIP_X + c * LATENTS * CELL}
              y1={STRIP_Y - 2}
              y2={STRIP_Y + 18}
              stroke="currentColor"
              className="text-border"
              strokeWidth={0.8}
            />
          ))}
          {NOW_X(k) - STRIP_X > 64 ? (
            <text x={STRIP_X} y={STRIP_Y + 30} className="fill-muted-foreground font-mono" fontSize={8.5}>
              chunk 0
            </text>
          ) : null}
          <text x={NOW_X(k)} y={STRIP_Y + 30} textAnchor="middle" fill={TARGET} className="font-mono" fontSize={8.5}>
            now
          </text>
          {W - 20 - NOW_X(k) > 64 ? (
            <text x={W - 20} y={STRIP_Y + 30} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
              chunk {CHUNKS - 1}
            </text>
          ) : null}
          <text x={STRIP_X} y={STRIP_Y + 50} className="fill-muted-foreground font-mono" fontSize={8.5}>
            green: slots 2, 4, 6, 8 of this chunk, the poses the memory is read out at
          </text>
          <text x={STRIP_X} y={STRIP_Y + 63} className="fill-muted-foreground font-mono" fontSize={8.5}>
            coloured: the eight frames retrieval picked · dark: the latest frame
          </text>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        A 2D port of WorldCrafter&apos;s history retrieval on a made-up walk. The
        percentages are this toy&apos;s geometry, not measurements of the model.
        Drag to the last chunk, where the camera turns back to the pavilion, and
        switch modes: similarity ranking spends its eight slots on near-copies of
        the most-overlapping views, while max-coverage keeps adding whichever frame
        lifts the worst-covered upcoming view.
      </figcaption>
    </figure>
  )
}
