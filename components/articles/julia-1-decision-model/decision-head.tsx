"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One request through Julia-1, laid out the way the model sees it.
//
// Nothing runs in the browser. Every number below was recorded on 2026-09-27
// by running SupersonicLabs/Julia-1-ONNX (the official export, onnxruntime
// 1.30 on CPU) behind my own reimplementation of julia/data.py's serializer.
// That serializer reproduces the Rust encoder's reference token ids exactly and
// the 100 published PyTorch parity logits to within 7.3e-5.
//
// The first preset is the model card's own example. The other five are the
// five questions of typed-decisions test case customer_service_000000, with the
// dataset's gold labels. Token counts are Gemma-2 tokenizer counts for each
// segment; markers are the positions whose final hidden state is scored.

type Preset = {
  id: string
  name: string
  kind: "choice" | "score" | "noul"
  question: string
  stateNote: string
  keys: string[]
  options: string[]
  logits: number[]
  probs: number[]
  head: number
  optionTokens: number[]
  state: number
  total: number
  markers: number[]
  gold: string | null
  readout: string
}

const CUSTOMER =
  "customer_service_000000 · a JSON state: account {tier: free, tenure 5 months, …} and a three-turn thread (“the item inside isn’t what I ordered …”)"

const PRESETS: Preset[] = [
  {
    id: "card",
    name: "the card's example · choice",
    kind: "choice",
    question: "Which team should handle this request?",
    stateNote: "“I was charged twice for the same order.”",
    keys: ["billing", "shipping", "access"],
    options: ["Billing and payment disputes", "Shipping and delivery", "Account access and login"],
    logits: [-5.26, -7.049, -10.994],
    probs: [0.8545, 0.1428, 0.0028],
    head: 10,
    optionTokens: [4, 3, 4],
    state: 9,
    total: 37,
    markers: [12, 17, 21],
    gold: null,
    readout: "choice = billing (the key; the model never saw the word “billing”)",
  },
  {
    id: "category",
    name: "category · choice",
    kind: "choice",
    question: "What is this customer conversation primarily about?",
    stateNote: CUSTOMER,
    keys: ["account", "billing", "delivery", "refund", "technical"],
    options: [
      "Login, plan changes, profile or access management.",
      "A charge, invoice, subscription or payment problem.",
      "Shipping, fulfilment or delivery of a physical item.",
      "The customer is explicitly asking for money back.",
      "The product or service is not working as expected.",
    ],
    logits: [-11.099, -10.762, 7.901, -11.272, -10.118],
    probs: [0, 0, 1, 0, 0],
    head: 11,
    optionTokens: [10, 10, 10, 9, 10],
    state: 184,
    total: 253,
    markers: [13, 24, 35, 46, 56],
    gold: "delivery",
    readout: "choice = delivery",
  },
  {
    id: "action",
    name: "action · choice",
    kind: "choice",
    question: "What should the assistant do next with this conversation?",
    stateNote: CUSTOMER,
    keys: ["answer_directly", "close_no_action", "escalate_to_human", "execute_refund", "request_information"],
    options: [
      "The assistant can resolve this itself with information it already has.",
      "No further action is warranted; the matter is settled.",
      "Hand off to a human agent with the appropriate authority.",
      "Issue the refund or credit the customer is owed.",
      "More detail is needed from the customer before anything can be done.",
    ],
    logits: [3.677, -9.818, -7.422, -8.672, 5.333],
    probs: [0.1604, 0, 0, 0, 0.8396],
    head: 13,
    optionTokens: [12, 11, 11, 10, 13],
    state: 184,
    total: 263,
    markers: [15, 28, 40, 52, 63],
    gold: "answer_directly",
    readout: "choice = request_information",
  },
  {
    id: "churn",
    name: "churn_risk · score",
    kind: "score",
    question: "How likely is this customer to stop doing business with us because of this interaction?",
    stateNote: CUSTOMER,
    keys: ["0", "1", "2", "3"],
    options: [
      "No sign of dissatisfaction.",
      "Mild frustration, but the relationship is intact.",
      "Clearly unhappy; repeat problems or explicit complaints.",
      "Imminent: threatening to cancel, dispute or leave.",
    ],
    logits: [-10.175, -0.232, -10.802, -10.261],
    probs: [0, 0.9999, 0, 0],
    head: 19,
    optionTokens: [5, 9, 9, 11],
    state: 184,
    total: 245,
    markers: [21, 27, 37, 47],
    gold: "1",
    readout: "score = Σ i·pᵢ = 1.000 (expected rubric level); accuracy uses the argmax, level 1",
  },
  {
    id: "urgency",
    name: "urgency · score",
    kind: "score",
    question: "How time-sensitive is this conversation?",
    stateNote: CUSTOMER,
    keys: ["0", "1", "2", "3"],
    options: [
      "No time pressure; can wait indefinitely.",
      "Routine; handle within the normal queue.",
      "Elevated; should be handled within the same week.",
      "Critical; requires action within the same day.",
    ],
    logits: [-10.852, 4.153, -6.685, -11.325],
    probs: [0, 1, 0, 0],
    head: 11,
    optionTokens: [8, 8, 10, 9],
    state: 184,
    total: 238,
    markers: [13, 22, 31, 42],
    gold: "1",
    readout: "score = Σ i·pᵢ = 1.000; argmax level 1",
  },
  {
    id: "human",
    name: "needs_human · noul",
    kind: "noul",
    question: "This conversation requires a human agent rather than automated handling.",
    stateNote: CUSTOMER,
    keys: ["false", "true"],
    options: [
      "Automation can carry this to resolution.",
      "A human must take over: judgement, authority or empathy is required.",
    ],
    logits: [0.066, -0.945],
    probs: [0.7332, 0.2668],
    head: 15,
    optionTokens: [7, 14],
    state: 184,
    total: 226,
    markers: [17, 25],
    gold: "false",
    readout: "noul = p(true) = 0.267; the options are always [false, true], in that order",
  },
]

const TYPE_ROW = { choice: 0, score: 1, noul: 2 } as const

const PICK = "oklch(0.62 0.16 45)"
const BAR = "oklch(0.60 0.15 255)"
const SEG = {
  special: "oklch(0.55 0.02 260)",
  head: "oklch(0.62 0.12 160)",
  option: "oklch(0.62 0.16 45)",
  state: "oklch(0.60 0.15 255)",
}

type Segment = { label: string; n: number; color: string; title: string }

function segments(p: Preset): Segment[] {
  const out: Segment[] = [
    { label: "CLS", n: 1, color: SEG.special, title: "<bos>, position 0" },
    { label: "Q", n: p.head, color: SEG.head, title: `“${p.kind} question: …”, ${p.head} tokens` },
    { label: "SEP", n: 1, color: SEG.special, title: "<eos>" },
  ]
  p.optionTokens.forEach((n, i) => {
    out.push({
      label: `M${i + 1}`,
      n: n + 1,
      color: SEG.option,
      title: `<mask> at position ${p.markers[i]}, then “${p.options[i]}” (${n} tokens)`,
    })
  })
  out.push({ label: "SEP", n: 1, color: SEG.special, title: "<eos>" })
  out.push({ label: "state", n: p.state, color: SEG.state, title: `state, ${p.state} tokens` })
  out.push({ label: "SEP", n: 1, color: SEG.special, title: "<eos>" })
  return out
}

export function DecisionHead() {
  const [id, setId] = useState(PRESETS[0].id)
  const [showLogits, setShowLogits] = useState(false)
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
  const best = p.probs.indexOf(Math.max(...p.probs))
  const segs = segments(p)
  const lo = Math.min(...p.logits)
  const hi = Math.max(...p.logits)

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
          one request, one forward pass · measured
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {p.total} tokens · {p.options.length} markers
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === p.id}
              onClick={() => setId(x.id)}
              className={pill(x.id === p.id)}
            >
              {x.name}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-relaxed">
          <div>
            <span className="text-muted-foreground">state: </span>
            {p.stateNote}
          </div>
          <div>
            <span className="text-muted-foreground">question: </span>
            {p.question}
          </div>
        </div>

        <div className="mt-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          1 · what the encoder reads, to scale
        </div>
        <div className="mt-1.5 flex h-5 w-full overflow-hidden rounded-sm" role="img" aria-label="token layout">
          {segs.map((s, i) => (
            <span
              key={i}
              title={s.title}
              className="h-full border-r border-background last:border-r-0"
              style={{ flexGrow: s.n, flexBasis: 0, minWidth: 4, background: s.color, opacity: 0.8 }}
            />
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
          <span style={{ color: SEG.special }}>■</span> CLS/SEP{" "}
          <span style={{ color: SEG.head }}>■</span> “{p.kind} question: …” ({p.head}){" "}
          <span style={{ color: SEG.option }}>■</span> a &lt;mask&gt; plus each option (
          {p.optionTokens.map((n) => n + 1).join(" + ")}){" "}
          <span style={{ color: SEG.state }}>■</span> state ({p.state}). Markers at positions{" "}
          {p.markers.join(", ")}.
        </p>

        <div className="mt-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          2 · after the 22 encoder layers: add one type row to every position
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(["choice", "score", "noul"] as const).map((k) => (
            <span
              key={k}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[10px]",
                k === p.kind ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground/60",
              )}
            >
              type_emb[{TYPE_ROW[k]}] · {k}
            </span>
          ))}
          <span className="px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
            → 2 more transformer layers → read the {p.options.length} marker states
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            3 · scorer: one number per marker, softmax across them
          </span>
          <button type="button" onClick={() => setShowLogits((v) => !v)} className={pill(showLogits)}>
            {showLogits ? "showing raw logits" : "show raw logits"}
          </button>
        </div>
        <ul className="mt-2 space-y-1.5">
          {p.options.map((opt, i) => {
            const isBest = i === best
            const isGold = p.gold !== null && p.keys[i] === p.gold
            const width = showLogits
              ? hi > lo
                ? ((p.logits[i] - lo) / (hi - lo)) * 100
                : 100
              : p.probs[i] * 100
            return (
              <li key={p.keys[i]} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-2 gap-y-0.5 sm:grid-cols-[11rem_minmax(0,1fr)_4.5rem]">
                <span
                  className="col-span-2 truncate font-mono text-[11px] sm:col-span-1"
                  style={{ color: isBest ? PICK : undefined }}
                  title={opt}
                >
                  {p.keys[i]}
                  {isGold ? " · gold" : ""}
                </span>
                <span className="relative h-3 overflow-hidden rounded-sm bg-muted/40" title={opt}>
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${Math.max(0.5, Math.round(width * 10) / 10)}%`,
                      background: isBest ? PICK : BAR,
                      opacity: isBest ? 0.85 : 0.45,
                    }}
                  />
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums">
                  {showLogits ? p.logits[i].toFixed(2) : p.probs[i].toFixed(4)}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="mt-3 font-mono text-[11px] leading-relaxed">
          <span style={{ color: PICK }}>{p.readout}</span>
          {p.gold !== null && (
            <span className="text-muted-foreground">
              {" "}
              · gold: {p.gold} ({p.keys[best] === p.gold ? "right" : "wrong"})
            </span>
          )}
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Recorded on 2026-09-27 from <code>SupersonicLabs/Julia-1-ONNX</code> on CPU, through my own
        reimplementation of the request serializer (checked against the Rust encoder&apos;s reference ids
        and the 100 published PyTorch logits). The descriptions, not the keys, are what the model reads.
        Gold labels are typed-decisions&apos; own; its gold for <code>action</code> is itself split, 0.50
        on <code>answer_directly</code> and 0.34 on <code>escalate_to_human</code>.
      </figcaption>
    </figure>
  )
}
