// Where the 552 Elo actually came from.
//
// Every number here is read off ChessLFM's own "full recipe" table (the last
// figure in the announcement, reproduced below it in the article). The only
// thing added is the attribution column: whether a row changed the network's
// weights or changed the search wrapper that sits on top of them. Rows are
// cumulative — each one is measured with everything above it already applied —
// so the deltas are the table's own deltas, not a re-derivation.
//
// Server-rendered, zero JS. All arithmetic is +, -, * and /, which are exact
// per IEEE-754, so nothing here needs lib/dmath.

type Where = "policy" | "search" | "network"

interface Row {
  n: string
  label: string
  elo: number
  approx?: boolean
  ci?: [number, number]
  delta: number | null
  where: Where
  note: string
}

const ROWS: Row[] = [
  {
    n: "01",
    label: "Raw SFT policy",
    elo: 1452,
    delta: null,
    where: "policy",
    note: "One forward pass per move. Stockfish distillation over 126M positions.",
  },
  {
    n: "02",
    label: "+ Depth-3 tree search",
    elo: 1754,
    delta: 302,
    where: "search",
    note: "Weights unchanged. A minimax loop around the same network.",
  },
  {
    n: "03",
    label: "+ Wider search, repetition fix",
    elo: 1860,
    approx: true,
    delta: 106,
    where: "search",
    note: "Written as ~1860, the only row with a tilde — and the only stage the announcement's prose never mentions.",
  },
  {
    n: "04",
    label: "+ Value-head warm-start",
    elo: 1927,
    delta: 67,
    where: "network",
    note: "The prose attributes this +67 to rerunning SFT over all 126M positions; the table calls it a value-head warm-start.",
  },
  {
    n: "05",
    label: "+ HL-Gauss value retrain",
    elo: 1988,
    ci: [1951, 2024],
    delta: 61,
    where: "network",
    note: "Soft Gaussian targets over the 64 win-probability bins, sigma = 1.5 bins.",
  },
  {
    n: "06",
    label: "+ GRPO polish",
    elo: 2004,
    ci: [1972, 2039],
    delta: 16,
    where: "network",
    note: "Stated to leave greedy play unchanged within the CI; the +16 shows up only when the policy is used as a search prior.",
  },
]

const COLOR: Record<Where, string> = {
  policy: "oklch(0.55 0.02 260)",
  search: "oklch(0.65 0.16 45)",
  network: "oklch(0.60 0.15 255)",
}

const LO = 1400
const HI = 2080
const W = 720
const BAR_X = 206
const BAR_W = W - BAR_X - 116
const ELO_LABEL_X = W - 56
const DELTA_LABEL_X = W
const ROW_H = 40
const H = ROWS.length * ROW_H + 30

const x = (elo: number) => BAR_X + ((elo - LO) / (HI - LO)) * BAR_W

const SEARCH_TOTAL = ROWS.filter((r) => r.where === "search").reduce((s, r) => s + (r.delta ?? 0), 0)
const NETWORK_TOTAL = ROWS.filter((r) => r.where === "network").reduce((s, r) => s + (r.delta ?? 0), 0)
const TOTAL = SEARCH_TOTAL + NETWORK_TOTAL

export function EloLadder() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          1452 &rarr; 2004, attributed
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          rows and deltas from the project&apos;s own recipe table
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Waterfall of the six ChessLFM configurations. Raw SFT policy 1452. Plus depth-3 tree search, +302, to 1754. Plus wider search and a repetition fix, +106, to approximately 1860. Plus value-head warm-start, +67, to 1927. Plus HL-Gauss value retrain, +61, to 1988 with a 95% interval of 1951 to 2024. Plus GRPO polish, +16, to 2004 with a 95% interval of 1972 to 2039. The two search rows account for 408 of the 552 points gained; the three network rows account for 144."
        >
          {[1400, 1500, 1600, 1700, 1800, 1900, 2000].map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                y1={8}
                x2={x(t)}
                y2={ROWS.length * ROW_H + 4}
                stroke="var(--border)"
                strokeWidth={1}
                strokeOpacity={0.45}
              />
              <text
                x={x(t)}
                y={ROWS.length * ROW_H + 20}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {t}
              </text>
            </g>
          ))}

          {ROWS.map((r, i) => {
            const prev = i === 0 ? LO : ROWS[i - 1].elo
            const y = i * ROW_H + 12
            const x0 = x(prev)
            const x1 = x(r.elo)
            return (
              <g key={r.n}>
                <text
                  x={0}
                  y={y + 13}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {r.n}
                </text>
                <text
                  x={22}
                  y={y + 13}
                  className="fill-foreground font-mono"
                  fontSize={10}
                >
                  {r.label}
                </text>
                {r.ci ? (
                  <g>
                    <line
                      x1={x(r.ci[0])}
                      y1={y + 9}
                      x2={x(r.ci[1])}
                      y2={y + 9}
                      stroke="var(--muted-foreground)"
                      strokeWidth={1.2}
                      strokeOpacity={0.7}
                    />
                    <line x1={x(r.ci[0])} y1={y + 5} x2={x(r.ci[0])} y2={y + 13} stroke="var(--muted-foreground)" strokeWidth={1.2} strokeOpacity={0.7} />
                    <line x1={x(r.ci[1])} y1={y + 5} x2={x(r.ci[1])} y2={y + 13} stroke="var(--muted-foreground)" strokeWidth={1.2} strokeOpacity={0.7} />
                  </g>
                ) : null}
                <rect
                  x={x0}
                  y={y + 3}
                  width={Math.max(x1 - x0, 2)}
                  height={13}
                  rx={2}
                  fill={COLOR[r.where]}
                  opacity={r.where === "policy" ? 0.35 : 0.85}
                />
                <text
                  x={ELO_LABEL_X}
                  y={y + 13}
                  textAnchor="end"
                  className="fill-foreground font-mono tabular-nums"
                  fontSize={10}
                  fontWeight={600}
                >
                  {r.approx ? "~" : ""}
                  {r.elo}
                </text>
                {r.delta !== null ? (
                  <text
                    x={DELTA_LABEL_X}
                    y={y + 13}
                    textAnchor="end"
                    className="font-mono tabular-nums"
                    fontSize={9.5}
                    fill={COLOR[r.where]}
                  >
                    +{r.delta}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.search }} aria-hidden />
              <span className="font-mono text-[11px] text-muted-foreground">search wrapper</span>
              <span className="ml-auto font-mono text-sm font-semibold tabular-nums text-foreground">
                +{SEARCH_TOTAL}
              </span>
            </div>
            <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">
              {Math.round((SEARCH_TOTAL / TOTAL) * 100)}% of the gain, and not one weight
              changed for it.
            </p>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.network }} aria-hidden />
              <span className="font-mono text-[11px] text-muted-foreground">network training</span>
              <span className="ml-auto font-mono text-sm font-semibold tabular-nums text-foreground">
                +{NETWORK_TOTAL}
              </span>
            </div>
            <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">
              All three rows are measured with search already on, and two of them train
              the value head, which the one-pass policy never consults.
            </p>
          </div>
        </div>

        <ol className="mt-3 mb-0 list-none space-y-1.5 pl-0">
          {ROWS.map((r) => (
            <li key={r.n} className="font-mono text-[11px] leading-5 text-muted-foreground">
              <span className="text-foreground/70">{r.n}</span> {r.note}
            </li>
          ))}
        </ol>
      </div>
    </figure>
  )
}
