"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// A cost calculator built only from Anthropic's published list prices
// (platform.claude.com/docs/en/about-claude/pricing, read 2026-10-08).
// Workloads are entered the way you already measure them: in Claude Haiku 4.5
// tokens. Haiku 5.5 and Sonnet 5.5 use the newer tokenizer, which the docs say
// counts the same text as "approximately 30% more tokens", so their counts are
// the Haiku 4.5 counts times the tokenizer factor. Thinking tokens are extra
// output on the newer models (Haiku 4.5 is assumed to run with thinking off).
// Haiku 5.5's tier is picked per request from its prompt length: input + cache
// reads + cache writes, in its own tokens, over 100,000 means the higher tier
// for every token of that request. The docs do not say whether cached tokens
// count toward that threshold; this assumes they do.

type Prices = { input: number; write: number; read: number; output: number }

const H45: Prices = { input: 1, write: 1.25, read: 0.1, output: 5 }
const H55_SHORT: Prices = { input: 0.1, write: 0.125, read: 0.01, output: 0.5 }
const H55_LONG: Prices = { input: 0.5, write: 0.625, read: 0.05, output: 2.5 }
const S55: Prices = { input: 2, write: 2.5, read: 0.1, output: 10 }

const TIER = 100_000
const H45_CONTEXT = 200_000

type Workload = {
  id: string
  name: string
  input: number
  read: number
  write: number
  output: number
  thinking: number
  note: string
}

const PRESETS: Workload[] = [
  { id: "triage", name: "Ticket triage", input: 1200, read: 0, write: 0, output: 15, thinking: 0, note: "One label out of a short ticket, thinking off." },
  { id: "chat", name: "Support chat turn", input: 2000, read: 18000, write: 0, output: 350, thinking: 300, note: "A cached system prompt and history, a short reply, a little thinking." },
  { id: "doc70", name: "Summarise a 70k doc", input: 70000, read: 0, write: 0, output: 1200, thinking: 0, note: "91,000 tokens on Haiku 5.5: still the low tier." },
  { id: "doc85", name: "Summarise an 85k doc", input: 85000, read: 0, write: 0, output: 1200, thinking: 0, note: "110,500 tokens on Haiku 5.5: the whole request bills at the high tier." },
  { id: "subagent", name: "Coding subagent turn", input: 3000, read: 45000, write: 3000, output: 1500, thinking: 2500, note: "Mostly cache reads, some new context, a thinking budget's worth of output." },
]

function costOf(p: Prices, input: number, read: number, write: number, output: number, batch: boolean) {
  const usd = (input * p.input + read * p.read + write * p.write + output * p.output) / 1e6
  return batch ? usd / 2 : usd
}

function money(v: number) {
  if (v === 0) return "$0"
  if (v < 0.001) return `$${v.toFixed(6)}`
  if (v < 0.1) return `$${v.toFixed(4)}`
  return `$${v.toFixed(3)}`
}

function perMillion(v: number) {
  const m = v * 1e6
  return `$${Math.round(m).toLocaleString("en-US")}`
}

function k(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n)
}

const C45 = "oklch(0.62 0.03 260)"
const C55 = "oklch(0.6 0.15 350)"
const CS = "oklch(0.6 0.12 245)"

export function CostCalculator() {
  const [w, setW] = useState<Workload>(PRESETS[1])
  const [factor, setFactor] = useState(1.3)
  const [batch, setBatch] = useState(false)

  const set = (patch: Partial<Workload>) => setW({ ...w, ...patch, id: "custom" })

  const in5 = w.input * factor
  const read5 = w.read * factor
  const write5 = w.write * factor
  const out5 = w.output * factor + w.thinking
  const prompt5 = in5 + read5 + write5
  const prompt45 = w.input + w.read + w.write
  const long = prompt5 > TIER
  const tooLongFor45 = prompt45 > H45_CONTEXT

  const c45 = costOf(H45, w.input, w.read, w.write, w.output, batch)
  const c55 = costOf(long ? H55_LONG : H55_SHORT, in5, read5, write5, out5, batch)
  const cs = costOf(S55, in5, read5, write5, out5, batch)
  const change = c45 > 0 ? (c55 / c45 - 1) * 100 : 0
  const max = Math.max(c45, c55, cs, 1e-12)

  const rows = [
    { name: "Haiku 4.5", v: c45, color: C45, sub: tooLongFor45 ? "prompt over its 200k window" : `${k(prompt45)} in · ${k(w.output)} out` },
    { name: "Haiku 5.5", v: c55, color: C55, sub: `${k(Math.round(prompt5))} in · ${k(Math.round(out5))} out · ${long ? "over 100k tier" : "up-to-100k tier"}` },
    { name: "Sonnet 5.5", v: cs, color: CS, sub: `${k(Math.round(prompt5))} in · ${k(Math.round(out5))} out` },
  ]

  const sliders: { label: string; key: keyof Workload; max: number; step: number }[] = [
    { label: "uncached input", key: "input", max: 200000, step: 500 },
    { label: "cache reads", key: "read", max: 200000, step: 500 },
    { label: "cache writes (5 min)", key: "write", max: 50000, step: 500 },
    { label: "output text", key: "output", max: 8000, step: 5 },
    { label: "thinking (newer models only)", key: "thinking", max: 30000, step: 100 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cost per request · published list prices</span>
        <span className="text-muted-foreground/60">tokens as Haiku 4.5 counts them</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setW(p)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${w.id === p.id ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {w.id !== "custom" && <p className="text-xs text-muted-foreground">{w.note}</p>}

        <div className="space-y-2.5" role="img" aria-label={`Per request: Haiku 4.5 ${money(c45)}, Haiku 5.5 ${money(c55)}, Sonnet 5.5 ${money(cs)}. Haiku 5.5 is ${Math.abs(change).toFixed(0)}% ${change <= 0 ? "cheaper" : "dearer"} than Haiku 4.5.`}>
          {rows.map((r) => (
            <div key={r.name} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[7.5rem_1fr_7rem]">
              <div className="font-mono text-xs">
                <div style={{ color: r.color }} className="font-semibold">{r.name}</div>
                <div className="text-[10px] leading-tight text-muted-foreground">{r.sub}</div>
              </div>
              <div className="h-4 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${Math.max(0.5, (r.v / max) * 100).toFixed(2)}%`, background: r.color }} />
              </div>
              <div className="col-span-2 text-right font-mono text-xs sm:col-span-1">
                <span className="text-foreground">{money(r.v)}</span>
                <span className="text-muted-foreground"> · {perMillion(r.v)}/1M req</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border px-3 py-2 font-mono text-xs">
          Haiku 5.5 vs Haiku 4.5:{" "}
          <span style={{ color: C55 }} className="font-semibold">
            {change <= 0 ? `${Math.abs(change).toFixed(1)}% cheaper` : `${change.toFixed(1)}% more expensive`}
          </span>
          {long && <span className="text-muted-foreground"> · prompt is {k(Math.round(prompt5))} Haiku 5.5 tokens, so every token bills at 5x</span>}
        </div>

        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {sliders.map((s) => (
            <label key={s.key} className="block">
              <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{s.label}</span>
                <span className="text-foreground">{Number(w[s.key]).toLocaleString("en-US")}</span>
              </div>
              <Range
                min={0}
                max={s.max}
                step={s.step}
                value={Number(w[s.key])}
                onChange={(e) => set({ [s.key]: Number(e.target.value) } as Partial<Workload>)}
                className="w-full cursor-pointer"
                accent={C55}
                aria-label={s.label}
              />
            </label>
          ))}
          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>tokenizer factor (newer models)</span>
              <span className="text-foreground">{factor.toFixed(2)}x</span>
            </div>
            <Range min={1} max={1.45} step={0.01} value={factor} onChange={(e) => setFactor(Number(e.target.value))} className="w-full cursor-pointer" accent={C55} aria-label="tokenizer factor" />
          </label>
        </div>

        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} />
          Batch API (half price on everything)
        </label>

        <p className="text-sm leading-6 text-muted-foreground">
          Every Haiku 5.5 price is a tenth of Haiku 4.5&apos;s in the low tier and half of it in the high tier, across
          input, output, cache reads and cache writes alike. So the ratio between the two models is just the price ratio
          times the token ratio. The tokenizer pushes the token ratio up by about 1.3x for the same text, thinking pushes
          it up further, and a prompt that crosses 100,000 Haiku 5.5 tokens moves the whole request to the 5x tier.
        </p>
      </div>
    </figure>
  )
}
