"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The IDF term made visible — the piece of BM25 that had no diagram. IDF weights a
// term by how *rare* it is across the corpus:
//   IDF(n) = ln( 1 + (N − n + 0.5)/(n + 0.5) )
// where n is the number of documents that contain the term (its document frequency)
// and N is the corpus size. A term in one document out of N gets a large weight; a
// term in every document collapses toward zero — which is why BM25 needs no stopword
// list, "the" down-weights itself. The x-axis is log-scaled so the steep, interesting
// region near n = 1 is legible. Drag the marker along the curve; static-friendly.

const ACCENT = "oklch(0.72 0.15 195)"
const RARE = "oklch(0.72 0.15 195)"
const COMMON = "oklch(0.7 0.04 40)"

const N = 1000
const W = 600
const H = 300
const padL = 44
const padR = 20
const padT = 22
const padB = 40
const plotW = W - padL - padR
const plotH = H - padT - padB

const idf = (n: number) => Math.log(1 + (N - n + 0.5) / (n + 0.5))
const YMAX = Math.ceil(idf(1)) // ~7 for N=1000

const r2 = (x: number) => Math.round(x * 100) / 100
// log-scaled x: n = 1 → left edge, n = N → right edge
const px = (n: number) => r2(padL + (Math.log(n) / Math.log(N)) * plotW)
const py = (v: number) => r2(padT + (1 - Math.min(v, YMAX) / YMAX) * plotH)

// illustrative corpus terms: from a rare error code to the ubiquitous "the"
const TERMS = [
  { label: "err_5xd", n: 2 },
  { label: "kalman", n: 11 },
  { label: "fox", n: 140 },
  { label: "dog", n: 420 },
  { label: "the", n: 985 },
]

// slider position p in [0,1] maps to n = N^p (so the slider feels log-uniform)
const pToN = (p: number) => Math.max(1, Math.min(N, Math.round(Math.exp(p * Math.log(N)))))

export function IdfRarity() {
  const [p, setP] = useState(0.28)
  const n = pToN(p)
  const v = idf(n)
  const pctCorpus = (n / N) * 100

  const curve = Array.from({ length: 121 }, (_, i) => {
    const t = i / 120
    const nn = Math.exp(t * Math.log(N))
    return `${px(nn)},${py(idf(nn))}`
  }).join(" ")
  const area = `${px(1)},${py(0)} ${curve} ${px(N)},${py(0)}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        inverse document frequency · rarity is (almost) the whole score
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`IDF falls as a term appears in more documents. A term in ${n} of ${N} documents has IDF ${v.toFixed(2)}; a term in a single document approaches ${idf(1).toFixed(1)}, one in every document approaches zero.`}
        >
          <defs>
            <filter id="idf-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.18" />
            </filter>
            <linearGradient id="idf-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.16" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* gridlines: y */}
          {[1, 2, 3, 4, 5, 6].map((gv) => (
            <line key={gv} x1={padL} y1={py(gv)} x2={W - padR} y2={py(gv)} stroke="currentColor" strokeOpacity="0.08" />
          ))}
          {/* gridlines: x at decade ticks */}
          {[1, 10, 100, 1000].map((gn) => (
            <line key={gn} x1={px(gn)} y1={padT} x2={px(gn)} y2={H - padB} stroke="currentColor" strokeOpacity="0.06" />
          ))}

          {/* axes */}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity="0.25" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" strokeOpacity="0.25" />
          {[1, 10, 100, 1000].map((gn) => (
            <text key={gn} x={px(gn)} y={H - padB + 15} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">{gn}</text>
          ))}
          {[0, 2, 4, 6].map((gv) => (
            <text key={gv} x={padL - 6} y={py(gv) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">{gv}</text>
          ))}
          <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">documents containing the term (n of {N}, log scale)</text>
          <text x={13} y={H / 2} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9" transform={`rotate(-90 13 ${H / 2})`}>IDF weight</text>

          {/* curve + fill */}
          <polygon points={area} fill="url(#idf-fill)" />
          <polyline points={curve} fill="none" stroke={ACCENT} strokeWidth="2.5" />

          {/* example term dots */}
          {TERMS.map((t) => {
            const isCommon = t.n > N / 2
            const cx = px(t.n)
            const cy = py(idf(t.n))
            const flip = cx > W - 90
            return (
              <g key={t.label}>
                <circle cx={cx} cy={cy} r="3" fill={isCommon ? COMMON : RARE} />
                <text
                  x={flip ? cx - 7 : cx + 7}
                  y={cy - 5}
                  textAnchor={flip ? "end" : "start"}
                  className="font-mono"
                  fontSize="9"
                  fill={isCommon ? "var(--muted-foreground)" : ACCENT}
                >
                  {t.label}
                </text>
              </g>
            )
          })}

          {/* draggable marker */}
          <line x1={px(n)} y1={padT} x2={px(n)} y2={H - padB} stroke={ACCENT} strokeOpacity="0.35" strokeWidth="1" />
          <circle cx={px(n)} cy={py(v)} r="5" fill="var(--background)" stroke={ACCENT} strokeWidth="2" filter="url(#idf-soft)" />
          <g transform={`translate(${Math.min(px(n) + 8, W - padR - 96)}, ${Math.max(py(v) - 26, padT + 2)})`}>
            <rect width="94" height="20" rx="5" fill="var(--background)" stroke="var(--border)" strokeWidth="1" filter="url(#idf-soft)" />
            <text x="8" y="14" className="fill-foreground font-mono" fontSize="10">idf {v.toFixed(2)}</text>
          </g>
        </svg>

        {/* control */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>n — documents containing the term</span>
            <span className="tabular-nums text-foreground">{n} of {N} ({pctCorpus.toFixed(pctCorpus < 1 ? 1 : 0)}%)</span>
          </div>
          <Range min={0} max={1} step={0.005} value={p} onChange={(e) => setP(+e.target.value)} className="w-full" aria-label="document frequency" accent={ACCENT} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A term in <span className="text-foreground">one</span> document out of {N} is almost the whole story
          (IDF ≈ {idf(1).toFixed(1)}); a term in <span className="text-foreground">every</span> document tells you
          nothing (IDF → 0). Matching a rare identifier — a name, an error code, a ticker — outweighs matching a
          hundred common words. And "the", sitting in nearly every document on the right, down-weights itself: BM25
          needs no stopword list because rarity is baked into the score.
        </p>
      </div>
    </figure>
  )
}
