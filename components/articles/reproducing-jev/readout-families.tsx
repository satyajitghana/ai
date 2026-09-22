// JevBench v1.3.0 hard tier, grouped by what kind of readout the system is and
// whether anyone trained it for the decision. 220 items, identical for every
// row; numbers read from benchmarkheaven.com/api/jevbench/v1.2 on 2026-09-22,
// including each row's `underlying` string, which is where the "trained / not
// trained" split comes from rather than my inference.
//
// Two panels because the interesting result needs both. On accuracy, two
// untrained decoders sit above every trained small encoder. On the suite's
// calibration axis the same two sit above them as well, and both sit below the
// closed model. The control that makes the accuracy panel mean something is the
// bottom band: a zero-shot *encoder* lands with the trained encoders, not with
// the untrained decoders. So the variable is the decoder, not the training.
//
// Server-rendered, exact arithmetic, no JS.

const ACCENT = "oklch(0.72 0.15 195)"

const W = 680
const H = 340

const LABEL_R = 152
const A_X0 = 168
const A_X1 = 392
const B_X0 = 436
const B_X1 = 660

const ROW_H = 17
const BAND_H = 15
const TOP = 48

type Row = { name: string; hard: number; calib: number }
type Band = { title: string; rows: Row[] }

const BANDS: Band[] = [
  {
    title: "decoder · nothing trained",
    rows: [
      { name: "jqv (Qwen3-32B)", hard: 142, calib: 79.0 },
      { name: "SemIf (Qwen3.5-4B)", hard: 131, calib: 72.6 },
    ],
  },
  {
    title: "decoder · trained for the decision",
    rows: [
      { name: "Bespoke Nimble 9B", hard: 144, calib: 65.3 },
      { name: "kev 8B", hard: 104, calib: 44.2 },
      { name: "kev 4B", hard: 93, calib: 42.0 },
      { name: "kev 0.6B", hard: 88, calib: 51.1 },
    ],
  },
  {
    title: "small encoder · trained for the decision",
    rows: [
      { name: "openJev Verdict 151M", hard: 84, calib: 51.3 },
      { name: "jeff (GLiFormer 400M)", hard: 83, calib: 64.6 },
      { name: "open-jev-deberta-v3-lg", hard: 80, calib: 66.4 },
      { name: "Laya 421M", hard: 75, calib: 62.5 },
    ],
  },
  {
    title: "small encoder · nothing trained (the control)",
    rows: [{ name: "OpenDecision 400M", hard: 73, calib: 56.1 }],
  },
]

const JEV_HARD = 163
const JEV_CALIB = 82.7

const HARD_MAX = 176 // 0.8 of 220, a round axis top above every row
const CALIB_MAX = 100

const ax = (correct: number) => A_X0 + (correct / HARD_MAX) * (A_X1 - A_X0)
const bx = (score: number) => B_X0 + (score / CALIB_MAX) * (B_X1 - B_X0)

// Pre-compute the y of every row and band header once, so the two panels and
// the labels cannot drift apart.
type Placed = { kind: "band"; title: string; y: number } | { kind: "row"; row: Row; y: number }

const PLACED: Placed[] = (() => {
  const out: Placed[] = []
  let cursor = TOP
  for (const band of BANDS) {
    out.push({ kind: "band", title: band.title, y: cursor })
    cursor += BAND_H
    for (const row of band.rows) {
      out.push({ kind: "row", row, y: cursor })
      cursor += ROW_H
    }
    cursor += 5
  }
  return out
})()

const LAST_Y = PLACED[PLACED.length - 1].y + ROW_H

const A_TICKS = [44, 88, 132, 176]
const B_TICKS = [0, 50, 100]

export function ReadoutFamilies() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        JevBench v1.3.0 hard tier · 220 identical items · 111 public, 109 held out
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Two dot plots sharing one set of rows, grouped into four bands. Band one, decoder with nothing trained: jqv on Qwen3-32B at 142 of 220 and calibration 79.0, SemIf on a frozen Qwen3.5-4B at 131 of 220 and calibration 72.6. Band two, decoder trained for the decision: Bespoke Nimble 9B at 144 of 220 and calibration 65.3, kev 8B at 104 and 44.2, kev 4B at 93 and 42.0, kev 0.6B at 88 and 51.1. Band three, small encoder trained for the decision: openJev Verdict 151M at 84 of 220 and calibration 51.3, jeff on GLiFormer 400M at 83 and 64.6, open-jev-deberta-v3-large at 80 and 66.4, Laya 421M at 75 and 62.5. Band four, the control, a small encoder with nothing trained: OpenDecision 400M at 73 of 220 and calibration 56.1. A dashed vertical line in each panel marks Jev 1.13.0 at 163 of 220 and calibration 82.7. Every untrained decoder sits to the right of every trained small encoder on both panels, while the untrained encoder control sits with the trained encoders."
        >
          <defs>
            <filter id="rj-rf-soft" x="-70%" y="-70%" width="240%" height="240%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.18" />
            </filter>
          </defs>

          <text
            x={A_X0}
            y={18}
            className="font-mono"
            fontSize="9"
            fontWeight={700}
            fill="currentColor"
            fillOpacity="0.85"
          >
            correct of 220
          </text>
          <text
            x={B_X0}
            y={18}
            className="font-mono"
            fontSize="9"
            fontWeight={700}
            fill="currentColor"
            fillOpacity="0.85"
          >
            calibration axis, 0&ndash;100
          </text>

          {A_TICKS.map((t) => (
            <g key={`at${t}`}>
              <line
                x1={ax(t)}
                y1={TOP - 16}
                x2={ax(t)}
                y2={LAST_Y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="2 6"
              />
              <text
                x={ax(t)}
                y={TOP - 19}
                textAnchor="middle"
                className="font-mono"
                fontSize="7.5"
                fill="currentColor"
                fillOpacity="0.35"
              >
                {t}
              </text>
            </g>
          ))}
          {B_TICKS.map((t) => (
            <g key={`bt${t}`}>
              <line
                x1={bx(t)}
                y1={TOP - 16}
                x2={bx(t)}
                y2={LAST_Y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="2 6"
              />
              <text
                x={bx(t)}
                y={TOP - 19}
                textAnchor="middle"
                className="font-mono"
                fontSize="7.5"
                fill="currentColor"
                fillOpacity="0.35"
              >
                {t}
              </text>
            </g>
          ))}

          <line
            x1={ax(JEV_HARD)}
            y1={TOP - 16}
            x2={ax(JEV_HARD)}
            y2={LAST_Y + 6}
            stroke={ACCENT}
            strokeWidth={1.4}
            strokeDasharray="4 3"
          />
          <line
            x1={bx(JEV_CALIB)}
            y1={TOP - 16}
            x2={bx(JEV_CALIB)}
            y2={LAST_Y + 6}
            stroke={ACCENT}
            strokeWidth={1.4}
            strokeDasharray="4 3"
          />
          <text
            x={ax(JEV_HARD)}
            y={LAST_Y + 17}
            textAnchor="middle"
            className="font-mono"
            fontSize="8"
            fontWeight={700}
            fill={ACCENT}
          >
            Jev 163
          </text>
          <text
            x={bx(JEV_CALIB)}
            y={LAST_Y + 17}
            textAnchor="middle"
            className="font-mono"
            fontSize="8"
            fontWeight={700}
            fill={ACCENT}
          >
            Jev 82.7
          </text>

          {PLACED.map((p, i) => {
            if (p.kind === "band") {
              return (
                <g key={`b${i}`}>
                  <text
                    x={8}
                    y={p.y + 11}
                    className="font-mono"
                    fontSize="8"
                    fontWeight={700}
                    fill="currentColor"
                    fillOpacity="0.55"
                  >
                    {p.title}
                  </text>
                  <line
                    x1={8}
                    y1={p.y + 15}
                    x2={W - 8}
                    y2={p.y + 15}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                </g>
              )
            }
            const cy = p.y + ROW_H / 2 + 1
            const untrainedDecoder = p.row.name.startsWith("jqv") || p.row.name.startsWith("SemIf")
            return (
              <g key={`r${i}`}>
                <text
                  x={LABEL_R}
                  y={cy + 3}
                  textAnchor="end"
                  className="font-mono"
                  fontSize="8.5"
                  fontWeight={untrainedDecoder ? 700 : 400}
                  fill="currentColor"
                  fillOpacity={untrainedDecoder ? 0.95 : 0.7}
                >
                  {p.row.name}
                </text>
                <line
                  x1={A_X0}
                  y1={cy}
                  x2={ax(p.row.hard)}
                  y2={cy}
                  stroke={untrainedDecoder ? ACCENT : "currentColor"}
                  strokeOpacity={untrainedDecoder ? 0.45 : 0.16}
                  strokeWidth={1.5}
                />
                <circle
                  cx={ax(p.row.hard)}
                  cy={cy}
                  r={untrainedDecoder ? 4.5 : 3.5}
                  fill={untrainedDecoder ? ACCENT : "var(--background)"}
                  stroke={untrainedDecoder ? ACCENT : "currentColor"}
                  strokeOpacity={untrainedDecoder ? 1 : 0.55}
                  strokeWidth={1.5}
                  filter="url(#rj-rf-soft)"
                />
                <line
                  x1={B_X0}
                  y1={cy}
                  x2={bx(p.row.calib)}
                  y2={cy}
                  stroke={untrainedDecoder ? ACCENT : "currentColor"}
                  strokeOpacity={untrainedDecoder ? 0.45 : 0.16}
                  strokeWidth={1.5}
                />
                <circle
                  cx={bx(p.row.calib)}
                  cy={cy}
                  r={untrainedDecoder ? 4.5 : 3.5}
                  fill={untrainedDecoder ? ACCENT : "var(--background)"}
                  stroke={untrainedDecoder ? ACCENT : "currentColor"}
                  strokeOpacity={untrainedDecoder ? 1 : 0.55}
                  strokeWidth={1.5}
                  filter="url(#rj-rf-soft)"
                />
              </g>
            )
          })}
        </svg>
      </div>
    </figure>
  )
}
