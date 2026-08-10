"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog, mlog10, mpow } from "@/lib/dmath"

// Why per-channel decay is the interesting part. A single alpha gives one
// memory horizon. KDA learns alpha per channel, so one head carries a whole
// spectrum of horizons at once — some channels forget within a sentence, others
// hold across the entire context. The alphas here are illustrative, spread on a
// log scale; the half-lives are computed exactly.

const ACCENT = "oklch(0.58 0.15 265)"
const WARM = "oklch(0.65 0.16 55)"
const COOL = "oklch(0.55 0.13 220)"

// A representative spread of retention factors, fast to slow.
const CHANNELS = [0.6, 0.85, 0.95, 0.99, 0.997, 0.9995, 0.99993, 0.999995, 0.9999993]

const halfLife = (a: number) => mlog(0.5) / mlog(a)

const LOG_MIN = 0 // 10^0 = 1 token
const LOG_MAX = 6 // 10^6 = 1M tokens

function pos(n: number): number {
  const l = mlog10(Math.max(n, 1))
  return Math.min(100, Math.max(0, ((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100))
}

function fmt(n: number): string {
  if (n < 10) return n.toFixed(1)
  if (n < 1000) return String(Math.round(n))
  if (n < 1e6) return `${(n / 1000).toFixed(n < 1e4 ? 1 : 0)}k`
  return `${(n / 1e6).toFixed(2)}M`
}

// colour interpolation fast (warm) -> slow (cool)
const colorFor = (i: number) => (i / (CHANNELS.length - 1) < 0.5 ? WARM : COOL)

export function ChannelSpectrum() {
  const [ctxK, setCtxK] = useState(128) // context length in thousands of tokens
  const ctx = ctxK * 1000

  const survive = (a: number) => mpow(a, ctx)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        one head, many timescales · half-life per channel
      </div>

      <div className="p-3 sm:p-4">
        {/* log-scale axis */}
        <div className="relative mb-1 h-4">
          {[1, 10, 100, 1000, 10000, 100000, 1000000].map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground/70"
              style={{ left: `${pos(t)}%` }}
            >
              {t >= 1e6 ? "1M" : t >= 1000 ? `${t / 1000}k` : t}
            </span>
          ))}
        </div>

        <div className="space-y-1.5">
          {CHANNELS.map((a, i) => {
            const hl = halfLife(a)
            const s = survive(a)
            const alive = s > 0.5
            return (
              <div key={a} className="grid grid-cols-[minmax(0,5.5rem)_1fr_auto] items-center gap-2">
                <div className="truncate font-mono text-[10px] text-muted-foreground">α = {a}</div>
                <div className="relative h-4 rounded-sm bg-muted/25">
                  {/* the bar spans from 1 token out to this channel's half-life */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm opacity-80"
                    style={{ width: `${pos(hl)}%`, background: colorFor(i) }}
                  />
                  <div
                    className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full"
                    style={{ left: `${pos(hl)}%`, background: colorFor(i) }}
                  />
                </div>
                <div className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums">
                  <span style={{ color: colorFor(i) }}>{fmt(hl)}</span>
                  <span className={alive ? "text-foreground" : "text-muted-foreground/40"}> · {alive ? "holds" : "gone"}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* context marker */}
        <div className="relative mt-2 h-5">
          <div className="absolute inset-x-0 top-0 h-px bg-border" />
          <div
            className="absolute top-0 -translate-x-1/2 text-center"
            style={{ left: `${pos(ctx)}%` }}
          >
            <div className="mx-auto h-2 w-px" style={{ background: ACCENT }} />
            <span className="font-mono text-[9px]" style={{ color: ACCENT }}>context {ctxK >= 1000 ? `${ctxK / 1000}M` : `${ctxK}K`}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length</span>
            <span className="tabular-nums text-foreground">{ctxK >= 1000 ? `${ctxK / 1000}M` : `${ctxK}K`} tokens</span>
          </div>
          <Range min={4} max={1000} step={4} value={ctxK} onChange={(e) => setCtxK(+e.target.value)} className="w-full" aria-label="context length in thousands of tokens" accent={ACCENT} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A single α gives a model one memory horizon. Because KDA learns α{" "}
          <em>per channel</em>, one head holds many at once — the fast channels here are effectively a local
          n-gram window, forgetting within a clause, while the slowest (α = 0.9999993, a half-life near 990k) is
          still holding half its signal at the end of a million-token context. Slide the context marker and watch
          the &ldquo;holds&rdquo; column collapse from the bottom up as the window grows. That spread is the
          mechanism behind a linear-attention model having both sharp recency and long recall from the same
          fixed-size state.
        </p>
      </div>
    </figure>
  )
}
