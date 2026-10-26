"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

import { DATA } from "./data"

// Three views of one fact: the letter e lives inside tokens, not beside them.
//   1. a sentence cut into Qwen3 tokens, the ones containing e/E lit;
//   2. the model's real next-token distribution at each step of a masked
//      greedy answer, with the mask toggle removing the lit options;
//   3. the vocabulary, by word length: how much of it the mask deletes.
// Every token, probability and count comes from DATA, which was measured with
// Qwen3-0.6B on CPU for the article. Nothing is simulated.

const HOT = "oklch(0.62 0.16 55)"
const OK = "oklch(0.6 0.12 160)"

const pill = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

const show = (t: string) => (t === "" ? "(empty)" : t.replace(/\n/g, "↵").replace(/^ /, "␣"))
const pct = (x: number, d = 1) => (x * 100).toFixed(d) + "%"

type Tab = "sentence" | "step" | "vocab"

export function LipogramLens() {
  const [tab, setTab] = useState<Tab>("sentence")
  const [mask, setMask] = useState(true)
  const [si, setSi] = useState(2)
  const [run, setRun] = useState<"study" | "dog">("study")
  const [step, setStep] = useState(0)

  const sent = DATA.sentences[si]
  const banned = sent.tokens.filter((t) => t[1] === 1).length

  const steps = DATA.steps[run].steps
  const cur = steps[Math.min(step, steps.length - 1)]
  const kept = cur.top.filter((t) => !(mask && t[2]))
  const keptMass = kept.reduce((a, t) => a + t[1], 0)
  const forcedCount = steps.filter((s) => s.forced).length

  const lens = Object.entries(DATA.vocab.byLen)
  const share = DATA.vocab.withE / DATA.vocab.n

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">Where the e hides</span>
        <span className="font-mono text-[10px] text-muted-foreground">Qwen3-0.6B tokenizer and logits · measured on CPU</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-3">
        {(
          [
            ["sentence", "1 tokens"],
            ["step", "2 next token"],
            ["vocab", "3 vocabulary"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} className={pill(tab === k)} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
        {tab !== "vocab" ? (
          <label className="ml-auto flex cursor-pointer items-center gap-2 font-mono text-[11px]">
            <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
            mask every token containing e
          </label>
        ) : null}
      </div>

      {tab === "sentence" ? (
        <div className="px-4 py-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DATA.sentences.map((s, i) => (
              <button key={s.text} type="button" aria-pressed={si === i} className={pill(si === i)} onClick={() => setSi(i)}>
                {s.text.length > 30 ? s.text.slice(0, 28) + "…" : s.text}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" aria-label="the sentence as tokens">
            {sent.tokens.map((t, i) => {
              const hot = t[1] === 1
              return (
                <span
                  key={i}
                  className={cn("rounded border px-1.5 py-1 font-mono text-xs", hot && mask && "line-through decoration-2")}
                  style={hot ? { borderColor: HOT, background: "color-mix(in oklch, " + HOT + " 16%, transparent)" } : undefined}
                >
                  {show(t[0])}
                </span>
              )
            })}
          </div>
          <p className="my-0 mt-3 text-xs text-muted-foreground">
            {sent.tokens.length} tokens, {banned} of them contain an e. {mask ? "With the mask on, the model may not write " : "Without a mask the model may write "}
            {banned === 0 ? "any of them: this sentence is already e-free." : mask ? "any of the struck ones, so it has to say this another way." : "all of them."} The tokenizer never splits the letter off: &ldquo;the&rdquo; is one piece, e included.
          </p>
        </div>
      ) : null}

      {tab === "step" ? (
        <div className="px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={run === "study"} className={pill(run === "study")} onClick={() => { setRun("study"); setStep(0) }}>
              study for a test
            </button>
            <button type="button" aria-pressed={run === "dog"} className={pill(run === "dog")} onClick={() => { setRun("dog"); setStep(0) }}>
              time with my dog
            </button>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {forcedCount} of {steps.length} steps: the unmasked favourite contains an e
            </span>
          </div>
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">{DATA.steps[run].prompt}</div>
          <div className="mb-3 rounded-md border px-2.5 py-2 font-mono text-xs">
            {cur.ctx === "" ? <span className="text-muted-foreground">(start of answer)</span> : cur.ctx}
            <span className="ml-0.5 inline-block rounded px-1" style={{ background: "color-mix(in oklch, " + OK + " 25%, transparent)" }}>
              {mask ? show(cur.picked) : show(cur.top[0][0])}
            </span>
          </div>
          <div className="mb-1 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">step {step + 1}</span>
            <Range min={0} max={steps.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="generation step" />
          </div>
          <div className="space-y-1">
            {cur.top.map((t, i) => {
              const gone = mask && t[2]
              const p = mask ? (gone ? 0 : t[1] / keptMass) : t[1]
              return (
                <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className={cn("w-24 shrink-0 truncate", gone && "line-through opacity-50")}>{show(t[0])}</span>
                  <span className="h-3 flex-1 rounded-sm bg-muted/30">
                    <span className="block h-3 rounded-sm" style={{ width: pct(Math.min(1, p), 2), background: t[2] ? HOT : OK, opacity: gone ? 0.25 : 1 }} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-muted-foreground">{pct(t[1])}</span>
                </div>
              )
            })}
          </div>
          <p className="my-0 mt-3 text-xs text-muted-foreground">
            The model puts {pct(cur.pE)} of its probability, over the whole vocabulary, on tokens with an e. The top {cur.top.length} listed carry {pct(cur.top.reduce((a, t) => a + t[1], 0))}.
            {mask ? ` The mask deletes the orange bars; the bars shown are rescaled among the ${cur.top.length} listed tokens (the real softmax rescales over the whole vocabulary). The pick is ${show(cur.picked)}.` : " Mask off: the model picks its favourite, e or not."}
          </p>
        </div>
      ) : null}

      {tab === "vocab" ? (
        <div className="px-4 py-3">
          <p className="my-0 mb-3 text-xs text-muted-foreground">
            {DATA.vocab.withE.toLocaleString("en-US")} of {DATA.vocab.n.toLocaleString("en-US")} tokens ({pct(share)}) contain an e or E. Below, whole-word tokens (a space and then letters) by length. The longer the word, the more likely it needs an e.
          </p>
          <div className="space-y-1">
            {lens.map(([len, v]) => {
              const f = v.with_e / v.n
              return (
                <div key={len} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="w-20 shrink-0">{len === "9" ? "9+ letters" : len + (len === "1" ? " letter" : " letters")}</span>
                  <span className="flex h-3 flex-1 overflow-hidden rounded-sm bg-muted/30">
                    <span className="block h-3" style={{ width: pct(1 - f, 2), background: OK }} />
                    <span className="block h-3" style={{ width: pct(f, 2), background: HOT }} />
                  </span>
                  <span className="w-28 shrink-0 text-right text-muted-foreground">
                    {v.with_e.toLocaleString("en-US")} / {v.n.toLocaleString("en-US")} · {pct(f, 0)}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="my-0 mt-3 text-xs text-muted-foreground">Green survives the mask, orange does not. Short words are mostly fine. Anything long is mostly gone.</p>
        </div>
      ) : null}
    </figure>
  )
}
