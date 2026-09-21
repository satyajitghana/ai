// Does Jev's confidence predict what the editor keeps?
//
// Recomputed by joining out/linkmap.json (679 placed links, each with the link
// probability that placed it) against out/linkmap-verified.json (the 287 the
// editor kept), in stas4000/jev-linkmap at commit 58f636e.
//
// Monotone, and shallow. Across the whole usable range of the probability —
// 0.65, the threshold, up to 0.98, the highest value in the run — the keep rate
// moves from 26.8% to 48.5%. Even at the top of the model's confidence the
// editor cuts more than half.
//
// The other half of the story is what the editor was given. verify.py sends it
// the source page's SLUG with the dashes turned into spaces, the one sentence
// the anchor sits in, the anchor, and the target's title. Not the page copy, not
// the target's description — strictly less than Jev read. And its system prompt
// ends "When in doubt, cut."
//
// Server-rendered, zero JS.

const W = 700
const H = 250
const L = 118
const R = 156
const T = 26
const B = 46
const PW = W - L - R
const PH = H - T - B

const KEEP = "oklch(0.58 0.15 152)"
const CUT = "oklch(0.58 0.19 27)"

type Bucket = { range: string; n: number; kept: number }

const BUCKETS: Bucket[] = [
  { range: "0.65 – 0.75", n: 56, kept: 15 },
  { range: "0.75 – 0.85", n: 83, kept: 30 },
  { range: "0.85 – 0.95", n: 239, kept: 96 },
  { range: "0.95 – 0.98", n: 301, kept: 146 },
]

const ROW_H = Math.floor(PH / BUCKETS.length)

export function EditorGate() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        out/linkmap.json joined to out/linkmap-verified.json —{" "}
        <span className="text-foreground">679 placed, 287 kept</span>
      </div>

      <div className="px-3 pt-3 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Four horizontal bars, one per band of Jev's link probability. From 0.65 to 0.75 the editor kept 15 of 56 links, 26.8 percent. From 0.75 to 0.85 it kept 30 of 83, 36.1 percent. From 0.85 to 0.95 it kept 96 of 239, 40.2 percent. From 0.95 to 0.98, the top of the run, it kept 146 of 301, 48.5 percent. The keep rate rises with confidence but never reaches half."
        >
          {BUCKETS.map((b, i) => {
            const y = T + i * ROW_H
            const full = (b.n / 301) * PW
            const keep = (b.kept / 301) * PW
            const rate = (b.kept / b.n) * 100
            const bar = Math.min(ROW_H - 16, 24)
            return (
              <g key={b.range}>
                <text x={L - 10} y={y + bar / 2 + 4} textAnchor="end" fontSize={11} fill="var(--foreground)" className="font-mono">
                  {b.range}
                </text>
                <rect x={L} y={y} width={full} height={bar} rx={3} fill={CUT} fillOpacity={0.16} />
                <rect x={L} y={y} width={keep} height={bar} rx={3} fill={KEEP} fillOpacity={0.4} />
                <rect x={L} y={y} width={full} height={bar} rx={3} fill="none" stroke="var(--border)" strokeWidth={1} />
                <text x={L + full + 10} y={y + bar / 2 + 4} fontSize={11} fill="var(--foreground)">
                  <tspan className="font-mono">{rate.toFixed(1)}%</tspan>
                  <tspan fill="var(--muted-foreground)" dx="6" fontSize={10}>
                    {b.kept} of {b.n} kept
                  </tspan>
                </text>
              </g>
            )
          })}

          <line x1={L} y1={T + PH - 6} x2={L + PW} y2={T + PH - 6} stroke="var(--border)" strokeWidth={1} />
          <text x={L} y={T + PH + 12} fontSize={10} fill="var(--muted-foreground)">
            links placed, by the probability that placed them
          </text>
          <g transform={`translate(${L + PW + 10} ${T + PH + 4})`}>
            <rect x={0} y={-8} width={10} height={10} rx={2} fill={KEEP} fillOpacity={0.4} />
            <text x={15} y={0} fontSize={10} fill="var(--muted-foreground)">
              kept
            </text>
            <rect x={48} y={-8} width={10} height={10} rx={2} fill={CUT} fillOpacity={0.16} />
            <text x={63} y={0} fontSize={10} fill="var(--muted-foreground)">
              cut
            </text>
          </g>
        </svg>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The signal is real and it is thin: mean confidence is{" "}
        <span className="font-mono">0.9013</span> among the links proposed and{" "}
        <span className="font-mono">0.9139</span> among the links kept. You cannot select on it.
        Nor is the editor an oracle —{" "}
        <span className="font-mono">verify.py</span> hands it the source page&apos;s URL slug with
        the dashes replaced by spaces, one sentence, the anchor and the target&apos;s title. No page
        copy, no description of the target: strictly less than Jev read. And the last line of its
        system prompt is <span className="font-mono">&ldquo;When in doubt, cut.&rdquo;</span>
      </p>
    </figure>
  )
}
