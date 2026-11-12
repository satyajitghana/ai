"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CASES, PIECES } from "./drift-data"

// One assistant turn, as the engine saw it, set against the same turn as the next request re-encodes it.
// Every id here is real: drift-data.ts was generated from Qwen3.5-35B-A3B's tokenizer.json and chat template.
// The turn itself is constructed, not sampled from the model, so nothing here is a measured probability.

type Next = "t" | "u"
type Op = "equal" | "replace" | "delete" | "insert"
type Col = { top: number | null; bot: number | null; op: Op; prompt: boolean }

function show(piece: string) {
  return piece.replace(/\n/g, "↵").replace(/ /g, "·")
}

function columns(key: string, viaText: boolean): Col[] {
  const c = CASES[key]
  if (!viaText) {
    return c.orig.map((id, i) => ({ top: id, bot: id, op: "equal", prompt: i < c.nprompt }))
  }
  const cols: Col[] = []
  for (const [op, a0, a1, b0, b1] of c.ops) {
    const n = Math.max(a1 - a0, b1 - b0)
    for (let k = 0; k < n; k++) {
      const ai = a0 + k
      const bi = b0 + k
      cols.push({
        top: ai < a1 ? c.orig[ai] : null,
        bot: bi < b1 ? c.span[bi] : null,
        op,
        prompt: ai < a1 && ai < c.nprompt,
      })
    }
  }
  return cols
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
        on ? "border-foreground/30 bg-muted/60 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {on ? "● " : "○ "}
      {children}
    </button>
  )
}

function Chip({ id, tone, prompt }: { id: number | null; tone: "same" | "diff" | "gone" | "none"; prompt: boolean }) {
  if (id === null) {
    return <div className="h-[38px] rounded border border-dashed border-border/70 bg-transparent" aria-hidden />
  }
  return (
    <div
      className={cn(
        "flex h-[38px] flex-col items-center justify-center rounded border px-1 font-mono leading-none",
        tone === "same" && !prompt && "border-sky-600/50 bg-sky-500/15",
        tone === "same" && prompt && "border-border bg-muted/40 text-muted-foreground",
        tone === "diff" && "border-rose-600/70 bg-rose-500/20",
        tone === "gone" && "border-amber-600/70 bg-amber-500/20 line-through decoration-amber-700/70"
      )}
      title={`id ${id}`}
    >
      <span className="text-[11px] whitespace-pre text-foreground">{show(PIECES[id] ?? "?")}</span>
      <span className="mt-1 text-[9px] text-muted-foreground">{id}</span>
    </div>
  )
}

export function RetokenDrift() {
  const [split, setSplit] = useState(true)
  const [blank, setBlank] = useState(false)
  const [next, setNext] = useState<Next>("t")
  const [viaText, setViaText] = useState(true)

  const key = `${split ? 1 : 0}${blank ? 1 : 0}${next}`
  const c = CASES[key]
  const cols = columns(key, viaText)
  const sampled = c.orig.length - c.nprompt
  const trained = viaText ? c.span.length - (next === "u" ? 0 : c.nprompt) : sampled
  const wrong = cols.filter((x) => !x.prompt && x.op !== "equal" && x.top !== null).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one assistant turn: sampled ids vs the next request&apos;s ids</span>
        <span className="font-mono text-[11px] text-muted-foreground">Qwen3.5-35B-A3B tokenizer + template, real ids</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          <Toggle on={split} onClick={() => setSplit(!split)}>
            sampled ·rollout + s
          </Toggle>
          <Toggle on={blank} onClick={() => setBlank(!blank)}>
            blank line before &lt;/think&gt;
          </Toggle>
          <Toggle on={next === "u"} onClick={() => setNext(next === "u" ? "t" : "u")}>
            next request adds a user message
          </Toggle>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground">turn 2 is built</span>
          {(
            [
              [true, "through text: re-render and re-encode"],
              [false, "through tokin: stored ids + Δ"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setViaText(v)}
              aria-pressed={viaText === v}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 transition-colors",
                viaText === v ? "border-foreground/30 bg-muted/60 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-0 flex-wrap gap-x-1 gap-y-2">
            {cols.map((x, i) => {
              const botTone = x.bot === null ? "none" : x.op === "equal" ? "same" : "diff"
              const topTone = x.op === "equal" ? "same" : x.op === "delete" ? "gone" : "diff"
              return (
                <div key={i} className="flex w-[58px] flex-col gap-0.5 sm:w-[62px]">
                  <Chip id={x.top} tone={x.top === null ? "none" : topTone} prompt={x.prompt} />
                  <Chip id={x.bot} tone={botTone} prompt={x.prompt} />
                </div>
              )
            })}
          </div>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          Each column: top, the id the engine had for this turn; bottom, the id at that place in the next request. Grey ids are the
          template&apos;s generation prompt (loss mask 0); blue were sampled (loss mask 1).
        </p>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">ids sampled</div>
            <div className="text-base text-foreground">{sampled}</div>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">ids in the next request</div>
            <div className="text-base text-foreground">{viaText ? c.span.length : c.orig.length}</div>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">sampled ids changed or lost</div>
            <div className={cn("text-base", wrong ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>{wrong}</div>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">logprobs line up</div>
            <div className={cn("text-base", wrong ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
              {wrong ? (trained === sampled ? "length only" : "no") : "yes"}
            </div>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {!viaText
            ? "tokin never re-encodes the turn. The next prompt is the stored ids followed by Δ, the encoded new messages, so every sampled id stays where it was, with its logprob."
            : wrong === 0
              ? "With a canonical split and the template's own whitespace, the re-render happens to reproduce the sampled ids. That is luck, not a guarantee."
              : next === "u"
                ? "Qwen3.5's template drops the reasoning of every reply before the last user message, so the re-render deletes the whole think block: 16 sampled ids, and the two prompt ids that opened it, are gone."
                : "Same text, other ids. A trainer that takes the re-render scores ids the policy never sampled, against logprobs it recorded for different ones."}
        </p>
      </div>
    </figure>
  )
}
