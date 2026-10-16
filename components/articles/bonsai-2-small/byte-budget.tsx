"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the bytes of a Ternary Bonsai 2 small GGUF go. Every number is
// measured: file sizes from the Hub tree API for prism-ml/Ternary-Bonsai-2-
// {2B,4B,9B}-gguf, and the per-tensor split from parsing each file's GGUF
// header (tensor shapes x ggml type size: PTQ1_0 = 28 B / 128 weights,
// PQ2_0 = 34 B / 128, Q2_0 = 18 B / 64, F32 = 4 B). The four slices sum to
// the exact file size for all nine packs. BF16 is 2 bytes x the GGUF's own
// language-model parameter count, which is what PrismML's 3.76 / 8.41 /
// 17.91 GB baselines are.

type Pack = "PTQ1_0" | "PQ2_0" | "Q2_0"
type Size = "2B" | "4B" | "9B"

type Model = {
  params: number
  embdParams: number
  tied: boolean
  header: number
  f32: number
  embd: Record<Pack, number>
  head: Record<Pack, number>
  blocks: Record<Pack, number>
  file: Record<Pack, number>
  mmproj: number
}

const MODELS: Record<Size, Model> = {
  "2B": {
    params: 1_881_825_088,
    embdParams: 508_559_360,
    tied: true,
    header: 10_999_008,
    f32: 6_913_280,
    embd: { PTQ1_0: 111_247_360, PQ2_0: 135_086_080, Q2_0: 143_032_320 },
    head: { PTQ1_0: 0, PQ2_0: 0, Q2_0: 0 },
    blocks: { PTQ1_0: 300_023_808, PQ2_0: 364_314_624, Q2_0: 385_744_896 },
    file: { PTQ1_0: 429_183_456, PQ2_0: 517_312_992, Q2_0: 546_689_504 },
    mmproj: 364_664_352,
  },
  "4B": {
    params: 4_205_751_296,
    embdParams: 635_699_200,
    tied: true,
    header: 11_037_536,
    f32: 19_574_784,
    embd: { PTQ1_0: 139_059_200, PQ2_0: 168_857_600, Q2_0: 178_790_400 },
    head: { PTQ1_0: 0, PQ2_0: 0, Q2_0: 0 },
    blocks: { PTQ1_0: 779_878_400, PQ2_0: 946_995_200, Q2_0: 1_002_700_800 },
    file: { PTQ1_0: 949_549_920, PQ2_0: 1_146_465_120, Q2_0: 1_212_103_520 },
    mmproj: 366_894_624,
  },
  "9B": {
    params: 8_953_803_264,
    embdParams: 1_017_118_720,
    tied: false,
    header: 11_039_616,
    f32: 29_411_328,
    embd: { PTQ1_0: 222_494_720, PQ2_0: 270_172_160, Q2_0: 286_064_640 },
    head: { PTQ1_0: 222_494_720, PQ2_0: 270_172_160, Q2_0: 286_064_640 },
    blocks: { PTQ1_0: 1_512_046_592, PQ2_0: 1_836_056_576, Q2_0: 1_944_059_904 },
    file: { PTQ1_0: 1_997_486_976, PQ2_0: 2_416_851_840, Q2_0: 2_556_640_128 },
    mmproj: 624_229_664,
  },
}

const BPW: Record<Pack, string> = { PTQ1_0: "1.75", PQ2_0: "2.125", Q2_0: "2.25" }

const C_BLOCKS = "oklch(0.58 0.16 150)"
const C_EMBD = "oklch(0.7 0.13 95)"
const C_HEAD = "oklch(0.64 0.14 60)"
const C_F32 = "oklch(0.6 0.2 25)"
const C_HDR = "oklch(0.62 0.03 260)"
const C_VIS = "oklch(0.55 0.1 280)"
const C_BF16 = "oklch(0.75 0.02 260)"

function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
            value === o
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function ByteBudget() {
  const [size, setSize] = useState<Size>("2B")
  const [pack, setPack] = useState<Pack>("PTQ1_0")
  const [unit, setUnit] = useState<"GB" | "GiB">("GB")
  const [vision, setVision] = useState(false)

  const m = MODELS[size]
  const bf16 = m.params * 2
  const div = unit === "GB" ? 1e9 : 1024 ** 3
  const fmt = (b: number) => `${(b / div).toFixed(b / div < 1 ? 3 : 2)} ${unit}`

  const segs = [
    { id: "blocks", label: "Transformer blocks (ternary)", color: C_BLOCKS, bytes: m.blocks[pack] },
    {
      id: "embd",
      label: m.tied ? "Embedding = LM head, tied (ternary)" : "Token embedding (ternary)",
      color: C_EMBD,
      bytes: m.embd[pack],
    },
    ...(m.tied ? [] : [{ id: "head", label: "LM head (ternary)", color: C_HEAD, bytes: m.head[pack] }]),
    { id: "f32", label: "F32: norms + linear-attention state path", color: C_F32, bytes: m.f32 },
    { id: "hdr", label: "GGUF header (tokenizer, Hadamard signs)", color: C_HDR, bytes: m.header },
    ...(vision ? [{ id: "vis", label: "Vision tower (mmproj Q8_0, separate file)", color: C_VIS, bytes: m.mmproj }] : []),
  ]
  const total = segs.reduce((s, x) => s + x.bytes, 0)
  const scale = Math.max(bf16, total)
  const embShare = ((m.tied ? m.embdParams : 2 * m.embdParams) / m.params) * 100
  // Bytes a decode step streams: every matrix except the embedding table,
  // which is only gathered one row at a time (when it is not also the head).
  const perToken = m.file[pack] - m.header - (m.tied ? 0 : m.embd[pack])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">byte budget · Ternary Bonsai 2 small GGUFs</span>
        <Toggle options={["GB", "GiB"] as const} value={unit} onChange={setUnit} label="unit" />
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Toggle options={["2B", "4B", "9B"] as const} value={size} onChange={setSize} label="model size" />
          <Toggle options={["PTQ1_0", "PQ2_0", "Q2_0"] as const} value={pack} onChange={setPack} label="packing" />
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} />
            add vision tower
          </label>
        </div>

        <div className="space-y-2">
          <div className="font-mono text-[11px] text-muted-foreground">
            ternary {pack} ({BPW[pack]} bits per ternary weight){vision ? " + mmproj" : ""}: {fmt(total)}
          </div>
          <div
            className="flex h-8 overflow-hidden rounded-md"
            style={{ width: `${(total / scale) * 100}%`, minWidth: "4px" }}
            role="img"
            aria-label={segs.map((s) => `${s.label}: ${fmt(s.bytes)}`).join(", ")}
          >
            {segs.map((s) => (
              <div
                key={s.id}
                className="h-full transition-all duration-300"
                style={{ width: `${(s.bytes / total) * 100}%`, background: s.color }}
                title={`${s.label}: ${fmt(s.bytes)}`}
              />
            ))}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            same language model in BF16: {fmt(bf16)}
          </div>
          <div className="h-8 rounded-md" style={{ width: `${(bf16 / scale) * 100}%`, background: C_BF16 }} />
        </div>

        <dl className="space-y-1.5">
          {segs.map((s) => (
            <div key={s.id} className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs">
              <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <dt className="text-foreground">{s.label}</dt>
              <dd className="text-muted-foreground">
                {fmt(s.bytes)} · {((s.bytes / total) * 100).toFixed(1)}%
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">BF16 / this</div>
            <div className="text-base text-foreground">{(bf16 / total).toFixed(2)}x</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">embedding share of params</div>
            <div className="text-base text-foreground">{embShare.toFixed(1)}%</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">streamed per decoded token</div>
            <div className="text-base text-foreground">{fmt(perToken)}</div>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {vision ? (
            <>
              With the vision tower the ratio falls to {(bf16 / total).toFixed(2)}x: PrismML&apos;s
              headline sizes and their BF16 baselines both count the language model only. The tower is
              a separate file, loaded only when an image arrives.
            </>
          ) : m.tied ? (
            <>
              At {size} the embedding table is also the output head, so it is{" "}
              {embShare.toFixed(1)}% of the parameters and is read in full on every token. That is why
              the small models land at more bits per weight than the 27B: the vocabulary does not
              shrink with the model.
            </>
          ) : (
            <>
              The 9B unties its embedding and head: two {fmt(m.embd[pack])} tables. Decoding reads the
              head in full but only one row of the embedding, so a token streams{" "}
              {fmt(perToken)}, not the whole {fmt(m.file[pack])} file.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
