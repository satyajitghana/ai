// Why the 4.5× cannot be kernels, and Husky says so first.
//
// One decode step at batch 1 reads every weight. Woof's weight file on the Hub
// is 2,367,237,149 bytes — checkable, and it reproduces from the config:
// 4,205,751,296 parameters at 4 bits, plus an fp16 scale and bias per group of
// 64, is 2.3657 GB. At 159 tok/s MLX spends 6.29 ms on that read, an effective
// 377 GB/s. Husky puts the floor for a plain streaming read at 4.5 ms.
//
// So the entire headroom available to a better single-token decoder on this
// machine is 6.29 / 4.5 = 1.39×, and Husky's median gain without its draft is
// 1.125×. Everything past the line is tokens-per-read, which is speculative
// decoding: prompt lookup on the edits, a trained draft everywhere else.
//
// The dashed marks are the theoretical ceilings from the published acceptance
// rates, at the published 1.5× cost of an eight-row step:
//   prompt lookup, 5.4 accepted  ->  5.4 / 1.5 = 3.60×
//   Flash draft,   2.0 accepted  ->  2.0 / 1.5 = 1.33×
//   Flash draft on code, 5.0     ->  5.0 / 1.5 = 3.33×
//
// Zero JS. mlog10 for the log axis so the SVG serializes identically on server
// and client; everything else is +, -, * and /.

import { mlog10 } from "@/lib/dmath"

const WEIGHT_BYTES = 2_367_237_149 // model.safetensors, Hugging Face API, 12 Sep 2026
const MLX_TPS = 159 // median of the sixteen published rows
const FLOOR_MS = 4.5 // Husky's stated plain-streaming-read time for 2.4 GB

const mlxMs = 1000 / MLX_TPS
const HEADROOM = mlxMs / FLOOR_MS

type Mark = {
  label: string
  detail: string
  ratio: number
  kind: "floor" | "measured" | "ceiling"
}

const MARKS: Mark[] = [
  { label: "MLX", detail: `${MLX_TPS} tok/s median · ${mlxMs.toFixed(2)} ms per read`, ratio: 1, kind: "measured" },
  { label: "Husky alone, median of sixteen", detail: "the engine, host off the critical path", ratio: 1.125, kind: "measured" },
  { label: "Husky alone, best prose row", detail: "Question over a document", ratio: 1.21, kind: "measured" },
  { label: "a perfect one-token-per-read engine", detail: `${FLOOR_MS} ms bus floor ÷ ${mlxMs.toFixed(2)} ms`, ratio: HEADROOM, kind: "floor" },
  { label: "Flash draft ceiling, prose", detail: "2.0 tokens a step ÷ 1.5× step cost", ratio: 2 / 1.5, kind: "ceiling" },
  { label: "Flash on, median of sixteen", detail: "measured", ratio: 1.757, kind: "measured" },
  { label: "Flash draft ceiling, code", detail: "5.0 tokens a step ÷ 1.5×", ratio: 5 / 1.5, kind: "ceiling" },
  { label: "prompt-lookup ceiling, edits", detail: "5.4 tokens a step ÷ 1.5×", ratio: 5.4 / 1.5, kind: "ceiling" },
  { label: "Husky alone, function edit", detail: "measured — 614 tok/s", ratio: 614 / 163, kind: "measured" },
  { label: "Flash on, function edit", detail: "the headline — 730 tok/s", ratio: 730 / 163, kind: "measured" },
]

export function ReadBudget() {
  const W = 840
  const L = 300
  const R = 760
  const top = 76
  const rowH = 28
  const H = top + MARKS.length * rowH + 58

  // x = L + log10(v)/log10(5) * span
  const span = R - L
  const LOG_MAX = mlog10(5)
  const x = (v: number) => L + (mlog10(v) / LOG_MAX) * span

  const ticks = [1, 1.5, 2, 3, 5]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        speedup over MLX, log scale · the bus floor is 1.39× and everything above it is speculation
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A logarithmic chart of speedups over MLX from one times to five times. A solid line at 1.39 times marks the ceiling a perfect single-token decoder could reach on this machine, set by the memory bus: 2.37 gigabytes of weights per token against a 4.5 millisecond streaming floor. Husky's own median without its draft model is 1.125 times and its best prose row is 1.21 times, both below that line. Every larger figure sits above it: the Flash draft's theoretical ceiling on prose at 1.33 times, the measured Flash median at 1.76, the draft's code ceiling at 3.33, prompt lookup's edit ceiling at 3.60, and the two measured edit rows at 3.77 and 4.48 times."
      >
        <text x={16} y={24} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          one decode step reads {(WEIGHT_BYTES / 1e9).toFixed(3)} GB of Woof
        </text>
        <text x={16} y={38} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          4,205,751,296 params at 4 bits + fp16 scale and bias per group of 64 = 2.3657 GB
        </text>
        <text x={16} y={52} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          MLX at {mlxMs.toFixed(2)} ms/token is {(WEIGHT_BYTES / (mlxMs / 1000) / 1e9).toFixed(0)} GB/s effective · the stated floor is {(WEIGHT_BYTES / (FLOOR_MS / 1000) / 1e9).toFixed(0)} GB/s
        </text>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={top - 12} x2={x(t)} y2={top + MARKS.length * rowH - 8} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={x(t)} y={top - 18} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t}×
            </text>
          </g>
        ))}

        {/* the bus floor */}
        <line x1={x(HEADROOM)} y1={top - 14} x2={x(HEADROOM)} y2={top + MARKS.length * rowH - 8} className="stroke-foreground" strokeWidth={1.75} />

        {MARKS.map((m, i) => {
          const y = top + i * rowH
          const cy = y + 9
          const fill = m.kind === "measured" ? "fill-foreground" : m.kind === "floor" ? "fill-destructive" : "fill-muted-foreground"
          return (
            <g key={m.label}>
              <text x={L - 12} y={y + 7} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {m.label}
              </text>
              <text x={L - 12} y={y + 17} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8 }}>
                {m.detail}
              </text>
              <line x1={x(1)} y1={cy} x2={x(m.ratio)} y2={cy} className="stroke-border" strokeWidth={1} />
              {m.kind === "ceiling" ? (
                <rect x={x(m.ratio) - 4} y={cy - 4} width={8} height={8} className={fill} transform={`rotate(45 ${x(m.ratio)} ${cy})`} />
              ) : (
                <circle cx={x(m.ratio)} cy={cy} r={4.5} className={`${fill} stroke-background`} strokeWidth={1.4} />
              )}
              <text x={x(m.ratio) + 10} y={cy + 3.5} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {m.ratio.toFixed(2)}×
              </text>
            </g>
          )
        })}

        <text x={L - 12} y={H - 30} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          the line
        </text>
        <text x={L} y={H - 30} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          no engine reads the weights faster than the bus — so nothing that emits one token per read can pass 1.39×
        </text>
        <text x={L} y={H - 16} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          diamonds are ceilings derived from published acceptance rates; circles are measured rows
        </text>
      </svg>
    </figure>
  )
}
