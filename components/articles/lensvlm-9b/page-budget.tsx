"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What a document costs LensVLM, page by page.
//
// Every constant is from a primary file, not from me:
//
//   - The three presets are the paper's Table 7, and they are the same numbers,
//     digit for digit, as COMPRESSION_PRESETS in Apple's
//     lensvlm/rendering_config.py at commit 10709a7: page width, font size,
//     how many text tokens a page holds (405 / 540 / 378), and the page height
//     that comes out (284 / 252 / 190 px).
//   - Visual tokens per page follow Qwen3.5's encoder, appendix eq. 7.1:
//     ceil(H/16) * ceil(W/16) / 4 — 16 px patches, merged 2x2. That gives
//     72 / 48 / 24.
//   - With Qwen's stock preprocessor floor of 65,536 pixels (size.shortest_edge
//     in Qwen/Qwen3.5-9B's preprocessor_config.json), transformers'
//     smart_resize upscales the 10x and 15x pages to 224 x 320 before the
//     encoder sees them: 70 tokens each. The 5x page is already above the
//     floor. Apple's processor_config.json sets min_pixels to 1 and its code
//     passes min_pixels=1 to vLLM, which is what keeps 24 as 24.
//   - read_page returns one page's source text, so one call costs about one
//     page's worth of text tokens.
//   - Top-k retrieval at the same preset reads ceil(K / C) chunks, each one
//     page's worth of text, which is how the paper sizes its retrievers.
//   - KV cache: 8 full-attention layers x 4 KV heads x head_dim 256 x (K, V) x
//     2 bytes = 32,768 bytes a token, from config.json. The 24 Gated DeltaNet
//     layers keep a fixed-size state instead and are not counted.
//
// Like the paper's ECR, this counts the document only: page images plus
// expanded text. The system prompt, the question and the model's reasoning are
// left out, which is why the paper's own KV measurements (in the prose) come
// out well below its ECR.
//
// Integer arithmetic plus one division per ratio; nothing here needs lib/dmath.

type Preset = {
  key: string
  nominal: number
  width: number
  height: number
  font: number
  tpp: number
  vt: number
  vtFloor: number
}

const PRESETS: Preset[] = [
  { key: "5x", nominal: 5, width: 256, height: 284, font: 8, tpp: 405, vt: 72, vtFloor: 72 },
  { key: "10x", nominal: 10, width: 192, height: 252, font: 6, tpp: 540, vt: 48, vtFloor: 70 },
  { key: "15x", nominal: 15, width: 128, height: 190, font: 5, tpp: 378, vt: 24, vtFloor: 70 },
]

const KV_BYTES_PER_TOKEN = 32768
const ACCENT = "var(--hg-accent, oklch(0.72 0.15 195))"
const MAX_TILES = 64

function fmt(n: number): string {
  const s = String(Math.round(n))
  let out = ""
  for (let i = 0; i < s.length; i++) {
    const fromEnd = s.length - i
    out += s[i]
    if (fromEnd > 1 && fromEnd % 3 === 1) out += ","
  }
  return out
}

function mib(tokens: number): string {
  return ((tokens * KV_BYTES_PER_TOKEN) / 1048576).toFixed(1)
}

// Spread m expanded pages evenly through K, deterministically.
function expandedPages(k: number, m: number): Set<number> {
  const s = new Set<number>()
  for (let i = 1; i <= m; i++) s.add(Math.min(k - 1, Math.floor((i * k) / (m + 1))))
  return s
}

export function PageBudget() {
  const [tokens, setTokens] = useState(10000)
  const [presetIdx, setPresetIdx] = useState(0)
  const [calls, setCalls] = useState(1)
  const [floor, setFloor] = useState(false)

  const p = PRESETS[presetIdx]
  const pages = Math.ceil(tokens / p.tpp)
  const vtPer = floor ? p.vtFloor : p.vt
  const visual = pages * vtPer
  const m = Math.min(calls, pages)
  const expanded = Math.min(m * p.tpp, tokens)
  const reader = visual + expanded
  const ecr = tokens / reader
  const icr = tokens / visual
  const topK = Math.ceil(pages / p.nominal)
  const retrieval = Math.min(topK * p.tpp, tokens)
  const ecrRetrieval = tokens / retrieval
  const opened = expandedPages(pages, m)

  const pctVisual = (visual * 100) / tokens
  const pctExpanded = (expanded * 100) / tokens
  const pctRetrieval = (retrieval * 100) / tokens

  const shown = Math.min(pages, MAX_TILES)
  const tileW = 6 + vtPer / 6

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-page-budget={p.key}
      aria-label="Token budget of a document read by LensVLM: text tokens against compressed page images plus expanded pages, and against top-k retrieval"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        one document, three ways to feed it to the same 9B reader
      </div>

      <div className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="w-28 shrink-0 text-muted-foreground">preset</span>
          {PRESETS.map((q, i) => (
            <button
              key={q.key}
              type="button"
              aria-pressed={i === presetIdx}
              onClick={() => setPresetIdx(i)}
              className={cn(
                "rounded border px-2 py-0.5 transition-colors",
                i === presetIdx
                  ? "border-foreground/60 bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {q.key}
            </button>
          ))}
          <span className="text-muted-foreground">
            {" "}
            · {p.width} px wide · {p.font} px font · ~{p.tpp} text tokens a page
          </span>
        </div>
        <label className="flex items-center gap-2 font-mono text-xs">
          <span className="w-28 shrink-0 text-muted-foreground">
            {fmt(tokens)} tok
          </span>
          <Range
            min={2000}
            max={64000}
            step={1000}
            value={tokens}
            onChange={(e) => setTokens(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="document length in text tokens"
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-xs">
          <span className="w-28 shrink-0 text-muted-foreground">
            read_page × {calls}
          </span>
          <Range
            min={0}
            max={5}
            step={1}
            value={calls}
            onChange={(e) => setCalls(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="number of read_page calls"
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={floor}
            onChange={(e) => setFloor(e.currentTarget.checked)}
          />
          <span>
            serve with Qwen&rsquo;s stock 65,536-pixel floor instead of
            min_pixels=1
          </span>
        </label>
      </div>

      <div className="border-b px-4 py-3">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          {pages} page images × {vtPer} visual tokens
          {floor && p.vtFloor !== p.vt ? " (upscaled to 224 × 320)" : ""} ·{" "}
          {m} opened in full
        </p>
        <div
          className="mt-2 flex flex-wrap gap-1"
          role="img"
          aria-label={`${pages} page thumbnails, ${m} of them expanded to text`}
        >
          {Array.from({ length: shown }, (_, i) => (
            <span
              key={i}
              className={cn(
                "block h-5 rounded-[2px] border",
                opened.has(i)
                  ? "border-transparent"
                  : "border-foreground/25 bg-foreground/5"
              )}
              style={{
                width: `${tileW}px`,
                ...(opened.has(i) ? { backgroundColor: ACCENT } : {}),
              }}
            />
          ))}
          {pages > shown ? (
            <span className="self-center font-mono text-[10px] text-muted-foreground">
              +{pages - shown} more
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <div className="grid min-w-[22rem] grid-cols-[7.5rem_1fr_auto] items-center gap-x-3 gap-y-2 font-mono text-xs tabular-nums">
          <span className="text-muted-foreground">full text</span>
          <span className="relative h-3 rounded-sm bg-muted/50">
            <span className="absolute inset-y-0 left-0 w-full rounded-sm bg-foreground/50" />
          </span>
          <span className="text-right">
            {fmt(tokens)} · {mib(tokens)} MiB
          </span>

          <span className="text-muted-foreground">LensVLM</span>
          <span className="relative h-3 rounded-sm bg-muted/50">
            <span
              className="absolute inset-y-0 left-0 rounded-l-sm bg-foreground/30"
              style={{ width: `${Math.min(100, pctVisual)}%` }}
            />
            <span
              className="absolute inset-y-0"
              style={{
                backgroundColor: ACCENT,
                left: `${Math.min(100, pctVisual)}%`,
                width: `${Math.max(0, Math.min(100 - pctVisual, pctExpanded))}%`,
              }}
            />
          </span>
          <span className="text-right">
            {fmt(reader)} · {mib(reader)} MiB
          </span>

          <span className="text-muted-foreground">top-{topK} retrieval</span>
          <span className="relative h-3 rounded-sm bg-muted/50">
            <span
              className="absolute inset-y-0 left-0 rounded-sm bg-foreground/50"
              style={{ width: `${Math.min(100, pctRetrieval)}%` }}
            />
          </span>
          <span className="text-right">
            {fmt(retrieval)} · {mib(retrieval)} MiB
          </span>
        </div>
      </div>

      <div className="border-t px-4 py-3 font-mono text-xs">
        <span className="text-foreground">
          input compression {icr.toFixed(1)}× → effective {ecr.toFixed(1)}×
        </span>
        <span className="text-muted-foreground">
          {" "}
          · {fmt(visual)} image tokens + {fmt(expanded)} expanded text ·
          top-{topK} retrieval {ecrRetrieval.toFixed(1)}×
        </span>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Presets from the paper&rsquo;s Table 7, identical to{" "}
        <code>rendering_config.py</code>; tokens per page from the encoder
        formula; 32 KiB of KV cache a token from <code>config.json</code>.
        Counts the document only, as the paper&rsquo;s ECR does: no system
        prompt, question or reasoning. Derived arithmetic, not a run.
      </figcaption>
    </figure>
  )
}
