// Seventeen domains, and the floor under each one.
//
// Accuracy is FluidInference's run of the native PyTorch checkpoint on the
// public development split of fastino/fast-decisions (reports/
// fast-decisions-native.json in FluidInference/gliner2-5-decide-coreml): hits
// over heads, one call per head, exact set match. Fastino's own headline number
// is on a held-out test split nobody outside can score.
//
// The two floors are mine, computed from the same 1,700 rows. "Chance" is the
// expected accuracy of a uniform pick for every head (1/K for a single-label
// head, 1/2^K for a multi-label one scored by exact set match), weighted by the
// domain's heads. "Majority" answers every head with its most frequent gold
// label set. Neither is a model; both are what the number has to be read
// against.
//
// Server-rendered SVG, zero JS, integer coordinates.

type Row = { d: string; acc: number; chance: number; major: number; heads: number; k: string }

const ROWS: Row[] = [
  { d: "review_sentiment", acc: 84.0, chance: 33.3, major: 36.0, heads: 100, k: "3" },
  { d: "document_type", acc: 79.0, chance: 8.3, major: 16.0, heads: 100, k: "12" },
  { d: "support_intent", acc: 76.0, chance: 3.6, major: 9.0, heads: 100, k: "28" },
  { d: "agent_handoff", acc: 76.0, chance: 50.0, major: 54.0, heads: 100, k: "2" },
  { d: "sports_recap", acc: 75.7, chance: 29.2, major: 33.3, heads: 300, k: "8 · 4 · 2" },
  { d: "benefits_request", acc: 75.0, chance: 30.6, major: 34.5, heads: 200, k: "9 · 2" },
  { d: "news_topic", acc: 69.0, chance: 10.0, major: 14.0, heads: 100, k: "10" },
  { d: "clinic_request", acc: 64.5, chance: 29.5, major: 34.5, heads: 200, k: "11 · 2" },
  { d: "banking_intent", acc: 64.0, chance: 6.3, major: 13.0, heads: 100, k: "16" },
  { d: "travel_request", acc: 63.0, chance: 8.3, major: 13.0, heads: 100, k: "12" },
  { d: "email_triage", acc: 59.3, chance: 34.4, major: 38.5, heads: 400, k: "8 · 4 · 2 · 2" },
  { d: "product_feedback", acc: 52.0, chance: 12.7, major: 20.0, heads: 200, k: "4 · 8m" },
  { d: "ticket_route", acc: 48.3, chance: 27.1, major: 30.0, heads: 300, k: "16 · 4 · 2" },
  { d: "paper_field", acc: 47.0, chance: 10.0, major: 16.0, heads: 100, k: "10" },
  { d: "restaurant_review", acc: 46.5, chance: 17.5, major: 28.5, heads: 200, k: "3 · 6m" },
  { d: "screen_tags", acc: 46.5, chance: 25.2, major: 36.5, heads: 200, k: "8m · 2" },
  { d: "support_topic", acc: 44.0, chance: 8.3, major: 11.0, heads: 100, k: "12" },
]

const ACC = "oklch(0.60 0.15 255)"
const MAJ = "oklch(0.62 0.16 45)"

export function DomainFloor() {
  const W = 820
  const top = 82
  const rowH = 24
  const H = top + ROWS.length * rowH + 52
  const x0 = 272
  const span = 480
  const px = (v: number) => x0 + Math.round((v / 100) * span)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        GLiNER2.5-Decide on the public split, against what no model at all would score
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="Seventeen horizontal bars, one per Fast Decisions domain, sorted by accuracy of GLiNER2.5-Decide on the public development split. Review sentiment is highest at 84 percent against a majority baseline of 36; support topic is lowest at 44 percent against a majority baseline of 11. Agent handoff, a yes or no head, scores 76 against a majority of 54 and chance of 50. The average of the seventeen domain accuracies is 62.93 percent; the average chance floor is 20.2 percent and the average majority floor 25.8 percent."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={16} y={24}>
            mean of domain accuracies 62.93% · chance 20.2% · majority 25.8%
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={16} y={42}>
            grey band = uniform guess · orange tick = always the most common answer · blue = the model
          </text>
          <text x={16} y={top - 10}>
            domain
          </text>
          <text x={x0 - 92} y={top - 10}>
            labels
          </text>
        </g>

        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line
              x1={px(t)}
              y1={top - 4}
              x2={px(t)}
              y2={top + ROWS.length * rowH}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
            <text
              x={px(t)}
              y={top + ROWS.length * rowH + 14}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {t}%
            </text>
          </g>
        ))}

        {ROWS.map((r, i) => {
          const y = top + i * rowH
          return (
            <g key={r.d}>
              <text
                x={16}
                y={y + 15}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {r.d}
              </text>
              <text
                x={x0 - 92}
                y={y + 15}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {r.k}
              </text>
              <rect
                x={x0}
                y={y + 4}
                width={px(r.chance) - x0}
                height={rowH - 8}
                className="fill-foreground/15"
              />
              <rect
                x={x0}
                y={y + 8}
                width={px(r.acc) - x0}
                height={rowH - 16}
                rx={2}
                fill={ACC}
                fillOpacity={0.75}
              />
              <line
                x1={px(r.major)}
                y1={y + 2}
                x2={px(r.major)}
                y2={y + rowH - 2}
                stroke={MAJ}
                strokeWidth={2}
              />
              <text
                x={px(r.acc) + 6}
                y={y + 15}
                className="fill-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {r.acc.toFixed(1)}
              </text>
            </g>
          )
        })}

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          <text x={16} y={H - 12}>
            accuracy: FluidInference, native PyTorch, dev split, 2,900 heads · floors: computed here from the same rows ·
            &quot;m&quot; = multi-label
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The label counts are the number of candidates per head in that domain, one
        entry per head. The domains with the most room above their floors are the
        ones with many labels and one right answer — support intent, document type,
        banking — which is also where the model card&apos;s examples live. The ones
        closest to their floors mix binary heads and multi-label exact-set scoring.
      </figcaption>
    </figure>
  )
}
