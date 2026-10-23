"use client"

import { useState } from "react"

// Where Muse Spark Open's parameters live, and which of them one text token
// touches. Every count is a sum over tensor shapes read from the GGUF headers
// of unsloth/Muse-Spark-Open-816B-A42B-GGUF (UD-IQ2_XXS, all six shards, plus
// mmproj-BF16.gguf) with HTTP range requests. The language model holds
// 819,991,575,808 parameters; the encoders 2,045,074,432. Hugging Face's own
// count for Meta's BF16 safetensors is 822,036,529,664, 120,576 fewer.
//
// One routed expert is gate, up and down at 4,096 x 4,096 each: 50,331,648.
// 256 per layer, 8 chosen per token, no shared expert, 62 layers.
// The layer pattern is layer_types / sliding_window_pattern: every fourth
// layer starting at layer 1 is global and has RoPE theta 0 (no positional
// encoding); the other 46 slide over 2,048 tokens with theta 500,000.

const EXPERT = 50_331_648
const LAYERS = 62
const EXPERTS = 256

const FIXED = [
  { id: "attn", label: "attention q k v o + output gate", n: 13_522_436_096, color: "#0ea5e9" },
  { id: "lat", label: "latent down 8,192 to 4,096 and back", n: 4_160_749_568, color: "#38bdf8" },
  { id: "router", label: "routers (F32)", n: 130_023_424, color: "#64748b" },
  { id: "small", label: "norms, residual gates, router biases", n: 4_095_232, color: "#94a3b8" },
]
const EMBED = 1_655_177_216
const HEAD = 1_655_177_216
const ENCODERS = [
  { id: "vis", label: "vision encoder, 50 layers", n: 1_851_736_576, color: "#7c5cff" },
  { id: "aud", label: "audio encoder (convolutional)", n: 101_054_976, color: "#c084fc" },
  { id: "proj", label: "vision and audio projectors", n: 92_282_880, color: "#e9d5ff" },
]

const fmt = (n: number) => n.toLocaleString("en-US")
const b2 = (n: number) => Math.round(n / 10_000_000) / 100

const PATTERN = Array.from({ length: LAYERS }, (_, i) => i % 4 === 1)

export function ParamBudget() {
  const [view, setView] = useState<"stored" | "active">("active")
  const [vocab, setVocab] = useState(false)
  const [layer, setLayer] = useState(1)

  const k = view === "stored" ? EXPERTS : 8
  const routed = LAYERS * k * EXPERT
  const rows = [
    {
      id: "routed",
      label: view === "stored" ? "256 routed experts x 62 layers" : "8 of 256 routed experts x 62 layers",
      n: routed,
      color: "#0866ff",
    },
    ...FIXED,
    ...(vocab
      ? [
          { id: "emb", label: "input embedding 202,048 x 8,192", n: EMBED, color: "#f59e0b" },
          { id: "head", label: "output head 202,048 x 8,192", n: HEAD, color: "#fbbf24" },
        ]
      : []),
    ...(view === "stored" ? ENCODERS : []),
  ]
  const total = rows.reduce((a, r) => a + r.n, 0)
  const isGlobal = PATTERN[layer]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Muse Spark Open, counted from tensor shapes</span>
        <span className="font-mono text-[10px] text-muted-foreground">7 GGUF headers, range-read</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2">
            show:
            {(["active", "stored"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded border px-2 py-0.5 ${view === v ? "bg-foreground text-background" : ""}`}
              >
                {v === "active" ? "one text token" : "the whole checkpoint"}
              </button>
            ))}
          </span>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vocab} onChange={(e) => setVocab(e.target.checked)} />
            <span>count the two vocabulary tables</span>
          </label>
        </div>

        <div>
          <div className="flex h-8 w-full overflow-hidden rounded-md border" aria-hidden>
            {rows.map((p) => (
              <div key={p.id} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} title={p.label} />
            ))}
          </div>
          <div className="mt-2 grid gap-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
            {rows.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
                  {p.label}
                </span>
                <span className="text-foreground">{fmt(p.n)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">{view === "active" ? "active per text token" : "stored"}</div>
            <div className="text-lg text-foreground">{b2(total)}B</div>
            <div className="text-[10px] text-muted-foreground">{fmt(total)}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">Meta&apos;s headline</div>
            <div className="text-lg text-foreground">{view === "active" ? "42B" : "816B"}</div>
            <div className="text-[10px] text-muted-foreground">
              {vocab || view === "stored"
                ? "matches only without the vocabulary tables and encoders"
                : "matches: the count without the vocabulary tables"}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background/60 p-3">
          <div className="mb-2 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <span>62 layers: tap one</span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#f59e0b]" /> global, no RoPE
              <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-[#94a3b8]" /> sliding 2,048
            </span>
          </div>
          <div className="grid grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
            {PATTERN.map((g, i) => (
              <button
                key={i}
                type="button"
                aria-label={`layer ${i}, ${g ? "global" : "sliding"}`}
                onClick={() => setLayer(i)}
                className={`h-5 rounded-[2px] ${i === layer ? "ring-2 ring-foreground" : ""}`}
                style={{ background: g ? "#f59e0b" : "#94a3b8" }}
              />
            ))}
          </div>
          <div className="mt-2 font-mono text-[11px] text-foreground">
            layer {layer}:{" "}
            {isGlobal
              ? "global attention over every cached token, RoPE theta 0 (no positional encoding). Its cache grows with the context."
              : "sliding-window attention over the last 2,048 tokens, RoPE theta 500,000. Its cache stops growing at 2,048 tokens."}
          </div>
        </div>
      </div>
    </figure>
  )
}
