"use client"

import { useState } from "react"

// Ripple-65B Preview, layer by layer. Every number here was read from the
// BF16 checkpoint (ricursiveAI/Ripple-65B-Preview at da94cc0) with HTTP range
// requests against the 16 safetensors shards, on 2026-11-10; no weights were
// downloaded in full.
//
// Per layer: [value_res_lambda, sigmoid(lambda), RMS of input_layernorm.weight,
// estimated embedding share of the V input]. The modeling code computes
//   v_in = lerp(e, x, s) = (1 - s) * e + s * x,  s = sigmoid(lambda)
// where e is the layer-0 token embedding times embed_scale (sqrt 5120) and x
// is the layer's RMS-normed input. The two have different sizes: the scaled
// embedding has RMS 3.081 (median over 48 sampled vocabulary rows), and x has
// roughly the RMS of the norm weight. The share is
//   (1 - s) * 3.081 / ((1 - s) * 3.081 + s * rms(w))
// an amplitude estimate that ignores how e and x correlate. Precomputed, so
// nothing but + - * / and Math.round reaches the DOM.
//
// Layer type: config.layer_types, every fifth layer (4, 9, ..., 79) is
// full_attention with no RoPE; the other 64 slide over 1,024 tokens with RoPE.

const L: [number, number, number, number][] = [[2.141,0.8948,0.228,0.614],[1.195,0.7677,0.214,0.813],[0.672,0.6619,0.219,0.878],[0.484,0.6188,0.252,0.883],[0.367,0.5908,0.177,0.923],[1.375,0.7982,0.202,0.794],[-11.938,0.0,0.28,1.0],[1.828,0.8615,0.239,0.674],[2.828,0.9442,0.215,0.459],[1.758,0.8529,0.206,0.72],[2.734,0.939,0.256,0.439],[3.594,0.9732,0.225,0.273],[3.781,0.9777,0.236,0.23],[2.625,0.9325,0.253,0.468],[4.75,0.9914,0.228,0.105],[12.312,1.0,0.169,0.0],[5.344,0.9952,0.179,0.076],[2.812,0.9433,0.203,0.477],[7.062,0.9991,0.177,0.015],[11.125,1.0,0.184,0.0],[4.281,0.9864,0.219,0.163],[4.688,0.9909,0.172,0.142],[13.25,1.0,0.189,0.0],[4.812,0.9919,0.178,0.123],[10.875,1.0,0.144,0.0],[6.594,0.9986,0.193,0.021],[8.688,0.9998,0.19,0.003],[6.062,0.9977,0.191,0.036],[6.625,0.9987,0.18,0.022],[8.938,0.9999,0.158,0.003],[9.312,0.9999,0.199,0.001],[9.375,0.9999,0.195,0.001],[6.594,0.9986,0.214,0.019],[7.906,0.9996,0.228,0.005],[7.938,0.9996,0.241,0.005],[4.625,0.9903,0.233,0.115],[13.625,1.0,0.22,0.0],[12.25,1.0,0.177,0.0],[3.703,0.9759,0.22,0.257],[6.688,0.9988,0.183,0.021],[1.102,0.7506,0.296,0.776],[7.156,0.9992,0.246,0.01],[6.781,0.9989,0.242,0.014],[-0.531,0.3702,0.323,0.942],[3.516,0.9711,0.265,0.257],[3.078,0.956,0.356,0.285],[1.516,0.8199,0.39,0.635],[-0.719,0.3277,0.395,0.941],[-0.48,0.3821,0.363,0.932],[1.938,0.8741,0.333,0.571],[6.844,0.9989,0.335,0.01],[1.602,0.8322,0.42,0.597],[0.432,0.6063,0.436,0.821],[6.312,0.9982,0.331,0.017],[1.898,0.8697,0.406,0.532],[7.906,0.9996,0.346,0.003],[-0.703,0.3311,0.429,0.936],[-1.891,0.1312,0.411,0.98],[-0.465,0.3858,0.442,0.917],[2.656,0.9344,0.454,0.323],[-2.578,0.0706,0.428,0.99],[10.312,1.0,0.328,0.0],[14.688,1.0,0.317,0.0],[2.062,0.8872,0.421,0.482],[0.168,0.5419,0.262,0.909],[-0.459,0.3872,0.447,0.916],[0.295,0.5732,0.462,0.832],[-1.102,0.2494,0.442,0.955],[5.125,0.9941,0.299,0.058],[0.283,0.5703,0.259,0.899],[-1.031,0.2628,0.445,0.951],[1.016,0.7341,0.402,0.735],[2.219,0.9019,0.342,0.495],[3.25,0.9627,0.307,0.28],[0.609,0.6478,0.238,0.876],[-0.163,0.4593,0.45,0.89],[5.562,0.9962,0.241,0.047],[-0.2,0.4501,0.415,0.901],[0.637,0.654,0.368,0.816],[1.914,0.8715,0.064,0.877]]

const EMB_RMS = 3.081
const N = L.length
const isGlobal = (i: number) => i % 5 === 4
const pct = (n: number) => Math.round(n * 1000) / 10

type Mode = "share" | "blend"

export function LayerMap() {
  const [mode, setMode] = useState<Mode>("share")
  const [sel, setSel] = useState(6)
  const W = 800
  const H = 180
  const top = 12
  const plotH = 132
  const bw = W / N
  const row = L[sel]
  const val = (r: [number, number, number, number]) => (mode === "share" ? r[3] : 1 - r[1])
  const over50 = L.filter((r) => r[3] > 0.5).length
  const under10 = L.filter((r) => r[3] < 0.1).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where each layer&apos;s values come from</span>
        <span className="font-mono text-[10px] text-muted-foreground">80 lambdas read from the checkpoint</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 font-mono text-[11px]">
          {(
            [
              ["share", "embedding share of V input (estimate)"],
              ["blend", "raw mixing weight 1 - sigmoid(lambda)"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded border px-2 py-0.5 ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart of 80 layers. Bars show how much of each layer's value input comes from the token embedding.">
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={0} x2={W} y1={top + plotH * (1 - t)} y2={top + plotH * (1 - t)} stroke="currentColor" strokeOpacity={t === 0.5 ? 0.25 : 0.12} strokeDasharray={t === 0.5 ? "4 4" : undefined} />
              <text x={W - 2} y={top + plotH * (1 - t) - 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {L.map((r, i) => {
            const v = val(r)
            const h = Math.max(1, v * plotH)
            return (
              <g key={i} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} style={{ cursor: "pointer" }}>
                <rect x={i * bw} y={top} width={bw} height={plotH + 20} fill="transparent" />
                <rect
                  x={i * bw + 1}
                  y={top + plotH - h}
                  width={bw - 2}
                  height={h}
                  rx={1}
                  fill={isGlobal(i) ? "#d97706" : "#0d9488"}
                  opacity={i === sel ? 1 : 0.72}
                />
                {i === sel ? <rect x={i * bw} y={top - 2} width={bw} height={plotH + 4} fill="none" stroke="currentColor" strokeWidth={1.2} /> : null}
                {i % 10 === 0 ? (
                  <text x={i * bw + bw / 2} y={top + plotH + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
                    {i}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
        <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#0d9488" }} />
            sliding window 1,024, RoPE (64 layers)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#d97706" }} />
            global, no positional encoding (16 layers)
          </span>
        </div>
        <div className="grid gap-2 rounded-lg border bg-background/60 p-3 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">layer</div>
            <div className="text-foreground">
              {sel} ({isGlobal(sel) ? "global" : "sliding"})
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">value_res_lambda</div>
            <div className="text-foreground">{row[0]}</div>
          </div>
          <div>
            <div className="text-muted-foreground">weight on own input</div>
            <div className="text-foreground">{pct(row[1])}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">embedding share (est.)</div>
            <div className="text-foreground">{pct(row[3])}%</div>
          </div>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Scaled embedding RMS {EMB_RMS}; this layer&apos;s input norm weight RMS {row[2]}. Embedding share above 50% in {over50} of 80 layers, under 10% in {under10}.
        </p>
      </div>
    </figure>
  )
}
