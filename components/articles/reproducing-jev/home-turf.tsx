// Home turf, and somebody else's.
//
// Left: the accuracy each project published, on data it chose. Right: the same
// system's hard-tier accuracy on JevBench v1.3.0 — 220 items, 111 public and
// 109 held out, frozen 2026-09-19, none of these systems trained on it.
// Numbers from benchmarkheaven.com/api/jevbench/v1.2, read 2026-09-22.
//
// The two columns are different tasks, so a line's *slope* is not a measured
// degradation and must not be read as one. What is readable is the ordering
// inside each column, and the ordering inverts: Laya is above Jev on the left
// and 88 items below it on the right. Jev is the control — cold on both, and
// flat.
//
// Server-rendered, integer-ish geometry from exact arithmetic (no transcendental
// maths reaches the DOM), no JS.

const ACCENT = "oklch(0.72 0.15 195)"

const W = 680
const H = 300

const LEFT_X = 214
const RIGHT_X = 470
const Y_TOP = 46
const Y_BOT = 250
const LO = 0.3
const HI = 0.95

const y = (v: number) => Y_BOT - ((v - LO) / (HI - LO)) * (Y_BOT - Y_TOP)

type Row = {
  name: string
  home: number
  homeNote: string
  away: number
  awayNote: string
  dyLeft?: number
  dyRight?: number
  control?: boolean
}

const ROWS: Row[] = [
  {
    name: "Bespoke Nimble 9B",
    home: 0.9012,
    homeNote: "0.901",
    away: 0.6545,
    awayNote: "144/220",
    dyRight: -2,
  },
  {
    name: "open-jev-deberta",
    home: 0.852,
    homeNote: "0.852",
    away: 0.3636,
    awayNote: "80/220",
    dyRight: -5,
  },
  {
    name: "Laya 421M",
    home: 0.766,
    homeNote: "0.766",
    away: 0.3409,
    awayNote: "75/220",
    dyRight: 7,
  },
  {
    name: "Jev 1.13.0",
    home: 0.727,
    homeNote: "0.727",
    away: 0.7409,
    awayNote: "163/220",
    control: true,
  },
]

const GRID = [0.4, 0.6, 0.8]

export function HomeTurf() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the number each project published · the same system on someone else&rsquo;s items
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A slope chart with two vertical axes. The left axis holds the accuracy each project published on data it chose: Bespoke Nimble 9B at 0.901, open-jev-deberta at 0.852, Laya at 0.766 and Jev 1.13.0 at 0.727, so Laya sits above Jev. The right axis holds the same systems' hard-tier accuracy on JevBench version 1.3, 220 items none of them trained on: Jev at 163 of 220, Nimble at 144 of 220, open-jev-deberta at 80 of 220 and Laya at 75 of 220. Jev's line is nearly flat and highlighted; the other three fall steeply and cross it, so the ordering between Jev and every challenger reverses between the two columns."
        >
          <defs>
            <filter id="rj-ht-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {GRID.map((g) => (
            <g key={g}>
              <line
                x1={LEFT_X}
                y1={y(g)}
                x2={RIGHT_X}
                y2={y(g)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="2 5"
              />
              <text
                x={(LEFT_X + RIGHT_X) / 2}
                y={y(g) - 4}
                textAnchor="middle"
                className="font-mono"
                fontSize="7.5"
                fill="currentColor"
                fillOpacity="0.32"
              >
                {g.toFixed(1)}
              </text>
            </g>
          ))}

          <line x1={LEFT_X} y1={Y_TOP - 14} x2={LEFT_X} y2={Y_BOT + 14} stroke="var(--border)" />
          <line x1={RIGHT_X} y1={Y_TOP - 14} x2={RIGHT_X} y2={Y_BOT + 14} stroke="var(--border)" />

          <text
            x={LEFT_X}
            y={Y_TOP - 24}
            textAnchor="end"
            className="font-mono"
            fontSize="9"
            fontWeight={700}
            fill="currentColor"
            fillOpacity="0.8"
          >
            its own data
          </text>
          <text
            x={RIGHT_X}
            y={Y_TOP - 24}
            className="font-mono"
            fontSize="9"
            fontWeight={700}
            fill="currentColor"
            fillOpacity="0.8"
          >
            JevBench hard tier
          </text>

          {ROWS.map((r) => {
            const y1 = y(r.home)
            const y2 = y(r.away)
            const mx = (LEFT_X + RIGHT_X) / 2
            return (
              <g key={r.name}>
                <path
                  d={`M ${LEFT_X} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${RIGHT_X} ${y2}`}
                  fill="none"
                  stroke={r.control ? ACCENT : "currentColor"}
                  strokeOpacity={r.control ? 1 : 0.38}
                  strokeWidth={r.control ? 2 : 1.4}
                />
                <circle
                  cx={LEFT_X}
                  cy={y1}
                  r={r.control ? 4 : 3}
                  fill="var(--background)"
                  stroke={r.control ? ACCENT : "currentColor"}
                  strokeOpacity={r.control ? 1 : 0.5}
                  strokeWidth={1.6}
                  filter="url(#rj-ht-soft)"
                />
                <circle
                  cx={RIGHT_X}
                  cy={y2}
                  r={r.control ? 4 : 3}
                  fill="var(--background)"
                  stroke={r.control ? ACCENT : "currentColor"}
                  strokeOpacity={r.control ? 1 : 0.5}
                  strokeWidth={1.6}
                  filter="url(#rj-ht-soft)"
                />
                <text
                  x={LEFT_X - 12}
                  y={y1 + 3 + (r.dyLeft ?? 0)}
                  textAnchor="end"
                  className="font-mono"
                  fontSize="9"
                  fontWeight={r.control ? 700 : 400}
                  fill={r.control ? ACCENT : "currentColor"}
                  fillOpacity={r.control ? 1 : 0.72}
                >
                  {`${r.name} · ${r.homeNote}`}
                </text>
                <text
                  x={RIGHT_X + 12}
                  y={y2 + 3 + (r.dyRight ?? 0)}
                  className="font-mono"
                  fontSize="9"
                  fontWeight={r.control ? 700 : 400}
                  fill={r.control ? ACCENT : "currentColor"}
                  fillOpacity={r.control ? 1 : 0.72}
                >
                  {r.awayNote}
                </text>
              </g>
            )
          })}

          <text
            x={16}
            y={H - 14}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.55"
          >
            different tasks, so the slope is not a degradation — what moves is the ordering, and
            only Jev&rsquo;s line is flat
          </text>
        </svg>
      </div>
    </figure>
  )
}
