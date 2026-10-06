"use client"

import { useState } from "react"

// Every bar below is a number printed on one of Mistral's own launch charts
// (mistral.ai/news/mistral-large-4, 6 October 2026), copied by hand from the
// chart images, plus one aggregate tab built from Artificial Analysis's public
// model data on the same day. Nothing here is re-run. `base` is where the
// chart's own y-axis starts; the "from zero" toggle redraws the same numbers
// on an axis that starts at zero, which is what a bar's length should mean.

type Bar = { m: string; v: number; closed?: boolean; west?: boolean; me?: boolean; note?: string }
type Bench = {
  id: string
  name: string
  base: number
  max: number
  unit: string
  claim: string
  verdict: string
  bars: Bar[]
}

const ML4 = "Mistral Large 4"

const BENCHES: Bench[] = [
  {
    id: "aa",
    name: "AA Intelligence Index",
    base: 0,
    max: 50,
    unit: "",
    claim: "“the best open weights model from US or Europe on aggregated benchmarks” (launch post on X)",
    verdict:
      "Holds, by almost 13 points over the next Western open model. It is also eighth among the open models Artificial Analysis lists, behind seven Chinese ones, three of them with 18B active parameters or fewer.",
    bars: [
      { m: "MiMo-V2.6-Pro", v: 46.3 },
      { m: "GLM-5.3", v: 44.8 },
      { m: "Kimi K3", v: 43.6 },
      { m: "GLM-5.3 Flash", v: 41.8, note: "320B / 18B" },
      { m: "Qwen3.8 2.4T", v: 39.9 },
      { m: "Qwen3.8 Flash Next", v: 39.8, note: "180B / 6B" },
      { m: "DeepSeek V4.1 Flash", v: 39.5, note: "552B / 16B" },
      { m: ML4, v: 38.4, me: true, west: true },
      { m: "DeepSeek V4 Pro", v: 36.0 },
      { m: "Inkling Small", v: 25.7, west: true },
      { m: "Inkling", v: 25.0, west: true },
      { m: "Nemotron 3 Ultra", v: 22.9, west: true },
      { m: "Mistral Large 3", v: 9.3, west: true },
    ],
  },
  {
    id: "deepswe",
    name: "DeepSWE 1.1",
    base: 40,
    max: 72,
    unit: "%",
    claim: "61.7% on DeepSWE v1.1; ahead of DeepSeek V4 Pro 0813 and Qwen3.8 Max on the combined index",
    verdict: "Second of six. Kimi K3 is six points ahead on the same chart.",
    bars: [
      { m: ML4, v: 62, me: true, west: true },
      { m: "Beam (self-reported)", v: 44, west: true },
      { m: "Qwen3.8 Max", v: 51 },
      { m: "DeepSeek V4 Pro 0813", v: 57 },
      { m: "GLM-5.3", v: 61 },
      { m: "Kimi K3", v: 68 },
    ],
  },
  {
    id: "tb4",
    name: "Terminal-Bench 4",
    base: 0,
    max: 45,
    unit: "%",
    claim: "28.3% on Terminal-Bench 4",
    verdict: "Second of five. GLM-5.3 is at 40, twelve points clear.",
    bars: [
      { m: ML4, v: 28, me: true, west: true },
      { m: "DeepSeek V4 Pro 0813", v: 10 },
      { m: "Qwen3.8 Max", v: 17 },
      { m: "Kimi K3", v: 21 },
      { m: "GLM-5.3", v: 40 },
    ],
  },
  {
    id: "auto",
    name: "AutomationBench",
    base: 0,
    max: 70,
    unit: "%",
    claim: "59.9%, “ahead of Kimi K3, MiMo-V2.6-Pro, and DeepSeek V4 Pro”",
    verdict: "True of the three it names. GLM-5.3, which is on the same chart at 62.2, goes unmentioned.",
    bars: [
      { m: ML4, v: 59.9, me: true, west: true },
      { m: "Mistral Medium 3.5", v: 6.3, west: true },
      { m: "GLM-5.2", v: 28.4 },
      { m: "DeepSeek V4 Pro 0813", v: 56.7 },
      { m: "Qwen3.8 2.4T", v: 57.2 },
      { m: "Kimi K3", v: 58.3 },
      { m: "GLM-5.3", v: 62.2 },
    ],
  },
  {
    id: "cyber",
    name: "AA Cyber Index",
    base: 0,
    max: 100,
    unit: "",
    claim: "“among the top five models globally”; leads open models outside China “by a wide margin”",
    verdict:
      "Top of this chart. The closed models also have safety blocks stacked on top (Opus 5.5 36, GPT-6 Astra 38, Qwen3.8 63), and Mistral's other version of the chart shows GLM-5.3 Flash tied at 50.",
    bars: [
      { m: ML4, v: 50, me: true, west: true },
      { m: "Qwen3.8 2.4T", v: 13, note: "+63 blocked" },
      { m: "Claude Opus 5.5", v: 29, closed: true, west: true, note: "+36 blocked" },
      { m: "GPT-6 Astra", v: 33, closed: true, west: true, note: "+38 blocked" },
      { m: "GLM-5.3", v: 36 },
      { m: "Kimi K3", v: 41 },
      { m: "DeepSeek V4.1 Flash", v: 41 },
      { m: "GLM-5.3 Flash", v: 50, note: "alt chart" },
    ],
  },
  {
    id: "cybergym",
    name: "CyberGym-E2E",
    base: 0,
    max: 100,
    unit: "%",
    claim: "82%, “the highest of any model”",
    verdict: "Holds on the chart: three points over MiMo-V2.6-Pro. The closed models said to score near zero are not on it.",
    bars: [
      { m: ML4, v: 82, me: true, west: true },
      { m: "DeepSeek V4.1 Flash", v: 23 },
      { m: "GLM-5.3", v: 29 },
      { m: "Kimi K3", v: 58 },
      { m: "GLM-5.3 Flash", v: 74 },
      { m: "Grok 4.7", v: 74, closed: true, west: true },
      { m: "MiMo-V2.6-Pro", v: 79 },
    ],
  },
  {
    id: "dense",
    name: "Dense200 (boxes)",
    base: 0,
    max: 50,
    unit: "",
    claim: "“surpasses closed frontier models on visual grounding”",
    verdict: "Half a point over one closed model, on one benchmark: 42.0 against GPT-6 Astra's 41.5.",
    bars: [
      { m: ML4, v: 42.0, me: true, west: true },
      { m: "DeepSeek V4.1 Flash", v: 3.3 },
      { m: "Kimi K3", v: 28.9 },
      { m: "GPT-6 Astra", v: 41.5, closed: true, west: true },
    ],
  },
  {
    id: "scicode",
    name: "SciCode-Verified",
    base: 65,
    max: 100,
    unit: "%",
    claim: "“state of the art on SciCode-Verified among open-weight models”",
    verdict: "Does not hold on Mistral's own chart: MiMo-V2.6-Pro, GLM-5.3 and Qwen3.8 2.4T, all open weights, are above it.",
    bars: [
      { m: ML4, v: 91.8, me: true, west: true },
      { m: "Mistral Medium 3.5", v: 70, west: true },
      { m: "DeepSeek V4.1 Flash", v: 77.9 },
      { m: "GLM-5.2", v: 88.1 },
      { m: "Kimi K3", v: 90.3 },
      { m: "DeepSeek V4 Pro 0813", v: 91 },
      { m: "Claude Opus 5", v: 91.3, closed: true, west: true },
      { m: "MiMo-V2.6-Pro", v: 91.9 },
      { m: "GLM-5.3", v: 92.5 },
      { m: "Qwen3.8 2.4T", v: 93.8 },
      { m: "GPT-6 Astra", v: 94.2, closed: true, west: true },
    ],
  },
  {
    id: "fin",
    name: "Finance Agent v2",
    base: 20,
    max: 60,
    unit: "%",
    claim: "state of the art among open models on finance; “exceeds GPT-6-Astra”",
    verdict: "Beats GPT-6 Astra by 1.2. GLM-5.3 is 1.1 above it on the same chart.",
    bars: [
      { m: ML4, v: 54.7, me: true, west: true },
      { m: "Mistral Medium 3.5", v: 32.1, west: true },
      { m: "GLM-5.2", v: 49.7 },
      { m: "DeepSeek V4 Pro 0813", v: 50.4 },
      { m: "Qwen3.8 Max", v: 50.6 },
      { m: "Kimi K3", v: 53.1 },
      { m: "GPT-6 Astra", v: 53.5, closed: true, west: true },
      { m: "GLM-5.3", v: 55.8 },
    ],
  },
  {
    id: "harvey",
    name: "Harvey Legal Agent",
    base: 0,
    max: 17,
    unit: "%",
    claim: "“outperforms all open-source models” on Harvey's Legal Agent benchmark",
    verdict: "Holds, the clearest lead in the post: 15.8 against Kimi K3's 12.9. Every model on the chart is below 16.",
    bars: [
      { m: ML4, v: 15.8, me: true, west: true },
      { m: "GPT-6 Astra", v: 5.4, closed: true, west: true },
      { m: "GLM-5.2", v: 7.1 },
      { m: "DeepSeek V4 Pro 0813", v: 7.5 },
      { m: "GLM-5.3", v: 8.3 },
      { m: "Qwen3.8 Max", v: 10.4 },
      { m: "Kimi K3", v: 12.9 },
    ],
  },
]

export function ClaimCheck() {
  const [id, setId] = useState("aa")
  const [fromZero, setFromZero] = useState(false)
  const b = BENCHES.find((x) => x.id === id) ?? BENCHES[0]
  const base = fromZero ? 0 : b.base
  const span = b.max - base
  const pct = (v: number) => Math.max(0.5, ((v - base) / span) * 100)
  const sorted = [...b.bars].sort((x, y) => y.v - x.v)
  const rank = sorted.findIndex((x) => x.me) + 1

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">The claim, then the chart it sits on</div>
      <div className="mt-2 flex flex-wrap gap-1 font-mono text-[11px]">
        {BENCHES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setId(x.id)}
            className={`rounded-md border px-2 py-0.5 ${x.id === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {x.name}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm">
        <span className="text-muted-foreground">Claim:</span> {b.claim}
      </p>

      <div className="mt-3 space-y-1.5">
        {sorted.map((r) => (
          <div key={r.m} className="grid grid-cols-[minmax(0,9.5rem)_1fr] items-center gap-2 sm:grid-cols-[12rem_1fr]">
            <div className={`truncate font-mono text-[11px] ${r.me ? "font-semibold text-foreground" : "text-muted-foreground"}`} title={r.m}>
              {r.m}
              {r.closed ? <span className="ml-1 text-[9px] uppercase">closed</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 flex-1 overflow-hidden rounded bg-muted/40">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${pct(r.v).toFixed(2)}%`,
                    background: r.me ? "#ea580c" : r.closed ? "#64748b" : r.west ? "#2563eb" : "#a8a29e",
                  }}
                />
              </div>
              <span className="w-[4.5rem] shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                <strong className={r.me ? "text-foreground" : ""}>{r.v.toFixed(1)}</strong>
                {b.unit}
                {r.note ? <span className="block text-[9px] leading-tight">{r.note}</span> : null}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
        <span>
          axis starts at {base}
          {b.base > 0 && !fromZero ? " (as on Mistral's chart)" : ""} · rank {rank} of {b.bars.length}
        </span>
        {b.base > 0 ? (
          <button type="button" onClick={() => setFromZero((z) => !z)} className="rounded-md border px-2 py-0.5 hover:text-foreground">
            {fromZero ? "use Mistral's axis" : "redraw from zero"}
          </button>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#ea580c" }} />Mistral Large 4</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#2563eb" }} />US or Europe, open</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#a8a29e" }} />China, open</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#64748b" }} />closed</span>
      </div>

      <p className="mt-3 rounded-lg border p-2 text-sm">
        <span className="text-muted-foreground">On the chart:</span> {b.verdict}
      </p>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Values copied from Mistral&apos;s launch charts; the first tab is Artificial Analysis&apos;s public Intelligence Index for open-weight models, with Mistral Large 4 added although Artificial Analysis lists it as proprietary until the weights ship. Nothing re-run.
      </figcaption>
    </figure>
  )
}
