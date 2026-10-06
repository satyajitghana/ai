"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A sketch of FreeVideo's placement planner for MiniMax H3 / VDN-H3, on Linux.
//
// Sources, all in FlashML-org/FreeVideo at 9925fe7:
//   docs/execution-planning.md   the documented rules (budgets, residency,
//                                 disk streaming, VAE decoder placement)
//   freevideo_engine/policy.py    BLOCK_BYTES = 432_500_000,
//                                 RESIDENT_TARGET = 8, RESIDENT_VRAM_CEILING = 44,
//                                 ACTIVATION_BY_TOKENS (measured GiB a head group
//                                 needs beside the resident blocks)
//   freevideo_engine/geometry.py  frames -> latent frames -> video tokens
//
// What this is not: the real planner. policy.py is 1,142 lines, most of them
// measured special cases (the sub-10 GiB band alone has four paths, Windows has
// its own reserves). Two simplifications are made and named in the UI:
//   - free VRAM is taken to equal the card's capacity (no desktop using it);
//   - the host memory kept for non-weight work is a flat 2.5 GiB. That figure is
//     fitted, not read from code: it reproduces every cell of the published
//     blocks-in-VRAM grid (docs/assets/capacity-blocks.en.svg) for the 10 s clip
//     at the VRAM and RAM sizes offered here.
// The s/step figures are the project's own grid, measured on an H200 with VRAM
// capped by an MPS client limit and RAM by a cgroup. Compute is an H200's, so
// they say how placement costs time, not how fast a consumer card is.

const GiB = 1073741824
const BLOCK = 432_500_000 // one prepared FP8 transformer block, bytes
const BLOCKS = 50
const VAE_BLOCK = 268.6e6 // one VAE decoder block (docs/execution-planning.md)
const VAE_BLOCKS = 36

const ACCENT = "oklch(0.60 0.15 255)" // resident weights
const WARM = "oklch(0.68 0.13 85)" // activations
const MUTED = "oklch(0.62 0.03 250)" // host RAM
const HOT = "oklch(0.60 0.17 30)" // disk

// policy.py ACTIVATION_BY_TOKENS, GiB, measured on complete eight-step runs.
const ACT: Record<number, [number, number][]> = {
  4: [
    [41472, 6.11],
    [72576, 7.69],
    [102816, 9.97],
  ],
  8: [
    [41472, 6.11],
    [72576, 8.03],
    [102816, 10.53],
  ],
  16: [
    [41472, 6.75],
    [72576, 10.05],
    [102816, 14.21],
  ],
}

// Same interpolation as policy.activation_bytes: piecewise linear, nearest
// slope outside the range, and a wider group never needs less than a narrower.
function interp(group: number, tokens: number): number {
  const a = ACT[group]
  for (let i = 0; i < a.length - 1; i++) {
    const [lo, atLo] = a[i]
    const [hi, atHi] = a[i + 1]
    if (tokens <= hi || i === a.length - 2) {
      return atLo + ((atHi - atLo) / (hi - lo)) * (tokens - lo)
    }
  }
  return a[a.length - 1][1]
}
function activationGiB(head: number, tokens: number): number {
  return Math.max(...[4, 8, 16].filter((g) => g <= head).map((g) => interp(g, tokens)))
}

type Clip = { key: string; label: string; frames: number; tokens: number }
// geometry.py at 1344x768: frames round up to 17n+5, latent = (frames-5)/17*5+2,
// tokens = latent x 24 x 42.
const CLIPS: Clip[] = [
  { key: "5", label: "5 s", frames: 124, tokens: 37 * 1008 },
  { key: "10", label: "10 s", frames: 243, tokens: 72 * 1008 },
  { key: "14", label: "14.4 s", frames: 345, tokens: 102 * 1008 },
]
const VRAMS = [8, 12, 16, 24, 32]
const RAMS = [16, 24, 32]

// Seconds per sampling step from the project's capacity grid (H200, 1344x768,
// 243 frames, 8 single-pass steps). Keyed `${vram}-${ram}`. Reported, not re-run.
const GRID_S: Record<string, number> = {
  "8-16": 13.8,
  "12-16": 11.0,
  "16-16": 9.39,
  "24-16": 9.01,
  "32-16": 8.97,
  "8-24": 12.6,
  "12-24": 9.18,
  "16-24": 8.92,
  "24-24": 8.95,
  "32-24": 8.99,
  "8-32": 12.7,
  "12-32": 9.23,
  "16-32": 9.02,
  "24-32": 9.01,
  "32-32": 8.93,
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function plan(vram: number, ram: number, tokens: number) {
  const gpuBudget = vram - clamp(vram * 0.025, 0.5, 1)
  const ramBudget = ram - clamp(ram * 0.05, 1, 4)
  let head: number
  let act: number
  let band: "normal" | "small" | "staged"
  if (gpuBudget >= 10) {
    head = [16, 8, 4].find((g) => activationGiB(g, tokens) <= gpuBudget) ?? 4
    act = activationGiB(head, tokens)
    band = "normal"
  } else {
    head = 4
    act = activationGiB(4, tokens)
    // The no-weights path is gated on live VRAM less the 0.2 GiB minimum reserve.
    band = act <= vram - 0.2 ? "small" : "staged"
  }
  const vramFit =
    band === "staged" ? 0 : clamp(Math.floor(((gpuBudget - act) * GiB) / BLOCK), 0, 44)
  const hostBlocks = clamp(Math.floor(((ramBudget - 2.5) * GiB) / BLOCK), 0, BLOCKS)
  const mustHold = BLOCKS - hostBlocks
  const resident = Math.min(vramFit, Math.max(8, mustHold))
  const disk = Math.max(0, mustHold - resident)
  const inHost = BLOCKS - resident - disk
  const vaeResident =
    gpuBudget >= 20
      ? VAE_BLOCKS
      : clamp(Math.floor(((gpuBudget - 3.25) * GiB) / VAE_BLOCK), 0, VAE_BLOCKS)
  return { gpuBudget, ramBudget, head, act, band, resident, inHost, disk, vaeResident }
}

function Pills<T extends string | number>({
  label,
  options,
  value,
  onChange,
  fmt,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  fmt: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 font-mono text-[10px] text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            value === o
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {fmt(o)}
        </button>
      ))}
    </div>
  )
}

function Bar({ parts, total }: { parts: { v: number; color: string; label: string }[]; total: number }) {
  return (
    <div className="flex h-5 w-full overflow-hidden rounded-md border bg-muted/20">
      {parts
        .filter((p) => p.v > 0)
        .map((p) => (
          <div
            key={p.label}
            title={p.label}
            style={{ width: `${((p.v / total) * 100).toFixed(2)}%`, background: p.color }}
            className="h-full border-r border-background/60 last:border-r-0"
          />
        ))}
    </div>
  )
}

export function VramPlan() {
  const [vram, setVram] = useState(8)
  const [ram, setRam] = useState(16)
  const [clipKey, setClipKey] = useState("10")
  const clip = CLIPS.find((c) => c.key === clipKey) ?? CLIPS[1]
  const p = plan(vram, ram, clip.tokens)
  const blockGiB = BLOCK / GiB
  const residentGiB = p.resident * blockGiB
  const pcie = (BLOCKS - p.resident) * (BLOCK / 1e9)
  const diskGB = p.disk * (BLOCK / 1e9)
  const grid = clip.key === "10" ? GRID_S[`${vram}-${ram}`] : undefined

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          1344×768 · {clip.frames} frames · {clip.tokens} video tokens
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          sketch of the documented rules · Linux
        </span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <Pills label="VRAM" options={VRAMS} value={vram} onChange={setVram} fmt={(v) => `${v} GiB`} />
        <Pills label="RAM" options={RAMS} value={ram} onChange={setRam} fmt={(v) => `${v} GiB`} />
        <Pills
          label="clip"
          options={CLIPS.map((c) => c.key)}
          value={clipKey}
          onChange={setClipKey}
          fmt={(k) => CLIPS.find((c) => c.key === k)?.label ?? k}
        />

        <div className="space-y-3 pt-3">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>GPU budget {p.gpuBudget.toFixed(2)} GiB</span>
              <span>
                head group {p.head} of 56{p.band === "small" ? " · small-card band" : ""}
              </span>
            </div>
            <Bar
              total={Math.max(p.gpuBudget, p.act + residentGiB)}
              parts={[
                { v: Math.min(p.act, p.gpuBudget), color: WARM, label: "activations" },
                { v: residentGiB, color: ACCENT, label: "resident blocks" },
              ]}
            />
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              <span style={{ color: WARM }}>■</span> activations ≈ {p.act.toFixed(2)} GiB{" "}
              <span style={{ color: ACCENT }}>■</span> {p.resident} resident blocks ={" "}
              {residentGiB.toFixed(2)} GiB
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>where the 50 FP8 transformer blocks live</span>
              <span>RAM budget {p.ramBudget.toFixed(2)} GiB</span>
            </div>
            <Bar
              total={BLOCKS}
              parts={[
                { v: p.resident, color: ACCENT, label: "VRAM" },
                { v: p.inHost, color: MUTED, label: "host RAM" },
                { v: p.disk, color: HOT, label: "disk" },
              ]}
            />
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              <span style={{ color: ACCENT }}>■</span> {p.resident} in VRAM{" "}
              <span style={{ color: MUTED }}>■</span> {p.inHost} in host RAM{" "}
              <span style={{ color: HOT }}>■</span> {p.disk} re-read from disk
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">over PCIe per step</dt>
            <dd>{pcie.toFixed(1)} GB</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">from disk per step</dt>
            <dd style={{ color: p.disk ? HOT : undefined }}>{diskGB.toFixed(1)} GB</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">VAE decoder blocks on GPU</dt>
            <dd>
              {p.vaeResident} of {VAE_BLOCKS}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">H200 grid, s/step</dt>
            <dd>{grid !== undefined ? grid.toFixed(2) : "not measured"}</dd>
          </div>
        </dl>

        {p.band === "staged" ? (
          <p className="text-xs text-muted-foreground">
            Even four heads need {p.act.toFixed(2)} GiB here, more than the card has. The real planner
            then moves the residual stream and attention outputs into pinned host buffers, a path
            this sketch does not model; the project measured that route at up to 2.6 times slower.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Residency is capped at 44 and pulled down to 8 whenever host RAM can hold the rest:
            the project measured 8 blocks running 0.4% and 1.3% faster per step than 29 and 48. Blocks
            the host cannot retain either stay on the GPU or come off the disk every step.
          </p>
        )}
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        A simplified re-implementation of the rules in FreeVideo&apos;s{" "}
        <code>docs/execution-planning.md</code> and <code>policy.py</code>, with free VRAM taken as
        the full card and a fitted 2.5 GiB of host working memory. It reproduces the published
        blocks-in-VRAM grid for the 10 s clip at these sizes; the s/step column is the project&apos;s
        own H200 measurement with memory capped, so it shows the cost of placement, not a consumer
        card&apos;s speed.
      </figcaption>
    </figure>
  )
}
