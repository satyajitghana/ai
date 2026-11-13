"use client"

import { useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"

// A 2-D toy of the two quantisers in the article. Nothing here is LiquidCodec's
// or Mimi's real codebook: those are 256-dimensional and learned. The toy keeps
// the arithmetic honest at two dimensions so the picture can be drawn.
//
// RVQ: stage s has 16 entries (4 bits), drawn once from a seeded PRNG, spread
// over a radius that shrinks by 0.42 per stage, the way a trained residual
// codebook covers a smaller and smaller error. Encoding is greedy: nearest
// entry to the current residual, subtract, repeat.
//
// FSQ: each coordinate is bounded to [-1, 1] and rounded to one of L levels,
// independently. Two coordinates, two groups of one dimension each, so a code is
// a pair of level indices and the bits are 2 * log2(L).
//
// "The model picks the runner-up for code 1" swaps the first code for its
// second-nearest choice and shows what happens to the rest. For RVQ there are
// two answers: re-encode the later stages against the new residual (what a
// sequential, one-codebook-at-a-time predictor can do) or keep them as they
// were (what a predictor that guessed every codebook at once is left with).
// For FSQ there is one answer, because group 2's code never depended on group 1.

const ACCENT = "oklch(0.62 0.17 295)"
const ALT = "oklch(0.66 0.15 40)"
const SIZE = 300
const STAGES_MAX = 4
const ENTRIES = 16
const SHRINK = 0.42

type V = [number, number]

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BOOKS: V[][] = (() => {
  const r = rng(20261113)
  const books: V[][] = []
  let scale = 0.95
  for (let s = 0; s < STAGES_MAX; s++) {
    const book: V[] = []
    for (let i = 0; i < ENTRIES; i++) book.push([(r() * 2 - 1) * scale, (r() * 2 - 1) * scale])
    books.push(book)
    scale *= SHRINK
  }
  return books
})()

const dist = (a: V, b: V) => Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]))
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]]
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]]

function ranked(book: V[], target: V) {
  return book.map((c, i) => ({ i, d: dist(c, target) })).sort((x, y) => x.d - y.d)
}

// Greedy RVQ from a given first code; later stages re-encoded against the residual.
function rvqFrom(z: V, stages: number, firstCode: number) {
  const codes = [firstCode]
  let sum: V = BOOKS[0][firstCode]
  const path: V[] = [[0, 0], sum]
  for (let s = 1; s < stages; s++) {
    const k = ranked(BOOKS[s], sub(z, sum))[0].i
    codes.push(k)
    sum = add(sum, BOOKS[s][k])
    path.push(sum)
  }
  return { codes, sum, path }
}

function rvqKeep(firstCode: number, later: number[]) {
  let sum: V = BOOKS[0][firstCode]
  const path: V[] = [[0, 0], sum]
  for (let s = 1; s <= later.length; s++) {
    sum = add(sum, BOOKS[s][later[s - 1]])
    path.push(sum)
  }
  return { sum, path }
}

function fsq(z: V, levels: number) {
  const half = (levels - 1) / 2
  const idx = z.map((x) => Math.round((Math.max(-1, Math.min(1, x)) + 1) * half)) as [number, number]
  const val = idx.map((k) => k / half - 1) as V
  return { idx, val }
}

const toPx = (v: V): V => [((v[0] + 1) / 2) * SIZE, ((1 - v[1]) / 2) * SIZE]
const pts = (p: V[]) => p.map((v) => toPx(v).map((n) => n.toFixed(1)).join(",")).join(" ")
const f3 = (x: number) => x.toFixed(3)

function Plane({
  z,
  onPick,
  label,
  children,
}: {
  z: V
  onPick: (v: V) => void
  label: string
  children: React.ReactNode
}) {
  const ref = useRef<SVGSVGElement | null>(null)
  const drag = useRef(false)
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const x = ((e.clientX - box.left) / box.width) * 2 - 1
    const y = 1 - ((e.clientY - box.top) / box.height) * 2
    onPick([Math.max(-0.98, Math.min(0.98, x)), Math.max(-0.98, Math.min(0.98, y))])
  }
  const [zx, zy] = toPx(z)
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full touch-none select-none rounded-md border bg-muted/10"
      role="img"
      aria-label={label}
      onPointerDown={(e) => {
        drag.current = true
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        pick(e)
      }}
      onPointerMove={(e) => drag.current && pick(e)}
      onPointerUp={() => (drag.current = false)}
    >
      <line x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE} stroke="currentColor" strokeOpacity={0.08} />
      <line x1={0} y1={SIZE / 2} x2={SIZE} y2={SIZE / 2} stroke="currentColor" strokeOpacity={0.08} />
      {children}
      <circle cx={zx} cy={zy} r={6} fill="none" stroke="currentColor" strokeWidth={2} />
      <text x={zx + 9} y={zy - 8} className="fill-current font-mono" fontSize={12}>
        z
      </text>
    </svg>
  )
}

export function QuantizerLab() {
  const [z, setZ] = useState<V>([0.37, -0.52])
  const [stages, setStages] = useState(3)
  const [levels, setLevels] = useState(8)
  const [wrong, setWrong] = useState(false)

  const r = useMemo(() => {
    const first = ranked(BOOKS[0], z)
    const good = rvqFrom(z, stages, first[0].i)
    const runner = first[1].i
    const reEnc = rvqFrom(z, stages, runner)
    const kept = rvqKeep(runner, good.codes.slice(1))
    const stageErr: number[] = []
    for (let s = 1; s < good.path.length; s++) stageErr.push(dist(z, good.path[s]))
    const q = fsq(z, levels)
    const shifted = q.idx[0] + (q.idx[0] < levels - 1 ? 1 : -1)
    const half = (levels - 1) / 2
    const badVal: V = [shifted / half - 1, q.val[1]]
    return { good, reEnc, kept, stageErr, q, badVal, shifted }
  }, [z, stages, levels])

  const rvqBits = stages * 4
  const fsqBits = 2 * mlog2(levels)
  const zClamp: V = [Math.max(-1, Math.min(1, z[0])), Math.max(-1, Math.min(1, z[1]))]
  const fsqErr = dist(zClamp, wrong ? r.badVal : r.q.val)

  const gridLines: number[] = []
  for (let k = 0; k < levels; k++) gridLines.push((k / (levels - 1)) * SIZE)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">two ways to turn a vector into integers</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy codebooks, 2 dimensions; drag z</span>
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
            <span style={{ color: ACCENT }}>RVQ: {stages} codebooks x 16</span>
            <span className="text-muted-foreground">{rvqBits} bits</span>
          </div>
          <Plane z={z} onPick={setZ} label="Residual vector quantisation of the point z">
            {BOOKS[0].map((c, i) => {
              const [x, y] = toPx(c)
              return <circle key={i} cx={x} cy={y} r={2.2} fill="currentColor" fillOpacity={0.25} />
            })}
            <polyline points={pts(r.good.path)} fill="none" stroke={ACCENT} strokeWidth={2} />
            {r.good.path.slice(1).map((v, i) => {
              const [x, y] = toPx(v)
              return <circle key={i} cx={x} cy={y} r={3.2} fill={ACCENT} />
            })}
            {wrong && (
              <>
                <polyline points={pts(r.kept.path)} fill="none" stroke={ALT} strokeWidth={1.6} strokeDasharray="4 3" />
                <polyline points={pts(r.reEnc.path)} fill="none" stroke={ALT} strokeWidth={1.6} />
                <circle cx={toPx(r.kept.sum)[0]} cy={toPx(r.kept.sum)[1]} r={4} fill="none" stroke={ALT} strokeWidth={1.6} />
                <circle cx={toPx(r.reEnc.sum)[0]} cy={toPx(r.reEnc.sum)[1]} r={3.4} fill={ALT} />
              </>
            )}
          </Plane>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            {r.stageErr.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 text-muted-foreground">after {i + 1}</span>
                <div className="h-1.5 flex-1 rounded-sm bg-muted/30">
                  <div className="h-full rounded-sm" style={{ width: `${Math.min(100, (e / 0.8) * 100)}%`, background: ACCENT }} />
                </div>
                <span className="w-14 text-right">{f3(e)}</span>
              </div>
            ))}
            {wrong && (
              <>
                <div className="flex justify-between" style={{ color: ALT }}>
                  <span>code 1 wrong, rest re-picked</span>
                  <span>{f3(dist(z, r.reEnc.sum))}</span>
                </div>
                <div className="flex justify-between" style={{ color: ALT }}>
                  <span>code 1 wrong, rest kept</span>
                  <span>{f3(dist(z, r.kept.sum))}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
            <span style={{ color: ACCENT }}>FSQ: 2 groups x {levels} levels</span>
            <span className="text-muted-foreground">{fsqBits.toFixed(1)} bits</span>
          </div>
          <Plane z={z} onPick={setZ} label="Finite scalar quantisation of the point z">
            {gridLines.map((g, i) => (
              <g key={i}>
                <line x1={g} y1={0} x2={g} y2={SIZE} stroke="currentColor" strokeOpacity={0.12} />
                <line x1={0} y1={g} x2={SIZE} y2={g} stroke="currentColor" strokeOpacity={0.12} />
              </g>
            ))}
            <circle cx={toPx(r.q.val)[0]} cy={toPx(r.q.val)[1]} r={4} fill={ACCENT} />
            {wrong && <circle cx={toPx(r.badVal)[0]} cy={toPx(r.badVal)[1]} r={4} fill={ALT} />}
          </Plane>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">codes (group 1, group 2)</span>
              <span>
                {wrong ? r.shifted : r.q.idx[0]}, {r.q.idx[1]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">error</span>
              <span style={wrong ? { color: ALT } : undefined}>{f3(fsqErr)}</span>
            </div>
            <div className="text-[10px] leading-4 text-muted-foreground">
              {wrong
                ? "Group 1 is off by one level. Group 2's code is the same as before and still right."
                : "Each coordinate is rounded on its own. No code depends on another."}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-3">
        <label className="block font-mono text-[11px] text-muted-foreground">
          <span className="flex justify-between">
            <span>RVQ codebooks</span>
            <span className="text-foreground">{stages}</span>
          </span>
          <Range min={1} max={STAGES_MAX} step={1} value={stages} accent={ACCENT} onChange={(e) => setStages(Number(e.target.value))} aria-label="number of RVQ codebooks" className="mt-1 w-full" />
        </label>
        <label className="block font-mono text-[11px] text-muted-foreground">
          <span className="flex justify-between">
            <span>FSQ levels per group</span>
            <span className="text-foreground">{levels}</span>
          </span>
          <Range min={3} max={16} step={1} value={levels} accent={ACCENT} onChange={(e) => setLevels(Number(e.target.value))} aria-label="FSQ levels per dimension" className="mt-1 w-full" />
        </label>
        <button
          type="button"
          onClick={() => setWrong((w) => !w)}
          aria-pressed={wrong}
          className={`self-end rounded-md border px-3 py-1.5 font-mono text-[11px] ${wrong ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          the model picks the runner-up for code 1
        </button>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        A toy at two dimensions with fixed, seeded codebooks, not either codec&apos;s learned ones. Left: each RVQ stage picks the
        nearest of 16 entries to what the previous stages left over, so the error shrinks stage by stage and the bits add 4 at a
        time. Press the button and the first code becomes its runner-up: the solid orange path re-picks the later codes for the
        new residual, the dashed one keeps the codes that were right for the old one. Right: FSQ rounds each coordinate to a grid
        on its own, and a wrong code for one group moves the point along one axis only.
      </figcaption>
    </figure>
  )
}
