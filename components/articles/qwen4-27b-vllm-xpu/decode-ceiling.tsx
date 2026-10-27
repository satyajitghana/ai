"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What the leaked shapes cost to serve, as arithmetic and nothing else.
//
// Shapes are Qwen3.8-27B's config.json (the PR text is consistent with them but
// does not state them): 64 layers, 16 of them full attention, 4 KV heads of
// width 256, hidden 5,120, vocabulary 248,320. The decoder's linear layers hold
// 24.35 billion parameters and the LM head 1.27 billion. Every figure here is
// reasoned. A real card is slower than this ceiling: it ignores the KV read of
// the GDN layers, activations, kernel launch gaps and all-reduce time.

const DEC = 24_350_556_160 // decoder linear parameters
const VOCAB_PARAMS = 1_271_398_400 // 248,320 x 5,120: embedding table, and again the LM head
const KV_PER_TOKEN = 65_536 // bytes in bf16: 16 layers x 2 x 4 heads x 256 x 2
const GDN_STATE = 150_994_944 // bytes per sequence, fp32
const IDX_PER_TOKEN = 1024 // compressed index keys, bytes per context token: 16 layers x 128 x 2 / ratio 4
const BUDGET = 2051 // 2,048 selected tokens plus a tail of up to 3

type Fmt = { id: string; label: string; bits: number }
const FORMATS: Fmt[] = [
  { id: "int4", label: "INT4, group 128", bits: 4.125 },
  { id: "fp8", label: "FP8", bits: 8 },
  { id: "bf16", label: "BF16", bits: 16 },
]

const GB = 1e9
const GIB = 1024 * 1024 * 1024
const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1)
const f0 = (x: number) => Math.round(x).toLocaleString("en-US")

const CTXS = [8192, 32768, 65536, 131072, 262144]

export function DecodeCeiling() {
  const [fmt, setFmt] = useState("int4")
  const [cards, setCards] = useState(1)
  const [mem, setMem] = useState(24)
  const [bw, setBw] = useState(456)
  const [ci, setCi] = useState(2)
  const [kv8, setKv8] = useState(false)
  const [sparse, setSparse] = useState(true)
  const [acc10, setAcc10] = useState(33)

  const bits = FORMATS.find((f) => f.id === fmt)?.bits ?? 4.125
  const ctx = CTXS[ci]
  const acc = acc10 / 10

  const decBytes = (DEC * bits) / 8
  const headBytes = VOCAB_PARAMS * 2 // the LM head stays bf16 here
  const embBytes = VOCAB_PARAMS * 2
  const resident = decBytes + headBytes + embBytes
  const streamed = decBytes + headBytes

  const kvTok = kv8 ? KV_PER_TOKEN / 2 : KV_PER_TOKEN
  const kvTotal = kvTok * ctx
  const kvRead = sparse ? kvTok * Math.min(ctx, BUDGET) + IDX_PER_TOKEN * ctx : kvTok * ctx

  const perCardResident = resident / cards + kvTotal / cards + GDN_STATE
  const fits = perCardResident / GB <= mem
  const stepBytes = (streamed + kvRead) / cards
  const stepsPerS = (bw * GB) / stepBytes
  const plain = stepsPerS
  const spec = stepsPerS * acc

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFmt(f.id)}
            className={cn(
              "rounded-md border px-2 py-1",
              fmt === f.id ? "border-foreground bg-muted" : "border-border",
            )}
          >
            {f.label}
          </button>
        ))}
        {[1, 2].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCards(n)}
            className={cn(
              "rounded-md border px-2 py-1",
              cards === n ? "border-foreground bg-muted" : "border-border",
            )}
          >
            {n} card{n > 1 ? "s (TP2)" : ""}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setKv8(!kv8)}
          className={cn("rounded-md border px-2 py-1", kv8 ? "border-foreground bg-muted" : "border-border")}
        >
          KV in FP8
        </button>
        <button
          type="button"
          onClick={() => setSparse(!sparse)}
          className={cn("rounded-md border px-2 py-1", sparse ? "border-foreground bg-muted" : "border-border")}
        >
          {sparse ? "Sparse read: QSA" : "Sparse read: off"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <label className="flex items-center gap-3">
          <span className="w-36 shrink-0">Context: {f0(ctx)}</span>
          <Range min={0} max={4} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} aria-label="Context length" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-36 shrink-0">Bandwidth: {bw} GB/s</span>
          <Range min={200} max={1000} step={8} value={bw} onChange={(e) => setBw(Number(e.target.value))} aria-label="Memory bandwidth per card" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-36 shrink-0">Card memory: {mem} GB</span>
          <Range min={8} max={48} step={4} value={mem} onChange={(e) => setMem(Number(e.target.value))} aria-label="Memory per card" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-36 shrink-0">Tokens per step: {f1(acc)}</span>
          <Range min={10} max={50} step={1} value={acc10} onChange={(e) => setAcc10(Number(e.target.value))} aria-label="Accepted tokens per verify step" />
        </label>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Weights on disk, all cards</dt>
          <dd className="font-mono">{f1(resident / GB)} GB</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">KV cache, one sequence</dt>
          <dd className="font-mono">{f1(kvTotal / GIB)} GiB</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Per card, all resident</dt>
          <dd className={cn("font-mono", fits ? "" : "text-red-600 dark:text-red-400")}>
            {f1(perCardResident / GB)} GB {fits ? "fits" : "does not fit"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">KV read per step</dt>
          <dd className="font-mono">{f1(kvRead / cards / GB)} GB</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Ceiling, no speculation</div>
          <div className="font-mono text-2xl">{f1(plain)} tok/s</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Ceiling with MTP at {f1(acc)} tokens per step</div>
          <div className="font-mono text-2xl">{f1(spec)} tok/s</div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Reasoned. A step streams the decoder weights and the LM head once ({f1(streamed / cards / GB)} GB per card)
        plus the KV it reads (with QSA, the selected tokens plus the compressed index keys), so time per step is that many bytes over the card&apos;s bandwidth. Four drafts verify five
        positions in one such step, so the tokens-per-step slider tops out at 5. The default 3.3 is the accept length
        reported for Flash-Next, not measured for this model. The default bandwidth is the 456 GB/s published for
        Intel&apos;s Arc B-series cards; it was not re-checked here.
      </figcaption>
    </figure>
  )
}
