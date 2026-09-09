"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the released code actually does, drawn as a tap diagram rather than the
// paper's own box-and-arrow figure. Three claims this makes precise, each
// checked against src/qwen_drive/{modeling_qwen_drive,planning_expert}.py and
// src/qwen_drive_perception/modeling_perception.py:
//
//  - The backbone is loaded as `AutoModelForImageTextToText.from_config(...)`,
//    the stock Qwen3.5-4B class. Nothing is inserted into its 32 decoder layers
//    (8 repeats of 1 grouped-query-attention layer + 3 linear-attention layers).
//  - The Planning Expert reads the *post-RoPE key/value cache* of exactly the
//    8 GQA layers -- a tap on attention already computed, not a hook that
//    changes what the backbone computes.
//  - The BEV Perception Head reads two *different* taps: the vision encoder's
//    pre-merge patch grid (via a forward hook on the patch merger) and the
//    language model's final post-norm hidden state. Neither pass touches the
//    other's forward call.
//
// Toggling the mode shows which taps are live for that call and totals the
// parameters actually resident for it -- which is never the Hub's flat "4.54B"
// once a head is attached.

const BACKBONE = "oklch(0.60 0.15 255)"
const PLANNER = "oklch(0.66 0.14 165)"
const PERCEPTION = "oklch(0.64 0.17 330)"
const MUTED_STROKE = "var(--border)"

type Mode = "vqa" | "planning" | "perception"

const MODE_COPY: Record<Mode, { label: string; active: string; params: string; detail: string }> = {
  vqa: {
    label: "VQA",
    active: "backbone only",
    params: "4.54B",
    detail: "Text out through the unmodified decoder. No head is loaded -- this is exactly the Qwen3.5-4B forward pass.",
  },
  planning: {
    label: "planning",
    active: "backbone + Planning Expert",
    params: "5.58B",
    detail: "The expert reads the 8 GQA caches by cross-attention. Add the RL variant instead of SFT and the count is identical -- same architecture, different weights.",
  },
  perception: {
    label: "perception",
    active: "backbone + BEV head",
    params: "4.79B",
    detail: "The head reads two taps at once: pre-merge ViT patches (via a hook) and the final post-norm hidden state. Both passes leave the backbone's own forward call untouched.",
  },
}

function Arrow({
  d,
  color,
  active,
  dashed,
  id,
}: {
  d: string
  color: string
  active: boolean
  dashed?: boolean
  id: string
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={active ? color : MUTED_STROKE}
      strokeWidth={active ? 1.8 : 1.3}
      strokeDasharray={dashed ? "4 3" : undefined}
      markerEnd={`url(#qd-arrow-${id})`}
      opacity={active ? 0.95 : 0.35}
      className="transition-all duration-300"
    />
  )
}

export function ThreeHeadedArchitecture() {
  const [mode, setMode] = useState<Mode>("planning")
  const copy = MODE_COPY[mode]

  const W = 860
  const H = 460

  // backbone box (vision encoder sits under its left half)
  const veX = 40, veY = 372, veW = 160, veH = 46
  const lmX = 40, lmY = 250, lmW = 560, lmH = 78
  const decX = lmX + lmW + 60, decY = lmY - 6, decW = 150, decH = 46
  const planX = lmX + lmW + 60, planY = lmY + 40, planW = 150, planH = 70
  const bevX = 300, bevY = 40, bevW = 220, bevH = 60

  // 8 GQA tap ticks along the top of the LM box (one per repeated block)
  const ticks = Array.from({ length: 8 }, (_, i) => lmX + lmW * ((i + 0.5) / 8))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Qwen-Drive-1.0 &middot; what&rsquo;s live for one call</span>
        <span className="text-muted-foreground/50">from the released code, not the paper&rsquo;s figure</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Diagram of Qwen-Drive-1.0 in ${copy.label} mode: ${copy.detail}`}>
          <defs>
            {[
              ["backbone", BACKBONE],
              ["planner", PLANNER],
              ["perception", PERCEPTION],
              ["muted", MUTED_STROKE],
            ].map(([id, color]) => (
              <marker key={id} id={`qd-arrow-${id}`} viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={color} strokeWidth={1.5} />
              </marker>
            ))}
            <filter id="qd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* vision encoder */}
          <rect x={veX} y={veY} width={veW} height={veH} rx={8} fill="var(--background)" stroke={BACKBONE} strokeWidth={1.5} filter="url(#qd-soft)" />
          <text x={veX + veW / 2} y={veY + veH / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            vision encoder
          </text>

          {/* language model, with 8 GQA tick marks */}
          <rect x={lmX} y={lmY} width={lmW} height={lmH} rx={10} fill="var(--background)" stroke={BACKBONE} strokeWidth={1.5} filter="url(#qd-soft)" />
          <text x={lmX + 16} y={lmY + 24} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            Qwen3.5-4B language model
          </text>
          <text x={lmX + 16} y={lmY + 40} className="fill-muted-foreground font-mono" fontSize={9}>
            8 &times; (1 full-attn layer + 3 linear-attn layers) &middot; unmodified
          </text>
          {ticks.map((tx, i) => (
            <g key={i}>
              <rect
                x={tx - 3}
                y={lmY - 8}
                width={6}
                height={8}
                rx={1.5}
                fill={mode === "planning" ? PLANNER : "var(--muted-foreground)"}
                opacity={mode === "planning" ? 0.95 : 0.4}
                className="transition-all duration-300"
              />
            </g>
          ))}
          <text x={lmX + lmW - 6} y={lmY + lmH - 10} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>
            ticks = the 8 cached GQA layers
          </text>

          {/* decoder (VQA output) */}
          <rect x={decX} y={decY} width={decW} height={decH} rx={8} fill="var(--background)" stroke={mode === "vqa" ? BACKBONE : MUTED_STROKE} strokeWidth={1.5} opacity={mode === "vqa" ? 1 : 0.6} filter="url(#qd-soft)" />
          <text x={decX + decW / 2} y={decY + decH / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            text out (VQA)
          </text>

          {/* Planning Expert */}
          <rect x={planX} y={planY} width={planW} height={planH} rx={10} fill="var(--background)" stroke={mode === "planning" ? PLANNER : MUTED_STROKE} strokeWidth={1.5} opacity={mode === "planning" ? 1 : 0.55} filter="url(#qd-soft)" />
          <text x={planX + planW / 2} y={planY + 24} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            Planning
          </text>
          <text x={planX + planW / 2} y={planY + 40} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            Expert
          </text>
          <text x={planX + planW / 2} y={planY + 58} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
            32 layers &middot; 1.04B
          </text>

          {/* BEV Perception Head */}
          <rect x={bevX} y={bevY} width={bevW} height={bevH} rx={10} fill="var(--background)" stroke={mode === "perception" ? PERCEPTION : MUTED_STROKE} strokeWidth={1.5} opacity={mode === "perception" ? 1 : 0.55} filter="url(#qd-soft)" />
          <text x={bevX + bevW / 2} y={bevY + 24} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            BEV Perception Head
          </text>
          <text x={bevX + bevW / 2} y={bevY + 42} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
            det + occupancy + map &middot; 0.25B
          </text>

          {/* --- arrows --- */}
          {/* vision encoder -> language model */}
          <Arrow id="backbone" active color={BACKBONE} d={`M ${veX + veW / 2} ${veY} C ${veX + veW / 2} ${lmY + lmH + 30}, ${lmX + 60} ${lmY + lmH + 30}, ${lmX + 60} ${lmY + lmH}`} />
          {/* vision encoder -> BEV head (raw ViT patch tap, before the merger) */}
          <Arrow id="perception" active={mode === "perception"} color={PERCEPTION} dashed d={`M ${veX + veW - 10} ${veY} C ${veX + 220} ${230}, ${bevX + 30} ${bevY + bevH + 40}, ${bevX + 30} ${bevY + bevH}`} />
          {/* language model final hidden state -> decoder */}
          <Arrow id="backbone" active={mode === "vqa"} color={BACKBONE} d={`M ${lmX + lmW} ${lmY + 20} C ${lmX + lmW + 30} ${lmY + 20}, ${decX - 20} ${decY + decH / 2}, ${decX} ${decY + decH / 2}`} />
          {/* language model final hidden state -> BEV head */}
          <Arrow id="perception" active={mode === "perception"} color={PERCEPTION} dashed d={`M ${lmX + lmW - 40} ${lmY} C ${lmX + lmW - 40} ${140}, ${bevX + bevW - 30} ${bevY + bevH + 40}, ${bevX + bevW - 30} ${bevY + bevH}`} />
          {/* 8 GQA taps -> Planning Expert */}
          <Arrow id="planner" active={mode === "planning"} color={PLANNER} d={`M ${lmX + lmW - 30} ${lmY + 20} C ${lmX + lmW + 30} ${lmY + 20}, ${planX - 20} ${planY + 20}, ${planX} ${planY + 20}`} />
          <Arrow id="planner" active={mode === "planning"} color={PLANNER} d={`M ${lmX + lmW - 30} ${lmY + 55} C ${lmX + lmW + 30} ${lmY + 55}, ${planX - 20} ${planY + 55}, ${planX} ${planY + 55}`} />
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">mode</span>
            {(["vqa", "planning", "perception"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {MODE_COPY[m].label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            resident params <span className="text-foreground tabular-nums">{copy.params}</span>{" "}
            <span className="text-muted-foreground/60">({copy.active})</span>
          </div>
        </div>

        <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-muted-foreground">{copy.detail}</p>
      </div>
    </figure>
  )
}
