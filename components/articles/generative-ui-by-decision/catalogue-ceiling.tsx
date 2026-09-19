"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Batching makes the number of round trips independent of how many elements you
// render. It does not make the request small. Every candidate recipe you offer
// is sent on every request — once in state.capabilities and again as a criteria
// key — so the body grows linearly with the catalog and the whole thing has to
// fit in one context window.
//
// The five dots are measured: synthetic catalogs of 42 / 101 / 201 / 401 / 801
// atomic candidates through the real composer, recording the exact select-call
// body. The growth is exactly linear, so the line is the slope through the
// endpoints — 668.6 bytes per candidate — converted at 4 bytes per token.
// The two ceilings are the context windows the two sources publish, and they
// disagree with each other.

const ACCENT = "oklch(0.60 0.15 255)"
const WARN = "oklch(0.60 0.17 25)"

const W = 760
const H = 296
const PX0 = 92
const PX1 = 730
const PY0 = 36
const PY1 = 226
const NMAX = 900
const TMAX = 160_000

// bytes = 668.6 x candidates + 97  (measured fit); 4 bytes per token
const BYTES_PER = 668.6
const BYTES_0 = 97
const tokensAt = (n: number) => Math.round((BYTES_PER * n + BYTES_0) / 4)
const candidatesAt = (tokens: number) => Math.floor((tokens * 4 - BYTES_0) / BYTES_PER)
const commas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const MEASURED = [
  { n: 42, bytes: 28_179 },
  { n: 101, bytes: 67_356 },
  { n: 201, bytes: 134_256 },
  { n: 401, bytes: 268_056 },
  { n: 801, bytes: 535_656 },
]

const CAPS = [
  { tokens: 32_768, label: "32k — Vercel AI Gateway's listed context window", tone: WARN },
  { tokens: 65_536, label: "64k — TypeSafe's own documented per-request cap", tone: "var(--muted-foreground)" },
]

export function CatalogueCeiling() {
  const [n, setN] = useState(196)
  const x = (c: number) => PX0 + (c / NMAX) * (PX1 - PX0)
  const y = (t: number) => PY1 - (Math.min(t, TMAX) / TMAX) * (PY1 - PY0)

  const tokens = tokensAt(n)
  const gatewayPct = Math.round((tokens / 32_768) * 1000) / 10
  const costUsd = (tokens * 0.042) / 1e6

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`A line chart of the estimated input tokens in one batched select request against the number of candidate recipes offered. The line rises linearly at about 167 tokens per candidate. It crosses the Vercel AI Gateway's listed 32,000-token context window at roughly 196 candidates and TypeSafe's documented 64,000-token cap at roughly 392. At ${n} candidates the request is about ${commas(tokens)} tokens.`}
      >
        <defs>
          <filter id="gvd-cc-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
        </defs>

        {[0, 40_000, 80_000, 120_000, 160_000].map((t) => (
          <g key={t}>
            <line x1={PX0} y1={y(t)} x2={PX1} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text
              x={PX0 - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              {t === 0 ? "0" : `${t / 1000}k`}
            </text>
          </g>
        ))}
        {[0, 200, 400, 600, 800].map((c) => (
          <text
            key={c}
            x={x(c)}
            y={PY1 + 16}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            {c}
          </text>
        ))}
        <text x={PX0} y={20} className="fill-muted-foreground font-mono" fontSize={9.5}>
          INPUT TOKENS IN ONE BATCHED SELECT CALL
        </text>
        <text
          x={PX1}
          y={PY1 + 30}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize={9.5}
        >
          candidate recipes offered
        </text>

        {CAPS.map((cap) => (
          <g key={cap.tokens}>
            <line
              x1={PX0}
              y1={y(cap.tokens)}
              x2={PX1}
              y2={y(cap.tokens)}
              stroke={cap.tone}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.85}
            />
            <text x={PX0 + 6} y={y(cap.tokens) - 6} className="font-mono" fontSize={9.5} fill={cap.tone}>
              {cap.label}
            </text>
            <line
              x1={x(candidatesAt(cap.tokens))}
              y1={y(cap.tokens)}
              x2={x(candidatesAt(cap.tokens))}
              y2={PY1}
              stroke={cap.tone}
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.6}
            />
            <text
              x={x(candidatesAt(cap.tokens))}
              y={PY1 + 30}
              textAnchor="middle"
              className="font-mono"
              fontSize={9.5}
              fill={cap.tone}
            >
              {candidatesAt(cap.tokens)}
            </text>
          </g>
        ))}

        <path
          d={`M ${x(0)} ${y(tokensAt(0))} L ${x(NMAX)} ${y(tokensAt(NMAX))}`}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
        />
        {MEASURED.map((m) => (
          <circle
            key={m.n}
            cx={x(m.n)}
            cy={y(Math.round(m.bytes / 4))}
            r={3.5}
            fill="var(--background)"
            stroke={ACCENT}
            strokeWidth={1.5}
          />
        ))}

        <line x1={x(n)} y1={PY0} x2={x(n)} y2={PY1} stroke={ACCENT} strokeWidth={1} opacity={0.4} />
        <circle
          cx={x(n)}
          cy={y(tokens)}
          r={5}
          fill={ACCENT}
          stroke="var(--background)"
          strokeWidth={2}
          filter="url(#gvd-cc-soft)"
        />

        <text x={PX0} y={PY1 + 46} className="fill-muted-foreground font-mono" fontSize={9.5}>
          dots = measured · line = fit, 668.6 bytes per candidate · tokens estimated at 4 bytes each
        </text>
      </svg>

      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">candidates</span>
          <Range
            min={20}
            max={NMAX}
            step={1}
            value={n}
            accent={ACCENT}
            onChange={(e) => setN(Number(e.currentTarget.value))}
            className="min-w-[180px] flex-1"
            aria-label="Number of candidate recipes offered"
          />
          <span className="w-12 text-right font-mono text-xs tabular-nums">{n}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">questions</dt>
            <dd className="tabular-nums">{n + 1}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">~input tokens</dt>
            <dd className="tabular-nums">{commas(tokens)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">of Gateway&rsquo;s 32k</dt>
            <dd className={gatewayPct > 100 ? "tabular-nums font-semibold" : "tabular-nums"}>
              {gatewayPct}%
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">cost, this call</dt>
            <dd className="tabular-nums">${costUsd.toFixed(6)}</dd>
          </div>
        </dl>
      </div>

      <figcaption className="border-t px-4 py-3 text-center font-mono text-xs leading-5 text-muted-foreground">
        Each candidate here carries a ~120-character description, which is what the
        playground&rsquo;s own recipes look like; shorter descriptions push the ceiling out
        proportionally. The point is the slope, not the exact crossing: batching buys you a
        constant number of round trips by paying for the whole catalog on every one of them.
      </figcaption>
    </figure>
  )
}
