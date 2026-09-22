// Where Limite places on each benchmark in Paradigma's own table, rather than
// on the one benchmark the headline quotes. Server-rendered, zero JS.
//
// Every score is transcribed from the evaluation table published with the
// release (the same table reproduced as a figure in this article). Rank is
// computed among the models that have a score in that column -- the table is
// ragged, and several large models have a dash in most columns, so the
// denominator differs per benchmark and is printed.
//
// The split that matters: six of the seven columns are competition-format
// short-answer maths. The seventh, ArXivMath May 2026, is not.

type Row = { model: string; params: string; s: (number | null)[] }

const BENCH = [
  { name: "BeyondAIME", kind: "competition" },
  { name: "AIME 2026", kind: "competition" },
  { name: "HMMT Feb. 2025", kind: "competition" },
  { name: "AIME 2025", kind: "competition" },
  { name: "HMMT Feb. 2026", kind: "competition" },
  { name: "APEX Shortlist", kind: "competition" },
  { name: "ArXivMath May 2026", kind: "research" },
] as const

// Column order matches BENCH above.
const ROWS: Row[] = [
  { model: "Limite-1B-Violetto", params: "1B", s: [74.25, 94.01, 91.35, 90.21, 83.62, 50.8, 25.08] },
  { model: "VibeThinker-1.5B", params: "1.5B", s: [48.06, 70.94, 50.52, 72.92, 47.25, 10.84, 18.13] },
  { model: "MiniCPM5-2B", params: "2B", s: [60.59, 90.21, 78.02, 86.98, 67.8, 26.86, 21.8] },
  { model: "VibeThinker-3B", params: "3B", s: [72.0, 93.85, 88.23, 92.19, 78.98, 46.41, 29.77] },
  { model: "Qwen3.5-4B", params: "4B", s: [61.25, 89.66, 74.58, 82.19, 72.86, 32.51, 26.33] },
  { model: "Olmo-3-7B-Think", params: "7B", s: [41.0, 69.38, 42.6, 68.02, 41.95, 13.16, 18.05] },
  { model: "Olmo-3-7B-Instruct", params: "7B", s: [22.81, 44.27, 27.92, 39.38, 31.91, 6.18, 11.33] },
  { model: "OLMo-Hybrid-Think-SFT-7B", params: "7B", s: [36.41, 62.08, 35.1, 53.65, 35.89, 10.57, 15.47] },
  { model: "Qwen3.5-9B", params: "9B", s: [65.56, 90.42, 83.02, 88.75, 70.36, 30.72, 31.64] },
  { model: "Qwen3.5-27B", params: "27B", s: [null, 91.67, null, null, 81.06, 52.13, null] },
  { model: "Qwen3.6-27B", params: "27B", s: [null, 94.1, 93.8, null, 84.3, null, null] },
  { model: "MUSE-Glimmer-30B", params: "30B", s: [70.0, 93.44, 90.21, 92.71, 80.87, 51.66, 28.91] },
  { model: "Gemma-4-31B-IT", params: "31B", s: [71.0, 89.17, 86.88, 87.81, 77.08, 40.16, 35.78] },
  { model: "Qwen3.6-35B-A3B", params: "35B", s: [null, 92.7, 90.7, null, 83.6, null, null] },
  { model: "NVIDIA-Nemotron-3-Super", params: "120B", s: [null, 91.67, null, null, 84.85, 57.45, null] },
  { model: "GLM 5.2", params: "753B", s: [null, 99.2, null, null, 92.5, 68.09, 56.67] },
  { model: "Gemini 3 Pro (preview)", params: "n.d.", s: [null, 91.67, 97.5, 95.0, 86.36, 66.49, null] },
]

const LIMITE = ROWS[0]

function rankFor(col: number) {
  const scored = ROWS.map((r) => r.s[col]).filter((v): v is number => v !== null)
  const mine = LIMITE.s[col]!
  const above = scored.filter((v) => v > mine).length
  return { rank: above + 1, of: scored.length, mine }
}

const COMP = "oklch(0.58 0.14 200)"
const RESEARCH = "oklch(0.58 0.16 28)"

export function BenchSplit() {
  const cells = BENCH.map((b, i) => ({ ...b, ...rankFor(i) }))

  const W = 700
  const rowH = 30
  const L = 150
  const R = 120
  const H = cells.length * rowH + 30
  const maxOf = Math.max(...cells.map((c) => c.of))
  const track = W - L - R
  const px = (r: number) => L + ((r - 1) / (maxOf - 1)) * track

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Limite&apos;s rank in Paradigma&apos;s own table, column by column
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          17 models · ragged table, denominator printed
        </span>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[620px]"
          role="img"
          aria-label="Limite 1B ranks first of eleven on BeyondAIME, third of seventeen on AIME 2026, third of fourteen on HMMT February 2025, fourth of twelve on AIME 2025, fifth of seventeen on HMMT February 2026, sixth of fifteen on APEX Shortlist, and seventh of twelve on ArXivMath May 2026."
        >
          {cells.map((c, i) => {
            const y = i * rowH + 16
            const col = c.kind === "research" ? RESEARCH : COMP
            return (
              <g key={c.name}>
                <text
                  x={L - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-foreground font-mono"
                  style={{ fontSize: 10 }}
                >
                  {c.name}
                </text>
                <line
                  x1={L}
                  x2={px(c.of)}
                  y1={y}
                  y2={y}
                  className="stroke-foreground/12"
                  strokeWidth={5}
                  strokeLinecap="round"
                />
                <circle cx={px(c.rank)} cy={y} r={5.5} fill={col} />
                <text
                  x={px(c.of) + 12}
                  y={y + 4}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 9.5 }}
                >
                  {c.rank} of {c.of} · {c.mine.toFixed(2)}
                </text>
              </g>
            )
          })}
          <text
            x={L}
            y={H - 6}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 8.5 }}
          >
            ← better · rank among models with a score in that column · worse →
          </text>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Blue is a competition-format short-answer benchmark; red is the one
        column that is not. Limite is first on BeyondAIME, top-five on five more
        — and seventh of twelve on ArXivMath, behind a 3B, a 4B, a 9B, a 30B and
        a 31B. Ranks are computed from the release&apos;s own table; daggered
        rows in that table were sourced from model cards or MathArena rather
        than rerun.
      </figcaption>
    </figure>
  )
}
