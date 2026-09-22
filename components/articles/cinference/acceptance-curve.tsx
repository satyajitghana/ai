// Two curves that move in opposite directions, which is the whole reason the
// headline number holds up at 256K.
//
// Sources, both from satellitedown/cinference:
//   - MTP-10 decode rate and draft acceptance: results/rtx5090-archive-recall.json
//   - the no-speculation baseline: docs/performance/qwen3.8-27b.md run N0
//     (nvfp4 weights, MTP0, C=1, five samples per context), which that page
//     labels a retained upstream NInfer result rather than a Cinference one.
//
// The x axis is logarithmic in context length, so it goes through lib/dmath's
// mlog: Math.log is only an "implementation-dependent approximation" per spec
// and Node and Chrome can disagree in the last place, which would serialize a
// different SVG coordinate on the server than in the browser and trip a
// hydration mismatch. Everything downstream of mlog is +, -, * and /, which is
// exact.

import { mlog } from "@/lib/dmath"

type Point = { ctx: number; tps: number; acc?: number }

// MTP-10, archive-recall workload, temperature 0, thinking off.
const SPEC: Point[] = [
  { ctx: 8192, tps: 450.78, acc: 93.1 },
  { ctx: 32768, tps: 432.6, acc: 92.3 },
  { ctx: 131072, tps: 364.84, acc: 97.7 },
  { ctx: 260000, tps: 299.64, acc: 98.5 },
]

// MTP0: the same model and card with speculation switched off.
const PLAIN: Point[] = [
  { ctx: 7680, tps: 71.2 },
  { ctx: 64512, tps: 65.7 },
  { ctx: 130048, tps: 59.6 },
  { ctx: 260096, tps: 52.9 },
]

const XMIN = 7000
const XMAX = 300000
const LX0 = mlog(XMIN)
const LX1 = mlog(XMAX)

const XTICKS = [8192, 32768, 131072, 262144]
const XLABEL: Record<number, string> = {
  8192: "8K",
  32768: "32K",
  131072: "128K",
  262144: "256K",
}

export function AcceptanceCurve() {
  const W = 860
  const H = 430
  const left = 66
  const right = 720
  const top = 40
  const bottom = 340

  const x = (ctx: number) =>
    left + ((mlog(ctx) - LX0) / (LX1 - LX0)) * (right - left)
  const yTps = (t: number) => bottom - (t / 500) * (bottom - top)
  // The acceptance series gets its own band low in the plot, between the
  // MTP-10 line above and the MTP0 line below, so the two never cross.
  const ACC_TOP = 200
  const ACC_BOTTOM = 290
  const yAcc = (a: number) =>
    ACC_BOTTOM - ((a - 88) / 12) * (ACC_BOTTOM - ACC_TOP)

  const path = (pts: Point[], f: (p: Point) => number) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ctx)},${f(p)}`).join(" ")

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one request in flight · synthetic archive recall · the rate falls, the
        acceptance rises
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A chart against a logarithmic context axis from eight thousand to 256 thousand tokens. The MTP-10 decode rate falls from 450.78 tokens per second at 8K to 299.64 at 260K. The no-speculation rate on the same model and card falls from 71.2 to 52.9 over the same range. A third line, on a right-hand axis, is the draft acceptance rate, which rises from 93.1 percent at 8K to 98.5 percent at 260K, moving in the opposite direction to the throughput. A dashed marker at 260K shows a second recorded observation of the same point at 275.73 tokens per second, below the 300 line."
      >
        {/* y grid, tokens per second */}
        {[0, 100, 200, 300, 400, 500].map((t) => (
          <g key={t}>
            <line
              x1={left}
              y1={yTps(t)}
              x2={right}
              y2={yTps(t)}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={left - 8}
              y={yTps(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {t}
            </text>
          </g>
        ))}
        <text
          x={left - 44}
          y={top - 14}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          tok/s
        </text>

        {/* x ticks */}
        {XTICKS.map((c) => (
          <g key={c}>
            <line
              x1={x(c)}
              y1={top}
              x2={x(c)}
              y2={bottom}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.35}
            />
            <text
              x={x(c)}
              y={bottom + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {XLABEL[c]}
            </text>
          </g>
        ))}
        <text
          x={(left + right) / 2}
          y={bottom + 32}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          prompt tokens (log scale)
        </text>

        {/* the 300 tok/s claim line */}
        <line
          x1={left}
          y1={yTps(300)}
          x2={right}
          y2={yTps(300)}
          className="stroke-foreground/55"
          strokeWidth={1.25}
          strokeDasharray="5 4"
        />
        <text
          x={left + 6}
          y={yTps(300) - 6}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          the &ldquo;above 300&rdquo; claim
        </text>

        {/* acceptance, right axis */}
        <path
          d={path(SPEC, (p) => yAcc(p.acc ?? 0))}
          fill="none"
          className="stroke-foreground/40"
          strokeWidth={2}
          strokeDasharray="2 3"
        />
        {SPEC.map((p) => (
          <g key={`a-${p.ctx}`}>
            <circle
              cx={x(p.ctx)}
              cy={yAcc(p.acc ?? 0)}
              r={4}
              className="fill-background stroke-foreground/60"
              strokeWidth={1.5}
            />
            <text
              x={x(p.ctx)}
              y={yAcc(p.acc ?? 0) - 10}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {p.acc}%
            </text>
          </g>
        ))}
        {[90, 95, 100].map((a) => (
          <text
            key={a}
            x={right + 8}
            y={yAcc(a) + 3}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            {a}%
          </text>
        ))}
        <text
          x={right + 8}
          y={ACC_TOP - 12}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          draft accepted
        </text>

        {/* MTP-10 */}
        <path
          d={path(SPEC, (p) => yTps(p.tps))}
          fill="none"
          className="stroke-foreground"
          strokeWidth={2.5}
        />
        {SPEC.map((p) => (
          <g key={`s-${p.ctx}`}>
            <circle
              cx={x(p.ctx)}
              cy={yTps(p.tps)}
              r={5}
              className="fill-foreground stroke-background"
              strokeWidth={1.5}
            />
            <text
              x={x(p.ctx)}
              y={yTps(p.tps) - 12}
              textAnchor="middle"
              className="fill-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {p.tps.toFixed(0)}
            </text>
          </g>
        ))}

        {/* the repeat observation the results file records */}
        <circle
          cx={x(260000)}
          cy={yTps(275.73)}
          r={4}
          className="fill-background stroke-foreground"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
        <text
          x={x(260000) - 8}
          y={yTps(275.73) + 16}
          textAnchor="end"
          className="fill-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          275.73 &mdash; a prior repeat of the same point
        </text>

        {/* MTP0 */}
        <path
          d={path(PLAIN, (p) => yTps(p.tps))}
          fill="none"
          className="stroke-foreground/55"
          strokeWidth={2}
        />
        {PLAIN.map((p) => (
          <circle
            key={`p-${p.ctx}`}
            cx={x(p.ctx)}
            cy={yTps(p.tps)}
            r={4}
            className="fill-background stroke-foreground/70"
            strokeWidth={1.5}
          />
        ))}
        <text
          x={x(8192) + 10}
          y={yTps(71.2) - 10}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          same engine, speculation off: 71.2 &rarr; 52.9
        </text>

        {/* legend */}
        <g>
          <line
            x1={left}
            y1={H - 22}
            x2={left + 22}
            y2={H - 22}
            className="stroke-foreground"
            strokeWidth={2.5}
          />
          <text
            x={left + 28}
            y={H - 18}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            MTP-10
          </text>
          <line
            x1={left + 108}
            y1={H - 22}
            x2={left + 130}
            y2={H - 22}
            className="stroke-foreground/55"
            strokeWidth={2}
          />
          <text
            x={left + 136}
            y={H - 18}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            MTP0 baseline
          </text>
          <line
            x1={left + 250}
            y1={H - 22}
            x2={left + 272}
            y2={H - 22}
            className="stroke-foreground/40"
            strokeWidth={2}
            strokeDasharray="2 3"
          />
          <text
            x={left + 278}
            y={H - 18}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            draft acceptance (right axis)
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Long-context decode does degrade here: the underlying step time grows
        35% from 8K to 260K, and the no-speculation line falls with it. What
        keeps the headline above 300 is the dotted line going the other way
        &mdash; on a recall workload the draft head gets{" "}
        <em>more</em> accurate as the haystack grows, from 93.1% to 98.5%
        accepted. That is a property of the workload, not of the engine. The
        hollow marker is the repeat run the same results file records at 260,000
        tokens: 275.73 tok/s, under the claim.
      </figcaption>
    </figure>
  )
}
