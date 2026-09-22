// What "near-lossless" can and cannot mean at these sample sizes.
//
// For two independent runs scoring the same n items at roughly the same rate p,
// the standard deviation of the observed difference is sqrt(2 p (1-p) / n).
// That is the smallest gap the benchmark can tell apart from noise. Every
// observed gap in the LMSYS post is plotted against its own benchmark's one-
// sigma band.
//
// Gaps and sample sizes come from the post: GSM8K 1,311 scored questions,
// GPQA-Diamond 198 questions scored twice, AIME 2025 30 questions scored twice,
// SWE-bench Verified 500 tasks. Where the post reports counts rather than
// percentages I use the counts (381/500 against 389/500 is 1.60 points).
//
// sqrt is exact per IEEE-754, so this needs no lib/dmath wrapper; anything with
// exp, log or pow would.

type Bench = {
  name: string
  model: string
  n: number
  p: number
  gap: number
}

const BENCHES: Bench[] = [
  { name: "GSM8K", model: "Qwen3.5-397B-A17B", n: 1311, p: 0.96, gap: 0.08 },
  { name: "GSM8K", model: "Qwen3.8-27B", n: 1311, p: 0.96, gap: 0.31 },
  { name: "GPQA-Diamond", model: "Qwen3.8-27B", n: 396, p: 0.8, gap: 1.01 },
  { name: "AIME 2025", model: "Qwen3.8-27B", n: 60, p: 0.983, gap: 0.0 },
  { name: "SWE-bench Verified", model: "Qwen3.8-27B", n: 500, p: 0.77, gap: 1.6 },
]

const sigma = (p: number, n: number) => Math.sqrt((2 * p * (1 - p)) / n) * 100

export function ResolvingPower() {
  const W = 860
  const left = 250
  const right = 700
  const MAXPTS = 6.5
  const x = (pts: number) => left + (pts / MAXPTS) * (right - left)

  const rowH = 52
  const top = 50
  const H = top + BENCHES.length * rowH + 30

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        percentage points · the band is one standard deviation of the gap under
        &ldquo;no difference&rdquo; · the dot is the gap the post measured
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Five benchmark rows on a scale of percentage points from zero to six and a half. Each row shows a shaded band one standard deviation wide, which is the smallest accuracy gap that benchmark can distinguish from sampling noise, and a dot for the gap the post actually measured. GSM8K over 1,311 questions resolves 0.77 points and the measured gaps are 0.08 and 0.31. GPQA-Diamond over 396 resolves 2.84 points and measured 1.01. AIME 2025 over 60 resolves 2.36 points and measured zero. SWE-bench Verified over 500 resolves 2.66 points and measured 1.60. Every measured gap falls inside its own band."
      >
        {[0, 1, 2, 3, 4, 5, 6].map((p) => (
          <g key={p}>
            <line
              x1={x(p)}
              y1={top - 14}
              x2={x(p)}
              y2={H - 22}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.45}
            />
            <text
              x={x(p)}
              y={top - 20}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {p}
            </text>
          </g>
        ))}
        <text
          x={left}
          y={top - 34}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          percentage points of accuracy
        </text>

        {BENCHES.map((b, i) => {
          const s = sigma(b.p, b.n)
          const y = top + i * rowH
          const barH = 24
          return (
            <g key={`${b.name}-${b.model}`}>
              <text
                x={14}
                y={y + 14}
                className="fill-foreground font-mono"
                style={{ fontSize: 11.5 }}
              >
                {b.name}
              </text>
              <text
                x={14}
                y={y + 26}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {b.model} · n = {b.n}
              </text>

              <rect
                x={x(0)}
                y={y}
                width={x(s) - x(0)}
                height={barH}
                rx={2}
                className="fill-foreground/12 stroke-foreground/40"
                strokeWidth={1.25}
              />
              <text
                x={x(s) + 8}
                y={y + 16}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                cannot resolve under {s.toFixed(2)} pts
              </text>

              <circle
                cx={x(b.gap)}
                cy={y + barH / 2}
                r={5}
                className="fill-foreground stroke-background"
                strokeWidth={1.5}
              />
              <text
                x={x(b.gap)}
                y={y - 3}
                textAnchor="middle"
                className="fill-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {b.gap.toFixed(2)}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Every measured gap sits inside its own benchmark&rsquo;s noise band
        &mdash; the largest is SWE-bench Verified at 0.60 &sigma;. That supports
        &ldquo;no regression was detected&rdquo; and not &ldquo;there is no
        regression&rdquo;. Note which way this cuts: identical AIME counts over
        60 samples would also be the expected outcome if 4-bit KV cost two full
        points. Only GSM8K, at n = 1,311, resolves anything under a point, and
        it is the easiest task in the set.
      </figcaption>
    </figure>
  )
}
