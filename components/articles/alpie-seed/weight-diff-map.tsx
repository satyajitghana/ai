"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What 169Pi's post-training actually changed, tensor by tensor, against Qwen/Qwen3.5-9B.
// MEASURED by HTTP range requests on both safetensors files (Alpie_seed revision 021da65):
//  - every one of the 760 Alpie tensors was compared on three random 16 KiB spans (whole tensor when small);
//  - eleven tensors were compared in full (six by SHA-256, six decoded value by value; layers.14 down_proj was in both).
// Per-layer numbers below are the share of sampled bf16 values that differ from the base, averaged over the
// layer's adapter-targeted matrices (gate/up/down for the MLP; q/k/v/o for the eight full-attention layers).
// A sampled zero for an MLP or attention matrix is a sampling miss: layers.14 down_proj sampled identical and
// differs in full. Gated DeltaNet projections and the vision tower were identical in every sample and in full.
const MLP = [
  0.124, 0.066, 0.124, 0.058, 0.041, 0.051, 0.068, 0.144, 0.152, 0.058, 0.087, 0.135, 0.151, 0.134, 0.05, 0.103,
  0.091, 0.134, 0.062, 0.096, 0.178, 0.105, 0.051, 0.109, 0.093, 0.078, 0.053, 0.028, 0.012, 0.017, 0.051, 0.076,
]
const MIX = [
  0, 0, 0, 0.069, 0, 0, 0, 0.109, 0, 0, 0, 0.088, 0, 0, 0, 0.118, 0, 0, 0, 0.264, 0, 0, 0, 0.125, 0, 0, 0, 0.104, 0,
  0, 0, 0.107,
]

type Full = { name: string; shape: string; same: number; rel: number; rows: number }
// Decoded in full, both checkpoints (measured). "same" = bit-identical bf16 values; every other value is exactly
// one bf16 step (ulp) away from the base: zero values moved by two or more steps in any of these six.
const FULL: Full[] = [
  { name: "layers.19 k_proj", shape: "1024 x 4096", same: 0.9043, rel: 0.00164, rows: 0.257 },
  { name: "layers.19 v_proj", shape: "1024 x 4096", same: 0.8587, rel: 0.00172, rows: 0.359 },
  { name: "layers.19 o_proj", shape: "4096 x 4096", same: 0.7938, rel: 0.00224, rows: 0.429 },
  { name: "layers.3 q_proj", shape: "8192 x 4096", same: 0.8784, rel: 0.00159, rows: 0.31 },
  { name: "layers.12 down_proj", shape: "4096 x 12288", same: 0.8743, rel: 0.00165, rows: 0.346 },
  { name: "layers.26 up_proj", shape: "12288 x 4096", same: 0.9561, rel: 0.00088, rows: 0.217 },
]

type Sel =
  | { kind: "mlp"; layer: number }
  | { kind: "mix"; layer: number }
  | { kind: "vision" }
  | { kind: "mtp" }
  | { kind: "embed" }

const C_CHG = "oklch(0.63 0.17 35)"
const C_SAME = "oklch(0.62 0.13 230)"
const C_GONE = "oklch(0.55 0.02 260)"

function heat(f: number): string {
  if (f === 0) return C_SAME
  const a = Math.min(1, 0.35 + f * 3.2)
  return `oklch(0.63 0.17 35 / ${a.toFixed(2)})`
}

export function WeightDiffMap() {
  const [sel, setSel] = useState<Sel>({ kind: "mix", layer: 19 })
  const cellW = 100 / 32

  let title = ""
  let body = ""
  if (sel.kind === "mlp") {
    title = `layer ${sel.layer} · MLP (gate, up, down)`
    body = `${(MLP[sel.layer] * 100).toFixed(1)}% of sampled bf16 values differ from Qwen3.5-9B. Both adapters targeted gate_proj, up_proj and down_proj, so all 32 MLPs moved.`
  } else if (sel.kind === "mix") {
    const full = sel.layer % 4 === 3
    title = `layer ${sel.layer} · ${full ? "gated attention (q, k, v, o)" : "Gated DeltaNet"}`
    body = full
      ? `${(MIX[sel.layer] * 100).toFixed(1)}% of sampled values differ. Its projections are named q_proj, k_proj, v_proj and o_proj, which are on the SFT adapter's target list.`
      : "Bit-identical to the base in every sample, and in full for the three projections hashed. Its matrices are named in_proj_qkv, in_proj_z, in_proj_a, in_proj_b and out_proj: none of them matches a q_proj/k_proj/v_proj/o_proj/gate/up/down target."
  } else if (sel.kind === "vision") {
    title = "vision tower · 27 blocks + merger"
    body = "456,010,480 parameters, bit-identical to Qwen3.5-9B (333 tensors sampled, two hashed in full). The report says so too: no vision-specific post-training."
  } else if (sel.kind === "mtp") {
    title = "multi-token prediction head · absent"
    body = "Qwen3.5-9B ships 15 mtp.* tensors, 243,290,624 parameters. Alpie_seed's model.safetensors has none, though its config.json still says mtp_num_hidden_layers: 1 and the report lists the head as relevant to speculative decoding."
  } else {
    title = "embeddings + output head"
    body = "2,034,237,440 parameters (two 248,320 x 4,096 tables), identical in 150 of 150 sampled 16 KiB spans each."
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Alpie Seed vs Qwen3.5-9B, tensor by tensor · measured by range requests on both checkpoints
      </div>
      <div className="px-4 pt-4">
        <svg viewBox="0 0 100 34" className="w-full" role="group" aria-label="A map of the 32 language-model layers and the vision tower, coloured by whether post-training changed them">
          <text x={0} y={2.6} fontSize={2.1} className="fill-muted-foreground font-mono">
            mixer
          </text>
          <text x={0} y={12.6} fontSize={2.1} className="fill-muted-foreground font-mono">
            MLP
          </text>
          {MIX.map((f, i) => {
            const on = sel.kind === "mix" && sel.layer === i
            return (
              <rect
                key={`x${i}`}
                x={i * cellW + 0.15}
                y={3.4}
                width={cellW - 0.3}
                height={6}
                rx={0.4}
                fill={heat(f)}
                stroke={on ? "currentColor" : "none"}
                strokeWidth={0.35}
                className="cursor-pointer"
                onClick={() => setSel({ kind: "mix", layer: i })}
              >
                <title>{`layer ${i} ${i % 4 === 3 ? "attention" : "DeltaNet"}: ${(f * 100).toFixed(1)}% changed`}</title>
              </rect>
            )
          })}
          {MLP.map((f, i) => {
            const on = sel.kind === "mlp" && sel.layer === i
            return (
              <rect
                key={`m${i}`}
                x={i * cellW + 0.15}
                y={13.4}
                width={cellW - 0.3}
                height={6}
                rx={0.4}
                fill={heat(f)}
                stroke={on ? "currentColor" : "none"}
                strokeWidth={0.35}
                className="cursor-pointer"
                onClick={() => setSel({ kind: "mlp", layer: i })}
              >
                <title>{`layer ${i} MLP: ${(f * 100).toFixed(1)}% changed`}</title>
              </rect>
            )
          })}
          {[0, 8, 16, 24, 31].map((i) => (
            <text key={`l${i}`} x={i * cellW + cellW / 2} y={22.2} fontSize={1.8} textAnchor="middle" className="fill-muted-foreground font-mono">
              {i}
            </text>
          ))}
          <g className="cursor-pointer" onClick={() => setSel({ kind: "embed" })}>
            <rect x={0.15} y={25} width={30} height={7} rx={0.6} fill={C_SAME} stroke={sel.kind === "embed" ? "currentColor" : "none"} strokeWidth={0.35} />
            <text x={15.15} y={29.4} fontSize={2} textAnchor="middle" fill="white" className="font-mono">
              embed + head
            </text>
          </g>
          <g className="cursor-pointer" onClick={() => setSel({ kind: "vision" })}>
            <rect x={32} y={25} width={34} height={7} rx={0.6} fill={C_SAME} stroke={sel.kind === "vision" ? "currentColor" : "none"} strokeWidth={0.35} />
            <text x={49} y={29.4} fontSize={2} textAnchor="middle" fill="white" className="font-mono">
              vision tower (27 blocks)
            </text>
          </g>
          <g className="cursor-pointer" onClick={() => setSel({ kind: "mtp" })}>
            <rect
              x={68}
              y={25}
              width={31.7}
              height={7}
              rx={0.6}
              fill="none"
              stroke={sel.kind === "mtp" ? "currentColor" : C_GONE}
              strokeWidth={0.35}
              strokeDasharray="1 0.8"
            />
            <text x={83.85} y={29.4} fontSize={2} textAnchor="middle" className="fill-muted-foreground font-mono">
              MTP head: missing
            </text>
          </g>
        </svg>
        <div className="mt-1 flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: C_SAME }} />
            bit-identical to the base
          </span>
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: C_CHG }} />
            changed (darker = more values moved)
          </span>
          <span>click a cell</span>
        </div>
      </div>
      <div className="mx-4 my-3 rounded border bg-muted/40 px-3 py-2 text-sm">
        <div className="font-mono text-xs">{title}</div>
        <p className="mt-1 text-muted-foreground">{body}</p>
      </div>
      <div className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        <div className="mb-1">six matrices decoded in full from both checkpoints: every changed value moved exactly one bf16 step</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] tabular-nums">
            <thead>
              <tr className="text-left">
                <th className="font-normal">tensor</th>
                <th className="font-normal">shape</th>
                <th className="font-normal">identical</th>
                <th className="font-normal">one step</th>
                <th className="font-normal">two+ steps</th>
                <th className="font-normal">|dW| / |W|</th>
                <th className="font-normal">rows touched</th>
              </tr>
            </thead>
            <tbody>
              {FULL.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.shape}</td>
                  <td>{(r.same * 100).toFixed(1)}%</td>
                  <td className={cn(r.same < 0.85 && "text-foreground")}>{((1 - r.same) * 100).toFixed(1)}%</td>
                  <td>0</td>
                  <td>{(r.rel * 100).toFixed(2)}%</td>
                  <td>{(r.rows * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  )
}
