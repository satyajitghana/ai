import { cn } from "@/lib/utils"

// What each component of Ming-Image-0.1-Design is made from, how that was
// established, and what licence the upstream carries — against the single
// MIT licence both Hub repos declare.
//
// "How established" is graded by strength. A matching SHA-256 is identity. A
// weight fingerprint is a handful of small tensors range-read from both
// checkpoints and compared (see WeightFingerprint for the DiT's). A shape match
// alone would only establish architecture, and no row here rests on shape
// alone. Upstream licences are the Hub's own licence metadata for each repo,
// read on 23 September 2026, and for the Qwen licence its LICENSE file.
//
// Server-rendered, zero JS.

type Strength = "identical" | "fingerprint" | "own"
type Row = {
  part: string
  params: string
  upstream: string
  evidence: string
  strength: Strength
  licence: string
  restrictive?: boolean
  credited: string
}

const ROWS: Row[] = [
  {
    part: "transformer/ (the “6B”)",
    params: "6.15B",
    upstream: "Tongyi-MAI/Z-Image",
    evidence:
      "same parameter count to the unit (Layer); 631 of diffusers' 653 Z-Image lines in the code; last-block adaLN bias 0.84% away",
    strength: "fingerprint",
    licence: "Apache-2.0",
    credited: "no — file header reads “Copyright (c) Ant Group”",
  },
  {
    part: "vae/",
    params: "0.13B",
    upstream: "Qwen/Qwen-Image-Layered",
    evidence: "SHA-256 06520463… identical: the same file",
    strength: "identical",
    licence: "Apache-2.0",
    credited: "code header only; the weights are not attributed",
  },
  {
    part: "mllm/ language model",
    params: "16.28B",
    upstream: "inclusionAI/Ling-mini-2.0",
    evidence: "same shape plus two modality routers; norm scales 1.5\u20131.7% away",
    strength: "fingerprint",
    licence: "MIT",
    credited: "same organisation",
  },
  {
    part: "mllm/ vision tower",
    params: "0.70B",
    upstream: "Qwen/Qwen2.5-VL-72B-Instruct",
    evidence: "merger norm 0.04% away (7B: 3.5%, 32B: 26%); 8,192-wide merger fits only the 72B",
    strength: "fingerprint",
    licence: "Qwen License",
    restrictive: true,
    credited: "code header only; no “Built with Qwen” notice",
  },
  {
    part: "connector/",
    params: "1.54B",
    upstream: "Qwen/Qwen2.5-1.5B",
    evidence: "attention biases 0.08\u20131.5% away; stored in FP32",
    strength: "fingerprint",
    licence: "Apache-2.0",
    credited: "no",
  },
  {
    part: "mlp/",
    params: "0.03B",
    upstream: "Ming's own",
    evidence: "256 learnable query tokens and three projections",
    strength: "own",
    licence: "—",
    credited: "—",
  },
]

const STRENGTH: Record<Strength, { label: string; tone: string }> = {
  identical: { label: "byte-identical", tone: "bg-sky-600/90" },
  fingerprint: { label: "weight fingerprint", tone: "bg-sky-500/50" },
  own: { label: "new in this release", tone: "bg-foreground/25" },
}

export function LineageLedger() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-lineage-ledger={ROWS.length}
      aria-label="Upstream origin, evidence and licence of each component of Ming-Image-0.1-Design"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        declared: MIT, both repos &mdash; inherited: what the parts came with
      </div>

      <ul className="my-0 list-none divide-y pl-0">
        {ROWS.map((r) => (
          <li key={r.part} className="my-0 grid gap-x-4 gap-y-1 px-4 py-3 text-xs sm:grid-cols-[11rem_1fr_7rem]">
            <div>
              <div className="font-mono text-[11px] text-foreground">{r.part}</div>
              <div className="font-mono text-[11px] tabular-nums text-muted-foreground">{r.params}</div>
            </div>
            <div>
              <div className="font-mono text-[11px]">
                <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-xs align-middle", STRENGTH[r.strength].tone)} />
                {r.upstream}
              </div>
              <div className="mt-0.5 text-muted-foreground">{r.evidence}</div>
              <div className="mt-0.5 text-muted-foreground">
                <span className="text-foreground">credited:</span> {r.credited}
              </div>
            </div>
            <div
              className={cn(
                "font-mono text-[11px] sm:text-right",
                r.restrictive ? "font-semibold text-rose-700 dark:text-rose-400" : "text-foreground"
              )}
            >
              {r.licence}
            </div>
          </li>
        ))}
      </ul>

      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 pl-4 font-mono text-xs text-muted-foreground">
        {(Object.keys(STRENGTH) as Strength[]).map((k) => (
          <li key={k} className="my-0">
            <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-xs align-middle", STRENGTH[k].tone)} />
            {STRENGTH[k].label}
          </li>
        ))}
      </ul>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Distances are relative L2 against the named upstream. Four of the five
        inherited parts carry Apache-2.0 or MIT, both of which allow commercial
        use; Apache-2.0 also asks that its licence text and attribution travel
        with redistributed copies, and neither Hub repo carries either. The
        exception is small and specific: a 0.70B vision tower whose nearest
        relative ships under the Qwen License, which asks for a copy of the
        agreement, a &ldquo;Built with Qwen&rdquo; notice, and a separate licence
        above 100 million monthly users. It runs only when an image goes in, for
        layer decomposition and editing, not for text-to-image.
      </figcaption>
    </figure>
  )
}
