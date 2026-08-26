"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the parameters of a "2B" model actually are, and what survives the
// GGUF conversion.
//
// Top row: the safetensors header of empero-ai/Qwen3.8-2B-Distill, read by
// range-requesting the first 2 MB of model.safetensors and decoding the JSON
// index. 632 tensors, all BF16, 2,274,069,824 parameters = 4,548,139,648 bytes,
// plus a 77,160-byte header = the 4,548,216,808-byte file the API reports.
// Grouped by tensor-name prefix:
//     model.language_model.*  1,373,265,728
//     model.language_model.embed_tokens.weight  508,559,360   (tie_word_embeddings: true)
//     model.visual.*            331,416,576     24-layer ViT, hidden 1024
//     mtp.*                      60,828,160
//
// Bottom row: the tensor table of Qwen3.8-2B-Q4_K_M.gguf, decoded from the
// file's own header. 335 tensors, 1,942,653,248 parameters — which is exactly
// 1,373,265,728 + 508,559,360 + 60,828,160, i.e. the safetensors minus the
// vision tower, to the parameter. There is no mmproj file in the repo and no
// v.* or mm.* tensor in any of the five GGUFs: the vision path is gone.
//
// Byte totals per group come from summing each tensor's ggml block size:
//   Q4_K 144 B / 256 values, Q6_K 210 B / 256, Q8_0 34 B / 32, F32 4 B / value.
// The sum lands on 1,312,164,210 against a 1,312,164,224-byte file — the 14-byte
// remainder is alignment padding.
//
// The single most surprising line: token_embd.weight is Q6_K, not Q4_K, in a
// file called Q4_K_M. tie_word_embeddings is true, so that matrix is also the
// output projection, and llama.cpp will not take the output projection to 4 bits.
// 417 MB of a 1.31 GB download is one lookup table.

const BODY = "oklch(0.60 0.15 255)"
const EMBED = "oklch(0.68 0.13 85)"
const VISION = "oklch(0.58 0.19 27)"
const MTP = "oklch(0.55 0.16 155)"
const TOK = "oklch(0.62 0.03 250)"

type Group = {
  k: string
  label: string
  color: string
  params: number
  st: number // bytes in model.safetensors (bf16)
  gg: number // bytes in Qwen3.8-2B-Q4_K_M.gguf
  note: string
}

const GROUPS: Group[] = [
  {
    k: "body",
    label: "transformer body",
    color: BODY,
    params: 1373265728,
    st: 1373265728 * 2,
    gg: 548536320 + 247221504 + 50294784 + 204800,
    note: "24 layers: 18 Gated DeltaNet, 6 gated attention, an FFN on every one, plus the norms. This is the part that does the computing, and it is 1.373B parameters — 60% of what the “2B” label covers.",
  },
  {
    k: "embed",
    label: "token_embd (tied)",
    color: EMBED,
    params: 508559360,
    st: 1017118720,
    gg: 417177600,
    note: "248,320 tokens × 2,048 dims. tie_word_embeddings is true, so this matrix is also the output projection — which is why llama.cpp quantizes it to Q6_K even in the Q4_K_M build. 6.56 bits per weight against 4.5 for everything else, and 31.8% of the file you download.",
  },
  {
    k: "mtp",
    label: "MTP / nextn block",
    color: MTP,
    params: 60828160,
    st: 121656320,
    gg: 37767168,
    note: "A complete extra transformer block for multi-token prediction, shipped in every GGUF as blk.24. llama.cpp only builds it when you open a second context of type LLAMA_CONTEXT_TYPE_MTP; a plain llama-cli run loads 37.8 MB it will not execute.",
  },
  {
    k: "vision",
    label: "vision tower",
    color: VISION,
    params: 331416576,
    st: 662833152,
    gg: 0,
    note: "A 24-layer ViT with a patch embedding and a merger, inherited from the Qwen3.5-2B base — which is a vision-language model. The fine-tune is text-only and never touched it; the model card says so. The GGUF conversion drops it entirely and ships no mmproj, so 663 MB of your safetensors download does nothing in llama.cpp.",
  },
  {
    k: "tok",
    label: "tokenizer metadata",
    color: TOK,
    params: 0,
    st: 0,
    gg: 10962034,
    note: "248,320 token strings and 247,587 BPE merges written into the GGUF key-value header. Byte-identical in all five quantizations — 10.96 MB before a single weight is read.",
  },
]

const ST_TOTAL = 4548216808
const GG_TOTAL = 1312164224

const gb = (b: number) => `${(b / 1e9).toFixed(3)} GB`
const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`

export function WeightLedger() {
  const [sel, setSel] = useState("embed")
  const g = GROUPS.find((x) => x.k === sel)!

  const W = 700
  const PAD = 12
  const SPAN = W - PAD * 2
  const px = (b: number) => (b / ST_TOTAL) * SPAN

  const rows = [
    { name: "model.safetensors · bf16", total: ST_TOTAL, key: "st" as const },
    { name: "Qwen3.8-2B-Q4_K_M.gguf", total: GG_TOTAL, key: "gg" as const },
  ]

  const bpw = (p: number, b: number) => (p > 0 ? `${((b * 8) / p).toFixed(2)} bits/weight` : "no weights")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          where a &ldquo;2B&rdquo; goes · 2,274,069,824 params on disk, 1,942,653,248 in the GGUF
        </span>
        <span className="font-mono text-[10px]" style={{ color: VISION }}>
          {(100 - (GG_TOTAL / ST_TOTAL) * 100).toFixed(1)}% smaller after conversion
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={sel === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 138`} width={W} height={138} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two bars on the same byte scale. The safetensors download is ${gb(ST_TOTAL)}, of which the ` +
                `vision tower is ${mb(662833152)}. The Q4_K_M GGUF is ${gb(GG_TOTAL)} and contains no vision ` +
                `tensors at all. The currently selected group is ${g.label}.`}
            </title>

            {rows.map((r, ri) => {
              const yTop = 20 + ri * 62
              let x = PAD
              return (
                <g key={r.name}>
                  <text x={PAD} y={yTop - 6} fontSize={8.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {r.name}
                  </text>
                  <text
                    x={PAD + SPAN}
                    y={yTop - 6}
                    fontSize={9}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={0.8}
                    fontFamily="ui-monospace, monospace"
                  >
                    {gb(r.total)}
                  </text>
                  <rect x={PAD} y={yTop} width={SPAN} height={26} rx={4} fill="currentColor" fillOpacity={0.035} />
                  {GROUPS.map((grp) => {
                    const b = grp[r.key]
                    if (b <= 0) return null
                    const w = px(b)
                    const x0 = x
                    x += w
                    const on = sel === grp.k
                    return (
                      <g key={grp.k}>
                        <rect
                          x={x0}
                          y={yTop}
                          width={Math.max(w, 1)}
                          height={26}
                          fill={grp.color}
                          fillOpacity={on ? 0.92 : 0.3}
                          stroke="var(--background, #fff)"
                          strokeWidth={0.6}
                        />
                        {w > 56 ? (
                          <text
                            x={x0 + w / 2}
                            y={yTop + 17}
                            fontSize={8.5}
                            textAnchor="middle"
                            fill={on ? "white" : "currentColor"}
                            fillOpacity={on ? 1 : 0.65}
                            fontFamily="ui-monospace, monospace"
                          >
                            {((b / r.total) * 100).toFixed(0)}%
                          </text>
                        ) : null}
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {/* the vision tower's fate, drawn once */}
            <line
              x1={PAD + px(GROUPS[0].st + GROUPS[1].st + GROUPS[2].st)}
              y1={46}
              x2={PAD + px(GROUPS[0].st + GROUPS[1].st + GROUPS[2].st)}
              y2={82}
              stroke={VISION}
              strokeWidth={1.1}
              strokeDasharray="3 3"
            />
            <text
              x={PAD + px(GROUPS[0].st + GROUPS[1].st + GROUPS[2].st) - 5}
              y={69}
              fontSize={8.2}
              textAnchor="end"
              fill={VISION}
              fontFamily="ui-monospace, monospace"
            >
              663 MB of vision tower, dropped in conversion
            </text>

            <text x={PAD} y={132} fontSize={8} fill="currentColor" fillOpacity={0.42} fontFamily="ui-monospace, monospace">
              both bars on one byte scale · segment widths are real bytes, not illustrative
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "parameters", v: g.params ? g.params.toLocaleString() : "—", c: g.color },
            { l: "in the safetensors", v: g.st ? mb(g.st) : "—", c: g.color },
            { l: "in the Q4_K_M GGUF", v: g.gg ? mb(g.gg) : "dropped", c: g.gg ? g.color : VISION },
            { l: "effective precision", v: g.gg && g.params ? bpw(g.params, g.gg) : "—", c: g.color },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded-lg border-l-2 px-3 py-2 text-sm leading-6 text-muted-foreground" style={{ borderColor: g.color }}>
          {g.note}
        </p>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          &ldquo;2B&rdquo; is doing a lot of work as a label. The safetensors file holds{" "}
          <span className="text-foreground">2,274,069,824</span>{" "}parameters. Take out the vision
          tower the text fine-tune never touched and you have 1.943B, which is what the GGUF contains,
          to the parameter. Take out the tied embedding table and the multi-token-prediction head and
          the transformer that actually answers your question is{" "}
          <span style={{ color: BODY }}>1.373B</span>.
          <br />
          <br />
          That last subtraction is not pedantry, because the embedding is where the quantization
          argument goes to die. Qwen3.5&rsquo;s vocabulary is 248,320 tokens — it covers 201 languages
          and carries vision and tool sentinels — so at hidden size 2,048 the table alone is 508.6M
          parameters, more than a quarter of the model. And{" "}
          <span className="font-mono text-[11px] text-foreground">tie_word_embeddings: true</span>{" "}
          means it doubles as the output projection, which llama.cpp will not quantize to four bits.
          The result is a{" "}
          <span style={{ color: EMBED }}>417 MB Q6_K floor</span>{" "}under every K-quant in the repo.
          Half the byte volume of the &ldquo;4-bit&rdquo; file is at six bits, its true rate is 5.40
          bits per weight, and that is the arithmetic reason the smallest file on offer is 1.312 GB
          rather than something starting with a zero.
        </p>
      </div>
    </figure>
  )
}
