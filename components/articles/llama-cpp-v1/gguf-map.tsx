"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The byte map of one real GGUF file: bartowski/Llama-3.2-1B-Instruct-GGUF,
// Llama-3.2-1B-Instruct-Q4_K_M.gguf (807,694,464 bytes, uploaded September 2024).
// Every number here comes from parsing its first 16 MiB with HTTP range requests:
// the 24-byte fixed header, the 35 key-value pairs (each one's serialized size),
// the 147 tensor-info records and the data offsets they give. Tensor byte sizes
// are the gaps between consecutive offsets, and they agree with
//   rows * (ne0 / block_size) * type_size
// for the block sizes in ggml/src/ggml-common.h. GGUF stores ne0 (the fastest
// dimension) first, so a weight shaped [2048, 8192] has 8192 rows of 2048.

const FILE = 807_694_464
const DATA_START = 7_831_552

type Seg = { key: string; label: string; bytes: number; tone: string; note: string }

const HEADER: Seg[] = [
  { key: "fixed", label: "magic, version, counts", bytes: 24, tone: "bg-zinc-500", note: "\"GGUF\", version 3 (uint32), 147 tensors and 35 key-value pairs (two int64)." },
  { key: "tokens", label: "tokenizer.ggml.tokens", bytes: 2_099_497, tone: "bg-sky-500/80", note: "An array of 128,256 strings, each a uint64 length and its bytes." },
  { key: "ttype", label: "tokenizer.ggml.token_type", bytes: 513_073, tone: "bg-sky-300/80", note: "128,256 int32 token types, 4 bytes each plus the array header." },
  { key: "merges", label: "tokenizer.ggml.merges", bytes: 5_204_810, tone: "bg-indigo-500/80", note: "280,147 BPE merge rules as strings: two thirds of the whole header." },
  { key: "tmpl", label: "tokenizer.chat_template", bytes: 3_870, tone: "bg-amber-500/80", note: "The Jinja chat template, one string." },
  { key: "kv", label: "the other 31 keys", bytes: 1_577, tone: "bg-amber-300/80", note: "general.architecture = llama, llama.block_count = 16, llama.embedding_length = 2048, rope base 500000, imatrix provenance and so on." },
  { key: "tinfo", label: "tensor infos", bytes: 8_674, tone: "bg-violet-500/80", note: "147 records: name, dimension count, dims, type id, offset into the data blob." },
  { key: "pad", label: "padding", bytes: 27, tone: "bg-zinc-300", note: "Zeros up to the next multiple of 32 (general.alignment is absent, so the default 32 applies)." },
]

const DATA: Seg[] = [
  { key: "emb", label: "token_embd (Q6_K)", bytes: 215_470_080, tone: "bg-emerald-600/80", note: "128,256 rows of 2048. There is no output.weight: the model ties its output head to this table." },
  { key: "gu", label: "ffn_gate + ffn_up (Q4_K)", bytes: 301_989_888, tone: "bg-emerald-400/80", note: "32 tensors of 8192 rows by 2048." },
  { key: "down", label: "ffn_down (8 Q6_K, 8 Q4_K)", bytes: 185_597_952, tone: "bg-teal-500/80", note: "Q4_K_M keeps half the layers' ffn_down at Q6_K: 110,100,480 bytes of Q6_K and 75,497,472 of Q4_K." },
  { key: "attn", label: "attn_q, attn_k, attn_output (Q4_K)", bytes: 84_934_656, tone: "bg-lime-500/80", note: "Grouped-query attention: 32 query heads, 8 key-value heads of 64." },
  { key: "v", label: "attn_v (8 Q6_K, 8 Q4_K)", bytes: 11_599_872, tone: "bg-lime-300/80", note: "The same half-and-half rule as ffn_down." },
  { key: "norm", label: "norms + rope_freqs (F32)", bytes: 270_464, tone: "bg-zinc-400", note: "33 RMSNorm weight vectors of 2048 floats and 32 rope frequency factors." },
]

type T = { name: string; ne0: number; rows: number; type: string; off: number }

// [ne0, rows], type id -> name, offset relative to the data blob
const TENSORS: T[] = [
  { name: "token_embd.weight", ne0: 2048, rows: 128256, type: "Q6_K", off: 128 },
  { name: "blk.0.ffn_down.weight", ne0: 8192, rows: 2048, type: "Q6_K", off: 215_478_400 },
  { name: "blk.0.ffn_gate.weight", ne0: 2048, rows: 8192, type: "Q4_K", off: 229_240_960 },
  { name: "blk.0.attn_k.weight", ne0: 2048, rows: 512, type: "Q4_K", off: 248_123_520 },
  { name: "blk.0.attn_v.weight", ne0: 2048, rows: 512, type: "Q6_K", off: 253_431_936 },
  { name: "output_norm.weight", ne0: 2048, rows: 1, type: "F32", off: 799_854_720 },
]

const BLOCK: Record<string, { n: number; bytes: number }> = {
  Q6_K: { n: 256, bytes: 210 },
  Q4_K: { n: 256, bytes: 144 },
  F32: { n: 1, bytes: 4 },
}

const fmt = (n: number) => n.toLocaleString("en-US")
const mb = (n: number) => (n / 1e6).toFixed(n < 1e7 ? 2 : 1)

export function GgufMap() {
  const [zoom, setZoom] = useState(true)
  const [seg, setSeg] = useState<string>("merges")
  const [ti, setTi] = useState(1)
  const [gpu, setGpu] = useState(false)

  const all = [...HEADER, ...DATA]
  const sel = all.find((s) => s.key === seg) ?? HEADER[3]
  const headerBytes = DATA_START
  // zoomed: the header gets half the bar; to scale: its true share
  const headerShare = zoom ? 0.5 : headerBytes / FILE
  const width = (s: Seg, inHeader: boolean) => {
    const pool = inHeader ? headerBytes : FILE - headerBytes
    const share = inHeader ? headerShare : 1 - headerShare
    const w = (s.bytes / pool) * share * 100
    return Math.max(w, zoom && inHeader ? 0.6 : 0)
  }

  const t = TENSORS[ti]
  const b = BLOCK[t.type]
  const size = t.rows * (t.ne0 / b.n) * b.bytes
  const abs = DATA_START + t.off

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Llama-3.2-1B-Instruct-Q4_K_M.gguf, byte by byte · parsed from its first 16 MiB by range request
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="w-20 shrink-0 font-mono text-muted-foreground">scale</span>
          {[
            { v: true, l: "header stretched to half" },
            { v: false, l: "true proportions" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => setZoom(o.v)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                zoom === o.v ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {o.l}
            </button>
          ))}
        </div>

        <div className="flex h-10 w-full overflow-hidden rounded border" role="group" aria-label="File regions">
          {HEADER.map((s) => (
            <button
              key={s.key}
              type="button"
              title={s.label}
              aria-label={`${s.label}, ${fmt(s.bytes)} bytes`}
              onClick={() => setSeg(s.key)}
              style={{ width: `${width(s, true)}%` }}
              className={cn(s.tone, "h-full border-r border-background/60", seg === s.key && "ring-2 ring-inset ring-foreground")}
            />
          ))}
          {DATA.map((s) => (
            <button
              key={s.key}
              type="button"
              title={s.label}
              aria-label={`${s.label}, ${fmt(s.bytes)} bytes`}
              onClick={() => setSeg(s.key)}
              style={{ width: `${width(s, false)}%` }}
              className={cn(s.tone, "h-full border-r border-background/60", seg === s.key && "ring-2 ring-inset ring-foreground")}
            />
          ))}
        </div>
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>byte 0</span>
          <span style={{ marginLeft: `${headerShare * 100 - 10}%` }}>data starts at {fmt(DATA_START)}</span>
          <span>{fmt(FILE)}</span>
        </div>

        <div className="rounded bg-muted/50 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono font-medium">{sel.label}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {fmt(sel.bytes)} bytes · {((sel.bytes / FILE) * 100).toFixed(sel.bytes / FILE < 0.001 ? 4 : 2)}% of the file
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{sel.note}</p>
        </div>
      </div>

      <div className="space-y-3 border-t px-4 py-3 text-xs">
        <div className="font-mono text-muted-foreground">Find one tensor&apos;s bytes</div>
        <div className="flex flex-wrap gap-1.5">
          {TENSORS.map((x, i) => (
            <button
              key={x.name}
              type="button"
              onClick={() => setTi(i)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                ti === i ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {x.name}
            </button>
          ))}
        </div>
        <div className="grid gap-x-6 gap-y-1 font-mono tabular-nums sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">tensor info says </span>
            {t.type}, [{fmt(t.ne0)}, {fmt(t.rows)}], offset {fmt(t.off)}
          </div>
          <div>
            <span className="text-muted-foreground">block </span>
            {b.n} weights in {b.bytes} bytes = {((b.bytes * 8) / b.n).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} bits each
          </div>
          <div>
            <span className="text-muted-foreground">size </span>
            {fmt(t.rows)} × {fmt(t.ne0 / b.n)} × {b.bytes} = {fmt(size)} B ({mb(size)} MB)
          </div>
          <div>
            <span className="text-muted-foreground">file position </span>
            {fmt(DATA_START)} + {fmt(t.off)} = {fmt(abs)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="w-20 shrink-0 font-mono text-muted-foreground">runs on</span>
          {[
            { v: false, l: "CPU with --no-repack (mmap)" },
            { v: true, l: "GPU (-ngl 99)" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => setGpu(o.v)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                gpu === o.v ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono text-[11px]">
          <div className="rounded border px-2 py-1.5">
            <div className="text-muted-foreground">file on disk</div>
            <div>byte {fmt(abs)}</div>
          </div>
          <div className="text-muted-foreground">{gpu ? "read, then copied →" : "mapped →"}</div>
          <div className="rounded border px-2 py-1.5">
            <div className="text-muted-foreground">{gpu ? "VRAM buffer on the GPU" : "page cache, read-only mapping"}</div>
            <div>{gpu ? `${mb(size)} MB uploaded once at load` : `ptr = base + ${fmt(abs)}`}</div>
          </div>
        </div>
        <p className="text-muted-foreground">
          {gpu
            ? "With every layer offloaded, the loader still reads these bytes through the mapping, then copies them into a device buffer. After load, decode never touches the file."
            : "The tensor's data pointer is an address inside one PROT_READ mapping of the whole file, and pages fault in from the page cache the first time a kernel reads them. By default, on AVX2 or recent Arm CPUs, matmul weights in Q4_K, Q6_K and several other types are instead repacked into an interleaved copy in anonymous memory; --no-repack keeps them in the mapping."}
        </p>
      </div>
    </figure>
  )
}
