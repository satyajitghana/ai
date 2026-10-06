"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What OpenCut (classic) does to draw one frame of a timeline.
//
// The editor stores time as an integer tick count, 120,000 ticks a second
// (rust/crates/time). A frame rate is a rational num/den, and a frame lasts
// 120,000 x den / num ticks, which is an integer for every standard rate.
// To draw frame n the renderer (services/renderer/resolve.ts) visits every
// element bottom to top and, for each one, computes
//
//   clipTime   = t - startTime                 (skip if outside [0, duration))
//   sourceTime = trimStart + clipTime x rate   (retime/resolve.ts)
//
// then asks the decoder for the source frame at sourceTime and hands the
// layers to the GPU compositor. Export (scene-exporter.ts) runs exactly that
// for n = 0 .. floor(duration / ticksPerFrame) - 1 and feeds each composited
// canvas to the encoder.
//
// The timeline below is a made-up three-element project. Only + - * / and
// Math.floor/round/min/max are used, so server and client render identically.

const TPS = 120_000

const RATES: { label: string; num: number; den: number }[] = [
  { label: "23.976", num: 24000, den: 1001 },
  { label: "24", num: 24, den: 1 },
  { label: "25", num: 25, den: 1 },
  { label: "29.97", num: 30000, den: 1001 },
  { label: "30", num: 30, den: 1 },
  { label: "60", num: 60, den: 1 },
]

const SPEEDS = [0.5, 1, 1.5, 2]

type El = {
  id: string
  name: string
  track: string
  kind: "video" | "text"
  start: number // ticks
  duration: number // ticks
  trimStart: number // ticks
  rate: number
  color: string
}

function fmtTicks(t: number): string {
  return t.toLocaleString("en-US")
}

function fmtSec(t: number): string {
  return (t / TPS).toFixed(3)
}

export function FrameResolver() {
  const [rateIdx, setRateIdx] = useState(4)
  const [frame, setFrame] = useState(75)
  const [trimA, setTrimA] = useState(0.5)
  const [speedB, setSpeedB] = useState(1)

  const fr = RATES[rateIdx]
  const tpf = (TPS * fr.den) / fr.num // integer for every rate offered

  // Clip A: a 6 s source on the main track, trimmed at its head.
  const aDur = Math.round((6 - trimA) * TPS)
  // Clip B: a 4 s source on an overlay track, starting at 2 s, retimed.
  const bDur = Math.round((4 / speedB) * TPS)
  const els: El[] = [
    { id: "a", name: "clip-a.mp4", track: "main", kind: "video", start: 0, duration: aDur, trimStart: Math.round(trimA * TPS), rate: 1, color: "#3b82f6" },
    { id: "b", name: "clip-b.mp4", track: "video 2", kind: "video", start: 2 * TPS, duration: bDur, trimStart: 0, rate: speedB, color: "#f59e0b" },
    { id: "t", name: "Default text", track: "text", kind: "text", start: 2 * TPS, duration: 5 * TPS, trimStart: 0, rate: 1, color: "#10b981" },
  ]

  const total = Math.max(...els.map((e) => e.start + e.duration))
  const frameCount = Math.floor(total / tpf)
  const n = Math.min(frame, frameCount - 1)
  const t = n * tpf

  const rows = els.map((e) => {
    const clipTime = t - e.start
    const active = clipTime >= 0 && clipTime < e.duration
    const source = e.trimStart + Math.round(clipTime * e.rate)
    return { e, clipTime, active, source }
  })
  // Bottom to top: main first, then overlays in order (scene-builder.ts).
  const drawn = rows.filter((r) => r.active)

  // Timeline geometry
  const W = 640
  const pad = 70
  const lane = 26
  const span = Math.max(total, 7 * TPS)
  const x = (tick: number) => pad + ((W - pad - 10) * tick) / span
  const laneOrder = ["text", "video 2", "main"]

  return (
    <figure className="my-8 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="text-muted-foreground">frame rate</span>
        {RATES.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRateIdx(i)}
            aria-pressed={i === rateIdx}
            className={
              "rounded border px-2 py-0.5 transition-colors " +
              (i === rateIdx
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted")
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${lane * 3 + 34}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A three-track timeline. The playhead is at frame ${n}, ${fmtSec(t)} seconds.`}
      >
        {laneOrder.map((name, i) => (
          <g key={name}>
            <text x={4} y={20 + i * lane + 16} className="fill-muted-foreground" fontSize={10} fontFamily="monospace">
              {name}
            </text>
            <rect x={pad} y={20 + i * lane + 3} width={W - pad - 10} height={lane - 6} className="fill-muted/40" />
          </g>
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((s) => s * TPS <= span).map((s) => (
          <g key={s}>
            <line x1={x(s * TPS)} x2={x(s * TPS)} y1={12} y2={18} className="stroke-muted-foreground" strokeWidth={1} />
            <text x={x(s * TPS) + 2} y={11} fontSize={9} fontFamily="monospace" className="fill-muted-foreground">
              {s}s
            </text>
          </g>
        ))}
        {els.map((e) => {
          const i = laneOrder.indexOf(e.track)
          const r = rows.find((q) => q.e.id === e.id)
          return (
            <g key={e.id}>
              <rect
                x={x(e.start)}
                y={20 + i * lane + 3}
                width={x(e.start + e.duration) - x(e.start)}
                height={lane - 6}
                rx={3}
                fill={e.color}
                opacity={r && r.active ? 0.95 : 0.45}
              />
              <text x={x(e.start) + 4} y={20 + i * lane + 17} fontSize={10} fontFamily="monospace" fill="#fff">
                {e.name}
                {e.rate !== 1 ? ` x${e.rate}` : ""}
              </text>
            </g>
          )
        })}
        <line x1={x(t)} x2={x(t)} y1={14} y2={20 + lane * 3} stroke="#ef4444" strokeWidth={2} />
      </svg>

      <label className="mt-2 block font-mono text-[11px]">
        <span className="text-muted-foreground">playhead</span> frame {n} of {frameCount} ·{" "}
        {fmtTicks(t)} ticks · {fmtSec(t)} s
        <Range
          min={0}
          max={frameCount - 1}
          value={n}
          onChange={(ev) => setFrame(Number(ev.target.value))}
          aria-label="Playhead frame"
          className="mt-1 w-full"
          accent="#ef4444"
        />
      </label>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="block font-mono text-[11px]">
          <span className="text-muted-foreground">clip-a trimStart</span> {trimA.toFixed(2)} s
          <Range
            min={0}
            max={2}
            step={0.25}
            value={trimA}
            onChange={(ev) => setTrimA(Number(ev.target.value))}
            aria-label="Trim off the head of clip A, in seconds"
            className="mt-1 w-full"
          />
        </label>
        <div className="font-mono text-[11px]">
          <span className="text-muted-foreground">clip-b speed</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeedB(s)}
                aria-pressed={s === speedB}
                className={
                  "rounded border px-2 py-0.5 transition-colors " +
                  (s === speedB
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-muted")
                }
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse font-mono text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2 font-normal">element</th>
              <th className="py-1 pr-2 font-normal">clipTime = t − start</th>
              <th className="py-1 pr-2 font-normal">sourceTime = trim + clipTime × rate</th>
              <th className="py-1 font-normal">drawn?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.e.id} className="border-t border-border/60">
                <td className="py-1 pr-2" style={{ color: r.e.color }}>
                  {r.e.name}
                </td>
                <td className="py-1 pr-2">
                  {fmtTicks(r.clipTime)}
                </td>
                <td className="py-1 pr-2">
                  {r.active
                    ? r.e.kind === "video"
                      ? `${fmtTicks(r.source)} ticks → decode frame at ${fmtSec(r.source)} s`
                      : "(text: drawn, no decode)"
                    : "—"}
                </td>
                <td className="py-1">{r.active ? "yes" : r.clipTime < 0 ? "not yet" : "ended"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 mb-0 font-mono text-[11px]">
        <span className="text-muted-foreground">composite, bottom to top:</span>{" "}
        background{drawn.map((r) => ` → ${r.e.name}`).join("")}
      </p>
      <p className="mt-1 mb-0 font-mono text-[11px]">
        <span className="text-muted-foreground">one frame at {fr.label} fps:</span>{" "}
        120,000 × {fr.den} ÷ {fr.num} = {fmtTicks(tpf)} ticks. Export renders{" "}
        floor({fmtTicks(total)} ÷ {fmtTicks(tpf)}) = {frameCount} frames, one at a time.
      </p>

      <figcaption className="mt-3 text-xs text-muted-foreground">
        A made-up three-element project, resolved with the same arithmetic as OpenCut
        classic&apos;s renderer: integer ticks at 120,000 a second, a per-element clip time,
        and a source time scaled by the clip&apos;s speed. Elements outside their span are
        skipped; the rest are composited from the main track up.
      </figcaption>
    </figure>
  )
}
