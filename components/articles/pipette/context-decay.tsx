"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Two 350M models, one number apart on the spec sheet, four times apart in how
// they hold up as the prompt grows.
//
// Pipette's headline finding: at Q4_K_M on a Galaxy S26 Ultra, Granite-4.0-H-350M
// keeps 78.4% of its decode throughput going from 256 to 4,096 input tokens,
// while Granite-4.0-350M keeps 33.8%. The "H" is hybrid — most layers use a
// recurrent/linear mixer with fixed state, and only a small share use full
// attention over a growing KV cache.
//
// That mechanism gives a one-parameter model. Per-token decode cost is a fixed
// part plus a part proportional to the attended cache:
//
//     t(L) = a + b * f * L
//
// with f the share of layers doing full attention. Calibrating a/b so that
// f = 1 reproduces 33.8% retention at 4,096 puts a = 1704.5 b — and the hybrid's
// measured 78.4% then lands at f ≈ 0.125, which is about the attention share
// Granite's hybrid stack actually uses. That the two published numbers are
// consistent with one physical model at a sensible parameter is the reason to
// believe the mechanism rather than just the measurement.
//
// The curve is that model. The two dots are Pipette's measurements.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const A = 1704.5 // fixed per-token cost, in units of b
const CTX = [256, 512, 1024, 2048, 4096, 8192]

// Pipette, Galaxy S26 Ultra, Q4_K_M, decode with output fixed at 100 tokens
const MEASURED = [
  { name: "granite-4.0-h-350m", f: 0.125, retention: 0.784, colour: GOOD },
  { name: "granite-4.0-350m", f: 1, retention: 0.338, colour: WARM },
]

export function ContextDecay() {
  const [fPct, setFPct] = useState(50)
  const [showBoth, setShowBoth] = useState(true)

  const f = fPct / 100
  const tOf = (L: number, ff: number) => A + ff * L
  const relThroughput = (L: number, ff: number) => tOf(256, ff) / tOf(L, ff)
  const retention = relThroughput(4096, f)

  const W = 700
  const H = 208
  const X0 = 52
  const X1 = 640
  const Y0 = 16
  const Y1 = 160

  // context axis is drawn evenly per doubling, matching Pipette's charts
  const PX = (i: number) => X0 + (i / (CTX.length - 1)) * (X1 - X0)
  const PY = (v: number) => Y1 - v * (Y1 - Y0)

  const path = (ff: number) =>
    CTX.map((L, i) => `${i === 0 ? "M" : "L"} ${PX(i).toFixed(2)} ${PY(relThroughput(L, ff)).toFixed(2)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          decode throughput as the prompt grows, relative to 256 tokens
        </span>
        <span className="font-mono text-[10px]" style={{ color: retention > 0.6 ? GOOD : WARM }}>
          {(retention * 100).toFixed(1)}% retained at 4,096
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Decode throughput relative to its value at 256 input tokens, plotted against context length up to 8,192. A model with ${fPct}% of layers using full attention retains ${(retention * 100).toFixed(1)}% of its throughput at 4,096 tokens. Two measured points are marked: the hybrid Granite-4.0-H-350M at 78.4% and the full-attention Granite-4.0-350M at 33.8%.`}
            </title>

            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <line x1={X0} y1={PY(v)} x2={X1} y2={PY(v)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={X0 - 7} y={PY(v) + 3} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {(v * 100).toFixed(0)}%
                </text>
              </g>
            ))}
            {CTX.map((L, i) => (
              <text key={L} x={PX(i)} y={Y1 + 14} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.42} fontFamily="ui-monospace, monospace">
                {L >= 1024 ? `${L / 1024}k` : L}
              </text>
            ))}
            <text x={(X0 + X1) / 2} y={H - 6} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              input tokens
            </text>

            {/* the 4,096 readout line */}
            <line x1={PX(4)} y1={Y0} x2={PX(4)} y2={Y1} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 3" />

            {showBoth
              ? MEASURED.map((m) => (
                  <g key={m.name}>
                    <path d={path(m.f)} fill="none" stroke={m.colour} strokeWidth={1.6} strokeOpacity={0.45} strokeDasharray="4 3" />
                    <circle cx={PX(4)} cy={PY(m.retention)} r={4.5} fill={m.colour} />
                    <text
                      x={PX(4) + 9}
                      y={PY(m.retention) + 3}
                      fontSize={8.5}
                      fill={m.colour}
                      fontFamily="ui-monospace, monospace"
                    >
                      {m.name} — {(m.retention * 100).toFixed(1)}%
                    </text>
                  </g>
                ))
              : null}

            <path d={path(f)} fill="none" stroke={ACCENT} strokeWidth={2.6} />
            <circle cx={PX(4)} cy={PY(retention)} r={4} fill={ACCENT} />
            {/* bottom-left: every curve starts at 100% on the left edge and only
                descends rightward, so nothing else is ever drawn here */}
            <text
              x={X0 + 8}
              y={Y1 - 8}
              fontSize={8.5}
              fill={ACCENT}
              fontFamily="ui-monospace, monospace"
            >
              {fPct}% of layers on full attention
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              full-attention share
            </span>
            <Range
              min={0}
              max={100}
              step={1}
              value={fPct}
              onChange={(e) => setFPct(Number(e.target.value))}
              className="flex-1"
              aria-label="what share of the model's layers attend over the growing KV cache"
              accent={ACCENT}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {fPct}%
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowBoth((v) => !v)}
            aria-pressed={showBoth}
            className={cn(
              "w-fit cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              showBoth
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {showBoth ? "hide the two measured models" : "show the two measured models"}
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "at 1,024 tokens", v: `${(relThroughput(1024, f) * 100).toFixed(0)}%`, c: ACCENT },
            { l: "at 4,096 tokens", v: `${(retention * 100).toFixed(1)}%`, c: ACCENT },
            { l: "at 8,192 tokens", v: `${(relThroughput(8192, f) * 100).toFixed(0)}%`, c: retention > 0.6 ? GOOD : WARM },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          the curve is a one-parameter model of per-token cost, calibrated so that a
          full-attention stack reproduces Pipette&rsquo;s measured 33.8%; the dots are the
          measurements
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both of these models are 350M parameters. Both run the same quantization on the same
          phone. On a spec sheet they are the same row, and one of them is{" "}
          <span className="text-foreground">four times better at the thing you will actually ask it to do</span>{" "}
          — because summarising a message thread or answering over a document means a few thousand
          tokens of input, not 256.
          <br />
          <br />
          The mechanism is the KV cache. A full-attention layer must attend over every previous
          token, so per-token decode cost rises with the context; a recurrent or linear-attention
          layer carries fixed state and does not. Slide the share to 100% and you get the plain
          model&rsquo;s collapse; slide it to about 12% and you land on the hybrid&rsquo;s
          measurement. That the two published numbers fall out of one physical model at a sensible
          attention share is the part worth trusting — and it is also why{" "}
          <span style={{ color: GOOD }}>&ldquo;how fast is it&rdquo; measured at 256 tokens is
          nearly useless</span>{" "}for deciding what to ship.
        </p>
      </div>
    </figure>
  )
}
