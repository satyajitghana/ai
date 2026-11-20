"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mlog2 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of the paper's Section 3.1. One prompt ("an island at sea") admits four valid
// pictures: day or night, island on the left or the right. Each picture is an 8 x 8 grid of
// codes from a six-entry palette. A model that decides every cell in parallel can do it two
// ways:
//
//   independent   each cell sampled from its own marginal over the four pictures (Eq. 1)
//   shared state  one random state xi picks a picture for everyone, then each cell is sampled
//                 from q_i(c | xi) = lam * [picture_xi(i) = c] + (1 - lam) * marginal_i(c)
//
// lam is "how much the model uses the state": 0 is a model that ignores xi (what the paper
// says direct supervision produces), 1 is a model that follows it fully. Everything printed is
// computed exactly from the four pictures, except the drawn samples, which use a seeded PRNG.

const N = 8
const PALETTE = [
  { id: "sky", day: "#8ecae6", label: "day sky" },
  { id: "night", day: "#1d2b53", label: "night sky" },
  { id: "sun", day: "#ffb703", label: "sun" },
  { id: "moon", day: "#e9ecef", label: "moon" },
  { id: "sea", day: "#219ebc", label: "sea" },
  { id: "land", day: "#6a994e", label: "island" },
]
const [SKY, NIGHT, SUN, MOON, SEA, LAND] = [0, 1, 2, 3, 4, 5]

function picture(night: boolean, islandLeft: boolean): number[] {
  const g: number[] = []
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      let v = night ? NIGHT : SKY
      const bodyC = islandLeft ? 5 : 1 // sun or moon sits opposite the island
      if ((r === 1 || r === 2) && (c === bodyC || c === bodyC + 1)) v = night ? MOON : SUN
      if (r >= 5) v = SEA
      const iC = islandLeft ? 1 : 4
      if (r === 4 && c >= iC && c <= iC + 2) v = LAND
      if (r === 5 && c >= iC - 1 && c <= iC + 3) v = LAND
      g.push(v)
    }
  }
  return g
}

const PICS = [picture(false, true), picture(false, false), picture(true, true), picture(true, false)]
const NAMES = ["day, island left", "day, island right", "night, island left", "night, island right"]
const K = PICS.length
const CELLS = N * N
const P = PALETTE.length

// marginal_i(c): the share of the four pictures with code c at cell i
const MARG: number[][] = Array.from({ length: CELLS }, (_, i) => {
  const m = new Array(P).fill(0)
  for (const pic of PICS) m[pic[i]] += 1 / K
  return m
})

const sumMarginalH = MARG.reduce((s, m) => s + m.reduce((t, p) => (p > 0 ? t - p * mlog2(p) : t), 0), 0)
const jointH = mlog2(K) // four equally likely, distinct pictures
const totalCorrelation = sumMarginalH - jointH

// mulberry32: a deterministic sample, the same on the server and in the browser
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

function q(i: number, c: number, k: number, lam: number) {
  return lam * (PICS[k][i] === c ? 1 : 0) + (1 - lam) * MARG[i][c]
}

function draw(r: () => number, lam: number, shared: boolean) {
  const k = Math.floor(r() * K)
  const cells: number[] = []
  for (let i = 0; i < CELLS; i++) {
    const l = shared ? lam : 0
    let u = r()
    let c = 0
    for (; c < P - 1; c++) {
      u -= q(i, c, k, l)
      if (u < 0) break
    }
    cells.push(c)
  }
  return { k, cells }
}

// P(a draw is exactly one of the four pictures), exact: sum over xi and target picture
function validRate(lam: number) {
  let total = 0
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < K; j++) {
      let lp = 0
      for (let i = 0; i < CELLS; i++) {
        const p = q(i, PICS[j][i], k, lam)
        if (p <= 0) {
          lp = -Infinity
          break
        }
        lp += mlog(p)
      }
      if (lp > -Infinity) total += mexp(lp) / K
    }
  }
  return total
}

// expected cells that disagree with the picture xi chose
function offCells(lam: number) {
  let s = 0
  for (let k = 0; k < K; k++) for (let i = 0; i < CELLS; i++) s += (1 - q(i, PICS[k][i], k, lam)) / K
  return s
}

function fmtP(x: number) {
  if (x >= 0.001) return `${(x * 100).toFixed(1)}%`
  if (x <= 0) return "0"
  const e = Math.floor(mlog(x) / mlog(10))
  return `about 1 in 10^${-e}`
}

export function SharedState() {
  const [shared, setShared] = useState(true)
  const [lamPct, setLamPct] = useState(100)
  const [seed, setSeed] = useState(3)
  const lam = lamPct / 100
  const effLam = shared ? lam : 0

  const draws = useMemo(() => {
    const r = rng(seed * 2654435761)
    return Array.from({ length: 6 }, () => draw(r, lam, shared))
  }, [seed, lam, shared])

  const valid = useMemo(() => validRate(effLam), [effLam])
  const off = useMemo(() => offCells(effLam), [effLam])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>64 parallel choices, one picture?</span>
        <span className="text-muted-foreground/60">toy: 4 valid pictures, 6 codes</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="How the cells are decided">
          {[
            { v: false, l: "independent (Eq. 1)" },
            { v: true, l: "shared random state (Eq. 3)" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => setShared(o.v)}
              aria-pressed={shared === o.v}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                shared === o.v ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="ml-auto rounded-md border px-2.5 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            draw again
          </button>
        </div>

        <label className={cn("block space-y-1", !shared && "opacity-40")}>
          <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>how much the model uses the state</span>
            <span>{shared ? `${lamPct}%` : "n/a"}</span>
          </span>
          <Range min={0} max={100} step={5} value={lamPct} disabled={!shared} onChange={(e) => setLamPct(Number(e.target.value))} aria-label="How much the model uses the shared state" />
        </label>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {draws.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-full max-w-[120px]">
                <svg viewBox="0 0 8 8" className="h-auto w-full rounded-md border" role="img" aria-label={`Draw ${i + 1}`}>
                  {d.cells.map((v, j) => (
                    <rect key={j} x={j % N} y={Math.floor(j / N)} width={1.02} height={1.02} fill={PALETTE[v].day} />
                  ))}
                </svg>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{shared ? `xi: ${NAMES[d.k]}` : `draw ${i + 1}`}</span>
            </div>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">sum of cell entropies</dt>
            <dd className="text-sm">{sumMarginalH.toFixed(1)} bits</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">entropy of the picture</dt>
            <dd className="text-sm">{jointH.toFixed(1)} bits</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">total correlation (Eq. 2 gap)</dt>
            <dd className="text-sm">{totalCorrelation.toFixed(1)} bits</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">draws that are a valid picture</dt>
            <dd className="text-sm">{fmtP(valid)}</dd>
          </div>
        </dl>
        <p className="font-mono text-[11px] text-muted-foreground">
          cells off the chosen picture, on average: {off.toFixed(1)} of 64
        </p>

        <div className="flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {PALETTE.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: p.day }} />
              {p.label}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A toy, not the model: four valid pictures for one prompt, each an 8 x 8 grid of codes. Independent cells match every
        cell&apos;s marginal and almost never land on a real picture; a shared state that the model actually follows makes
        every draw one of the four. Drag the slider toward zero to see a model that has learned to ignore its state.
      </figcaption>
    </figure>
  )
}
