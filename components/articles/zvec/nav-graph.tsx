"use client"

import { useEffect, useMemo, useState } from "react"

// The core of an HNSW search: greedy descent over a navigable graph.
// A brute-force query computes the distance to every one of N vectors. A graph
// index instead walks the neighbour links, always hopping to the neighbour
// closest to the query, and stops at a local minimum — the (approximate)
// nearest neighbour. It never looks at most of the dataset.
//
// This is a tiny, deterministic 2D instance (N=80). Everything below —
// the point layout, the k-NN graph, and the greedy path — is computed from a
// fixed seed with bounded loops, so the first (server) render is pure and
// always terminates. Timers live only in useEffect. The numbers here are a
// toy; the point is the *shape* of the cost, which is what scales.

const ACC = "oklch(0.70 0.15 235)" // zvec blue — the search path
const QC = "oklch(0.74 0.16 55)" // amber — the query target

const W = 720
const H = 380
const PAD = 40
const N = 80
const K = 5
const SEED = 120
const QUERY: [number, number] = [W - PAD - 26, H - PAD - 24]

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pt = [number, number]
const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

function buildPoints(): Pt[] {
  const rnd = mulberry32(SEED)
  const pts: Pt[] = []
  for (let i = 0; i < N; i++) {
    pts.push([PAD + rnd() * (W - 2 * PAD), PAD + rnd() * (H - 2 * PAD)])
  }
  return pts
}

function knnGraph(pts: Pt[]): number[][] {
  const adj: number[][] = []
  for (let i = 0; i < N; i++) {
    const order = pts
      .map((_, j) => j)
      .filter((j) => j !== i)
      .sort((x, y) => d2(pts[i], pts[x]) - d2(pts[i], pts[y]))
    adj.push(order.slice(0, K))
  }
  // symmetrize — an undirected navigable graph
  const sets = adj.map((a) => new Set(a))
  for (let i = 0; i < N; i++) for (const j of adj[i]) sets[j].add(i)
  return sets.map((s) => [...s])
}

// Greedy descent. At each node, compute the distance to every neighbour, move
// to the closest one, stop when no neighbour improves. Returns the path and,
// per step, the running count of distances actually computed.
function greedyPath(pts: Pt[], adj: number[][], entry: number) {
  let cur = entry
  const path = [entry]
  const seen = new Set<number>([entry])
  const computedAt = [1] // distances computed by the end of step 0
  let guard = 0
  while (guard++ < N) {
    let best = cur
    let bd = d2(pts[cur], QUERY)
    for (const nb of adj[cur]) {
      seen.add(nb)
      const d = d2(pts[nb], QUERY)
      if (d < bd) {
        bd = d
        best = nb
      }
    }
    if (best === cur) break
    cur = best
    path.push(cur)
    computedAt.push(seen.size)
  }
  return { path, computedAt }
}

export function NavGraph() {
  const model = useMemo(() => {
    const pts = buildPoints()
    const adj = knnGraph(pts)
    // entry = farthest node from the query (a long, honest walk)
    let entry = 0
    let far = -1
    for (let i = 0; i < N; i++) {
      const d = d2(pts[i], QUERY)
      if (d > far) {
        far = d
        entry = i
      }
    }
    let trueNN = 0
    let near = Infinity
    for (let i = 0; i < N; i++) {
      const d = d2(pts[i], QUERY)
      if (d < near) {
        near = d
        trueNN = i
      }
    }
    const { path, computedAt } = greedyPath(pts, adj, entry)
    // edge list (deduped) for the faint background graph
    const edges: [number, number][] = []
    const emitted = new Set<string>()
    for (let i = 0; i < N; i++)
      for (const j of adj[i]) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`
        if (!emitted.has(key)) {
          emitted.add(key)
          edges.push([i, j])
        }
      }
    return { pts, adj, path, computedAt, entry, trueNN, edges }
  }, [])

  const { pts, path, computedAt, entry, trueNN, edges } = model
  const last = path.length - 1

  const [step, setStep] = useState(0) // pure, deterministic first render
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    if (step >= last) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, last)), 620)
    return () => clearTimeout(id)
  }, [playing, step, last])

  const visited = new Set(path.slice(0, step + 1))
  const cur = path[step]
  const computed = computedAt[step]
  const bruteColor = "var(--muted-foreground)"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>greedy descent · N = {N} vectors</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A 2D point cloud wired into a nearest-neighbour graph. A highlighted path hops from a far entry node across the graph to the point nearest the query, touching only a fraction of the nodes."
        >
          {/* faint background graph */}
          {edges.map(([a, b], i) => (
            <line
              key={i}
              x1={pts[a][0]}
              y1={pts[a][1]}
              x2={pts[b][0]}
              y2={pts[b][1]}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          ))}

          {/* search path so far */}
          {path.slice(0, step).map((a, i) => {
            const b = path[i + 1]
            return (
              <line
                key={`p${i}`}
                x1={pts[a][0]}
                y1={pts[a][1]}
                x2={pts[b][0]}
                y2={pts[b][1]}
                stroke={ACC}
                strokeWidth={2.4}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            )
          })}

          {/* all nodes */}
          {pts.map((p, i) => {
            const onPath = visited.has(i)
            const isCur = i === cur
            const isEntry = i === entry
            const isNN = i === trueNN
            return (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r={isCur ? 6.5 : onPath ? 5 : 4}
                fill={onPath ? ACC : "var(--muted-foreground)"}
                opacity={onPath ? 0.95 : 0.28}
                stroke={isNN ? QC : isEntry ? ACC : "none"}
                strokeWidth={isNN || isEntry ? 2 : 0}
                className="transition-all duration-300"
              >
                {isCur ? (
                  <animate attributeName="r" values="6.5;8;6.5" dur="1.4s" repeatCount="indefinite" />
                ) : null}
              </circle>
            )
          })}

          {/* the query target (not a stored vector) */}
          <g>
            <circle cx={QUERY[0]} cy={QUERY[1]} r={11} fill="none" stroke={QC} strokeWidth={1.4} strokeDasharray="3 3" />
            <circle cx={QUERY[0]} cy={QUERY[1]} r={3.2} fill={QC} />
          </g>
          <text x={QUERY[0]} y={QUERY[1] - 16} textAnchor="middle" className="font-mono" fontSize={11} fill={QC}>
            query
          </text>
          <text x={pts[entry][0]} y={pts[entry][1] - 12} textAnchor="middle" className="font-mono" fontSize={10} fill={ACC}>
            entry
          </text>
        </svg>

        {/* counters */}
        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">hops</div>
            <div className="mt-0.5 text-base" style={{ color: ACC }}>
              {step} <span className="text-xs text-muted-foreground">/ {last}</span>
            </div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">distances computed</div>
            <div className="mt-0.5 text-base" style={{ color: ACC }}>
              {computed} <span className="text-xs text-muted-foreground">/ {N}</span>
            </div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">brute force</div>
            <div className="mt-0.5 text-base" style={{ color: bruteColor }}>
              {N} <span className="text-xs text-muted-foreground">/ {N}</span>
            </div>
          </div>
        </div>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setStep((s) => Math.max(0, s - 1))
            }}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            prev
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setStep((s) => Math.min(last, s + 1))
            }}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            step
          </button>
          <button
            type="button"
            onClick={() => {
              if (step >= last) setStep(0)
              setPlaying((p) => !p)
            }}
            className="cursor-pointer rounded-md px-2.5 py-1 font-mono text-xs text-background transition-colors"
            style={{ background: ACC }}
          >
            {playing ? "pause" : step >= last ? "replay" : "play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setStep(0)
            }}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            reset
          </button>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {step >= last ? "reached the nearest neighbour" : "hop toward the query"}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Brute force scores the query against all <span className="text-foreground">{N}</span> vectors. The graph search
          starts at a far <span style={{ color: ACC }}>entry</span> node and keeps hopping to the neighbour closest to the{" "}
          <span style={{ color: QC }}>query</span>, stopping at the nearest point. It reaches the answer after{" "}
          <span style={{ color: ACC }}>{last} hops</span>, computing distances to{" "}
          <span style={{ color: ACC }}>{computedAt[last]}</span> of {N} vectors — the rest are never touched. The hop count
          grows roughly logarithmically, so at 10M vectors the same descent scores a few thousand, not ten million.
        </p>
      </div>
    </figure>
  )
}
