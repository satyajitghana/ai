"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Exact speculative sampling against llamAmpere's mb-MTP ("mode-biased") acceptance, computed exactly for a toy
// five-token vocabulary. The rule is common_sampler_verify_pq_impl in llamAmpere's common/sampling.cpp:
//
//   draft d ~ q. Accept with probability min(1, p(d) / q(d)). On rejection draw y from the residual (p - q)+.
//   exact:  emit y.                         -> the output is distributed exactly as p
//   mb-MTP: emit d instead whenever p(d) >= p(y) (d and y not end-of-text or a stop string).
//
// Every unit of extra acceptance is probability mass moved from some y onto a d the target ranked at least as
// high, so the extra acceptance equals the total-variation distance it opens between the output and p.
//
// The table below the chart is a measurement, not the toy: SmolLM2-360M as target and SmolLM2-135M as draft,
// teacher-forced over 511 positions of each of three texts, top-k 20 / top-p 0.95, every position computed with the
// same exact formula (scripts in the article).

const TOKS = ["the", "a", "this", "its", "one"]
const P = [0.4, 0.25, 0.15, 0.12, 0.08]

const MEASURED = [
  { text: "code", t: "1.0", exact: 72.2, mb: 78.1, tv: 5.9, p90: 16.5 },
  { text: "prose (release notes)", t: "1.0", exact: 69.2, mb: 76.7, tv: 7.5, p90: 18.6 },
  { text: "prose (article)", t: "1.0", exact: 74.3, mb: 80.2, tv: 5.9, p90: 16.1 },
  { text: "code", t: "0.7", exact: 72.6, mb: 78.4, tv: 5.8, p90: 18.1 },
  { text: "prose (release notes)", t: "0.7", exact: 68.8, mb: 76.1, tv: 7.4, p90: 20.1 },
  { text: "prose (article)", t: "0.7", exact: 74.2, mb: 80.0, tv: 5.8, p90: 17.4 },
]

const C_P = "oklch(0.55 0.16 250)"
const C_MB = "oklch(0.60 0.17 30)"

function analyse(q: number[]) {
  const n = P.length
  const accExact = P.reduce((s, pi, i) => s + Math.min(pi, q[i]), 0)
  const r = P.map((pi, i) => Math.max(0, pi - q[i]))
  const z = r.reduce((s, v) => s + v, 0)
  const out = P.slice()
  let extra = 0
  if (z > 1e-12) {
    for (let d = 0; d < n; d++) {
      const w = q[d] - P[d]
      if (w <= 0) continue
      for (let y = 0; y < n; y++) {
        if (r[y] <= 0 || P[d] < P[y]) continue
        const moved = (w * r[y]) / z
        out[y] -= moved
        out[d] += moved
        extra += moved
      }
    }
  }
  const tv = 0.5 * out.reduce((s, v, i) => s + Math.abs(v - P[i]), 0)
  return { accExact, accMb: accExact + extra, out, tv }
}

export function MbMtp() {
  const [fav, setFav] = useState(1)
  const [alpha, setAlpha] = useState(0.35)
  // the drafter over-likes one token: q = (1 - alpha) p + alpha e_fav
  const q = P.map((pi, i) => (1 - alpha) * pi + (i === fav ? alpha : 0))
  const { accExact, accMb, out, tv } = analyse(q)
  const maxV = 0.6

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        exact acceptance vs mb-MTP · toy vocabulary computed exactly; table measured on a real draft/target pair
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">the drafter over-likes</span>
        {TOKS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setFav(i)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              fav === i ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_14rem]">
        <div className="space-y-2">
          {TOKS.map((t, i) => (
            <div key={t} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 font-mono text-[11px]">
              <span className="text-muted-foreground">{t}</span>
              <div className="space-y-0.5">
                {[
                  { v: P[i], c: C_P, n: "target p (= exact output)" },
                  { v: q[i], c: "oklch(0.70 0.02 250)", n: "draft q" },
                  { v: out[i], c: C_MB, n: "mb-MTP output" },
                ].map((b) => (
                  <div key={b.n} className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded bg-muted" role="img" aria-label={`${t}, ${b.n}: ${(b.v * 100).toFixed(1)} percent`}>
                      <div className="h-full" style={{ width: `${Math.min(100, (b.v / maxV) * 100).toFixed(1)}%`, background: b.c }} />
                    </div>
                    <span className="w-12 text-right tabular-nums">{(b.v * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-3 pt-1 font-mono text-[10px] text-muted-foreground">
            <span style={{ color: C_P }}>■ target p, which exact sampling reproduces</span>
            <span>■ draft q</span>
            <span style={{ color: C_MB }}>■ what mb-MTP emits</span>
          </div>
        </div>
        <div className="grid content-start gap-3 font-mono text-xs">
          <div>
            <div className="text-muted-foreground">accepted, exact</div>
            <div className="text-xl tabular-nums">{(accExact * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">accepted, mb-MTP</div>
            <div className="text-xl tabular-nums" style={{ color: C_MB }}>
              {(accMb * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">output moved from p (TV)</div>
            <div className="text-xl tabular-nums">{(tv * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">equal to the extra acceptance</div>
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">how much it over-likes</span>
          <Range min={0} max={0.8} step={0.01} value={alpha} accent={C_MB} onChange={(e) => setAlpha(Number(e.target.value))} aria-label="how strongly the drafter over-likes the chosen token" className="w-full" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{alpha.toFixed(2)}</span>
        </label>
      </div>

      <div className="overflow-x-auto border-t px-4 py-3">
        <div className="mb-1 font-mono text-[11px] text-muted-foreground">
          measured: SmolLM2-360M target, SmolLM2-135M draft, 511 positions per text, top-k 20, top-p 0.95
        </div>
        <table className="w-full font-mono text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-1 pr-3 font-normal">text</th>
              <th className="pr-3 font-normal">temp</th>
              <th className="pr-3 text-right font-normal">accepted, exact</th>
              <th className="pr-3 text-right font-normal">mb-MTP</th>
              <th className="pr-3 text-right font-normal">mean TV</th>
              <th className="text-right font-normal">p90 TV</th>
            </tr>
          </thead>
          <tbody>
            {MEASURED.map((m) => (
              <tr key={m.text + m.t} className="border-t border-border/50">
                <td className="py-1 pr-3">{m.text}</td>
                <td className="pr-3">{m.t}</td>
                <td className="pr-3 text-right">{m.exact.toFixed(1)}%</td>
                <td className="pr-3 text-right" style={{ color: C_MB }}>
                  {m.mb.toFixed(1)}%
                </td>
                <td className="pr-3 text-right">{m.tv.toFixed(1)}%</td>
                <td className="text-right">{m.p90.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
