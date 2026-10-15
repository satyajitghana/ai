"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Where the cost of a minute goes, as arithmetic on SANA-WM's own shapes.
//
// Shapes (measured from the released config.yaml and safetensors header):
//   d_model 2240, 20 heads of 112, 20 blocks, patch 1, 2.664e9 parameters,
//   LTX-2 VAE stride 8 x 32 x 32 at 704 x 1280 -> 22 x 40 = 880 tokens per
//   latent frame; 16 fps -> 2 latent frames per second plus the first frame.
// Cost model (reasoned, not measured):
//   weight GEMMs        2 * P * N            per forward
//   softmax attention   4 * N^2 * d          per softmax layer (QK^T and AV)
//   GDN recurrence      4 * N * d * dh       per GDN layer (state update + read)
//   softmax KV cache    2 * N * d * 2 bytes  per softmax layer, bf16
//   GDN state           heads * dh^2 * 4 B   per GDN layer, fp32, constant
// The streaming release keeps, per softmax layer, the first chunk (4 latent
// frames) plus the previous chunk (3) beside the current one (3):
// --num_cached_blocks 2 with the sink token on. The camera branch's own
// attention is left out of all of this.

const D = 2240
const DH = 112
const HEADS = 20
const P = 2.664e9
const TOK_PER_LF = 880
const WINDOW_LF = 10

const DESIGNS = [
  { id: "soft", label: "all softmax (20)", soft: 20, lin: 0 },
  { id: "hyb", label: "SANA-WM hybrid (5 + 15)", soft: 5, lin: 15 },
  { id: "lin", label: "all GDN (20)", soft: 0, lin: 20 },
] as const

const tokens = (s: number) => TOK_PER_LF * (1 + 2 * s)

function flops(n: number, soft: number, lin: number) {
  const w = 2 * P * n
  const a = soft * 4 * n * n * D + lin * 4 * n * D * DH
  return { w, a }
}

function memBytes(n: number, soft: number, lin: number, windowed: boolean) {
  const nk = windowed ? Math.min(n, TOK_PER_LF * WINDOW_LF) : n
  return soft * 2 * nk * D * 2 + lin * HEADS * DH * DH * 4
}

const fmtF = (v: number) => {
  if (v >= 1e15) return `${(v / 1e15).toFixed(2)} PFLOP`
  return `${(v / 1e12).toFixed(0)} TFLOP`
}
const fmtB = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GB`
  return `${(v / 1e6).toFixed(0)} MB`
}

const W_ = "oklch(0.62 0.03 260)"
const A_ = "oklch(0.66 0.17 135)"
const M_ = "oklch(0.62 0.14 250)"

export function ContextCost() {
  const [s, setS] = useState(60)
  const [windowed, setWindowed] = useState(false)

  const n = tokens(s)
  const rows = DESIGNS.map((d) => {
    const f = flops(n, d.soft, d.lin)
    return { ...d, ...f, total: f.w + f.a, mem: memBytes(n, d.soft, d.lin, windowed) }
  })
  // fixed scales at 60 s so the bars grow as you drag
  const nMax = tokens(60)
  const fMax = 2 * P * nMax + 20 * 4 * nMax * nMax * D
  const mMax = memBytes(nMax, 20, 0, false)
  const hyb = rows[1]
  const share = hyb.a / hyb.total

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what a minute costs, layer type by layer type</span>
        <span className="text-muted-foreground/60">reasoned from the released shapes</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {s} s clip · {1 + 2 * s} latent frames × 880
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {n.toLocaleString("en-US")}
              <span className="ml-1 text-xs font-normal text-muted-foreground">tokens</span>
            </div>
          </div>
          <div className="text-right font-mono text-[11px] text-muted-foreground">
            in the hybrid, the 5 softmax layers are{" "}
            <span className="text-foreground">{(share * 100).toFixed(0)}%</span> of a forward pass
          </div>
        </div>

        <div className="mb-1 font-mono text-[10px] text-muted-foreground">
          compute per denoising forward over the whole clip:{" "}
          <span style={{ color: W_ }}>■ weights</span> <span style={{ color: A_ }}>■ attention / recurrence</span>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_5.5rem] items-center gap-2 font-mono text-[11px]">
              <span className={r.id === "hyb" ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
              <div className="flex h-3 overflow-hidden rounded-sm bg-muted/40">
                <div style={{ width: `${((r.w / fMax) * 100).toFixed(2)}%`, background: W_ }} />
                <div style={{ width: `${((r.a / fMax) * 100).toFixed(2)}%`, background: A_ }} />
              </div>
              <span className="text-right tabular-nums">{fmtF(r.total)}</span>
            </div>
          ))}
        </div>

        <div className="mb-1 mt-5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
          <span>
            what the attention layers carry through an autoregressive rollout: <span style={{ color: M_ }}>■ softmax K/V + GDN state</span>
          </span>
          <span className="flex gap-1">
            {[
              { k: false, l: "full history" },
              { k: true, l: "first chunk + last chunk" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setWindowed(o.k)}
                aria-pressed={windowed === o.k}
                className="cursor-pointer rounded border px-2 py-0.5"
                style={windowed === o.k ? { background: M_, color: "white", borderColor: M_ } : undefined}
              >
                {o.l}
              </button>
            ))}
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_5.5rem] items-center gap-2 font-mono text-[11px]">
              <span className={r.id === "hyb" ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
              <div className="h-3 overflow-hidden rounded-sm bg-muted/40">
                <div style={{ width: `${Math.max(0.4, (r.mem / mMax) * 100).toFixed(2)}%`, background: M_, height: "100%" }} />
              </div>
              <span className="text-right tabular-nums">{fmtB(r.mem)}</span>
            </div>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="font-mono text-[10px] text-muted-foreground">clip length (s)</span>
          <Range min={5} max={60} step={5} value={s} onChange={(e) => setS(Number(e.target.value))} className="w-full cursor-pointer" accent={A_} />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          At five seconds attention is a rounding error next to the weights, and the hybrid buys almost nothing. At sixty, twenty softmax
          layers would spend about three and a half times the weights&apos; compute on attention alone; keeping five of them cuts that by
          four, and the fifteen GDN layers cost almost nothing. The five that remain are still quadratic. Only the streaming window makes
          memory flat, and it does so by forgetting: everything between the first chunk and the previous one reaches a softmax layer only
          through the GDN state.
        </p>
      </div>
    </figure>
  )
}
