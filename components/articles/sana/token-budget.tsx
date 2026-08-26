"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Sana's whole efficiency argument, done as arithmetic.
//
// Two levers, and they multiply:
//   1. the autoencoder's downsample factor f and the DiT's patch size p decide
//      how many tokens the transformer ever sees: N = (px / (f*p))^2.
//      SD3 / FLUX / PixArt use AE-F8 with patch 2 -> effective stride 16.
//      Sana uses DC-AE-F32C32 with patch 1 (configs/sana_config/1024ms/
//      Sana_1600M_img1024.yaml: vae_downsample_rate: 32, model SanaMS_*_P1_*)
//      -> effective stride 32, i.e. 4x fewer tokens at every resolution.
//   2. self-attention is O(N^2) with softmax and O(N) with LiteLA
//      (diffusion/model/nets/sana_blocks.py:246 attn_matmul).
//
// The model below is Sana-0.6B as the repo defines it: SanaMS_600M_P1_D28 =
// depth 28, hidden 1152 (diffusion/model/nets/sana_multi_scale.py:502), head
// dim 32 for linear attention (linear_head_dim=32; the diffusers config for the
// released weights says attention_head_dim: 32, num_attention_heads: 70 for the
// 1.6B, i.e. hidden/32), mlp_ratio 2.5 Mix-FFN, 300 text tokens for cross-attn.
//
// FLOP counts (2 FLOPs per multiply-accumulate):
//   softmax self-attn   2 * (2 N^2 d)
//   LiteLA self-attn    2 * (2 N d (dh+1))     -- the +1 is the row of ones the
//                                                 kernel pads V with to carry
//                                                 the denominator
//   qkv + out proj      2 * (4 N d^2)
//   Mix-FFN (GLU 2.5x)  2 * (N (7.5 d^2 + 22.5 d))
//   cross-attn          2 * (2 N d^2 + 2 N Lt d + 2 Lt d^2)
//
// Sanity check against the paper's own Table 8 (Sana, arXiv:2410.10629), which
// reports 6.48 / 4.30 / 4.19 / 1.08 "T" for FullAttn+MLP@F8C4P2, +LinearAttn,
// +MixFFN and LinearAttn+MixFFN@F32C32P1. This model reproduces those four
// numbers to within 4.2%. The DiT only -- no VAE, no text encoder.

const ATTN = "oklch(0.60 0.15 255)"
const REST = "oklch(0.62 0.03 250)"
const WIN = "oklch(0.55 0.16 155)"

const D = 1152
const DEPTH = 28
const DH = 32
const LT = 300

type Tok = { f: number; p: number; label: string }
const TOKS: Record<string, Tok> = {
  f8p2: { f: 8, p: 2, label: "AE-F8 · patch 2" },
  f32p1: { f: 32, p: 1, label: "DC-AE-F32 · patch 1" },
}

type Row = { k: string; tok: keyof typeof TOKS; attn: "softmax" | "linear"; name: string; who: string }

const ROWS: Row[] = [
  { k: "a", tok: "f8p2", attn: "softmax", name: "AE-F8 · patch 2 · softmax", who: "the SD3 / PixArt / FLUX shape" },
  { k: "b", tok: "f8p2", attn: "linear", name: "AE-F8 · patch 2 · linear", who: "linear attention alone" },
  { k: "c", tok: "f32p1", attn: "softmax", name: "DC-AE-F32 · patch 1 · softmax", who: "deep compression alone" },
  { k: "d", tok: "f32p1", attn: "linear", name: "DC-AE-F32 · patch 1 · linear", who: "Sana — both levers" },
]

const RES = [512, 1024, 2048, 4096]

function tokens(px: number, t: Tok) {
  const side = px / (t.f * t.p)
  return side * side
}

function parts(N: number, attn: "softmax" | "linear") {
  const a = attn === "softmax" ? 2 * (2 * N * N * D) : 2 * (2 * N * D * (DH + 1))
  const qkv = 2 * (4 * N * D * D)
  const ffn = 2 * (N * (7.5 * D * D + 22.5 * D))
  const cross = 2 * (2 * N * D * D + 2 * N * LT * D + 2 * LT * D * D)
  return { attn: (a * DEPTH) / 1e12, rest: ((qkv + ffn + cross) * DEPTH) / 1e12 }
}

const tf = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2))

export function TokenBudget() {
  const [px, setPx] = useState(1024)
  const [sel, setSel] = useState("d")

  const data = ROWS.map((r) => {
    const N = tokens(px, TOKS[r.tok])
    const p = parts(N, r.attn)
    return { ...r, N, ...p, total: p.attn + p.rest }
  })
  const base = data[0].total
  const cur = data.find((x) => x.k === sel)!
  const max = Math.max(...data.map((x) => x.total))

  const W = 700
  const X0 = 176
  const SPAN = 430
  const ROWH = 36
  const H = 30 + ROWS.length * ROWH + 16

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Sana-0.6B DiT · one forward pass at {px}&times;{px}
        </span>
        <span className="font-mono text-[10px]" style={{ color: WIN }}>
          {cur.name.split(" · ").slice(-1)[0]} · {tf(cur.total)} TFLOP ·{" "}
          {(base / cur.total).toFixed(1)}&times; cheaper than the baseline
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {RES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setPx(r)}
              aria-pressed={px === r}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                px === r
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r}px
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Four token-and-attention budgets for a Sana-0.6B DiT at ${px} by ${px}. ` +
                data
                  .map((r) => `${r.name}: ${Math.round(r.N).toLocaleString()} tokens, ${tf(r.total)} TFLOP`)
                  .join("; ") +
                `. The selected configuration is ${cur.name}, ${(base / cur.total).toFixed(1)} times cheaper than the AE-F8 softmax baseline.`}
            </title>

            <text x={0} y={10} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              configuration
            </text>
            <text x={X0} y={10} fontSize={8.5} fill={ATTN} fillOpacity={0.9} fontFamily="ui-monospace, monospace">
              self-attention
            </text>
            <text x={X0 + 84} y={10} fontSize={8.5} fill={REST} fontFamily="ui-monospace, monospace">
              projections + Mix-FFN + cross-attention
            </text>

            {data.map((r, i) => {
              const y = 24 + i * ROWH
              const on = r.k === sel
              const wA = (r.attn / max) * SPAN
              const wR = (r.rest / max) * SPAN
              const end = X0 + Math.max(2, wA + wR)
              return (
                <g key={r.k} onClick={() => setSel(r.k)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y - 4} width={W} height={ROWH - 4} rx={4} fill={on ? WIN : "transparent"} fillOpacity={on ? 0.07 : 0} />
                  <text
                    x={4}
                    y={y + 9}
                    fontSize={9}
                    fill="currentColor"
                    fillOpacity={on ? 0.95 : 0.6}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.name}
                  </text>
                  <text x={4} y={y + 21} fontSize={8} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    {Math.round(r.N).toLocaleString()} tokens · {r.who}
                  </text>

                  <rect x={X0} y={y} width={Math.max(0.8, wA)} height={15} rx={2} fill={ATTN} fillOpacity={on ? 0.95 : 0.55} />
                  <rect x={X0 + wA} y={y} width={Math.max(0.8, wR)} height={15} rx={2} fill={REST} fillOpacity={on ? 0.75 : 0.4} />

                  <text
                    x={end + 7}
                    y={y + 11}
                    fontSize={9}
                    fill="currentColor"
                    fillOpacity={on ? 0.95 : 0.55}
                    fontFamily="ui-monospace, monospace"
                  >
                    {tf(r.total)} TFLOP
                  </text>
                  <text x={end + 7} y={y + 22} fontSize={7.5} fill={WIN} fillOpacity={i === 0 ? 0 : 0.85} fontFamily="ui-monospace, monospace">
                    {i === 0 ? "" : `${(base / r.total).toFixed(1)}× cheaper`}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "tokens into the DiT", v: Math.round(cur.N).toLocaleString(), c: WIN },
            { l: "self-attention share", v: `${((cur.attn / cur.total) * 100).toFixed(1)}%`, c: ATTN },
            { l: "DiT forward", v: `${tf(cur.total)} TFLOP`, c: REST },
            { l: "vs AE-F8 + softmax", v: `${(base / cur.total).toFixed(1)}×`, c: WIN },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Click a row. The token count is set entirely upstream of the transformer:{" "}
          <span className="font-mono text-[11px] text-foreground">N = (px / (f·p))²</span>, where{" "}
          <span className="font-mono text-[11px]">f</span>{" "}is the autoencoder&rsquo;s downsample factor and{" "}
          <span className="font-mono text-[11px]">p</span>{" "}the DiT&rsquo;s patch size. An AE-F8 with patch 2
          has an effective stride of 16; Sana&rsquo;s DC-AE-F32 with patch 1 has 32, so it sees{" "}
          <span className="text-foreground">four times fewer tokens at every resolution</span>.
          <br />
          <br />
          Now watch the two levers separate. Compare row 3 against row 1 and you get what the
          autoencoder is worth on its own; row 2 against row 1 is what linear attention is worth on
          its own. At <span className="font-mono text-[11px]">512px</span>{" "}that is 3.9&times;
          against 1.1&times;. At <span className="font-mono text-[11px]">1024px</span>, 5.2&times;
          against 1.5&times;. Even at <span className="font-mono text-[11px]">4096px</span>{" "}the
          autoencoder is still ahead, 12&times; against 9&times; — the quadratic term only overtakes
          it somewhere past 5000px. And row 4 is{" "}
          <span className="text-foreground">36&times;</span>{" "}at 4K, because compression shrinks{" "}
          <em>N</em>{" "}and linear attention shrinks the exponent on it.
          <br />
          <br />
          FLOPs are the DiT forward pass only, counted from the shapes in{" "}
          <span className="font-mono text-[11px] text-foreground">diffusion/model/nets/sana_multi_scale.py</span>{" "}
          — no VAE, no text encoder. Against the paper&rsquo;s own Table 8 the four comparable rows
          land within 4.2%.
        </p>
      </div>
    </figure>
  )
}
