"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Autoregressive decoding vs Uno's draft-then-verify cycle, over the same
// wall-clock axis.
//
// The mechanics come straight from the paper (Sec. 4.2, Algorithm 1):
//   - AR emits exactly one token per forward pass.
//   - Uno spends two forward passes per cycle — one draft pass, one verify
//     pass. The draft pass proposes a block of B-1 tokens in parallel (plus
//     one token that comes straight from the frozen AR head and is therefore
//     always accepted). The verify pass checks the drafted tokens left to
//     right, keeps the longest accepted prefix, and always contributes
//     exactly one token of its own at the end — either a resampled
//     replacement for the first rejected position, or, if nothing was
//     rejected, a bonus continuation token. So a cycle emits between 2 and
//     B+1 tokens, and always costs exactly 2 passes.
//
// A cycle's box strip is therefore always B+1 boxes: some accepted (green),
// then one AR-verifier token (purple) — either replacing the first rejection
// or extending the block — then whatever was drafted after it, discarded
// (grey), never touched again.
//
// The *sequence* of per-cycle token counts below is illustrative — hand-set,
// like the worked examples elsewhere on this site, not sampled from the
// paper's own per-cycle logs (it doesn't publish one). What is real: the
// block sizes (B=4 linear, B=16 tree K=32/V=32 — Uno's own two shipped
// sampler configs), the measured average tokens/cycle for each (tau, Table 2
// of the paper), and the measured batch-size-1 throughput for each against
// the same AR baseline (Table 18). The illustrative run's own average is
// shown separately from tau so the two are never confused.

type ConfigKey = "sys" | "perreq"

const CONFIGS: Record<
  ConfigKey,
  {
    label: string
    sub: string
    B: number
    tau: number
    throughput: number
    arThroughput: number
    cycles: number[]
  }
> = {
  sys: {
    label: "B = 4, linear sampler",
    sub: "optimized for aggregate throughput",
    B: 4,
    tau: 3.89,
    throughput: 305,
    arThroughput: 176,
    cycles: [5, 4, 2, 5, 3, 4],
  },
  perreq: {
    label: "B = 16, tree sampler (K=32, V=32)",
    sub: "optimized for single-stream latency",
    B: 16,
    tau: 5.97,
    throughput: 445,
    arThroughput: 176,
    cycles: [7, 4, 10, 3, 8, 6],
  },
}

const BLUE = "oklch(0.60 0.15 255)" // AR-head seed token, always accepted
const GOOD = "oklch(0.55 0.16 155)" // accepted diffusion draft
const PURPLE = "oklch(0.58 0.18 305)" // the verifier's own token
const GREY = "oklch(0.55 0.02 250)" // drafted, discarded

function Box({ color, opacity = 0.85, label }: { color: string; opacity?: number; label: string }) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-[9px] font-mono text-[#0c0a09] sm:h-8 sm:w-8"
      style={{ background: color, opacity }}
      title={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  )
}

function CycleStrip({ k, B }: { k: number; B: number }) {
  const accepted = k - 2
  const discarded = B + 1 - k
  const boxes: { color: string; opacity: number; label: string }[] = [
    { color: BLUE, opacity: 0.9, label: "AR-head seed token (always accepted)" },
  ]
  for (let i = 0; i < accepted; i++) {
    boxes.push({ color: GOOD, opacity: 0.85, label: `diffusion draft, accepted (position ${i + 1})` })
  }
  boxes.push({
    color: PURPLE,
    opacity: 0.85,
    label: accepted === B - 1 ? "AR verifier: bonus continuation token" : "AR verifier: resampled replacement token",
  })
  for (let i = 0; i < discarded; i++) {
    boxes.push({ color: GREY, opacity: 0.3, label: "diffusion draft, discarded (never verified)" })
  }
  return (
    <div className="flex flex-wrap gap-[3px]">
      {boxes.map((b, i) => (
        <Box key={i} {...b} />
      ))}
    </div>
  )
}

export function DecodingRace() {
  const [cfgKey, setCfgKey] = useState<ConfigKey>("perreq")
  const [revealed, setRevealed] = useState(3)
  const cfg = CONFIGS[cfgKey]
  const maxCycles = cfg.cycles.length

  const shown = cfg.cycles.slice(0, revealed)
  const unoTokens = shown.reduce((s, v) => s + v, 0)
  const passes = revealed * 2
  const arTokens = passes
  const liveSpeedup = unoTokens / arTokens
  const runAvg = unoTokens / revealed
  const realSpeedup = cfg.throughput / cfg.arThroughput

  const setConfig = (k: ConfigKey) => {
    setCfgKey(k)
    setRevealed(3)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          2 forward passes per Uno cycle · always 1 token per AR pass
        </span>
        <span className="font-mono text-[10px] text-foreground">
          this run: {liveSpeedup.toFixed(2)}× · measured (batch 1): {realSpeedup.toFixed(2)}×
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CONFIGS) as ConfigKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setConfig(k)}
              aria-pressed={cfgKey === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                cfgKey === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {CONFIGS[k].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{cfg.sub}</p>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">
                Uno — cycle {revealed} of {maxCycles}
              </span>
              <span className="font-mono text-[10px] tabular-nums" style={{ color: GOOD }}>
                {shown[revealed - 1]} tokens this cycle
              </span>
            </div>
            <div className="overflow-x-auto rounded-md border bg-muted/10 p-2">
              <CycleStrip k={shown[revealed - 1] ?? 2} B={cfg.B} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: BLUE }} /> AR-head seed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: GOOD }} /> diffusion draft, accepted
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: PURPLE }} /> AR verifier token
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: GREY, opacity: 0.4 }} /> drafted, discarded
            </span>
          </div>

          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              cumulative tokens emitted, cycle by cycle
            </div>
            <div className="flex h-16 items-end gap-1.5 rounded-md border bg-muted/10 p-2">
              {cfg.cycles.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 flex-col justify-end gap-[2px]">
                    <div
                      className="w-full rounded-t-[2px]"
                      style={{
                        height: `${(v / (cfg.B + 1)) * 100}%`,
                        background: i < revealed ? GOOD : "currentColor",
                        opacity: i < revealed ? 0.75 : 0.08,
                      }}
                    />
                  </div>
                  <div className="w-full rounded-b-[2px]" style={{ height: 6, background: BLUE, opacity: i < revealed ? 0.5 : 0.08 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>Uno bars scaled to block size B+1 = {cfg.B + 1}; the thin strip below each is AR&rsquo;s 2 tokens for the same 2 passes</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRevealed((r) => Math.max(1, r - 1))}
              disabled={revealed <= 1}
              className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              &larr; prev cycle
            </button>
            <span className="font-mono text-[10px] text-muted-foreground">
              {passes} forward passes so far
            </span>
            <button
              type="button"
              onClick={() => setRevealed((r) => Math.min(maxCycles, r + 1))}
              disabled={revealed >= maxCycles}
              className="cursor-pointer font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              next cycle &rarr;
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          After {revealed} cycle{revealed === 1 ? "" : "s"} ({passes} forward passes): Uno emitted{" "}
          <span className="font-mono text-foreground">{unoTokens}</span>{" "}tokens, AR emitted{" "}
          <span className="font-mono text-foreground">{arTokens}</span>{" "}— {liveSpeedup.toFixed(2)}× in this
          illustrative run (running average {runAvg.toFixed(2)}{" "}tokens/cycle). The paper&rsquo;s own measured
          average for this config is <span className="font-mono text-foreground">{cfg.tau.toFixed(2)}</span>{" "}
          tokens/cycle, sustaining <span className="font-mono text-foreground">{cfg.throughput}</span>{" "}tok/s at
          batch size 1 against the base model&rsquo;s <span className="font-mono text-foreground">{cfg.arThroughput}</span>{" "}
          — a real {realSpeedup.toFixed(2)}×.
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Notice the box that never changes color with the config: the first one. It comes straight out of the
          frozen AR head, not the diffusion pathway, so it is never rejected — the paper leans on exactly this fact
          to guarantee that even an all-reject cycle still emits two tokens. Everything grey was computed{" "}
          <em>in the same forward pass</em>{" "}as everything green; the diffusion pathway does not learn which
          positions to trust less, it just proposes all of them, and the frozen AR pass throws out whatever it
          would not have said itself.
        </p>
      </div>
    </figure>
  )
}
