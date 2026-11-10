"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One knob, three regimes. Block size comes from the released code
// (model/transformer.py): bias-free attention c_attn (d x 3d) + c_proj (d x d),
// and a SwiGLU whose hidden width is int(8d/3) rounded up to a multiple of 256,
// gate_up (d x 2h) + down (h x d). Norm weights and the router are ignored
// (well under 1% of a block). Presets are the paper's runs as the shell scripts
// launch them (shells/*.sh); "paper" values are quoted where the text differs.

type Preset = { id: string; label: string; d: number; L: number; D: number; pre: number; note: string }

const PRESETS: Preset[] = [
  { id: "h2", label: "vs Huginn, L=2", d: 1024, L: 2, D: 16, pre: 4, note: "shells/lol_vs_huginn.sh. Paper Figure 5 puts this at about 128M non-embedding parameters." },
  { id: "h8", label: "vs Huginn, L=8", d: 1024, L: 8, D: 16, pre: 4, note: "shells/lol_vs_huginn.sh. Paper Figure 5: about 206M non-embedding parameters." },
  { id: "moe", label: "vs MoE, L=24", d: 1024, L: 24, D: 16, pre: 4, note: "shells/lol_vs_moe.sh: 24 experts over 16 routed depths. Its prelude and coda are themselves MoE layers, which this count ignores." },
  { id: "math", label: "1B math, L=8", d: 2048, L: 8, D: 8, pre: 4, note: "shells/math.sh: n_embd 2048, 8 experts, depth 8, 4 + 4 fixed layers. Library size equals depth." },
  { id: "sud", label: "sudoku, L=16", d: 512, L: 16, D: 16, pre: 4, note: "shells/sudoku.sh: n_embd 512, 16 experts, depth 16. The paper calls these 360M models; at width 512 the blocks come to far less." },
]

function blockParams(d: number) {
  const h = 256 * Math.ceil(Math.floor((8 * d) / 3) / 256)
  return 4 * d * d + 3 * d * h
}

const fmt = (x: number) => (x >= 1e9 ? `${(x / 1e9).toFixed(2)}B` : `${(x / 1e6).toFixed(1)}M`)

export function LibraryDial() {
  const [pid, setPid] = useState("h8")
  const base = PRESETS.find((p) => p.id === pid) ?? PRESETS[1]
  const [L, setL] = useState(base.L)

  const bp = blockParams(base.d)
  const fixed = 2 * base.pre * bp
  const stored = fixed + L * bp
  const active = fixed + base.D * bp
  const regime = L < base.D ? "reuse (looped side)" : L === base.D ? "dense-sized" : "sparse (MoE side)"
  const minUnused = Math.max(0, L - base.D)
  const minRepeats = Math.max(0, base.D - L)
  const ratio = active / stored

  const barMax = fixed + 32 * bp
  const pct = (x: number) => `${Math.min(100, (100 * x) / barMax).toFixed(1)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">library size dial · released configs</span>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" aria-pressed={pid === p.id}
              onClick={() => { setPid(p.id); setL(p.L) }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                pid === p.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 px-4 py-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{base.note}</p>
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs">
            <span>library size L (core depth D = {base.D} fixed)</span>
            <span className="text-base font-semibold">{L}</span>
          </span>
          <Range min={1} max={32} step={1} value={L} onChange={(e) => setL(Number(e.target.value))} />
        </label>

        <div className="space-y-2 font-mono text-xs">
          <div>
            <div className="flex justify-between text-muted-foreground"><span>stored block parameters</span><span>{fmt(stored)}</span></div>
            <div className="h-3 rounded bg-muted/40"><div className="h-3 rounded" style={{ width: pct(stored), background: "oklch(0.7 0.13 230)" }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-muted-foreground"><span>parameters run per token</span><span>{fmt(active)}</span></div>
            <div className="h-3 rounded bg-muted/40"><div className="h-3 rounded" style={{ width: pct(active), background: "oklch(0.75 0.15 60)" }} /></div>
          </div>
        </div>

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-lg border px-3 py-2"><div className="text-muted-foreground">regime</div><div className="font-semibold">{regime}</div></div>
          <div className="rounded-lg border px-3 py-2"><div className="text-muted-foreground">run / stored</div><div className="text-base font-semibold">{ratio.toFixed(2)}</div></div>
          <div className="rounded-lg border px-3 py-2"><div className="text-muted-foreground">experts idle, at least</div><div className="text-base font-semibold">{minUnused}</div></div>
          <div className="rounded-lg border px-3 py-2"><div className="text-muted-foreground">repeat visits, at least</div><div className="text-base font-semibold">{minRepeats}</div></div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          One block at width {base.d} is {fmt(bp)} parameters; the {2 * base.pre} fixed prelude and coda layers add {fmt(fixed)}.
          Embeddings are left out. Compute per token depends only on D, so the dial moves the stored side and leaves the run
          side where it is. &quot;At least&quot; because the router may repeat an expert even when it has spares.
        </p>
      </div>
    </figure>
  )
}
