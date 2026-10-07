"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How many input tokens a pplx-decider request is billed, from the shipped
// serving path: source/src/autojev/server.py:190-212 builds one row per
// question, each carrying the whole state, and adds every row's token count to
// usage.input_tokens. Each row is the prompt from model.py:93-111 wrapped in the
// chat template; I measured the wrapper at 68 tokens with the repository's own
// tokenizer.json, and the docs' three-question example (367 tokens) reproduces
// exactly as 3 x (68 + 29) + 76. Price: $0.02 per million input tokens (the
// Perplexity pricing page). The "read the state once" line is my arithmetic for
// a layout like Agr's, not anything Perplexity ships. The 262,144 cap is the
// docs' per-request input limit, assumed here to count what usage counts.

const WRAP = 68
const PRICE = 0.02 / 1e6
const CAP = 262144

const STATES = [30, 100, 300, 1000, 2000, 5000, 10000, 30000, 100000]
const KS = [1, 2, 3, 5, 10, 20, 32, 64, 128]

function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US")
}

export function QuestionBill() {
  const [si, setSi] = useState(4)
  const [ki, setKi] = useState(4)
  const [q, setQ] = useState(40)
  const s = STATES[si]
  const k = KS[ki]

  const billed = k * (WRAP + s + q)
  const once = WRAP + s + k * q
  const ratio = billed / once
  const over = billed >= CAP
  const maxState = Math.floor(CAP / k) - WRAP - q

  const bars = [
    { label: "pplx-decider, one prompt per question", v: billed, tone: "bg-rose-600" },
    { label: "a layout that reads the state once", v: once, tone: "bg-sky-600" },
  ]
  const top = Math.max(billed, once)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        input tokens for one request: k questions about one state
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-2">
        <div className="grid content-start gap-2 font-mono text-[11px]">
          <label className="flex items-center gap-2">
            <span className="w-32 shrink-0">state: {fmt(s)} tok</span>
            <Range min={0} max={STATES.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-32 shrink-0">questions: {k}</span>
            <Range min={0} max={KS.length - 1} step={1} value={ki} onChange={(e) => setKi(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-32 shrink-0">per question: {q} tok</span>
            <Range min={10} max={300} step={5} value={q} onChange={(e) => setQ(Number(e.target.value))} />
          </label>
          <p className="m-0 text-[10px] text-muted-foreground">
            per question = the instruction plus its option lines; the docs&apos; example averages 25
          </p>
        </div>
        <div className="grid content-start gap-2 font-mono text-[11px]">
          {bars.map((b) => (
            <div key={b.label} className="grid gap-0.5">
              <span>{b.label}</span>
              <div className="relative h-5 overflow-hidden rounded-sm bg-muted">
                <div className={`h-full ${b.tone}`} style={{ width: `${((b.v / top) * 100).toFixed(2)}%` }} />
                <span className="absolute inset-y-0 left-1 flex items-center font-semibold text-foreground mix-blend-normal">
                  {fmt(b.v)} tok · ${(b.v * PRICE).toFixed(6)}
                </span>
              </div>
            </div>
          ))}
          <p className="m-0">
            {k === 1
              ? "One question: both layouts cost the same."
              : `The state is read and billed ${k} times: ${ratio.toFixed(1)}x the tokens of reading it once.`}
          </p>
          <p className={`m-0 ${over ? "text-rose-600" : "text-muted-foreground"}`}>
            {over
              ? `Over the 262,144-token request limit. With ${k} questions the state can be at most ${fmt(Math.max(0, maxState))} tokens.`
              : `Largest state that fits ${k} question${k > 1 ? "s" : ""} under the limit: ${fmt(Math.max(0, maxState))} tokens.`}
          </p>
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Billed tokens = k x (68 + state + per-question), from server.py:190-212 and a 68-token wrapper measured with the
        repository&apos;s tokenizer. Dollars at $0.02 per million. The second bar is arithmetic for a shared-state layout,
        not a product. Whether the request limit counts repeated state is my reading of the docs, not tested.
      </figcaption>
    </figure>
  )
}
