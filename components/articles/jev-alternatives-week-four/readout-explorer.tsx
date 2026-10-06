"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What llama.cpp's /v1/systemone does with one choice question once the model
// has produced one raw score per option (tools/server/server-decision.cpp,
// format_answer, read at commit 43fe9c6): divide by the temperature stored in the
// GGUF, softmax, and — for lev only — do it again with the options in reverse
// order and average the two. Confidence is the TypeSafe formula the file
// implements: (p_max - 1/n) / (1 - 1/n).
//
// The three raw scores are the natural logs of the probabilities in the
// ggml-org blog's own example response (billing 0.9049, shipping 0.0275,
// technical 0.0676), so at T = 1, no bias, one order, the widget prints exactly
// that response. The "first-slot bonus" is a made-up knob, not a measured
// property of any model: it stands in for the preference a letter readout has
// for whatever it sees first, so the effect of reverse-order averaging is
// visible.

const OPTIONS = ["billing", "shipping", "technical"] as const
const BLOG_P = [0.9049, 0.0275, 0.0676]
const RAW = BLOG_P.map((p) => mlog(p))

function softmax(scores: number[], t: number): number[] {
  const max = Math.max(...scores)
  const e = scores.map((s) => mexp((s - max) / t))
  const sum = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / sum)
}

function confidence(p: number[]): number {
  const n = p.length
  const u = 1 / n
  return Math.max(0, (Math.max(...p) - u) / (1 - u))
}

function Bars({ title, order, probs }: { title: string; order: number[]; probs: number[] }) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <p className="mb-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="grid gap-1.5">
        {order.map((i, slot) => (
          <div key={OPTIONS[i]} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {slot + 1}. {OPTIONS[i]}
            </span>
            <div className="relative h-4 rounded-sm bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-sm bg-sky-500/70"
                style={{ width: `${(probs[i] * 100).toFixed(2)}%` }}
              />
              <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[10px] font-semibold">
                {probs[i].toFixed(4)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReadoutExplorer() {
  const [t, setT] = useState(1)
  const [bonus, setBonus] = useState(0)
  const [both, setBoth] = useState(false)

  const forward = [0, 1, 2]
  const reverse = [2, 1, 0]

  // the option shown first gets the bonus
  const withBonus = (order: number[]) => RAW.map((s, i) => (i === order[0] ? s + bonus : s))

  const p1 = softmax(withBonus(forward), t)
  const p2 = softmax(withBonus(reverse), t)
  const final = both ? p1.map((p, i) => (p + p2[i]) / 2) : p1
  const best = final.indexOf(Math.max(...final))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        raw scores → probabilities · what llama.cpp&apos;s /v1/systemone does after the forward pass
      </div>

      <div className="grid gap-3 border-b p-3 sm:grid-cols-2">
        <label className="grid gap-1 font-mono text-[11px]">
          <span>
            temperature from the GGUF: <strong>{t.toFixed(2)}</strong>
          </span>
          <Range
            min={0.5}
            max={3}
            step={0.05}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            aria-label="Temperature"
          />
        </label>
        <label className="grid gap-1 font-mono text-[11px]">
          <span>
            illustrative first-slot bonus: <strong>{bonus.toFixed(2)}</strong>
          </span>
          <Range
            min={0}
            max={3}
            step={0.05}
            value={bonus}
            onChange={(e) => setBonus(Number(e.target.value))}
            aria-label="First-slot bonus"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2" role="group" aria-label="Variants">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setBoth(v)}
              aria-pressed={both === v}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                both === v ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {v ? "two orders, averaged (lev)" : "one order (every other model)"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("grid gap-3 p-3", both ? "md:grid-cols-3" : "md:grid-cols-2")}>
        <Bars title="as listed" order={forward} probs={p1} />
        {both ? <Bars title="reversed" order={reverse} probs={p2} /> : null}
        <div className="min-w-0 rounded-md border p-3">
          <p className="mb-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            answer
          </p>
          <pre className="m-0 overflow-x-auto font-mono text-[11px] leading-5">
            {`"choice": "${OPTIONS[best]}",
"probabilities": {
  "billing": ${final[0].toFixed(4)},
  "shipping": ${final[1].toFixed(4)},
  "technical": ${final[2].toFixed(4)}
},
"confidence": ${confidence(final).toFixed(4)}`}
          </pre>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        At temperature 1, no bonus and one order this is the ggml-org blog&apos;s example answer.
        Raise the bonus with two orders on: the boost goes to billing in one order and to
        technical in the other, so averaging does not cancel it, it splits it between the two
        ends and the middle option loses.
      </figcaption>
    </figure>
  )
}
