import { mlog10 } from "@/lib/dmath"

import {
  A100_RIDGE,
  H100_RIDGE,
  KV_PER_TOKEN,
  MATMUL_PARAMS,
  WEIGHT_BYTES,
  decodeFlops,
  passBytes,
  prefillFlops,
} from "./model-shapes"

// Where the arithmetic actually goes — the number behind "prefill is compute-bound,
// decode is memory-bound."
//
// Arithmetic intensity is FLOPs performed per byte moved out of HBM. A GPU has its
// own ratio, the ridge point: peak FLOP/s divided by peak bandwidth. Work above the
// chip's ridge keeps the math units fed; work below it leaves them idle while the
// memory bus runs flat out. That one comparison carries both halves of the article's
// claim, and it explains the two facts stated separately above: why decode is slow
// per token, and why batching is the fix that works.
//
// A decode step reads all 13.5 GB of weights to do 14 GFLOP of work — about 1 FLOP
// per byte, against an A100 ridge of 153. The math units see one part in ~150 of
// what they could do, which is the "~30% GPU util" row of the table, from the other
// side. Batch 32 amortizes that one weight read across 32 requests and lifts the
// ratio to ~10: better, still nowhere near the ridge, which is exactly why batching
// raises throughput and never latency.
//
// Everything here is arithmetic on declared shapes (see model-shapes.ts), not a
// measurement. Server-rendered, zero JS; mlog10 so the SVG coordinates serialize
// identically in Node and the browser.

type Point = {
  label: string
  sub: string
  ai: number
  tone: "decode" | "prefill"
}

const POINTS: Point[] = [
  {
    label: "decode, batch 1",
    sub: "one token, 2k context",
    ai: decodeFlops(2048) / passBytes(2048),
    tone: "decode",
  },
  {
    label: "decode, batch 32",
    sub: "32 requests share one weight read",
    ai: (32 * decodeFlops(2048)) / passBytes(2048, 32),
    tone: "decode",
  },
  {
    label: "prefill, 128-token prompt",
    sub: "too short to amortize the weights",
    ai: prefillFlops(128) / passBytes(128),
    tone: "prefill",
  },
  {
    label: "prefill, 2k prompt",
    sub: "",
    ai: prefillFlops(2048) / passBytes(2048),
    tone: "prefill",
  },
  {
    label: "prefill, 8k prompt",
    sub: "",
    ai: prefillFlops(8192) / passBytes(8192),
    tone: "prefill",
  },
]

const DECODE = "oklch(0.66 0.15 150)"
const PREFILL = "oklch(0.66 0.14 210)"
const RIDGE = "oklch(0.62 0.19 30)"

const GB = (b: number) => (b / 1e9).toFixed(2)

export function ArithmeticIntensity() {
  const W = 680
  const ROW = 34
  const padT = 46
  const padL = 186
  const padR = 34
  const H = padT + POINTS.length * ROW + 46

  const lo = mlog10(0.5)
  const hi = mlog10(20000)
  const sx = (v: number) => padL + ((mlog10(v) - lo) / (hi - lo)) * (W - padL - padR)
  const ticks = [1, 10, 100, 1000, 10000]

  const ridgeX = sx(A100_RIDGE)
  const step = decodeFlops(2048)
  const solo = POINTS[0].ai

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          arithmetic intensity &middot; FLOPs performed per byte read from HBM
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          Llama-2 7B, fp16 &middot; arithmetic on declared shapes
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Log-scale plot of arithmetic intensity in FLOPs per byte for a 7B model in fp16. A dashed vertical line marks the A100 ridge point at 153 FLOPs per byte; everything to its left is memory-bound and everything to its right is compute-bound. Decode at batch 1 sits at about 1, decode at batch 32 at about 10, a 128-token prefill at about 126 — still left of the ridge — a 2048-token prefill at about 2000, and an 8192-token prefill at about 8000."
        >
          {/* bound regions */}
          <rect
            x={padL}
            y={padT - 22}
            width={ridgeX - padL}
            height={POINTS.length * ROW + 18}
            fill={DECODE}
            fillOpacity="0.05"
          />
          <rect
            x={ridgeX}
            y={padT - 22}
            width={W - padR - ridgeX}
            height={POINTS.length * ROW + 18}
            fill={PREFILL}
            fillOpacity="0.05"
          />

          <text
            x={(padL + ridgeX) / 2}
            y={padT - 30}
            textAnchor="middle"
            className="font-mono"
            fontSize="9.5"
            fill={DECODE}
          >
            memory-bound
          </text>
          <text
            x={(ridgeX + W - padR) / 2}
            y={padT - 30}
            textAnchor="middle"
            className="font-mono"
            fontSize="9.5"
            fill={PREFILL}
          >
            compute-bound
          </text>

          {/* x grid */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={sx(t)}
                y1={padT - 22}
                x2={sx(t)}
                y2={padT + POINTS.length * ROW - 4}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
              <text
                x={sx(t)}
                y={padT + POINTS.length * ROW + 12}
                textAnchor="middle"
                className="font-mono"
                fontSize="9"
                fill="currentColor"
                fillOpacity="0.5"
              >
                {t >= 1000 ? `${t / 1000}k` : t}
              </text>
            </g>
          ))}
          <text
            x={(padL + W - padR) / 2}
            y={H - 8}
            textAnchor="middle"
            className="font-mono"
            fontSize="9"
            fill="currentColor"
            fillOpacity="0.45"
          >
            FLOPs per byte (log scale)
          </text>

          {/* the ridge point */}
          <line
            x1={ridgeX}
            y1={padT - 22}
            x2={ridgeX}
            y2={padT + POINTS.length * ROW - 4}
            stroke={RIDGE}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={ridgeX}
            y={padT - 14}
            textAnchor="middle"
            className="font-mono"
            fontSize="9"
            fill={RIDGE}
          >
            A100 ridge {A100_RIDGE.toFixed(0)}
          </text>

          {POINTS.map((p, i) => {
            const y = padT + i * ROW + 6
            const color = p.tone === "decode" ? DECODE : PREFILL
            return (
              <g key={p.label}>
                <text
                  x={padL - 12}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="11"
                  fill="currentColor"
                  fillOpacity="0.85"
                >
                  {p.label}
                </text>
                {p.sub ? (
                  <text
                    x={padL - 12}
                    y={y + 14}
                    textAnchor="end"
                    className="font-mono"
                    fontSize="8.5"
                    fill="currentColor"
                    fillOpacity="0.45"
                  >
                    {p.sub}
                  </text>
                ) : null}
                <line
                  x1={padL}
                  y1={y}
                  x2={sx(p.ai)}
                  y2={y}
                  stroke={color}
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                />
                <circle cx={sx(p.ai)} cy={y} r="4.5" fill={color} />
                <text
                  x={sx(p.ai) + 9}
                  y={y + 3.5}
                  className="font-mono"
                  fontSize="9.5"
                  fill={color}
                >
                  {p.ai < 10 ? p.ai.toFixed(1) : p.ai.toFixed(0)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground/70">
              read per decode step
            </div>
            <div className="font-mono text-sm">{GB(WEIGHT_BYTES)} GB of weights</div>
            <div className="font-mono text-[11px] text-muted-foreground/80">
              plus {GB(KV_PER_TOKEN * 2048)} GB of KV cache at 2k context
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground/70">
              work done with it
            </div>
            <div className="font-mono text-sm">{(step / 1e9).toFixed(1)} GFLOP</div>
            <div className="font-mono text-[11px] text-muted-foreground/80">
              one token — {((2 * MATMUL_PARAMS) / 1e9).toFixed(1)} GFLOP of it against
              the weights
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground/70">
              distance from the ridge
            </div>
            <div className="font-mono text-sm" style={{ color: DECODE }}>
              {(A100_RIDGE / solo).toFixed(0)}&times; below
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/80">
              {(H100_RIDGE / solo).toFixed(0)}&times; on an H100 — a faster chip moves
              the ridge further away
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        The ridge point is the chip&rsquo;s own ratio — 312 TFLOP/s bf16 over 2,039 GB/s
        on an A100 — so it is the same line for every workload. Decode never reaches it
        at batch 1, and batching only walks toward it, which is why continuous batching
        buys throughput and not a faster first token. Note the short prefill too: 128
        tokens is not enough work to amortize one pass over the weights, so a short
        prompt is not compute-bound either.
      </figcaption>
    </figure>
  )
}
