import { LANGS, TOTALS } from "./data"

// What "~400B tokens + ~150B tokens" resolves to when you go and count it.
//
// The card states one number per level. A parquet dataset has one number per
// COLUMN, and L3 stores its generated text three times over, so "150B" is
// ambiguous in a way that matters a lot to whoever budgets the training run.
// This chart puts the card's two claims on the same axis as every reading the
// released files actually support.
//
// Server-rendered, zero JS. Widths are plain division against a fixed maximum:
// no transcendental, nothing to drift between Node and Chrome.

interface Bar {
  label: string
  sub: string
  tokens: number
  kind: "claim" | "measured" | "shadow"
}

const MAX = 440e9

const BARS: Bar[] = [
  {
    label: "L2 — claimed",
    sub: "dataset card: “~400B tokens”",
    tokens: TOTALS.l2Claimed,
    kind: "claim",
  },
  {
    label: "L2 — measured",
    sub: "content column, 266,878,376 rows",
    tokens: TOTALS.l2Tokens,
    kind: "measured",
  },
  {
    label: "L3 — claimed",
    sub: "dataset card: “~150B tokens”",
    tokens: TOTALS.l3Claimed,
    kind: "claim",
  },
  {
    label: "L3 — measured, full_content",
    sub: "task + analysis + solution + test",
    tokens: TOTALS.l3FullContent,
    kind: "measured",
  },
  {
    label: "L3 — measured, content",
    sub: "the column the default config hands you",
    tokens: TOTALS.l3Content,
    kind: "measured",
  },
  {
    label: "L3 — raw_content",
    sub: "verbatim GitHub source, carried along",
    tokens: TOTALS.l3RawContent,
    kind: "shadow",
  },
  {
    label: "L3 — every text column",
    sub: "what the 604.7 GB download actually holds",
    tokens: TOTALS.l3AllColumns,
    kind: "shadow",
  },
]

const FILL: Record<Bar["kind"], string> = {
  claim: "var(--muted-foreground)",
  measured: "oklch(0.60 0.15 255)",
  shadow: "oklch(0.68 0.13 85)",
}

function b(n: number): string {
  return `${(n / 1e9).toFixed(1)}B`
}

export function TokenLedger() {
  const W = 760
  const labelW = 250
  const plotW = W - labelW - 56
  const rowH = 42
  const H = BARS.length * rowH + 34

  const l2Delta = (TOTALS.l2Tokens - TOTALS.l2Claimed) / TOTALS.l2Claimed
  const l3Delta = (TOTALS.l3FullContent - TOTALS.l3Claimed) / TOTALS.l3Claimed
  const contentShare = TOTALS.l3Content / TOTALS.l3Claimed

  return (
    <figure className="my-8">
      <div className="overflow-x-auto rounded-md border bg-muted/20 p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label={`Measured token counts for UltraData-Code against the two numbers its card claims. L2 claimed 400 billion, measured ${b(TOTALS.l2Tokens)}. L3 claimed 150 billion; its full_content column measures ${b(TOTALS.l3FullContent)} and its content column ${b(TOTALS.l3Content)}. Every text column in L3 summed is ${b(TOTALS.l3AllColumns)}.`}
        >
          {[0, 100e9, 200e9, 300e9, 400e9].map((t) => {
            const x = labelW + (t / MAX) * plotW
            return (
              <g key={t}>
                <line
                  x1={x}
                  x2={x}
                  y1={16}
                  y2={H - 18}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-[var(--muted-foreground)] font-mono text-[9px]"
                >
                  {t / 1e9}B
                </text>
              </g>
            )
          })}

          {BARS.map((bar, i) => {
            const y = 16 + i * rowH
            const w = (bar.tokens / MAX) * plotW
            return (
              <g key={bar.label}>
                <text
                  x={labelW - 10}
                  y={y + 13}
                  textAnchor="end"
                  className="fill-[var(--foreground)] font-mono text-[11px]"
                >
                  {bar.label}
                </text>
                <text
                  x={labelW - 10}
                  y={y + 25}
                  textAnchor="end"
                  className="fill-[var(--muted-foreground)] text-[10px]"
                >
                  {bar.sub}
                </text>
                <rect
                  x={labelW}
                  y={y + 3}
                  width={Math.max(w, 1)}
                  height={20}
                  rx={2}
                  fill={FILL[bar.kind]}
                  opacity={bar.kind === "claim" ? 0.35 : 0.9}
                  stroke={bar.kind === "claim" ? "var(--muted-foreground)" : "none"}
                  strokeDasharray={bar.kind === "claim" ? "3 2" : undefined}
                />
                <text
                  x={labelW + w + 6}
                  y={y + 17}
                  className="fill-[var(--foreground)] font-mono text-[11px]"
                >
                  {b(bar.tokens)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <figcaption className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        <p className="my-0">
          L2 comes in {(l2Delta * 100).toFixed(1)}% above its round number and L3&apos;s{" "}
          <code className="font-mono text-[0.9em]">full_content</code>{" "}
          {(Math.abs(l3Delta) * 100).toFixed(1)}% below. Neither gap is the
          interesting one. The interesting one is that{" "}
          <code className="font-mono text-[0.9em]">content</code> — the field the
          card describes as &ldquo;a serialization containing task and
          solution&rdquo;, and the one you get by reading the column of that name
          — is {b(TOTALS.l3Content)}, or {(contentShare * 100).toFixed(0)}% of the
          advertised 150B.
        </p>
        <p className="my-0 font-mono text-xs">
          {LANGS.length} languages · {TOTALS.rows.toLocaleString("en-US")} rows ·{" "}
          {(TOTALS.parquetBytes / 1e12).toFixed(3)} TB of parquet · tokenised with
          openbmb/MiniCPM5-2B
        </p>
      </figcaption>
    </figure>
  )
}
