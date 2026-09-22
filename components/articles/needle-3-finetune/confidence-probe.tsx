// The confidence head, drawn from its own tensor shapes.
//
// Every number here is read out of Cactus-Compute/needle3's safetensors header
// (two HTTP range requests: eight bytes for the header length, then the header)
// and out of cactus-needle 3.0.4's `probe_pool` in needle/model/architecture.py.
// Nothing is inferred from the marketing page.
//
//   confidence_head/probes     [21, 4, 768]   one probe vector per (depth, lane)
//   confidence_head/gain       [21, 4]        a scalar per (depth, lane)
//   confidence_head/query      [4, 768]       four queries over the 84 summaries
//   confidence_head/row_bias   [4, 21, 4]
//   confidence_head/proj/kernel [3072, 1]     4 * 768 -> one logit
//   confidence_head/proj/bias  [1]
//
// 21 = the embedding output plus 20 block outputs. 4 = mhc_lanes, and
// config.json carries confidence_probes: 4 and confidence_queries: 4 to match.
// Total: 71,077 parameters, 0.059% of the model's 121,021,910.
//
// Server-rendered, zero JS. No transcendental arithmetic reaches the DOM here —
// every coordinate is an integer or an exact division — so lib/dmath is not
// needed.

const STAGES = [
  {
    n: "1",
    title: "read 21 depths under stop_gradient",
    shape: "cells [batch, time, 21, 768]",
    body: "The head reads the residual stream at every depth — the embedding plus each of the 20 blocks — and jax.lax.stop_gradient sits between it and the backbone. Training the head cannot move a single weight of the model it is judging.",
  },
  {
    n: "2",
    title: "84 probes attention-pool over positions",
    shape: "probes [21, 4, 768] → r [21, 4, 768]",
    body: "Each (depth, lane) pair scores every non-padding position, softmaxes over the sequence, and pools it into one 768-vector. The prompt and the finished call are both in that sequence, so this is a judgement about a call that already exists.",
  },
  {
    n: "3",
    title: "four queries attend over the 84 summaries",
    shape: "query [4, 768] → 4 × 768 = 3072",
    body: "A second softmax, this time across depth and lane rather than across time. A sliced subnetwork masks the rows for blocks it does not run to −∞, so the same head renormalises over whatever depths are present.",
  },
  {
    n: "4",
    title: "one linear projection, one logit",
    shape: "proj [3072, 1] + bias [1]",
    body: "out_dim is 1. The whole forward pass collapses to a single scalar, and the score you read is the minimum of its sigmoid and the decode probability of the call's own tokens.",
  },
]

export function ConfidenceProbe() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          confidence_head, read out of the shipped safetensors header
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          71,077 params &middot; 0.059% of the model
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 640 132"
          role="img"
          aria-label="Four stages: a 21-by-768 stack of residual-stream reads, then 84 probe summaries pooled over sequence positions, then four queries pooling over the 84 summaries into a 3072-wide vector, then a linear projection to one logit."
          className="h-auto w-full"
        >
          <g fontFamily="ui-monospace, monospace" fontSize="8">
            {/* stage 1: the depth stack */}
            {Array.from({ length: 21 }, (_, i) => (
              <rect
                key={i}
                x={16}
                y={14 + i * 4.4}
                width={58}
                height={3}
                rx={1}
                fill="currentColor"
                opacity={0.18 + (i / 21) * 0.28}
              />
            ))}
            <text x={45} y={122} textAnchor="middle" fill="currentColor" opacity={0.65}>
              21 × 768
            </text>
            <text x={45} y={9} textAnchor="middle" fill="currentColor" opacity={0.45}>
              residual stream
            </text>

            {/* arrow 1 */}
            <line x1={80} y1={62} x2={152} y2={62} stroke="currentColor" strokeWidth={0.7} opacity={0.4} />
            <path d="M152 62 l-5 -2.6 v5.2 z" fill="currentColor" opacity={0.4} />
            <text x={116} y={56} textAnchor="middle" fill="currentColor" opacity={0.55}>
              softmax
            </text>
            <text x={116} y={73} textAnchor="middle" fill="currentColor" opacity={0.55}>
              over t
            </text>

            {/* stage 2: 84 summaries as a 21x4 grid */}
            {Array.from({ length: 21 }, (_, r) =>
              Array.from({ length: 4 }, (_, c) => (
                <rect
                  key={`${r}-${c}`}
                  x={160 + c * 15}
                  y={14 + r * 4.4}
                  width={12}
                  height={3}
                  rx={1}
                  fill="currentColor"
                  opacity={0.2 + ((r * 4 + c) % 7) * 0.05}
                />
              )),
            )}
            <text x={190} y={122} textAnchor="middle" fill="currentColor" opacity={0.65}>
              84 summaries
            </text>
            <text x={190} y={9} textAnchor="middle" fill="currentColor" opacity={0.45}>
              depth × lane
            </text>

            {/* arrow 2 */}
            <line x1={226} y1={62} x2={300} y2={62} stroke="currentColor" strokeWidth={0.7} opacity={0.4} />
            <path d="M300 62 l-5 -2.6 v5.2 z" fill="currentColor" opacity={0.4} />
            <text x={263} y={56} textAnchor="middle" fill="currentColor" opacity={0.55}>
              softmax
            </text>
            <text x={263} y={73} textAnchor="middle" fill="currentColor" opacity={0.55}>
              over 84
            </text>

            {/* stage 3: four pooled vectors */}
            {Array.from({ length: 4 }, (_, i) => (
              <rect
                key={i}
                x={308}
                y={34 + i * 14}
                width={96}
                height={10}
                rx={2}
                fill="currentColor"
                opacity={0.2 + i * 0.07}
              />
            ))}
            <text x={356} y={122} textAnchor="middle" fill="currentColor" opacity={0.65}>
              4 × 768 = 3072
            </text>
            <text x={356} y={9} textAnchor="middle" fill="currentColor" opacity={0.45}>
              concatenated
            </text>

            {/* arrow 3 */}
            <line x1={410} y1={62} x2={482} y2={62} stroke="currentColor" strokeWidth={0.7} opacity={0.4} />
            <path d="M482 62 l-5 -2.6 v5.2 z" fill="currentColor" opacity={0.4} />
            <text x={446} y={56} textAnchor="middle" fill="currentColor" opacity={0.55}>
              proj
            </text>
            <text x={446} y={73} textAnchor="middle" fill="currentColor" opacity={0.55}>
              3072 → 1
            </text>

            {/* stage 4: one logit */}
            <rect
              x={492}
              y={52}
              width={26}
              height={20}
              rx={3}
              fill="oklch(0.58 0.15 155)"
              opacity={0.75}
            />
            <text x={505} y={122} textAnchor="middle" fill="currentColor" opacity={0.65}>
              1 logit
            </text>

            <line x1={524} y1={62} x2={556} y2={62} stroke="currentColor" strokeWidth={0.7} opacity={0.4} />
            <path d="M556 62 l-5 -2.6 v5.2 z" fill="currentColor" opacity={0.4} />
            <text x={596} y={58} textAnchor="middle" fill="currentColor" opacity={0.75}>
              min(head,
            </text>
            <text x={596} y={70} textAnchor="middle" fill="currentColor" opacity={0.75}>
              decode p)
            </text>
          </g>
        </svg>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {STAGES.map((s) => (
            <div key={s.n} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{s.n}</span>
                <span className="font-mono text-[11px] text-foreground">{s.title}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s.shape}</div>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
