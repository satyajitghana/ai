"use client"

import Link from "next/link"
import { useState } from "react"

import { cn } from "@/lib/utils"

// Built directly from the patch's own diff, not from HauhauCS's prose description.
// Source: HauhauCS-FastMTP-llama.cpp.patch, fetched 2026-08-29 from the model
// repo's /resolve/main/, one file touched: src/models/qwen35.cpp. Confirmed it
// applies cleanly (`patch -p1 --dry-run`) against the exact base commit its own
// FastMTP-PROVENANCE.json names: ggerganov/llama.cpp@4df29be4f4c3673f428170f-
// da944a5b19f743bb8 (fetched via raw.githubusercontent.com at that commit).
//
// The tensor the patch wires in -- `LLM_TENSOR_D2T` / `model.d2t`, "draft to
// target vocabulary mapping" -- is not new: it already exists in llama.cpp's
// shared src/llama-arch.{h,cpp} and src/llama-model.h at that same commit, and
// GitHub code search (ggml-org/llama.cpp, path:src/models) shows exactly two
// files already reading it: eagle3.cpp and dflash.cpp -- dedicated draft-model
// architectures this site has covered (/articles/eagle-3-speculative-decoding,
// /articles/dflash2). qwen35.cpp itself has no other `d2t` reference before
// this patch (checked against the fetched base file). So the patch is not a new
// mechanism: it is the first wiring of an existing draft-vocabulary-trim
// convention into Qwen's own embedded MTP head.
//
// Vocabulary sizes are real, both confirmable from the model card: the padded
// full vocabulary is 248,320 (README "Specs"), and the FastMTP sidecar's
// trimmed vocabulary is 32,768 -- given away by the README's own diagnostic
// example for a mismatched build: "expected 5120, 248320, got 5120, 32768".
// 248320 / 32768 = 7.578125, computed here, not asserted by either source.
//
// The lit/unlit tick pattern in the trimmed strip is illustrative -- the real
// d2t index array lives inside the GGUF's binary tensor data, which this
// article did not download, so the exact 32,768 positions it selects are not
// shown here, only that a fixed subset is selected and everything else is
// forced to -inf.

type Mode = "native" | "fastmtp"

const FULL_VOCAB = 248_320
const DRAFT_VOCAB = 32_768
const RATIO = FULL_VOCAB / DRAFT_VOCAB

const NATIVE = "oklch(0.62 0.03 250)"
const TRIM = "oklch(0.60 0.15 255)"
const NEG = "oklch(0.62 0.03 250)"

const TICKS = 64
// fixed illustrative pattern: which of the 64 sample ticks are "lit" (real
// logit) under the trimmed path -- roughly draft_vocab/full_vocab of them
const LIT = new Set([2, 6, 9, 14, 15, 22, 27, 33])

const W = 760
const H = 260

export function VocabTrim() {
  const [mode, setMode] = useState<Mode>("fastmtp")
  const trimmed = mode === "fastmtp"

  const hiddenX = 24
  const hiddenW = 96
  const weightX = 168
  const weightMaxW = 280
  const weightW = trimmed ? weightMaxW / Math.sqrt(RATIO) : weightMaxW
  const stripX = 168
  const stripW = 560
  const rowY = 190

  const midY = 60

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the MTP head&rsquo;s output matmul, src/models/qwen35.cpp</span>
        <div className="flex gap-1.5">
          {(
            [
              ["native", "native embedded MTP"],
              ["fastmtp", "HauhauCS FastMTP"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full" aria-label={trimmed ? "HauhauCS FastMTP: the output projection is trimmed to a 32,768-token draft vocabulary, then scattered into a 248,320-wide vector filled with negative infinity everywhere else" : "Native embedded MTP: the output projection runs over the full 248,320-token vocabulary directly"}>
            <defs>
              <marker id="hqf-vt-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={trimmed ? TRIM : NATIVE} strokeWidth={1.5} />
              </marker>
              <filter id="hqf-vt-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
              </filter>
            </defs>

            {/* hidden state node */}
            <rect x={hiddenX} y={midY - 20} width={hiddenW} height={40} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#hqf-vt-soft)" />
            <text x={hiddenX + hiddenW / 2} y={midY - 3} textAnchor="middle" className="fill-foreground font-mono" fontSize={9} fontWeight={600}>hidden state</text>
            <text x={hiddenX + hiddenW / 2} y={midY + 11} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>5,120-dim</text>

            {/* arrow to weight */}
            <path d={`M ${hiddenX + hiddenW} ${midY} L ${weightX - 6} ${midY}`} stroke={trimmed ? TRIM : NATIVE} strokeWidth={1.5} markerEnd="url(#hqf-vt-arrow)" opacity={0.7} />

            {/* weight matrix, width encodes vocab size (sqrt scale) */}
            <rect
              x={weightX}
              y={midY - 26}
              width={weightW}
              height={52}
              rx={8}
              fill={trimmed ? TRIM : NATIVE}
              opacity={0.16}
              stroke={trimmed ? TRIM : NATIVE}
              strokeWidth={1.5}
              className="transition-all duration-300"
            />
            <text x={weightX + weightW / 2} y={midY - 4} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill={trimmed ? TRIM : NATIVE}>
              output.weight
            </text>
            <text x={weightX + weightW / 2} y={midY + 11} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
              [5,120 × {trimmed ? DRAFT_VOCAB.toLocaleString() : FULL_VOCAB.toLocaleString()}]
            </text>

            {/* arrow down to logits strip */}
            <path d={`M ${weightX + weightW / 2} ${midY + 26} L ${weightX + weightW / 2} ${rowY - 34}`} stroke={trimmed ? TRIM : NATIVE} strokeWidth={1.5} markerEnd="url(#hqf-vt-arrow)" opacity={0.7} />

            <text x={stripX} y={rowY - 20} className="fill-muted-foreground font-mono" fontSize={9}>
              {trimmed ? `logits over ${DRAFT_VOCAB.toLocaleString()} draft tokens → scattered via d2t into:` : `logits, full 248,320-token vocabulary`}
            </text>

            {/* the 64-tick strip standing in for the full vocabulary */}
            {Array.from({ length: TICKS }, (_, i) => {
              const x = stripX + (i * stripW) / TICKS
              const lit = trimmed ? LIT.has(i) : true
              return (
                <rect
                  key={i}
                  x={x}
                  y={rowY}
                  width={stripW / TICKS - 1.5}
                  height={28}
                  rx={2}
                  fill={lit ? (trimmed ? TRIM : NATIVE) : NEG}
                  opacity={lit ? 0.85 : 0.14}
                />
              )
            })}
            <text x={stripX} y={rowY + 44} className="fill-muted-foreground font-mono" fontSize={8}>
              0
            </text>
            <text x={stripX + stripW} y={rowY + 44} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>
              248,320
            </text>
            {trimmed && (
              <text x={stripX + stripW / 2} y={rowY + 44} textAnchor="middle" className="font-mono" fontSize={8} fill={NEG}>
                everywhere else: −∞ (ggml_fill, then ggml_set_rows)
              </text>
            )}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span>
            output columns: <span style={{ color: trimmed ? TRIM : NATIVE }}>{(trimmed ? DRAFT_VOCAB : FULL_VOCAB).toLocaleString()}</span>
          </span>
          {trimmed && <span style={{ color: TRIM }}>{RATIO.toFixed(2)}× fewer than native</span>}
          <span>gate: <code>mtp_only &amp;&amp; d2t present in the GGUF</code></span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every text GGUF in the repo already carries Qwen&rsquo;s own <span className="text-foreground">native MTP/NextN</span>{" "}
          head, which projects straight onto the full 248,320-token vocabulary — the top row above. The FastMTP
          sidecar is a second, separate checkpoint (the 903 MB <code>-32K.gguf</code>) whose head only knows{" "}
          {DRAFT_VOCAB.toLocaleString()} tokens — the &ldquo;32K&rdquo; in its filename — and the patch&rsquo;s job is
          to let <code>qwen35.cpp</code> load and run that smaller head: trim <code>output.weight</code> to{" "}
          {DRAFT_VOCAB.toLocaleString()} columns instead of {FULL_VOCAB.toLocaleString()} when the GGUF carries a{" "}
          <code>d2t</code> tensor, then scatter its logits back into full-vocabulary space with{" "}
          <code>ggml_set_rows</code>, everywhere else forced to <code>−∞</code>. That tensor and that scatter
          are not new inventions — they&rsquo;re the same <code>d2t</code> convention llama.cpp already uses for{" "}
          <Link href="/articles/eagle-3-speculative-decoding" className="underline decoration-dotted underline-offset-2">EAGLE-3</Link> and{" "}
          <Link href="/articles/dflash2" className="underline decoration-dotted underline-offset-2">DFlash</Link>-style dedicated drafters, now wired into a dense model&rsquo;s own
          embedded MTP graph for the first time. The target model still verifies in full-vocabulary space either
          way — the trim only changes what the draft is capable of proposing, never what gets accepted.
        </p>
      </div>
    </figure>
  )
}
