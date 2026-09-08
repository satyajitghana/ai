"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A conceptual diagram, not a reproduction of a specific paper figure. It exists
// to make one thing concrete: three ways to train a sequence model differ in
// what target they force the model to match exactly, and that target is what
// decides whether nuisance detail gets modeled or discarded.
//
// "Next-token" and "next-latent" are NextLat's own terms and its own objective
// (arXiv 2511.05963v1, Eq. 1 for next-token, Eq. 3-4 for the next-hidden/KL
// losses that make up "next-latent"). One detail this diagram is careful to
// get right, because it's easy to misstate: NextLat's total loss (Eq. 5) is
// next-token loss PLUS the next-latent terms, weighted by lambda_next-h and
// lambda_KL -- it is an auxiliary objective added on top of ordinary next-token
// training, not a replacement for it. Table 2 and Figure 8 of the paper are
// explicit that this matters: BST, MTP, and JTP all degrade raw next-token
// accuracy by adding token-level supervision at future offsets, while NextLat's
// probe-measured next-token performance matches GPT's, because the compression
// pressure lands on the hidden state, not on the token distribution itself.
//
// "Pixel / observation reconstruction" is this site's own framing, not the
// NextLat paper's -- included because it's the third corner readers of
// /articles/levjepa will already have in mind. VideoMAE-style masked
// reconstruction (cited in NextLat's own Related Work as one of the "Beyond
// Next-Token Prediction" lineages) is graded against raw pixels, which is the
// most literal way to force a model to spend capacity on nuisance detail: two
// physically identical scenes lit half a stop apart are different targets.
//
// The "who supplies the target" and "collapse risk" rows are what separate
// next-latent from the other two, and are the reason NextLat needs a
// stop-gradient (Eq. 3-4's sg[.]) that next-token and pixel-reconstruction
// objectives don't: the target for both of those comes from outside the
// model (the actual next token, the actual next frame), so there's no
// degenerate solution where the model satisfies the loss by moving the
// target to meet a lazy prediction. Next-latent's target is the model's own
// future hidden state -- without stopping gradient into it, collapsing every
// h_t to one constant vector would trivially minimize the regression loss.

type Objective = "token" | "pixel" | "latent"

type Spec = {
  label: string
  short: string
  target: string
  mustMatch: string
  freeToDiscard: string
  targetSource: string
  collapseRisk: string
  example: string
}

const SPECS: Record<Objective, Spec> = {
  token: {
    label: "Next-token prediction",
    short: "GPT-style",
    target: "the next discrete token x_{t+1}",
    mustMatch: "the exact token identity — one entry in a fixed vocabulary",
    freeToDiscard: "everything not needed to name that one token correctly",
    targetSource: "ground truth via teacher forcing — supplied by the data",
    collapseRisk: "none — a fixed external target admits no degenerate shortcut",
    example:
      "at a Manhattan intersection, the target is which street-name token comes next — nothing about why, or what else was true at that intersection, is scored",
  },
  pixel: {
    label: "Pixel / observation reconstruction",
    short: "VideoMAE-style",
    target: "the next raw observation — pixels, sensor readings",
    mustMatch: "every rendered value: color, lighting, texture, camera noise",
    freeToDiscard: "nothing — reconstruction loss penalizes any deviation",
    targetSource: "ground truth observation — supplied by the data",
    collapseRisk: "none — a fixed external target admits no degenerate shortcut",
    example:
      "the same intersection at dusk versus noon is two different targets, even though the road structure — the thing a world model actually needs — is identical",
  },
  latent: {
    label: "Next-latent prediction (NextLat)",
    short: "this paper, on top of next-token",
    target: "the model's own next hidden state ĥ_{t+1}, predicted from (h_t, x_{t+1})",
    mustMatch: "whatever the model itself decided h_{t+1} needs to contain",
    freeToDiscard: "anything not required to decode future tokens from the latent",
    targetSource: "the model's own trajectory — not supplied by the data directly",
    collapseRisk: "real — needs stop-gradient (Eq. 3-4's sg[·]) or every h_t collapses to one point",
    example:
      "two different routes that both end up mid-block on the same one-way street are free to land on the same latent, provided both still decode correctly",
  },
}

const ORDER: Objective[] = ["token", "pixel", "latent"]

const ACCENT: Record<Objective, string> = {
  token: "oklch(0.58 0.02 250)",
  pixel: "oklch(0.62 0.15 255)",
  latent: "oklch(0.63 0.19 25)",
}

export function ObjectiveBottleneck() {
  const [active, setActive] = useState<Objective>("latent")
  const spec = SPECS[active]
  const accent = ACCENT[active]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what each objective is forced to get exactly right</span>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              aria-pressed={active === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                active === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {SPECS[k].short}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-mono text-[13px] font-medium" style={{ color: accent }}>
            {spec.label}
          </span>
        </div>

        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          <div className="shrink-0 rounded-lg border border-border px-3 py-2 text-center">
            <div className="font-mono text-[9px] text-muted-foreground">history</div>
            <div className="font-mono text-[11px]">
              x<sub>1:t</sub>
            </div>
          </div>
          <span className="shrink-0 font-mono text-sm text-muted-foreground">&rarr;</span>
          <div
            className="flex shrink-0 flex-col items-center gap-1 rounded-lg border-2 px-3 py-2 text-center"
            style={{ borderColor: accent }}
          >
            <span className="font-mono text-[9px] text-muted-foreground">forced to match exactly</span>
            <span className="max-w-56 font-mono text-[11px]" style={{ color: accent }}>
              {spec.target}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border text-[12px] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="bg-muted/30 px-2.5 py-2 font-mono text-muted-foreground">must match exactly</div>
          <div className="bg-background px-2.5 py-2 text-foreground">{spec.mustMatch}</div>

          <div className="bg-muted/30 px-2.5 py-2 font-mono text-muted-foreground">free to discard</div>
          <div className="bg-background px-2.5 py-2 text-foreground">{spec.freeToDiscard}</div>

          <div className="bg-muted/30 px-2.5 py-2 font-mono text-muted-foreground">target comes from</div>
          <div className="bg-background px-2.5 py-2 text-foreground">{spec.targetSource}</div>

          <div className="bg-muted/30 px-2.5 py-2 font-mono text-muted-foreground">collapse risk</div>
          <div className="bg-background px-2.5 py-2 text-foreground">{spec.collapseRisk}</div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <p className="font-mono text-[11.5px] leading-5" style={{ color: accent }}>
            {spec.example}
          </p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch between the three and the pattern is the target, not the architecture. Next-token and
          pixel-reconstruction targets both come from outside the model, so there is no shortcut that
          satisfies the loss without actually predicting something real — the difference between them
          is just how much of reality the target encodes (one token versus an entire frame).
          Next-latent&rsquo;s target is different in kind: it is the model&rsquo;s own next hidden state,
          which is exactly what makes it compressible — the model gets to choose what h<sub>t+1</sub>{" "}
          needs to contain — and exactly why it needs the stop-gradient the other two never do. NextLat
          keeps the next-token term running the whole time; the next-latent loss is added on top, not
          swapped in.
        </p>
      </div>
    </figure>
  )
}
