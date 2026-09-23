import { cn } from "@/lib/utils"

// Where Ming-Image-0.1-Design's 24,857,847,668 parameters sit, and where the
// arithmetic of one image actually goes.
//
// The parameter rows are summed from the safetensors headers of every shard in
// inclusionAI/Ming-Image-0.1-Design at revision 1cd7fac (8-byte length prefix,
// then the JSON header, both by HTTP range read; no weights downloaded). Every
// tensor's data_offsets span was checked against dtype x shape, and each
// component's sum equals its files' sizes minus their headers exactly.
//
// The FLOP column is arithmetic, not a measurement: 2 x parameters x tokens
// for the linear layers only (attention scores, VAE decode and the optional
// prompt rewriter are excluded). Token counts come from the code: the VAE is
// 8x spatial and the DiT patch is 2, so an image is (H/16) x (W/16) tokens; the
// caption sequence is the 256 learnable query tokens through the connector
// plus the prompt's own hidden states on the direct path. "Active" LLM
// parameters are the dense path plus 8 of 256 routed experts plus the shared
// expert, per token — 789,053,440, which is Ling-mini-2.0's published figure.
//
// Server-rendered, zero JS. Integer multiply, add and divide only.

type Seg = {
  label: string
  params: number
  tone: string
  note: string
  dead?: boolean
}

const SEGMENTS: Seg[] = [
  {
    label: "DiT (the “6B”)",
    params: 6_154_901_056,
    tone: "bg-sky-500/80",
    note: "transformer/ — Z-Image's S3-DiT, BF16",
  },
  {
    label: "LLM routed experts",
    params: 15_300_820_992,
    tone: "bg-foreground/35",
    note: "mllm/ — 19 MoE layers x 256 experts, 8 run per token",
  },
  {
    label: "LLM dense path",
    params: 330_929_408,
    tone: "bg-foreground/55",
    note: "attention, shared experts, three routers, norms",
  },
  {
    label: "LLM embeddings",
    params: 321_912_832,
    tone: "bg-foreground/20",
    note: "157,184 x 2,048 token table",
  },
  {
    label: "LLM lm_head",
    params: 321_912_832,
    tone: "bg-rose-500/60",
    note: "never runs: the pipeline reads hidden states, it never samples a token",
    dead: true,
  },
  {
    label: "vision tower",
    params: 725_549_312,
    tone: "bg-foreground/45",
    note: "Qwen2.5-VL-72B-shaped ViT + projector; idle for text-to-image",
  },
  {
    label: "connector",
    params: 1_310_340_608,
    tone: "bg-amber-500/70",
    note: "connector/ — Qwen2.5-1.5B, FP32, run as a bidirectional encoder",
  },
  {
    label: "connector embed_tokens",
    params: 233_373_696,
    tone: "bg-rose-500/60",
    note: "never runs: the connector is fed inputs_embeds",
    dead: true,
  },
  {
    label: "mlp + VAE",
    params: 31_209_216 + 126_897_716,
    tone: "bg-foreground/70",
    note: "256 query tokens and two projections (FP32); Qwen-Image-Layered's RGBA VAE",
  },
]

const TOTAL = 24_857_847_668
const DIT = 6_154_901_056

// Linear-layer FLOPs for one image, 12 steps (the card's setting).
const P_DIT = 6_154_901_056
const P_LLM_ACTIVE = 789_053_440
const P_CONNECTOR = 1_543_714_304 - 233_373_696
const STEPS = 12
const QUERIES = 256

type Job = {
  label: string
  imageTokens: number
  cfgPasses: number
  note: string
}

const JOBS: Job[] = [
  { label: "text-to-image 1024²", imageTokens: 64 * 64, cfgPasses: 1, note: "CFG 1.0: one pass" },
  { label: "text-to-image 2048²", imageTokens: 128 * 128, cfgPasses: 1, note: "the recommended size" },
  { label: "4 layers at 1024", imageTokens: 64 * 64 * 6, cfgPasses: 2, note: "composite + 4 layers + reference = 6 frames; CFG 2.0" },
  { label: "6 layers at 1024", imageTokens: 64 * 64 * 8, cfgPasses: 2, note: "the released card-making demo" },
]

function flops(job: Job, promptTokens: number) {
  const caption = QUERIES + promptTokens
  const dit = 2 * P_DIT * (job.imageTokens + caption) * STEPS * job.cfgPasses
  const encoders = 2 * P_LLM_ACTIVE * (promptTokens + QUERIES) + 2 * P_CONNECTOR * QUERIES
  return { dit, share: dit / (dit + encoders) }
}

const pct = (n: number, of: number, d = 1) => ((n * 100) / of).toFixed(d)
const bn = (n: number) => (n / 1e9).toFixed(2)
const pf = (n: number) => (n / 1e15).toFixed(2)

export function PipelineLedger() {
  const dead = SEGMENTS.filter((s) => s.dead).reduce((a, s) => a + s.params, 0) + 9_966_336
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-pipeline-ledger={TOTAL}
      aria-label="Parameter ledger of the Ming-Image-0.1-Design pipeline, and the share of arithmetic spent in the DiT"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        inclusionAI/Ming-Image-0.1-Design @ 1cd7fac &mdash; {TOTAL.toLocaleString("en-US")} parameters in 5 components
      </div>

      <div className="px-4 py-4">
        <p className="my-0 font-mono text-xs text-muted-foreground">parameters stored</p>
        <div className="mt-2 flex h-7 overflow-hidden rounded-sm bg-muted/50">
          {SEGMENTS.map((s) => (
            <div
              key={s.label}
              className={cn("h-full", s.tone)}
              style={{ width: `${(s.params * 100) / TOTAL}%` }}
              title={`${s.label}: ${pct(s.params, TOTAL)}%`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
          <span>DiT {pct(DIT, TOTAL)}%</span>
          <span>everything else {pct(TOTAL - DIT, TOTAL)}%</span>
        </div>
      </div>

      <ul className="my-0 list-none space-y-1 border-t px-4 py-3 pl-4 text-xs text-muted-foreground">
        {SEGMENTS.map((s) => (
          <li key={s.label} className="my-0 flex gap-2">
            <span className={cn("mt-1 inline-block h-2 w-2 shrink-0 rounded-xs", s.tone)} />
            <span>
              <span className={cn("font-mono", s.dead ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                {s.label}
              </span>{" "}
              &mdash; {bn(s.params)}B ({pct(s.params, TOTAL)}%). {s.note}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t px-4 py-4">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          linear-layer arithmetic per image, 12 steps &mdash; share spent in the DiT
        </p>
        <div className="mt-3 space-y-3">
          {JOBS.map((j) => {
            const lo = flops(j, 512)
            const hi = flops(j, 4096)
            return (
              <div key={j.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="font-mono text-xs">{j.label}</span>
                  <span className="font-mono text-xs tabular-nums">
                    {pf(lo.dit)}&ndash;{pf(hi.dit)} PFLOP in the DiT &middot;{" "}
                    {pct(hi.share, 1, 2)}&ndash;{pct(lo.share, 1, 2)}%
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-sm bg-muted/50">
                  <div className="h-full bg-sky-500/80" style={{ width: `${hi.share * 100}%` }} />
                </div>
                <p className="mt-0.5 mb-0 text-xs text-muted-foreground">
                  {(j.imageTokens).toLocaleString("en-US")} image tokens &middot; {j.note}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        The two bars answer different questions. By storage the DiT is a quarter of
        the download; by arithmetic it is essentially all of it, because the 17.0B
        language model is a mixture of experts that runs 0.79B parameters per token
        over a few hundred prompt tokens once, while the DiT runs all 6.15B over
        every image token on every step. The ranges span a 512- to 4,096-token
        prompt. {bn(dead)}B parameters ({pct(dead, TOTAL)}%) never run on any
        path: the LLM&rsquo;s <code>lm_head</code>, the connector&rsquo;s token
        table and the LLM&rsquo;s audio router.
      </figcaption>
    </figure>
  )
}
