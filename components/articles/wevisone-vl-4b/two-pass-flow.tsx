"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

type Step = {
  id: string
  pass: "1" | "2" | "-"
  title: string
  what: string
  where: string
  cost: string
}

const STEPS: Step[] = [
  {
    id: "gen",
    pass: "1",
    title: "Generate the structured answer",
    what: "The image goes through the ViT and the LLM, which writes <ref>name</ref><box> then four coordinate tokens and an <OBJ> token per instance. Greedy by default in the card's example.",
    where: "engine.py generate_text; max_new_tokens 4096",
    cost: "ViT + prefill + one decode step per token",
  },
  {
    id: "parse",
    pass: "-",
    title: "Parse the boxes from the text",
    what: "A regular expression keeps only boxes that end in <OBJ> and whose four numbers are in 0..1000 with x2 > x1 and y2 > y1. Anything else is dropped.",
    where: "engine.py parse_seg_boxes",
    cost: "none",
  },
  {
    id: "teacher",
    pass: "2",
    title: "Re-run the whole model on the finished answer",
    what: "The prompt, the image and the generated answer are fed back through the model with no KV cache. The engine captures the last hidden state at each <OBJ> position and the pre-merge ViT features from layers 5, 11, 17 and 23.",
    where: "engine.py decode_masks (teacher-forced)",
    cost: "ViT again + a full forward over image + prompt + answer",
  },
  {
    id: "decode",
    pass: "2",
    title: "Run the 9.6M pixel decoder per instance",
    what: "Each <OBJ> hidden state plus its box becomes a query; six deformable blocks read the ViT features; a three-stage cascade writes a 1,024 x 1,024 map. Instances go through in batches of 16.",
    where: "mask_decoder.py WeVisOneMaskDecoder; decoder_batch_size 16",
    cost: "about 287.5 GFLOPs per instance (reasoned from shapes)",
  },
  {
    id: "resize",
    pass: "-",
    title: "Resize to the photo",
    what: "The sigmoid of the logits is resized bilinearly from the decoder canvas to the original height and width.",
    where: "engine.py _masks_from_logits",
    cost: "negligible",
  },
]

export function TwoPassFlow() {
  const [open, setOpen] = useState<string>("teacher")
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        how an &lt;OBJ&gt; token becomes a mask · read from engine.py and mask_decoder.py in the released repository
      </div>
      <ol className="px-4 py-3">
        {STEPS.map((s, i) => {
          const active = open === s.id
          return (
            <li key={s.id} className="relative pb-2 pl-8">
              <span
                className={cn(
                  "absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px]",
                  s.pass === "2" ? "border-transparent text-black" : "text-muted-foreground"
                )}
                style={s.pass === "2" ? { background: "oklch(0.78 0.12 305)" } : s.pass === "1" ? { background: "oklch(0.8 0.1 250)", color: "black" } : undefined}
                aria-hidden
              >
                {i + 1}
              </span>
              {i < STEPS.length - 1 && <span className="absolute bottom-0 left-2.5 top-6 w-px bg-border" aria-hidden />}
              <button
                type="button"
                onClick={() => setOpen(s.id)}
                aria-expanded={active}
                className="flex w-full items-baseline gap-2 text-left font-mono text-[12px]"
              >
                <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>{s.title}</span>
                {s.pass !== "-" && <span className="ml-auto text-[10px] text-muted-foreground">pass {s.pass}</span>}
              </button>
              {active && (
                <div className="mt-1 space-y-1 text-[12px] leading-relaxed">
                  <p>{s.what}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {s.where} · cost: {s.cost}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Two passes is how this release is wired, not a property of the method: the paper describes the decoder as reading the hidden state of each
        generated token, and a decoder could read it during generation. Tap a step for the detail.
      </p>
    </figure>
  )
}
