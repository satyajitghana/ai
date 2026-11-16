"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

// Small TTS models on one log axis. Every number is from a primary file:
//   - tiny-voca: model card table (4,537,291 parameters by component), tiny-voca.pt 18.2 MB fp32.
//   - Kitten TTS 2 Mini: safetensors header of kitten_tts_2_mini.safetensors (81,763,410 elements,
//     grouped by top-level module), kitten_tts_2_mini.onnx 82,711,386 bytes (int8 weights).
//   - Kitten TTS 2 Nano / Pico: their model cards (17M / 7.2M per language, 17.4 / 8.0 MB int8).
//   - Paradee: the site's Paradee article (8.07M, released int8 ONNX about 9 MB).
//   - Kokoro-82M: 81.8M as in the Paradee article; kokoro-v1_0.pth 327,212,226 bytes (Hub listing).
//   - TontaubeV1.1: four safetensors headers of TontaubeAI/TontaubeV1.1 (2,899,197,954 elements),
//     the int4 repository's files summed (1,793,973,074 bytes), plus what the inference server pulls
//     on first start (amphion/dualcodec 336 MB, facebook/w2v-bert-2.0 2,322 MB, VibeVoice-1.5B
//     shards 3,433 MB), about 7.9 GB in all.
//   - x real time: measured on beast2 (Intel i7-6850K, 6 cores) over the article's five texts, end to
//     end from text: tiny-voca PyTorch 4 threads, Kitten int8 ONNX 6 threads, Tontaube lite CPU 6
//     threads. The other models were not run, so they have no bar on that tab.

type Part = { label: string; n: number }
type Row = {
  id: string
  name: string
  params: number
  bytes: number
  fmt: string
  extraBytes?: number
  extraNote?: string
  hl?: boolean
  xrt?: number
  parts?: Part[]
  partsNote?: string
}

const ROWS: Row[] = [
  {
    id: "tinyvoca",
    name: "tiny-voca",
    params: 4_537_291,
    bytes: 18.2e6,
    fmt: "fp32 .pt",
    hl: true,
    xrt: 104.6,
    parts: [
      { label: "frame transformer B", n: 1_985_984 },
      { label: "text encoder", n: 1_588_864 },
      { label: "frame transformer A + prosody head", n: 795_971 },
      { label: "duration and pause predictor", n: 123_906 },
      { label: "source-filter waveform head", n: 25_862 },
      { label: "embeddings", n: 16_704 },
    ],
    partsNote: "The waveform generator is 25,862 parameters: a pulse train and a noise signal shaped by predicted filters, not a neural vocoder.",
  },
  { id: "pico", name: "Kitten TTS 2 Pico", params: 7.2e6, bytes: 8.0e6, fmt: "int8 ONNX, per language" },
  { id: "paradee", name: "Paradee", params: 8.07e6, bytes: 9.0e6, fmt: "int8 ONNX" },
  { id: "nano", name: "Kitten TTS 2 Nano", params: 17e6, bytes: 17.4e6, fmt: "int8 ONNX, per language" },
  { id: "kokoro", name: "Kokoro-82M", params: 81.8e6, bytes: 327.2e6, fmt: "fp32 .pth" },
  {
    id: "mini",
    name: "Kitten TTS 2 Mini",
    params: 81_763_410,
    bytes: 82_711_386,
    fmt: "int8 ONNX",
    hl: true,
    xrt: 3.3,
    parts: [
      { label: "ISTFTNet decoder (vocoder)", n: 53_276_190 },
      { label: "prosody predictor", n: 16_194_612 },
      { label: "PL-BERT (ALBERT, shared layers)", n: 6_686_208 },
      { label: "text encoder", n: 5_606_400 },
    ],
    partsNote: "Kokoro-82M's hyperparameters exactly. Two thirds of the model is the vocoder that turns features into a waveform.",
  },
  {
    id: "tontaube",
    name: "TontaubeV1.1-int4",
    params: 2_899_197_954,
    bytes: 1_793_973_074,
    fmt: "int4 GPTQ + int8 / bf16",
    xrt: 0.45,
    extraBytes: 7.885e9,
    extraNote: "with DualCodec, w2v-BERT 2.0 and VibeVoice, fetched on first start",
    hl: true,
    parts: [
      { label: "transformer layers (four predictors)", n: 1_849_874_432 },
      { label: "input embeddings", n: 910_853_120 },
      { label: "audio heads", n: 138_465_282 },
    ],
    partsNote: "Nearly a third is embedding table inherited from Qwen3. The V1 report says 681M of those rows are unreachable by its input scheme.",
  },
]

type Metric = "params" | "bytes" | "bpp" | "xrt"
const METRICS: { id: Metric; label: string; lo: number; hi: number; log: boolean }[] = [
  { id: "params", label: "parameters", lo: 1e6, hi: 1e10, log: true },
  { id: "bytes", label: "bytes as shipped", lo: 1e6, hi: 1e10, log: true },
  { id: "bpp", label: "bytes per parameter", lo: 0, hi: 4.5, log: false },
  { id: "xrt", label: "x real time, measured", lo: 0.1, hi: 1000, log: true },
]

const fmtCount = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M` : `${(n / 1e3).toFixed(1)}k`
const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`)

const ACCENT = "oklch(0.64 0.15 35)"
const GREY = "oklch(0.62 0.03 250)"

function pos(v: number, lo: number, hi: number, log: boolean) {
  const t = log ? (mlog10(v) - mlog10(lo)) / (mlog10(hi) - mlog10(lo)) : (v - lo) / (hi - lo)
  return Math.max(0, Math.min(100, t * 100))
}

export function SizeLadder() {
  const [m, setM] = useState<Metric>("params")
  const [open, setOpen] = useState<string>("mini")
  const meta = METRICS.find((x) => x.id === m) ?? METRICS[0]
  const val = (r: Row) =>
    m === "params" ? r.params : m === "bytes" ? r.bytes : m === "xrt" ? (r.xrt ?? 0) : r.bytes / r.params
  const sel = ROWS.find((r) => r.id === open)

  const ticks =
    meta.id === "bpp"
      ? [0, 1, 2, 4].map((v) => ({ v, label: `${v} B` }))
      : meta.id === "xrt"
        ? [0.1, 1, 10, 100, 1000].map((v) => ({ v, label: `${v}x` }))
        : [1e6, 1e7, 1e8, 1e9, 1e10].map((v) => ({
          v,
          label: meta.id === "params" ? fmtCount(v).replace(".00", "").replace(".0", "") : fmtBytes(v).replace(".00", "").replace(".0", ""),
        }))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        {METRICS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setM(x.id)}
            aria-pressed={m === x.id}
            className={`rounded-md border px-2 py-0.5 ${m === x.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {x.label}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">{meta.log ? "log scale" : "linear scale"}</span>
      </div>

      <div className="space-y-1.5 p-3 sm:p-4">
        {ROWS.map((r) => {
          const v = val(r)
          const missing = m === "xrt" && !r.xrt
          const p = missing ? 0 : pos(v, meta.lo, meta.hi, meta.log)
          const pe = m === "bytes" && r.extraBytes ? pos(r.extraBytes, meta.lo, meta.hi, true) : 0
          const label = missing
            ? "not run"
            : m === "params"
              ? fmtCount(v)
              : m === "bytes"
                ? fmtBytes(v)
                : m === "xrt"
                  ? `${v}x`
                  : `${v.toFixed(2)} B`
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => r.parts && setOpen(r.id)}
              aria-pressed={open === r.id}
              className={`grid w-full grid-cols-[8.5rem_1fr] items-center gap-2 rounded-md px-1 py-0.5 text-left sm:grid-cols-[11rem_1fr] ${r.parts ? "hover:bg-muted/40" : "cursor-default"} ${open === r.id ? "bg-muted/50" : ""}`}
            >
              <span className="min-w-0">
                <span className={`block truncate text-[13px] ${r.hl ? "font-medium" : ""}`}>{r.name}</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">{r.fmt}</span>
              </span>
              <span className="relative flex h-5 items-center">
                {pe > 0 && (
                  <span
                    className="absolute left-0 h-3 rounded-sm"
                    style={{ width: `${pe.toFixed(2)}%`, border: `1px dashed ${ACCENT}`, opacity: 0.7 }}
                  />
                )}
                {!missing && (
                  <span
                    className="relative block h-3 rounded-sm"
                    style={{ width: `${p.toFixed(2)}%`, minWidth: 2, background: r.hl ? ACCENT : GREY }}
                  />
                )}
                <span className="relative ml-2 shrink-0 font-mono text-[11px]">{label}</span>
              </span>
            </button>
          )
        })}

        <div className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[11rem_1fr]">
          <span />
          <span className="relative h-4 font-mono text-[9px] text-muted-foreground">
            {ticks.map((t) => (
              <span
                key={t.v}
                className="absolute -translate-x-1/2"
                style={{ left: `${pos(t.v || meta.lo, meta.lo, meta.hi, meta.log).toFixed(2)}%` }}
              >
                {t.label}
              </span>
            ))}
          </span>
        </div>

        {m === "xrt" && (
          <p className="font-mono text-[10px] text-muted-foreground">
            Measured on one Intel i7-6850K (6 cores), end to end from text over five texts: tiny-voca on 4 threads,
            Kitten and Tontaube on 6. Real time is 1x. The other rows were not run on this machine.
          </p>
        )}
        {m === "bytes" && (
          <p className="font-mono text-[10px] text-muted-foreground">
            Dashed: TontaubeV1.1-int4 {ROWS[6].extraNote}, about 7.9 GB.
          </p>
        )}

        {sel?.parts && (
          <div className="mt-3 rounded-lg border p-3">
            <div className="mb-2 font-mono text-[11px] text-muted-foreground">
              where {sel.name}&apos;s {fmtCount(sel.params)} parameters sit (click a highlighted row to switch)
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-sm">
              {sel.parts.map((pt, i) => (
                <span
                  key={pt.label}
                  title={`${pt.label}: ${pt.n.toLocaleString("en-US")}`}
                  style={{
                    width: `${((pt.n / sel.params) * 100).toFixed(3)}%`,
                    background: ACCENT,
                    opacity: 1 - i * 0.14,
                  }}
                />
              ))}
            </div>
            <ul className="mt-2 grid gap-x-4 gap-y-0.5 font-mono text-[11px] sm:grid-cols-2">
              {sel.parts.map((pt) => (
                <li key={pt.label} className="flex justify-between gap-2">
                  <span className="truncate">{pt.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {pt.n.toLocaleString("en-US")} ({((pt.n / sel.params) * 100).toFixed(1)}%)
                  </span>
                </li>
              ))}
            </ul>
            {sel.partsNote && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{sel.partsNote}</p>}
          </div>
        )}
      </div>
    </figure>
  )
}
