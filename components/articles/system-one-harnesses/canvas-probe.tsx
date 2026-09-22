// SystemOneHarness's own canvas probe, drawn — the best measured evidence in
// any of these repositories that the enumerator, not the model, is the ceiling.
//
// The harness renders a <canvas> game into an ASCII grid (one character per
// cell, colours quantised to 4 bits and named), then asks Jev six questions
// about it. The probe sweeps eight encodings: four resolutions, each plain and
// with the operator's colour names attached. Thirty frames per encoding, five
// live runs. docs/reports/canvas-probe-2026-09-19.json.
//
// The number that matters is `base`: the majority-class score, i.e. what you
// get by ignoring the state and always answering the commonest label. The
// frames are lopsided (0 enemies in 30 frames, 1 gap, 29 of 30 "run right"),
// so `base` is 0.97 to 1.00 everywhere. Not one encoding beats it on the one
// question the loop actually needs answered.
//
// Server-rendered SVG, zero JS. Integer and rational arithmetic only, so no
// lib/dmath wrappers are needed and nothing can disagree between Node and the
// browser.

const ACCENT = "oklch(0.60 0.15 255)"

const QUESTIONS = [
  { key: "enemy", label: "enemy\nahead", base: 1.0 },
  { key: "gap", label: "gap\nahead", base: 0.97 },
  { key: "obstacle", label: "obstacle\nahead", base: 1.0 },
  { key: "ground", label: "on\nground", base: 1.0 },
  { key: "where", label: "player\nwhere", base: 1.0 },
  { key: "next", label: "next\ncontrol", base: 0.97 },
]

// acc in the order of QUESTIONS
const ROWS: { render: string; tokens: number; acc: number[] }[] = [
  { render: "32x16 plain", tokens: 1038, acc: [0.03, 0.97, 0.0, 1.0, 1.0, 0.03] },
  { render: "32x16 named", tokens: 1120, acc: [0.0, 0.03, 0.0, 0.0, 0.97, 0.03] },
  { render: "64x32 plain", tokens: 1537, acc: [0.5, 0.97, 0.83, 0.0, 1.0, 0.03] },
  { render: "64x32 named", tokens: 1686, acc: [0.0, 0.43, 0.0, 0.0, 0.63, 0.03] },
  { render: "96x48 plain", tokens: 2197, acc: [0.9, 0.97, 0.33, 1.0, 1.0, 0.03] },
  { render: "96x48 named", tokens: 2355, acc: [0.17, 0.97, 1.0, 0.0, 1.0, 0.5] },
  { render: "128x64 plain", tokens: 3277, acc: [0.7, 0.97, 0.0, 0.9, 0.0, 0.27] },
  { render: "128x64 named", tokens: 3442, acc: [0.2, 0.03, 0.97, 0.0, 1.0, 0.4] },
]

export function CanvasProbe() {
  const W = 820
  const labelW = 132
  const tokW = 58
  const cellW = 96
  const cellH = 34
  const gridX = labelW + tokW
  const top = 66
  const H = top + ROWS.length * cellH + 74

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        canvas probe · 8 encodings × 6 questions × 30 frames · jev 1.13 · 2026-09-19
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[740px]"
        role="img"
        aria-label="A grid of accuracy figures. Rows are eight ways of encoding a canvas game into text, from 32 by 16 characters at 1,038 tokens up to 128 by 64 at 3,442 tokens, each in a plain and a colour-named variant. Columns are six questions asked about each frame: enemy ahead, gap ahead, obstacle ahead, on ground, where the player is, and which control to hold next. Accuracy swings wildly between encodings on every question, with no ordering by resolution. The last column, which control to hold next, is the only question the loop needs answered: its best score is 0.50 at the 96 by 48 named encoding, against a majority-class baseline of 0.97. No cell in that column reaches its baseline, and across all forty-eight cells only thirteen do."
      >
        {/* column headers */}
        {QUESTIONS.map((q, ci) => {
          const cx = gridX + ci * cellW + cellW / 2
          const lines = q.label.split("\n")
          return (
            <g key={q.key}>
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={cx}
                  y={20 + li * 12}
                  textAnchor="middle"
                  className={ci === 5 ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  style={{ fontSize: 10.5 }}
                >
                  {line}
                </text>
              ))}
              <text
                x={cx}
                y={56}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                base {q.base.toFixed(2)}
              </text>
            </g>
          )
        })}

        <text x={14} y={56} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          encoding
        </text>
        <text
          x={gridX - 10}
          y={56}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          tokens
        </text>

        {/* the next_control column, marked as the one that matters */}
        <rect
          x={gridX + 5 * cellW - 3}
          y={top - 26}
          width={cellW + 6}
          height={ROWS.length * cellH + 32}
          rx={5}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          opacity={0.7}
        />

        {ROWS.map((row, ri) => {
          const y = top + ri * cellH
          return (
            <g key={row.render}>
              <text
                x={14}
                y={y + 20}
                className="fill-foreground font-mono"
                style={{ fontSize: 10.5 }}
              >
                {row.render}
              </text>
              <text
                x={gridX - 10}
                y={y + 20}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {row.tokens}
              </text>
              {row.acc.map((a, ci) => {
                const meets = a >= QUESTIONS[ci]!.base
                const x = gridX + ci * cellW
                // bar width is a plain rational scale: no transcendentals anywhere
                const barW = ((cellW - 44) * Math.round(a * 100)) / 100
                return (
                  <g key={ci}>
                    <rect
                      x={x + 6}
                      y={y + 8}
                      width={cellW - 44}
                      height={14}
                      rx={3}
                      className="fill-muted"
                      opacity={0.5}
                    />
                    <rect
                      x={x + 6}
                      y={y + 8}
                      width={barW}
                      height={14}
                      rx={3}
                      fill={meets ? ACCENT : "var(--muted-foreground)"}
                      opacity={meets ? 0.95 : 0.55}
                    />
                    <text
                      x={x + cellW - 8}
                      y={y + 19}
                      textAnchor="end"
                      className={meets ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                      style={{ fontSize: 10 }}
                    >
                      {a.toFixed(2)}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}

        <text
          x={14}
          y={H - 44}
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          13 of 48 cells reach the majority-class baseline. None of them is in the boxed column.
        </text>
        <text x={14} y={H - 28} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          `base` is what you score by ignoring the state and always answering the commonest label. Thirty
        </text>
        <text x={14} y={H - 14} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          frames held 0 enemies, 1 gap and 29 &ldquo;run right&rdquo;, so the baselines are high and the bar is honest.
        </text>
      </svg>
    </figure>
  )
}
