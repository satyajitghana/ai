"use client"

import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// A Monte Carlo check of the finite "gluing" inequality at the heart of the
// critical-percolation papers in openai/math (family 213):
//
//   P(o <-> A, o <-> T)  >=  P(o <-> A) * min_{a in A} P(a <-> T)
//
// (Critical bond and site percolation on the cubic lattice, eq. (1.1); the
// quasi-transitive paper calls it the joint gluing inequality, Theorem 6.1.)
// Here the graph is a small W x H piece of the square lattice with bond
// percolation at parameter p. o is the middle vertex of the left column, A is a
// whole column (the "relay"), T is the right column (the "target"). Every path
// from o to T crosses A, so the left side is simply P(o <-> T).
//
// Everything random runs only in the browser after mount, from a fixed seed, so
// server and client render the same empty state and the numbers are repeatable.

const W = 21
const H = 13
const N = W * H
const O = Math.floor(H / 2) * W // (0, mid)

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Edges: horizontal (x,y)-(x+1,y) then vertical (x,y)-(x,y+1).
const EDGES: [number, number][] = (() => {
  const e: [number, number][] = []
  for (let y = 0; y < H; y++) for (let x = 0; x + 1 < W; x++) e.push([y * W + x, y * W + x + 1])
  for (let y = 0; y + 1 < H; y++) for (let x = 0; x < W; x++) e.push([y * W + x, (y + 1) * W + x])
  return e
})()

function find(par: Int32Array, i: number): number {
  while (par[i] !== i) {
    par[i] = par[par[i]]
    i = par[i]
  }
  return i
}

type Result = {
  samples: number
  pOA: number
  pOT: number
  perA: number[] // P(a <-> T) for each row of the relay column
  minA: number
  argminRow: number
  sample: { open: boolean[]; inO: boolean[] }
}

function simulate(p: number, ax: number, samples: number, seed: number): Result {
  const rnd = mulberry32(seed)
  const par = new Int32Array(N)
  let cOA = 0
  let cOT = 0
  const cA = new Array<number>(H).fill(0)
  let sample: Result["sample"] = { open: [], inO: [] }
  const tRoots = new Set<number>()
  for (let s = 0; s < samples; s++) {
    for (let i = 0; i < N; i++) par[i] = i
    const open = new Array<boolean>(EDGES.length)
    for (let k = 0; k < EDGES.length; k++) {
      const isOpen = rnd() < p
      open[k] = isOpen
      if (isOpen) {
        const ra = find(par, EDGES[k][0])
        const rb = find(par, EDGES[k][1])
        if (ra !== rb) par[ra] = rb
      }
    }
    tRoots.clear()
    for (let y = 0; y < H; y++) tRoots.add(find(par, y * W + W - 1))
    const ro = find(par, O)
    let oA = false
    for (let y = 0; y < H; y++) {
      const ra = find(par, y * W + ax)
      if (ra === ro) oA = true
      if (tRoots.has(ra)) cA[y]++
    }
    if (oA) cOA++
    if (tRoots.has(ro)) cOT++
    if (s === 0) {
      const inO = new Array<boolean>(N)
      for (let i = 0; i < N; i++) inO[i] = find(par, i) === ro
      sample = { open, inO }
    }
  }
  const perA = cA.map((c) => c / samples)
  let minA = 1
  let argminRow = 0
  perA.forEach((v, y) => {
    if (v < minA) {
      minA = v
      argminRow = y
    }
  })
  return { samples, pOA: cOA / samples, pOT: cOT / samples, perA, minA, argminRow, sample }
}

const cell = 16
const pad = 10
const svgW = (W - 1) * cell + 2 * pad
const svgH = (H - 1) * cell + 2 * pad
const pos = (i: number) => [pad + (i % W) * cell, pad + Math.floor(i / W) * cell] as const

const fmt = (x: number) => x.toFixed(3)
const se = (q: number, n: number) => 2 * Math.sqrt((q * (1 - q)) / n)

function Bar({ label, value, err, tone }: { label: string; value: number; err?: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-44 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-3 flex-1 rounded bg-muted">
        <div className={cn("absolute inset-y-0 left-0 rounded", tone)} style={{ width: `${(value * 100).toFixed(2)}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right font-mono tabular-nums">
        {fmt(value)}
        {err !== undefined ? <span className="text-muted-foreground"> ±{err.toFixed(3)}</span> : null}
      </span>
    </div>
  )
}

export function GluingRelay() {
  const [p, setP] = useState(0.5)
  const [ax, setAx] = useState(10)
  const [seed, setSeed] = useState(1)
  const [res, setRes] = useState<Result | null>(null)
  const samples = 800

  useEffect(() => {
    const id = setTimeout(() => setRes(simulate(p, ax, samples, seed)), 60)
    return () => clearTimeout(id)
  }, [p, ax, seed])

  const rhs = res ? res.pOA * res.minA : 0

  const grid = useMemo(() => {
    if (!res) return null
    const { open, inO } = res.sample
    return EDGES.map(([a, b], k) => {
      if (!open[k]) return null
      const [x1, y1] = pos(a)
      const [x2, y2] = pos(b)
      return (
        <line
          key={k}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          strokeWidth={inO[a] ? 2.4 : 1.2}
          className={inO[a] ? "stroke-sky-600 dark:stroke-sky-400" : "stroke-muted-foreground/40"}
        />
      )
    })
  }, [res])

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            edge probability p = <span className="font-mono">{p.toFixed(2)}</span> (the square lattice&apos;s p_c is 1/2)
          </span>
          <input type="range" min={0.4} max={0.65} step={0.01} value={p} onChange={(e) => setP(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            relay column A at x = <span className="font-mono">{ax}</span> (o at x = 0, target T at x = {W - 1})
          </span>
          <input type="range" min={2} max={W - 3} step={1} value={ax} onChange={(e) => setAx(Number(e.target.value))} />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto block w-full max-w-xl" role="img" aria-label="One sampled bond configuration; the cluster of o is highlighted, the relay column and target column are marked.">
          <rect x={pad + ax * cell - 5} y={pad - 6} width={10} height={(H - 1) * cell + 12} rx={4} className="fill-amber-500/20" />
          <rect x={pad + (W - 1) * cell - 5} y={pad - 6} width={10} height={(H - 1) * cell + 12} rx={4} className="fill-emerald-500/20" />
          {grid}
          {res ? (
            <circle cx={pad + ax * cell} cy={pad + res.argminRow * cell} r={4.5} className="fill-none stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} />
          ) : null}
          <circle cx={pad} cy={pad + Math.floor(H / 2) * cell} r={4.5} className="fill-sky-600 dark:fill-sky-400" />
          <text x={pad + 6} y={pad + Math.floor(H / 2) * cell - 6} className="fill-foreground text-[9px]">o</text>
          <text x={pad + ax * cell + 6} y={pad + 4} className="fill-foreground text-[9px]">A</text>
          <text x={pad + (W - 1) * cell - 14} y={pad + 4} className="fill-foreground text-[9px]">T</text>
        </svg>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {res ? (
          <>
            <Bar label="P(o ↔ A)" value={res.pOA} err={se(res.pOA, samples)} tone="bg-sky-500/60" />
            <Bar label="min over a in A of P(a ↔ T)" value={res.minA} err={se(res.minA, samples)} tone="bg-amber-500/60" />
            <Bar label="left side: P(o ↔ A, o ↔ T)" value={res.pOT} err={se(res.pOT, samples)} tone="bg-emerald-600/70" />
            <Bar label="right side: product" value={rhs} tone="bg-zinc-500/60" />
            <p className="mt-1 text-xs text-muted-foreground">
              {res.pOT >= rhs
                ? `Left side exceeds the product by ${fmt(res.pOT - rhs)} over ${samples} samples.`
                : `Left side is below the product by ${fmt(rhs - res.pOT)}, inside Monte Carlo error; resample.`}{" "}
              The ringed vertex is the relay point least likely to reach T (row {res.argminRow}).
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sampling {samples} configurations…</p>
        )}
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="mt-1 self-start rounded-full border border-border px-3 py-0.5 text-xs text-muted-foreground hover:bg-foreground/5"
        >
          resample
        </button>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        The finite gluing inequality checked by simulation on a 21 by 13 piece of the square lattice: reaching a relay
        set whose every point connects onward with probability at least m lets you continue with conditional
        probability at least m. Shown: one sampled configuration with the cluster of o in blue, and estimates from
        800 samples with two-standard-error bars. The papers prove the inequality on every finite graph; the
        simulation only illustrates it.
      </figcaption>
    </figure>
  )
}
