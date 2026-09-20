// What happens to 8,490 candidate link slots on the way to 287 live links.
//
// Read straight off the repo's own artifacts at commit 58f636e:
//
//   566 pages x 15 candidates          = 8,490 slots
//   out/jev-results.json               =  8,460 decisions asked
//     (two pages are under candidates.py's min_words=120 and get no targets)
//   verdicts clearing rubrics/v3.json  =  2,383  (link >= 0.65, anchor != none,
//                                           anchor_confidence >= 0.40)
//   out/linkmap.json                   =    679 placed
//   out/linkmap-verified.json          =    287 kept by the editor
//
// The step that matters is 2,383 -> 679. That is not the model being selective;
// it is judge.py:place_links enforcing rubric["max_links_per_page"] = 3 and one
// use per anchor phrase. 221 of the 334 linked pages had more than three
// candidates clear the bar, so 1,704 model "yes" answers were discarded by a
// constant in a JSON file.
//
// Server-rendered, zero JS.

const W = 760
const LABEL_W = 250
const BAR_X = LABEL_W
const BAR_W = W - LABEL_W - 120
const ROW_H = 46
const TOP = 26

const KEPT = "oklch(0.58 0.15 152)"
const CUT = "oklch(0.58 0.19 27)"
const CAP = "oklch(0.70 0.16 60)"

type Step = {
  n: number
  shown: string
  label: string
  sub: string
  tint: string
  drop?: string
}

const STEPS: Step[] = [
  {
    n: 8490,
    shown: "8,490",
    label: "candidate slots",
    sub: "566 pages x 15 targets",
    tint: "var(--muted-foreground)",
  },
  {
    n: 8460,
    shown: "8,460",
    label: "decisions asked",
    sub: "2 pages under 120 words get none",
    tint: "var(--muted-foreground)",
    drop: "30 slots never asked",
  },
  {
    n: 2383,
    shown: "2,383",
    label: "cleared the rubric",
    sub: "28.2% of the decisions said yes",
    tint: KEPT,
    drop: "6,077 no",
  },
  {
    n: 679,
    shown: "679",
    label: "placed",
    sub: "max_links_per_page = 3, one use per phrase",
    tint: CAP,
    drop: "1,704 yes answers discarded by the cap",
  },
  {
    n: 287,
    shown: "287",
    label: "kept by the editor",
    sub: "42.3% of what was placed",
    tint: KEPT,
    drop: "392 cut",
  },
]

const MAX = STEPS[0].n
const w = (n: number) => (n / MAX) * BAR_W

export function DecisionFunnel() {
  const H = TOP + STEPS.length * ROW_H + 10

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        out/report.json · out/linkmap.json · out/linkmap-verified.json —{" "}
        <span className="text-foreground">8,490 slots, 287 live links</span>
      </div>

      <div className="px-3 pt-3 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A five-step funnel. 8,490 candidate link slots, being 566 pages times 15 targets each. 8,460 decisions are actually asked, because two pages fall under the 120-word minimum and get no targets. 2,383 of those decisions clear the rubric, which is 28.2 percent. Only 679 links are placed, because the code caps each page at three links and allows each anchor phrase once, discarding 1,704 yes answers. The editor keeps 287 of the 679, cutting 392."
        >
          {STEPS.map((s, i) => {
            const y = TOP + i * ROW_H
            const prev = i > 0 ? STEPS[i - 1] : null
            return (
              <g key={s.label}>
                <text
                  x={BAR_X - 12}
                  y={y + 13}
                  textAnchor="end"
                  fontSize={12}
                  fill="var(--foreground)"
                >
                  {s.shown} {s.label}
                </text>
                <text
                  x={BAR_X - 12}
                  y={y + 28}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--muted-foreground)"
                >
                  {s.sub}
                </text>

                {prev ? (
                  <rect
                    x={BAR_X}
                    y={y}
                    width={w(prev.n)}
                    height={20}
                    rx={3}
                    fill={CUT}
                    fillOpacity={0.1}
                  />
                ) : null}
                <rect
                  x={BAR_X}
                  y={y}
                  width={Math.max(w(s.n), 2)}
                  height={20}
                  rx={3}
                  fill={s.tint}
                  fillOpacity={0.3}
                />
                <rect
                  x={BAR_X}
                  y={y}
                  width={Math.max(w(s.n), 2)}
                  height={20}
                  rx={3}
                  fill="none"
                  stroke={s.tint}
                  strokeWidth={1}
                  strokeOpacity={0.7}
                />

                {s.drop ? (
                  <text
                    x={BAR_X + Math.max(w(s.n), 2) + 8}
                    y={y + 14}
                    fontSize={10}
                    fill={i === 3 ? CAP : "var(--muted-foreground)"}
                  >
                    {s.drop}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The advertised selectivity — 679 links out of 8,460 decisions, 8% — is mostly the fourth
        bar. <span className="font-mono">28.2%</span> of the decisions said yes; the model was
        selective at roughly three times the rate the ratio implies. What cut it to 8% was{" "}
        <span className="font-mono">max_links_per_page: 3</span> in{" "}
        <span className="font-mono">rubrics/v3.json</span>, which threw away 1,704 yes answers on
        the 221 pages that had more than three. That is a useful cap. It is not a measurement of
        the model.
      </p>
    </figure>
  )
}
