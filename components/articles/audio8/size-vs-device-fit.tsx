"use client"

import { useState } from "react"

import { mlog2 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Every artifact in the Audio8 family, positioned on a log2 scale by its
// real download size (huggingface.co/api/models/<repo>?blobs=true, summed
// over siblings[].size). Two reference lines are Audio8's own measured
// numbers, not this piece's estimates:
//
//   "phone" line, 224 MB -- Audio8-ASR-0.1B-iOS-ANE's own demo screenshot
//   (assets/iphone-asr-demo-footprint.png): "Memory footprint 183 MB
//   (peak 224)" during a live microphone transcription run on a physical
//   iPhone. The card's prose target is "roughly 200 MB."
//
//   "laptop" line, 1229 MB -- Audio8-TTS-Preview-0.6B-ONNX-INT4's own
//   README: "the service used about 1004 MiB after loading and
//   approximately 1.1-1.2 GiB at synthesis peak" on a 16 GB Apple M2
//   MacBook Air. 1229 MiB is the top of that stated range.
//
// These two lines are live RAM Audio8 measured; the bars below are on-disk
// package size, a different (related, usually smaller) number. Labelled as
// such below rather than conflated.

type Family = "asr" | "tts" | "unified"
type Kind = "base" | "deploy" | "external"

type Item = {
  key: string
  label: string
  mb: number
  family: Family
  kind: Kind
}

const ITEMS: Item[] = [
  { key: "asr01-ane", label: "Audio8-ASR-0.1B-iOS-ANE", mb: 416.9, family: "asr", kind: "deploy" },
  { key: "tts01-int8", label: "audio8-TTS-0.1B-ONNX-INT8", mb: 818.4, family: "tts", kind: "deploy" },
  { key: "tts06-int4", label: "Audio8-TTS-Preview-0.6B-ONNX-INT4", mb: 968.3, family: "tts", kind: "deploy" },
  { key: "asr01-base", label: "Audio8-ASR-0.1B (base)", mb: 707.8, family: "asr", kind: "base" },
  { key: "ark06-int8", label: "ark-asr-0.6b-int8-onnx", mb: 1687.4, family: "asr", kind: "deploy" },
  { key: "tts01-base", label: "Audio8-TTS-Preview-0.1b (base)", mb: 1617.8, family: "tts", kind: "base" },
  { key: "tts06-base", label: "Audio8-TTS-Preview-0.6b (base)", mb: 2446.7, family: "tts", kind: "base" },
  { key: "ark06-base", label: "ARK-ASR-0.6B (base)", mb: 2499.9, family: "asr", kind: "base" },
  { key: "asr01-onnx", label: "Audio8-ASR-0.1B-onnx-runtime", mb: 2868.3, family: "asr", kind: "deploy" },
  { key: "gpav15-base", label: "GPA-v1.5 (base)", mb: 4029.0, family: "unified", kind: "base" },
  { key: "gpa-base", label: "GPA (base + bundled ONNX)", mb: 6574.2, family: "unified", kind: "base" },
  { key: "gpav15-onnx", label: "GPA-v1.5-onnx-runtime (hosted by Edge0, not Audio8)", mb: 6898.1, family: "unified", kind: "external" },
  { key: "ark3b-base", label: "ARK-ASR-3B (base)", mb: 7766.9, family: "asr", kind: "base" },
]

const ASR = "oklch(0.60 0.15 255)"
const TTS = "oklch(0.55 0.16 155)"
const UNIFIED = "oklch(0.68 0.13 85)"
const REF = "oklch(0.58 0.19 27)"

const FAMILY_COLOR: Record<Family, string> = { asr: ASR, tts: TTS, unified: UNIFIED }
const FAMILY_GLOW: Record<Family, string> = {
  asr: "oklch(0.60 0.15 255 / 0.18)",
  tts: "oklch(0.55 0.16 155 / 0.18)",
  unified: "oklch(0.68 0.13 85 / 0.18)",
}

const DOMAIN_MIN_MB = 128 // 2^7
const DOMAIN_MAX_MB = 8192 // 2^13
const LOG_MIN = mlog2(DOMAIN_MIN_MB)
const LOG_MAX = mlog2(DOMAIN_MAX_MB)
const LOG_SPAN = LOG_MAX - LOG_MIN

const xPct = (mb: number) => {
  const clamped = Math.min(DOMAIN_MAX_MB, Math.max(DOMAIN_MIN_MB, mb))
  return ((mlog2(clamped) - LOG_MIN) / LOG_SPAN) * 100
}

const PHONE_MB = 224
const LAPTOP_MB = 1229

const GRIDLINES = [128, 256, 512, 1024, 2048, 4096, 8192]

type Filter = "all" | "base" | "deploy"

export function SizeVsDeviceFit() {
  const [filter, setFilter] = useState<Filter>("all")
  const [hovered, setHovered] = useState<string | null>(null)

  const visible = ITEMS.filter((i) => {
    if (filter === "all") return true
    if (filter === "base") return i.kind === "base"
    return i.kind !== "base"
  })

  const active = ITEMS.find((i) => i.key === hovered)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          package size (log₂ scale) vs. Audio8&rsquo;s own measured device budgets
        </span>
        <div className="flex gap-1.5">
          {(
            [
              ["all", "all 13"],
              ["base", "base only"],
              ["deploy", "deployment variants"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                filter === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="relative h-5 border-b border-border/60">
              {GRIDLINES.map((g) => {
                const pct = xPct(g)
                // Center every inner tick label, but keep the two edge ticks
                // fully inside the box instead of centering them half off it.
                const anchorClass = pct <= 0.5 ? "left-0" : pct >= 99.5 ? "right-0" : "left-1/2 -translate-x-1/2"
                return (
                  <div key={g} className="absolute top-0 h-full border-l border-border/40" style={{ left: `${pct}%` }}>
                    <span
                      className={cn(
                        "absolute top-0 whitespace-nowrap font-mono text-[9px] text-muted-foreground",
                        anchorClass,
                      )}
                    >
                      {g >= 1024 ? `${g / 1024}G` : `${g}M`}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="relative mt-1" style={{ height: `${visible.length * 26 + 8}px` }}>
              {/* reference lines: real measured device RAM, not package size */}
              <div
                className="absolute top-0 bottom-0 w-px border-l border-dashed"
                style={{ left: `${xPct(PHONE_MB)}%`, borderColor: REF, opacity: 0.55 }}
              />
              <div
                className="absolute top-0 bottom-0 w-px border-l border-dashed"
                style={{ left: `${xPct(LAPTOP_MB)}%`, borderColor: REF, opacity: 0.55 }}
              />

              {visible.map((item, i) => {
                const isHovered = hovered === item.key
                const pct = xPct(item.mb)
                const flip = pct > 58 // past this, grow the label leftward so it can't run off the right edge
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setHovered(item.key)}
                    onFocus={() => setHovered(item.key)}
                    onClick={() => setHovered(item.key)}
                    className="absolute flex cursor-pointer items-center gap-1.5"
                    style={{ top: `${i * 26}px`, left: 0, right: 0, height: "22px" }}
                  >
                    <div
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border"
                      style={{
                        left: `calc(${pct}% - 5px)`,
                        background: item.kind === "external" ? "transparent" : FAMILY_COLOR[item.family],
                        borderColor: FAMILY_COLOR[item.family],
                        borderWidth: item.kind === "external" ? 1.5 : 1,
                        opacity: isHovered ? 1 : 0.85,
                        boxShadow: isHovered ? `0 0 0 4px ${FAMILY_GLOW[item.family]}` : undefined,
                      }}
                    />
                    <span
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[9.5px]",
                        isHovered ? "text-foreground" : "text-muted-foreground",
                      )}
                      style={
                        flip
                          ? { right: `calc(${100 - pct}% + 9px)` }
                          : { left: `calc(${pct}% + 9px)` }
                      }
                    >
                      {item.label} · {item.mb >= 1024 ? `${(item.mb / 1024).toFixed(2)} GB` : `${item.mb.toFixed(0)} MB`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[9.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: ASR }} /> ASR
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TTS }} /> TTS
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: UNIFIED }} /> unified
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border" style={{ borderColor: UNIFIED }} /> hosted outside Audio8
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 border-l border-dashed" style={{ borderColor: REF, height: "10px" }} />{" "}
            measured live RAM, not size: 224 MB phone / 1.23 GB laptop
          </span>
        </div>

        {active ? (
          <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2 font-mono text-[11px]" style={{ color: FAMILY_COLOR[active.family] }}>
            {active.label} — {active.mb >= 1024 ? `${(active.mb / 1024).toFixed(2)} GB` : `${active.mb.toFixed(1)} MB`} on disk
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Only three packages in the whole family sit near or under Audio8&rsquo;s own measured phone
          budget — and all three are deployment variants of the smallest checkpoint in each line. Cross
          the laptop line and the field is almost entirely base checkpoints: nothing between{" "}
          <span className="text-foreground">2.5 GB</span> and <span className="text-foreground">7.6 GB</span>{" "}
          has ever been quantized down toward it. ARK-ASR-3B — the most-downloaded model Audio8 ships — sits
          alone at the far right with no smaller sibling of its own to keep it company.
        </p>
      </div>
    </figure>
  )
}
