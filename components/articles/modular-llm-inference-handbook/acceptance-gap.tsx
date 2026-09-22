// The handbook's acceptance-length formula, run on a table that publishes both
// of its inputs and the answer.
//
// Source of the measurements: AMD + Embedded LLM's vLLM speculative-decoding
// study, Qwen3-8B with an EAGLE-3 drafter on MATH500, MI300X, appendix sweep
// over proposal length N. Three columns per row: N, mean accepted length (MAL)
// and acceptance rate (AR). Those numbers are quoted in this site's earlier
// read of that study, /articles/vllm-speculative-decoding-amd.
//
// The handbook's formula is Leviathan et al. (arXiv 2211.17192), Theorem 3.8:
//     tau = (1 - alpha^(gamma+1)) / (1 - alpha)
// and its metrics bullet defines alpha as "the probability of accepting draft
// tokens by the target model", which is what AR reports. Feeding AR into the
// formula is therefore the reading the page invites, and it is the dashed line
// here.
//
// The identity MAL = 1 + AR * N holds on all seven rows to the printed
// precision, because AR is accepted-over-proposed and every proposal is N long.
// Recovering the per-position acceptance instead — the quantity the formula
// actually takes — gives 0.890 down to 0.839 across the sweep, and a single
// alpha of 0.85 reproduces every measured MAL within 3.6%.
//
// Powers are taken by repeated multiplication rather than Math.pow: IEEE-754
// multiplication is exactly specified, Math.pow is not, so this stays
// byte-identical between the server render and the browser without lib/dmath.

type Row = { n: number; mal: number; ar: number }

const ROWS: Row[] = [
  { n: 1, mal: 1.89, ar: 0.89 },
  { n: 2, mal: 2.64, ar: 0.822 },
  { n: 3, mal: 3.27, ar: 0.756 },
  { n: 4, mal: 3.75, ar: 0.687 },
  { n: 5, mal: 4.14, ar: 0.628 },
  { n: 6, mal: 4.43, ar: 0.572 },
  { n: 7, mal: 4.68, ar: 0.525 },
]

/** a^k for integer k >= 0, by exact IEEE multiplication. */
const ipow = (a: number, k: number) => {
  let v = 1
  for (let i = 0; i < k; i++) v *= a
  return v
}

/** Leviathan's expected tokens per round. */
const tau = (a: number, g: number) => (1 - ipow(a, g + 1)) / (1 - a)

const FITTED = 0.85

export function AcceptanceGap() {
  const W = 880
  const H = 420
  const left = 70
  const right = 600
  const top = 44
  const bottom = 318
  const MAXY = 5.2

  const x = (n: number) => left + ((n - 1) / (ROWS.length - 1)) * (right - left)
  const y = (v: number) => bottom - (v / MAXY) * (bottom - top)
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i + 1)},${y(v)}`).join(" ")

  const measured = ROWS.map((r) => r.mal)
  const naive = ROWS.map((r) => tau(r.ar, r.n))
  const fitted = ROWS.map((r) => tau(FITTED, r.n))

  const worst = ROWS.reduce(
    (acc, r, i) => Math.max(acc, ((r.mal - naive[i]) / r.mal) * 100),
    0
  )
  const fitWorst = ROWS.reduce(
    (acc, r, i) => Math.max(acc, Math.abs((fitted[i] - r.mal) / r.mal) * 100),
    0
  )

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Qwen3-8B + EAGLE-3 &middot; MATH500 &middot; MI300X &middot; tokens
        committed per verification round, against proposal length
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[820px]"
        role="img"
        aria-label="A chart of tokens committed per verification round against proposal length from one to seven. The measured mean accepted length rises monotonically from 1.89 to 4.68. The handbook's formula fed the reported acceptance rate matches at N equals one, peaks at 2.76 around N equals three, and then falls back to 2.09 by N equals seven, ending 55 percent below the measurement and pointing the wrong way. The same formula fed a single recovered per-position acceptance of 0.85 tracks the measurement across the whole sweep, within 3.6 percent everywhere."
      >
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line
              x1={left}
              y1={y(v)}
              x2={right}
              y2={y(v)}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={left - 8}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {v}
            </text>
          </g>
        ))}
        <text
          x={left - 44}
          y={top - 16}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          tokens/round
        </text>

        {ROWS.map((r) => (
          <text
            key={r.n}
            x={x(r.n)}
            y={bottom + 18}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            {r.n}
          </text>
        ))}
        <text
          x={(left + right) / 2}
          y={bottom + 36}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          proposal length &gamma;
        </text>

        <path
          d={path(measured)}
          fill="none"
          className="stroke-foreground"
          strokeWidth={2.4}
        />
        <path
          d={path(fitted)}
          fill="none"
          className="stroke-foreground/55"
          strokeWidth={1.6}
          strokeDasharray="1 3"
          strokeLinecap="round"
        />
        <path
          d={path(naive)}
          fill="none"
          className="stroke-destructive"
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        {ROWS.map((r, i) => (
          <g key={r.n}>
            <circle
              cx={x(r.n)}
              cy={y(r.mal)}
              r={3.4}
              className="fill-foreground"
            />
            <circle
              cx={x(r.n)}
              cy={y(naive[i])}
              r={3}
              className="fill-destructive"
            />
          </g>
        ))}

        <text
          x={x(7) + 10}
          y={y(measured[6]) + 4}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          measured {measured[6].toFixed(2)}
        </text>
        <text
          x={x(7) + 10}
          y={y(fitted[6]) - 6}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          formula, &alpha;={FITTED} &rarr; {fitted[6].toFixed(2)}
        </text>
        <text
          x={x(7) + 10}
          y={y(naive[6]) + 4}
          className="fill-destructive font-mono"
          style={{ fontSize: 11 }}
        >
          formula, &alpha;=AR &rarr; {naive[6].toFixed(2)}
        </text>

        <text
          x={left}
          y={top - 16}
          className="fill-destructive font-mono"
          style={{ fontSize: 11 }}
        >
          the dashed line turns over at &gamma;=3 and falls; the measurement
          never does
        </text>

        <g transform={`translate(${left}, ${bottom + 56})`}>
          <text
            x={0}
            y={0}
            className="fill-foreground font-mono"
            style={{ fontSize: 10.5 }}
          >
            reported acceptance rate falls {ROWS[0].ar.toFixed(3)} &rarr;{" "}
            {ROWS[6].ar.toFixed(3)} &mdash; a{" "}
            {(((ROWS[0].ar - ROWS[6].ar) / ROWS[0].ar) * 100).toFixed(0)}% drop
          </text>
          <text
            x={0}
            y={16}
            className="fill-foreground font-mono"
            style={{ fontSize: 10.5 }}
          >
            recovered per-position acceptance falls 0.890 &rarr; 0.839 &mdash; a
            6% drop. The drafter barely changed.
          </text>
          <text
            x={0}
            y={32}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            worst error, formula fed the reported rate: {worst.toFixed(0)}% low
            &middot; worst error, formula fed a single &alpha;={FITTED}:{" "}
            {fitWorst.toFixed(1)}%
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Two different quantities are both called the acceptance rate. The one a
        serving stack logs is <em>accepted tokens over proposed tokens</em>,
        which counts the positions a round never reached and therefore falls as
        you propose more. The one the formula takes is{" "}
        <em>per-position conditional acceptance</em>, which here is nearly flat.
        Put the first into the formula and it tells you that widening the draft
        window past three makes rounds{" "}
        <strong className="font-medium text-foreground">shorter</strong>. Every
        measured row says otherwise.
      </figcaption>
    </figure>
  )
}
