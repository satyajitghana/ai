"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What a pplx-embed-v2-late index costs against a single-vector one.
//
// Vector counts come from the shipped configs. An image is resized by
// Qwen2-VL's smart_resize (transformers, image_processing_qwen2_vl.py) with
// factor = patch_size 16 x merge_size 2 = 32 and max_pixels 1,800,964 from
// processor_config.json, and yields one vector per 32 x 32 block. A text
// document yields one vector per token up to document_length 4,096
// (sentence_bert_config.json), less bare punctuation (2_MultiVectorMask). The
// few marker tokens around an image are ignored here. Both model sizes share
// the tokenizer, the image processor and the 128-wide output, so this is the
// same for the 0.6B and the 9B.
//
// The 2-bit and 1-bit rows are ColBERTv2's residual compression (a 4-byte
// centroid id plus 2 or 1 bits per dimension: 36 and 20 bytes at 128 dims).
// Perplexity ships no compression and reports no results with it, so those
// rows are storage arithmetic, not a quality claim.
//
// Arithmetic is +, -, *, /, sqrt, floor, round and toFixed only.

const FACTOR = 32
const MAX_PIXELS = 1800964
const MIN_PIXELS = 3136
const DIM = 128

function smartResize(h: number, w: number) {
  let hb = Math.round(h / FACTOR) * FACTOR
  let wb = Math.round(w / FACTOR) * FACTOR
  if (hb * wb > MAX_PIXELS) {
    const beta = Math.sqrt((h * w) / MAX_PIXELS)
    hb = Math.max(FACTOR, Math.floor(h / beta / FACTOR) * FACTOR)
    wb = Math.max(FACTOR, Math.floor(w / beta / FACTOR) * FACTOR)
  } else if (hb * wb < MIN_PIXELS) {
    const beta = Math.sqrt(MIN_PIXELS / (h * w))
    hb = Math.ceil((h * beta) / FACTOR) * FACTOR
    wb = Math.ceil((w * beta) / FACTOR) * FACTOR
  }
  return { hb, wb, n: (hb * wb) / (FACTOR * FACTOR) }
}

type Doc = { label: string; kind: "image"; w: number; h: number } | { label: string; kind: "text"; tokens: number }

const DOCS: Doc[] = [
  { label: "Letter page, 72 dpi", kind: "image", w: 612, h: 792 },
  { label: "Letter page, 100 dpi", kind: "image", w: 850, h: 1100 },
  { label: "Letter page, 150 dpi", kind: "image", w: 1275, h: 1650 },
  { label: "1080p screenshot", kind: "image", w: 1920, h: 1080 },
  { label: "12 MP photo", kind: "image", w: 4032, h: 3024 },
  { label: "Text, 256 tokens", kind: "text", tokens: 256 },
  { label: "Text, 512 tokens", kind: "text", tokens: 512 },
  { label: "Text, 4,096 tokens", kind: "text", tokens: 4096 },
]

const MULTI = [
  { k: "float32", bytes: DIM * 4, note: "what encode() returns" },
  { k: "float16", bytes: DIM * 2, note: "half of float32" },
  { k: "int8", bytes: DIM, note: "plus a scale per vector or per block" },
  { k: "2-bit residual", bytes: 36, note: "ColBERTv2-style: centroid id + 2 bits a dim" },
  { k: "1-bit residual", bytes: 20, note: "ColBERTv2-style: centroid id + 1 bit a dim" },
] as const

const SINGLE_DIMS = [1024, 2048, 3072, 4096] as const
const SINGLE_PREC = [
  { k: "float32", b: 4 },
  { k: "float16", b: 2 },
] as const
const SIZES = [
  { l: "10K", n: 1e4 },
  { l: "100K", n: 1e5 },
  { l: "1M", n: 1e6 },
  { l: "10M", n: 1e7 },
  { l: "100M", n: 1e8 },
  { l: "1B", n: 1e9 },
]

const C = { multi: "oklch(0.55 0.11 200)", single: "oklch(0.7 0.03 260)" }

function human(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let v = bytes
  let u = 0
  while (v >= 1000 && u < units.length - 1) {
    v = v / 1000
    u += 1
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[u]}`
}

function big(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

export function StorageCalculator() {
  const [di, setDi] = useState(2)
  const [mi, setMi] = useState(1)
  const [sd, setSd] = useState(3)
  const [sp, setSp] = useState(0)
  const [ci, setCi] = useState(2)
  const [qt, setQt] = useState(16)

  const doc = DOCS[di]
  const sized = doc.kind === "image" ? smartResize(doc.h, doc.w) : null
  const vectors = doc.kind === "image" ? (sized ? sized.n : 0) : doc.tokens
  const perVec = MULTI[mi].bytes
  const perDoc = vectors * perVec
  const singleDim = SINGLE_DIMS[sd]
  const singleDoc = singleDim * SINGLE_PREC[sp].b
  const n = SIZES[ci].n
  const multiTotal = perDoc * n
  const singleTotal = singleDoc * n
  const ratio = perDoc / singleDoc
  const scale = Math.max(multiTotal, singleTotal)

  const macsMulti = qt * vectors * DIM

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one vector per token vs one vector per document</span>
        <span className="font-mono text-[10px] text-muted-foreground">vector counts from the shipped configs; no graph or metadata</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-2">
        <div className="space-y-3 font-mono text-[11px]">
          <Pills label="what one document is" items={DOCS.map((d) => d.label)} active={di} onPick={setDi} />
          <Pills label="multi-vector storage, per 128-d vector" items={MULTI.map((m) => m.k)} active={mi} onPick={setMi} />
          <Pills label="single-vector baseline: dimensions" items={SINGLE_DIMS.map(String)} active={sd} onPick={setSd} />
          <Pills label="single-vector baseline: precision" items={SINGLE_PREC.map((p) => p.k)} active={sp} onPick={setSp} />
          <Pills label="documents in the corpus" items={SIZES.map((s) => s.l)} active={ci} onPick={setCi} />
          <label className="block">
            <span className="text-muted-foreground">query tokens: {qt}</span>
            <Range min={4} max={64} step={1} value={qt} onChange={(e) => setQt(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">index size, {SIZES[ci].l} documents</div>
            <Bar label="late interaction" v={multiTotal} scale={scale} c={C.multi} />
            <Bar label={`${singleDim}-d single`} v={singleTotal} scale={scale} c={C.single} />
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <Cell
              label="vectors per document"
              value={vectors.toLocaleString("en-US")}
              sub={sized ? `resized to ${sized.wb} x ${sized.hb}, one per 32 x 32 block` : "one per token, bare punctuation dropped"}
            />
            <Cell label="bytes per document" value={human(perDoc)} sub={`${vectors.toLocaleString("en-US")} x ${perVec} B; ${MULTI[mi].note}`} />
            <Cell label="single-vector document" value={human(singleDoc)} sub={`${singleDim} x ${SINGLE_PREC[sp].b} B`} />
            <Cell
              label="late interaction costs"
              value={`${ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1)}x`}
              sub="the bytes of the single-vector index"
            />
            <Cell
              label="multiply-adds to score one candidate"
              value={big(macsMulti)}
              sub={`${qt} x ${vectors.toLocaleString("en-US")} x 128, against ${singleDim.toLocaleString("en-US")} for one dot product`}
            />
            <Cell label="same index from the 0.6B or the 9B" value="same bytes" sub="both emit 128-d vectors from the same tokenizer and image processor" />
          </div>
        </div>
      </div>

      <p className="px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        A Letter page rendered at 150 dpi is past the 1,800,964-pixel cap, so it is shrunk to 1,152 x 1,504 and gives
        1,692 vectors: 433 KB in float16, about 26 times a 4,096-wide float32 vector. Rendering at 72 dpi gives 475
        vectors instead; how sharp you rasterise a page sets the index bill, and that is a choice the model card leaves
        to you.
      </p>
    </figure>
  )
}

function Pills({ label, items, active, onPick }: { label: string; items: string[]; active: number; onPick: (i: number) => void }) {
  return (
    <div>
      <div className="mb-1 text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick(i)}
            aria-pressed={active === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 text-[10px] tabular-nums transition-colors",
              active === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bar({ label, v, scale, c }: { label: string; v: number; scale: number; c: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">{label}</span>
      <div className="relative flex h-3.5 flex-1 overflow-hidden rounded-sm bg-muted/40">
        <div className="h-full" style={{ width: `${Math.max(0.4, (v / scale) * 100).toFixed(3)}%`, background: c, opacity: 0.85 }} />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{human(v)}</span>
    </div>
  )
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-foreground">{value}</div>
      <div className="text-[9.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}
