// The 1.78x capacity claim against the three points that are supposed to show
// it -- and against the offered concurrency, which is the thing that actually
// stopped each NVFP4 run.
//
// Numbers from the LMSYS iso-capacity table (Qwen3.8-27B, one RTX PRO 6000
// Blackwell Server Edition, FP8 weights, TP1, 1,024 output tokens): requested
// concurrency, achieved decode-resident concurrency under FP8 KV and under
// NVFP4 KV. Everything is expressed as a multiple of the FP8 result so the
// three context lengths share one axis and can be compared with 1/0.5625.
//
// Only +, -, * and / on doubles, which IEEE-754 makes exact; lib/dmath is not
// needed here.

const IDEAL = 1 / 0.5625 // 1.7777...

type Row = {
  ctx: string
  note: string
  fp8: number
  nvfp4: number
  requested: number
}

const ROWS: Row[] = [
  {
    ctx: "32K",
    note: "32,768-token prompts",
    fp8: 44,
    nvfp4: 70,
    requested: 70,
  },
  {
    ctx: "160K",
    note: "163,840-token prompts",
    fp8: 10,
    nvfp4: 15,
    requested: 16,
  },
  {
    ctx: "1M",
    note: "override; native limit 262,144",
    fp8: 1,
    nvfp4: 2,
    requested: 2,
  },
]

export function CapacityLadder() {
  const W = 860
  const left = 176
  const right = 690
  const MAX = 2.3
  const x = (r: number) => left + (r / MAX) * (right - left)

  const rowH = 74
  const top = 54
  const H = top + ROWS.length * rowH + 34

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        decode-resident requests, as a multiple of the FP8 result · one RTX PRO
        6000 Blackwell · Qwen3.8-27B, FP8 weights, TP1
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Three lanes on a shared axis of concurrency relative to FP8. The dashed line at 1.78 is the capacity ratio the format arithmetic implies. At 32K, NVFP4 reached 1.59 times FP8 — and the offered concurrency ceiling sits at exactly the same place, so the run stopped at the load requested rather than at the cache limit. At 160K, NVFP4 reached 1.50 against a ceiling of 1.60. At 1M, FP8 held one request and NVFP4 two, so the ratio reads 2.00, which is the coarsest possible granularity rather than a measurement."
      >
        {[1, 1.25, 1.5, 1.75, 2, 2.25].map((r) => (
          <g key={r}>
            <line
              x1={x(r)}
              y1={top - 16}
              x2={x(r)}
              y2={H - 26}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.45}
            />
            <text
              x={x(r)}
              y={top - 22}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {r.toFixed(2)}&times;
            </text>
          </g>
        ))}
        <text
          x={left - 24}
          y={top - 36}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          concurrency relative to FP8 KV
        </text>

        <line
          x1={x(IDEAL)}
          y1={top - 16}
          x2={x(IDEAL)}
          y2={H - 26}
          className="stroke-foreground"
          strokeWidth={1.75}
          strokeDasharray="6 4"
        />
        <text
          x={x(IDEAL) + 7}
          y={top - 36}
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          1.78&times; &mdash; what the format implies
        </text>

        {ROWS.map((r, i) => {
          const ratio = r.nvfp4 / r.fp8
          const ceiling = r.requested / r.fp8
          const y = top + i * rowH
          const barH = 26
          const barY = y + 8
          return (
            <g key={r.ctx}>
              <text
                x={14}
                y={y + 18}
                className="fill-foreground font-mono"
                style={{ fontSize: 13 }}
              >
                {r.ctx}
              </text>
              <text
                x={14}
                y={y + 31}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {r.note}
              </text>
              <text
                x={14}
                y={y + 46}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {r.fp8} &rarr; {r.nvfp4} requests
              </text>

              <rect
                x={x(0)}
                y={barY}
                width={x(1) - x(0)}
                height={barH}
                rx={2}
                className="fill-foreground/12 stroke-foreground/40"
                strokeWidth={1.25}
              />
              <rect
                x={x(1)}
                y={barY}
                width={x(ratio) - x(1)}
                height={barH}
                rx={2}
                className="fill-foreground/45 stroke-foreground"
                strokeWidth={1.25}
              />
              <text
                x={x(ratio) + 10}
                y={barY + 17}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {ratio.toFixed(2)}&times;
              </text>

              {/* the offered-load ceiling */}
              <line
                x1={x(ceiling)}
                y1={barY - 9}
                x2={x(ceiling)}
                y2={barY + barH + 9}
                className="stroke-destructive"
                strokeWidth={2}
              />
              <text
                x={x(ceiling)}
                y={barY + barH + 21}
                textAnchor="middle"
                className="fill-destructive font-mono"
                style={{ fontSize: 8.5 }}
              >
                offered: {r.requested}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The red mark is the concurrency the benchmark client actually asked for.
        At 32K it sits{" "}
        <strong className="font-medium text-foreground">
          exactly on the NVFP4 result
        </strong>
        : the run admitted every request offered and never found its cache
        limit. At 160K it admitted 15 of 16. At 1M the choice was one request or
        two. So none of the three points tests 1.78&times; &mdash; they measure
        what FP8 could <em>not</em> do, which is a different and much easier
        claim.
      </figcaption>
    </figure>
  )
}
