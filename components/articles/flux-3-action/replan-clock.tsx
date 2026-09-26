"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How much robot motion one FLUX 3 Action plan buys, and what that does to the
// real-time factor BFL quotes.
//
// Latencies are BFL's Table 4 ("median end-to-end latency per predicted action
// chunk", prompt text cached, camera encoding recomputed every request), read
// from bfl.ai/blog/flux-3-action on 2026-09-26 for all four GPUs. They are
// reported, not measured here.
//
// The released DROID policy predicts 32 actions at 15 Hz and executes all 32
// (n_action_steps = 32), i.e. 2.13 s of motion per plan. BFL's real-time factor
// is latency / chunk duration with the whole chunk executed; pi0.5 predicts 15
// actions at 15 Hz = 1.00 s (Table 3). The slider asks what happens when you
// execute fewer actions before replanning, which is what a closed-loop user
// does (the game example executes 8, the shooter playback 2):
//
//   horizon  = n / 15 s
//   RTF      = latency / horizon
//   waiting  = latency / (latency + horizon)   with the synchronous select_action loop
//
// Only + - * / and toFixed, so the server and the browser print the same text.

const HZ = 15
const CHUNK = 32

const GPUS = ["B200", "H200", "RTX 6000 Pro", "RTX 5090"] as const
type Gpu = (typeof GPUS)[number]
type Prec = "fp8" | "bf16"
type Ckpt = "base" | "gd" | "sd"

// [bf16, fp8] in milliseconds
const F3: Record<Gpu, Record<Ckpt, [number, number]>> = {
  B200: { base: [246.42, 182.0], gd: [136.25, 101.71], sd: [41.06, 32.29] },
  H200: { base: [397.74, 291.67], gd: [216.91, 145.64], sd: [60.51, 43.81] },
  "RTX 6000 Pro": { base: [772.6, 553.1], gd: [426.0, 309.3], sd: [118.8, 91.5] },
  "RTX 5090": { base: [1458.62, 697.79], gd: [720.71, 344.51], sd: [179.8, 85.43] },
}
const COSMOS: Record<Gpu, [number, number]> = {
  B200: [387.71, 320.4],
  H200: [713.76, 575.75],
  "RTX 6000 Pro": [1278.3, 840.8],
  "RTX 5090": [1980.22, 1129.34],
}
// pi0.5 was served in BF16 only
const PI05: Record<Gpu, number> = { B200: 31.99, H200: 46.96, "RTX 6000 Pro": 57.7, "RTX 5090": 34.92 }

// Table 5 means over seeds, RoboLab-120 (%)
const SUCCESS: Record<Ckpt, [number, number]> = {
  base: [41.6, 41.16],
  gd: [42.19, 42.24],
  sd: [38.68, 37.92],
}
const CKPTS: { key: Ckpt; label: string; detail: string }[] = [
  { key: "base", label: "base", detail: "4 steps, guidance on" },
  { key: "gd", label: "guidance-distilled", detail: "4 steps, guidance baked in" },
  { key: "sd", label: "step-distilled", detail: "1 step" },
]

const ms = (x: number) => (x < 100 ? x.toFixed(2) : x.toFixed(1))
const three = (x: number) => x.toFixed(3)

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { key: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded border px-2 py-1",
            o.key === value
              ? "border-foreground/60 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ReplanClock() {
  const [gpu, setGpu] = useState<Gpu>("B200")
  const [ckpt, setCkpt] = useState<Ckpt>("sd")
  const [prec, setPrec] = useState<Prec>("fp8")
  const [n, setN] = useState(CHUNK)

  const pi = prec === "fp8" ? 1 : 0
  const lat = F3[gpu][ckpt][pi]
  const horizon = n / HZ
  const rtf = lat / 1000 / horizon
  const waiting = (lat / 1000 / (lat / 1000 + horizon)) * 100
  const piLat = PI05[gpu]
  const piRtf = piLat / 1000 / 1.0
  const cosLat = COSMOS[gpu][pi]
  const cosRtf = cosLat / 1000 / (CHUNK / HZ)
  const breakEven = (HZ * lat) / piLat
  const success = SUCCESS[ckpt][pi]

  // wall-clock strip: 5 s of a synchronous loop
  const W = 620
  const SPAN = 5
  const px = (s: number) => (s / SPAN) * W
  const blocks: { x: number; w: number; kind: "think" | "move" }[] = []
  let t = 0
  while (t < SPAN && blocks.length < 400) {
    const think = Math.min(lat / 1000, SPAN - t)
    blocks.push({ x: px(t), w: px(think), kind: "think" })
    t += lat / 1000
    if (t >= SPAN) break
    const move = Math.min(horizon, SPAN - t)
    blocks.push({ x: px(t), w: px(move), kind: "move" })
    t += horizon
  }

  const accent = "var(--hg-accent, oklch(0.72 0.15 195))"

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="How many actions FLUX 3 Action executes per plan, and the resulting real-time factor on four GPUs"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        one plan = 32 predicted actions at 15 Hz · latencies are BFL&rsquo;s, the horizon arithmetic
        is mine
      </div>

      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <Toggle
          label="GPU"
          value={gpu}
          options={GPUS.map((g) => ({ key: g, label: g }))}
          onChange={setGpu}
        />
        <Toggle
          label="checkpoint"
          value={ckpt}
          options={CKPTS.map((c) => ({ key: c.key, label: c.label }))}
          onChange={setCkpt}
        />
        <Toggle
          label="precision"
          value={prec}
          options={[
            { key: "fp8" as Prec, label: "FP8" },
            { key: "bf16" as Prec, label: "BF16" },
          ]}
          onChange={setPrec}
        />
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">execute</span>
          <Range
            min={1}
            max={CHUNK}
            step={1}
            value={n}
            onChange={(e) => setN(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="actions executed before replanning"
          />
          <span className="w-28 shrink-0 text-right tabular-nums">
            {n} of 32 · {horizon.toFixed(2)} s
          </span>
        </label>
      </div>

      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} 86`}
          width="100%"
          className="min-w-[440px]"
          role="img"
          aria-label={`One plan: ${n} of 32 predicted actions executed. Below, five seconds of a synchronous loop: ${ms(lat)} ms of compute, then ${horizon.toFixed(2)} s of motion, repeated.`}
        >
          <text x="0" y="10" className="fill-current font-mono text-[10px] opacity-60">
            one plan: 32 predicted actions
          </text>
          {Array.from({ length: CHUNK }, (_, i) => (
            <rect
              key={i}
              x={i * (W / CHUNK) + 1}
              y={16}
              width={W / CHUNK - 2}
              height={14}
              rx={2}
              fill={i < n ? accent : "none"}
              stroke="currentColor"
              strokeOpacity={i < n ? 0 : 0.3}
              strokeDasharray={i < n ? undefined : "2 2"}
            />
          ))}
          <text x="0" y="50" className="fill-current font-mono text-[10px] opacity-60">
            five seconds of the loop: dark = computing, colour = moving
          </text>
          {blocks.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={56}
              width={b.w > 0.5 ? b.w : 0.5}
              height={14}
              fill={b.kind === "move" ? accent : "currentColor"}
              fillOpacity={b.kind === "move" ? 0.85 : 0.75}
            />
          ))}
          {[0, 1, 2, 3, 4, 5].map((s) => (
            <text
              key={s}
              x={Math.min(px(s), W - 10)}
              y={84}
              textAnchor={s === 0 ? "start" : s === 5 ? "end" : "middle"}
              className="fill-current font-mono text-[10px] opacity-50"
            >
              {s} s
            </text>
          ))}
        </svg>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <div className="grid min-w-[26rem] grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1.5 font-mono text-xs tabular-nums">
          <span className="text-muted-foreground">policy on {gpu}</span>
          <span className="text-right text-muted-foreground">per call</span>
          <span className="text-right text-muted-foreground">motion</span>
          <span className="text-right text-muted-foreground">RTF</span>

          <span className="text-foreground">
            FLUX 3 Action, {CKPTS.find((c) => c.key === ckpt)?.label} {prec.toUpperCase()}
          </span>
          <span className="text-right">{ms(lat)} ms</span>
          <span className="text-right">{horizon.toFixed(2)} s</span>
          <span className="text-right text-foreground">{three(rtf)}</span>

          <span className="text-muted-foreground">π0.5, BF16, 15 actions</span>
          <span className="text-right text-muted-foreground">{ms(piLat)} ms</span>
          <span className="text-right text-muted-foreground">1.00 s</span>
          <span className="text-right text-muted-foreground">{three(piRtf)}</span>

          <span className="text-muted-foreground">Cosmos 3 Nano, {prec.toUpperCase()}, 32 actions</span>
          <span className="text-right text-muted-foreground">{ms(cosLat)} ms</span>
          <span className="text-right text-muted-foreground">2.13 s</span>
          <span className="text-right text-muted-foreground">{three(cosRtf)}</span>
        </div>
      </div>

      <div className="border-t px-4 py-3 font-mono text-xs">
        <p className="my-0">
          {rtf < piRtf ? (
            <span className="text-foreground">ahead of π0.5 per second of motion</span>
          ) : (
            <span className="text-foreground">behind π0.5 per second of motion</span>
          )}
          <span className="text-muted-foreground">
            {" "}
            · break-even at {breakEven > CHUNK ? "more than 32" : breakEven.toFixed(1)}
            {" "}executed actions · robot waits {waiting.toFixed(1)}% of the time in a synchronous
            loop
          </span>
        </p>
        <p className="my-0 mt-1 text-muted-foreground">
          RoboLab-120 success for this checkpoint and precision: {success.toFixed(2)}% (mean over
          seeds, BFL Table 5)
        </p>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Latencies: BFL&rsquo;s Table 4, median end-to-end per predicted chunk, prompt cached, cameras
        re-encoded each call; π0.5 was served in BF16 only. RTF = latency ÷ seconds of motion
        executed. BFL quotes RTF with all 32 actions executed; move the slider to see what
        replanning sooner costs.
      </figcaption>
    </figure>
  )
}
