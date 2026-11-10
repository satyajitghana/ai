"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The 832 added-token slots (ids 120000-120831) of tencent/Hy4-preview's
// tokenizer.json, as listed by tokenizers 0.23.3's get_added_tokens_decoder().
// 35 have names; the other 797 are "<｜hy_place▁holder▁no▁N｜>" reservations.
// Base BPE vocab: 120,000. config.json vocab_size: 120,832.

type Cat = "control" | "agent" | "ground" | "free"

const NAMED: Record<number, [string, Cat]> = {
  120000: ["<｜hy_start｜> (bos)", "control"],
  120001: ["<｜hy_middle｜>", "control"],
  120002: ["<｜hy_pad｜>", "control"],
  120003: ["<｜hy_fim▁hole｜>", "control"],
  120004: ["<｜hy_fim▁begin｜>", "control"],
  120005: ["<｜hy_fim▁end｜>", "control"],
  120008: ["<｜hy_EOT｜>", "control"],
  120025: ["<｜hy_end｜> (eos)", "control"],
  120029: ["<think>", "agent"],
  120030: ["</think>", "agent"],
  120033: ["<tool_call>", "agent"],
  120034: ["</tool_call>", "agent"],
  120035: ["<tool_calls>", "agent"],
  120036: ["</tool_calls>", "agent"],
  120037: ["<tool_response>", "agent"],
  120038: ["</tool_response>", "agent"],
  120039: ["<｜reasoning_mode｜>", "agent"],
  120040: ["<arg_key>", "agent"],
  120041: ["</arg_key>", "agent"],
  120042: ["<arg_value>", "agent"],
  120043: ["</arg_value>", "agent"],
  120126: ["<box>", "ground"],
  120127: ["</box>", "ground"],
  120128: ["<quad>", "ground"],
  120129: ["</quad>", "ground"],
  120130: ["<ref>", "ground"],
  120131: ["</ref>", "ground"],
  120132: ["<pFig>", "ground"],
  120133: ["</pFig>", "ground"],
  120134: ["<det>", "ground"],
  120135: ["</det>", "ground"],
  120136: ["<point>", "ground"],
  120137: ["</point>", "ground"],
  120138: ["<mask>", "ground"],
  120139: ["</mask>", "ground"],
}

const COLOR: Record<Cat, string> = {
  control: "oklch(0.62 0.03 260)",
  agent: "oklch(0.62 0.14 250)",
  ground: "oklch(0.68 0.16 45)",
  free: "oklch(0.75 0 0 / 0.25)",
}
const LABEL: Record<Cat, string> = {
  control: "control (8)",
  agent: "reasoning + tool calls (13)",
  ground: "visual grounding (14)",
  free: "placeholder (797)",
}

const BASE = 120000
const COUNT = 832
const COLS = 32

export function VocabSlotMap() {
  const [hover, setHover] = useState<number | null>(120136)
  const [focus, setFocus] = useState<Cat | null>(null)

  const info = hover === null ? null : NAMED[hover]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="mr-auto font-mono text-xs text-muted-foreground">Hy4 preview tokenizer: ids 120000&ndash;120831</span>
        {(Object.keys(LABEL) as Cat[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFocus(focus === c ? null : c)}
            aria-pressed={focus === c}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              focus === c ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[c] }} />
            {LABEL[c]}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        <div
          role="img"
          aria-label="832 added-token slots: 8 control, 13 reasoning and tool-call, 14 visual-grounding, 797 unnamed placeholders"
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: COUNT }, (_, i) => {
            const id = BASE + i
            const cat: Cat = NAMED[id]?.[1] ?? "free"
            const dim = focus !== null && focus !== cat
            return (
              <div
                key={id}
                title={`${id}${NAMED[id] ? ` ${NAMED[id][0]}` : " placeholder"}`}
                onMouseEnter={() => setHover(id)}
                className={cn("aspect-square rounded-[2px]", hover === id && "ring-1 ring-foreground")}
                style={{ background: COLOR[cat], opacity: dim ? 0.15 : 1 }}
              />
            )
          })}
        </div>
        <p className="mt-3 min-h-[1.5rem] font-mono text-[11px] text-foreground">
          {hover === null
            ? "hover a cell"
            : info
              ? `${hover}  ${info[0]}`
              : `${hover}  <｜hy_place▁holder▁no▁…｜> (reserved, unnamed)`}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The text-only preview already shipped fourteen grounding tokens: boxes, quadrilaterals,
          referring expressions, points, detections, masks and a figure tag. A coordinate is plain text
          between them: <code>&lt;point&gt;(512,384)&lt;/point&gt;</code> encodes to 7 ids. There is no
          image-input token, and the string <code>&lt;image&gt;</code> splits into three ordinary pieces.
          797 slots remain free for whatever the vision release needs.
        </p>
      </div>
    </figure>
  )
}
