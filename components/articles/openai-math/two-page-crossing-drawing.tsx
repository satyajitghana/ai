"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Two-page drawings of K_n, and the Harary–Hill number they cannot beat.
//
// Construction (family 165, "The crossing number of complete graphs", Section 5,
// after de Klerk–Pasechnik–Salazar): vertices 0..n-1 on a horizontal spine,
// m = floor(n/2). Edge ij goes on the top page when (i + j) mod n < m, otherwise on
// the bottom page; every edge is a semicircle. Two edges cross exactly when they
// share a page and their endpoints alternate along the spine (paper, Section 5), so
// the count below is pure integer arithmetic. The paper proves this drawing has
// exactly Z(n) crossings, and (the new part) that no drawing of any kind has fewer.
//
// Clicking an edge moves it to the other page. "Descend" flips single edges while
// that lowers the count. A two-page drawing can never go below Z(n) (Ábrego et al.
// proved that for two-page drawings); the release's theorem is that no drawing at
// all can, whatever its shape.

const TOP = "oklch(0.55 0.16 255)"
const BOTTOM = "oklch(0.66 0.15 55)"
const HOT = "oklch(0.60 0.20 25)"

const W = 640
const H = 320
const PAD = 34
const SPINE = H / 2

type Edge = { a: number; b: number }

function edgesOf(n: number): Edge[] {
  const out: Edge[] = []
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) out.push({ a, b })
  return out
}

function construction(n: number, edges: Edge[]): boolean[] {
  const m = Math.floor(n / 2)
  return edges.map(({ a, b }) => (a + b) % n < m)
}

// Z(n) = 1/4 · ⌊n/2⌋⌊(n−1)/2⌋⌊(n−2)/2⌋⌊(n−3)/2⌋
function hararyHill(n: number): number {
  const f = (k: number) => Math.floor(k / 2)
  return (f(n) * f(n - 1) * f(n - 2) * f(n - 3)) / 4
}

function cross(e: Edge, f: Edge): boolean {
  return (e.a < f.a && f.a < e.b && e.b < f.b) || (f.a < e.a && e.a < f.b && f.b < e.b)
}

function countCrossings(edges: Edge[], top: boolean[]): number {
  let c = 0
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++)
      if (top[i] === top[j] && cross(edges[i], edges[j])) c++
  return c
}

// Deterministic generator so "Shuffle" never depends on Math.random during render.
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// Pre-release exact values: n <= 12 (Pan–Richter), 13 and 14 (Aichholzer, computer-assisted).
const KNOWN_MAX = 14

export function TwoPageCrossingDrawing() {
  const [n, setN] = useState(7)
  const edges = useMemo(() => edgesOf(n), [n])
  const [top, setTop] = useState<boolean[]>(() => construction(7, edgesOf(7)))
  const [sel, setSel] = useState<number | null>(null)
  const [seed, setSeed] = useState(1)

  const setOrder = (k: number) => {
    setN(k)
    setTop(construction(k, edgesOf(k)))
    setSel(null)
  }

  const count = useMemo(() => countCrossings(edges, top), [edges, top])
  const z = hararyHill(n)

  const flip = (i: number) => {
    setTop((t) => t.map((v, j) => (j === i ? !v : v)))
    setSel(i)
  }

  const shuffle = () => {
    const r = lcg(seed * 7919 + n)
    setTop(edges.map(() => r() < 0.5))
    setSeed((s) => s + 1)
    setSel(null)
  }

  const descend = () => {
    const t = top.slice()
    let cur = countCrossings(edges, t)
    let improved = true
    while (improved) {
      improved = false
      for (let i = 0; i < t.length; i++) {
        t[i] = !t[i]
        const c = countCrossings(edges, t)
        if (c < cur) {
          cur = c
          improved = true
        } else t[i] = !t[i]
      }
    }
    setTop(t)
    setSel(null)
  }

  const x = (v: number) => PAD + (v * (W - 2 * PAD)) / (n - 1)

  const crossesSel = (i: number) =>
    sel !== null && i !== sel && top[i] === top[sel] && cross(edges[i], edges[sel])

  const path = (e: Edge, up: boolean) => {
    const x1 = x(e.a)
    const x2 = x(e.b)
    const r = (x2 - x1) / 2
    // sweep 1 bends the arc upward (screen y decreasing) when drawn left to right
    return `M ${x1.toFixed(2)} ${SPINE} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${up ? 1 : 0} ${x2.toFixed(2)} ${SPINE}`
  }

  const scale = (SPINE - 8) / ((W - 2 * PAD) / 2)

  return (
    <figure className="my-8 rounded-xl border border-border bg-card p-4 not-prose">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">vertices n</span>
          <input
            type="range"
            min={5}
            max={17}
            value={n}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="hg-range w-36"
            aria-label="number of vertices"
          />
          <span className="w-6 font-mono tabular-nums">{n}</span>
        </label>
        <button
          type="button"
          onClick={() => setOrder(n)}
          className="rounded-md border border-border px-2 py-1 hover:bg-muted"
        >
          Paper&apos;s construction
        </button>
        <button
          type="button"
          onClick={shuffle}
          className="rounded-md border border-border px-2 py-1 hover:bg-muted"
        >
          Random pages
        </button>
        <button
          type="button"
          onClick={descend}
          className="rounded-md border border-border px-2 py-1 hover:bg-muted"
        >
          Descend
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Two-page drawing of K${n} with ${count} crossings; the Harary-Hill number is ${z}`}
      >
        <g transform={`translate(0 ${SPINE}) scale(1 ${scale.toFixed(4)}) translate(0 ${-SPINE})`}>
          {edges.map((e, i) => {
            const hot = crossesSel(i)
            const isSel = sel === i
            return (
              <g key={`${n}-${e.a}-${e.b}`}>
                <path
                  d={path(e, top[i])}
                  fill="none"
                  stroke={isSel ? HOT : hot ? HOT : top[i] ? TOP : BOTTOM}
                  strokeOpacity={sel === null || isSel || hot ? 0.9 : 0.35}
                  strokeWidth={isSel ? 2.6 : hot ? 2 : 1.3}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={path(e, top[i])}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                  onClick={() => flip(i)}
                >
                  <title>{`edge ${e.a}–${e.b}: click to move it to the ${top[i] ? "bottom" : "top"} page`}</title>
                </path>
              </g>
            )
          })}
        </g>
        <line x1={PAD - 12} x2={W - PAD + 12} y1={SPINE} y2={SPINE} stroke="currentColor" strokeOpacity={0.35} />
        {Array.from({ length: n }, (_, v) => (
          <g key={v}>
            <circle cx={x(v)} cy={SPINE} r={3.5} fill="currentColor" />
            <text x={x(v) + 5} y={SPINE + 14} fontSize={11} fill="currentColor" opacity={0.7}>
              {v}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-muted/50 p-2">
          <div className="text-muted-foreground">crossings in this drawing</div>
          <div
            className={cn(
              "font-mono text-xl tabular-nums",
              count === z ? "text-emerald-600 dark:text-emerald-400" : "",
            )}
          >
            {count}
          </div>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <div className="text-muted-foreground">Harary–Hill Z(n)</div>
          <div className="font-mono text-xl tabular-nums">{z}</div>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <div className="text-muted-foreground">exact value known before the release?</div>
          <div className="text-base">
            {n <= KNOWN_MAX ? "yes, by computer for n ≤ 14" : "no"}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Top-page edges are blue, bottom-page edges orange. Click an edge to move it to the other
        page; the edges it now crosses light up. The construction puts edge ij on top when
        (i+j) mod n is below ⌊n/2⌋, and lands exactly on Z(n). Random pages followed by
        Descend usually stalls above Z(n), and never goes below it: that floor was already
        proved for two-page drawings. The release&apos;s theorem says the same floor holds for
        every drawing in the plane.
      </figcaption>
    </figure>
  )
}
