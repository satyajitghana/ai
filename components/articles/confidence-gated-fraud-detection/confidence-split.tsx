// Server-rendered, zero JS. Every dot is a row I read off the recording and
// committed to public/articles/confidence-gated-fraud-detection/data/rows.json.
//
// It is a convenience sample — whatever happened to be scrolled into view —
// so it says nothing about the shape of the distribution over all 100 emails.
// It does establish two things the tiles never print: the range on each side
// of the 95% gate, and that the legible misses all sit on the escalated side.

type Row = { id: string; conf: number; fraud: boolean; miss: boolean }

const ESCALATED: Row[] = [
  { id: "MSG-002", conf: 10, fraud: false, miss: false },
  { id: "MSG-083", conf: 13, fraud: true, miss: false },
  { id: "MSG-069", conf: 31, fraud: true, miss: false },
  { id: "MSG-039", conf: 75, fraud: false, miss: true },
  { id: "MSG-086", conf: 75, fraud: false, miss: false },
  { id: "MSG-012", conf: 78, fraud: false, miss: true },
  { id: "MSG-049", conf: 78, fraud: true, miss: false },
  { id: "MSG-076", conf: 80, fraud: false, miss: false },
  { id: "MSG-091", conf: 80, fraud: false, miss: true },
  { id: "MSG-052", conf: 87, fraud: true, miss: false },
  { id: "MSG-068", conf: 87, fraud: false, miss: false },
  { id: "MSG-053", conf: 89, fraud: true, miss: false },
  { id: "MSG-088", conf: 89, fraud: true, miss: false },
  { id: "MSG-057", conf: 93, fraud: false, miss: false },
  { id: "MSG-061", conf: 94, fraud: false, miss: false },
]

const DIRECT: Row[] = [
  { id: "MSG-099", conf: 97, fraud: true, miss: false },
  { id: "MSG-081", conf: 99, fraud: false, miss: false },
  { id: "MSG-082", conf: 99, fraud: false, miss: false },
  { id: "MSG-098", conf: 99, fraud: false, miss: false },
  { id: "MSG-100", conf: 100, fraud: true, miss: false },
]

const W = 620
const H = 210
const PL = 90
const PR = 18
const PT = 20
const PB = 34

const ESC_Y = PT + 34
const DIR_Y = PT + 112
const ROW_H = 60

const sx = (c: number) => PL + (c / 100) * (W - PL - PR)

// Deterministic vertical spread so overlapping values stay readable: fan the
// dots within a band by their index, no randomness, identical every render.
const fan = (i: number, baseY: number) => baseY + ((i % 5) - 2) * (ROW_H / 12)

const ESC = "oklch(0.70 0.15 300)" // Kimi K3 purple, as the app colours it
const DIR_C = "oklch(0.75 0.15 70)" // Jev amber
const MISS = "oklch(0.62 0.20 25)"

function Band({
  rows,
  baseY,
  color,
  label,
  sub,
}: {
  rows: Row[]
  baseY: number
  color: string
  label: string
  sub: string
}) {
  return (
    <g>
      <text
        x={PL - 10}
        y={baseY - 2}
        textAnchor="end"
        fontSize={10}
        className="fill-foreground font-mono"
      >
        {label}
      </text>
      <text
        x={PL - 10}
        y={baseY + 11}
        textAnchor="end"
        fontSize={9}
        className="fill-muted-foreground font-mono"
      >
        {sub}
      </text>
      {rows.map((r, i) => (
        <g key={r.id}>
          <circle
            cx={sx(r.conf)}
            cy={fan(i, baseY)}
            r={r.miss ? 6 : 4.5}
            fill={r.miss ? "none" : color}
            stroke={r.miss ? MISS : "none"}
            strokeWidth={r.miss ? 2 : 0}
            opacity={r.miss ? 1 : 0.75}
          />
          {r.miss ? (
            <circle cx={sx(r.conf)} cy={fan(i, baseY)} r={1.8} fill={MISS} />
          ) : null}
        </g>
      ))}
    </g>
  )
}

export function ConfidenceSplit() {
  const misses = ESCALATED.filter((r) => r.miss).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>20 of 100 rows, transcribed from the recording</span>
        <span className="tabular-nums">gate at 95%</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Jev confidence for twenty transcribed rows. Fifteen escalated rows span 10 to 94 percent; five accepted rows span 97 to 100 percent. ${misses} of the escalated rows are scored as misses.`}
        >
          {[0, 25, 50, 75, 95, 100].map((c) => (
            <g key={c}>
              <line
                x1={sx(c)}
                y1={PT}
                x2={sx(c)}
                y2={H - PB}
                stroke={c === 95 ? "var(--foreground)" : "var(--border)"}
                strokeWidth={c === 95 ? 1.4 : 0.7}
                strokeDasharray={c === 95 ? "4 3" : undefined}
                opacity={c === 95 ? 0.55 : 1}
              />
              <text
                x={sx(c)}
                y={H - PB + 14}
                textAnchor="middle"
                fontSize={9}
                className="fill-muted-foreground font-mono"
              >
                {c}
              </text>
            </g>
          ))}

          <text
            x={sx(95)}
            y={PT - 6}
            textAnchor="middle"
            fontSize={9}
            className="fill-foreground font-mono"
          >
            gate
          </text>

          <Band
            rows={ESCALATED}
            baseY={ESC_Y}
            color={ESC}
            label="escalated"
            sub="15 rows, 10-94%"
          />
          <Band
            rows={DIRECT}
            baseY={DIR_Y}
            color={DIR_C}
            label="accepted"
            sub="5 rows, 97-100%"
          />

          <text
            x={(PL + W - PR) / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            className="fill-muted-foreground font-mono"
          >
            Jev confidence, % {"→"}
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: ESC }}
            />
            Kimi K3 review
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: DIR_C }}
            />
            Jev direct
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full border-2"
              style={{ borderColor: MISS }}
            />
            scored wrong against the label
          </span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Nothing lands between 94 and 97, which is what a hard gate at 95 looks like.
        The three rings are the part that matters: every legible error in this run was
        an email Kimi K3 personally reviewed.
      </figcaption>
    </figure>
  )
}
