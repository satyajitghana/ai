"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Why the best draft of the three is the slowest on a laptop.
//
// The post gives the reason in one sentence — "verifying k tokens activates more
// experts and thus more weight traffic than a single decode step" — and then
// moves on. It is worth doing the arithmetic, because the shape of it explains
// why this is structural rather than an implementation detail somebody will fix.
//
// A decode step through an MoE routes one token to a fraction f of the expert
// weights. Verifying k tokens routes k of them. If routing were independent
// across positions, the expected fraction of expert weight touched is
//
//   1 - (1 - f)^k
//
// which saturates fast. Real routing is not independent — consecutive positions
// reuse experts heavily, the same temporal locality edge MoE serving engines
// exploit — so the true figure sits between f (perfect overlap) and the
// independent bound. The slider interpolates between them; neither end is a
// measurement, and the point is the shape, not a specific value.
//
// Set against it is what verification buys: `accept` tokens for one pass. Divide
// and you get bytes-per-token, which is the quantity a memory-bound decoder
// actually pays. A dense model has f = 1 and the traffic multiplier is exactly 1,
// which is why the two dense LFM2.5 drafts do fine on the same laptop.
//
// mpow because Math.pow is only an implementation-dependent approximation and its
// result reaches the DOM through the bar geometry.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const PRESETS = [
  { label: "LFM2.5-8B-A1B · ~1B of 8B active", f: 12.5, accept: 6.95, dense: false },
  { label: "LFM2.5-2.6B · dense", f: 100, accept: 4.81, dense: true },
  { label: "LFM2.5-1.2B-Instruct · dense", f: 100, accept: 5.02, dense: true },
] as const

export function MoeVerifyCost() {
  const [f, setF] = useState(12.5)
  const [k, setK] = useState(9)
  const [overlap, setOverlap] = useState(35)
  const [accept, setAccept] = useState(6.95)

  const frac = f / 100
  // Independent-routing upper bound, and the perfect-reuse lower bound.
  const hi = 1 - mpow(1 - frac, k)
  const lo = frac
  const touched = lo + (hi - lo) * (1 - overlap / 100)

  // Weight traffic per verification pass, relative to one ordinary decode step.
  const trafficPerPass = touched / frac
  // ...and what it costs per token actually emitted.
  const perToken = trafficPerPass / accept
  const preset = PRESETS.find((p) => Math.abs(p.f - f) < 0.01 && Math.abs(p.accept - accept) < 0.01)

  const W = 720
  const H = 150
  const PAD = { l: 44, r: 108, t: 14, b: 26 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const KMAX = 16
  const X = (kk: number) => PAD.l + ((kk - 1) / (KMAX - 1)) * iw
  const Y = (v: number) => PAD.t + ih - Math.min(1, v) * ih

  const curve = (mix: number) => {
    const pts: string[] = []
    for (let kk = 1; kk <= KMAX; kk++) {
      const h = 1 - mpow(1 - frac, kk)
      const v = lo + (h - lo) * mix
      pts.push(`${kk === 1 ? "M" : "L"}${X(kk).toFixed(1)},${Y(v).toFixed(1)}`)
    }
    return pts.join(" ")
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          expert weight touched by one verification pass of {k} tokens
        </span>
        <span className="font-mono text-[10px]" style={{ color: perToken < 1 ? GOOD : WARM }}>
          {perToken.toFixed(2)}× the weight traffic per emitted token
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setF(p.f)
                setAccept(p.accept)
              }}
              aria-pressed={preset?.label === p.label}
              className={
                preset?.label === p.label
                  ? "cursor-pointer rounded-full border border-foreground/30 bg-muted/50 px-2.5 py-1 font-mono text-[10px] text-foreground"
                  : "cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              Fraction of expert weight touched as the number of verified tokens grows, bounded below by perfect
              expert reuse and above by independent routing
            </title>
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={0.1} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {(g * 100).toFixed(0)}%
                </text>
              </g>
            ))}

            <path d={curve(1)} fill="none" stroke={WARM} strokeWidth={1.2} strokeDasharray="4 3" />
            <path d={curve(0)} fill="none" stroke={GOOD} strokeWidth={1.2} strokeDasharray="4 3" />
            <path d={curve(1 - overlap / 100)} fill="none" stroke={ACCENT} strokeWidth={2.5} />

            <line x1={X(k)} y1={PAD.t} x2={X(k)} y2={PAD.t + ih} stroke={ACCENT} strokeDasharray="2 3" strokeOpacity={0.7} />
            <circle cx={X(k)} cy={Y(touched)} r={4} fill={ACCENT} />

            <text x={PAD.l + iw + 6} y={Y(hi) + 3} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
              independent
            </text>
            <text x={PAD.l + iw + 6} y={Y(lo) + 3} fontSize={9} fill={GOOD} fontFamily="ui-monospace, monospace">
              perfect reuse
            </text>

            {[1, 4, 8, 12, 16].map((kk) => (
              <text
                key={kk}
                x={X(kk)}
                y={PAD.t + ih + 14}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.45}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {kk}
              </text>
            ))}
            <text x={PAD.l + iw / 2} y={H - 2} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              tokens verified in one pass
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { l: "active fraction", v: f, set: setF, min: 5, max: 100, step: 0.5, unit: "%", c: ACCENT },
            { l: "block size k", v: k, set: setK, min: 1, max: 16, step: 1, unit: "tok", c: ACCENT },
            { l: "expert reuse", v: overlap, set: setOverlap, min: 0, max: 100, step: 1, unit: "%", c: GOOD },
            { l: "accepted", v: accept, set: setAccept, min: 1, max: 10, step: 0.01, unit: "tok", c: WARM },
          ].map((s) => (
            <div key={s.l} className="flex items-center gap-2">
              <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">{s.l}</span>
              <Range
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.v}
                onChange={(e) => s.set(Number(e.target.value))}
                className="flex-1"
                aria-label={s.l}
                accent={s.c}
              />
              <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {s.v} <span className="text-muted-foreground">{s.unit}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">expert weight touched</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              {(touched * 100).toFixed(0)}%
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">one decode step touches {f}%</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">traffic per pass</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {trafficPerPass.toFixed(2)}×
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">relative to one decode step</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">per emitted token</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: perToken < 1 ? GOOD : WARM }}>
              {perToken.toFixed(2)}×
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {perToken < 1 ? "still cheaper than decoding one at a time" : "more traffic than plain decoding"}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag <em>active fraction</em>{" "}to 100% — a dense model — and both dashed bounds collapse onto each
          other at 100%: verifying nine tokens streams exactly the same weights as decoding one, so the whole block
          is free and the speedup is just the acceptance length. That is the case speculative decoding was designed
          for, and it is why the two dense LFM2.5 drafts get 2.3–2.9× on the same laptop.
          <br />
          <br />
          Drag it back to an eighth and the curve climbs steeply before flattening. That climb is the bill:{" "}
          <span className="text-foreground">a sparse model&rsquo;s central advantage is that one token only reads
          a slice of it, and verifying a block is precisely the operation that gives that advantage back</span>.
          How much depends entirely on expert reuse across the block — routing locality is what stands between the
          two dashed lines — and on a backend whose MoE kernels are not written for wide verification, whatever
          reuse there is goes unclaimed. Hence 1.18× on a draft that accepts 6.95 tokens.
        </p>
      </div>
    </figure>
  )
}
