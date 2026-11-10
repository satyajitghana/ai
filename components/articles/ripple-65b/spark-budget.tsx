"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Ripple-65B Preview on a DGX Spark: does it fit, and how fast can one stream
// decode before the memory bus runs out?
//
// File sizes are measured (Hugging Face API, 2026-11-10):
//   BF16       ricursiveAI/Ripple-65B-Preview, 16 shards       129,565,378,720 B of tensors
//   NVFP4      ricursiveAI/Ripple-65B-Preview-NVFP4 (MLP FP4,  57,213,636,640 B (index total_size)
//              attention, embeddings and head in BF16)
//   Q8_0       AtomicChat/Ripple-65B-Preview-GGUF, 2 parts      68,840,113,568 B
//   Q4_K_M     AtomicChat/Ripple-65B-Preview-GGUF (plain)       38,798,820,576 B
//   draft      ricursiveAI/Ripple-65B-Preview-DFlash2            8,075,513,104 B
//
// Bytes read per decoded token: every weight except the input embedding table
// (one row is gathered). For BF16 and NVFP4 the table is 1,027,604,480 B of
// BF16, read from the safetensors headers. For the GGUFs the table's share is
// taken at the file's average width: 513,802,240 of 64,782,689,360 parameters,
// 0.793% (an estimate). A DFlash2 cycle also reads the draft and the target's
// BF16 output head (1,027,604,480 B), which the draft borrows.
//
// KV cache, from config.json: 16 global layers keep every token, 64 sliding
// layers keep 1,024; 8 KV heads x 128 x (K and V) x 2 bytes = 4,096 B per
// layer per token. Decode reads the whole cache once per pass.
//
// Hardware: DGX Spark 128 GB unified LPDDR5x, 273 GB/s, taken as 128 GiB; two
// B200 at 180 GB and 8 TB/s each (vendor figures). Ceilings are bytes / bandwidth:
// a real engine reaches part of it. Only + - * / and Math.round reach the DOM.

type Ck = { id: string; label: string; gb: number; read: number; note: string }

const EMB_GB = 1.02760448
const GGUF_EMB_SHARE = 513_802_240 / 64_782_689_360

const CKPTS: Ck[] = [
  { id: "bf16", label: "BF16 (official)", gb: 129.56537872, read: 129.56537872 - EMB_GB, note: "measured file, read measured" },
  { id: "q8", label: "Q8_0 GGUF", gb: 68.840113568, read: 68.840113568 * (1 - GGUF_EMB_SHARE), note: "measured file, read estimated" },
  { id: "nvfp4", label: "NVFP4 MLP + BF16 attention (official)", gb: 57.21363664, read: 57.21363664 - EMB_GB, note: "measured file, read measured" },
  { id: "q4", label: "Q4_K_M GGUF", gb: 38.798820576, read: 38.798820576 * (1 - GGUF_EMB_SHARE), note: "measured file, read estimated" },
]

const DRAFT_GB = 8.075513104
const DRAFT_READ = DRAFT_GB + EMB_GB

const GIB = 1.073741824
const HW = [
  { id: "spark", label: "DGX Spark, 128 GB, 273 GB/s", gb: 128 * GIB, bw: 273 },
  { id: "b200", label: "2 x B200, 180 GB each, 8 TB/s each", gb: 360, bw: 16000 },
]

const CTX = [8_192, 32_768, 131_072, 262_144, 1_048_576]
const CTX_LABEL = ["8K", "32K", "128K", "256K", "1M"]
const KV_LAYER_TOKEN = 4096
const WINDOW = 1024

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export function SparkBudget() {
  const [ck, setCk] = useState("nvfp4")
  const [hw, setHw] = useState("spark")
  const [ci, setCi] = useState(2)
  const [reserve, setReserve] = useState(10)
  const [draft, setDraft] = useState(false)
  const [accept, setAccept] = useState(40)

  const c = CKPTS.find((x) => x.id === ck) ?? CKPTS[0]
  const h = HW.find((x) => x.id === hw) ?? HW[0]
  const tokens = CTX[ci]
  const kvGlobal = (tokens * 16 * KV_LAYER_TOKEN) / 1e9
  const kvSliding = (Math.min(tokens, WINDOW) * 64 * KV_LAYER_TOKEN) / 1e9
  const kv = kvGlobal + kvSliding
  const kvAllGlobal = (tokens * 80 * KV_LAYER_TOKEN) / 1e9
  const draftGb = draft ? DRAFT_GB : 0
  const need = c.gb + draftGb + kv
  const usable = h.gb * (1 - reserve / 100)
  const fits = need <= usable
  const scale = Math.max(need, h.gb) * 1.04
  const pct = (n: number) => `${(n / scale) * 100}%`

  const acc = accept / 10
  const perPass = c.read + kv + (draft ? DRAFT_READ : 0)
  const passes = h.bw / perPass
  const tps = draft ? passes * acc : passes

  const parts = [
    { id: "w", label: `weights, ${c.label}`, gb: c.gb, color: "#0d9488" },
    ...(draft ? [{ id: "d", label: "DFlash2 draft, BF16", gb: DRAFT_GB, color: "#6366f1" }] : []),
    { id: "g", label: "KV, 16 global layers", gb: kvGlobal, color: "#d97706" },
    { id: "s", label: "KV, 64 sliding layers", gb: kvSliding, color: "#fbbf24" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Ripple-65B on a desk: fit and decode ceiling</span>
        <span className="font-mono text-[10px] text-muted-foreground">files measured, speed is arithmetic</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>checkpoint</span>
            <select value={ck} onChange={(e) => setCk(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-foreground">
              {CKPTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}, {r2(x.gb)} GB
                </option>
              ))}
            </select>
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span>hardware</span>
            <select value={hw} onChange={(e) => setHw(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-foreground">
              {HW.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>context in the cache</span>
              <span className="text-foreground">
                {CTX_LABEL[ci]} = {tokens.toLocaleString("en-US")} tokens
              </span>
            </span>
            <Range min={0} max={CTX.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} className="mt-1 w-full" aria-label="context length" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>keep free for the OS and runtime</span>
              <span className="text-foreground">{reserve}%</span>
            </span>
            <Range min={0} max={25} step={5} value={reserve} onChange={(e) => setReserve(Number(e.target.value))} className="mt-1 w-full" aria-label="memory to keep free" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
            <span>DFlash2 speculative decoding (+{r2(DRAFT_GB)} GB)</span>
          </label>
          {draft ? (
            <label className="flex min-w-[220px] flex-1 items-center gap-2">
              <span className="shrink-0">tokens kept per pass: {acc}</span>
              <Range min={10} max={100} step={5} value={accept} onChange={(e) => setAccept(Number(e.target.value))} className="w-full" aria-label="accepted tokens per verify pass" />
            </label>
          ) : null}
        </div>

        <div>
          <div className="relative h-9 w-full overflow-hidden rounded-md border bg-background/60" aria-hidden>
            <div className="flex h-full">
              {parts.map((p) => (
                <div key={p.id} style={{ width: pct(p.gb), background: p.color }} title={p.label} />
              ))}
            </div>
            <div className="absolute inset-y-0 border-l-2 border-dashed border-foreground/70" style={{ left: pct(usable) }} />
            <div className="absolute inset-y-0 border-l-2 border-foreground" style={{ left: pct(h.gb) }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>0</span>
            <span>
              dashed: usable {r1(usable)} GB / solid: installed {r1(h.gb)} GB
            </span>
          </div>
          <div className="mt-2 grid gap-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
            {parts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
                  {p.label}
                </span>
                <span className="text-foreground">{r2(p.gb)} GB</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="font-mono text-[10px] text-muted-foreground">memory</div>
            <div className={`font-mono text-lg ${fits ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {fits ? "fits" : "does not fit"}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              needs {r1(need)} of {r1(usable)} GB
            </div>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="font-mono text-[10px] text-muted-foreground">bytes per pass</div>
            <div className="font-mono text-lg text-foreground">{r1(perPass)} GB</div>
            <div className="font-mono text-[10px] text-muted-foreground">{c.note}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="font-mono text-[10px] text-muted-foreground">one-stream ceiling</div>
            <div className="font-mono text-lg text-foreground">{r1(tps)} tok/s</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {draft ? `${r1(passes)} passes/s x ${acc} tokens` : "no speculation, bandwidth only"}
            </div>
          </div>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          A cache with every layer global would hold {r1(kvAllGlobal)} GB at this context, against {r1(kv)} GB here. Reported on one GB10 by a third-party Spark server (NVFP4 + DFlash2, temperature 0): code 20 to 36 tok/s, prose about 9, plain decoding near 5.
        </p>
      </div>
    </figure>
  )
}
