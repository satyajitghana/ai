// The two ends of the Pareto frontier, with the denominators the headline
// leaves out.
//
// Configurations and GPU counts are read off the legend of the vLLM post's
// Figure 4 (Qwen3.8-2.4T, GB300 NVL72, ISL/OSL 8192/1024); the endpoint values
// are read off its axes. "Total token throughput" in that chart counts input
// and output together, so at 8192 in and 1024 out only 1024/9216 = 11.1% of it
// is text the user actually reads. That split is the whole point of this
// figure.
//
// Only +, -, * and / here, which IEEE-754 makes exact, so lib/dmath is not
// needed.

const ISL = 8192
const OSL = 1024
const OUT_SHARE = OSL / (ISL + OSL)

type End = {
  side: string
  title: string
  prefill: string
  decode: string
  mtp: boolean
  gpus: string
  cc: string
  totalPerGpu: number
  perUser: number
}

const ENDS: End[] = [
  {
    side: "left",
    title: "maximum throughput",
    prefill: "4×TP2DEP4",
    decode: "1×TP4DEP4",
    mtp: false,
    gpus: "48 GPUs (32 ctx + 16 gen)",
    cc: "concurrency 2,560",
    totalPerGpu: 4940,
    perUser: 13.5,
  },
  {
    side: "right",
    title: "maximum interactivity",
    prefill: "1×TP4DEP2",
    decode: "1×TP8",
    mtp: true,
    gpus: "16 GPUs (8 ctx + 8 gen)",
    cc: "concurrency 1",
    totalPerGpu: 90,
    perUser: 182.1,
  },
]

export function FrontierEnds() {
  const W = 860
  const H = 300
  const colW = 380
  const gap = 46
  const x0 = 24

  const barTop = 150
  const barH = 34
  const barLeft = 16
  const barW = colW - 32
  const MAX = 5200

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Qwen3.8-2.4T · GB300 NVL72 · ISL/OSL 8,192/1,024 · two deployments, not
        one
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Two panels. The left panel is the maximum-throughput end of the frontier: four prefill endpoints of TP2 with expert parallel over four data-parallel ranks, one decode endpoint of TP4 with four data-parallel ranks, MTP off, 48 GPUs split 32 for context and 16 for generation, concurrency 2,560, about 4,940 total tokens per second per GPU of which only 549 are generated, and about 13.5 generated tokens per second per user. The right panel is the maximum-interactivity end: one TP4 prefill endpoint with two data-parallel ranks, one TP8 decode endpoint, MTP on, 16 GPUs split 8 and 8, concurrency 1, about 90 total tokens per second per GPU of which 10 are generated, and 182.1 generated tokens per second per user. A bar under each panel shows the input share and the generated share of the total-token figure."
      >
        {ENDS.map((e, i) => {
          const cx = x0 + i * (colW + gap)
          const gen = e.totalPerGpu * OUT_SHARE
          const w = (v: number) => (v / MAX) * barW
          return (
            <g key={e.side} transform={`translate(${cx},0)`}>
              <rect
                x={0}
                y={18}
                width={colW}
                height={H - 46}
                rx={4}
                className="fill-foreground/[0.04] stroke-border"
                strokeWidth={1.25}
              />
              <text
                x={16}
                y={44}
                className="fill-foreground font-mono"
                style={{ fontSize: 13 }}
              >
                {e.title}
              </text>
              <text
                x={16}
                y={64}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                prefill {e.prefill} · decode {e.decode}
              </text>
              <text
                x={16}
                y={80}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {e.gpus} · {e.cc}
              </text>
              <text
                x={16}
                y={96}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                MTP {e.mtp ? "on (3 speculative tokens)" : "off"}
              </text>

              <text
                x={16}
                y={126}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {e.perUser.toFixed(1)} generated tok/s per user
              </text>

              <rect
                x={barLeft}
                y={barTop}
                width={w(e.totalPerGpu - gen)}
                height={barH}
                rx={2}
                className="fill-foreground/15 stroke-foreground/45"
                strokeWidth={1.25}
              />
              <rect
                x={barLeft + w(e.totalPerGpu - gen)}
                y={barTop}
                width={w(gen)}
                height={barH}
                rx={2}
                className="fill-foreground/60 stroke-foreground"
                strokeWidth={1.25}
              />

              <text
                x={barLeft}
                y={barTop - 8}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {e.totalPerGpu.toLocaleString("en-US")} &ldquo;total&rdquo;
                tok/s/GPU
              </text>
              <text
                x={barLeft}
                y={barTop + barH + 16}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                prompt tokens, {Math.round((1 - OUT_SHARE) * 100)}%
              </text>
              <text
                x={barLeft}
                y={barTop + barH + 30}
                className="fill-foreground font-mono"
                style={{ fontSize: 10.5 }}
              >
                generated: {Math.round(gen)} tok/s/GPU
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        &ldquo;5,000 total tokens/s/GPU <em>and</em> 180 output tokens/s/user&rdquo;
        is two deployments &mdash;{" "}
        <strong className="font-medium text-foreground">
          48 GPUs against 16, different topologies at both ends, and opposite on
          MTP
        </strong>{" "}
        &mdash; separated by 55&times; in throughput and 13&times; in
        interactivity. The shaded part of each bar is the 8,192 prompt tokens.
        If you are pricing generated tokens, the left-hand figure is 549, not
        4,940.
      </figcaption>
    </figure>
  )
}
