"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where FP4 actually runs — a precision map of one path through the hybrid stack.
// "Native FP4 training" does NOT mean every tensor is 4-bit: the heavy expert/MLP
// weight-GEMMs run in NVFP4, but embeddings, Mamba-2 and QKV projections, the
// attention core, the last ~16 layers and the MTP head are all kept higher
// precision. Flip to the backward pass to see the three stabilizers that make the
// FP4 GEMMs converge: 2D block-quantized weights, a random Hadamard transform on
// the weight-gradient inputs, and stochastic rounding on the gradients.

const FP4 = "oklch(0.60 0.15 255)" // runs in NVFP4
const HI = "oklch(0.72 0.16 60)" // kept higher precision

type Pass = "fwd" | "bwd"

const NODES: { id: string; label: string; sub: string; fp4: boolean }[] = [
  { id: "emb", label: "Embeddings", sub: "kept high precision", fp4: false },
  { id: "mamba", label: "Mamba-2 projections", sub: "kept high precision", fp4: false },
  { id: "qkv", label: "QKV projections", sub: "kept high precision", fp4: false },
  { id: "attn", label: "Attention core", sub: "not a weight-GEMM", fp4: false },
  { id: "moe", label: "LatentMoE expert GEMMs", sub: "runs in NVFP4", fp4: true },
  { id: "final", label: "Final ~16 layers", sub: "kept high precision", fp4: false },
  { id: "mtp", label: "MTP head", sub: "kept high precision", fp4: false },
]

const STAB = [
  { t: "2D block-quant weights", s: "quantize W in 2D blocks" },
  { t: "Hadamard → wgrad", s: "spread outliers before quant" },
  { t: "stochastic rounding", s: "unbiased gradient rounding" },
]

// ── geometry ──
const W = 720
const H = 420
const NX = 44
const NW = 300
const NH = 38
const TOP = 52
const PITCH = 50
const ny = (i: number) => TOP + i * PITCH

export function PrecisionMap() {
  const [pass, setPass] = useState<Pass>("fwd")
  const bwd = pass === "bwd"
  const moeI = NODES.findIndex((n) => n.fp4)
  const moeY = ny(moeI) + NH / 2

  // connector between consecutive nodes, down the left rail; reversed on backward
  const link = (i: number) => {
    const x = NX - 14
    const y1 = ny(i) + NH
    const y2 = ny(i + 1)
    const my = (y1 + y2) / 2
    return bwd
      ? `M ${x} ${y2} C ${x} ${my}, ${x} ${my}, ${x} ${y1}`
      : `M ${x} ${y1} C ${x} ${my}, ${x} ${my}, ${x} ${y2}`
  }

  const accent = bwd ? FP4 : "var(--muted-foreground)"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>precision map · one path through the hybrid stack</span>
        <span className="text-muted-foreground/50">{bwd ? "backward pass" : "forward pass"}</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Precision map: only the LatentMoE expert GEMMs run in NVFP4; embeddings, Mamba-2 and QKV projections, attention, final layers and the MTP head stay higher precision. ${
            bwd ? "Backward pass shows the three stabilizers on the FP4 GEMMs." : "Forward pass."
          }`}
        >
          <defs>
            <marker id="pm-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={accent} strokeWidth={1.5} />
            </marker>
            <marker id="pm-arrow-s" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={FP4} strokeWidth={1.5} />
            </marker>
            <filter id="pm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* rail label */}
          <text x={NX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>
            {bwd ? "gradients flow up ↑" : "activations flow down ↓"}
          </text>

          {/* connectors */}
          {NODES.slice(0, -1).map((_, i) => (
            <path
              key={i}
              d={link(i)}
              fill="none"
              stroke={accent}
              strokeWidth={1.5}
              markerEnd="url(#pm-arrow)"
              opacity={0.8}
            />
          ))}

          {/* nodes */}
          {NODES.map((n, i) => {
            const c = n.fp4 ? FP4 : HI
            return (
              <g key={n.id}>
                <rect
                  x={NX}
                  y={ny(i)}
                  width={NW}
                  height={NH}
                  rx={8}
                  fill="var(--background)"
                  stroke={c}
                  strokeWidth={n.fp4 ? 1.75 : 1.5}
                  filter={n.fp4 ? "url(#pm-soft)" : undefined}
                />
                <rect x={NX} y={ny(i)} width={5} height={NH} rx={2.5} fill={c} opacity={0.9} />
                <text x={NX + 16} y={ny(i) + 16} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
                  {n.label}
                </text>
                <text x={NX + 16} y={ny(i) + 29} className="fill-muted-foreground font-mono" fontSize={9}>
                  {n.sub}
                </text>
                <circle cx={NX + NW - 14} cy={ny(i) + NH / 2} r={4} fill={c} opacity={n.fp4 ? 0.95 : 0.7} />
              </g>
            )
          })}

          {/* stabilizer / note panel to the right of the FP4 node */}
          {bwd ? (
            STAB.map((s, k) => {
              const px = 400
              const py = moeY - 46 + k * 46
              return (
                <g key={s.t}>
                  <path
                    d={`M ${NX + NW} ${moeY} C ${NX + NW + 30} ${moeY}, ${px - 30} ${py + 14}, ${px} ${py + 14}`}
                    fill="none"
                    stroke={FP4}
                    strokeWidth={1.25}
                    markerEnd="url(#pm-arrow-s)"
                    opacity={0.6}
                  />
                  <rect
                    x={px}
                    y={py}
                    width={272}
                    height={30}
                    rx={7}
                    fill="var(--background)"
                    stroke={FP4}
                    strokeWidth={1.25}
                    opacity={0.95}
                  />
                  <text x={px + 12} y={py + 13} className="font-mono" fontSize={10.5} fontWeight={600} style={{ fill: FP4 }}>
                    {s.t}
                  </text>
                  <text x={px + 12} y={py + 24} className="fill-muted-foreground font-mono" fontSize={9}>
                    {s.s}
                  </text>
                </g>
              )
            })
          ) : (
            <g>
              <path
                d={`M ${NX + NW} ${moeY} C ${NX + NW + 30} ${moeY}, 370 ${moeY}, 400 ${moeY}`}
                fill="none"
                stroke={FP4}
                strokeWidth={1.25}
                markerEnd="url(#pm-arrow-s)"
                opacity={0.6}
              />
              <rect
                x={400}
                y={moeY - 26}
                width={272}
                height={52}
                rx={8}
                fill="var(--background)"
                stroke={FP4}
                strokeWidth={1.25}
                opacity={0.95}
              />
              <text x={412} y={moeY - 9} className="font-mono" fontSize={10.5} fontWeight={600} style={{ fill: FP4 }}>
                FP4 GEMM (fprop)
              </text>
              <text x={412} y={moeY + 5} className="fill-muted-foreground font-mono" fontSize={9}>
                quantize W and X → E2M1 elements
              </text>
              <text x={412} y={moeY + 18} className="fill-muted-foreground font-mono" fontSize={9}>
                + per-16 E4M3 block scale, then matmul
              </text>
            </g>
          )}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">pass</span>
            {(["fwd", "bwd"] as Pass[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPass(p)}
                aria-pressed={pass === p}
                className={cn(
                  "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  pass === p ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "fwd" ? "forward" : "backward"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FP4 }} /> NVFP4
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: HI }} /> higher precision
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Only the <span style={{ color: FP4 }}>expert weight-GEMMs</span> — the bulk of the compute — actually run in
          NVFP4. Six of the seven stages shown stay <span style={{ color: HI }}>higher precision</span>: the format is
          most fragile at the network&apos;s edges (embeddings, the last ~16 layers, the MTP head) and on the small,
          sensitive projections.{" "}
          {bwd ? (
            <>
              In the backward pass the FP4 GEMMs lean on all three stabilizers: 2D block-quantized weights, a{" "}
              <span style={{ color: FP4 }}>random Hadamard transform</span> that smears outliers before the wgrad
              quantization, and <span style={{ color: FP4 }}>stochastic rounding</span> so gradients aren&apos;t
              systematically truncated to zero.
            </>
          ) : (
            <>Flip to the backward pass to see the three stabilizers that keep the FP4 gradients from diverging.</>
          )}
        </p>
      </div>
    </figure>
  )
}
