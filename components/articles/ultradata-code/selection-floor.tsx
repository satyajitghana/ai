"use client"

import { useState } from "react"

import { CATS, LANGS, type Lang } from "./data"

// The selection rule UltraData-Code never wrote down, read back out of the
// scores it shipped in the data.
//
// Two columns ride along with every L2 row: `category` (the role model's label)
// and `algo_rel_score` (the relevance model's score). Neither the card nor the
// figure states a threshold. But a released corpus cannot hide its own
// thresholds: the MINIMUM surviving score IS the floor, and it is different in
// every language — which is what "language-adaptive" turns out to mean.
//
// Pick a language and the two panels are: where its relevance floor sits, and
// what the role model thinks the split is actually made of. Python is the one
// that does not behave like the others, so it is the default.
//
// Client component for the picker only; both panels are pure arithmetic on the
// committed table in ./data.ts and render identically on the server.

const CAT_FILL: Record<string, string> = {
  ALGO: "oklch(0.60 0.15 255)",
  TOOL: "oklch(0.68 0.13 85)",
  WEB: "oklch(0.66 0.14 165)",
  CONFIG: "oklch(0.62 0.16 25)",
  TEST: "oklch(0.60 0.12 310)",
  DATA: "var(--muted-foreground)",
}

function pct(x: number, d = 1): string {
  return `${(x * 100).toFixed(d)}%`
}

function Histogram({ lang }: { lang: Lang }) {
  const W = 420
  const H = 128
  const padL = 30
  const padB = 24
  const plotW = W - padL - 10
  const plotH = H - padB - 14
  const max = Math.max(...lang.algoHist)
  const total = lang.algoHist.reduce((a, b) => a + b, 0)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Distribution of algo_rel_score for the ${lang.name} split of UltraData-Code-L2. The lowest score present is ${lang.algoFloor.toFixed(2)}; scores below that do not appear at all.`}
    >
      <line
        x1={padL}
        x2={W - 10}
        y1={H - padB}
        y2={H - padB}
        stroke="var(--border)"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <text
          key={t}
          x={padL + t * plotW}
          y={H - padB + 12}
          textAnchor="middle"
          className="fill-[var(--muted-foreground)] font-mono text-[9px]"
        >
          {t}
        </text>
      ))}

      {lang.algoHist.map((count, i) => {
        const lo = lang.algoEdges[i]
        const hi = lang.algoEdges[i + 1]
        const x = padL + lo * plotW
        const w = Math.max((hi - lo) * plotW - 1, 1)
        const h = max === 0 ? 0 : (count / max) * plotH
        return (
          <rect
            key={i}
            x={x}
            y={H - padB - h}
            width={w}
            height={h}
            fill="oklch(0.60 0.15 255)"
            opacity={0.85}
          />
        )
      })}

      <line
        x1={padL + lang.algoFloor * plotW}
        x2={padL + lang.algoFloor * plotW}
        y1={12}
        y2={H - padB}
        stroke="var(--foreground)"
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <text
        x={padL + lang.algoFloor * plotW + 4}
        y={30}
        className="fill-[var(--foreground)] font-mono text-[9px]"
      >
        floor {lang.algoFloor.toFixed(2)}
      </text>
      <text
        x={padL - 4}
        y={H - padB}
        textAnchor="end"
        className="fill-[var(--muted-foreground)] font-mono text-[9px]"
      >
        0
      </text>
      <text
        x={padL - 4}
        y={18}
        textAnchor="end"
        className="fill-[var(--muted-foreground)] font-mono text-[9px]"
      >
        {max === 0 ? 0 : pct(max / total, 0)}
      </text>
    </svg>
  )
}

function Composition({ lang }: { lang: Lang }) {
  const W = 420
  const H = 58
  let x = 0
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Role-model composition of the ${lang.name} split: ${CATS.map(
        (c) => `${c} ${pct(lang.cat[c])}`
      ).join(", ")}.`}
    >
      {CATS.map((c) => {
        const w = lang.cat[c] * W
        const seg = (
          <g key={c}>
            <rect
              x={x}
              y={4}
              width={Math.max(w - 0.5, 0)}
              height={20}
              fill={CAT_FILL[c]}
              opacity={c === "ALGO" ? 1 : 0.55}
            />
            {w > 46 ? (
              <text
                x={x + w / 2}
                y={38}
                textAnchor="middle"
                className="fill-[var(--muted-foreground)] font-mono text-[9px]"
              >
                {c} {pct(lang.cat[c], 0)}
              </text>
            ) : null}
          </g>
        )
        x += w
        return seg
      })}
    </svg>
  )
}

export function SelectionFloor() {
  const [id, setId] = useState("py")
  const lang = LANGS.find((l) => l.id === id) ?? LANGS[0]
  const algoRows = (lang.catRaw.ALGO / lang.statRows) * lang.l2Rows

  return (
    <figure className="my-8 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setId(l.id)}
            aria-pressed={l.id === id}
            className={
              "rounded border px-2 py-1 font-mono text-[11px] transition-colors " +
              (l.id === id
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted")
            }
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <p className="my-0 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            algo_rel_score, as released
          </p>
          <Histogram lang={lang} />
          <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">
            Nothing below {lang.algoFloor.toFixed(2)} survived selection in{" "}
            {lang.name}. Mean {lang.algoMean.toFixed(3)}.
          </p>
        </div>

        <div>
          <p className="my-0 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            what the role model calls it
          </p>
          <Composition lang={lang} />
          <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">
            ALGO is {pct(lang.cat.ALGO)} of {lang.name}.{" "}
            {lang.partial
              ? `Shares from the ${lang.statRows.toLocaleString("en-US")} rows the statistics server read`
              : `Exact — all ${lang.statRows.toLocaleString("en-US")} rows`}
            .
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 font-mono text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">L2 rows</dt>
          <dd className="my-0">{lang.l2Rows.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">L2 tokens, measured</dt>
          <dd className="my-0">{(lang.l2Tokens / 1e9).toFixed(2)}B</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">quality_score range</dt>
          <dd className="my-0">
            {lang.qFloor.toFixed(5)} – {lang.qCeil.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">L3 rows per ALGO file</dt>
          <dd className="my-0">{(lang.l3Rows / algoRows).toFixed(2)}×</dd>
        </div>
      </dl>
    </figure>
  )
}
