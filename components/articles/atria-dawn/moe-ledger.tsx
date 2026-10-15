"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What one token of Atria Dawn Preview touches, and what the KV cache costs.
//
// Every parameter count is a sum over tensor shapes read from the 353
// safetensors headers of internlm/Atria-Dawn-Preview with HTTP range requests
// (753,329,940,480 parameters stored). The routed-expert size is one expert's
// gate, up and down projections: 3 x 2,048 x 6,144 = 37,748,736. 75 of the 78
// layers are MoE (first_k_dense_replace = 3), 256 routed experts each.
//
// The cache side is arithmetic on config.json: MLA keeps a 512-wide latent plus
// a 64-wide RoPE key per layer per token (576 values), and the 21 layers that
// run their own DSA indexer keep a 128-wide indexer key. BF16 storage assumed.
// Only + - * / and Math.round reach the DOM.

const EXPERT = 37_748_736
const MOE_LAYERS = 75
const ROUTED_EXPERTS = 256
const STORED = 753_329_940_480
const MTP_STORED = 9_952_920_576
const MTP_ACTIVE_K8 = 591_234_048 // MTP layer with 8 of its 256 experts

const FIXED = [
  { id: "attn", label: "MLA attention, 78 layers", n: 12_871_732_224, color: "#0ea5e9" },
  { id: "idx", label: "DSA indexers, 21 layers", n: 196_809_984, color: "#38bdf8" },
  { id: "dense", label: "dense FFN, layers 0-2", n: 679_477_248, color: "#a78bfa" },
  { id: "shared", label: "1 shared expert x 75 layers", n: 2_831_155_200, color: "#c4b5fd" },
  { id: "small", label: "routers, biases, norms", n: 118_948_608, color: "#64748b" },
  { id: "head", label: "output head", n: 951_582_720, color: "#f59e0b" },
]
const EMBED = 951_582_720

const CTX = [32_768, 65_536, 131_072, 262_144, 524_288, 1_048_576]
const CTX_LABEL = ["32K", "64K", "128K", "256K", "512K", "1M"]
const MLA_BYTES = 78 * 576 * 2 // 89,856 bytes per token
const IDX_BYTES = 21 * 128 * 2 // 5,376 bytes per token

const fmt = (n: number) => n.toLocaleString("en-US")
const b2 = (n: number) => Math.round(n / 10_000_000) / 100
const gb = (n: number) => Math.round(n / 10_000_000) / 100

export function MoeLedger() {
  const [k, setK] = useState(8)
  const [embed, setEmbed] = useState(false)
  const [mtp, setMtp] = useState(false)
  const [ci, setCi] = useState(3)

  const routed = MOE_LAYERS * k * EXPERT
  const fixed = FIXED.reduce((a, p) => a + p.n, 0)
  const mtpActive = MTP_ACTIVE_K8 + (k - 8) * EXPERT
  const active = fixed + routed + (embed ? EMBED : 0) + (mtp ? mtpActive : 0)
  const rows = [
    { id: "routed", label: `${k} of ${ROUTED_EXPERTS} routed experts x 75 layers`, n: routed, color: "#7c5cff" },
    ...FIXED,
    ...(embed ? [{ id: "embed", label: "embedding row lookup (counted as the full table)", n: EMBED, color: "#fbbf24" }] : []),
    ...(mtp ? [{ id: "mtp", label: "MTP draft layer", n: mtpActive, color: "#f472b6" }] : []),
  ]
  const tokens = CTX[ci]
  const mla = tokens * MLA_BYTES
  const idx = tokens * IDX_BYTES

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one token through Atria Dawn Preview</span>
        <span className="font-mono text-[10px] text-muted-foreground">counted from 353 safetensors headers</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>routed experts per token (top-k)</span>
              <span className="text-foreground">{k}{k === 8 ? " (shipped)" : ""}</span>
            </span>
            <Range min={1} max={16} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="mt-1 w-full" aria-label="routed experts per token" />
          </label>
          <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={embed} onChange={(e) => setEmbed(e.target.checked)} />
              <span>count the 154,880 x 6,144 embedding table</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={mtp} onChange={(e) => setMtp(e.target.checked)} />
              <span>count the multi-token-prediction layer (speculative drafts)</span>
            </label>
          </div>
        </div>

        <div>
          <div className="flex h-8 w-full overflow-hidden rounded-md border" aria-hidden>
            {rows.map((p) => (
              <div key={p.id} style={{ width: `${(p.n / active) * 100}%`, background: p.color }} title={p.label} />
            ))}
          </div>
          <div className="mt-2 grid gap-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
            {rows.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
                  {p.label}
                </span>
                <span className="text-foreground">{fmt(p.n)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">active per token</div>
            <div className="text-lg text-foreground">{b2(active)}B</div>
            <div className="text-[10px] text-muted-foreground">{fmt(active)}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">stored, idle for this token</div>
            <div className="text-lg text-foreground">{b2(STORED - active)}B</div>
            <div className="text-[10px] text-muted-foreground">{ROUTED_EXPERTS - k} idle experts per MoE layer</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">share of the checkpoint</div>
            <div className="text-lg text-foreground">{Math.round((active / STORED) * 1000) / 10}%</div>
            <div className="text-[10px] text-muted-foreground">of {fmt(STORED)} ({b2(MTP_STORED)}B is MTP)</div>
          </div>
        </div>

        <div className="rounded-lg border bg-background/60 p-3">
          <label className="block font-mono text-[11px] text-muted-foreground">
            <span className="flex justify-between">
              <span>context length</span>
              <span className="text-foreground">{CTX_LABEL[ci]} = {fmt(tokens)} tokens</span>
            </span>
            <Range min={0} max={CTX.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} className="mt-1 w-full" aria-label="context length" />
          </label>
          <div className="mt-3 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">MLA cache (576 values x 78 layers)</div>
              <div className="text-foreground">{gb(mla)} GB</div>
            </div>
            <div>
              <div className="text-muted-foreground">indexer keys (128 x 21 layers)</div>
              <div className="text-foreground">{gb(idx)} GB</div>
            </div>
            <div>
              <div className="text-muted-foreground">keys each query attends to</div>
              <div className="text-foreground">{fmt(Math.min(2048, tokens))} of {fmt(tokens)}</div>
            </div>
          </div>
          <p className="mt-2 font-mono text-[9px] leading-4 text-muted-foreground">
            Per sequence, BF16 cache assumed, MTP layer left out. The card and README serve 256K; config.json allows 1,048,576 positions;
            the launch post says 512K. DSA&rsquo;s top-k is 2,048, so the main attention reads the same number of cached entries at every length
            past 2K, while the indexer still scores all of them in 21 layers.
          </p>
        </div>
      </div>
    </figure>
  )
}
