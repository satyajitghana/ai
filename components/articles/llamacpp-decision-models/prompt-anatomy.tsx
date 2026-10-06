"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ANATOMY } from "./data"

// What llama.cpp's /v1/systemone actually evaluates for the ggml-org blog's
// three-question request, token by token, for three of its six readouts.
// Kev and Julia pieces are the server's own /tokenize output on the prompts their
// GGUF templates render; lev's are the same Qwen3.5 tokenizer (via the Kev-0.8B
// server) on lev's template as written in conversion/lev.py. Shared-prefix sizes
// are the minimum common prefix with the parent task, which is what
// server_decision_group_tasks() uses; Kev's 92 evaluated tokens match the
// server's /metrics counter exactly.

type Family = "kev" | "julia" | "lev"
type Q = "route" | "angry" | "urgency"

const FAMILIES: { id: Family; label: string; sub: string }[] = [
  { id: "kev", label: "Kev-0.8B", sub: "pointer (KEV)" },
  { id: "julia", label: "Julia-1", sub: "mask column (LAYA)" },
  { id: "lev", label: "lev", sub: "letter logits (LEV)" },
]

const QUESTIONS: { id: Q; label: string; type: string }[] = [
  { id: "route", label: "route", type: "choice, 3 options" },
  { id: "angry", label: "angry", type: "noul" },
  { id: "urgency", label: "urgency", type: "score, 4 levels" },
]

// tokens shared with the parent task (the first question), per family
const SHARED: Record<Family, number> = { kev: 19, julia: 0, lev: 70 }

// the head column a LAYA model reads: SERVER_DECISION_QUESTION_{CHOICE,SCORE,NOUL}
const LAYA_COLUMN: Record<Q, number> = { route: 0, urgency: 1, angry: 2 }

const LEV_LABELS: Record<Q, string> = {
  route: "A, B, C",
  urgency: "A, B, C, D",
  angry: "A to I (a 0-8 rating scale)",
}

function show(piece: string): string {
  return piece.replace(/\n/g, "↵").replace(/ /g, "·")
}

function prompts(f: Family, q: Q): { name: string; pieces: readonly string[] }[] {
  if (f === "lev") {
    if (q === "route") {
      return [
        { name: "variant 0, as listed", pieces: ANATOMY.lev.route_v0 },
        { name: "variant 1, reversed", pieces: ANATOMY.lev.route_v1 },
      ]
    }
    return [{ name: "one prompt", pieces: ANATOMY.lev[q] }]
  }
  return [{ name: "one prompt", pieces: ANATOMY[f][q] }]
}

function isRead(f: Family, pieces: readonly string[], i: number): boolean {
  if (f === "kev") return pieces[i] === "<|box_end|>" || i === pieces.length - 1
  if (f === "julia") return pieces[i] === "<mask>"
  return i === pieces.length - 1
}

function readout(f: Family, q: Q): string {
  if (f === "kev") {
    return "hidden state of the last token → q (256 wide); hidden state at each <|box_end|> → k (256 wide); score = q·k / √256"
  }
  if (f === "julia") {
    return `the two head blocks + scorer give 3 numbers per token (one per question type); read column ${LAYA_COLUMN[q]} at each <mask>`
  }
  return `logits at the last position, at the vocabulary rows of the label tokens ${LEV_LABELS[q]}`
}

export function PromptAnatomy() {
  const [fam, setFam] = useState<Family>("kev")
  const [q, setQ] = useState<Q>("route")

  const ps = prompts(fam, q)
  const total = (["route", "angry", "urgency"] as Q[]).reduce(
    (s, k) => s + prompts(fam, k).reduce((a, p) => a + p.pieces.length, 0),
    0
  )
  const nTasks = fam === "lev" ? 4 : 3
  const evaluated = total - (nTasks - 1) * SHARED[fam]
  const isParent = q === "route"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what /v1/systemone scores · the blog&apos;s three-question request, token by token
      </div>

      <div className="grid gap-2 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Readout family">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFam(f.id)}
              aria-pressed={fam === f.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                fam === f.id ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {f.label} <span className="opacity-70">· {f.sub}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Question">
          {QUESTIONS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setQ(x.id)}
              aria-pressed={q === x.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                q === x.id ? "bg-sky-600 text-white" : "hover:bg-muted"
              )}
            >
              {x.label} <span className="opacity-70">· {x.type}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-3">
        {ps.map((p) => (
          <div key={p.name} className="min-w-0">
            <p className="mb-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {p.name} · {p.pieces.length} tokens
            </p>
            <div className="flex flex-wrap gap-[3px] font-mono text-[10px] leading-4">
              {p.pieces.map((piece, i) => {
                const read = isRead(fam, p.pieces, i)
                const shared = i < SHARED[fam]
                return (
                  <span
                    key={i}
                    className={cn(
                      "rounded-sm border px-1 whitespace-pre",
                      read
                        ? "border-amber-500 bg-amber-400/30 font-semibold"
                        : shared
                          ? "border-transparent bg-emerald-500/15 text-muted-foreground"
                          : "border-transparent bg-muted"
                    )}
                    title={read ? "score read here" : shared ? "shared prefix" : undefined}
                  >
                    {show(piece)}
                  </span>
                )
              })}
            </div>
          </div>
        ))}

        <dl className="grid gap-x-4 gap-y-1 rounded-md border p-3 font-mono text-[11px] sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted-foreground">score read at</dt>
          <dd className="m-0">{readout(fam, q)}</dd>
          <dt className="text-muted-foreground">shared prefix</dt>
          <dd className="m-0">
            {SHARED[fam] === 0
              ? "none: the question comes first, so no two prompts start alike, and an encoder could not reuse one anyway"
              : `${SHARED[fam]} tokens (green). ${
                  isParent
                    ? "This is the parent task: it evaluates them, pauses, and copies its state to the others."
                    : "This child task starts from the parent's copied state."
                }`}
          </dd>
          <dt className="text-muted-foreground">whole request</dt>
          <dd className="m-0">
            {nTasks} prompts, {total} tokens in usage.input_tokens, {evaluated} evaluated
          </dd>
        </dl>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Amber is where the number comes from; green is evaluated once and shared. Same request,
        three readouts: Kev reads two hidden states per option, Julia reads one column of a
        three-column head at each mask, lev reads a few rows of the vocabulary at the last
        position and runs the choice twice.
      </figcaption>
    </figure>
  )
}
