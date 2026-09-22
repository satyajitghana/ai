// Where speculative decoding stops paying, read off the vLLM post's decode
// sweep (Figure 2: Qwen3.8-2.4T, GB300, ISL/OSL 1/1000, total token throughput
// per GPU against concurrency).
//
// Both series are the same TP8 + expert-parallel topology on the same 8 GPUs.
// The only difference is MTP with 3 speculative tokens. Values are read off
// the published chart to the nearest 5 tok/s/GPU, which is why they are marked
// as approximate in the caption -- the shape is the finding, not the digits.
//
// The x axis is powers of two, so it is drawn on an index rather than a log,
// and every coordinate is +, -, * and / -- no lib/dmath needed.

type Series = { label: string; note: string; pts: number[]; strong: boolean }

const CC = [64, 128, 256, 512, 1024]

const SERIES: Series[] = [
  {
    label: "TP8+EP, MTP on",
    note: "3 speculative tokens",
    pts: [558, 775, 1205, 685, 625],
    strong: true,
  },
  {
    label: "TP8+EP, MTP off",
    note: "same 8 GPUs",
    pts: [318, 515, 775, 1205, 1665],
    strong: false,
  },
]

export function MtpTurnover() {
  const W = 860
  const H = 400
  const left = 74
  const right = 660
  const top = 40
  const bottom = 320
  const MAXY = 1800

  const x = (i: number) => left + (i / (CC.length - 1)) * (right - left)
  const y = (v: number) => bottom - (v / MAXY) * (bottom - top)

  const path = (pts: number[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p)}`).join(" ")

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        decode only · ISL/OSL 1/1,000 · GB300 · one TP8 + expert-parallel engine,
        with and without MTP
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A chart of total token throughput per GPU against concurrency from 64 to 1024, for one TP8 engine with and without MTP. With MTP the curve rises steeply to about 1,205 tokens per second per GPU at concurrency 256 and then falls to 685 at 512 and 625 at 1,024. Without MTP the curve rises steadily throughout, reaching 775 at 256, 1,205 at 512 and 1,665 at 1,024. The two cross between concurrency 256 and 512, where the KV cache becomes the binding constraint and the extra slots MTP reserves cost more concurrency than the speculation returns."
      >
        {[0, 450, 900, 1350, 1800].map((v) => (
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
          x={left - 52}
          y={top - 14}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          tok/s/GPU
        </text>

        {CC.map((c, i) => (
          <text
            key={c}
            x={x(i)}
            y={bottom + 17}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            {c}
          </text>
        ))}
        <text
          x={(left + right) / 2}
          y={bottom + 34}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          concurrency
        </text>

        {/* the crossing band */}
        <rect
          x={x(2)}
          y={top}
          width={x(3) - x(2)}
          height={bottom - top}
          className="fill-destructive/10"
        />
        <text
          x={(x(2) + x(3)) / 2}
          y={top - 6}
          textAnchor="middle"
          className="fill-destructive font-mono"
          style={{ fontSize: 9.5 }}
        >
          the KV cache becomes the constraint
        </text>

        {SERIES.map((s) => (
          <g key={s.label}>
            <path
              d={path(s.pts)}
              fill="none"
              className={s.strong ? "stroke-foreground" : "stroke-foreground/50"}
              strokeWidth={s.strong ? 2.5 : 2}
              strokeDasharray={s.strong ? undefined : "6 4"}
            />
            {s.pts.map((p, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p)}
                r={4}
                className={
                  s.strong
                    ? "fill-foreground stroke-background"
                    : "fill-background stroke-foreground/70"
                }
                strokeWidth={1.5}
              />
            ))}
          </g>
        ))}

        <text
          x={x(2)}
          y={y(1205) - 14}
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          MTP peaks here: ~1,205
        </text>
        <text
          x={x(4) - 4}
          y={y(625) + 18}
          textAnchor="end"
          className="fill-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          ~625 with MTP
        </text>
        <text
          x={x(4) - 4}
          y={y(1665) - 12}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          ~1,665 without
        </text>

        <g>
          <line
            x1={left}
            y1={H - 20}
            x2={left + 22}
            y2={H - 20}
            className="stroke-foreground"
            strokeWidth={2.5}
          />
          <text
            x={left + 28}
            y={H - 16}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            MTP on (3 speculative tokens)
          </text>
          <line
            x1={left + 230}
            y1={H - 20}
            x2={left + 252}
            y2={H - 20}
            className="stroke-foreground/50"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <text
            x={left + 258}
            y={H - 16}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            MTP off
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Speculation is a{" "}
        <strong className="font-medium text-foreground">per-user</strong> win
        bought with{" "}
        <strong className="font-medium text-foreground">memory</strong>: every
        in-flight request reserves KV slots for tokens that may be rejected.
        Below the crossing that memory is free, and MTP is worth 1.6 to 1.8&times;. Above
        it the cache is the binding constraint, the reserved slots cost
        concurrency, and the same flag costs you 62% of your throughput. Values
        read off the published chart, so treat the shape as the finding.
      </figcaption>
    </figure>
  )
}
