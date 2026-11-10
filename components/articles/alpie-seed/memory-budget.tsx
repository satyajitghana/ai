"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Memory for one Alpie Seed session, built from counted parameters and real file sizes.
//  MEASURED (safetensors header, range request): language model incl. embeddings and head 8,953,803,264 params;
//    vision tower 456,010,480. GGUF file sizes from the Hugging Face tree; the F16 mmproj is 921,704,384 bytes.
//  REASONED from config.json: only 8 of 32 layers keep a KV cache (full_attention_interval 4), each with
//    4 KV heads x 256 dims, so K+V at 16 bits is 8 x 2 x 4 x 256 x 2 = 32,768 bytes a token.
//    The 24 Gated DeltaNet layers keep a fixed state instead: 24 x 32 heads x 128 x 128 x 4 bytes (f32)
//    = 50,331,648 B, plus a small convolution window, about 53 MB whatever the context.
//  Q8_0 is 8.5 bits a weight by construction (34-byte blocks of 32); it is not one of 169Pi's files.
const LM = 8_953_803_264
const GB = 1e9
const FORMATS = [
  { id: "bf16", label: "BF16 (released)", bytes: LM * 2, vision: 456_010_480 * 2, note: "the safetensors file is 18.82 GB with the vision tower" },
  { id: "q8", label: "Q8_0 (not shipped)", bytes: (LM * 8.5) / 8, vision: 921_704_384, note: "8.5 bits a weight; 169Pi ships no 8-bit file" },
  { id: "q4", label: "Q4_K_M", bytes: 5_629_109_184, vision: 921_704_384, note: "file size, 5.03 bits a weight" },
  { id: "q3", label: "Q3_K_M", bytes: 4_623_517_376, vision: 921_704_384, note: "file size, 4.13 bits a weight" },
  { id: "q2", label: "Q2_K", bytes: 3_827_273_728, vision: 921_704_384, note: "file size, 3.42 bits a weight" },
] as const
const KV_TOKEN = 32_768
const STATE = 52_690_944 // 50,331,648 recurrent + 24 x 3 x 8,192 x 4 conv window (reasoned)
const DEVICES = [
  { label: "8 GB phone", gb: 8 },
  { label: "12 GB phone", gb: 12 },
  { label: "16 GB laptop", gb: 16 },
  { label: "24 GB GPU", gb: 24 },
]

const C_W = "oklch(0.62 0.13 230)"
const C_V = "oklch(0.70 0.12 190)"
const C_KV = "oklch(0.63 0.17 35)"
const C_S = "oklch(0.60 0.10 300)"

export function MemoryBudget() {
  const [fmt, setFmt] = useState<(typeof FORMATS)[number]["id"]>("q4")
  const [vision, setVision] = useState(false)
  const [logCtx, setLogCtx] = useState(15) // 2^15 = 32,768
  const [kv8, setKv8] = useState(false)
  const [dense, setDense] = useState(false)

  const f = FORMATS.find((x) => x.id === fmt) ?? FORMATS[2]
  const ctx = Math.round(mpow(2, logCtx))
  const perTok = (dense ? KV_TOKEN * 4 : KV_TOKEN) * (kv8 ? 34 / 64 : 1)
  const w = f.bytes / GB
  const v = vision ? f.vision / GB : 0
  const kv = (perTok * ctx) / GB
  const st = dense ? 0 : STATE / GB
  const total = w + v + kv + st
  const scale = Math.max(26, total * 1.05)
  const parts = [
    { k: "weights", gb: w, c: C_W },
    { k: "vision", gb: v, c: C_V },
    { k: "KV cache", gb: kv, c: C_KV },
    { k: "DeltaNet state", gb: st, c: C_S },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        memory for one session · parameters counted from the header, files sized from the repo, cache reasoned from config.json
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {FORMATS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setFmt(x.id)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              fmt === x.id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="relative h-8 w-full overflow-hidden rounded bg-muted" role="img" aria-label={`About ${total.toFixed(1)} GB in total`}>
          <div className="flex h-full">
            {parts.map((p) =>
              p.gb > 0 ? (
                <div key={p.k} title={`${p.k}: ${p.gb.toFixed(2)} GB`} style={{ width: `${((p.gb / scale) * 100).toFixed(2)}%`, background: p.c }} />
              ) : null
            )}
          </div>
          {DEVICES.map((d) =>
            d.gb < scale ? (
              <div key={d.label} className="absolute top-0 h-full border-l border-dashed border-foreground/60" style={{ left: `${((d.gb / scale) * 100).toFixed(2)}%` }} />
            ) : null
          )}
        </div>
        <div className="relative h-4 font-mono text-[10px] text-muted-foreground">
          {DEVICES.map((d) =>
            d.gb < scale ? (
              <span key={d.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((d.gb / scale) * 100).toFixed(2)}%` }}>
                {d.gb}
              </span>
            ) : null
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs sm:grid-cols-4">
          {parts.map((p) => (
            <div key={p.k}>
              <div className="text-muted-foreground">
                <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: p.c }} />
                {p.k}
              </div>
              <div className="text-lg tabular-nums">{p.gb < 0.1 && p.gb > 0 ? `${(p.gb * 1000).toFixed(0)} MB` : `${p.gb.toFixed(2)} GB`}</div>
            </div>
          ))}
        </div>
        <div className="font-mono text-xs">
          total <span className="text-lg tabular-nums">{total.toFixed(2)} GB</span>
          <span className="ml-2 text-muted-foreground">
            {f.note}; runtime buffers and the OS are extra (dashed lines: 8, 12, 16, 24 GB)
          </span>
        </div>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">context</span>
          <Range min={10} max={18} step={0.25} value={logCtx} onChange={(e) => setLogCtx(Number(e.target.value))} aria-label="context length" className="w-full" accent={C_KV} />
          <span className="w-28 shrink-0 text-right font-mono tabular-nums">{ctx.toLocaleString("en-US")} tok</span>
        </label>
        <div className="flex flex-wrap gap-4 font-mono text-[11px]">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /> vision tower / mmproj
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={kv8} onChange={(e) => setKv8(e.target.checked)} /> 8-bit KV cache
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={dense} onChange={(e) => setDense(e.target.checked)} /> what if all 32 layers kept a KV cache
          </label>
          <button type="button" className="rounded border px-2 py-0.5 text-muted-foreground hover:bg-muted" onClick={() => setLogCtx(18)}>
            Ollama default num_ctx 262,144
          </button>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          KV a token: {perTok.toLocaleString("en-US")} bytes ({dense ? "hypothetical 32 attention layers" : "8 attention layers x K and V x 4 heads x 256"}
          {kv8 ? ", 8-bit" : ", 16-bit"})
        </div>
      </div>
    </figure>
  )
}
