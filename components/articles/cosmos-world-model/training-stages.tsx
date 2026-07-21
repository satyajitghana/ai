"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Cosmos 3 trains its two towers on two tracks. The Reasoner is initialized from
// Qwen3-VL (Edge trains from scratch), pre-trained on multimodal understanding,
// then SFT'd — including the Action-CoT data. The Generator is a flow-matching
// diffusion tower: pre-trained on image/video/audio, jointly mid-trained with the
// reasoner, then post-trained per task (Text-to-Image, Image-to-Video, Robot
// Policy), with best-of-N sampling against the WMReward reward model. Click a
// stage to unpack it.

const AR = "oklch(0.66 0.16 150)" // green — Reasoner
const DM = "oklch(0.7 0.15 55)" // amber — Generator

const TRACKS = [
  {
    name: "Reasoner",
    color: AR,
    stages: [
      { key: "r-init", label: "VLM init", detail: "Nano and Super are initialized from Qwen3-VL-8B and -32B; the Edge variant trains a 2B dense transformer from scratch (ReLU²  FFN, no QK-norm)." },
      { key: "r-pt", label: "pre-training", detail: "Multimodal pre-training aligns the reasoner tower over language and vision-understanding data, extending the VLM into the shared MoT sequence." },
      { key: "r-sft", label: "SFT", detail: "Supervised fine-tuning on curated instruction, dense-caption, and reasoning data — including the Action-CoT motion-plan traces that let the model plan in image space." },
    ],
  },
  {
    name: "Generator",
    color: DM,
    stages: [
      { key: "g-pt", label: "pre-training", detail: "Flow-matching pre-training of the diffusion tower on large image / video / audio corpora: the denoiser predicts the constant velocity v* = ε − x₀ via a masked MSE objective." },
      { key: "g-mid", label: "mid-training", detail: "Joint mid-training couples the towers, mixing action and transfer tasks at set data ratios so the generator learns to read the reasoner's keys." },
      { key: "g-post", label: "post-training", detail: "Task-specific post-training — Text-to-Image, Image-to-Video, and Robot Policy — with best-of-N sampling scored by the WMReward reward model." },
    ],
  },
]

const ALL = TRACKS.flatMap((t) => t.stages)

export function TrainingStages() {
  const [k, setK] = useState("g-post")
  const active = ALL.find((s) => s.key === k) ?? ALL[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        two towers, two training tracks · fused in mid-training
      </div>
      <div className="p-3 sm:p-4">
        <div className="space-y-2.5">
          {TRACKS.map((track) => (
            <div key={track.name} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 font-mono text-[11px]" style={{ color: track.color }}>
                {track.name}
              </span>
              {track.stages.map((s, i) => {
                const on = s.key === k
                return (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setK(s.key)}
                      aria-pressed={on}
                      className={cn(
                        "cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                        on ? "text-background" : "border-border bg-muted/10 text-muted-foreground hover:text-foreground",
                      )}
                      style={on ? { background: track.color, borderColor: "transparent" } : undefined}
                    >
                      {s.label}
                    </button>
                    {i < track.stages.length - 1 ? (
                      <span className="font-mono text-muted-foreground/40">→</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* detail panel */}
        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm leading-6 text-muted-foreground">{active.detail}</p>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The two tracks aren't independent: <span className="text-foreground">mid-training</span> is
          where the diffusion Generator learns to attend over the Reasoner's keys, so by the time
          post-training specializes the model into six task heads, the plan-to-pixels pathway is
          already in place.
        </p>
      </div>
    </figure>
  )
}
