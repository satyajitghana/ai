"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number below was pulled from the Hugging Face Hub API, not from the
// repo's own README (gated, 401 for this session -- see the "gated: auto"
// section of the article). Two calls, same day:
//
//   GET https://huggingface.co/api/models/orcarouter/GLM-5.3-Flash-Uncensored-FP8?blobs=true
//   GET https://huggingface.co/api/models/zai-org/GLM-5.3-Flash?blobs=true
//
// The Hub computes safetensors.parameters by reading each shard's own header
// -- tensor name, dtype, shape -- not by eyeballing file size, so the dtype
// totals matching exactly means no tensor was added, removed, or retyped.
// Every non-README file size below is a straight blobId/size comparison from
// the `siblings` array of each response. README.md is the one row that
// differs -- 19,515 bytes for the uncensored repo (which adds an abliteration
// writeup) against 8,024 for the base card.
//
// quantization_config.modules_to_not_convert is returned by the API's curated
// `config` field even for the gated repo -- 1,509 entries, same list, same
// order, in both responses (Python set/list equality checked directly).

type Row = { label: string; value: string; note?: string }

const IDENTICAL: Row[] = [
  { label: "safetensors: F8_E4M3", value: "314,396,639,232" },
  { label: "safetensors: BF16", value: "6,926,096,640" },
  { label: "safetensors: F32", value: "295,518" },
  { label: "safetensors: total", value: "321,323,031,390" },
  { label: "config.json", value: "69,416 bytes" },
  { label: "quantization_config.modules_to_not_convert", value: "1,509 entries, same order" },
  { label: "tokenizer.json", value: "20,217,442 bytes" },
  { label: "chat_template.jinja", value: "10,644 bytes" },
  { label: "LICENSE", value: "1,070 bytes", note: "both MIT" },
  { label: "tokenizer_config.json", value: "761 bytes" },
  { label: "processor_config.json", value: "909 bytes" },
  { label: "generation_config.json", value: "194 bytes" },
  { label: "file count", value: "72 files, 62 safetensors shards" },
]

type Diff = { label: string; a: string; b: string }

const DIFFERENT: Diff[] = [{ label: "README.md", a: "8,024 bytes", b: "19,515 bytes" }]

const SAME = "oklch(0.55 0.16 155)"
const DIFF = "oklch(0.68 0.13 85)"

type View = "same" | "diff"

export function RepoParity() {
  const [view, setView] = useState<View>("same")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Hub API metadata · zai-org/GLM-5.3-Flash vs orcarouter/GLM-5.3-Flash-Uncensored-FP8
        </span>
        <div className="flex gap-1">
          {(["same", "diff"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "same" ? `identical (${IDENTICAL.length})` : `different (${DIFFERENT.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "same" ? (
          <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {IDENTICAL.map((f) => (
              <div key={f.label} className="flex items-baseline gap-2 rounded-md px-2 py-1 odd:bg-muted/20">
                <span
                  className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: SAME }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                  {f.label}
                  {f.note ? <span className="text-foreground/50"> · {f.note}</span> : null}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-foreground">{f.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {DIFFERENT.map((f) => (
              <div
                key={f.label}
                className="rounded-lg border px-3 py-2.5"
                style={{ borderColor: `color-mix(in oklch, ${DIFF} 35%, transparent)` }}
              >
                <div className="font-mono text-[11px] text-foreground">{f.label}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="rounded-sm bg-muted/40 px-1.5 py-0.5">base: {f.a}</span>
                  <span aria-hidden>&rarr;</span>
                  <span
                    className="rounded-sm px-1.5 py-0.5"
                    style={{ background: `color-mix(in oklch, ${DIFF} 18%, transparent)`, color: DIFF }}
                  >
                    uncensored: {f.b}
                  </span>
                </div>
              </div>
            ))}
            <p className="pt-1 font-mono text-[10px] text-muted-foreground">
              every other file in the 72-file manifest — weights included — comes back byte-identical in size
            </p>
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The README is the only thing in this manifest that changed size. Total parameter count, the split
          between <span className="text-foreground">F8_E4M3</span> and{" "}
          <span className="text-foreground">BF16</span>, the tokenizer, the chat template, the license file,
          and the 1,509-entry list of tensors the base model&rsquo;s own FP8 conversion never touched — all
          identical, down to the byte. That is what &ldquo;no LoRA, edited in place&rdquo; looks like from the
          outside: nothing was added, resized, or restructured. Whatever abliteration did here, it did it to
          existing weight values and left every shape, dtype, and file alone.
        </p>
      </div>
    </figure>
  )
}
