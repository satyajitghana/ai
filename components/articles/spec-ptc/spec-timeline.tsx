"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where the wall clock actually goes in a code-mode harness turn.
//
// A turn is: the model streams a REPL cell, then the cell executes, and the
// cell's tool calls are usually sub-LLM or sub-agent calls that take seconds
// each. Three ways to schedule that:
//
//   serial       what most harnesses do. Wait for the whole generation, then
//                run the cell top to bottom, blocking on each call in turn.
//   JIT          don't stream, but notice that independent calls in the cell
//                have no reason to run one after another. Overlap them with
//                each other.
//   speculative  launch each call the moment the stream has said enough to
//                specify it, so the calls overlap the generation too.
//
// Serial is `gen + n*tool`. JIT is `gen + tool`. Speculation is
// `max(gen, last_launch + tool)` — and once generation is the long pole, more
// tool calls stop costing anything at all, which is the shape worth seeing.
//
// This is a model, not a measurement. Real numbers are further down the page,
// and they are much messier than this.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Mode = "serial" | "jit" | "spec"

export function SpecTimeline() {
  const [mode, setMode] = useState<Mode>("serial")
  const [gen, setGen] = useState(24) // seconds of main-context generation
  const [tool, setTool] = useState(9) // seconds per sub-call
  const [n, setN] = useState(4)
  const [chained, setChained] = useState(false)

  // when each call is fully specified in the stream, as a fraction of the
  // generation — calls appear spread through the cell, not at the end
  const launchAt = (i: number) => gen * (0.28 + (0.55 * i) / Math.max(1, n - 1 || 1))

  // [start, end] for each call, per mode
  const bars: [number, number][] = []
  if (mode === "serial") {
    for (let i = 0; i < n; i++) bars.push([gen + i * tool, gen + (i + 1) * tool])
  } else if (mode === "jit") {
    for (let i = 0; i < n; i++) {
      if (chained) bars.push([gen + i * tool, gen + (i + 1) * tool])
      else bars.push([gen, gen + tool])
    }
  } else {
    for (let i = 0; i < n; i++) {
      const s = chained
        ? i === 0
          ? launchAt(0)
          : Math.max(launchAt(i), (bars[i - 1]?.[1] ?? 0))
        : launchAt(i)
      bars.push([s, s + tool])
    }
  }

  const toolsEnd = bars.length ? Math.max(...bars.map((b) => b[1])) : gen
  const wall = Math.max(gen, toolsEnd)
  const serialWall = gen + n * tool
  const speedup = serialWall / wall

  const W = 700
  const H = 58 + n * 17 + 30
  const X0 = 96
  const SPAN = Math.max(serialWall, wall) * 1.04
  const px = (t: number) => X0 + (t / SPAN) * (W - X0 - 58)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one harness turn: {n} sub-call{n > 1 ? "s" : ""} inside a generated REPL cell
        </span>
        <span className="font-mono text-[10px]" style={{ color: mode === "serial" ? WARM : GOOD }}>
          {wall.toFixed(0)}s wall · {speedup.toFixed(2)}× vs serial
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["serial", "serial — wait, then block on each"],
              ["jit", "JIT — overlap independent calls"],
              ["spec", "speculative — launch while streaming"],
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
          <button
            type="button"
            onClick={() => setChained((v) => !v)}
            aria-pressed={chained}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              chained
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            each call feeds the next
          </button>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A timeline of one harness turn. Main-context generation occupies the first ${gen} seconds; ${n} sub-calls of ${tool} seconds each are scheduled ${mode === "serial" ? "one after another once generation ends" : mode === "jit" ? "together once generation ends" : "as soon as the stream specifies them, overlapping the generation"}. Total wall time ${wall.toFixed(0)} seconds against ${serialWall.toFixed(0)} for the serial schedule.`}
            </title>

            {/* generation */}
            <text x={X0 - 8} y={22} fontSize={8.5} textAnchor="end" fill={ACCENT} fontFamily="ui-monospace, monospace">
              generation
            </text>
            <rect x={px(0)} y={12} width={Math.max(2, px(gen) - px(0))} height={14} rx={3} fill={ACCENT} fillOpacity={0.7} />
            <text x={px(gen) + 5} y={22} fontSize={7.5} fill={ACCENT} fillOpacity={0.8} fontFamily="ui-monospace, monospace">
              {gen}s
            </text>

            {/* launch markers */}
            {mode === "spec"
              ? Array.from({ length: n }, (_, i) => (
                  <line
                    key={i}
                    x1={px(launchAt(i))}
                    y1={12}
                    x2={px(launchAt(i))}
                    y2={40 + i * 17}
                    stroke={GOOD}
                    strokeOpacity={0.35}
                    strokeDasharray="2 3"
                  />
                ))
              : null}

            {bars.map((b, i) => (
              <g key={i}>
                <text x={X0 - 8} y={44 + i * 17} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                  sub-call {i + 1}
                </text>
                <rect
                  x={px(b[0])}
                  y={34 + i * 17}
                  width={Math.max(2, px(b[1]) - px(b[0]))}
                  height={12}
                  rx={3}
                  fill={mode === "serial" ? WARM : GOOD}
                  fillOpacity={0.7}
                />
              </g>
            ))}

            {/* the wall clock */}
            <line x1={px(wall)} y1={8} x2={px(wall)} y2={H - 26} stroke="currentColor" strokeOpacity={0.45} />
            <text x={px(wall) + 5} y={H - 30} fontSize={8} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
              {wall.toFixed(0)}s
            </text>
            {mode !== "serial" ? (
              <>
                <line x1={px(serialWall)} y1={8} x2={px(serialWall)} y2={H - 26} stroke={WARM} strokeOpacity={0.4} strokeDasharray="3 3" />
                <text x={px(serialWall) + 5} y={H - 16} fontSize={7.5} fill={WARM} fillOpacity={0.75} fontFamily="ui-monospace, monospace">
                  serial would finish here
                </text>
              </>
            ) : null}

            <line x1={X0} y1={H - 24} x2={W - 54} y2={H - 24} stroke="currentColor" strokeOpacity={0.2} />
            <text x={X0} y={H - 12} fontSize={7.5} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              0
            </text>
            <text x={W - 54} y={H - 12} fontSize={7.5} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              seconds →
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["generation", gen, setGen, 4, 90, 2, ACCENT, "how long the model streams the REPL cell, in seconds"],
              ["per sub-call", tool, setTool, 1, 40, 1, GOOD, "latency of one sub-LLM or sub-agent call, in seconds"],
              ["sub-calls", n, setN, 1, 8, 1, WARM, "how many tool calls the generated cell contains"],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={v}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{v}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The serial schedule is not a mistake anybody made deliberately — it is an inheritance. With
          JSON tool calling there was nothing to overlap: the model emits a call, the turn ends, the
          tool runs. When the action space became <em>code</em>, a turn started containing several
          calls and a long generation in front of them, and the same control flow quietly turned
          into the bottleneck.
          <br />
          <br />
          Two independent savings, and they compose. JIT alone collapses{" "}
          <span className="font-mono text-[11px] text-foreground">n × tool</span>{" "}to one{" "}
          <span className="font-mono text-[11px] text-foreground">tool</span>, because two sub-agent
          calls the model happened to write on consecutive lines were never actually sequential.
          Speculation then slides that block left, under the generation. Push the generation slider
          up — the regime of a model that thinks for a long time —{" "}
          <span className="text-foreground">and the tool calls stop being on the critical path at all</span>.
          Turn on &ldquo;each call feeds the next&rdquo; to see the limit: a genuine dependency chain
          cannot be flattened, and speculation buys only the head start.
        </p>
      </div>
    </figure>
  )
}
