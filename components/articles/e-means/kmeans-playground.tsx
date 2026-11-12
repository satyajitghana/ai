"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { type Pt, initCentroids, labels, makeData, recipe, runEmeans, runLloyd } from "./sim"

// Lloyd vs e-means on the same 2-D data from the same random start. Everything is
// computed by ./sim.ts (Algorithm 1 of arXiv 2611.09501, written from the paper and
// the FAISS reference), from a seeded PRNG, so the server render and the browser
// agree. The batch and step come from the shipped FAISS laws (quality law, which the
// library picks for d <= 16). It is an illustration of the update rule at n = 1,600,
// far below the laws' fitted range (n >= 1e5), not a reproduction of the paper.

const N = 1600
const G = 12
const K = 24
const SEEDS = 40
const LLOYD_ITERS = 25
const TS = [1, 2, 3, 5] as const

const EM = "oklch(0.62 0.16 250)"
const LL = "oklch(0.62 0.17 25)"

const hue = (j: number) => (j * 137.5) % 360
const fmt = (v: number) => (v * 1000).toFixed(3)

// chart geometry
const CW = 600
const CH = 190
const PX0 = 56
const PX1 = 584
const PY0 = 14
const PY1 = 156
const X_MIN = 0.25
const X_MAX = 25
const LX0 = mlog10(X_MIN)
const LX1 = mlog10(X_MAX)
const cx = (e: number) => PX0 + ((mlog10(Math.max(X_MIN, e)) - LX0) / (LX1 - LX0)) * (PX1 - PX0)

function Panel({ title, color, X, C, note }: { title: string; color: string; X: Pt[]; C: Pt[]; note: string }) {
  const lab = useMemo(() => labels(X, C), [X, C])
  const counts = useMemo(() => {
    const c = new Array(C.length).fill(0)
    for (const l of lab) c[l]++
    return c
  }, [lab, C.length])
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-baseline justify-between font-mono text-[10px]">
        <span style={{ color }} className="font-semibold">
          {title}
        </span>
        <span className="text-muted-foreground">{note}</span>
      </div>
      <svg viewBox="0 0 300 300" className="w-full rounded-md border bg-background" role="img" aria-label={`${title}: ${K} centroids over ${N} points`}>
        {X.map((p, i) => (
          <circle
            key={i}
            cx={(p[0] * 292 + 4).toFixed(2)}
            cy={(300 - (p[1] * 292 + 4)).toFixed(2)}
            r={1.7}
            fill={`oklch(0.72 0.12 ${hue(lab[i])})`}
            opacity={0.75}
          />
        ))}
        {C.map((c, j) => {
          const x = c[0] * 292 + 4
          const y = 300 - (c[1] * 292 + 4)
          const empty = counts[j] === 0
          return (
            <g key={j}>
              <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r={5.2} fill="var(--background, #fff)" stroke={empty ? "currentColor" : `oklch(0.45 0.14 ${hue(j)})`} strokeWidth={2} />
              <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r={1.6} fill={`oklch(0.45 0.14 ${hue(j)})`} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function KmeansPlayground() {
  const [seed, setSeed] = useState(27)
  const [T, setT] = useState<(typeof TS)[number]>(3)
  const [revival, setRevival] = useState(true)
  const [epoch, setEpoch] = useState(25)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const X = useMemo(() => makeData(seed, N, G), [seed])
  const C0 = useMemo(() => initCentroids(X, K, seed), [X, seed])
  const lloyd = useMemo(() => runLloyd(X, C0, LLOYD_ITERS), [X, C0])
  const rec = useMemo(() => recipe(N, K, T, "quality"), [T])
  const em = useMemo(
    () => runEmeans(X, C0, { epochs: T, B: rec.B, alpha0: rec.alpha0, revival, seed, framesPerEpoch: 4 }),
    [X, C0, T, rec, revival, seed],
  )

  useEffect(() => {
    if (!playing) return
    timer.current = setInterval(() => {
      setEpoch((e) => {
        if (e >= 25) {
          setPlaying(false)
          return 25
        }
        return e < 5 ? Math.round((e + 0.25) * 4) / 4 : Math.min(25, e + 1)
      })
    }, 260)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing])

  const lFrame = lloyd[Math.min(LLOYD_ITERS, Math.floor(epoch))]
  const emDone = epoch >= T
  const emFrame = em.frames.reduce((best, f) => (f.epoch <= epoch + 1e-9 ? f : best), em.frames[0])
  const emC = emDone ? em.final : emFrame.C
  const emMse = emDone ? em.finalMse : emFrame.mse
  const l25 = lloyd[LLOYD_ITERS].mse
  const cross = em.frames.find((f) => f.epoch > 0 && f.mse < l25)
  const ratio = em.finalMse / l25

  // chart scales
  const all = [...lloyd.slice(1).map((f) => f.mse), ...em.frames.slice(1).map((f) => f.mse), em.finalMse]
  const yMax = Math.max(...all)
  const yMin = Math.min(...all)
  const pad = (yMax - yMin) * 0.08 || 1e-4
  const cy = (v: number) => PY1 - ((v - (yMin - pad)) / (yMax - yMin + 2 * pad)) * (PY1 - PY0)
  const lPath = lloyd
    .slice(1)
    .map((f, i) => `${i ? "L" : "M"}${cx(f.epoch).toFixed(2)},${cy(f.mse).toFixed(2)}`)
    .join(" ")
  const ePts = em.frames.filter((f) => f.epoch >= X_MIN)
  const ePath = ePts.map((f, i) => `${i ? "L" : "M"}${cx(f.epoch).toFixed(2)},${cy(f.mse).toFixed(2)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Lloyd vs e-means · same data, same start</span>
        <span className="text-muted-foreground/50">toy, computed in your browser</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">seed</span>
            <button type="button" aria-label="previous seed" onClick={() => setSeed((s) => (s === 1 ? SEEDS : s - 1))} className="cursor-pointer rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground">
              ‹
            </button>
            <span className="w-6 text-center text-foreground">{seed}</span>
            <button type="button" aria-label="next seed" onClick={() => setSeed((s) => (s === SEEDS ? 1 : s + 1))} className="cursor-pointer rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground">
              ›
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">e-means epochs T</span>
            {TS.map((t) => (
              <button key={t} type="button" onClick={() => setT(t)} aria-pressed={T === t} className={cn("cursor-pointer rounded-md border px-2 py-1 transition-colors", T === t ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setRevival((r) => !r)} aria-pressed={revival} className={cn("cursor-pointer rounded-md border px-2 py-1 transition-colors", revival ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
            revival {revival ? "on" : "off"}
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Panel title={`Lloyd · iteration ${Math.floor(epoch)}`} color={LL} X={X} C={lFrame.C} note={`MSE ${fmt(lFrame.mse)}e-3`} />
          <Panel
            title={emDone ? `e-means · finished (${T} ep)` : `e-means · epoch ${epoch.toFixed(2)}`}
            color={EM}
            X={X}
            C={emC}
            note={`MSE ${fmt(emMse)}e-3`}
          />
        </div>

        <div className="mt-3 flex items-center gap-3 font-mono text-[10px]">
          <button type="button" onClick={() => { if (epoch >= 25) setEpoch(0); setPlaying((p) => !p) }} className="cursor-pointer rounded-md border px-2 py-1 text-foreground">
            {playing ? "pause" : "play"}
          </button>
          <span className="w-16 text-muted-foreground">epoch {epoch.toFixed(2)}</span>
          <Range min={0} max={25} step={0.25} value={epoch} onChange={(e) => { setPlaying(false); setEpoch(Number(e.target.value)) }} className="flex-1" aria-label="epoch" />
        </div>

        <svg viewBox={`0 0 ${CW} ${CH}`} className="mt-3 w-full" role="img" aria-label="Training MSE against epochs, log scale">
          {[0.25, 0.5, 1, 2, 3, 5, 10, 25].map((e) => (
            <g key={e}>
              <line x1={cx(e)} x2={cx(e)} y1={PY0} y2={PY1} stroke="currentColor" opacity={0.08} />
              <text x={cx(e)} y={PY1 + 13} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
                {e}
              </text>
            </g>
          ))}
          <text x={(PX0 + PX1) / 2} y={CH - 4} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
            epochs (log scale)
          </text>
          <text x={10} y={(PY0 + PY1) / 2} fontSize={9} className="fill-muted-foreground font-mono" transform={`rotate(-90 10 ${(PY0 + PY1) / 2})`} textAnchor="middle">
            train MSE
          </text>
          <line x1={PX0} x2={PX1} y1={cy(l25)} y2={cy(l25)} stroke={LL} strokeDasharray="4 3" opacity={0.7} />
          <text x={PX1} y={cy(l25) - 4} textAnchor="end" fontSize={9} fill={LL} className="font-mono">
            Lloyd@25
          </text>
          <path d={lPath} fill="none" stroke={LL} strokeWidth={2} />
          {lloyd.slice(1).map((f) => (
            <circle key={f.epoch} cx={cx(f.epoch)} cy={cy(f.mse)} r={2} fill={LL} />
          ))}
          <path d={ePath} fill="none" stroke={EM} strokeWidth={2} />
          {ePts.map((f) => (
            <circle key={f.epoch} cx={cx(f.epoch)} cy={cy(f.mse)} r={2} fill={EM} />
          ))}
          <circle cx={cx(T)} cy={cy(em.finalMse)} r={4.5} fill="none" stroke={EM} strokeWidth={2} />
          <line x1={cx(Math.max(X_MIN, epoch))} x2={cx(Math.max(X_MIN, epoch))} y1={PY0} y2={PY1} stroke="currentColor" opacity={0.35} />
        </svg>

        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">recipe (quality law)</dt>
            <dd>
              B = {rec.B}, α₀ = {rec.alpha0.toFixed(3)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">centroid updates</dt>
            <dd>
              Lloyd 25 · e-means {rec.steps}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">e-means final ÷ Lloyd@25</dt>
            <dd style={{ color: ratio < 1 ? EM : LL }}>{ratio.toFixed(3)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">first below Lloyd@25 · splits</dt>
            <dd>
              {cross ? `epoch ${cross.epoch.toFixed(2)}` : "never (in flight)"} · {em.revivals}
            </dd>
          </div>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        1,600 points from {G} Gaussian blobs of unequal size, k = {K}, both
        methods starting from the same {K} random data points. Lloyd runs 25 full-batch iterations;
        e-means runs T epochs of mini-batches with the cosine-annealed EMA step and, when on,
        dead-cluster revival by splitting, then takes the last-epoch mean (the ringed point). The curve
        is training MSE with the centroids in flight, not the paper&apos;s held-out test MSE. Over seeds
        1 to 40 at T = 3, e-means ends below Lloyd@25 on 28; seeds 23 and 39 are its worst.
      </figcaption>
    </figure>
  )
}
