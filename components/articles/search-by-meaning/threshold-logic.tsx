// What --level actually does to the logic, read straight off semgrep.mjs.
//
// The matcher is one line (semgrep.mjs:275):
//
//   expr.some(term => term.every(([m, not]) => (not ? p[m] < tNeg : p[m] >= tPos)))
//
// so a positive literal is true when p >= tPos and a negative literal is true
// when p < tNeg — two independent cutoffs, not two sides of one. The presets
// (semgrep.mjs:159) set them in opposite directions:
//
//   loose  [tPos 0.3, tNeg 0.7]
//   normal [tPos 0.5, tNeg 0.5]
//   strict [tPos 0.7, tNeg 0.3]
//
// Only `normal` makes them meet. Everywhere else a band opens between them, and
// the sign of the band decides which law of classical logic you lose:
//
//   loose  — p in [0.3, 0.7): both `-e X` and `-v X` match the same line.
//            Non-contradiction fails; the algebra is paraconsistent.
//   strict — p in [0.3, 0.7): neither matches. Excluded middle fails; this is a
//            truth-value gap, Kleene's third value in everything but name.
//
// The fourth row is the operating point the project's own threshold sweep picks
// as best by F1 (tests/report.md, 2026-09-19): -t 0.45 -T 0.65, a 0.20-wide
// overlap. The tuned optimum is one of the inconsistent ones.
//
// Server-rendered, zero JS — this is a reference table that happens to be drawn.

const W = 760
const AX0 = 116
const AX1 = W - 130
const SPAN = AX1 - AX0
const ROW_H = 62
const TOP = 34

const POS = "oklch(0.58 0.15 152)"
const NEG = "oklch(0.58 0.19 27)"
const BOTH = "oklch(0.70 0.16 60)"

type Row = {
  name: string
  tPos: number
  tNeg: number
  law: string
  note: string
}

const ROWS: Row[] = [
  { name: "loose", tPos: 0.3, tNeg: 0.7, law: "both true", note: "non-contradiction fails" },
  { name: "normal", tPos: 0.5, tNeg: 0.5, law: "clean split", note: "the only classical setting" },
  { name: "strict", tPos: 0.7, tNeg: 0.3, law: "neither true", note: "excluded middle fails" },
  { name: "tuned best", tPos: 0.45, tNeg: 0.65, law: "both true", note: "report.md's own optimum" },
]

const x = (p: number) => AX0 + p * SPAN

export function ThresholdLogic() {
  const H = TOP + ROWS.length * ROW_H + 30

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        semgrep.mjs:275 · when is <span className="text-foreground">-e X</span> true, and when is{" "}
        <span className="text-foreground">-v X</span> true
      </div>

      <div className="px-3 pt-3 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Four probability axes from 0 to 1, one per threshold setting. For loose, with a positive threshold of 0.3 and a negative threshold of 0.7, the region where the meaning matches and the region where its negation matches overlap between 0.3 and 0.7, so both are true at once. For normal, both thresholds are 0.5 and the two regions meet exactly, partitioning the axis. For strict, positive 0.7 and negative 0.3, a gap opens between 0.3 and 0.7 where neither the meaning nor its negation matches. The fourth row, the threshold pair the project's own sweep reports as best, sets positive 0.45 and negative 0.65 and overlaps by 0.20."
        >
          <defs>
            <pattern id="tl-both" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={BOTH} fillOpacity="0.14" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={BOTH} strokeWidth="1.6" strokeOpacity="0.5" />
            </pattern>
            <pattern id="tl-gap" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeWidth="1" strokeOpacity="0.4" />
            </pattern>
          </defs>

          {/* scale header */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                y1={TOP - 12}
                x2={x(t)}
                y2={TOP + ROWS.length * ROW_H - 26}
                stroke="var(--border)"
                strokeWidth={1}
                strokeOpacity={t === 0 || t === 1 ? 1 : 0.4}
              />
              <text x={x(t)} y={TOP - 18} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          <text x={AX0 - 10} y={TOP - 18} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
            p
          </text>

          {ROWS.map((r, i) => {
            const y = TOP + i * ROW_H
            const bar = 15
            const overlap = r.tNeg - r.tPos // > 0 => both true, < 0 => neither
            const lo = Math.min(r.tPos, r.tNeg)
            const hi = Math.max(r.tPos, r.tNeg)
            return (
              <g key={r.name}>
                <text x={AX0 - 12} y={y + 12} textAnchor="end" fontSize={12} fill="var(--foreground)">
                  {r.name}
                </text>
                <text x={AX0 - 12} y={y + 27} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
                  -t {r.tPos} -T {r.tNeg}
                </text>

                {/* "not X" region: p < tNeg */}
                <rect x={x(0)} y={y} width={x(r.tNeg) - x(0)} height={bar} rx={3} fill={NEG} fillOpacity={0.16} />
                <text x={x(0) + 6} y={y + 11} fontSize={10} fill={NEG}>
                  -v X
                </text>

                {/* "X" region: p >= tPos */}
                <rect
                  x={x(r.tPos)}
                  y={y + bar + 4}
                  width={x(1) - x(r.tPos)}
                  height={bar}
                  rx={3}
                  fill={POS}
                  fillOpacity={0.16}
                />
                <text x={x(1) - 6} y={y + bar + 15} textAnchor="end" fontSize={10} fill={POS}>
                  -e X
                </text>

                {/* the band between the two cutoffs */}
                {Math.abs(overlap) > 1e-9 ? (
                  <>
                    <rect
                      x={x(lo)}
                      y={y - 3}
                      width={x(hi) - x(lo)}
                      height={bar * 2 + 10}
                      rx={4}
                      fill={overlap > 0 ? "url(#tl-both)" : "url(#tl-gap)"}
                      stroke={overlap > 0 ? BOTH : "var(--muted-foreground)"}
                      strokeWidth={1}
                      strokeOpacity={0.6}
                    />
                    <text
                      x={(x(lo) + x(hi)) / 2}
                      y={y + bar + 32}
                      textAnchor="middle"
                      fontSize={10}
                      fill={overlap > 0 ? BOTH : "var(--muted-foreground)"}
                    >
                      {overlap > 0 ? "both true" : "neither true"} · width {Math.abs(overlap).toFixed(2)}
                    </text>
                  </>
                ) : (
                  <>
                    <line
                      x1={x(r.tPos)}
                      y1={y - 3}
                      x2={x(r.tPos)}
                      y2={y + bar * 2 + 7}
                      stroke="var(--foreground)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={x(r.tPos)}
                      y={y + bar + 32}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--muted-foreground)"
                    >
                      partition · width 0.00
                    </text>
                  </>
                )}

                <text x={AX1 + 12} y={y + 12} fontSize={11} fill={overlap > 0 ? BOTH : overlap < 0 ? "var(--muted-foreground)" : "var(--foreground)"}>
                  {r.law}
                </text>
                <text x={AX1 + 12} y={y + 27} fontSize={10} fill="var(--muted-foreground)">
                  {r.note}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="font-mono">-t</span> is the cutoff for a meaning and{" "}
        <span className="font-mono">-T</span> the cutoff for its negation, and the presets move them
        in opposite directions. Only <span className="font-mono">normal</span> leaves them equal, so
        only <span className="font-mono">normal</span> gives you the classical boolean algebra the
        README advertises. The two-sided form is deliberate — the help text says so outright (
        <span className="font-mono">&ldquo;with -t 0.6 -T 0.3 a line at 0.3..0.6 matches neither X
        nor not-X&rdquo;</span>) — but the paraconsistent half of it is not mentioned anywhere.
      </p>
    </figure>
  )
}
