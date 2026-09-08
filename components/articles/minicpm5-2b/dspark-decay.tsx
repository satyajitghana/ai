"use client"

import { useState } from "react"

import { mlog2 } from "@/lib/dmath"

// Every number is transcribed verbatim from aj9o9/MiniCPM5-2B-DSpark-GGUF's
// own README ("Numbers I actually measured" section): RTX 3090 24GB, Q8_0 KV
// cache, target MiniCPM5-2B-F16.gguf, draft MiniCPM5-2B-DSpark (block size 7,
// --spec-type draft-dspark), llama-benchy tg256 at four prompt depths. The
// draft was trained with max sequence length 12,288 tokens -- so the 8192
// depth point sits INSIDE the draft's training range, and 16384/32766/65536
// all sit outside it. The uploader's own read: "Speedup shrinks as depth
// grows, but TG still beats baseline out to 64k in this run" -- and
// separately, accept length (not wall-clock speedup) collapses toward ~1.6
// beyond the training range, which is a different, more pessimistic number
// than the throughput ratio charted here. Both are shown below rather than
// picking one.

type Row = { depth: number; label: string; base: number; dspark: number }

const ROWS: Row[] = [
  { depth: 8192, label: "8k", base: 109.54, dspark: 181.78 },
  { depth: 16384, label: "16k", base: 90.62, dspark: 134.47 },
  { depth: 32766, label: "32k", base: 70.18, dspark: 85.03 },
  { depth: 65536, label: "64k", base: 46.22, dspark: 69.96 },
]

const TRAIN_RANGE = 12288

const BASE = "oklch(0.62 0.03 250)"
const DSPARK = "oklch(0.55 0.16 155)"
const BOUND = "oklch(0.68 0.13 85)"

export function DsparkDecay() {
  const [showRatio, setShowRatio] = useState(true)

  const W = 700
  const H = 260
  const padL = 46
  const padB = 34
  const padT = 16
  const plotW = W - padL - 20
  const plotH = H - padT - padB

  const maxTps = 200
  // log scale on x for depth (8k..64k spans 3 octaves)
  const xLog = (d: number) => mlog2(d)
  const xMin = xLog(6000)
  const xMax = xLog(75000)
  const xPos = (d: number) => padL + ((xLog(d) - xMin) / (xMax - xMin)) * plotW
  const yPos = (v: number) => padT + plotH - (Math.min(v, maxTps) / maxTps) * plotH

  const linePath = (key: "base" | "dspark") =>
    ROWS.map((r, i) => `${i === 0 ? "M" : "L"} ${xPos(r.depth)} ${yPos(r[key])}`).join(" ")

  const ratioMax = 1.8
  const ratioY = (r: number) => padT + plotH - (r / ratioMax) * plotH

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">aj9o9&rsquo;s DSpark GGUF, tg256 on an RTX 3090 · Q8_0 KV</span>
        <button
          type="button"
          onClick={() => setShowRatio((v) => !v)}
          className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {showRatio ? "showing speedup ratio" : "showing raw tok/s"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              {`Decode throughput vs baseline at four prompt depths on an RTX 3090: 8k 109.5 to 181.8 tok/s (1.66x), 16k 90.6 to 134.5 (1.48x), 32k 70.2 to 85.0 (1.21x), 64k 46.2 to 70.0 (1.51x). The draft model's training range ends at 12,288 tokens, inside the 8k point and before every point after it.`}
            </title>

            {/* training range boundary */}
            <line
              x1={xPos(TRAIN_RANGE)}
              y1={padT}
              x2={xPos(TRAIN_RANGE)}
              y2={padT + plotH}
              stroke={BOUND}
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <text x={xPos(TRAIN_RANGE) + 4} y={padT + 10} fontSize={8} fill={BOUND} fontFamily="ui-monospace, monospace">
              draft trained to 12,288 tok
            </text>

            {/* y gridlines */}
            {showRatio
              ? [1.0, 1.2, 1.4, 1.6, 1.8].map((r) => (
                  <g key={r}>
                    <line x1={padL} y1={ratioY(r)} x2={padL + plotW} y2={ratioY(r)} stroke="currentColor" strokeOpacity={0.08} />
                    <text x={padL - 6} y={ratioY(r) + 3} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                      {r.toFixed(1)}×
                    </text>
                  </g>
                ))
              : [0, 50, 100, 150, 200].map((v) => (
                  <g key={v}>
                    <line x1={padL} y1={yPos(v)} x2={padL + plotW} y2={yPos(v)} stroke="currentColor" strokeOpacity={0.08} />
                    <text x={padL - 6} y={yPos(v) + 3} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                      {v}
                    </text>
                  </g>
                ))}

            {/* x axis labels */}
            {ROWS.map((r) => (
              <text key={r.depth} x={xPos(r.depth)} y={H - 10} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.65} fontFamily="ui-monospace, monospace">
                {r.label}
              </text>
            ))}

            {!showRatio ? (
              <>
                <path d={linePath("base")} fill="none" stroke={BASE} strokeWidth={1.6} />
                <path d={linePath("dspark")} fill="none" stroke={DSPARK} strokeWidth={2} />
                {ROWS.map((r) => (
                  <g key={r.depth}>
                    <circle cx={xPos(r.depth)} cy={yPos(r.base)} r={3} fill={BASE} />
                    <circle cx={xPos(r.depth)} cy={yPos(r.dspark)} r={3.5} fill={DSPARK} />
                    <text x={xPos(r.depth)} y={yPos(r.dspark) - 8} fontSize={8} textAnchor="middle" fill={DSPARK} fontFamily="ui-monospace, monospace">
                      {r.dspark.toFixed(0)}
                    </text>
                    <text x={xPos(r.depth)} y={yPos(r.base) + 14} fontSize={8} textAnchor="middle" fill={BASE} fontFamily="ui-monospace, monospace">
                      {r.base.toFixed(0)}
                    </text>
                  </g>
                ))}
              </>
            ) : (
              <>
                <path
                  d={ROWS.map((r, i) => `${i === 0 ? "M" : "L"} ${xPos(r.depth)} ${ratioY(r.dspark / r.base)}`).join(" ")}
                  fill="none"
                  stroke={DSPARK}
                  strokeWidth={2}
                />
                {ROWS.map((r) => (
                  <g key={r.depth}>
                    <circle cx={xPos(r.depth)} cy={ratioY(r.dspark / r.base)} r={3.5} fill={DSPARK} />
                    <text x={xPos(r.depth)} y={ratioY(r.dspark / r.base) - 8} fontSize={8.5} textAnchor="middle" fill={DSPARK} fontFamily="ui-monospace, monospace">
                      {(r.dspark / r.base).toFixed(2)}×
                    </text>
                  </g>
                ))}
                <line x1={padL} y1={ratioY(1)} x2={padL + plotW} y2={ratioY(1)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 2" />
              </>
            )}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: BASE }} />
            baseline (no draft)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: DSPARK }} />
            + DSpark, n-max 7
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROWS.map((r) => (
            <div key={r.depth} className="rounded-lg border bg-muted/20 px-2.5 py-1.5">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{r.label} depth</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: DSPARK }}>
                {(r.dspark / r.base).toFixed(2)}×
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The speedup is not a flat multiplier and it does not decay smoothly: 1.66× at 8k (still{" "}
          <span style={{ color: BOUND }}>inside</span> the draft&rsquo;s 12,288-token training
          range), falling to 1.48× at 16k and 1.21× at 32k once the draft is extrapolating — then
          climbing back to 1.51× at 64k in this specific run. The uploader flags exactly this
          himself: wall-clock speedup and accept length are &ldquo;related but not the same
          number,&rdquo; and while VRAM stays a predictable +1.8 GB for the draft (8.3 GB baseline
          to 10.1 GB with DSpark loaded), the official card&rsquo;s accept-length figures — ~5.5 at
          T=0, ~4.1 at T=1.0 on in-distribution prompts — are reported to collapse toward ~1.6 once
          you push well past the training range. Treat the throughput curve above as one honest
          measurement on one box, not a guarantee that holds at every context length.
        </p>
      </div>
    </figure>
  )
}
