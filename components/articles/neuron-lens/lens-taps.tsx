"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where each lens taps the network and what it reads. All of the text below is the neuron-lens design notes
// (docs/design.md, "The lenses" and "Reading neurons"), restated; no numbers are computed here.

type Lens = "logit" | "J" | "R" | "K" | "S"
type Tap = "out" | "mid"

const FORWARD: Lens[] = ["logit", "J", "R"]

const LENS_INFO: Record<Lens, { name: string; formula: string; answers: string; origin: string; shipped: boolean }> = {
  logit: {
    name: "logit lens",
    formula: "softmax(W_U · norm(h))",
    answers: "what h says if nothing downstream acts on it",
    origin: "nostalgebraist 2020; no Jacobian",
    shipped: false,
  },
  J: {
    name: "J-lens",
    formula: "softmax(W_U · norm(J_L h)), J_L = mean over t of the sum over t' ≥ t of ∂h_final(t')/∂h_L(t)",
    answers: "what h makes the model say, here and later, after the layers above have acted on it",
    origin: "Gurnee et al. 2026; true gradients",
    shipped: false,
  },
  R: {
    name: "R-lens",
    formula: "the J-lens under RelP's rules: norm scales held constant, silu linearised, half of each factor's change through gate × up",
    answers: "the same question as the J-lens, with a more faithful read on early layers",
    origin: "camilablank et al. 2026; fitted on 1,000 DCLM documents of 128 tokens",
    shipped: true,
  },
  K: {
    name: "K-lens",
    formula: "token v scores h · K_L (W_E[v] − mean W_E), K_L = mean over t of the sum over s ≤ t of ∂h_L(t)/∂e(s)",
    answers: "which input tokens, here or earlier, put h there",
    origin: "Theia Vogel 2026 (unpublished); true gradients",
    shipped: false,
  },
  S: {
    name: "S-lens",
    formula: "the K-lens under RelP's rules; the R-lens's backward map is exactly the transpose of this forward one",
    answers: "which input tokens put h there, read from the weights alone",
    origin: "introduced by neuron-lens",
    shipped: true,
  },
}

// The lens rule: the fit point decides which circuits a lens may read. "A read anywhere else extrapolates, and the
// catalog ships none."
const READS: Record<"R" | "S", Record<Tap, { cols: string; what: string }>> = {
  R: {
    out: { cols: "write_R", what: "the MLP writes: what a neuron's write makes the model say (layers 0–34 of 36)" },
    mid: { cols: "read_R, ov_R", what: "the MLP read directions and the attention writes" },
  },
  S: {
    out: { cols: "write_S, ov_S, qk_S", what: "the MLP writes (whose tokens' footprints it imitates) and the attention inputs" },
    mid: { cols: "read_S", what: "the MLP read directions: which input tokens drive the pole" },
  },
}

const BOXES = [
  { x: 8, w: 62, label: "tokens" },
  { x: 82, w: 48, label: "W_E" },
  { x: 142, w: 108, label: "L0 … L−1" },
  { x: 262, w: 112, label: "layer L", hl: true },
  { x: 386, w: 108, label: "L+1 … L35" },
  { x: 506, w: 70, label: "final norm" },
  { x: 588, w: 48, label: "W_U" },
  { x: 648, w: 64, label: "logits" },
]
const MID_X = 296
const OUT_X = 340
const BOX_Y = 150
const BOX_H = 56
const MID_Y = BOX_Y + BOX_H
const FWD = "oklch(0.62 0.16 255)"
const BWD = "oklch(0.64 0.16 150)"
const LOGIT = "oklch(0.72 0.15 80)"

export function LensTaps() {
  const [lens, setLens] = useState<Lens>("R")
  const [tap, setTap] = useState<Tap>("out")
  const info = LENS_INFO[lens]
  const forward = FORWARD.includes(lens)
  const tapX = tap === "mid" ? MID_X : OUT_X
  const color = lens === "logit" ? LOGIT : forward ? FWD : BWD
  const rule = lens === "R" || lens === "S" ? READS[lens][tap] : null

  // forward lenses: from the tap up to the final norm (the logit lens skips the layers in between);
  // backward lenses: from the tap back to W_E
  const targetX = forward ? 541 : 106
  const topY = BOX_Y - 6
  const arcLift = forward ? 80 : 80
  const path = forward
    ? `M ${tapX} ${topY} C ${tapX} ${topY - arcLift}, ${targetX} ${topY - arcLift}, ${targetX} ${topY}`
    : `M ${tapX} ${topY} C ${tapX} ${topY - arcLift}, ${targetX} ${topY - arcLift}, ${targetX} ${topY}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where a lens taps the network · restated from the neuron-lens methods notes</span>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(LENS_INFO) as Lens[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setLens(k)}
              aria-pressed={lens === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                lens === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {LENS_INFO[k].name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 720 270" role="img" className="h-auto w-full">
          <title>
            The residual stream from the input tokens through the embedding matrix, the layers, the final norm and the unembedding
            to the logits. A coloured arc starts at the chosen tap point in layer L, either the output of the layer or its MLP input,
            and runs forward to the final norm for the logit, J and R lenses or back to the embedding matrix for the K and S lenses.
          </title>
          {BOXES.map((b, i) => (
            <g key={b.label}>
              <rect x={b.x} y={BOX_Y} width={b.w} height={BOX_H} rx={8} fill="currentColor" fillOpacity={b.hl ? 0.1 : 0.04} stroke="currentColor" strokeOpacity={b.hl ? 0.55 : 0.2} strokeWidth={b.hl ? 1.6 : 1} />
              <text x={b.x + b.w / 2} y={BOX_Y + BOX_H / 2 + 4} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.85}>
                {b.label}
              </text>
              {i < BOXES.length - 1 && <line x1={b.x + b.w} y1={BOX_Y + BOX_H / 2} x2={BOXES[i + 1].x} y2={BOX_Y + BOX_H / 2} stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />}
            </g>
          ))}
          <text x={BOXES[3].x + BOXES[3].w / 2} y={BOX_Y + BOX_H + 38} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            attention → mid → MLP → out
          </text>
          <text x={8} y={BOX_Y + BOX_H + 18} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.5}>
            residual stream →
          </text>

          {/* the two taps */}
          {([["mid", MID_X], ["out", OUT_X]] as const).map(([k, x]) => (
            <g key={k} onClick={() => setTap(k)} style={{ cursor: "pointer" }} role="button" aria-label={`tap ${k}`} aria-pressed={tap === k}>
              <circle cx={x} cy={MID_Y} r={tap === k ? 8 : 5.5} fill={tap === k ? color : "currentColor"} fillOpacity={tap === k ? 1 : 0.35} />
              <text x={x} y={MID_Y + 22} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={tap === k ? 1 : 0.6}>
                {k}
              </text>
            </g>
          ))}

          <path d={path} fill="none" stroke={color} strokeWidth={3} strokeDasharray={lens === "logit" ? "8 5" : undefined} />
          <line x1={tapX} y1={MID_Y - 8} x2={tapX} y2={topY} stroke={color} strokeWidth={3} strokeDasharray={lens === "logit" ? "8 5" : undefined} />
          <polygon
            points={forward ? `${targetX},${topY + 2} ${targetX - 6},${topY - 8} ${targetX + 6},${topY - 8}` : `${targetX},${topY + 2} ${targetX - 6},${topY - 8} ${targetX + 6},${topY - 8}`}
            fill={color}
          />
          <text x={(tapX + targetX) / 2} y={40} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, monospace" fill={color}>
            {forward ? (lens === "logit" ? "no Jacobian: J_L = I" : "J_L: mean Jacobian, layer L → final residual") : "K_L: mean Jacobian, embeddings → layer L"}
          </text>
          <text x={(tapX + targetX) / 2} y={56} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.65}>
            {forward ? "then read with W_U" : "then read with W_E"}
          </text>
        </svg>

        <div className="mt-1 flex items-center gap-1">
          <span className="mr-1 font-mono text-[11px] text-muted-foreground">tap</span>
          {(["mid", "out"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTap(k)}
              aria-pressed={tap === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tap === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "mid" ? "mid: the layer's MLP input" : "out: the layer's output"}
            </button>
          ))}
        </div>

        <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
          <dt className="font-mono text-[11px] text-muted-foreground">read of h</dt>
          <dd className="font-mono text-[12px]">{info.formula}</dd>
          <dt className="font-mono text-[11px] text-muted-foreground">answers</dt>
          <dd>{info.answers}</dd>
          <dt className="font-mono text-[11px] text-muted-foreground">origin</dt>
          <dd>{info.origin}</dd>
          <dt className="font-mono text-[11px] text-muted-foreground">in the catalog</dt>
          <dd>
            {rule ? (
              <>
                <span className="font-mono text-[12px]">{rule.cols}</span> — {rule.what}
              </>
            ) : (
              "not shipped; used only as a comparison in the authors’ checks"
            )}
          </dd>
        </dl>
      </div>
    </figure>
  )
}
