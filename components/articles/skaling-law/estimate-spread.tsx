"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Applying the paper to a back-of-envelope I published four days ago. In the
// LTC/GDN piece I estimated how much of LTCAttention's 0.062-nat gain a
// compute-matched baseline would have recovered, using the original Chinchilla
// coefficients. Redoing it with (a) the same functional form refitted on
// Farseer and (b) the Skaling form on the same Farseer runs gives answers that
// span 2.4x.
//
// N = 28,758,912 params, D = 287,588,352 tokens (D/N = 10.0), the LTCAttention
// reference setup. Sensitivities:
//   Chinchilla  |dL/dlnX| = exponent * term
//   Skaling     |dL/dlnX| = k * exponent * term * R^(k-1)

const N = 28758912
const D = 287588352
const OBSERVED = 0.0619

const ACC = "oklch(0.60 0.15 255)"
const WARN = "oklch(0.68 0.13 85)"

type Law = { name: string; note: string; A: number; B: number; al: number; be: number; k: number; E: number }

const LAWS: Law[] = [
  { name: "Chinchilla · Hoffmann 2022", note: "the coefficients I used originally", A: 406.4, B: 410.7, al: 0.34, be: 0.28, k: 1, E: 1.69 },
  { name: "Chinchilla · refit on Farseer", note: "same functional form, this paper's fit", A: 48, B: 110, al: 0.27, be: 0.24, k: 1, E: 0.45 },
  { name: "Skaling · fit on Farseer", note: "coupled form, same runs", A: 290, B: 6000, al: 0.32, be: 0.39, k: 0.41, E: 0.03 },
]

function grads(l: Law) {
  const rN = l.A / Math.pow(N, l.al)
  const rD = l.B / Math.pow(D, l.be)
  const R = rN + rD
  const f = l.k * Math.pow(R, l.k - 1)
  return { L: Math.pow(R, l.k) + l.E, gN: f * l.al * rN, gD: f * l.be * rD }
}

export function EstimateSpread() {
  const [dParams, setDParams] = useState(1.2)
  const [dTokens, setDTokens] = useState(12.4)

  const rows = LAWS.map((l) => {
    const g = grads(l)
    return { l, param: g.gN * (dParams / 100), token: g.gD * (dTokens / 100), L: g.L }
  })

  const tokens = rows.map((r) => r.token)
  const spread = Math.max(...tokens) / Math.min(...tokens)
  const maxBar = Math.max(...tokens, OBSERVED)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the same back-of-envelope under three laws
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">N = 28.8M · D = 287.6M · D/N = 10</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 grid grid-cols-[minmax(0,13rem)_1fr_auto_auto] gap-x-3 px-2 font-mono text-[9px] uppercase tracking-wide text-muted-foreground/70">
          <span>law</span>
          <span>predicted gain from more tokens</span>
          <span>tokens</span>
          <span>params</span>
        </div>
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.l.name} className="grid grid-cols-[minmax(0,13rem)_1fr_auto_auto] items-center gap-x-3 rounded-lg border bg-muted/15 px-2 py-2">
              <div className="min-w-0">
                <div className="truncate font-mono text-[11px] text-foreground">{r.l.name}</div>
                <div className="truncate font-mono text-[9px] text-muted-foreground">{r.l.note}</div>
              </div>
              <div className="h-3 rounded-sm bg-muted/40">
                <div className="h-3 rounded-sm" style={{ width: `${(r.token / maxBar) * 100}%`, background: ACC }} />
              </div>
              <span className="font-mono text-[11px] tabular-nums text-foreground">{r.token.toFixed(4)}</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{r.param.toFixed(4)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,13rem)_1fr_auto_auto] items-center gap-x-3 rounded-lg border px-2 py-2" style={{ borderColor: WARN }}>
            <div className="font-mono text-[11px]" style={{ color: WARN }}>measured LTC effect</div>
            <div className="h-3 rounded-sm bg-muted/40">
              <div className="h-3 rounded-sm" style={{ width: `${(OBSERVED / maxBar) * 100}%`, background: WARN }} />
            </div>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: WARN }}>{OBSERVED.toFixed(4)}</span>
            <span className="font-mono text-[10px] text-muted-foreground">—</span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            +{dParams.toFixed(1)}% params
            <Range min={0} max={10} step={0.1} value={dParams} onChange={(e) => setDParams(Number(e.target.value))} accent={ACC} className="flex-1" aria-label="percent increase in parameters" />
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            +{dTokens.toFixed(1)}% tokens
            <Range min={0} max={40} step={0.1} value={dTokens} onChange={(e) => setDTokens(Number(e.target.value))} accent={ACC} className="flex-1" aria-label="percent increase in training tokens" />
          </label>
        </div>

        <p className={cn("mt-4 text-sm leading-6 text-muted-foreground")}>
          At the defaults — LTCAttention&rsquo;s actual +1.20% parameters and its 12.40% throughput penalty spent on
          extra tokens instead — the three laws span{" "}
          <span className="text-foreground">{spread.toFixed(1)}×</span>. Most of that gap is not the coupling at
          all; it is that Hoffmann&rsquo;s 2022 coefficients were fitted on a different corpus and tokenizer, and
          refitting the same additive form on Farseer halves the answer. The coupled form then trims it further.
          The number I published was the most pessimistic corner of that range, and this configuration sits at
          D/N = 10 — inside the band where the paper reports the additive law is at its worst.
        </p>
      </div>
    </figure>
  )
}
