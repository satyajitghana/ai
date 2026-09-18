// Server-rendered, zero JS.
//
// R4T's pitch is that RL runs "once as an objective transducer": a reward
// nobody can backprop through gets compiled into ordinary supervised targets,
// and a small model is trained on those. This draws the three stages with the
// thing that gets lost between them -- the reward's dominant term.
//
// The OAR reward is R = 0.6*groundedness + 0.2*diversity + 0.2*alignment
// (paper, Eq. 1 and the sentence under Eq. 4). The deployed artifact is
// R4T-Diffusion, which emits content embeddings directly and never produces a
// sub-query. Groundedness is defined as the distance from a SUB-QUERY embedding
// to its nearest database item (Eq. 3), and the LLM judge scores it as "how
// accurately each retrieved collection corresponds to its generating
// sub-query" (Appendix B.1). With no sub-query there is nothing to score, which
// is why Table 1 prints "\" in the Groundedness column for R4T-Diffusion -- and
// therefore no Average either. Every number the paper reports for the model it
// actually ships is drawn from the 40% of the objective that survives.

const GROUND = "oklch(0.60 0.15 255)"
const DIV = "oklch(0.62 0.15 150)"
const ALIGN = "oklch(0.70 0.16 60)"
const MUTED = "oklch(0.60 0.02 260)"

type Stage = {
  n: string
  title: string
  trains: string
  optimizes: string
  hardware: string
  scale: string
}

const STAGES: Stage[] = [
  {
    n: "1",
    title: "Fan-out LM (FOLM)",
    trains: "Gemma3-4B or Qwen3-4B, by Soft-GRPO",
    optimizes: "the full composite reward, all three terms",
    hardware: "TPUv6e-16",
    scale: "lr 1e-7, global batch 512, group size 8",
  },
  {
    n: "2",
    title: "Supervision synthesis",
    trains: "nothing — the FOLM is frozen and sampled",
    optimizes: "nothing; Figure 1 shows no reward filter here",
    hardware: "TPUv6e-4",
    scale: "128 samples per query at T = 0.9, over 43,874 queries",
  },
  {
    n: "3",
    title: "Diffusion retriever",
    trains: "53.9M DiT, 6 layers, L = 12 × d = 128",
    optimizes: "denoising MSE against those targets — the reward is gone",
    hardware: "TPUv6e-16",
    scale: "10,000,000 steps at batch 512, 256 solver steps at inference",
  },
]

const BAR_W = 640
const BAR_H = 26
const BAR_X = 8

function RewardBar({ dimmed }: { dimmed: boolean }) {
  const parts = [
    { w: 0.6, c: GROUND, label: "groundedness  λ 0.6", dim: dimmed },
    { w: 0.2, c: DIV, label: "diversity  0.2", dim: false },
    { w: 0.2, c: ALIGN, label: "alignment  0.2", dim: false },
  ]
  let x = BAR_X
  return (
    <g>
      {parts.map((p) => {
        const w = p.w * BAR_W
        const el = (
          <g key={p.label}>
            <rect
              x={x}
              y={0}
              width={w}
              height={BAR_H}
              rx={3}
              fill={p.dim ? MUTED : p.c}
              fillOpacity={p.dim ? 0.18 : 0.85}
              stroke={p.dim ? MUTED : p.c}
              strokeOpacity={p.dim ? 0.5 : 0}
              strokeDasharray={p.dim ? "4 3" : undefined}
            />
            <text
              x={x + w / 2}
              y={BAR_H / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              className="font-mono"
              fill={p.dim ? "var(--muted-foreground)" : "white"}
            >
              {p.dim ? "not measurable" : p.label}
            </text>
          </g>
        )
        x += w + 2
        return el
      })}
    </g>
  )
}

export function ObjectiveTransducer() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          RL once, as a compiler — and what does not survive the compile
        </span>
      </div>

      <ol className="m-0 grid list-none gap-0 p-0 sm:grid-cols-3">
        {STAGES.map((s, i) => (
          <li
            key={s.n}
            className={`border-b p-4 ${i < 2 ? "sm:border-r sm:border-b-0" : ""}`}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">step {s.n}</span>
              <span className="text-sm font-medium">{s.title}</span>
            </div>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div>
                <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  trains
                </dt>
                <dd className="m-0 leading-5">{s.trains}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  optimizes
                </dt>
                <dd className="m-0 leading-5">{s.optimizes}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  {s.hardware}
                </dt>
                <dd className="m-0 font-mono text-[11px] leading-5 text-muted-foreground">
                  {s.scale}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
            what step 1 optimizes (Eq. 1)
          </div>
          <svg
            viewBox={`0 0 ${BAR_W + 16} ${BAR_H}`}
            className="w-full"
            role="img"
            aria-label="The OAR composite reward split into three weighted terms: groundedness at 0.6 of the weight, diversity at 0.2 and alignment at 0.2."
          >
            <RewardBar dimmed={false} />
          </svg>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
            what step 3&rsquo;s output can be scored on (Table 1)
          </div>
          <svg
            viewBox={`0 0 ${BAR_W + 16} ${BAR_H}`}
            className="w-full"
            role="img"
            aria-label="The same three terms for the deployed diffusion retriever: the groundedness term, 0.6 of the weight, is greyed out and marked not measurable, because the diffusion model emits no sub-query for groundedness to be defined against. Only diversity and alignment remain."
          >
            <RewardBar dimmed />
          </svg>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Weights from Eq. 1 and §2.2.1; stage hardware and hyperparameters from Appendix F and Table 3;
        the empty Groundedness and Average cells for R4T-Diffusion are Table 1&rsquo;s own
        (arXiv:2603.06397v1).
      </figcaption>
    </figure>
  )
}
