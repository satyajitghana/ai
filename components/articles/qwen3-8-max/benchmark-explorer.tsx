"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The two benchmark tables from the source, made explorable — with the eval-setup
// caveat attached to every row that has one, not buried in a footnote list. Every
// number here is reproduced from the post's own tables; nothing is computed or
// estimated. "--" cells (not yet available / not applicable) are dropped from the
// bars for that row rather than plotted as zero. The point is not a highlight reel:
// Qwen3.8-Max loses outright on several of these, and the wins are flagged with
// exactly the same rigor as the losses.

const ACCENT = "oklch(0.62 0.14 195)"

type Row = { model: string; value: number | null }
type Bench = {
  key: string
  label: string
  unit?: string
  rows: Row[]
  harness?: string
}
type Category = { key: string; label: string; benches: Bench[] }

const QWEN = "Qwen3.8-Max"

const CATEGORIES: Category[] = [
  {
    key: "coding",
    label: "Coding Agent",
    benches: [
      {
        key: "terminal-bench",
        label: "Terminal Bench 2.1",
        rows: [
          { model: "Opus4.8", value: 84.6 },
          { model: "Fable5", value: 84.6 },
          { model: "GPT5.6 Sol", value: 88.8 },
          { model: "Qwen3.7-Max", value: 74.5 },
          { model: QWEN, value: 86.6 },
        ],
        harness: "Qwen3.8-Max: Claude Code, avg@10, 5h timeout, max_tokens 131,072. All other models: best published score across harnesses (Artificial Analysis for Opus/Fable5, OpenAI's own post for GPT5.6 Sol) — best-of-published vs. avg@10 is not the same comparison.",
      },
      {
        key: "swe-bench-pro",
        label: "SWE-bench Pro",
        rows: [
          { model: "Opus4.8", value: 69.2 },
          { model: "Fable5", value: 80.0 },
          { model: "GPT5.6 Sol", value: 64.6 },
          { model: "Qwen3.7-Max", value: 60.6 },
          { model: QWEN, value: 67.7 },
        ],
        harness: "Claude Code harness, temp=1.0, top_p=0.95, 256K context. Problematic tasks were corrected and every baseline re-run on the refined benchmark.",
      },
      {
        key: "deepswe",
        label: "DeepSWE 1.1",
        rows: [
          { model: "Opus4.8", value: 59.0 },
          { model: "Fable5", value: 70.0 },
          { model: "GPT5.6 Sol", value: 73.0 },
          { model: "Qwen3.7-Max", value: 21.6 },
          { model: QWEN, value: 56.6 },
        ],
        harness: "Evaluated on both Claude Code and mini-SWE-agent; the higher of the two is reported. Qwen3.8-Max does best specifically on Claude Code — the harness it trains against most.",
      },
      {
        key: "paperbench",
        label: "PaperBench",
        rows: [
          { model: "Opus4.8", value: 80.3 },
          { model: "Fable5", value: 88.8 },
          { model: "GPT5.6 Sol", value: 90.5 },
          { model: "Qwen3.7-Max", value: 64.8 },
          { model: QWEN, value: 93.0 },
        ],
        harness: "BasicAgent, Code-Dev mode, judged by Claude Opus 4.6, averaged over 3 runs (max 12h/run) — a competitor model is the grader here.",
      },
      {
        key: "skillsbench",
        label: "SkillsBench",
        rows: [
          { model: "Opus4.8", value: 65.1 },
          { model: "Fable5", value: 70.9 },
          { model: "GPT5.6 Sol", value: 73.5 },
          { model: "Qwen3.7-Max", value: 61.2 },
          { model: QWEN, value: 70.2 },
        ],
        harness: "A different harness per model: Opus4.8 and Fable5 on Claude Code, GPT5.6 Sol on Codex, the whole Qwen series on OpenCode. Public SkillsBench v1.1, 87 tasks, avg of 3 runs.",
      },
      {
        key: "widesearch",
        label: "WideSearch",
        rows: [
          { model: "Opus4.8", value: 72.9 },
          { model: "Fable5", value: 81.2 },
          { model: "GPT5.6 Sol", value: null },
          { model: "Qwen3.7-Max", value: 75.2 },
          { model: QWEN, value: 81.9 },
        ],
        harness: "Claude Code harness for external models, Qwen-Agent harness for the Qwen series — item-F1 averaged over 4 runs.",
      },
      {
        key: "ifbench",
        label: "IFBench",
        rows: [
          { model: "Opus4.8", value: 62.2 },
          { model: "Fable5", value: 63.5 },
          { model: "GPT5.6 Sol", value: 72.7 },
          { model: "Qwen3.7-Max", value: 79.1 },
          { model: QWEN, value: 82.8 },
        ],
      },
      {
        key: "hle-tools",
        label: "HLE w/ tools",
        rows: [
          { model: "Opus4.8", value: 57.9 },
          { model: "Fable5", value: 64.5 },
          { model: "GPT5.6 Sol", value: 58.0 },
          { model: "Qwen3.7-Max", value: 53.5 },
          { model: QWEN, value: 56.2 },
        ],
      },
    ],
  },
  {
    key: "general",
    label: "General Capabilities",
    benches: [
      {
        key: "gpqa",
        label: "GPQA Diamond",
        rows: [
          { model: "Opus4.8", value: 92.0 },
          { model: "Fable5", value: 92.6 },
          { model: "GPT5.6 Sol", value: 94.1 },
          { model: "Qwen3.7-Max", value: 92.4 },
          { model: QWEN, value: 92.6 },
        ],
      },
      {
        key: "hle",
        label: "HLE",
        rows: [
          { model: "Opus4.8", value: 45.7 },
          { model: "Fable5", value: 53.3 },
          { model: "GPT5.6 Sol", value: 47.2 },
          { model: "Qwen3.7-Max", value: 41.4 },
          { model: QWEN, value: 43.6 },
        ],
      },
      {
        key: "healthbench",
        label: "HealthBench",
        rows: [
          { model: "Opus4.8", value: 52.4 },
          { model: "Fable5", value: null },
          { model: "GPT5.6 Sol", value: 55.3 },
          { model: "Qwen3.7-Max", value: 54.5 },
          { model: QWEN, value: 60.2 },
        ],
      },
      {
        key: "plawbench",
        label: "PLawBench",
        rows: [
          { model: "Opus4.8", value: 69.6 },
          { model: "Fable5", value: 70.2 },
          { model: "GPT5.6 Sol", value: 72.3 },
          { model: "Qwen3.7-Max", value: 58.9 },
          { model: QWEN, value: 73.2 },
        ],
        harness: "Judged by gemini-3.1-pro-preview, not by a member of the model family being ranked.",
      },
      {
        key: "prbench-finance",
        label: "PRBench-Finance",
        rows: [
          { model: "Opus4.8", value: 51.9 },
          { model: "Fable5", value: 55.8 },
          { model: "GPT5.6 Sol", value: 55.5 },
          { model: "Qwen3.7-Max", value: 46.8 },
          { model: QWEN, value: 58.3 },
        ],
      },
      {
        key: "onemillion",
        label: "$OneMillion-Bench",
        rows: [
          { model: "Opus4.8", value: 41.8 },
          { model: "Fable5", value: 55.9 },
          { model: "GPT5.6 Sol", value: 53.8 },
          { model: "Qwen3.7-Max", value: 44.4 },
          { model: QWEN, value: 52.5 },
        ],
        harness: "Judged by gemini-3.1-pro-preview.",
      },
    ],
  },
  {
    key: "visual",
    label: "Visual & Agentic",
    benches: [
      {
        key: "osworld-verified",
        label: "OSWorld-Verified",
        rows: [
          { model: "Opus4.8", value: 83.4 },
          { model: "Fable5", value: 85.0 },
          { model: "Gemini3.1-Pro", value: 76.2 },
          { model: "GPT5.6 Sol", value: 83.2 },
          { model: "Qwen3.7-Plus", value: 73.3 },
          { model: QWEN, value: 86.1 },
        ],
        harness: "Qwen's own dedicated computer-use agent, Qwen-CUA, separately reports 86.2 on this same benchmark — effectively a tie between two different Qwen models.",
      },
      {
        key: "osworld2",
        label: "OSWorld 2.0 (binary)",
        rows: [
          { model: "Opus4.8", value: 20.6 },
          { model: "Fable5", value: null },
          { model: "Gemini3.1-Pro", value: 7.8 },
          { model: "GPT5.6 Sol", value: null },
          { model: "Qwen3.7-Plus", value: 2.8 },
          { model: QWEN, value: 19.4 },
        ],
        harness: "Binary score shown (partial-credit scores run higher for every model — Fable5's partial score alone is 66.1). Fable5 and GPT5.6 Sol report no binary score.",
      },
      {
        key: "webarena",
        label: "WebArena-Verified",
        rows: [
          { model: "Opus4.8", value: 67.9 },
          { model: "Fable5", value: 71.3 },
          { model: "Gemini3.1-Pro", value: 64.3 },
          { model: "GPT5.6 Sol", value: 69.7 },
          { model: "Qwen3.7-Plus", value: 55.3 },
          { model: QWEN, value: 66.8 },
        ],
        harness: "Official WebArena grader, run inside the OSWorld scaffold.",
      },
      {
        key: "cad",
        label: "Parametric CAD Bench",
        rows: [
          { model: "Opus4.8", value: 85.1 },
          { model: "Fable5", value: 87.5 },
          { model: "Gemini3.1-Pro", value: 73.5 },
          { model: "GPT5.6 Sol", value: 86.2 },
          { model: "Qwen3.7-Plus", value: 73.8 },
          { model: QWEN, value: 91.5 },
        ],
      },
    ],
  },
]

export function BenchmarkExplorer() {
  const [catKey, setCatKey] = useState(CATEGORIES[0].key)
  const [benchKey, setBenchKey] = useState(CATEGORIES[0].benches[0].key)

  const cat = CATEGORIES.find((c) => c.key === catKey) ?? CATEGORIES[0]
  const bench = cat.benches.find((b) => b.key === benchKey) ?? cat.benches[0]

  const available = bench.rows.filter((r): r is { model: string; value: number } => r.value !== null)
  const scaleMax = Math.max(10, Math.ceil((Math.max(...available.map((r) => r.value)) * 1.15) / 10) * 10)
  const best = available.reduce((a, b) => (b.value > a.value ? b : a))
  const qwen = available.find((r) => r.model === QWEN)
  const qwenLeads = qwen ? qwen.model === best.model : false
  const gap = qwen ? Math.round((best.value - qwen.value) * 10) / 10 : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>full benchmark tables · wins and losses</span>
        <span className="text-muted-foreground/50">harness caveat shown per row</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setCatKey(c.key)
                setBenchKey(c.benches[0].key)
              }}
              aria-pressed={catKey === c.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                catKey === c.key ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {cat.benches.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBenchKey(b.key)}
              aria-pressed={benchKey === b.key}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                benchKey === b.key ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={benchKey === b.key ? { background: ACCENT } : undefined}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2.5">
          {bench.rows.map((r) => {
            if (r.value === null) {
              return (
                <div key={r.model} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-right font-mono text-xs text-muted-foreground sm:w-32">{r.model}</span>
                  <span className="font-mono text-[11px] text-muted-foreground/50">-- not reported</span>
                </div>
              )
            }
            const pct = Math.min(100, (r.value / scaleMax) * 100)
            const isBest = r.model === best.model
            const isQwen = r.model === QWEN
            return (
              <div key={r.model} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-28 shrink-0 truncate text-right font-mono text-xs sm:w-32",
                    isQwen ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.model}
                </span>
                <div className="relative h-6 flex-1">
                  <div className="absolute inset-0 rounded-sm bg-muted/40" />
                  <div
                    className="absolute top-0 h-full rounded-sm"
                    style={{ width: `${pct}%`, background: isQwen ? ACCENT : "oklch(0.62 0.02 260)", opacity: isQwen ? 0.95 : 0.65 }}
                  />
                  <span className="absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] tabular-nums text-foreground" style={{ left: `${pct}%` }}>
                    {isBest ? "● " : ""}
                    {r.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm leading-6 text-foreground">
            {qwen ? (
              qwenLeads ? (
                <>Qwen3.8-Max leads {bench.label} at {qwen.value}.</>
              ) : (
                <>
                  Qwen3.8-Max trails the leader ({best.model}) on {bench.label} by {gap} points — {qwen.value} vs {best.value}.
                </>
              )
            ) : (
              <>Qwen3.8-Max is not reported on {bench.label}.</>
            )}
          </p>
          {bench.harness ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Eval setup: {bench.harness}</p> : null}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every number above is copied from the source&rsquo;s own two tables — nothing here is estimated. Switch categories
          and benchmarks to see the honest spread: outright wins (PaperBench, IFBench, PLawBench, Parametric CAD Bench),
          close losses (Terminal Bench 2.1, WebArena-Verified), and clear losses (DeepSWE 1.1, HLE, MLS-Bench-Lite —
          not shown here, see the full table). Rows with an eval-setup note are the ones where the comparison is not
          strictly like-for-like.
        </p>
      </div>
    </figure>
  )
}
