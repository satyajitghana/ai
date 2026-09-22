"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Needle 3's refusal contract is three mechanisms, not one. A local fine-tune
// removes exactly one of them, and it is the only one that is a number.
//
// The three, as Cactus documents them:
//   grammar   — the byte-level grammar compiled from your schemas permits the
//               empty call [] as a valid completion. "A request no declared tool
//               can serve returns the empty call [], which is the whole contract
//               for refusal." Needs no score.
//   floor     — confidence is min(a calibrated post-hoc head over the prompt and
//               the finished call, the decode probability of the call's tokens),
//               and the engine withholds anything under 0.1 into suppressed_calls.
//   grounding — rule-based gates on top of both: negated verbs, quoted commands
//               attributed to someone else, required enums filled with values
//               never named, reversed source/destination pairs, and so on.
//
// What a local fine-tune does, verified in cactus-needle 3.0.4:
//   needle/model/finetune.py, build_main():
//     if ConfidenceHead.key in params:
//         params = {k: v for k, v in params.items() if k != ConfidenceHead.key}
//         print("  dropped   the confidence head; it is not trained locally, ...")
//   needle/__init__.py: the wrapper then sets response["confidence"] = None and
//   warns once at construction.
//
// The grammar and the grounding gates are unaffected — they live in the engine
// and in the Python layer, not in the weights. The floor's first argument is
// gone. What the engine does with the second argument alone is NOT documented,
// and I did not run the engine, so that cell is marked unknown rather than
// guessed.

type Fate = "kept" | "lost" | "unknown"

interface Gate {
  k: string
  name: string
  where: string
  base: string
  tuned: string
  fate: Fate
}

const GATES: Gate[] = [
  {
    k: "grammar",
    name: "the empty call",
    where: "byte-level grammar, compiled from your schemas",
    base: "A request no declared tool can serve parses as `[]`. Off-topic detection needs no score at all — the refusal is one of the completions the grammar always permitted.",
    tuned:
      "Unchanged. The grammar is compiled from the tool schemas at construction, not stored in the weights, so a tuned archive keeps it. This is the mechanism a locally tuned model still has.",
    fate: "kept",
  },
  {
    k: "floor",
    name: "the confidence floor",
    where: "min(calibrated head, decode probability) < 0.1 → suppressed_calls",
    base: "The engine withholds a call it produced but does not trust, before you see it. A fluent call the head doubts scores low; a call the head likes but the decoder stumbled through scores low too.",
    tuned:
      "`needle build --lora` deletes confidence_head from the parameter dict, so the archive carries no head manifest at all. The Python wrapper reports confidence as None and warns once. What the engine's 0.1 floor now compares against — the decode probability alone, or nothing — is not documented anywhere I could find.",
    fate: "unknown",
  },
  {
    k: "grounding",
    name: "the grounding gates",
    where: "rule-based, applied over the finished call",
    base: "A call is withheld outright when the request negates the tool's verb, quotes a command attributed to someone else, fills a required enum with a value it never named, or reverses a source/destination pair.",
    tuned:
      "Unchanged. These are rules in the package, independent of the score, and they run on a tuned archive exactly as on the base. They are also the one part of the contract that never needed a model.",
    fate: "kept",
  },
]

const FATE_STYLE: Record<Fate, { label: string; color: string }> = {
  kept: { label: "survives a local fine-tune", color: "oklch(0.58 0.15 155)" },
  lost: { label: "removed by a local fine-tune", color: "oklch(0.62 0.19 27)" },
  unknown: { label: "one of its two inputs is deleted", color: "oklch(0.68 0.13 85)" },
}

export function RefusalGates() {
  const [sel, setSel] = useState("floor")
  const [tuned, setTuned] = useState(true)
  const g = GATES.find((x) => x.k === sel) ?? GATES[0]
  const style = FATE_STYLE[g.fate]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          &ldquo;empty list, not a guess&rdquo; &mdash; three mechanisms, one fine-tune
        </span>
        <div className="flex gap-1">
          {(
            [
              [false, "base weights"],
              [true, "locally tuned"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setTuned(v)}
              aria-pressed={tuned === v}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors",
                tuned === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/35",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {GATES.map((x) => {
            const st = FATE_STYLE[x.fate]
            const dimmed = tuned && x.fate !== "kept"
            return (
              <button
                key={x.k}
                type="button"
                onClick={() => setSel(x.k)}
                aria-pressed={x.k === sel}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors",
                  x.k === sel ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/20",
                )}
              >
                <div
                  className="font-mono text-[11px]"
                  style={{ color: dimmed ? st.color : undefined, opacity: dimmed ? 1 : 0.95 }}
                >
                  {x.name}
                </div>
                <div className="mt-0.5 font-mono text-[9px] leading-4 text-muted-foreground">{x.where}</div>
                <div
                  className="mt-1.5 h-1 w-full rounded-full"
                  style={{
                    background: tuned ? st.color : "oklch(0.58 0.15 155)",
                    opacity: tuned && x.fate !== "kept" ? 1 : 0.45,
                  }}
                />
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-foreground">{g.name}</span>
            <span className="font-mono text-[10px]" style={{ color: style.color }}>
              {tuned ? style.label : "active"}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{tuned ? g.tuned : g.base}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two of the three are code and survive. The third is the only one that produces a number, and it is the
          one the free path removes &mdash; not by accident, but because the head was never in the training graph
          to begin with. Cactus&rsquo;s own advice for the gap is to run two models: &ldquo;keep the base model
          for the decision and the tuned one for the call.&rdquo; That is a reasonable workaround and it is also
          the shape a 121M-parameter model was supposed to replace.
        </p>
      </div>
    </figure>
  )
}
