"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One network, no second tower. Shapes from facebook/meta-encoder-v1's config.json
// and safetensors headers (read by HTTP range request):
//   patch_embedding [1536, 1176]   1176 = 3 colours x 2 frames x 14 x 14 pixels
//   vision tower: 50 layers, width 1536 (window attention, a full layer every 4th)
//   2x2 merge -> 6144 -> vision_adapter fc1 [4096, 6144], fc2 [4096, 4096]
//   vision_projection [6656, 4096] -> decoder width 6656
//   decoder: 52 layers, 3 sliding (window 2048) : 1 global, 32 query heads, 2 KV heads
//   embedding_head [6656, 6656], then L2 normalise
// Image token count: README says native resolution "snapped to a 28-pixel grid, up to
// 4096 merged tokens" (14 px patch x 2x2 merge). The snapping below is the usual
// round-to-grid then shrink-to-budget rule; I did not read the processor's own code,
// so treat counts as approximate. Video: the wrapper samples at most 8 frames and
// feeds each as an image.

const STAGES: { name: string; shape: string; note: string; side: "vision" | "text" | "both" }[] = [
  { name: "patchify", shape: "14×14 px × 2 frames × 3 → 1,176", note: "the patch embedder is [1536, 1176]: a patch is 2 frames deep in time; the v1 wrapper still feeds video frames as separate images", side: "vision" },
  { name: "vision tower", shape: "50 layers, width 1,536", note: "1.85B parameters; mostly windowed attention, a full-attention layer every fourth", side: "vision" },
  { name: "2×2 merge + adapter", shape: "4 × 1,536 = 6,144 → 4,096 → 6,656", note: "one token per 28×28 pixels lands in the decoder's width", side: "vision" },
  { name: "decoder", shape: "52 layers, width 6,656", note: "Muse Glimmer's causal decoder, unchanged in shape; text and image tokens interleaved", side: "both" },
  { name: "last token", shape: "hidden state at <|eot|>", note: "left padding puts the closing <|eot|> in the last column; nothing is averaged", side: "both" },
  { name: "head + L2", shape: "6,656 × 6,656 → unit vector", note: "44.3M parameters, new in v1; cosine is then a dot product", side: "both" },
]

const PRESETS = [
  { label: "none", w: 0, h: 0 },
  { label: "448 × 448", w: 448, h: 448 },
  { label: "1024 × 768 photo", w: 1024, h: 768 },
  { label: "1920 × 1080 screen", w: 1920, h: 1080 },
  { label: "2480 × 3508 A4 scan", w: 2480, h: 3508 },
]

function tokensFor(w: number, h: number, cap: number) {
  if (!w || !h) return { t: 0, gw: 0, gh: 0 }
  let gw = Math.max(1, Math.round(w / 28))
  let gh = Math.max(1, Math.round(h / 28))
  if (gw * gh > cap) {
    const beta = mpow((w * h) / (cap * 784), 0.5)
    gw = Math.max(1, Math.floor(w / beta / 28))
    gh = Math.max(1, Math.floor(h / beta / 28))
  }
  return { t: gw * gh, gw, gh }
}

export function OneTower() {
  const [stage, setStage] = useState(3)
  const [pi, setPi] = useState(2)
  const [frames, setFrames] = useState(1)
  const [text, setText] = useState(60)

  const pr = PRESETS[pi]
  const per = tokensFor(pr.w, pr.h, 4096)
  const used = Math.min(frames, 8)
  const vis = per.t * (pr.w ? used : 0)
  const total = vis + text + 60 // ~60: system header (an estimate, not counted from the tokenizer)
  const over = total > 16384

  const s = STAGES[stage]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one network, both sides of the dot product</span>
        <span className="font-mono text-[10px] text-muted-foreground">config.json + safetensors headers · v1</span>
      </div>

      <div className="grid gap-1.5 p-3 sm:grid-cols-6 sm:p-4">
        {STAGES.map((st, i) => (
          <button
            key={st.name}
            type="button"
            onClick={() => setStage(i)}
            aria-pressed={stage === i}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-2 text-left font-mono text-[10px] transition-colors",
              stage === i ? "border-foreground/40 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              st.side === "vision" ? "border-dashed" : "",
            )}
          >
            <div className="text-[9px] uppercase tracking-wide opacity-70">{st.side === "vision" ? "pixels only" : "every input"}</div>
            {st.name}
          </button>
        ))}
      </div>
      <div className="px-3 pb-3 font-mono text-[11px] sm:px-4">
        <div className="text-foreground">{s.shape}</div>
        <div className="text-muted-foreground">{s.note}</div>
      </div>

      <div className="space-y-3 border-t p-3 sm:p-4">
        <div className="font-mono text-[11px] text-muted-foreground">what the last token has to read, for one input</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPi(i)}
              aria-pressed={pi === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                pi === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            images or video frames = {frames}
            {frames > 8 ? " (the wrapper keeps 8)" : ""}
            <Range min={1} max={32} step={1} value={frames} onChange={(e) => setFrames(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            text tokens = {text.toLocaleString()}
            <Range min={0} max={8000} step={20} value={text} onChange={(e) => setText(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        </div>
        <div className="font-mono text-[11px]">
          <div className="flex h-4 overflow-hidden rounded-sm bg-muted/40">
            <div style={{ width: `${((vis / Math.max(total, 16384)) * 100).toFixed(2)}%`, background: "oklch(0.62 0.14 150)" }} />
            <div style={{ width: `${(((text + 60) / Math.max(total, 16384)) * 100).toFixed(2)}%`, background: "oklch(0.6 0.15 255)" }} />
          </div>
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-muted-foreground">
            <span>
              {pr.w ? `${per.gw} × ${per.gh} = ${per.t.toLocaleString()} tokens per image × ${used}` : "no image"} · text + header ≈ {(text + 60).toLocaleString()}
            </span>
            <span className={over ? "text-red-500" : "text-foreground"}>
              ≈ {total.toLocaleString()} of 16,384 trained
            </span>
          </div>
          {over && <div className="mt-1 text-red-500">Longer than any training sequence. The wrapper warns and never truncates, since that would cut off the pooled token.</div>}
        </div>
        <p className="text-xs text-muted-foreground">
          Whatever goes in, one 6,656-number vector comes out: 26,624 bytes in float32. Token counts are approximate (round to the
          28-pixel grid, shrink to 4,096); the header estimate is mine.
        </p>
      </div>
    </figure>
  )
}
