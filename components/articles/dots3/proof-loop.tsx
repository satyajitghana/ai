"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Proof -> Verify -> Refine, the three stages the dots team describes, set
// against the formal-verification alternative it deliberately does not use.
//
// Everything here is from the dots team's own account of the run. No timings,
// no round counts and no compute figures were published, so the loop is drawn
// as a cycle rather than a schedule — the page says "multiple rounds of
// parallel reasoning, review, correction, and synthesis" without saying how
// many.

type Stage = {
  id: string
  name: string
  what: string
  why: string
}

const STAGES: Stage[] = [
  {
    id: "proof",
    name: "Proof",
    what: "Generate candidate proofs, reading the organisers' original LaTeX directly and reasoning in natural language alongside Python.",
    why: "No human translates the problem into Lean or any other formal language first. That removes the step which, in the dots team's words, \"limits the generality of this path\" — most real problems cannot be fully formalised, so a pipeline that needs formalisation cannot leave competition mathematics.",
  },
  {
    id: "verify",
    name: "Verify",
    what: "Assess the existing proof: is it correct, is it complete, and what specifically should change.",
    why: "This is where the guarantee has to come from. A Lean-checked proof is correct because a checker said so; a natural-language proof is correct because the model's own critique found nothing left to fix. The dots team calls self-review \"one of the abilities we focused on optimizing.\"",
  },
  {
    id: "refine",
    name: "Refine",
    what: "Rewrite the problematic parts using the verifier's suggestions, then send the result back around.",
    why: "The stated failure modes being hunted are reasoning errors, logical leaps, and insufficiently rigorous steps — the three things that survive an answer-checker and die under a human grader.",
  },
]

const A = "oklch(0.60 0.15 255)"
const B = "oklch(0.68 0.13 85)"
const C = "oklch(0.55 0.16 155)"
const COLORS = [A, B, C]

export function ProofLoop() {
  const [sel, setSel] = useState(1)
  const s = STAGES[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Proof → Verify → Refine</span>
        <span className="font-mono text-[10px] text-muted-foreground">round count not published</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-stretch gap-1.5">
          {STAGES.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "flex-1 cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors",
                i === sel ? "border-foreground/40 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
              )}
              style={{ minWidth: "8rem" }}
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />
                <span className="font-mono text-[11px] text-foreground">{x.name}</span>
              </div>
              <div className="mt-1 font-mono text-[9px] leading-4 text-muted-foreground">
                {i === 2 ? "→ back to Verify" : `→ ${STAGES[i + 1].name}`}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: COLORS[sel] }}>
            {s.name}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{s.what}</div>
          <div className="mt-2 border-t pt-2 text-sm leading-6 text-muted-foreground">{s.why}</div>
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/15 px-2.5 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              formal path (not used)
            </div>
            <div className="mt-1 font-mono text-[10px] leading-5 text-muted-foreground">
              human translates problem → Lean
              <br />
              model proves in Lean
              <br />
              checker guarantees correctness
              <br />
              <span className="text-foreground">bounded by what can be formalised</span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/15 px-2.5 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              what dots did
            </div>
            <div className="mt-1 font-mono text-[10px] leading-5 text-muted-foreground">
              model reads original LaTeX
              <br />
              natural language + Python, end to end
              <br />
              self-critique replaces the checker
              <br />
              <span className="text-foreground">bounded by how good the critique is</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The trade is legible. Formal verification buys a guarantee and pays for it in generality — someone has to
          translate the problem first, and most interesting problems resist translation. Dropping formalisation
          moves the burden onto the model&rsquo;s ability to find its own errors, which is why the dots team frames
          the result as being about self-critique rather than about mathematics:{" "}
          <span className="text-foreground">&ldquo;recursive self-improvement begins with recursive
          self-critique.&rdquo;</span>{" "}The IMO is a good place to test that claim precisely because a human panel
          grades the reasoning, not the answer.
        </p>
      </div>
    </figure>
  )
}
