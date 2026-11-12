// Kimi K3's post-training recipe against Kimi K3.1 Pro's, stage by stage, with
// every box labelled by where it comes from.
//
// K3 column: the Kimi K3 technical report, section 4, as walked through in the
// site's K3 article (SFT cold start, nine RL experts = 3 domains x 3 reasoning
// efforts, Multi-Teacher On-Policy Distillation back into one model).
// K3.1 Pro column: the launch blog (kimi.ai/blog/kimi-k3-1-pro, read again
// 2026-11-12) and the Hugging Face model card and files of
// moonshotai/Kimi-K3.1-Pro (commit d9e99b07, read 2026-11-12).
// "measured" boxes are read from the released files; "reported" boxes are a
// source's words; "not stated" boxes are questions no source answers. The
// K3.1 Pro column does not imply an order between its middle stages: no source
// gives one.
//
// Zero JS. No arithmetic.

type Src = "reported" | "measured" | "not stated"

type Stage = { title: string; body: string; src: Src }

const K3: Stage[] = [
  {
    title: "SFT cold start",
    body: "Supervised fine-tuning gives a starting policy for RL.",
    src: "reported",
  },
  {
    title: "RL: nine separate experts",
    body: "Three domains (general tasks, general agents, coding agents) crossed with three reasoning efforts. Within a domain the max-effort expert is trained first, then a token-budget multiplier is annealed down to get high and low.",
    src: "reported",
  },
  {
    title: "Multi-Teacher On-Policy Distillation",
    body: "The student samples, the matching expert scores each token, and the clipped log-ratio between them is a dense per-token reward inside the same RL framework.",
    src: "reported",
  },
  {
    title: "One checkpoint, three efforts",
    body: "reasoning_effort low, high or max on the K3 card.",
    src: "measured",
  },
]

const K31: Stage[] = [
  {
    title: "Start from the K3 checkpoint",
    body: "“Post-trained from Kimi K3”. Pre-training is not redone.",
    src: "reported",
  },
  {
    title: "Mid-training, cyber data removed",
    body: "Cyber-related data was removed from “both training stages”: the mid-training corpus and the RL environment mix.",
    src: "reported",
  },
  {
    title: "A new indexer in 24 attention layers",
    body: "120 tensors K3 does not have. The card says Gated MLA became Gated DSA. When and how the indexer was trained is not stated.",
    src: "measured",
  },
  {
    title: "Joint RL across hundreds of domains",
    body: "“Substantially larger post-training compute”. No GPU-hours, no ratio to K3, no reward curve, no report.",
    src: "reported",
  },
  {
    title: "Experts and distillation?",
    body: "Whether the nine-expert split, the effort curriculum or on-policy distillation survived. No source says either way.",
    src: "not stated",
  },
  {
    title: "One checkpoint, three efforts",
    body: "reasoning_effort low, high or max on the K3.1 Pro card, the same three as K3.",
    src: "measured",
  },
]

const INFRA = [
  "RL framework",
  "long-context inference",
  "training efficiency",
  "sandbox infrastructure",
  "rollout scheduling",
  "environment quality checks",
]

const TONE: Record<Src, string> = {
  reported: "oklch(0.6 0.17 255)",
  measured: "oklch(0.62 0.16 150)",
  "not stated": "oklch(0.68 0.14 70)",
}

function Column({ name, source, stages }: { name: string; source: string; stages: Stage[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-2">
        <div className="font-mono text-xs font-medium">{name}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{source}</div>
      </div>
      <ol className="space-y-1.5">
        {stages.map((s, i) => (
          <li
            key={s.title}
            className={`rounded-lg border bg-background/40 px-3 py-2 ${s.src === "not stated" ? "border-dashed" : ""}`}
            style={{ borderLeftWidth: 3, borderLeftColor: TONE[s.src] }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-mono text-[11px] font-medium">
                {i + 1}. {s.title}
              </span>
              <span className="font-mono text-[10px]" style={{ color: TONE[s.src] }}>
                {s.src}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function RlRecipes() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">post-training · k3 → k3.1 pro</span>
        <span className="flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(TONE) as Src[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TONE[s] }} />
              {s}
            </span>
          ))}
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        <Column name="Kimi K3" source="K3 technical report, section 4" stages={K3} />
        <Column name="Kimi K3.1 Pro" source="launch blog, model card, released files" stages={K31} />
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">
          what Moonshot says it rebuilt so RL compute pays off &ldquo;stable, predictable&rdquo; (reported)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INFRA.map((x) => (
            <span key={x} className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {x}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        K3&apos;s column is a recipe with named stages. K3.1 Pro&apos;s is a list of facts with no order between stages 2 to 5:
        the sources say what changed, not when. The measured rows are read from the released files; the rest is
        Moonshot&apos;s text.
      </figcaption>
    </figure>
  )
}
