// Four Empero distillations, and the moment the metric regime changed.
//
// Server-rendered, zero JS. Only +, -, * and / — exact under IEEE-754, so
// lib/dmath is not needed.
//
// Every delta below is copied from an Empero model card, not recomputed:
//   - Qwen3.8-2B / -4B / -9B-Distill (15 Aug 2026), all distilled from
//     Qwen3.5 bases, all reporting gsm8k_cot and mmlu_flan_cot_zeroshot under
//     lm-eval's two extraction filters.
//   - Qwen3.8-35B-A3B-Distill (16 Sep 2026), distilled from a Qwen3.6-35B-A3B
//     base, reporting MMLU / ARC-Challenge / ARC-Easy, "zero-shot,
//     loglikelihood scoring."
//
// The distinction the chart encodes is not "which benchmark" but "does the
// model generate anything." gsm8k_cot and mmlu_flan_cot_zeroshot are
// generative: the model writes an answer and a regex pulls a number or a
// letter out of it, which is the whole subject of this article. MMLU (acc),
// ARC-Challenge and ARC-Easy are loglikelihood tasks: lm-eval scores the
// summed log-probability of each fixed candidate continuation and picks the
// argmax. Nothing is sampled. No <think> block is ever produced, so a
// distilled chain of thought cannot appear in the score either way.
//
// Denominators, which none of the cards state, are the standard test splits:
// GSM8K 1,319; ARC-Challenge 1,172; ARC-Easy 2,376; MMLU 14,042 (test) versus
// the 1,531-question validation split that mmlu_flan_cot_zeroshot runs on.

type Entry = {
  scale: string
  base: string
  task: string
  delta: number
  n: number
  generative: boolean
}

const ENTRIES: Entry[] = [
  { scale: "2B", base: "Qwen3.5-2B", task: "gsm8k_cot, flexible-extract", delta: 0.31, n: 1319, generative: true },
  { scale: "2B", base: "Qwen3.5-2B", task: "gsm8k_cot, strict-match", delta: 0.095, n: 1319, generative: true },
  { scale: "2B", base: "Qwen3.5-2B", task: "mmlu CoT, flexible-extract", delta: 0.265, n: 1531, generative: true },
  { scale: "4B", base: "Qwen3.5-4B", task: "gsm8k_cot", delta: -0.065, n: 1319, generative: true },
  { scale: "9B", base: "Qwen3.5-9B", task: "gsm8k_cot", delta: -0.015, n: 1319, generative: true },
  { scale: "35B-A3B", base: "Qwen3.6-35B-A3B", task: "MMLU, acc", delta: -0.004, n: 14042, generative: false },
  { scale: "35B-A3B", base: "Qwen3.6-35B-A3B", task: "ARC-Easy, acc", delta: 0.011, n: 2376, generative: false },
  { scale: "35B-A3B", base: "Qwen3.6-35B-A3B", task: "ARC-Challenge, acc", delta: 0.034, n: 1172, generative: false },
  { scale: "35B-A3B", base: "Qwen3.6-35B-A3B", task: "ARC-Challenge, acc_norm", delta: 0.044, n: 1172, generative: false },
  { scale: "35B-A3B", base: "Qwen3.6-35B-A3B", task: "ARC-Easy, acc_norm", delta: 0.048, n: 2376, generative: false },
]

const GEN_COLOR = "oklch(0.62 0.15 255)"
const LL_COLOR = "oklch(0.68 0.13 150)"

const genCount = ENTRIES.filter((e) => e.generative).length
const llCount = ENTRIES.length - genCount

export function ScaleLadder() {
  const W = 560
  const LABEL_W = 178
  const plotW = W - LABEL_W - 56
  const zero = LABEL_W + plotW / 2
  const span = 0.32 // widest |delta| is 0.310
  const px = (d: number) => (d / span) * (plotW / 2)
  const rowH = 17
  const H = 30 + ENTRIES.length * rowH + 22

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          every delta Empero has published, across four scales
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">card-reported, not recomputed</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="w-full">
          <title>
            {`Ten reported deltas across four Empero distillations. The ${genCount} from the 2B, 4B and 9B releases come from generative tasks scored by regex extraction; the ${llCount} from the 35B-A3B release come from loglikelihood tasks in which the model generates nothing.`}
          </title>
          <line x1={zero} y1={24} x2={zero} y2={H - 22} stroke="currentColor" strokeOpacity={0.25} />
          <text
            x={zero}
            y={18}
            fontSize={8}
            textAnchor="middle"
            fill="currentColor"
            fillOpacity={0.5}
            fontFamily="ui-monospace, monospace"
          >
            0
          </text>
          {ENTRIES.map((e, i) => {
            const y = 30 + i * rowH
            const w = px(e.delta)
            const color = e.generative ? GEN_COLOR : LL_COLOR
            const isFirstOfScale = i === 0 || ENTRIES[i - 1].scale !== e.scale
            return (
              <g key={`${e.scale}-${e.task}`}>
                {isFirstOfScale ? (
                  <text
                    x={0}
                    y={y + 9}
                    fontSize={9}
                    fill="currentColor"
                    fontFamily="ui-monospace, monospace"
                  >
                    {e.scale}
                  </text>
                ) : null}
                <text
                  x={48}
                  y={y + 9}
                  fontSize={8}
                  fill="currentColor"
                  fillOpacity={0.7}
                  fontFamily="ui-monospace, monospace"
                >
                  {e.task}
                </text>
                <rect
                  x={w >= 0 ? zero : zero + w}
                  y={y + 2}
                  width={Math.abs(w) < 1 ? 1 : Math.abs(w)}
                  height={10}
                  rx={1.5}
                  fill={color}
                  fillOpacity={0.85}
                />
                <text
                  x={w >= 0 ? zero + Math.abs(w) + 5 : zero - Math.abs(w) - 5}
                  y={y + 10.5}
                  fontSize={8}
                  textAnchor={w >= 0 ? "start" : "end"}
                  fill="currentColor"
                  fillOpacity={0.8}
                  fontFamily="ui-monospace, monospace"
                >
                  {e.delta > 0 ? "+" : ""}
                  {e.delta.toFixed(3)}
                </text>
                <text
                  x={W - 2}
                  y={y + 9}
                  fontSize={7.5}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.45}
                  fontFamily="ui-monospace, monospace"
                >
                  n={e.n.toLocaleString("en-US")}
                </text>
              </g>
            )
          })}
          <text
            x={0}
            y={H - 6}
            fontSize={8}
            fill="currentColor"
            fillOpacity={0.6}
            fontFamily="ui-monospace, monospace"
          >
            <tspan fill={GEN_COLOR}>&#9632;</tspan> generative &mdash; model writes, regex extracts
            &nbsp;&nbsp;
            <tspan fill={LL_COLOR}>&#9632;</tspan> loglikelihood &mdash; model generates nothing
          </text>
        </svg>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The colours are the story. Every number Empero published for the 2B, 4B and 9B releases came from a task
          where the model writes an answer and an extractor goes looking for it &mdash; which is where the
          flexible-extract problem lives, and where the 2B&rsquo;s headline{" "}
          <span className="font-mono text-xs">+0.310</span> came from. Every number published for the 35B-A3B comes
          from a task where nothing is generated at all: lm-eval sums the log-probability of each fixed candidate
          continuation and takes the argmax. No sampling, no{" "}
          <code className="font-mono text-xs">&lt;think&gt;</code> block, no extraction step, and therefore no
          filter to pick between. The bad metric is gone because the task that exposed it is gone. What replaced it
          cannot see the thing being sold: a model whose entire pitch is distilled chain-of-thought is now
          evaluated exclusively on benchmarks in which it never gets to think.
        </p>
      </div>
    </figure>
  )
}
