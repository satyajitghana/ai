"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The whole Audio8/AutoArk-AI family, enumerated the same way this piece did:
// `https://huggingface.co/api/models?author=Audio8&limit=100`, then
// `?blobs=true` on each of the 12 repos that returns, summed over `siblings[].size`.
// Byte totals below are exact, pulled 2026-09-08. Named-size and true-size
// splits come from reading each repo's own README ("language-model parameters"
// vs "end-to-end unique parameters") and, independently, from the safetensors
// header at the front of model.safetensors (first 8 bytes = header length,
// then that many bytes of JSON -- no download needed).
//
// The one row that isn't a straight lookup: GPA-v1.5's model card links its
// ONNX runtime bundle to "AutoArk-AI/GPA-v1.5-onnx-runtime". That path
// 307-redirects -- but to Edge0/GPA-v1.5-onnx-runtime, a repo owned by an
// unrelated third-party account (20 downloads, 22 likes at the time of
// writing), not to anything under Audio8 or AutoArk-AI. Confirmed with
// `curl -sI https://huggingface.co/api/models/AutoArk-AI/GPA-v1.5-onnx-runtime`
// and reading the `location:` header directly.

type Family = "asr" | "tts" | "unified"

type Cell = {
  mb: number | null
  label: string
}

type Row = {
  key: string
  name: string
  family: Family
  license: string
  named: string
  truth: string
  truthNote: string
  base: Cell
  onnx: Cell
  ane: Cell
  note: string
}

const ASR = "oklch(0.60 0.15 255)"
const TTS = "oklch(0.55 0.16 155)"
const UNIFIED = "oklch(0.68 0.13 85)"
const HOLE = "oklch(0.58 0.19 27)"

const FAMILY_COLOR: Record<Family, string> = { asr: ASR, tts: TTS, unified: UNIFIED }
const FAMILY_LABEL: Record<Family, string> = { asr: "ASR", tts: "TTS", unified: "unified" }

const ROWS: Row[] = [
  {
    key: "asr01",
    name: "Audio8-ASR-0.1B",
    family: "asr",
    license: "CC-BY-NC-4.0",
    named: "0.1B",
    truth: "0.324B",
    truthNote: "103.5M decoder + 186.4M Whisper-small encoder + 33.6M adapter, from the repo's own README",
    base: { mb: 707.8, label: "707.8 MB" },
    onnx: { mb: 2868.3, label: "2.80 GB" },
    ane: { mb: 416.9, label: "416.9 MB" },
    note: "the ONNX repo bundles fp32 + int8 + int4 decoder graphs plus fp32 + int8 audio towers all at once — it is bigger than the base checkpoint, not smaller.",
  },
  {
    key: "ark06",
    name: "ARK-ASR-0.6B",
    family: "asr",
    license: "Apache-2.0",
    named: "0.6B",
    truth: "1.153B",
    truthNote: "357.9M decoder layers + 146.9M tied embed/head + 637.0M Whisper-large-scale encoder + 10.8M adapter, from safetensors headers",
    base: { mb: 2499.9, label: "2.44 GB" },
    onnx: { mb: 1687.4, label: "1.65 GB" },
    ane: { mb: null, label: "—" },
    note: "int8-only ONNX package. No int4, no iOS build.",
  },
  {
    key: "ark3b",
    name: "ARK-ASR-3B",
    family: "asr",
    license: "Apache-2.0",
    named: "3B",
    truth: "4.063B",
    truthNote: "model.safetensors.index.json's own total_parameters field: 4,063,438,848 — decoder 3.397B + the same 637.0M Whisper-large-scale encoder + 29.4M adapter",
    base: { mb: 7766.9, label: "7.59 GB" },
    onnx: { mb: null, label: "—" },
    ane: { mb: null, label: "—" },
    note: "the most-downloaded model in the whole family (16,688 downloads, 99 likes) and the only one with zero official deployment variants. Community members filled the gap on their own: Masterx, cstr, harshav and OpenVoiceOS all publish unofficial GGUF/ONNX conversions.",
  },
  {
    key: "tts01",
    name: "Audio8-TTS-Preview-0.1b",
    family: "tts",
    license: "Audio8 Community v1.0",
    named: "0.1B",
    truth: "0.170B + codec",
    truthNote: "169.8M in model.safetensors (honest for the LM alone) plus a mandatory 1.257 GB codec.pth the name never counts",
    base: { mb: 1617.8, label: "1.58 GB" },
    onnx: { mb: 818.4, label: "818.4 MB" },
    ane: { mb: null, label: "—" },
    note: "revenue-capped license on the base checkpoint (free under $2M/yr, licensed above it) — but the official INT8 export is plain Apache-2.0, looser than the model it's exported from.",
  },
  {
    key: "tts06",
    name: "Audio8-TTS-Preview-0.6b",
    family: "tts",
    license: "Apache-2.0",
    named: "0.6B",
    truth: "0.601B + codec",
    truthNote: "601.2M in model.safetensors plus the identical 1.257 GB codec.pth — same LFS blob hash as the 0.1B repo's copy, byte for byte",
    base: { mb: 2446.7, label: "2.39 GB" },
    onnx: { mb: 968.3, label: "968.3 MB" },
    ane: { mb: null, label: "—" },
    note: "int4-only ONNX package — the opposite precision from the 0.1B line's int8-only package. No overlap between the two ladders.",
  },
  {
    key: "gpa",
    name: "GPA (0.3B line)",
    family: "unified",
    license: "Apache-2.0",
    named: "0.3B",
    truth: "0.313B",
    truthNote: "safetensors header: 312,625,152 params, bf16 — matches the GPA-v1.5 paper's own phrase, \"a lightweight 0.3B-parameter variant\"",
    base: { mb: 6574.2, label: "6.42 GB*" },
    onnx: { mb: 6574.2, label: "bundled in*" },
    ane: { mb: null, label: "—" },
    note: "*one repo holds base weights plus FP32/FP16/\"INT8\" ONNX bundles together — and the folder labeled INT8 actually nests an int4-quantized decoder next to an int8 codec, mixed precision under one name. Also vendors two copies of a third-party wav2vec2 encoder and a glm-4-voice-tokenizer, ~3.8 GB of the 6.42 GB that isn't GPA's own trained weight.",
  },
  {
    key: "gpav15",
    name: "GPA-v1.5 (1B-scale)",
    family: "unified",
    license: "Apache-2.0",
    named: "1B-scale",
    truth: "1.153B",
    truthNote: "safetensors header: 1,152,556,800 params — identical, tensor-shape for tensor-shape, to ARK-ASR-0.6B's own true size",
    base: { mb: 4029.0, label: "3.94 GB" },
    onnx: { mb: null, label: "redirects out" },
    ane: { mb: null, label: "—" },
    note: "the model card's own ONNX-runtime link resolves to Edge0/GPA-v1.5-onnx-runtime — a third-party account with 20 downloads — not to anything Audio8 or AutoArk-AI hosts.",
  },
]

export function DeploymentMatrix() {
  const [selected, setSelected] = useState<string>("ark3b")
  const row = ROWS.find((r) => r.key === selected) ?? ROWS[0]

  const maxMb = 7766.9
  const barW = (mb: number | null) => (mb == null ? 0 : Math.max(3, (mb / maxMb) * 100))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          12 repos under huggingface.co/Audio8 — real sizes, via ?blobs=true
        </span>
        <div className="flex items-center gap-3">
          {(["asr", "tts", "unified"] as Family[]).map((f) => (
            <span key={f} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: FAMILY_COLOR[f] }} />
              {FAMILY_LABEL[f]}
            </span>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.9fr_1fr_1fr_1fr] gap-px overflow-hidden rounded-lg border bg-border text-[10.5px]">
              <div className="bg-muted/30 px-2.5 py-2 font-mono text-muted-foreground">checkpoint</div>
              <div className="bg-muted/30 px-2.5 py-2 text-center font-mono text-muted-foreground">base (HF)</div>
              <div className="bg-muted/30 px-2.5 py-2 text-center font-mono text-muted-foreground">ONNX / quantized</div>
              <div className="bg-muted/30 px-2.5 py-2 text-center font-mono text-muted-foreground">iOS ANE</div>

              {ROWS.map((r) => {
                const active = r.key === selected
                const color = FAMILY_COLOR[r.family]
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelected(r.key)}
                    aria-pressed={active}
                    className={cn(
                      "col-span-4 grid grid-cols-[1.9fr_1fr_1fr_1fr] cursor-pointer bg-background text-left transition-colors hover:bg-muted/20",
                      active && "bg-muted/20",
                    )}
                  >
                    <span className="flex items-center gap-2 px-2.5 py-2">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="font-mono text-foreground">{r.name}</span>
                    </span>
                    {[r.base, r.onnx, r.ane].map((cell, i) => (
                      <span key={i} className="flex flex-col justify-center gap-0.5 px-2 py-2">
                        {cell.mb == null ? (
                          <span className="font-mono" style={{ color: HOLE, opacity: 0.85 }}>
                            {cell.label}
                          </span>
                        ) : (
                          <>
                            <span className="font-mono text-foreground">{cell.label}</span>
                            <span className="h-1 rounded-full bg-muted/40">
                              <span
                                className="block h-1 rounded-full"
                                style={{ width: `${barW(cell.mb)}%`, background: color, opacity: 0.55 }}
                              />
                            </span>
                          </>
                        )}
                      </span>
                    ))}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-[10px]">
            <span style={{ color: FAMILY_COLOR[row.family] }}>
              {row.name} — named {row.named}, true {row.truth}
            </span>
            <span className="text-muted-foreground">{row.license}</span>
          </div>
          <p className="text-[12px] leading-5 text-muted-foreground">{row.truthNote}</p>
          <p className="mt-1.5 text-[12px] leading-5 text-foreground/80">{row.note}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Read as a grid rather than seven separate model cards, the &ldquo;deployment-aware export&rdquo;
          framing holds unevenly. It is real and generous at the bottom of each ladder —{" "}
          <span style={{ color: ASR }}>Audio8-ASR-0.1B</span> gets a full ONNX precision bundle{" "}
          <em>and</em> a Swift/Core ML iOS SDK — thins to a single precision by the middle tier, and is{" "}
          <span style={{ color: HOLE }}>completely absent</span> for <span style={{ color: ASR }}>ARK-ASR-3B</span>,
          the single most-downloaded checkpoint Audio8 has shipped. The two{" "}
          <span style={{ color: UNIFIED }}>unified</span> models sit at opposite ends of a different problem: GPA
          crams every precision into one 6.42 GB repo, while GPA-v1.5&rsquo;s promised ONNX bundle simply isn&rsquo;t
          where the model card says it is.
        </p>
      </div>
    </figure>
  )
}
