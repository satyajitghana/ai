"use client"

import { useMemo, useState } from "react"

// A toy of the greedy cluster growth used in this article's numpy experiment, on a flat 14 x 14 quad grid
// (392 triangles). NOT the meshoptimizer algorithm the pipeline calls, and NOT a measurement of it.
//
// Rule (the same as exp/mesh.py): seed on the first unassigned triangle next to the last cluster's frontier,
// then repeatedly add the neighbouring triangle that brings the fewest NEW vertices, ties broken by the
// distance of its centroid to the cluster centroid. Stop at the triangle cap, the vertex cap, or when no
// neighbour is free. Fully deterministic: no randomness, no trig.

const N = 14

type Tri = [number, number, number]

function makeGrid() {
  const tris: Tri[] = []
  const cen: [number, number][] = []
  const vid = (x: number, y: number) => y * (N + 1) + x
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      tris.push([vid(x, y), vid(x + 1, y), vid(x + 1, y + 1)])
      cen.push([x + 2 / 3, y + 1 / 3])
      tris.push([vid(x, y), vid(x + 1, y + 1), vid(x, y + 1)])
      cen.push([x + 1 / 3, y + 2 / 3])
    }
  }
  const edge = new Map<string, number[]>()
  tris.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const a = t[k]
      const b = t[(k + 1) % 3]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const l = edge.get(key)
      if (l) l.push(i)
      else edge.set(key, [i])
    }
  })
  const nb: number[][] = tris.map(() => [])
  edge.forEach((l) => {
    if (l.length === 2) {
      nb[l[0]].push(l[1])
      nb[l[1]].push(l[0])
    }
  })
  return { tris, cen, nb }
}

const GRID = makeGrid()

function grow(maxT: number, maxV: number) {
  const { tris, cen, nb } = GRID
  const owner = new Array<number>(tris.length).fill(-1)
  const clusters: { t: number[]; v: number }[] = []
  let hint: number[] = []
  let scan = 0
  for (;;) {
    let seed = hint.find((t) => owner[t] < 0) ?? -1
    if (seed < 0) {
      while (scan < tris.length && owner[scan] >= 0) scan++
      if (scan >= tris.length) break
      seed = scan
    }
    const id = clusters.length
    const members = [seed]
    owner[seed] = id
    const vs = new Set<number>(tris[seed])
    const cand = new Set<number>(nb[seed].filter((t) => owner[t] < 0))
    let cx = cen[seed][0]
    let cy = cen[seed][1]
    while (cand.size > 0 && members.length < maxT) {
      let best = -1
      let bn = 99
      let bd = Infinity
      cand.forEach((t) => {
        let nw = 0
        for (const v of tris[t]) if (!vs.has(v)) nw++
        if (vs.size + nw > maxV) return
        const d = (cen[t][0] - cx) ** 2 + (cen[t][1] - cy) ** 2
        if (nw < bn || (nw === bn && d < bd)) {
          best = t
          bn = nw
          bd = d
        }
      })
      if (best < 0) break
      members.push(best)
      owner[best] = id
      tris[best].forEach((v) => vs.add(v))
      cand.delete(best)
      nb[best].forEach((t) => {
        if (owner[t] < 0) cand.add(t)
      })
      cx = members.reduce((s, t) => s + cen[t][0], 0) / members.length
      cy = members.reduce((s, t) => s + cen[t][1], 0) / members.length
    }
    hint = Array.from(cand).filter((t) => owner[t] < 0)
    clusters.push({ t: members, v: vs.size })
  }
  return { owner, clusters }
}

export function ClusterGrower() {
  const [maxT, setMaxT] = useState(32)
  const [vq, setVq] = useState(0.6)
  const maxV = Math.max(4, Math.round(maxT * vq))
  const { owner, clusters } = useMemo(() => grow(maxT, maxV), [maxT, maxV])

  const total = GRID.tris.length
  const loads = clusters.reduce((s, c) => s + c.v, 0)
  const small = clusters.filter((c) => c.t.length < maxT / 2).length
  const full = clusters.filter((c) => c.t.length >= maxT || c.v >= maxV - 1).length
  const pad = 1 - total / (clusters.length * maxT)

  const S = 30
  const pad0 = 8

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>toy · greedy cluster growth · 14 x 14 grid, {total} triangles</span>
        <span className="text-muted-foreground/60">not meshoptimizer</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:p-5">
        <svg
          viewBox={`0 0 ${N * S + pad0 * 2} ${N * S + pad0 * 2}`}
          role="img"
          aria-label={`A 14 by 14 triangle grid split into ${clusters.length} clusters, each a different colour`}
          className="mx-auto w-full max-w-[26rem]"
        >
          {GRID.tris.map((t, i) => {
            const pts = t
              .map((v) => `${pad0 + (v % (N + 1)) * S},${pad0 + Math.floor(v / (N + 1)) * S}`)
              .join(" ")
            const c = owner[i]
            const hue = (c * 137) % 360
            return (
              <polygon
                key={i}
                points={pts}
                fill={`oklch(0.72 0.12 ${hue})`}
                fillOpacity={clusters[c].t.length < maxT / 2 ? 0.95 : 0.55}
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={0.6}
              />
            )
          })}
        </svg>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">max triangles per cluster: {maxT}</span>
            <input
              type="range"
              min={4}
              max={64}
              step={2}
              value={maxT}
              onChange={(e) => setMaxT(+e.target.value)}
              className="w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">vertex cap / triangle cap: {vq.toFixed(2)} (= {maxV} vertices)</span>
            <input
              type="range"
              min={0.3}
              max={1.5}
              step={0.05}
              value={vq}
              onChange={(e) => setVq(+e.target.value)}
              className="w-full"
            />
          </label>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">clusters</dt>
            <dd>{clusters.length}</dd>
            <dt className="text-muted-foreground">mean triangles</dt>
            <dd>{(total / clusters.length).toFixed(1)}</dd>
            <dt className="text-muted-foreground">at a cap</dt>
            <dd>{full}</dd>
            <dt className="text-muted-foreground">under half full</dt>
            <dd>{small}</dd>
            <dt className="text-muted-foreground">vertex loads / tri</dt>
            <dd>{(loads / total).toFixed(2)}</dd>
            <dt className="text-muted-foreground">pad to cap</dt>
            <dd>{(pad * 100).toFixed(0)}%</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Bright, opaque clusters are the leftovers: a cluster grows until its neighbours are taken, so the last
            ones are small and ragged. Three.js pads every cluster to 64 triangles, so those leftovers cost a full
            slot each.
          </p>
        </div>
      </div>
    </figure>
  )
}
