"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Who can read whom, in three decision-model arrangements.
//
// GLiNER2.5-Decide serialises the schema and the text into one sequence —
// `( [P] intent ( [L] refund [L] cancel [L] login ) ) [SEP_TEXT] text…` — and
// runs a bidirectional DeBERTa-v3-large over all of it. The final hidden state
// at each `[L]` marker goes through Linear(1024→2048) → ReLU → Linear(2048→1),
// and the head's softmax is over those scalars. So every label reads the text,
// the text reads every label, and every label reads every other label.
//
// That is why the option list is data (send any labels at call time) and also
// why the order of that list is not invariant by construction: DeBERTa's
// attention is relative-position, and reversing the list changes how far each
// `[L]` sits from the text and from its neighbours. Adding a second head puts
// its labels in the same sequence too.
//
// The other two arrangements are the ones this site has measured before: the
// per-option scorer (each option alone, same position — invariant, cannot see
// the others) and Kev's pointer (one causal sequence, a decide token last).
//
// Cell (row i, column j) is filled when token i can attend to token j. Integer
// geometry only; nothing here needs transcendental maths.

type Family = "gliner" | "isolated" | "causal"
type Order = "given" | "reversed"
type Kind = "struct" | "prompt" | "marker" | "label" | "sep" | "text" | "decide"
type Tok = { t: string; kind: Kind; opt?: number }

const LABELS = ["refund", "cancel", "login"]
const TEXT = ["charged", "twice", "refund?"]

const ACCENT = "oklch(0.60 0.15 255)"
const LABEL = "oklch(0.62 0.16 45)"
const TEXTC = "oklch(0.58 0.12 155)"

function orderLabels(order: Order) {
  return order === "given" ? LABELS : [...LABELS].reverse()
}

function glinerSeq(order: Order, twoHeads: boolean): Tok[] {
  const labs = orderLabels(order)
  const seq: Tok[] = [
    { t: "(", kind: "struct" },
    { t: "[P]", kind: "prompt" },
    { t: "intent", kind: "prompt" },
    { t: "(", kind: "struct" },
  ]
  labs.forEach((l) => {
    seq.push({ t: "[L]", kind: "marker", opt: LABELS.indexOf(l) })
    seq.push({ t: l, kind: "label", opt: LABELS.indexOf(l) })
  })
  seq.push({ t: ")", kind: "struct" }, { t: ")", kind: "struct" })
  if (twoHeads) {
    seq.push(
      { t: "[SEP_STRUCT]", kind: "sep" },
      { t: "[P]", kind: "prompt" },
      { t: "urgency", kind: "prompt" },
      { t: "[L]", kind: "marker" },
      { t: "low", kind: "label" },
      { t: "[L]", kind: "marker" },
      { t: "high", kind: "label" },
    )
  }
  seq.push({ t: "[SEP_TEXT]", kind: "sep" })
  TEXT.forEach((w) => seq.push({ t: w, kind: "text" }))
  return seq
}

function isolatedSeq(order: Order): Tok[] {
  const seq: Tok[] = TEXT.map((w) => ({ t: w, kind: "text" as Kind }))
  seq.push({ t: "intent?", kind: "prompt" })
  orderLabels(order).forEach((l) => seq.push({ t: l, kind: "label", opt: LABELS.indexOf(l) }))
  return seq
}

function causalSeq(order: Order): Tok[] {
  const seq: Tok[] = TEXT.map((w) => ({ t: w, kind: "text" as Kind }))
  seq.push({ t: "intent?", kind: "prompt" })
  orderLabels(order).forEach((l) => seq.push({ t: l, kind: "label", opt: LABELS.indexOf(l) }))
  seq.push({ t: "<decide>", kind: "decide" })
  return seq
}

function canRead(family: Family, seq: Tok[], i: number, j: number) {
  if (family === "gliner") return true
  if (family === "causal") return j <= i
  // isolated: the shared prefix reads itself causally; an option reads the
  // prefix and itself, never another option
  const a = seq[i]
  const b = seq[j]
  if (a.kind !== "label") return b.kind !== "label" && j <= i
  if (b.kind === "label") return i === j
  return true
}

function colour(kind: Kind) {
  if (kind === "marker" || kind === "label") return LABEL
  if (kind === "text") return TEXTC
  if (kind === "decide") return ACCENT
  return "currentColor"
}

const FAMILIES: { id: Family; name: string }[] = [
  { id: "gliner", name: "GLiNER2.5-Decide" },
  { id: "isolated", name: "per-option scorer" },
  { id: "causal", name: "Kev pointer" },
]

export function SequenceMask() {
  const [family, setFamily] = useState<Family>("gliner")
  const [order, setOrder] = useState<Order>("given")
  const [twoHeads, setTwoHeads] = useState(false)

  const seq =
    family === "gliner"
      ? glinerSeq(order, twoHeads)
      : family === "isolated"
        ? isolatedSeq(order)
        : causalSeq(order)

  const n = seq.length
  const cell = n > 20 ? 13 : n > 12 ? 17 : 26
  const labelW = 92
  const top = 92
  const gridW = n * cell
  const W = labelW + gridW + 24
  const H = top + gridW + 16

  // where each option's scoring token sits, and how far it is from the text
  const sepIdx = seq.findIndex((s) => s.kind === "sep" && s.t === "[SEP_TEXT]")
  const firstText = seq.findIndex((s) => s.kind === "text")
  const readout = LABELS.map((l, k) => {
    if (family === "gliner") {
      const at = seq.findIndex((s) => s.kind === "marker" && s.opt === k)
      return { label: l, at, dist: sepIdx - at }
    }
    const at = seq.findIndex((s) => s.kind === "label" && s.opt === k)
    return { label: l, at, dist: family === "isolated" ? 1 : at - (firstText + TEXT.length - 1) }
  })

  const summary =
    family === "gliner"
      ? "every cell is filled: the labels read the text, the text reads the labels, and the labels read each other"
      : family === "isolated"
        ? "no option reads another; each sits one step after the shared prefix, whatever the list order"
        : "an option reads the options before it; the decide token, last, reads everything"

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
          who can read whom · row reads column
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{n} tokens</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={family === f.id}
              onClick={() => setFamily(f.id)}
              className={pill(family === f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={order === "reversed"}
            onClick={() => setOrder((o) => (o === "given" ? "reversed" : "given"))}
            className={pill(order === "reversed")}
          >
            {order === "given" ? "reverse the label list" : "labels reversed"}
          </button>
          {family === "gliner" ? (
            <button
              type="button"
              aria-pressed={twoHeads}
              onClick={() => setTwoHeads((v) => !v)}
              className={pill(twoHeads)}
            >
              {twoHeads ? "second head in the same call" : "add a second head"}
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width={W}
              height={H}
              role="img"
              className="max-w-full"
            >
              <title>
                {`An attention mask for the ${FAMILIES.find((f) => f.id === family)?.name} arrangement, ${n} tokens, labels in ${order} order. ${summary}.`}
              </title>
              {seq.map((tok, j) => (
                <text
                  key={`c-${j}`}
                  x={0}
                  y={0}
                  transform={`translate(${labelW + j * cell + Math.round(cell / 2) + 3} ${top - 6}) rotate(-60)`}
                  fontSize={9}
                  fill={colour(tok.kind)}
                  fillOpacity={tok.kind === "struct" ? 0.5 : 0.9}
                  fontFamily="ui-monospace, monospace"
                >
                  {tok.t}
                </text>
              ))}
              {seq.map((tok, i) => (
                <g key={`r-${i}`}>
                  <text
                    x={labelW - 6}
                    y={top + i * cell + Math.round(cell / 2) + 3}
                    textAnchor="end"
                    fontSize={9}
                    fill={colour(tok.kind)}
                    fillOpacity={tok.kind === "struct" ? 0.5 : 0.9}
                    fontFamily="ui-monospace, monospace"
                  >
                    {tok.t}
                  </text>
                  {seq.map((_, j) => {
                    const on = canRead(family, seq, i, j)
                    const scoring =
                      (family === "gliner" && tok.kind === "marker") ||
                      (family === "isolated" && tok.kind === "label") ||
                      (family === "causal" && tok.kind === "decide")
                    return (
                      <rect
                        key={j}
                        x={labelW + j * cell + 1}
                        y={top + i * cell + 1}
                        width={cell - 2}
                        height={cell - 2}
                        rx={2}
                        fill={on ? (scoring ? LABEL : ACCENT) : "currentColor"}
                        fillOpacity={on ? (scoring ? 0.55 : 0.22) : 0.04}
                      />
                    )
                  })}
                </g>
              ))}
            </svg>
          </div>

          <div className="space-y-3 font-mono text-[11px] leading-relaxed">
            <p className="text-muted-foreground">{summary}.</p>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {family === "gliner"
                  ? "scoring token · distance to [SEP_TEXT]"
                  : family === "isolated"
                    ? "option · distance to the prefix"
                    : "option · distance from the last text token"}
              </div>
              <ul className="mt-1 space-y-0.5">
                {readout.map((r) => (
                  <li key={r.label} className="flex justify-between gap-4">
                    <span style={{ color: LABEL }}>{r.label}</span>
                    <span>{r.dist} tokens</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-muted-foreground">
              {family === "gliner"
                ? twoHeads
                  ? "The urgency labels now sit between the intent labels and the text, and every intent label can read them. Same text, same intent labels, different context."
                  : order === "reversed"
                    ? "Reversing the list moved the first and last [L] markers. Relative-position attention sees those offsets, so the logits can move; training shuffles the list so that they mostly do not."
                    : "Each [L] state goes through Linear(1024→2048), ReLU, Linear(2048→1): one scalar per label, then a softmax across the head."
                : family === "isolated"
                  ? "Reversing changes nothing here: the offsets are identical and no option can see another. The price is that a question whose answer depends on another option cannot be asked."
                  : "Reversing changes what each option can read, since an earlier option is context for a later one. Kev's own ledger measured flips falling from 15.3% to 1.8% with scale."}
            </p>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Drawn from the <code>gliner2</code> 2.0.0 processor
        (<code>_transform_schema</code>, <code>_format_input_with_mapping</code>) and{" "}
        <code>ClassificationScorer</code>: labels become <code>[L]</code> markers in
        the same sequence as the text, and the classifier reads each marker&apos;s
        final state. Word pieces are collapsed to one token per word here; the real
        sequence is longer, and the text is lower-cased before it is encoded. The
        two other arrangements are schematic, after the CUA-S1 and Kev pieces
        linked in the text.
      </figcaption>
    </figure>
  )
}
