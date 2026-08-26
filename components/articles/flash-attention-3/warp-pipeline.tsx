"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Three schedules for one attention tile, and what each one leaves idle.
//
// A Hopper SM has two units that matter here and they are separate hardware:
// the tensor cores that run WGMMA, and the multi-function unit that evaluates
// the exponential in the softmax. FlashAttention-2 runs them in sequence within
// a warp — GEMM, softmax, GEMM — so whichever is not working is stalled.
//
// FA3 attacks that twice. Warp specialization splits loading from arithmetic so
// the memory pipeline never blocks the maths. Then the "pingpong" schedule
// staggers two consumer warpgroups against each other with a named barrier, so
// while one is in softmax the other is in WGMMA. In the source those are
// `warp_scheduler_barrier_sync()` and `warp_scheduler_barrier_arrive()` in
// mainloop_fwd_sm90_tma_gmma_ws.hpp, and the switch that enables them is:
//
//   UseSchedulerBarrier = IntraWGOverlap
//       ? (NumMmaWarpGroups >= 2) && (!Is_FP8 ? kHeadDim <= 128 : kHeadDim >= 128)
//       : NumMmaWarpGroups == 2
//
// The proportions below are illustrative — a schematic of the dependency
// structure, not a profile. What is real is which units are busy at once.

const LOAD = "oklch(0.68 0.13 85)"
const GEMM = "oklch(0.60 0.15 255)"
const SOFT = "oklch(0.55 0.16 155)"
const IDLE = "oklch(0.62 0.03 250)"

type Mode = "fa2" | "ws" | "pingpong"

export function WarpPipeline() {
  const [mode, setMode] = useState<Mode>("fa2")
  const [tiles, setTiles] = useState(4)

  // per-tile unit costs, arbitrary units
  const L = 3
  const G = 4
  const S = 2

  type Span = { t: "load" | "gemm" | "soft" | "idle"; a: number; b: number }
  const rows: { label: string; spans: Span[] }[] = []

  if (mode === "fa2") {
    // one warp does everything, in order
    const spans: Span[] = []
    let t = 0
    for (let i = 0; i < tiles; i++) {
      spans.push({ t: "load", a: t, b: t + L })
      t += L
      spans.push({ t: "gemm", a: t, b: t + G })
      t += G
      spans.push({ t: "soft", a: t, b: t + S })
      t += S
    }
    rows.push({ label: "single warpgroup", spans })
  } else {
    // producer streams loads ahead of the consumers
    const step = mode === "ws" ? G + S : G
    const prod: Span[] = []
    for (let i = 0; i < tiles; i++) prod.push({ t: "load", a: i * step, b: i * step + L })
    rows.push({ label: "producer (TMA)", spans: prod })

    if (mode === "ws") {
      const c: Span[] = []
      let t = L
      for (let i = 0; i < tiles; i++) {
        c.push({ t: "gemm", a: t, b: t + G })
        t += G
        c.push({ t: "soft", a: t, b: t + S })
        t += S
      }
      rows.push({ label: "consumer", spans: c })
    } else {
      // pingpong: two consumers offset by one phase
      for (let w = 0; w < 2; w++) {
        const c: Span[] = []
        let t = L + w * G
        for (let i = 0; i < tiles; i++) {
          c.push({ t: "gemm", a: t, b: t + G })
          c.push({ t: "soft", a: t + G, b: t + G + S })
          t += G + S
        }
        rows.push({ label: `consumer ${w}`, spans: c })
      }
    }
  }

  const end = Math.max(...rows.flatMap((r) => r.spans.map((s) => s.b)))
  const serial = tiles * (L + G + S)

  // how much of the span has the tensor cores busy
  const gemmBusy = rows
    .flatMap((r) => r.spans)
    .filter((s) => s.t === "gemm")
    .reduce((a, s) => a + (s.b - s.a), 0)
  const util = Math.min(1, gemmBusy / end)

  const W = 700
  const X0 = 118
  const px = (t: number) => X0 + (t / (serial * 1.02)) * (W - X0 - 40)
  const H = rows.length * 30 + 46

  const colourOf = (t: Span["t"]) => (t === "load" ? LOAD : t === "gemm" ? GEMM : t === "soft" ? SOFT : IDLE)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {tiles} key/value tiles through one attention block
        </span>
        <span className="font-mono text-[10px]" style={{ color: mode === "fa2" ? IDLE : SOFT }}>
          {end} units vs {serial} serial · tensor cores busy {(util * 100).toFixed(0)}% of the time
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["fa2", "FA2 — one warpgroup, in order"],
              ["ws", "+ warp specialization"],
              ["pingpong", "+ pingpong overlap"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A timeline of ${tiles} tiles. ${
                mode === "fa2"
                  ? "One warpgroup loads, runs the GEMM and runs the softmax in sequence, so only one unit is ever busy."
                  : mode === "ws"
                    ? "A producer warpgroup streams loads ahead while a consumer alternates GEMM and softmax."
                    : "A producer streams loads while two consumer warpgroups are staggered, so one runs softmax while the other runs the GEMM."
              } Total span ${end} units against ${serial} for the fully serial schedule.`}
            </title>

            {rows.map((r, ri) => (
              <g key={r.label}>
                <text x={X0 - 10} y={22 + ri * 30} fontSize={8.5} textAnchor="end" fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                  {r.label}
                </text>
                <rect x={X0} y={10 + ri * 30} width={px(serial) - X0} height={18} rx={3} fill="currentColor" fillOpacity={0.04} />
                {r.spans.map((s, si) => (
                  <rect
                    key={si}
                    x={px(s.a)}
                    y={10 + ri * 30}
                    width={Math.max(1.5, px(s.b) - px(s.a))}
                    height={18}
                    rx={2}
                    fill={colourOf(s.t)}
                    fillOpacity={0.82}
                  />
                ))}
              </g>
            ))}

            <line x1={px(end)} y1={4} x2={px(end)} y2={H - 26} stroke="currentColor" strokeOpacity={0.45} />
            <text x={px(end) + 5} y={H - 30} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              done
            </text>
            {mode !== "fa2" ? (
              <>
                <line x1={px(serial)} y1={4} x2={px(serial)} y2={H - 26} stroke={IDLE} strokeOpacity={0.5} strokeDasharray="3 3" />
                <text x={px(serial) - 5} y={H - 30} fontSize={7.5} textAnchor="end" fill={IDLE} fontFamily="ui-monospace, monospace">
                  FA2 finishes here
                </text>
              </>
            ) : null}

            {(
              [
                ["TMA load", LOAD, 0],
                ["WGMMA — tensor cores", GEMM, 78],
                ["softmax — exp on the SFU", SOFT, 232],
              ] as const
            ).map(([label, colour, dx]) => (
              <g key={label}>
                <rect x={X0 + dx} y={H - 16} width={8} height={8} rx={1.5} fill={colour} fillOpacity={0.82} />
                <text x={X0 + dx + 12} y={H - 9} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            KV tiles
          </span>
          <Range
            min={2}
            max={10}
            step={1}
            value={tiles}
            onChange={(e) => setTiles(Number(e.target.value))}
            className="flex-1"
            aria-label="how many key and value tiles this attention block iterates over"
            accent={GEMM}
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{tiles}</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The tensor cores and the unit that evaluates the exponential are separate hardware, and the
          dependency chain inside one warp forces them to take turns: you cannot compute the softmax
          of a score matrix that has not been produced, and you cannot start the next GEMM until the
          probabilities exist. In FA2 that shows as a timeline where{" "}
          <span className="text-foreground">only one colour is ever active</span>.
          <br />
          <br />
          Warp specialization fixes the first stall. A dedicated producer warpgroup issues TMA loads
          for tile <em>i+1</em>{" "}while the consumer works on tile <em>i</em>, so the memory pipeline
          stops being on the critical path — and, because it is a separate warpgroup, it can be given
          24 registers while the consumers keep 240.
          <br />
          <br />
          Pingpong fixes the second. Two consumer warpgroups are staggered by one phase against a
          named barrier so that{" "}
          <span style={{ color: SOFT }}>one is in softmax</span>{" "}while{" "}
          <span style={{ color: GEMM }}>the other is in WGMMA</span>. Neither warpgroup is any
          faster; the tensor cores simply stop waiting. The heuristic that turns this on is oddly
          specific and worth quoting, because it inverts by data type: non-FP8 wants{" "}
          <span className="font-mono text-[11px] text-foreground">kHeadDim ≤ 128</span>, FP8 wants{" "}
          <span className="font-mono text-[11px] text-foreground">kHeadDim ≥ 128</span>. The comment
          above it says only &ldquo;these are tuned for speed. They don&rsquo;t affect
          correctness.&rdquo;
        </p>
      </div>
    </figure>
  )
}
