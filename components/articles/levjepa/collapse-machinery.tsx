"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Built directly from the paper (arXiv 2608.27395, Sections 1, 2, 3, 3.2, 4.4,
// Appendix B) and its own account of V-JEPA/V-JEPA 2 (Bardes et al., arXiv
// 2506.09985, cited in the paper's own Related Work). Every "V-JEPA 2" cell
// below is LeVJEPA's own description of the baseline it is compared against
// in this paper, not this site's characterization of a different source.
//
// Five mechanisms V-JEPA 2 uses that LeVJEPA's paper states it does not need:
//   1. Target encoder -- "an exponential-moving-average target encoder"
//      (abstract; Related Work: "training an encoder jointly with a narrow
//      predictor against targets from an exponential-moving-average copy of
//      the encoder"). LeVJEPA: no target network is instantiated -- the local
//      and global embeddings in Eq. 2 come from the SAME encoder, same
//      forward pass (Sec 3).
//   2. Stop-gradient -- V-JEPA-style methods stop gradient into the target
//      branch (abstract: "a stop-gradient"). LeVJEPA (Sec 3.1.1, verbatim):
//      "Gradients propagate through both variables in Equation 2: the target
//      embedding z_0 is produced by the same encoder, in the same forward
//      pass, as the local embeddings; no stop-gradient operation or target
//      network is employed."
//   3. Predictor network -- V-JEPA-style methods train "a narrow predictor"
//      / "a predictor network conditioned on masked-token queries" (Related
//      Work, Sec 3). LeVJEPA has a projector instead (2-layer MLP,
//      d->2048->K=256, Appendix B) -- explicitly NOT a predictor: it is
//      discarded after pretraining and plays no role at inference, whereas
//      V-JEPA's predictor is queried at masked positions as part of the
//      pretraining task itself.
//   4. Structured (tube) masking -- inherited from VideoMAE-style pixel
//      reconstruction, "designed around that machinery rather than around
//      video itself" (Sec 1); required there because random masks let missing
//      content be interpolated from spatial neighbors (Sec 4.1). LeVJEPA
//      imputes nothing, so this requirement doesn't transfer: uniform random
//      dropping beats the tube pattern by 50.7 vs 39.6 IN1K (Sec 4.1).
//   5. Bidirectional-only attention -- V-JEPA 2's target/context encoders are
//      bidirectional (not stated as a constraint LeVJEPA removes per se, but
//      the paper is explicit that block-causal is reachable only *because*
//      "no asymmetry between branches is required" (Sec 3.2, Sec 6) -- a
//      predictor conditioned on future masked tokens needs the tokens it
//      predicts to exist in a bidirectional context).
//
// The Polyak-averaged evaluation checkpoint LeVJEPA ships (decay 0.9999,
// update_every=32 -- Appendix B, and matching the released HF config exactly)
// is deliberately NOT listed as a sixth "V-JEPA 2 mechanism, removed" row:
// the paper is explicit that it "receives no forward passes during training
// and does not appear in the objective, and is therefore distinct from the
// exponential-moving-average target encoders employed for collapse
// prevention in prior work." It's a postprocessing step on top of an
// already-collapse-free objective, not a collapse-prevention mechanism itself.

type Row = {
  key: string
  label: string
  vjepa: string
  levjepa: string
  detail: string
}

const ROWS: Row[] = [
  {
    key: "target",
    label: "Second (target) network",
    vjepa: "EMA copy of the encoder, updated every step",
    levjepa: "Not instantiated",
    detail:
      "V-JEPA 2's target embeddings come from an exponential-moving-average copy of the encoder that never receives a gradient directly. LeVJEPA's “target” embedding z₀ is just the global view's output from the same encoder, same forward pass, as every local view — there is no second set of weights anywhere in the training graph.",
  },
  {
    key: "stopgrad",
    label: "Stop-gradient",
    vjepa: "Required on the target branch",
    levjepa: "None — gradients flow through both terms",
    detail:
      "The paper's own Section 3.1.1, verbatim: “Gradients propagate through both variables in Equation 2 … no stop-gradient operation or target network is employed.” Removing the EMA branch removes the thing stop-gradient exists to protect.",
  },
  {
    key: "predictor",
    label: "Predictor network",
    vjepa: "Capacity-limited, conditioned on masked-token queries",
    levjepa: "A projector, not a predictor",
    detail:
      "LeVJEPA's projector is a 2-layer MLP (d→2048→K=256, batch norm, GELU) that maps the [cls] embedding into the loss space — it is discarded after pretraining and never runs at inference. V-JEPA's predictor is queried at every masked position as part of the pretraining task itself; there is no equivalent inference-time discard.",
  },
  {
    key: "masking",
    label: "Structured (tube) masking",
    vjepa: "Inherited from VideoMAE-style pixel reconstruction",
    levjepa: "Uniform random dropping, no imputation target",
    detail:
      "Tube masks exist to stop a reconstruction objective from cheating — randomly scattered holes let missing pixels be interpolated from spatial neighbors. LeVJEPA imputes nothing, so the reason for structure disappears: uniform random dropping beats the tube pattern, 50.7% vs 39.6% on ImageNet-1K attentive probing (Sec 4.1).",
  },
  {
    key: "attn",
    label: "Attention topology",
    vjepa: "Bidirectional (a masked-token predictor needs future tokens present)",
    levjepa: "Free to be block-causal",
    detail:
      "The paper states this causally, not incidentally: block-causal attention is reachable “because the objective imposes no asymmetry between branches” (Sec 3.2). A predictor conditioned on masked future positions needs those positions in its bidirectional context; once there's no predictor, nothing constrains the encoder's own attention mask.",
  },
]

const VJEPA = "oklch(0.58 0.20 300)"
const LEVJEPA = "oklch(0.60 0.15 255)"

export function CollapseMachinery() {
  const [openKey, setOpenKey] = useState<string>(ROWS[0].key)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          collapse-prevention machinery, per the paper&rsquo;s own account of each method
        </span>
        <span className="font-mono text-[10px] tabular-nums">
          <span style={{ color: VJEPA }}>V-JEPA 2: 5</span>
          <span className="mx-1.5 text-muted-foreground">vs</span>
          <span style={{ color: LEVJEPA }}>LeVJEPA: 0</span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-px overflow-hidden rounded-lg border bg-border text-[11px] sm:text-[12px]">
          <div className="bg-muted/30 px-2.5 py-2 font-mono text-muted-foreground">mechanism</div>
          <div className="bg-muted/30 px-2.5 py-2 font-mono" style={{ color: VJEPA }}>
            V-JEPA 2
          </div>
          <div className="bg-muted/30 px-2.5 py-2 font-mono" style={{ color: LEVJEPA }}>
            LeVJEPA
          </div>

          {ROWS.map((r) => {
            const open = openKey === r.key
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setOpenKey(open ? "" : r.key)}
                aria-expanded={open}
                className="col-span-3 grid grid-cols-subgrid cursor-pointer text-left"
              >
                <div
                  className={cn(
                    "bg-background px-2.5 py-2 font-medium text-foreground transition-colors hover:bg-muted/20",
                    open && "bg-muted/20"
                  )}
                >
                  {r.label}
                </div>
                <div className={cn("bg-background px-2.5 py-2 text-muted-foreground", open && "bg-muted/20")}>
                  {r.vjepa}
                </div>
                <div className={cn("bg-background px-2.5 py-2 text-muted-foreground", open && "bg-muted/20")}>
                  {r.levjepa}
                </div>
              </button>
            )
          })}
        </div>

        {openKey ? (
          <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
            <p className="text-[12.5px] leading-5 text-muted-foreground">
              {ROWS.find((r) => r.key === openKey)?.detail}
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Click a row for the paper&rsquo;s own reasoning. The count in the header is not editorializing —
          it&rsquo;s the number of collapse-prevention components each method actually instantiates during
          training, per LeVJEPA&rsquo;s own description of the baseline it compares itself to. The trainable
          architecture LeVJEPA is left with is an encoder and a small projector; the projector is discarded
          before the checkpoint on Hugging Face is ever loaded.
        </p>
      </div>
    </figure>
  )
}
