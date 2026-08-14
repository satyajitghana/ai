"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every "measured" figure here came from the repository itself, not the card:
// safetensors headers fetched by HTTP range request (8-byte length prefix, then
// the JSON header giving each tensor's dtype and shape), and the HF tree API for
// the loose .pth files, divided by their dtype width.
//
// The dtypes matter. transformer is F32, so dividing its bytes by 2 would have
// reported 4.86B and made the card look wrong; it is 2.43B and the card is
// right. rvq_depth_decoder is the only BF16 component of the five.

type Row = {
  part: string
  claim: string
  measured: string
  file: string
  dtype: string
  ok: "exact" | "match" | "off"
  note: string
}

const ROWS: Row[] = [
  {
    part: "Global LLM",
    claim: "8B",
    measured: "8.584B",
    file: "language_model/ (4 shards)",
    dtype: "BF16",
    ok: "exact",
    note: "Qwen3ForCausalLM, 36 layers, hidden 4096 — Qwen3-8B's shape, but vocab_size is 200,000 rather than 151,936. Qwen3-8B is 8.191B; widening the vocabulary adds (200,000 − 151,936) × 4096 × 2 = 393.7M for an untied embedding and output head. 8.191 + 0.394 = 8.584B, which is what the index reports to three decimals. The card's \"initialized from Qwen3-8B\" and \"embedding and output layers adapted to semantic music tokens\" are both visible in that one number.",
  },
  {
    part: "Local LLM",
    claim: "0.6B",
    measured: "646.0M",
    file: "rvq_depth_decoder/",
    dtype: "BF16",
    ok: "match",
    note: "Named for its job rather than its size: it decodes RVQ depth, predicting codebooks 1 through 7 within a frame after the Global LLM has committed codebook 0. The only BF16 component in the diffusers layout.",
  },
  {
    part: "Flow Matching",
    claim: "2.4B",
    measured: "2,431.9M",
    file: "transformer/ (2 shards)",
    dtype: "F32",
    ok: "match",
    note: "Stored in float32, which is the detail that makes the arithmetic work. 9.73 GB over two shards is 4.86B parameters at bf16 and 2.43B at fp32 — and the header says F32 on every tensor.",
  },
  {
    part: "Flow-VAE Decoder",
    claim: "123M",
    measured: "123.0M",
    file: "dav.pth",
    dtype: "F32",
    ok: "exact",
    note: "491.8 MB divided by four bytes is 123.0M parameters, matching the card exactly. Note this is the loose .pth, not the diffusers vocoder/ folder, which is a different and smaller artifact at 54.2M.",
  },
  {
    part: "Condition encoder",
    claim: "not stated",
    measured: "25.2M",
    file: "condition_encoder/",
    dtype: "F32",
    ok: "match",
    note: "Absent from the card entirely. 24 kHz in at hop 960, 44.1 kHz out at hop 512, eight layers. Small, and the piece that lets the model be conditioned on audio rather than only on text.",
  },
]

const OK = "oklch(0.60 0.15 255)"
const EXACT = "oklch(0.55 0.16 155)"

export function ParamLedger() {
  const [sel, setSel] = useState(0)
  const r = ROWS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">card claim vs bytes on disk</span>
        <span className="font-mono text-[10px]" style={{ color: EXACT }}>
          5 of 5 reconcile
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[10px]">
            <thead>
              <tr className="border-b">
                {["component", "card", "measured", "dtype", "artifact"].map((h) => (
                  <th key={h} className="py-1 pr-2 text-left font-normal text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((x, i) => (
                <tr
                  key={x.part}
                  onClick={() => setSel(i)}
                  className={cn(
                    "cursor-pointer border-b border-border/40 transition-colors",
                    i === sel ? "bg-muted/40" : "hover:bg-muted/20",
                  )}
                >
                  <td className="py-1.5 pr-2 whitespace-nowrap text-foreground">{x.part}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{x.claim}</td>
                  <td
                    className="py-1.5 pr-2 whitespace-nowrap tabular-nums"
                    style={{ color: x.ok === "exact" ? EXACT : OK }}
                  >
                    {x.measured}
                  </td>
                  <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{x.dtype}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{x.file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px] text-foreground">
            {r.part} — card says {r.claim}, disk says {r.measured} ({r.dtype})
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{r.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Model cards round, and rounding hides whether anyone checked. Here every stated size reconciles against
          the bytes actually published, and two of them land exactly: the Global LLM at 8.584B, which is Qwen3-8B
          plus precisely the vocabulary expansion the card describes, and the Flow-VAE decoder at 123.0M. The one
          number you cannot get from the card is the condition encoder, which it never mentions.
        </p>
      </div>
    </figure>
  )
}
