"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A memory planner for Ling-3.1-flash. Every parameter count below is measured
// from the 54 safetensors headers of inclusionAI/Ling-3.1-flash (read by HTTP
// range request, no weights downloaded). Cache sizes come from config.json.
// The per-GPU reserve and the placement rules are reasoned assumptions, said
// so in the UI. Arithmetic is + - * / only, so server and client agree.

const GIB = 1073741824

// measured parameter groups (main model, then the one MTP layer)
const ROUTED = 547608330240 // 68 MoE layers x 512 experts x 3 x 1280 x 4096
const DENSE = 14881652736 // FP8 in the release: KDA + MLA projections, shared experts, 4 dense FFNs
const KEPT = 1456500544 // BF16 in the release: embeddings, lm_head, routers, norms, gates
const MTP_ROUTED = 8053063680
const MTP_DENSE = 85458944
const MTP_KEPT = 35674624

const BITS = { mxfp4: 4.25, fp8: 8 + 32 / 16384, bf16: 16 } as const
type Prec = keyof typeof BITS

// cache geometry from config.json
const MLA_LAYERS = 9 // layers 7, 15, ..., 71
const MLA_ELEMS = 512 + 64 // kv_lora_rank + qk_rope_head_dim, per token per layer
const KDA_STATE = 63 * 64 * 128 * 128 * 4 // 63 layers x 64 heads x 128 x 128, fp32
const KDA_CONV = 63 * 3 * 8192 * 3 * 2 // q/k/v short-conv tails, bf16

const RESERVE_GIB = 6 // reasoned: activations, CUDA graphs, NCCL, allocator slack

const GPUS = [
  { id: "h100", name: "H100 80GB", gib: 80 },
  { id: "h200", name: "H200 141GB", gib: 141 },
  { id: "b200", name: "B200 180GB", gib: 180 },
  { id: "gb300", name: "GB300 288GB", gib: 288 },
] as const

const COUNTS = [1, 2, 4, 8] as const
const CTX = [8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
const SEQS = [1, 2, 4, 8, 16, 32, 64]

function weightBytes(e: Prec, d: Prec, mtp: boolean) {
  let bits = ROUTED * BITS[e] + DENSE * BITS[d] + KEPT * 16
  if (mtp) bits += MTP_ROUTED * BITS[e] + MTP_DENSE * BITS[d] + MTP_KEPT * 16
  return bits / 8
}

function fmtTok(t: number) {
  if (t >= 1048576) return `${(t / 1048576).toFixed(0)}M`
  return `${(t / 1024).toFixed(0)}K`
}

function gib(b: number, digits = 1) {
  return (b / GIB).toFixed(digits)
}

function Seg({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { id: string; name: string }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={
            "rounded-md border px-2 py-0.5 text-xs transition-colors " +
            (value === o.id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/40")
          }
        >
          {o.name}
        </button>
      ))}
    </div>
  )
}

const PREC_E = [
  { id: "mxfp4", name: "MXFP4" },
  { id: "fp8", name: "FP8 block" },
  { id: "bf16", name: "BF16" },
]
const PREC_D = [
  { id: "fp8", name: "FP8 block" },
  { id: "bf16", name: "BF16" },
]
const KV = [
  { id: "bf16", name: "BF16" },
  { id: "fp8", name: "FP8" },
]

export function MemoryPlanner() {
  const [e, setE] = useState<Prec>("mxfp4")
  const [d, setD] = useState<Prec>("fp8")
  const [mtp, setMtp] = useState(true)
  const [kv, setKv] = useState<"bf16" | "fp8">("bf16")
  const [gpu, setGpu] = useState<(typeof GPUS)[number]["id"]>("h100")
  const [n, setN] = useState<number>(4)
  const [ci, setCi] = useState(4)
  const [si, setSi] = useState(0)

  const g = GPUS.find((x) => x.id === gpu) ?? GPUS[0]
  const ctx = CTX[ci]
  const seqs = SEQS[si]
  const mlaLayers = MLA_LAYERS + (mtp ? 1 : 0)
  const kvPerTok = MLA_ELEMS * (kv === "bf16" ? 2 : 1) * mlaLayers

  const w = weightBytes(e, d, mtp)
  const wPer = w / n
  // MLA's latent is shared by all heads, so plain tensor parallelism keeps a full copy on every GPU.
  const kvPer = kvPerTok * ctx * seqs
  // KDA heads are split across GPUs, so the recurrent state is too.
  const statePer = ((KDA_STATE + KDA_CONV) * seqs) / n
  const reserve = RESERVE_GIB * GIB
  const cap = g.gib * GIB
  const used = wPer + kvPer + statePer + reserve
  const fits = used <= cap
  const free = cap - wPer - statePer - reserve
  const maxTok = free > 0 ? free / (kvPerTok * seqs) : 0

  const scale = Math.max(cap, used)
  const pct = (b: number) => `${((b / scale) * 100).toFixed(2)}%`

  const segs = [
    { k: "w", label: "weights", b: wPer, cls: "bg-primary/70" },
    { k: "kv", label: "MLA cache", b: kvPer, cls: "bg-amber-500/70" },
    { k: "st", label: "KDA state", b: statePer, cls: "bg-emerald-500/70" },
    { k: "r", label: "reserve", b: reserve, cls: "bg-muted-foreground/30" },
  ]

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="space-y-2">
        <Seg label="Routed experts" value={e} onChange={(v) => setE(v as Prec)} options={PREC_E} />
        <Seg label="Everything else" value={d} onChange={(v) => setD(v as Prec)} options={PREC_D} />
        <Seg label="MLA cache" value={kv} onChange={(v) => setKv(v as "bf16" | "fp8")} options={KV} />
        <Seg
          label="MTP layer"
          value={mtp ? "on" : "off"}
          onChange={(v) => setMtp(v === "on")}
          options={[
            { id: "on", name: "loaded" },
            { id: "off", name: "dropped" },
          ]}
        />
        <Seg label="GPU" value={gpu} onChange={(v) => setGpu(v as typeof gpu)} options={GPUS} />
        <Seg
          label="GPU count"
          value={String(n)}
          onChange={(v) => setN(Number(v))}
          options={COUNTS.map((c) => ({ id: String(c), name: `${c}x` }))}
        />
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="w-28 shrink-0">Context / seq</span>
          <Range min={0} max={CTX.length - 1} step={1} value={ci} onChange={(ev) => setCi(Number(ev.target.value))} className="min-w-0 flex-1" aria-label="Context length per sequence" />
          <span className="w-12 text-right font-mono text-foreground">{fmtTok(ctx)}</span>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="w-28 shrink-0">Sequences</span>
          <Range min={0} max={SEQS.length - 1} step={1} value={si} onChange={(ev) => setSi(Number(ev.target.value))} className="min-w-0 flex-1" aria-label="Concurrent sequences" />
          <span className="w-12 text-right font-mono text-foreground">{seqs}</span>
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">One GPU of {n}</span>
          <span className={fits ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-red-600 dark:text-red-400"}>
            {fits ? "fits" : "does not fit"}: {gib(used)} of {g.gib} GiB
          </span>
        </div>
        <div className="relative h-7 w-full overflow-hidden rounded-md border bg-background">
          <div className="flex h-full">
            {segs.map((s) => (
              <div key={s.k} className={s.cls} style={{ width: pct(s.b) }} title={`${s.label}: ${gib(s.b, 2)} GiB`} />
            ))}
          </div>
          <div className="absolute inset-y-0 border-r-2 border-dashed border-foreground/70" style={{ left: pct(cap) }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {segs.map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.cls}`} />
              {s.label} {gib(s.b, 2)} GiB
            </span>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">All weights</dt>
          <dd className="font-mono">{gib(w)} GiB</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">MLA cache per token</dt>
          <dd className="font-mono">{kvPerTok.toLocaleString("en-US")} B</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">KDA state per sequence</dt>
          <dd className="font-mono">{((KDA_STATE + KDA_CONV) / 1048576).toFixed(0)} MiB, any length</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Tokens that fit per sequence</dt>
          <dd className="font-mono">{maxTok >= 1024 ? fmtTok(maxTok) : maxTok > 0 ? Math.floor(maxTok).toString() : "none"}</dd>
        </div>
      </dl>

      <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Parameter groups measured from the release&apos;s safetensors headers; cache sizes from <code>config.json</code>.
        Reasoned assumptions: weights split evenly across GPUs; the MLA latent cache copied to every GPU (plain tensor
        parallelism, no DP attention); KDA state in fp32 and split by head; a flat {RESERVE_GIB} GiB per GPU for
        activations, CUDA graphs and communication buffers. GPU sizes are nominal. Model positions past the shipped
        config&apos;s 262,144 are allowed here only to show the memory; see the article on context.
      </figcaption>
    </figure>
  )
}
