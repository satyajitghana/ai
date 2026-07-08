"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Quantize-then-refine — the other half of a fast ANN search. The graph walk
// (see NavGraph) decides *which* vectors to score; quantization decides how
// *cheap* each score is. Compress every vector so distances are computed on
// small codes, shortlist the top candidates by that approximate distance, then
// re-rank the shortlist with the exact vectors. That last step is zvec's
// `refinement` flag, and it is what lets aggressive 1-bit codes keep high recall.
//
// Toy 2D instance (M=12 points), fully deterministic from a fixed seed — the
// first (server) render is pure, no timers, no randomness at render time.
// Distances and rankings are recomputed with bounded loops on every toggle.

const ACC = "oklch(0.70 0.15 235)" // zvec blue — our pipeline
const TRUE = "oklch(0.74 0.16 55)" // amber — the ground-truth neighbours
const GOOD = "oklch(0.62 0.14 150)" // green — correctly retrieved
const MISS = "oklch(0.60 0.19 25)" // red — a miss / false positive

const S = 256
const C = S / 2
const PAD = 28
const M = 12
const SEED = 12
const QUERY: [number, number] = [C + 40, C - 30] // [168, 98]
const SHORT = 5 // shortlist size (coarse pass)
const FINAL = 3 // returned top-k

type Mode = "fp32" | "int8" | "1bit"
const MODES: { id: Mode; label: string; bytes: string; op: string; note: string }[] = [
  { id: "fp32", label: "fp32", bytes: "3072 B", op: "float dot", note: "exact — the baseline" },
  { id: "int8", label: "int8 (SQ)", bytes: "768 B", op: "int8 dot", note: "4× smaller, tiny error" },
  { id: "1bit", label: "1-bit (RaBitQ)", bytes: "96 B", op: "popcount", note: "32× smaller, coarse" },
]

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
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

function buildPoints(): Pt[] {
  const rnd = mulberry32(SEED)
  const pts: Pt[] = []
  for (let i = 0; i < M; i++) {
    pts.push([PAD + rnd() * (S - 2 * PAD), PAD + rnd() * (S - 2 * PAD)])
  }
  return pts
}

// The quantized *reconstruction* of a point — what its stored code decodes to.
function quantize(p: Pt, mode: Mode): Pt {
  if (mode === "fp32") return p
  if (mode === "int8") {
    const st = 8
    return [Math.round(p[0] / st) * st, Math.round(p[1] / st) * st]
  }
  // 1 bit per dimension: sign relative to the centre → a quadrant centroid
  return [p[0] < C ? C - 64 : C + 64, p[1] < C ? C - 64 : C + 64]
}

export function QuantizeRerank() {
  const [mode, setMode] = useState<Mode>("1bit")
  const [refine, setRefine] = useState(true)

  const m = useMemo(() => {
    const pts = buildPoints()
    const exact = pts.map((p, i) => ({ i, d: dist(QUERY, p) }))
    const approx = pts.map((p, i) => ({ i, d: dist(QUERY, quantize(p, mode)) }))
    const byApprox = [...approx].sort((a, b) => a.d - b.d)
    const shortlist = byApprox.slice(0, SHORT).map((o) => o.i)
    const trueTop = [...exact].sort((a, b) => a.d - b.d).slice(0, FINAL).map((o) => o.i)
    let result: number[]
    if (refine) {
      // re-rank ONLY the shortlist, using exact distances
      result = shortlist
        .map((i) => ({ i, d: exact[i].d }))
        .sort((a, b) => a.d - b.d)
        .slice(0, FINAL)
        .map((o) => o.i)
    } else {
      result = byApprox.slice(0, FINAL).map((o) => o.i)
    }
    const hits = result.filter((i) => trueTop.includes(i)).length
    return { pts, shortlist, result, trueTop, hits }
  }, [mode, refine])

  const { pts, shortlist, result, trueTop, hits } = m
  const modeInfo = MODES.find((x) => x.id === mode)!
  const quantized = mode !== "fp32"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>quantize → shortlist → refine · top-{FINAL}</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[minmax(0,260px)_1fr]">
        {/* scatter */}
        <svg
          viewBox={`0 0 ${S} ${S}`}
          className="w-full rounded-md border bg-background"
          role="img"
          aria-label="A 2D scatter of database points with a query. Ground-truth nearest neighbours are ringed in amber; the pipeline's returned points are filled blue. Under 1-bit quantization each point collapses to a quadrant centroid."
        >
          {/* quadrant guides under 1-bit quantization */}
          {mode === "1bit" ? (
            <g>
              <line x1={C} y1={8} x2={C} y2={S - 8} stroke="var(--border)" strokeDasharray="3 4" />
              <line x1={8} y1={C} x2={S - 8} y2={C} stroke="var(--border)" strokeDasharray="3 4" />
            </g>
          ) : null}

          {/* quantized reconstruction: line from point to its decoded position */}
          {quantized
            ? pts.map((p, i) => {
                const q = quantize(p, mode)
                return (
                  <g key={`q${i}`}>
                    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="var(--muted-foreground)" strokeOpacity={0.25} strokeWidth={1} />
                    <circle cx={q[0]} cy={q[1]} r={2} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.4} />
                  </g>
                )
              })
            : null}

          {/* database points */}
          {pts.map((p, i) => {
            const isTrue = trueTop.includes(i)
            const isResult = result.includes(i)
            const inShort = shortlist.includes(i)
            return (
              <g key={i}>
                {isTrue ? <circle cx={p[0]} cy={p[1]} r={9} fill="none" stroke={TRUE} strokeWidth={2} /> : null}
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r={5}
                  fill={isResult ? ACC : "var(--muted-foreground)"}
                  opacity={isResult ? 0.95 : inShort ? 0.55 : 0.3}
                  className="transition-all duration-300"
                />
              </g>
            )
          })}

          {/* query */}
          <g>
            <circle cx={QUERY[0]} cy={QUERY[1]} r={4} fill={TRUE} />
            <circle cx={QUERY[0]} cy={QUERY[1]} r={9} fill="none" stroke={TRUE} strokeWidth={1.2} strokeDasharray="2 3" />
          </g>
          <text x={QUERY[0] + 12} y={QUERY[1] + 3} className="font-mono" fontSize={10} fill={TRUE}>
            query
          </text>
        </svg>

        {/* controls + ranking */}
        <div>
          {/* mode selector */}
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setMode(x.id)}
                aria-pressed={mode === x.id}
                className={cn(
                  "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                  mode === x.id ? "text-background" : "text-muted-foreground hover:text-foreground"
                )}
                style={mode === x.id ? { background: ACC, borderColor: ACC } : undefined}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span>
              <span className="text-foreground">{modeInfo.bytes}</span>/vec (768-d)
            </span>
            <span>
              distance: <span className="text-foreground">{modeInfo.op}</span>
            </span>
            <span>{modeInfo.note}</span>
          </div>

          {/* refinement toggle */}
          <button
            type="button"
            onClick={() => setRefine((r) => !r)}
            aria-pressed={refine}
            className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors hover:bg-muted/40"
          >
            <span
              className="inline-flex h-4 w-7 items-center rounded-full px-0.5 transition-colors"
              style={{ background: refine ? ACC : "var(--muted-foreground)" }}
            >
              <span className={cn("h-3 w-3 rounded-full bg-background transition-transform", refine && "translate-x-3")} />
            </span>
            refinement: <span className="text-foreground">{refine ? "on" : "off"}</span>
          </button>

          {/* coarse shortlist */}
          <div className="mt-3">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              coarse pass · top-{SHORT} by {quantized ? "quantized" : "exact"} distance
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {shortlist.map((i, r) => (
                <span key={i} className="rounded-md border px-2 py-0.5 font-mono text-xs" style={{ borderColor: ACC, color: ACC }}>
                  {r + 1}. #{i}
                </span>
              ))}
            </div>
          </div>

          {/* result */}
          <div className="mt-3">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              result · top-{FINAL} {refine ? "after refine" : "(no refine)"}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.map((i) => {
                const hit = trueTop.includes(i)
                return (
                  <span
                    key={i}
                    className="rounded-md px-2 py-0.5 font-mono text-xs text-background"
                    style={{ background: hit ? GOOD : MISS }}
                  >
                    #{i} {hit ? "✓" : "✗"}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="mt-3 rounded-md border px-3 py-2 font-mono text-xs">
            <span className="text-muted-foreground">recall@{FINAL} vs exact: </span>
            <span style={{ color: hits === FINAL ? GOOD : MISS }}>
              {hits} / {FINAL}
            </span>
            <span className="ml-2 text-muted-foreground/70">
              (amber rings = true neighbours; blue fill = returned)
            </span>
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        <span className="text-foreground">1-bit</span> codes shrink each vector 32× and turn a distance into a{" "}
        <span style={{ color: ACC }}>popcount</span>, but they collapse points to quadrant centroids, so the coarse ranking is
        wrong: with <span style={{ color: MISS }}>refinement off</span> a true neighbour gets pushed out. Turn{" "}
        <span style={{ color: ACC }}>refinement on</span> and the shortlist is re-scored with exact vectors — as long as the
        true neighbour survived into the top-{SHORT}, it comes back. That is the whole trick: quantize to go fast, refine to
        stay accurate.
      </div>
    </figure>
  )
}
