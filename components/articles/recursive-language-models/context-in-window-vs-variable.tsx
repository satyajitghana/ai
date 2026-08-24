"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Same 500 MB corpus, two ways of finding an answer inside it.
// GPT-5's context window (272K tokens) is the one real, citable number here —
// it is the exact figure the RLM paper (Zhang, Kraska, Khattab; arXiv 2512.24601,
// Figure 1 caption) uses as the ceiling S-NIAH/OOLONG runs past. Everything else
// — the 4-bytes-per-token estimate, the "~1.2k tokens printed" cost of the
// variable approach — is an illustrative approximation, labeled as such, not a
// number either paper reports.

const WINDOW_TOKENS = 272_000 // GPT-5's context window, per the RLM paper
const BYTES_PER_TOKEN = 4 // common rough estimate, not exact for any tokenizer
const PRINTED_SLICE_TOKENS = 1_200 // illustrative: a found slice + surrounding context

const STEPS: { bytes: number; label: string }[] = [
  { bytes: 10_000, label: "10 KB" },
  { bytes: 100_000, label: "100 KB" },
  { bytes: 1_000_000, label: "1 MB" },
  { bytes: 10_000_000, label: "10 MB" },
  { bytes: 100_000_000, label: "100 MB" },
  { bytes: 500_000_000, label: "500 MB" },
]

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${Math.round(n)}`
}

const W = 760
const H = 210
const BAR_X = 152
const BAR_W = 560
const BAR_H = 30
const ROW1_Y = 40
const ROW2_Y = 130
const ACCENT_WINDOW = "oklch(0.63 0.19 25)"
const ACCENT_VAR = "oklch(0.60 0.15 255)"

export function ContextInWindowVsVariable() {
  const [step, setStep] = useState(5)
  const corpus = STEPS[step]
  const corpusTokens = corpus.bytes / BYTES_PER_TOKEN
  const overflow = Math.max(0, corpusTokens - WINDOW_TOKENS)
  const rounds = Math.max(1, Math.ceil(corpusTokens / WINDOW_TOKENS))
  const windowFillPct = Math.min(1, corpusTokens / WINDOW_TOKENS)

  const varTokens = Math.min(PRINTED_SLICE_TOKENS, corpusTokens)
  const varFillPct = Math.min(1, varTokens / WINDOW_TOKENS)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>context in the window vs. context in a variable</span>
        <span className="text-muted-foreground/50">window size is real, rest is illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A ${corpus.label} corpus against a 272,000-token context window. Reading it directly fills the window to ${Math.round(windowFillPct * 100)} percent${overflow > 0 ? ` with ${fmtTokens(overflow)} tokens left over, needing about ${rounds} read-and-compact rounds` : ""}. Holding it as a REPL variable and printing only the relevant slice uses about ${fmtTokens(varTokens)} tokens, ${Math.round(varFillPct * 100)} percent of the window.`}
        >
          {/* row labels */}
          <text x={BAR_X} y={ROW1_Y - 10} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            read into the window
          </text>
          <text x={BAR_X} y={ROW2_Y - 10} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            held as a REPL variable
          </text>

          {/* window budget frame, row 1 */}
          <rect x={BAR_X} y={ROW1_Y} width={BAR_W} height={BAR_H} rx={6} fill="var(--muted)" opacity={0.5} stroke="var(--border)" strokeWidth={1.5} />
          <rect x={BAR_X} y={ROW1_Y} width={BAR_W * windowFillPct} height={BAR_H} rx={6} fill={ACCENT_WINDOW} opacity={0.85} />
          <text x={BAR_X + 8} y={ROW1_Y + BAR_H / 2 + 4} className="font-mono" fontSize={10} fill={windowFillPct > 0.3 ? "oklch(0.99 0 0)" : "var(--muted-foreground)"}>
            {fmtTokens(Math.min(corpusTokens, WINDOW_TOKENS))} tokens
          </text>
          {overflow > 0 && (
            <text x={BAR_X + BAR_W + 8} y={ROW1_Y + BAR_H / 2 + 4} className="font-mono" fontSize={10} fill={ACCENT_WINDOW}>
              +{fmtTokens(overflow)} don&rsquo;t fit
            </text>
          )}

          {/* window budget frame, row 2 */}
          <rect x={BAR_X} y={ROW2_Y} width={BAR_W} height={BAR_H} rx={6} fill="var(--muted)" opacity={0.5} stroke="var(--border)" strokeWidth={1.5} />
          <rect x={BAR_X} y={ROW2_Y} width={Math.max(BAR_W * varFillPct, 3)} height={BAR_H} rx={6} fill={ACCENT_VAR} opacity={0.9} />
          <text x={BAR_X + Math.max(BAR_W * varFillPct, 3) + 8} y={ROW2_Y + BAR_H / 2 + 4} className="font-mono" fontSize={10} fill={ACCENT_VAR}>
            ~{fmtTokens(varTokens)} tokens printed
          </text>

          {/* shared 272K reference line */}
          <line x1={BAR_X + BAR_W} y1={ROW1_Y - 4} x2={BAR_X + BAR_W} y2={ROW2_Y + BAR_H + 4} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3" />
          <text x={BAR_X + BAR_W} y={ROW2_Y + BAR_H + 20} textAnchor="end" className="font-mono" fontSize={9} fill="var(--muted-foreground)">
            272K-token window (GPT-5, per the RLM paper)
          </text>

          {/* corpus size label */}
          <text x={BAR_X} y={ROW1_Y - 24} className="font-mono" fontSize={9} fill="var(--muted-foreground)">
            corpus: {corpus.label} ({fmtTokens(corpusTokens)} tokens at ~4 bytes/token)
          </text>
        </svg>

        <label className="mt-2 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="w-24 shrink-0">corpus size</span>
          <Range min={0} max={5} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} accent={ACCENT_VAR} className="flex-1" />
          <span className="w-14 shrink-0 text-right">{corpus.label}</span>
        </label>

        {overflow > 0 && (
          <div className="mt-2 rounded-md border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
            reading the whole corpus through the window needs about <span className="text-foreground">{rounds}</span> read-and-compact rounds
          </div>
        )}
      </div>

      <p className="mt-3 border-t px-3 pt-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4">
        Drag to 500 MB. The top bar is what a transcript-based agent must do: read
        chunks into the window until it is full, compact, keep reading — the window
        never sees more than 272K tokens at once no matter how the corpus is sliced.
        The bottom bar is the REPL: the corpus sits in a variable sized by machine
        memory, not context budget, and only what the model chooses to{" "}
        <code>print()</code> — here, a found slice — ever enters its context. This is
        the same shape as the paper&rsquo;s S-NIAH and OOLONG runs: scale the input and
        watch one line flatten while the other degrades. The honest caveat is the
        same one that applies to any REPL-as-context design: if the model prints the
        whole variable instead of a slice, this bound disappears.
      </p>
    </figure>
  )
}
