"use client"

import { useState } from "react"

import { mlog2 } from "@/lib/dmath"

// The tokenizer ablation from the Qwen-Audio-3.0-TTS report (arXiv 2607.23938,
// Table 2), which is the report the Qwen-Audio-3.1 blog links to. Four
// tokenizers, each used to train a zero-shot TTS model scored on SEED-TTS-Eval:
// CosyVoice 3's 25 Hz / 6,561-code tokenizer, and three 12.5 Hz variants with
// 6,561, 19,683 and 59,049 codes. Every metric below is copied from that table.
//
// The two derived columns are arithmetic, not measurements:
//   tokens per 3-minute clip = frame rate x 180 s (3 minutes is the model's
//   one-pass long-form ceiling);
//   nominal index budget = frame rate x log2(codebook) bits/s, the upper bound
//   the CosyVoice retrospective (arXiv 2609.16514, Eq. 4) uses to explain the
//   ablation. It assumes uniform, independent codes; it is not an entropy rate.

type Tok = {
  id: string
  name: string
  hz: number
  k: number
  zhCer: number
  zhSim: number
  enWer: number
  enSim: number
  hardCer: number
  hardSim: number
}

const TOKS: Tok[] = [
  { id: "cv3", name: "CosyVoice 3", hz: 25, k: 6561, zhCer: 1.45, zhSim: 80.6, enWer: 2.57, enSim: 73.6, hardCer: 6.83, hardSim: 77.6 },
  { id: "q6561", name: "12.5 Hz, 3⁸ codes", hz: 12.5, k: 6561, zhCer: 2.59, zhSim: 72.44, enWer: 3.21, enSim: 61.64, hardCer: 7.94, hardSim: 69.78 },
  { id: "q19683", name: "12.5 Hz, 3⁹ codes", hz: 12.5, k: 19683, zhCer: 1.48, zhSim: 83.25, enWer: 2.56, enSim: 77.58, hardCer: 6.7, hardSim: 80.85 },
  { id: "q59049", name: "12.5 Hz, 3¹⁰ codes (shipped)", hz: 12.5, k: 59049, zhCer: 1.23, zhSim: 83.09, enWer: 2.37, enSim: 77.49, hardCer: 6.68, hardSim: 80.61 },
]

const ACCENT = "oklch(0.62 0.17 285)" // violet: the selected tokenizer
const MUTED = "oklch(0.7 0.02 260)"

type Metric = { key: keyof Tok; label: string; lowerBetter: boolean; unit: string; max: number }

const METRICS: Metric[] = [
  { key: "zhCer", label: "test-zh CER", lowerBetter: true, unit: "%", max: 3 },
  { key: "enWer", label: "test-en WER", lowerBetter: true, unit: "%", max: 4 },
  { key: "hardCer", label: "test-hard CER", lowerBetter: true, unit: "%", max: 9 },
  { key: "zhSim", label: "test-zh SIM", lowerBetter: false, unit: "", max: 90 },
  { key: "enSim", label: "test-en SIM", lowerBetter: false, unit: "", max: 90 },
  { key: "hardSim", label: "test-hard SIM", lowerBetter: false, unit: "", max: 90 },
]

const bitsPerToken = (k: number) => mlog2(k)
const budget = (t: Tok) => t.hz * bitsPerToken(t.k)

export function TokenizerBudget() {
  const [sel, setSel] = useState("q59049")
  const t = TOKS.find((x) => x.id === sel) ?? TOKS[3]
  const ref = TOKS[0]
  const maxBudget = Math.max(...TOKS.map(budget))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          frame rate &times; codebook &rarr; sequence length and index budget
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          metrics: Qwen-Audio-3.0-TTS report, Table 2 (self-reported)
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="tokenizer">
          {TOKS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(x.id)}
              aria-pressed={x.id === sel}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                x.id === sel ? "border-transparent text-white" : "bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
              style={x.id === sel ? { background: ACCENT } : undefined}
            >
              {x.name}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">tokens per 3-min clip</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{(t.hz * 180).toLocaleString("en-US")}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">bits per token (log&#8322; K)</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{bitsPerToken(t.k).toFixed(2)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">index budget</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>
              {budget(t).toFixed(1)}
              <span className="text-xs text-muted-foreground"> bit/s</span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">vs CosyVoice 3</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">
              {((budget(t) / budget(ref)) * 100).toFixed(1)}%
              <span className="text-xs text-muted-foreground"> of budget</span>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          {TOKS.map((x) => (
            <div key={x.id} className="grid grid-cols-[9.5rem_1fr] items-center gap-2 sm:grid-cols-[13rem_1fr]">
              <span className="truncate font-mono text-[10px] text-muted-foreground">{x.name}</span>
              <div className="relative h-3 rounded-sm bg-muted/30">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${(budget(x) / maxBudget) * 100}%`, background: x.id === sel ? ACCENT : MUTED, opacity: x.id === sel ? 1 : 0.5 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {METRICS.map((m) => {
            const vals = TOKS.map((x) => x[m.key] as number)
            const twelve = TOKS.slice(1).map((x) => x[m.key] as number)
            const best12 = m.lowerBetter ? Math.min(...twelve) : Math.max(...twelve)
            return (
              <div key={m.key} className="rounded-lg border px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{m.label}</span>
                  <span>{m.lowerBetter ? "lower is better" : "higher is better"}</span>
                </div>
                <div className="space-y-1">
                  {TOKS.map((x, i) => {
                    const v = vals[i]
                    const on = x.id === sel
                    return (
                      <div key={x.id} className="grid grid-cols-[1fr_3.2rem] items-center gap-2">
                        <div className="relative h-2.5 rounded-sm bg-muted/30">
                          <div
                            className="absolute inset-y-0 left-0 rounded-sm"
                            style={{ width: `${Math.min(100, (v / m.max) * 100)}%`, background: on ? ACCENT : MUTED, opacity: on ? 1 : 0.45 }}
                          />
                        </div>
                        <span
                          className={`text-right font-mono text-[10px] tabular-nums ${on ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {v.toFixed(2)}
                          {m.unit}
                          {x.id !== "cv3" && v === best12 ? "*" : ""}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Rows in each panel run in the button order. <span className="font-mono">*</span>{" "}marks the best
          12.5 Hz value. Halving the frame rate at a fixed 6,561 codes costs content and similarity
          everywhere; growing the codebook buys it back, and the shipped 59,049-code tokenizer does it with{" "}
          {((budget(TOKS[3]) / budget(ref)) * 100).toFixed(1)}% of CosyVoice 3&rsquo;s nominal index budget
          and half its tokens. The budget is an upper bound under uniform, independent codes, not a measured
          entropy, and these ablation models are not the final system: the report does not say how far each
          was trained.
        </p>
      </div>
    </figure>
  )
}
