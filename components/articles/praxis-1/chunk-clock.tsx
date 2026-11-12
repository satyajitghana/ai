"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How Praxis-1's control loop spends wall-clock time.
//
// Every call returns one chunk: 24 action rows at 15 Hz = 1.6 s of motion
// (configs/serve_droid.yaml: exec_horizon 24; report section 5). Two schedules
// ship in praxis-1-oss:
//
//   chunked (default): call, wait L, execute the whole chunk, call again.
//     hold-still share = L / (L + H)
//     an event right after a call's frames were taken is first seen by the
//     next call (H + L later) and acted on L after that: worst case H + 2L.
//   rtc (opt-in): ask for the next chunk L before the current one ends, so
//     the arm keeps moving; the new chunk continues from where the arm will
//     be. In steady state the arm never waits (if L < H); the worst-case
//     reaction is one period plus one call: H + L.
//
// Reported numbers this reproduces (report, section 5): bimanual station,
// chunked, 0.8-0.9 s per call -> 32% holding still; 0.3 s per call -> 16%.
// RTC cut those to 5% and 3% (junction overheads the ideal model here
// leaves out). The latency presets are the report's p50 server times.
// Only + - * / and toFixed, so server and browser print the same text.

const HZ = 15
const ROWS = 24

const PRESETS: { label: string; ms: number }[] = [
  { label: "RTC + streaming, DROID", ms: 124 },
  { label: "faster server", ms: 300 },
  { label: "chunked, DROID p50", ms: 522 },
  { label: "chunked, YAM p50", ms: 545 },
  { label: "slow session", ms: 850 },
]

type Mode = "chunked" | "rtc"

export function ChunkClock() {
  const [mode, setMode] = useState<Mode>("chunked")
  const [ms, setMs] = useState(545)
  const [rows, setRows] = useState(ROWS)

  const L = ms / 1000
  const H = rows / HZ
  const rtcOk = L < H
  const effMode: Mode = mode === "rtc" && !rtcOk ? "chunked" : mode

  const hold = effMode === "chunked" ? (L / (L + H)) * 100 : 0
  const react = effMode === "chunked" ? H + 2 * L : H + L
  const rtf = L / H
  const callsPerMin = effMode === "chunked" ? 60 / (L + H) : 60 / H

  // 8 s of wall clock
  const SPAN = 8
  const W = 640
  const px = (s: number) => (s / SPAN) * W
  type Seg = { x: number; w: number; kind: "think" | "move" | "wait"; row: number }
  const segs: Seg[] = []
  if (effMode === "chunked") {
    let t = 0
    while (t < SPAN && segs.length < 200) {
      segs.push({ x: px(t), w: px(Math.min(L, SPAN - t)), kind: "wait", row: 1 })
      segs.push({ x: px(t), w: px(Math.min(L, SPAN - t)), kind: "think", row: 0 })
      t += L
      if (t >= SPAN) break
      segs.push({ x: px(t), w: px(Math.min(H, SPAN - t)), kind: "move", row: 1 })
      t += H
    }
  } else {
    // first call blocks; afterwards each call starts L before the chunk ends
    segs.push({ x: 0, w: px(Math.min(L, SPAN)), kind: "wait", row: 1 })
    segs.push({ x: 0, w: px(Math.min(L, SPAN)), kind: "think", row: 0 })
    let start = L
    while (start < SPAN && segs.length < 200) {
      segs.push({ x: px(start), w: px(Math.min(H, SPAN - start)), kind: "move", row: 1 })
      const callAt = start + H - L
      if (callAt < SPAN) {
        segs.push({ x: px(callAt), w: px(Math.min(L, SPAN - callAt)), kind: "think", row: 0 })
      }
      start += H
    }
  }

  const accent = "var(--hg-accent, oklch(0.72 0.15 195))"

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Praxis-1's control loop: how call latency and the schedule decide how long the arm holds still"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        one call = {ROWS} rows at 15 Hz = 1.6 s of motion · latencies are Runway&rsquo;s, the
        arithmetic is mine
      </div>

      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="schedule">
          <span className="w-24 shrink-0 text-muted-foreground">schedule</span>
          {(
            [
              { key: "chunked", label: "chunked (default)" },
              { key: "rtc", label: "real-time chunking" },
            ] as { key: Mode; label: string }[]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={o.key === mode}
              onClick={() => setMode(o.key)}
              className={cn(
                "rounded border px-2 py-1",
                o.key === mode
                  ? "border-foreground/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="latency presets">
          <span className="w-24 shrink-0 text-muted-foreground">presets</span>
          {PRESETS.map((p) => (
            <button
              key={p.ms}
              type="button"
              aria-pressed={p.ms === ms}
              onClick={() => setMs(p.ms)}
              className={cn(
                "rounded border px-2 py-1",
                p.ms === ms
                  ? "border-foreground/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label} · {p.ms} ms
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-muted-foreground">call latency</span>
          <Range
            min={50}
            max={1500}
            step={5}
            value={ms}
            onChange={(e) => setMs(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="round-trip latency of one policy call, in milliseconds"
          />
          <span className="w-20 shrink-0 text-right tabular-nums">{ms} ms</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-muted-foreground">rows executed</span>
          <Range
            min={4}
            max={ROWS}
            step={1}
            value={rows}
            onChange={(e) => setRows(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="action rows executed per call"
          />
          <span className="w-20 shrink-0 text-right tabular-nums">
            {rows} · {H.toFixed(2)} s
          </span>
        </label>
      </div>

      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} 92`}
          width="100%"
          className="min-w-[440px]"
          role="img"
          aria-label={`Eight seconds of the ${effMode === "chunked" ? "chunked" : "real-time chunking"} loop with ${ms} ms calls and ${rows} rows per chunk: the arm holds still ${hold.toFixed(1)}% of the time.`}
        >
          <text x="0" y="10" className="fill-current font-mono text-[10px] opacity-60">
            GPU: one policy call per block
          </text>
          <text x="0" y="44" className="fill-current font-mono text-[10px] opacity-60">
            arm: colour = executing a chunk, hatched = holding still
          </text>
          <defs>
            <pattern id="praxis-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
            </pattern>
          </defs>
          {segs.map((s, i) => (
            <rect
              key={i}
              x={s.x}
              y={s.row === 0 ? 16 : 50}
              width={s.w > 0.5 ? s.w : 0.5}
              height={14}
              rx={1.5}
              fill={s.kind === "move" ? accent : s.kind === "wait" ? "url(#praxis-hatch)" : "currentColor"}
              fillOpacity={s.kind === "move" ? 0.85 : s.kind === "think" ? 0.7 : 1}
              stroke={s.kind === "move" ? "var(--background, white)" : "none"}
              strokeWidth={s.kind === "move" ? 1 : 0}
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <text
              key={s}
              x={Math.min(px(s), W - 10)}
              y={88}
              textAnchor={s === 0 ? "start" : s === 8 ? "end" : "middle"}
              className="fill-current font-mono text-[10px] opacity-50"
            >
              {s} s
            </text>
          ))}
        </svg>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <div className="grid min-w-[24rem] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 font-mono text-xs tabular-nums">
          <span className="text-muted-foreground">arm holding still</span>
          <span className="text-right text-foreground">{hold.toFixed(1)}%</span>
          <span className="text-muted-foreground">worst-case reaction to a change in the scene</span>
          <span className="text-right text-foreground">{react.toFixed(2)} s</span>
          <span className="text-muted-foreground">GPU seconds per second of motion</span>
          <span className="text-right">{rtf.toFixed(3)}</span>
          <span className="text-muted-foreground">policy calls per minute</span>
          <span className="text-right">{callsPerMin.toFixed(1)}</span>
        </div>
      </div>

      <div className="border-t px-4 py-3 font-mono text-xs text-muted-foreground">
        {mode === "rtc" && !rtcOk ? (
          <p className="my-0 text-foreground">
            A call longer than the chunk cannot be hidden: the next plan would arrive after the arm
            ran out of motion, so this falls back to the chunked loop.
          </p>
        ) : effMode === "chunked" ? (
          <p className="my-0">
            Reported check: at 0.85 s per call the ideal loop holds still{" "}
            {((0.85 / (0.85 + 1.6)) * 100).toFixed(1)}% (Runway measured 32% at 0.8&ndash;0.9 s); at
            0.3 s, {((0.3 / (0.3 + 1.6)) * 100).toFixed(1)}% (Runway: 16%).
          </p>
        ) : (
          <p className="my-0">
            Ideal real-time chunking hides the call behind motion. Runway measured 5% and 3% holding
            still, not zero: the junction between plans costs something this sketch leaves out.
          </p>
        )}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Chunked: call, wait, execute all rows, call again; holding still = L&nbsp;÷&nbsp;(L&nbsp;+&nbsp;H).
        Real-time chunking: the next call starts L before the current chunk ends. Presets are the
        report&rsquo;s p50 server times on one H100 (124&ndash;545 ms) and the two session
        latencies it quotes.
      </figcaption>
    </figure>
  )
}
