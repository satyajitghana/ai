// What one decision costs an encoder, in the only unit that survives a noisy
// machine: tokens it has to run attention over.
//
// Both curves are measured, not modelled. The same context and the same option
// list were tokenised with ONE tokenizer (Xenova/nli-deberta-v3-xsmall, so the
// vocabulary is held fixed) in both packings:
//
//   cross-encoder  N rows, each (context, option), padded to the longest row.
//                  The context is re-encoded once per option. 98 / 245 / 784
//                  tokens at N = 2 / 5 / 16.
//   uni-encoder    one row: the context once, plus each option's own words and
//                  one marker token each. 50 / 68 / 126 tokens at the same N.
//
// The gap is the isolation guarantee, priced. Server-rendered SVG, integer
// coordinates, zero JS.

const CTX = 35 // context tokens, measured, no specials
const OPT = [7, 3, 5, 4, 6, 4, 3, 5, 1, 3, 3, 4, 6, 6, 5, 7] // per-option tokens, measured
const PAIR_MAX = 49 // longest (context, option) row, measured — the padded width

const MAXN = 16
const cross = (n: number) => n * PAIR_MAX
const uni = (n: number) => CTX + OPT.slice(0, n).reduce((a, b) => a + b, 0) + n + 3

export function TokenBudget() {
  const W = 700
  const H = 280
  const L = 62
  const R = 24
  const T = 28
  const B = 44
  const yMax = 800

  const sx = (n: number) => L + ((n - 1) / (MAXN - 1)) * (W - L - R)
  const sy = (v: number) => H - B - (v / yMax) * (H - T - B)

  const ns = Array.from({ length: MAXN }, (_, i) => i + 1)
  const pathOf = (f: (n: number) => number) =>
    ns.map((n, i) => `${i === 0 ? "M" : "L"}${sx(n)},${sy(f(n))}`).join(" ")

  const marks = [2, 5, 16]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        tokens encoded for one decision · measured with one tokenizer, both packings
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[620px]"
        role="img"
        aria-label="A line chart of tokens encoded for a single decision against the number of options, from 1 to 16. The cross-encoder line rises steeply and linearly, reaching 784 tokens at 16 options because each option is a separate row carrying its own copy of the context. The uni-encoder line rises gently to 126 tokens at 16 options, because the context appears once and each option adds only its own words. At two options the figures are 98 and 50; at five, 245 and 68; at sixteen, 784 and 126, a ratio of 6.2 times."
      >
        {/* grid */}
        {[0, 200, 400, 600, 800].map((v) => (
          <g key={v}>
            <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} className="stroke-border" strokeWidth={1} />
            <text x={L - 8} y={sy(v) + 4} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
              {v}
            </text>
          </g>
        ))}
        <text x={8} y={T - 12} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          tokens
        </text>

        {marks.map((n) => (
          <line key={n} x1={sx(n)} y1={T} x2={sx(n)} y2={H - B}
            className="stroke-border" strokeWidth={1} strokeDasharray="3 4" />
        ))}

        {/* curves */}
        <path d={pathOf(cross)} fill="none" strokeWidth={2} style={{ stroke: "oklch(0.58 0.19 27)" }} />
        <path d={pathOf(uni)} fill="none" strokeWidth={2} style={{ stroke: "oklch(0.55 0.16 155)" }} />

        {marks.map((n) => (
          <g key={`p${n}`}>
            <circle cx={sx(n)} cy={sy(cross(n))} r={3.5} style={{ fill: "oklch(0.58 0.19 27)" }} />
            <circle cx={sx(n)} cy={sy(uni(n))} r={3.5} style={{ fill: "oklch(0.55 0.16 155)" }} />
            <text x={sx(n) + (n === MAXN ? -7 : 7)} y={sy(cross(n)) - 6}
              textAnchor={n === MAXN ? "end" : "start"}
              className="font-mono" style={{ fontSize: 10, fill: "oklch(0.58 0.19 27)" }}>
              {cross(n)}
            </text>
            <text x={sx(n) + (n === MAXN ? -7 : 7)} y={sy(uni(n)) + 14}
              textAnchor={n === MAXN ? "end" : "start"}
              className="font-mono" style={{ fontSize: 10, fill: "oklch(0.55 0.16 155)" }}>
              {uni(n)}
            </text>
          </g>
        ))}

        {/* x axis */}
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} className="stroke-border" strokeWidth={1} />
        {[1, 4, 8, 12, 16].map((n) => (
          <text key={n} x={sx(n)} y={H - B + 16} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            {n}
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          options in the decision
        </text>

        {/* legend */}
        <g style={{ fontSize: 11 }} className="font-mono">
          <rect x={L + 8} y={T - 4} width={10} height={3} style={{ fill: "oklch(0.58 0.19 27)" }} />
          <text x={L + 24} y={T + 2} className="fill-foreground">cross-encoder — options isolated</text>
          <rect x={L + 8} y={T + 14} width={10} height={3} style={{ fill: "oklch(0.55 0.16 155)" }} />
          <text x={L + 24} y={T + 20} className="fill-foreground">uni-encoder — options share one sequence</text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Same context, same sixteen options, one tokenizer
        (<code>Xenova/nli-deberta-v3-xsmall</code>), counted both ways. The isolated shape pays a
        fresh copy of the context for every option — 49 tokens a row here, so 784 at sixteen
        options. The shared-sequence shape pays the context once and then only each option&rsquo;s
        own words: 126. That <strong>6.2×</strong> is not an implementation detail to optimise
        away; it is what &ldquo;the model doesn&rsquo;t see a level&rsquo;s neighbours&rdquo;
        costs, stated in tokens.
      </figcaption>
    </figure>
  )
}
