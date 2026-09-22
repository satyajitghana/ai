// What one decode round costs, and what it returns, at two context lengths.
//
// Every number here is read out of the cinference/NInfer repositories, not
// modelled:
//   - MTP-10 rates and draft acceptance: satellitedown/cinference
//     results/rtx5090-archive-recall.json (recorded 2026-09-21, RTX 5090,
//     Huihui Qwen3.8-27B NVFP4, K8V4 KV, max_concurrency 1).
//   - The no-speculation baseline: the same repo's
//     docs/performance/qwen3.8-27b.md, run N0 (nvfp4 weights, MTP0, C=1),
//     which the page labels a retained upstream NInfer result.
//
// Derived, once: tokens per round = 1 + acceptance x draft_tokens, which is
// the definition the repo's own MTP3 tables satisfy (acceptance 76.3% at 3
// drafts gives 3.29 tokens/round). Round milliseconds = tokens per round
// divided by the measured tokens/second. Plain step milliseconds = 1000 / the
// MTP0 rate.
//
// All of that is +, -, * and / on doubles, which IEEE-754 makes exact and
// identical on every engine, so lib/dmath's wrappers are not needed here.
// Anything with exp/log/pow/trig would have to go through them.

type Row = {
  ctx: string
  ctxNote: string
  stepMs: number
  stepCtx: string
  roundMs: number
  tokensPerRound: number
  acceptance: number
  specTps: number
  plainTps: number
}

const ROWS: Row[] = [
  {
    ctx: "8K",
    ctxNote: "8,192-token prompt",
    stepMs: 14.04,
    stepCtx: "measured at 7,680",
    roundMs: 22.87,
    tokensPerRound: 10.31,
    acceptance: 93.1,
    specTps: 450.78,
    plainTps: 71.2,
  },
  {
    ctx: "260K",
    ctxNote: "260,000-token prompt",
    stepMs: 18.9,
    stepCtx: "measured at 260,096",
    roundMs: 36.21,
    tokensPerRound: 10.85,
    acceptance: 98.5,
    specTps: 299.64,
    plainTps: 52.9,
  },
]

const MAX_MS = 40

export function RoundLedger() {
  const W = 860
  const left = 150
  const right = 610
  const span = right - left
  const x = (ms: number) => left + (ms * span) / MAX_MS

  const rowH = 128
  const top = 54
  const H = top + ROWS.length * rowH + 34

  const ticks = [0, 10, 20, 30, 40]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one RTX 5090 · Huihui Qwen3.8-27B NVFP4 · K8V4 KV ·{" "}
        <strong className="font-medium text-foreground">
          max_concurrency 1
        </strong>{" "}
        · bars are wall-clock per decode round
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A millisecond ruler from zero to forty, with two groups of two bars. At an eight-thousand-token prompt, a plain decode step takes 14.04 milliseconds and yields one token, for 71.2 tokens per second; an MTP-10 round takes 22.87 milliseconds and yields 10.31 tokens, for 450.78 tokens per second. At a 260,000-token prompt, a plain step takes 18.90 milliseconds for one token and 52.9 tokens per second; an MTP-10 round takes 36.21 milliseconds for 10.85 tokens and 299.64 tokens per second. The round costs 1.63 times a plain step at the short context and 1.92 times at the long one, while returning ten times the tokens in both."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={top - 16}
              x2={x(t)}
              y2={H - 26}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={x(t)}
              y={top - 22}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {t}
            </text>
          </g>
        ))}
        <text
          x={left}
          y={top - 36}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          milliseconds of wall clock
        </text>

        {ROWS.map((r, i) => {
          const y0 = top + i * rowH
          const barH = 26
          const stepY = y0 + 14
          const roundY = y0 + 62
          return (
            <g key={r.ctx}>
              <text
                x={14}
                y={y0 + 18}
                className="fill-foreground font-mono"
                style={{ fontSize: 13 }}
              >
                {r.ctx} context
              </text>
              <text
                x={14}
                y={y0 + 32}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {r.ctxNote}
              </text>
              <text
                x={14}
                y={y0 + 76}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                round costs {(r.roundMs / r.stepMs).toFixed(2)}&times;
              </text>
              <text
                x={14}
                y={y0 + 88}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                a step, returns {r.tokensPerRound.toFixed(1)}&times;
              </text>

              {/* plain step */}
              <rect
                x={left}
                y={stepY}
                width={x(r.stepMs) - left}
                height={barH}
                rx={2}
                className="fill-foreground/15 stroke-foreground/45"
                strokeWidth={1.25}
              />
              <text
                x={left + 8}
                y={stepY + 17}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                no speculation · {r.stepMs.toFixed(2)} ms
              </text>
              <text
                x={x(r.stepMs) + 10}
                y={stepY + 12}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                1 token
              </text>
              <text
                x={x(r.stepMs) + 10}
                y={stepY + 24}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {r.plainTps.toFixed(1)} tok/s · {r.stepCtx}
              </text>

              {/* MTP-10 round */}
              <rect
                x={left}
                y={roundY}
                width={x(r.roundMs) - left}
                height={barH}
                rx={2}
                className="fill-foreground/45 stroke-foreground"
                strokeWidth={1.25}
              />
              <text
                x={left + 8}
                y={roundY + 17}
                className="fill-background font-mono"
                style={{ fontSize: 10 }}
              >
                MTP-10 round · {r.roundMs.toFixed(2)} ms
              </text>
              <text
                x={x(r.roundMs) + 10}
                y={roundY + 12}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {r.tokensPerRound.toFixed(2)} tokens
              </text>
              <text
                x={x(r.roundMs) + 10}
                y={roundY + 24}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {r.specTps.toFixed(2)} tok/s · {r.acceptance}% accepted
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The 450 is not a faster forward pass. A decode round that drafts ten
        tokens and verifies them costs{" "}
        <strong className="font-medium text-foreground">1.63&times;</strong> an
        ordinary step at 8K and{" "}
        <strong className="font-medium text-foreground">1.92&times;</strong> at
        260K, and returns about ten tokens instead of one. Take the speculation
        away and the same engine on the same card does{" "}
        <strong className="font-medium text-foreground">71.2</strong> tok/s at
        8K and <strong className="font-medium text-foreground">52.9</strong> at
        260K. Everything above 71 is the draft head being right.
      </figcaption>
    </figure>
  )
}
