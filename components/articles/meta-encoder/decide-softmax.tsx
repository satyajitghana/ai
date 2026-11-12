"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// MetaEncoder's `answer()` (modeling_metaencoder.py, facebook/meta-encoder-v1):
//   probs = softmax(scores / temperature), temperature 0.02 by default
//   confidence = 1 - H(probs) / ln K
//
// The examples are the decisions in Meta's own Space (facebook/meta-encoder-space,
// data/gallery.json, which declares the v0 model facebook/meta-encoder). The Space
// publishes probabilities, not cosines, so the cosine GAPS are backed out:
//   s_i - s_top = 0.02 * ln(p_i / p_top)
// Absolute cosines are unknown and do not matter: softmax only sees differences.
// The gallery lists the top three options of each row, so the toy renormalises over
// those three; the card's own example (two options) is exact.

type Ex = { id: string; src: string; q: string; opts: { label: string; p: number }[]; n: number }

const EXAMPLES: Ex[] = [
  { id: "card", src: "the v1 card's example", q: "used iphone 15 · Is the user shopping for a product?", n: 2, opts: [{ label: "true", p: 0.984 }, { label: "false", p: 0.016 }] },
  { id: "chart", src: "ChartQA, image", q: "What's the computing total for semiconductor demand in 2014?", n: 1000, opts: [{ label: "105.4", p: 0.8087 }, { label: "106.4", p: 0.0971 }, { label: "105.3", p: 0.0333 }] },
  { id: "fruit", src: "TempCompass, video", q: "Is the number of fruits and vegetables increasing?", n: 2, opts: [{ label: "no", p: 0.8636 }, { label: "yes", p: 0.1364 }] },
  { id: "kimono", src: "MVBench, video", q: "What was the unexpected event in the video?", n: 4, opts: [{ label: "child hopped onto her back", p: 0.8052 }, { label: "child quickly hid", p: 0.1482 }, { label: "someone bellowed 'waistband'", p: 0.0466 }] },
  { id: "tos", src: "LexGLUE unfair ToS, text", q: "Apply the legal label this task calls for.", n: 8, opts: [{ label: "Limitation of liability", p: 0.9995 }, { label: "Choice of law", p: 0.0003 }, { label: "Unilateral termination", p: 0.0001 }] },
]

const TRAINED = 0.02
const ACCENT = "oklch(0.6 0.15 255)"

// slider position 0..100 maps to temperature 0.002..0.5 on a log scale
const tOf = (x: number) => 0.002 * mpow(250, x / 100)
const xOf = (t: number) => (100 * mlog(t / 0.002)) / mlog(250)

export function DecideSoftmax() {
  const [id, setId] = useState("card")
  const [x, setX] = useState(() => Math.round(xOf(TRAINED)))
  const ex = EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0]
  const tau = x === Math.round(xOf(TRAINED)) ? TRAINED : tOf(x)

  const top = ex.opts[0].p
  const gaps = ex.opts.map((o) => TRAINED * mlog(o.p / top)) // s_i - s_top, <= 0
  const logits = gaps.map((g) => g / tau)
  const mx = Math.max(...logits)
  const ws = logits.map((l) => mexp(l - mx))
  const z = ws.reduce((a, b) => a + b, 0)
  const probs = ws.map((w) => w / z)
  const K = probs.length
  const H = -probs.reduce((a, p) => a + (p > 0 ? p * mlog(p) : 0), 0)
  const conf = Math.min(1, Math.max(0, 1 - H / mlog(K)))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">a decision is a softmax over cosines</span>
        <span className="font-mono text-[10px] text-muted-foreground">answer() · modeling_metaencoder.py</span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-3 sm:px-4">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setId(e.id)}
            aria-pressed={id === e.id}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              id === e.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {e.src}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="text-sm">{ex.q}</div>

        <label className="block font-mono text-[11px] text-muted-foreground">
          temperature τ = {tau.toFixed(tau < 0.01 ? 4 : 3)}
          {tau === TRAINED ? " (the training temperature, the default)" : ""} · logit = cosine / τ = cosine × {(1 / tau).toFixed(0)}
          <Range min={0} max={100} step={1} value={x} onChange={(e) => setX(Number(e.target.value))} className="mt-1 w-full" accent={ACCENT} />
        </label>
        <button
          type="button"
          onClick={() => setX(Math.round(xOf(TRAINED)))}
          className="cursor-pointer rounded border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          reset to 0.02
        </button>

        <div className="space-y-2 font-mono text-[11px]">
          {ex.opts.map((o, i) => (
            <div key={o.label}>
              <div className="flex justify-between gap-2">
                <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{o.label}</span>
                <span className="text-muted-foreground">
                  cosine gap {gaps[i] === 0 ? "0" : gaps[i].toFixed(4)} · <span className="text-foreground">p = {probs[i].toFixed(3)}</span>
                </span>
              </div>
              <div className="mt-0.5 h-2.5 rounded-sm bg-muted/40">
                <div className="h-2.5 rounded-sm" style={{ width: `${Math.max(0.5, probs[i] * 100).toFixed(2)}%`, background: i === 0 ? ACCENT : "oklch(0.65 0.04 255)" }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">confidence = 1 − H / ln {K}</div>
            <div className="text-base text-foreground">{conf.toFixed(3)}</div>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <div className="text-muted-foreground">answer (argmax)</div>
            <div className="text-base text-foreground">{ex.opts[0].label}</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Move τ and the answer never changes; only how sure it sounds does. That is why <code>calibrate()</code>{" "}refits τ on labelled data and
          leaves accuracy alone. Gaps are backed out of the published probabilities at τ = 0.02.
          {ex.id !== "card" && ex.n > ex.opts.length
            ? ` This row had ${ex.n} options; the Space lists the top three, so probabilities here are renormalised over those.`
            : ""}
          {ex.id !== "card" ? " Probabilities from Meta's Space, which runs the v0 model." : " At τ = 0.02 this reproduces the card's 0.984, and its 0.881 within rounding."}
        </p>
      </div>
    </figure>
  )
}
