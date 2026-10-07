"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One typed-decisions training row on its way to a loss, the way Unsloth's
// Clef path builds it.
//
// Token counts and spans are measured: I re-implemented the text branch of
// Cloudflare's encode_record (unsloth/_vendor/clef/joint_schema_model.py:103-196)
// and ran it with the Qwen3.5-0.8B tokenizer on LocalLLaMA/typed-decisions,
// config customer_service, train row tr_customer_service_000000. Targets are the
// row's own gold probabilities, in the option order question_options() gives
// (choice keys sorted, noul as [true, false], score levels in order).
//
// The predictions in step 4 are NOT a model's output. They are a slider that
// walks from a uniform guess, through the gold distribution, to all mass on
// the gold label, so you can watch what each loss rewards.

type Q = {
  id: string
  type: "choice" | "score" | "noul"
  instruction: string
  qspan: [number, number]
  options: { id: string; start: number; end: number }[]
  target: number[]
  label: string
}

const PREFIX = 36
const STATE = 233
const SCHEMA = 683
const SUFFIX = 18
const TOTAL = PREFIX + STATE + SCHEMA + SUFFIX

const QS: Q[] = [
  {
    id: "action",
    type: "choice",
    instruction: "What should the assistant do next with this conversation?",
    qspan: [293, 303],
    options: [
      { id: "answer_directly", start: 311, end: 333 },
      { id: "close_no_action", start: 338, end: 359 },
      { id: "escalate_to_human", start: 364, end: 386 },
      { id: "execute_refund", start: 391, end: 411 },
      { id: "request_information", start: 416, end: 438 },
    ],
    target: [0.7433, 0.03, 0.2, 0.0033, 0.0233],
    label: "answer_directly",
  },
  {
    id: "category",
    type: "choice",
    instruction: "What is this customer conversation primarily about?",
    qspan: [466, 474],
    options: [
      { id: "account", start: 482, end: 500 },
      { id: "billing", start: 505, end: 523 },
      { id: "delivery", start: 528, end: 547 },
      { id: "refund", start: 552, end: 569 },
      { id: "technical", start: 574, end: 592 },
    ],
    target: [0.9667, 0.0217, 0.005, 0.0017, 0.005],
    label: "account",
  },
  {
    id: "churn_risk",
    type: "score",
    instruction:
      "How likely is this customer to stop doing business with us because of this interaction?",
    qspan: [622, 638],
    options: [
      { id: "0", start: 646, end: 659 },
      { id: "1", start: 664, end: 682 },
      { id: "2", start: 687, end: 704 },
      { id: "3", start: 709, end: 728 },
    ],
    target: [0.0033, 0.0067, 0.05, 0.94],
    label: "3",
  },
  {
    id: "needs_human",
    type: "noul",
    instruction: "This conversation requires a human agent rather than automated handling.",
    qspan: [757, 768],
    options: [
      { id: "true", start: 776, end: 798 },
      { id: "false", start: 803, end: 818 },
    ],
    target: [0.65, 0.35],
    label: "true",
  },
  {
    id: "urgency",
    type: "score",
    instruction: "How time-sensitive is this conversation?",
    qspan: [843, 850],
    options: [
      { id: "0", start: 858, end: 874 },
      { id: "1", start: 879, end: 895 },
      { id: "2", start: 900, end: 920 },
      { id: "3", start: 925, end: 942 },
    ],
    target: [0.0033, 0.28, 0.3167, 0.4],
    label: "3",
  },
]

const STEPS = ["1 · the row", "2 · the prompt", "3 · the head", "4 · the loss"] as const

const C = {
  prefix: "oklch(0.55 0.02 260)",
  state: "oklch(0.60 0.15 255)",
  template: "oklch(0.72 0.03 260)",
  instr: "oklch(0.62 0.12 160)",
  option: "oklch(0.66 0.16 45)",
}
const GOLD = "oklch(0.62 0.12 160)"
const PRED = "oklch(0.66 0.16 45)"

type Seg = { n: number; color: string; title: string }

function layout(): Seg[] {
  const segs: Seg[] = [
    { n: PREFIX, color: C.prefix, title: `system prompt and "STATE:", ${PREFIX} tokens` },
    { n: STATE, color: C.state, title: `the state as compact sorted JSON, ${STATE} tokens` },
  ]
  let at = PREFIX + STATE
  const spans: { s: number; e: number; color: string; title: string }[] = []
  for (const q of QS) {
    spans.push({ s: q.qspan[0], e: q.qspan[1], color: C.instr, title: `${q.id}: instruction span, ${q.qspan[1] - q.qspan[0]} tokens` })
    for (const o of q.options)
      spans.push({ s: o.start, e: o.end, color: C.option, title: `${q.id} / ${o.id}: option span, ${o.end - o.start} tokens` })
  }
  for (const sp of spans) {
    if (sp.s > at) segs.push({ n: sp.s - at, color: C.template, title: "schema template text" })
    segs.push({ n: sp.e - sp.s, color: sp.color, title: sp.title })
    at = sp.e
  }
  const schemaEnd = PREFIX + STATE + SCHEMA
  if (schemaEnd > at) segs.push({ n: schemaEnd - at, color: C.template, title: "schema template text" })
  segs.push({ n: SUFFIX, color: C.prefix, title: `assistant turn, an empty think block, "JOINT SCHEMA DECISIONS:", ${SUFFIX} tokens` })
  return segs
}

const SEGS = layout()

function predicted(target: number[], labelIndex: number, a: number): number[] {
  const n = target.length
  return target.map((t, i) => {
    const u = 1 / n
    const hot = i === labelIndex ? 1 : 0
    const p = a <= 1 ? (1 - a) * u + a * t : (2 - a) * t + (a - 1) * hot
    return Math.max(p, 1e-6)
  })
}

function softCE(t: number[], p: number[]) {
  return -t.reduce((s, ti, i) => s + (ti > 0 ? ti * mlog(p[i]) : 0), 0)
}

export function RecordToLoss() {
  const [step, setStep] = useState(0)
  const [qid, setQid] = useState("action")
  const [a, setA] = useState(0)
  const q = QS.find((x) => x.id === qid) ?? QS[0]
  const li = q.options.findIndex((o) => o.id === q.label)
  const p = predicted(q.target, li, a / 100)
  const total = p.reduce((s, x) => s + x, 0)
  const pn = p.map((x) => x / total)
  const soft = softCE(q.target, pn)
  const entropy = softCE(q.target, q.target.map((x) => Math.max(x, 1e-6)))
  const hard = -mlog(pn[li])
  const brier = pn.reduce((s, x, i) => s + (x - (i === li ? 1 : 0)) ** 2, 0)
  const phase = a < 100 ? "uniform → gold" : a === 100 ? "exactly the gold distribution" : "gold → all mass on the gold label"

  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one typed-decisions row → one Clef training example
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {TOTAL} tokens · 5 questions · 20 options
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s} type="button" aria-pressed={step === i} onClick={() => setStep(i)} className={pill(step === i)}>
              {s}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">state: </span>
              {"{"}account: {"{"}tier: enterprise, tenure_months: 60, seats: 3, …{"}"}, thread: [customer: “after five
              years on the Enterprise plan I’ve decided it’s time to close my account …”, agent: …, customer: …]{"}"}
            </div>
            <ul className="space-y-1">
              {QS.map((x) => {
                const g = x.options.findIndex((o) => o.id === x.label)
                return (
                  <li key={x.id} className="grid grid-cols-[7.5rem_3.5rem_minmax(0,1fr)] gap-x-2">
                    <span>{x.id}</span>
                    <span className="text-muted-foreground">{x.type}</span>
                    <span className="truncate text-muted-foreground" title={x.instruction}>
                      gold {x.label} at {x.target[g].toFixed(2)} · {x.instruction}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="text-muted-foreground">
              Gold is not one label. It is the mean of three teacher samples, so <code>needs_human</code> is 0.65
              true and <code>urgency</code> spreads 0.28 / 0.32 / 0.40 over its top three levels.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="mt-3">
            <div className="flex h-6 w-full overflow-hidden rounded-sm" role="img" aria-label={`token layout of the ${TOTAL}-token prompt`}>
              {SEGS.map((s, i) => (
                <span
                  key={i}
                  title={s.title}
                  className="h-full"
                  style={{ flexGrow: s.n, flexBasis: 0, minWidth: 1, background: s.color, opacity: 0.85 }}
                />
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              <span style={{ color: C.prefix }}>■</span> chat wrapper ({PREFIX} + {SUFFIX}){" "}
              <span style={{ color: C.state }}>■</span> state ({STATE}){" "}
              <span style={{ color: C.template }}>■</span> schema template{" "}
              <span style={{ color: C.instr }}>■</span> instruction spans{" "}
              <span style={{ color: C.option }}>■</span> option spans. Hover a block for its count.
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              Every question and every option is written into one prompt, after the state. The schema is {SCHEMA}{" "}
              tokens, nearly three times the state. The encoder records two kinds of span: each instruction
              (the green blocks) and each option&apos;s <code>{'{"option_id": …, "description": …}'}</code> JSON (the
              orange ones). Nothing else in the prompt is read by position.
            </p>
          </div>
        )}

        {step === 2 && (
          <ol className="mt-3 space-y-2 text-xs leading-relaxed">
            <li>
              <span className="font-mono text-muted-foreground">memory · </span>
              all {TOTAL} final hidden states, layer-normed and projected from 1,024 to 512 wide.
            </li>
            <li>
              <span className="font-mono text-muted-foreground">question vector · </span>
              the mean hidden state over the instruction span ({q.qspan[1] - q.qspan[0]} tokens for{" "}
              <code>{q.id}</code>).
            </li>
            <li>
              <span className="font-mono text-muted-foreground">option query · </span>
              mean hidden state over the option&apos;s span + mean of the frozen output-embedding rows of the same
              tokens + the projected question vector.
            </li>
            <li>
              <span className="font-mono text-muted-foreground">2 routing layers · </span>
              every option query cross-attends to the whole memory.
            </li>
            <li>
              <span className="font-mono text-muted-foreground">fields · </span>
              one per question: question + attention-weighted summary of its options + the last token + a type row.
              4 decoder layers: the 5 fields attend to each other and to the memory.
            </li>
            <li>
              <span className="font-mono text-muted-foreground">logit per option · </span>
              <code>prior + σ(gate) · (scale · cos(field, option) + MLP(field, option))</code>. At initialisation the
              prior scale is e⁰ = 1 and σ(gate) is 0.5, so the untrained head already scores options by how well
              their embedding rows match the prompt&apos;s hidden state.
            </li>
          </ol>
        )}

        {step === 3 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {QS.map((x) => (
                <button key={x.id} type="button" aria-pressed={x.id === q.id} onClick={() => setQid(x.id)} className={pill(x.id === q.id)}>
                  {x.id}
                </button>
              ))}
            </div>
            <label className="mt-3 block font-mono text-[10px] text-muted-foreground">
              illustrative prediction: {phase}
              <Range min={0} max={200} step={1} value={a} onChange={(e) => setA(Number(e.target.value))} className="mt-1.5 w-full" aria-label="move the prediction from uniform to gold to one-hot" />
            </label>
            <ul className="mt-3 space-y-1.5">
              {q.options.map((o, i) => (
                <li key={o.id} className="grid grid-cols-[8.5rem_minmax(0,1fr)_6rem] items-center gap-2">
                  <span className="truncate font-mono text-[11px]">
                    {o.id}
                    {i === li ? " · label" : ""}
                  </span>
                  <span className="relative h-4 overflow-hidden rounded-sm bg-muted/40">
                    <span className="absolute inset-x-0 top-0 h-1/2 rounded-sm" style={{ width: `${q.target[i] * 100}%`, background: GOLD, opacity: 0.75 }} />
                    <span className="absolute inset-x-0 bottom-0 h-1/2 rounded-sm" style={{ width: `${pn[i] * 100}%`, background: PRED, opacity: 0.85 }} />
                  </span>
                  <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {q.target[i].toFixed(3)} / {pn[i].toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              <span style={{ color: GOLD }}>■</span> gold target{" "}
              <span style={{ color: PRED }}>■</span> prediction
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-3">
              <div className="rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">soft cross-entropy (trained on)</dt>
                <dd className="tabular-nums">
                  {soft.toFixed(3)} <span className="text-muted-foreground">floor {entropy.toFixed(3)}</span>
                </dd>
              </div>
              <div className="rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">hard-label CE (calibrated on)</dt>
                <dd className="tabular-nums">{hard.toFixed(3)}</dd>
              </div>
              <div className="rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Brier vs label (off by default)</dt>
                <dd className="tabular-nums">{brier.toFixed(3)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Token counts measured with my re-implementation of Cloudflare&apos;s <code>encode_record</code> and the
        Qwen3.5-0.8B tokenizer, on typed-decisions train row <code>tr_customer_service_000000</code>; targets are
        that row&apos;s gold. The predictions in step 4 are a slider, not a model: soft cross-entropy bottoms out at
        the target&apos;s own entropy when the prediction equals the gold, while the hard-label loss keeps falling
        all the way to one-hot.
      </figcaption>
    </figure>
  )
}
