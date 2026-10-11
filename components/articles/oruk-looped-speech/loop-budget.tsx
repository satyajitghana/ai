"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Parameters, FLOPs and weight bytes for Qwen3-ASR-1.7B unrolled against a
// student that keeps two shared blocks and loops them 24 + 28 times.
//
// MEASURED from Qwen/Qwen3-ASR-1.7B (config.json and both safetensors headers,
// read over HTTP range requests):
//   - audio encoder layer: 12,596,224 params, x 24 (width 1024, FFN 4096)
//   - audio front end (3 conv2d + conv_out + ln_post + 2 projections): 15,168,128
//   - text decoder layer: 50,336,000 params, x 28 (width 2048, FFN 6144,
//     16 query heads / 8 KV heads of 128)
//   - token embedding 151,936 x 2048 = 311,164,928, stored twice (lm_head is a
//     byte-identical copy; tie_word_embeddings is true) -> 2,038,052,480 unique
//   - LoRA "in+out" sums per layer: decoder 38,912 (q 4096, k 3072, v 3072,
//     o 4096, gate/up/down 8192 each), encoder 18,432 (q/k/v/o 2048 each,
//     fc1/fc2 5120 each)
// REASONED (the student's architecture is not published): a decoder block at
// width d is scaled from the teacher's by (d/2048)^2 and its LoRA sum by
// d/2048; the student's encoder block is kept at the teacher's width and shape,
// though Oruk calls theirs a "looped conformer", which would be larger. The
// memory model streams every weight a decoded token touches from DRAM unless
// the shared decoder block fits in on-chip memory; KV-cache and activation
// traffic are left out.

const ENC_LAYER = 12596224
const FRONT = 15168128
const DEC_LAYER = 50336000
const ENC_LOOPS = 24
const DEC_LOOPS = 28
const TEACHER_VOCAB = 151936
const TEACHER_D = 2048
const ENC_LORA_SUM = 18432
const DEC_LORA_SUM = 38912
const STATED = 153e6

const WIDTHS = [1024, 1536, 2048]
const VOCABS = [
  { v: 151936, label: "151,936 (Qwen3)" },
  { v: 32768, label: "32,768" },
  { v: 16384, label: "16,384" },
]
const RANKS = [0, 4, 8, 16, 32]
const BITS = [16, 8, 4]
const SRAM = [0, 8, 32, 64, 128]

function group(n: number) {
  const s = String(Math.round(n))
  let out = ""
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ","
    out += s[i]
  }
  return out
}
const fmtP = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`)
const fmtB = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(0)} MB`)

function Pick<T extends number>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  render?: (v: T) => string
}) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-xs transition-colors",
              value === o ? "border-foreground/40 bg-muted/50" : "border-border text-muted-foreground hover:bg-muted/20",
            )}
          >
            {render ? render(o) : String(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LoopBudget() {
  const [d, setD] = useState(2048)
  const [vocab, setVocab] = useState(32768)
  const [rank, setRank] = useState(8)
  const [bits, setBits] = useState(8)
  const [bw, setBw] = useState(68)
  const [sram, setSram] = useState(32)

  const bytesPer = bits / 8
  const scale = d / TEACHER_D

  // Teacher, unrolled.
  const tEmbed = TEACHER_VOCAB * TEACHER_D
  const tParams = ENC_LOOPS * ENC_LAYER + FRONT + DEC_LOOPS * DEC_LAYER + tEmbed + TEACHER_D
  const tDecTouched = DEC_LOOPS * DEC_LAYER + tEmbed
  const tFlops = 2 * tDecTouched
  const tBytesTok = tDecTouched * bytesPer

  // Student: one encoder block, one decoder block, per-loop LoRA.
  const sDecBlock = DEC_LAYER * scale * scale
  const sEmbed = vocab * d
  const sEncLora = ENC_LOOPS * rank * ENC_LORA_SUM
  const sDecLora = DEC_LOOPS * rank * DEC_LORA_SUM * scale
  const sParams = ENC_LAYER + FRONT + sDecBlock + sEmbed + sEncLora + sDecLora + d
  const sFlops = 2 * (DEC_LOOPS * sDecBlock + sEmbed + sDecLora)
  const blockBytes = sDecBlock * bytesPer
  const resident = blockBytes <= sram * 1e6
  const sBytesTok = (resident ? 0 : DEC_LOOPS * sDecBlock * bytesPer) + (sEmbed + sDecLora) * bytesPer

  const tTok = (bw * 1e9) / tBytesTok
  const sTok = (bw * 1e9) / sBytesTok
  const over = sParams / STATED

  const rows: { k: string; t: string; s: string; note?: string }[] = [
    { k: "stored parameters", t: fmtP(tParams), s: fmtP(sParams), note: `${(tParams / sParams).toFixed(1)}x fewer` },
    { k: `weights at ${bits}-bit`, t: fmtB(tParams * bytesPer), s: fmtB(sParams * bytesPer) },
    { k: "decoder FLOPs per token", t: `${(tFlops / 1e9).toFixed(2)} G`, s: `${(sFlops / 1e9).toFixed(2)} G` },
    { k: "DRAM bytes per token", t: fmtB(tBytesTok), s: fmtB(sBytesTok), note: resident ? "block stays on chip" : "block re-read every pass" },
    { k: `decode ceiling at ${bw} GB/s`, t: `${tTok.toFixed(1)} tok/s`, s: `${sTok.toFixed(1)} tok/s` },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3-ASR-1.7B unrolled vs two shared blocks looped 24 + 28 times
        </span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div aria-hidden className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">unrolled</span>
            <div className="flex flex-1 gap-px">
              {Array.from({ length: ENC_LOOPS + DEC_LOOPS }, (_, i) => (
                <div
                  key={i}
                  className="h-4 flex-1 rounded-[2px]"
                  style={{
                    background:
                      i < ENC_LOOPS
                        ? `oklch(${0.55 + (i % 6) * 0.05} 0.12 ${220 + i * 3})`
                        : `oklch(${0.55 + (i % 6) * 0.05} 0.13 ${20 + (i - ENC_LOOPS) * 3})`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">looped</span>
            <div className="flex flex-1 gap-px">
              {Array.from({ length: ENC_LOOPS + DEC_LOOPS }, (_, i) => (
                <div
                  key={i}
                  className="relative h-4 flex-1 rounded-[2px]"
                  style={{ background: i < ENC_LOOPS ? "oklch(0.62 0.12 230)" : "oklch(0.64 0.13 40)" }}
                >
                  {rank > 0 ? <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-[2px] bg-foreground/45" /> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="pl-[4.5rem] font-mono text-[10px] text-muted-foreground">
            24 encoder passes, then 28 decoder passes per token{rank > 0 ? "; the dark strip is each pass's own LoRA delta" : ""}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Pick label="student decoder width" options={WIDTHS} value={d} onChange={setD} />
          <Pick
            label="student vocabulary"
            options={VOCABS.map((x) => x.v)}
            value={vocab}
            onChange={setVocab}
            render={(v) => VOCABS.find((x) => x.v === v)?.label ?? String(v)}
          />
          <Pick label="LoRA rank per pass" options={RANKS} value={rank} onChange={setRank} />
          <Pick label="weight precision" options={BITS} value={bits} onChange={setBits} render={(b) => `${b}-bit`} />
          <Pick label="on-chip memory" options={SRAM} value={sram} onChange={setSram} render={(m) => `${m} MB`} />
          <div>
            <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              DRAM bandwidth: {bw} GB/s
            </div>
            <Range min={10} max={200} step={1} value={bw} onChange={(e) => setBw(Number(e.target.value))} aria-label="DRAM bandwidth in GB/s" />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left font-mono text-xs tabular-nums">
            <thead className="bg-muted/30 text-[10px] text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-1.5 font-normal"> </th>
                <th className="px-3 py-1.5 font-normal">teacher</th>
                <th className="px-3 py-1.5 font-normal">looped student</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k} className="border-t">
                  <td className="px-3 py-1.5 text-muted-foreground">{r.k}</td>
                  <td className="px-3 py-1.5">{r.t}</td>
                  <td className="px-3 py-1.5">
                    {r.s}
                    {r.note ? <span className="ml-2 text-[10px] text-muted-foreground">{r.note}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
          This student has <span className="font-mono tabular-nums">{group(sParams)}</span> parameters,{" "}
          <span className={cn("font-mono tabular-nums", Math.abs(over - 1) <= 0.1 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
            {(over * 100).toFixed(0)}%
          </span>{" "}
          of the 153M Oruk states. Its shared decoder block is {fmtB(blockBytes)} at {bits}-bit, which{" "}
          {resident ? "fits" : "does not fit"} in {sram} MB of on-chip memory.
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Teacher sizes are counted from Qwen3-ASR-1.7B&rsquo;s safetensors headers. The student is a
        hypothesis: Oruk has not published its widths, vocabulary or adapter rank, so these knobs show
        which combinations land near 153M, not which one they chose. The decode ceiling counts weight
        traffic only, for one stream, and ignores the KV cache, which looping does not shrink. Once the
        block stays on chip that ceiling stops binding and the chip&rsquo;s arithmetic does.
      </figcaption>
    </figure>
  )
}
