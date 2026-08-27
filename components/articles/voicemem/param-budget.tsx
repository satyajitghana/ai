"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What a QLoRA adapter can and cannot reach on Qwen3.6-35B-A3B.
//
// Shapes read directly from two primary sources via HTTP range requests on
// the safetensors headers (first 8 bytes give the header length; the header
// lists every tensor's dtype and shape):
//
//   Qwen/Qwen3.6-35B-A3B          model-*.safetensors  (the base)
//   zhifeixie/.../Qlora           adapter_model.safetensors (the adapter)
//
// Base, per block (config.json: hidden_size 2048, moe_intermediate_size 512,
// 256 experts / 8 routed, 30 linear-attention + 10 full-attention of 40):
//
//   mlp.experts.{gate_up_proj,down_proj}   [256,1024,2048]+[256,2048,512]
//                                           -> 805,306,368 / block, all 256 experts
//   mlp.shared_expert.{gate,up,down}_proj  -> 3,145,728 / block, always on
//   mlp.shared_expert_gate                 -> 2,048 / block
//   mlp.gate (router)                      -> 524,288 / block
//   self_attn (10 full-attn blocks)        -> 27,263,488 / block
//   linear_attn (30 linear-attn blocks)    -> 33,718,464 / block
//   embed_tokens, lm_head, final norm      -> 508,559,360 x2 + 2,048
//
// Summed: 34,660,610,688 in the language-model tower (35,951,822,704 total
// minus a 446,571,248 vision tower and an 844,640,768 MTP block -- neither
// targeted by this adapter's regex). This is the same tensor layout already
// profiled on this site for Ornith-1.5-35B-A3B (see /articles/tiel-coder-35b-a3b)
// -- the two base models are architecturally identical, block for block.
//
// adapter_config.json's target_modules regex:
//   ^(model\.language_model(?=\.).*\.(shared_expert_gate|down_proj|out_proj|
//     in_proj_a|in_proj_b|q_proj|in_proj_z|gate_proj|up_proj|in_proj_qkv|
//     k_proj|v_proj|o_proj))$
// textually contains "down_proj"/"gate_proj"/"up_proj" -- the exact names on
// the 256 routed experts -- but PEFT matches nn.Module names, and the base
// model's experts are ONE fused tensor per block (`mlp.experts.down_proj`,
// shape [256,2048,512]), not 256 separate Linear submodules. Reaching a fused
// tensor needs PEFT's `target_parameters` field; adapter_config.json ships it
// as `null`. So the regex's expert-shaped words never match an expert.
//
// What's left standing, per block: q/k/v/o_proj (full-attn) or the five
// in_proj_*/out_proj (linear-attn), plus the shared expert's three matrices
// and its gate. Summing r*(in+out) over exactly those modules:
//
//   full-attention block C  = 31,233   (x10 blocks = 312,330)
//   linear-attention block C = 36,417   (x30 blocks = 1,092,510)
//   total C = 1,404,840  ->  trainable(r) = 1,404,840 x r
//
// At the shipped r=32: 1,404,840 x 32 = 44,954,880 -- which is exactly the
// element count of the 700 tensors in adapter_model.safetensors (350 modules
// x lora_A + lora_B), read the same way, all stored F32. 44,954,880 x 4 bytes
// = 179.8 MB, matching the repo's own "180 MB" and the file's real 179,929,048
// bytes to within safetensors header overhead.

const EXPERT = "oklch(0.68 0.13 85)"
const SURFACE = "oklch(0.60 0.15 255)"
const LORA = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const LM_TOWER = 34_660_610_688
const EXPERT_BANK = 32_212_254_720 // all 256 experts x 40 blocks, resident but 92.9% never gets a gradient
const SURFACE_TOTAL = LM_TOWER - EXPERT_BANK // everything else: attn/linear-attn + shared expert + router + norms + embed/head
const TARGETED = 1_409_105_920 // the subset of SURFACE_TOTAL the regex actually names (excludes router + norms + embed/head)
const C_PER_RANK = 1_404_840 // trainable(r) = r * C_PER_RANK, exact from the shapes above
const SHIPPED_R = 32
// C_PER_RANK * SHIPPED_R = 44,954,880 -- verified against the adapter's own safetensors header

const mn = (n: number) => {
  const v = Math.round(n / 1e6)
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
const grp = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const W = 700
const PX = 14
const PW = 672

export function ParamBudget() {
  const [r, setR] = useState(SHIPPED_R)

  const trainable = C_PER_RANK * r
  const pctOfTower = (trainable / LM_TOWER) * 100
  const pctOfTargeted = (trainable / TARGETED) * 100
  const isShipped = r === SHIPPED_R

  const towerScale = PW / LM_TOWER
  const expertW = EXPERT_BANK * towerScale
  const surfaceW = PW - expertW

  const targetedScale = PW / SURFACE_TOTAL
  const targetedW = TARGETED * targetedScale
  const trainableW = Math.max(1.2, trainable * targetedScale)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          34.661 B in the tower · {mn(trainable)} M trainable at r={r}
        </span>
        <span className="font-mono text-[10px]" style={{ color: isShipped ? LORA : MUTED }}>
          {pctOfTower.toFixed(3)}% of the tower{isShipped ? " — the shipped setting" : ""}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} 232`} width={W} height={232} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`The language-model tower is 34.661 billion parameters, of which 32.212 billion -- the routed experts, 92.9% -- are never touched by this LoRA adapter at any rank. Of the remaining 2.448 billion, the adapter's regex reaches 1.409 billion. At rank ${r}, the adapter trains ${mn(
                trainable,
              )} million parameters, ${pctOfTargeted.toFixed(1)}% of the surface it can reach and ${pctOfTower.toFixed(3)}% of the tower.`}
            </title>

            {/* Row A: the tower split into expert bank vs everything else */}
            <text x={PX} y={14} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              language-model tower · 34.661 B
            </text>
            <rect x={PX} y={20} width={expertW} height={20} rx={2} fill={EXPERT} fillOpacity={0.32} />
            <rect x={PX + expertW} y={20} width={surfaceW} height={20} rx={2} fill={SURFACE} fillOpacity={0.5} />
            <text x={PX + 6} y={34} fontSize={7.5} fill="currentColor" fillOpacity={0.8} fontFamily="ui-monospace, monospace">
              256 routed experts, all 40 blocks · 32.212 B · 92.9%
            </text>
            <text
              x={PX + expertW + surfaceW - 6}
              y={34}
              textAnchor="end"
              fontSize={7.5}
              fill="currentColor"
              fillOpacity={0.8}
              fontFamily="ui-monospace, monospace"
            >
              rest · 2.448 B
            </text>
            <text x={PX + expertW / 2} y={56} textAnchor="middle" fontSize={7} fill={EXPERT} fontFamily="ui-monospace, monospace">
              0% trained at any rank — fused tensor, no target_parameters
            </text>

            {/* connector down into the "rest" */}
            <line x1={PX + expertW} y1={40} x2={PX + expertW} y2={70} stroke="currentColor" strokeOpacity={0.2} />
            <line x1={PX + expertW + surfaceW} y1={40} x2={PX + expertW + surfaceW} y2={70} stroke="currentColor" strokeOpacity={0.2} />

            {/* Row B: the "rest" expanded, split into targeted-by-regex vs router+norms+embed/head */}
            <text x={PX} y={82} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              that 2.448 B, expanded
            </text>
            <rect x={PX} y={88} width={PW} height={20} rx={2} fill="currentColor" fillOpacity={0.06} />
            <rect x={PX} y={88} width={targetedW} height={20} rx={2} fill={SURFACE} fillOpacity={0.55} />
            <text x={PX + 6} y={102} fontSize={7.5} fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
              attn/linear-attn proj + shared expert · 1.409 B — what the regex names
            </text>
            <text
              x={PX + PW - 6}
              y={116}
              textAnchor="end"
              fontSize={7}
              fill="currentColor"
              fillOpacity={0.5}
              fontFamily="ui-monospace, monospace"
            >
              router + norms + embed/head · untargeted
            </text>

            {/* Row C: the targeted surface, expanded again, with the trainable sliver */}
            <line x1={PX} y1={108} x2={PX} y2={136} stroke="currentColor" strokeOpacity={0.2} />
            <line x1={PX + targetedW} y1={108} x2={PX + targetedW} y2={136} stroke="currentColor" strokeOpacity={0.2} />
            <text x={PX} y={148} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              the 1.409 B it can reach, at rank r
            </text>
            <rect x={PX} y={154} width={targetedW} height={22} rx={2} fill="currentColor" fillOpacity={0.07} />
            <rect x={PX} y={154} width={trainableW} height={22} rx={2} fill={LORA} fillOpacity={0.9} />
            <text
              x={PX + Math.min(trainableW + 8, targetedW - 4)}
              y={169}
              fontSize={7.5}
              fill={LORA}
              fontFamily="ui-monospace, monospace"
            >
              {mn(trainable)} M trainable
            </text>
            <text x={PX} y={190} fontSize={7.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              {pctOfTargeted.toFixed(1)}% of the reachable surface · {pctOfTower.toFixed(3)}% of the whole tower ·{" "}
              {grp(trainable)} params (r={r} x 1,404,840)
            </text>

            <g transform="translate(14, 208)">
              <rect x={0} y={-7} width={7} height={7} rx={1} fill={EXPERT} fillOpacity={0.32} />
              <text x={11} y={0} fontSize={7} fill="currentColor" fillOpacity={0.65} fontFamily="ui-monospace, monospace">
                routed experts
              </text>
              <rect x={116} y={-7} width={7} height={7} rx={1} fill={SURFACE} fillOpacity={0.55} />
              <text x={127} y={0} fontSize={7} fill="currentColor" fillOpacity={0.65} fontFamily="ui-monospace, monospace">
                reachable, untrained
              </text>
              <rect x={272} y={-7} width={7} height={7} rx={1} fill={LORA} fillOpacity={0.9} />
              <text x={283} y={0} fontSize={7} fill="currentColor" fillOpacity={0.65} fontFamily="ui-monospace, monospace">
                trained (LoRA A+B)
              </text>
            </g>
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            LoRA rank r
          </span>
          <Range
            min={4}
            max={256}
            step={4}
            value={r}
            onChange={(e) => setR(Number(e.target.value))}
            className="flex-1"
            aria-label="LoRA rank r"
            accent={LORA}
          />
          <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            r = {r}
          </span>
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          adapter_config.json ships <span className="text-foreground">r: 32, lora_alpha: 64</span>. Drag past it —
          the expert bar above never moves.
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The regex in this adapter&rsquo;s <code>target_modules</code> spells out{" "}
          <code>down_proj</code>, <code>up_proj</code>, and <code>gate_proj</code> — the exact
          names carried by the 256 routed experts, <span style={{ color: EXPERT }}>92.9%</span>{" "}
          of the tower. It still cannot reach them: the base model keeps every block&rsquo;s experts
          as one fused tensor (<code>mlp.experts.down_proj</code>, shape{" "}
          <code>[256, 2048, 512]</code>), not 256 separate Linear layers, and attaching LoRA to a
          fused tensor needs PEFT&rsquo;s <code>target_parameters</code> field — which this adapter
          ships as <code>null</code>. So the words match text but not weights.
          <br />
          <br />
          What is actually reachable is the attention and linear-attention projections plus each
          block&rsquo;s shared expert — <span style={{ color: SURFACE }}>1.409 B</span> params, 4.1%
          of the tower. At the shipped rank 32 the adapter trains{" "}
          <span style={{ color: LORA }}>44.95 M</span> of those — 3.2% of what it can reach, 0.130%
          of the tower it sits on. Drag r to 256, eight times the shipped rank, and it is still only
          25.5% of that same reachable slice.
        </p>
      </div>
    </figure>
  )
}
