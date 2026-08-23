"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What "no VE, no VAE" actually removes.
//
// The standard unified multimodal stack has two pre-trained bottlenecks bolted to
// either end of the language model: a vision encoder that turns pixels into
// semantic tokens for understanding, and a variational autoencoder that turns
// latents back into pixels for generation. Both are trained separately, both
// impose their own representation, and neither is optimized for the model that
// consumes it.
//
// NEO-unify removes both. Images enter as patch embeddings and leave as patch
// embeddings, through the same backbone that handles words — autoregressive
// cross-entropy for text, pixel flow matching for vision, one representation
// space shaped by the model itself.
//
// The obvious objection is fidelity: a VAE exists because reconstructing pixels
// is hard and a purpose-built decoder does it well. The number that answers it is
// the reconstruction comparison on MS COCO 2017, and it is closer than it has any
// right to be — 31.56 dB PSNR against Flux VAE's 32.65, after ninety thousand
// pretraining steps at 2B parameters.
//
// The editing result is the stranger one. With the understanding branch entirely
// FROZEN, a 2B NEO-unify reaches 3.32 on ImgEdit after 60k mixed training steps,
// using public T2I and editing data. Condition context goes through the frozen
// understanding pathway; the generative pathway produces the image.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Stage = { l: string; sub: string; c: string; pre?: boolean }

const PIPELINES: { key: string; label: string; stages: Stage[]; note: string }[] = [
  {
    key: "conv",
    label: "the usual stack",
    stages: [
      { l: "pixels", sub: "the image", c: MUTED },
      { l: "vision encoder", sub: "pre-trained, frozen, someone else's objective", c: WARM, pre: true },
      { l: "language model", sub: "consumes whatever the encoder decided to keep", c: ACCENT },
      { l: "VAE decoder", sub: "pre-trained separately, imposes its own latent space", c: WARM, pre: true },
      { l: "pixels", sub: "the generated image", c: MUTED },
    ],
    note: "Two pre-trained bottlenecks, neither trained for the model between them. The encoder decides what the language model is allowed to see; the VAE decides what it is allowed to say. Every representation argument in unified multimodal modelling is downstream of those two choices.",
  },
  {
    key: "neo",
    label: "NEO-unify",
    stages: [
      { l: "pixels", sub: "the image, as patches", c: MUTED },
      { l: "patch-emb encoding", sub: "a linear layer, trained end to end", c: GOOD },
      { l: "native vision-language model", sub: "one Mixture-of-Transformer backbone", c: ACCENT },
      { l: "patch-emb decoding", sub: "a linear layer, trained end to end", c: GOOD },
      { l: "pixels", sub: "the generated image", c: MUTED },
    ],
    note: "No vision encoder and no VAE. The representation space is shaped by the model itself rather than inherited, and text and image share one backbone: autoregressive cross-entropy for words, pixel flow matching for vision.",
  },
]

const RECON = [
  { l: "Flux VAE", psnr: 32.65, ssim: 0.91, c: MUTED, note: "a purpose-built autoencoder, trained to do exactly this" },
  { l: "NEO-unify 2B", psnr: 31.56, ssim: 0.85, c: GOOD, note: "after 90k pretraining steps, with no autoencoder anywhere in it" },
]

export function NoEncoder() {
  const [sel, setSel] = useState("neo")
  const p = PIPELINES.find((x) => x.key === sel) ?? PIPELINES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          SenseTime + NTU · &ldquo;No VE! No VAE!&rdquo;
        </span>
        <span className="font-mono text-[10px]" style={{ color: sel === "neo" ? GOOD : WARM }}>
          {sel === "neo" ? "0 pre-trained bottlenecks" : "2 pre-trained bottlenecks"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PIPELINES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {p.stages.map((s, i) => (
            <div key={s.l + i}>
              <div className="flex items-center gap-2 rounded-md border px-2.5 py-2" style={{ borderColor: s.pre ? WARM : undefined }}>
                <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: s.c, opacity: 0.9 }} />
                <span className="w-52 shrink-0 truncate font-mono text-[11px] text-foreground">{s.l}</span>
                <span className="truncate font-mono text-[9px] text-muted-foreground">{s.sub}</span>
                {s.pre ? (
                  <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px]" style={{ background: `${WARM}22`, color: WARM }}>
                    pre-trained elsewhere
                  </span>
                ) : null}
              </div>
              {i < p.stages.length - 1 ? (
                <div className="py-0.5 text-center font-mono text-[10px] text-muted-foreground">↓</div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">{p.note}</div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            image reconstruction on MS COCO 2017 — can a model with no autoencoder still hold pixels?
          </div>
          <div className="mt-2 space-y-1.5">
            {RECON.map((r) => (
              <div key={r.l}>
                <div className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{r.l}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${((r.psnr - 28) / 6) * 100}%`, background: r.c, opacity: 0.9 }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: r.c }}>
                    {r.psnr.toFixed(2)} dB
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    SSIM {r.ssim.toFixed(2)}
                  </span>
                </div>
                <div className="pl-2 font-mono text-[9px] text-muted-foreground">{r.note}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The reconstruction row is the one that decides whether any of this is possible. A VAE exists because
          getting pixels back out is hard and a decoder trained for nothing else does it well — so a model that
          never had one should be badly worse. It is{" "}
          <span className="text-foreground">1.09 dB worse</span>, after ninety thousand pretraining steps at 2B
          parameters, with the reconstruction coming out of a generative pathway attached to a{" "}
          <em>frozen</em>{" "}understanding branch.
          <br />
          <br />
          What that buys is not fidelity, it is freedom. When the representation space is shaped by the model
          rather than inherited from two separately-trained components, the argument about which representation is
          right for understanding versus generation stops being an architecture decision and becomes something the
          training run settles. The team&rsquo;s own framing —{" "}
          <span className="text-foreground">stepping beyond representation arguments</span>{" "}— is the accurate
          description of what removing both bottlenecks is for.
        </p>
      </div>
    </figure>
  )
}
