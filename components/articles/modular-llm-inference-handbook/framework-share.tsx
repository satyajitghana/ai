// How much the handbook's framework coverage moved when it changed owners.
//
// The repository (github.com/modular/llm-inference-handbook) was opened on
// 2025-07-07 and every pull request merged into it came from a `bentoml/…`
// branch until #190 on 2026-07-29. From #192 (2026-08-03) onward the branches
// are `modular/…`, and several are named for the change they make:
// `docs/add-max-mentions`, `docs/more-max-mentions`, `docs/add-max-command`,
// `docs/update-max-messaging`.
//
// Both columns below are counts over the same corpus (docs/**/*.md*) at two
// revisions, made with word-boundary regexes so `--max-num-batched-tokens`
// does not count as a mention of MAX:
//
//   2c2c98a  2026-07-29  last BentoML-branch merge   52 files   61,633 words
//   0d64912  2026-09-21  HEAD                        57 files   70,493 words
//
// Densities are per 10,000 words so the comparison survives the corpus growing
// 14% between the two revisions. All arithmetic here is * and /.

type Row = { label: string; before: number; after: number }

const WORDS_BEFORE = 61633
const WORDS_AFTER = 70493

const ROWS: Row[] = [
  { label: "vLLM", before: 80, after: 117 },
  { label: "SGLang", before: 64, after: 104 },
  { label: "MAX", before: 27, after: 70 },
]

const per10k = (n: number, words: number) => (n / words) * 10000

export function FrameworkShare() {
  const W = 860
  const H = 300
  const left = 118
  const right = 690
  const top = 64
  const rowH = 62
  const MAXD = 18

  const x = (d: number) => left + (d / MAXD) * (right - left)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        mentions per 10,000 words of <code>docs/</code> &middot; hollow bar ={" "}
        <code>2c2c98a</code>, the last BentoML-branch merge &middot; solid bar ={" "}
        <code>0d64912</code>, HEAD
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="Three pairs of horizontal bars showing how often each inference framework is named per ten thousand words of the handbook, before and after it changed hands. vLLM goes from 12.98 to 16.60 mentions per ten thousand words. SGLang goes from 10.38 to 14.75. MAX, Modular's own product, goes from 4.38 to 9.93 — the largest relative increase of the three, and still the smallest absolute number."
      >
        {[0, 4, 8, 12, 16].map((d) => (
          <g key={d}>
            <line
              x1={x(d)}
              y1={top - 18}
              x2={x(d)}
              y2={top + ROWS.length * rowH - 20}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={x(d)}
              y={top - 26}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {d}
            </text>
          </g>
        ))}

        {ROWS.map((r, i) => {
          const y0 = top + i * rowH
          const b = per10k(r.before, WORDS_BEFORE)
          const a = per10k(r.after, WORDS_AFTER)
          const own = r.label === "MAX"
          return (
            <g key={r.label}>
              <text
                x={left - 12}
                y={y0 + 16}
                textAnchor="end"
                className="fill-foreground font-mono"
                style={{ fontSize: 13 }}
              >
                {r.label}
              </text>
              <text
                x={left - 12}
                y={y0 + 31}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {own ? "Modular's own" : "third party"}
              </text>

              <rect
                x={x(0)}
                y={y0}
                width={x(b) - x(0)}
                height={15}
                rx={2}
                className="fill-transparent stroke-foreground/55"
                strokeWidth={1.25}
                strokeDasharray="3 2"
              />
              <text
                x={x(b) + 8}
                y={y0 + 12}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {b.toFixed(2)} &middot; {r.before} mentions
              </text>

              <rect
                x={x(0)}
                y={y0 + 19}
                width={x(a) - x(0)}
                height={17}
                rx={2}
                className={
                  own
                    ? "fill-foreground/80 stroke-foreground"
                    : "fill-foreground/25 stroke-foreground/70"
                }
                strokeWidth={1.25}
              />
              <text
                x={x(a) + 8}
                y={y0 + 32}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {a.toFixed(2)} &middot; {r.after} mentions &middot;{" "}
                {(((a - b) / b) * 100).toFixed(0)}%
              </text>
            </g>
          )
        })}

        <text
          x={left - 12}
          y={top + ROWS.length * rowH + 14}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          corpus
        </text>
        <text
          x={left}
          y={top + ROWS.length * rowH + 14}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          {WORDS_BEFORE.toLocaleString("en-US")} &rarr;{" "}
          {WORDS_AFTER.toLocaleString("en-US")} words (+
          {(((WORDS_AFTER - WORDS_BEFORE) / WORDS_BEFORE) * 100).toFixed(0)}
          %) &middot; 9 of the 10 framework tab groups now list MAX first, and
          Docusaurus preselects the first tab
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The vendor push is real and it is measurable: MAX&rsquo;s density more
        than doubled in the eight weeks after the handover, the largest move of
        the three. It is also the whole of the push &mdash; after doubling, MAX
        is still named{" "}
        <strong className="font-medium text-foreground">
          less often than either competitor
        </strong>{" "}
        in Modular&rsquo;s own handbook.
      </figcaption>
    </figure>
  )
}
