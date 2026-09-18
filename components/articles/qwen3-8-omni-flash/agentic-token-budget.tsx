"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"

// Qwen discloses exactly ONE point on this curve, not the curve itself:
// on OmniVideoBench (628 real videos, average length 384s ≈ 6.4 min — Nanjing
// University's own published figure, not Qwen's), "Agentic Understanding" reads
// 63.4 -> 67.8 accuracy while spending 145,736 -> 79,117 tokens, a 45.7% cut
// (their number, not the 51.8% figure some secondary coverage repeats — that
// number does not appear anywhere in Qwen's blog post).
//
// Below is an ILLUSTRATIVE model, not more Qwen data: static ingestion samples
// at a fixed rate, so its tokens scale linearly with video length; the agentic
// mode's savings fraction is modeled as approaching a floor asymptotically
// (near-zero saving on a clip too short to have anything to skip, more saving
// the longer the video runs) and pinned so it reproduces Qwen's own anchor
// exactly at 6.4 minutes. Drag the slider — the disclosed number is marked.

const ANCHOR_MIN = 6.4
const STATIC_ANCHOR = 145736
const AGENTIC_ANCHOR = 79117
const FLOOR = 0.35 // illustrative: even on a long video, some fraction still gets watched
const RATE = STATIC_ANCHOR / ANCHOR_MIN // tokens/min, static — linear in length
const CONTEXT_CAP = 1_000_000 // Qwen3.8-Omni-Flash's context window

// Solve FLOOR + (1 - FLOOR) * exp(-t/TAU) = retained-at-anchor, once, for TAU.
const RETAINED_AT_ANCHOR = AGENTIC_ANCHOR / STATIC_ANCHOR
const TAU = -ANCHOR_MIN / mlog((RETAINED_AT_ANCHOR - FLOOR) / (1 - FLOOR))

function staticTokens(mins: number) {
  return RATE * mins
}
function agenticTokens(mins: number) {
  const retained = FLOOR + (1 - FLOOR) * mexp(-mins / TAU)
  return staticTokens(mins) * retained
}

const ACCENT = "oklch(0.68 0.16 205)" // cyan — agentic
const MUTED_LINE = "oklch(0.62 0.02 260)" // static

const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

export function AgenticTokenBudget() {
  const [mins, setMins] = useState(20)

  const s = staticTokens(mins)
  const a = agenticTokens(mins)
  const savedPct = 100 * (1 - a / s)
  const overCap = s > CONTEXT_CAP

  // chart geometry
  const W = 720
  const H = 260
  const X0 = 46
  const X1 = 700
  const Y0 = 16
  const Y1 = 208
  const MAXMIN = 60
  const YMAX = staticTokens(MAXMIN) * 1.04 // headroom above the static curve's peak
  const px = (m: number) => X0 + (m / MAXMIN) * (X1 - X0)
  const py = (t: number) => Y1 - (t / YMAX) * (Y1 - Y0)

  const N = 60
  const staticPath = Array.from({ length: N + 1 }, (_, i) => {
    const m = (i / N) * MAXMIN
    return `${i === 0 ? "M" : "L"} ${px(m).toFixed(1)} ${py(staticTokens(m)).toFixed(1)}`
  }).join(" ")
  const agenticPath = Array.from({ length: N + 1 }, (_, i) => {
    const m = (i / N) * MAXMIN
    return `${i === 0 ? "M" : "L"} ${px(m).toFixed(1)} ${py(agenticTokens(m)).toFixed(1)}`
  }).join(" ")
  const capY = py(CONTEXT_CAP)
  const anchorX = px(ANCHOR_MIN)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          static ingestion vs agentic exploration — tokens spent per query
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          model calibrated to one disclosed point, marked below
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">video length</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">
              {mins}
              <span className="text-xs text-muted-foreground"> min</span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">static tokens</div>
            <div
              className="mt-0.5 text-lg tabular-nums"
              style={{ color: overCap ? "oklch(0.62 0.2 25)" : "currentColor" }}
            >
              {fmt(s)}
              {overCap ? <span className="text-[10px]"> &gt; 1M ctx</span> : null}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">agentic tokens</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>
              {fmt(a)}
              <span className="text-xs text-muted-foreground"> (&minus;{savedPct.toFixed(0)}%)</span>
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              {`At ${mins} minutes, static ingestion costs about ${fmt(s)} tokens and agentic exploration about ${fmt(a)} tokens, a ${savedPct.toFixed(0)}% reduction. Static ingestion crosses the model's 1M-token context window at about 44 minutes of video.`}
            </title>

            {/* context-cap line */}
            {capY > Y0 && capY < Y1 ? (
              <>
                <line x1={X0} y1={capY} x2={X1} y2={capY} stroke="oklch(0.62 0.2 25)" strokeDasharray="4 3" strokeOpacity={0.6} />
                <text x={X1} y={capY - 5} fontSize={8.5} textAnchor="end" fill="oklch(0.62 0.2 25)" fontFamily="ui-monospace, monospace">
                  1M context window
                </text>
              </>
            ) : null}

            {/* axes */}
            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            {[0, 10, 20, 30, 40, 50, 60].map((m) => (
              <text key={m} x={px(m)} y={Y1 + 15} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                {m}
              </text>
            ))}
            <text x={(X0 + X1) / 2} y={H - 4} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              video length, minutes
            </text>

            {/* curves */}
            <path d={staticPath} fill="none" stroke={MUTED_LINE} strokeWidth={2} strokeOpacity={0.8} />
            <path d={agenticPath} fill="none" stroke={ACCENT} strokeWidth={2.4} />

            {/* disclosed anchor point */}
            <line x1={anchorX} y1={Y0} x2={anchorX} y2={Y1} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2 3" />
            <circle cx={anchorX} cy={py(STATIC_ANCHOR)} r={4} fill={MUTED_LINE} />
            <circle cx={anchorX} cy={py(AGENTIC_ANCHOR)} r={4} fill={ACCENT} />
            <text x={anchorX + 6} y={py(STATIC_ANCHOR) - 6} fontSize={8} fill={MUTED_LINE} fontFamily="ui-monospace, monospace">
              OmniVideoBench avg, disclosed: 145,736
            </text>
            <text x={anchorX + 6} y={py(AGENTIC_ANCHOR) + 12} fontSize={8} fill={ACCENT} fontFamily="ui-monospace, monospace">
              disclosed: 79,117 (&minus;45.7%, acc. 63.4&rarr;67.8)
            </text>

            {/* live marker */}
            {mins !== ANCHOR_MIN ? (
              <>
                <circle cx={px(mins)} cy={py(s)} r={3.5} fill={MUTED_LINE} stroke="var(--background)" strokeWidth={1} />
                <circle cx={px(mins)} cy={py(a)} r={3.5} fill={ACCENT} stroke="var(--background)" strokeWidth={1} />
              </>
            ) : null}
          </svg>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>video length — drag</span>
            <span className="tabular-nums text-foreground">{mins} min</span>
          </div>
          <Range min={1} max={MAXMIN} step={1} value={mins} onChange={(e) => setMins(+e.target.value)} className="w-full" aria-label="video length in minutes" accent={ACCENT} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The gray line is what uniform sampling costs: watch every second at a fixed rate, and
          tokens grow{" "}<span className="text-foreground">linearly</span> with length — cross{" "}
          <span style={{ color: "oklch(0.62 0.2 25)" }}>~44 minutes</span> and a single static pass
          no longer fits in the model&rsquo;s own 1M-token window, before a reply has been written.
          The agentic line is what Qwen describes instead: the model &ldquo;independently decides
          what to watch and listen to&rdquo; and gathers evidence coarse-to-fine, so it never has to
          scan the whole thing. The only two numbers on this chart Qwen actually published are the
          two dots at 6.4 minutes &mdash; the rest is this curve&rsquo;s shape, not measured data.
        </p>
      </div>
    </figure>
  )
}
