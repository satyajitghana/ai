"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number here is from Qwen's own "Benchmark Results" tables (qwen.ai/blog?id=qwen3.8-omni-flash),
// picked so every category reads in the same direction (higher = better). The
// "Multi-speaker ASR" row scores are the one exception worth flagging: Qwen's
// figure shows this combined score only for AliMeeting-test. For the other three
// multi-speaker sets, the combined score is computed here from the blog's own
// raw DER/cpWER pairs using the blog's own disclosed formula (footnote 4):
// score = 100 * (1 - (0.5*DER + 0.5*cpWER)), DER/cpWER as fractions.

type Row = { name: string; qwen: number; gemini: number }

const CATEGORIES: { key: string; label: string; note: string; rows: Row[] }[] = [
  {
    key: "agentic",
    label: "Agentic",
    note: "Multimodal tool use — Qwen leads 2 of 4",
    rows: [
      { name: "WildClawBench-MM", qwen: 71.0, gemini: 58.9 },
      { name: "UniClawBench", qwen: 69.6, gemini: 69.0 },
      { name: "AgenticVBench", qwen: 36.8, gemini: 45.0 },
      { name: "OmniGAIA", qwen: 74.0, gemini: 78.6 },
    ],
  },
  {
    key: "audiovisual",
    label: "Audio-visual",
    note: "“close to” — true within a few points, except long video",
    rows: [
      { name: "DailyOmni", qwen: 85.1, gemini: 84.0 },
      { name: "AVUT", qwen: 86.6, gemini: 88.0 },
      { name: "OmniVideoBench", qwen: 63.4, gemini: 65.2 },
      { name: "Video-MME-v2", qwen: 65.0, gemini: 71.0 },
      { name: "LVOmniBench", qwen: 63.3, gemini: 70.7 },
    ],
  },
  {
    key: "multispeaker",
    label: "Multi-speaker ASR",
    note: "combined score, ↑ — the real “exceeds”",
    rows: [
      { name: "AliMeeting-test", qwen: 89.7, gemini: 37.1 },
      { name: "AISHELL-4", qwen: 93.0, gemini: 38.4 },
      { name: "MagicData-RAMC", qwen: 90.1, gemini: 49.2 },
      { name: "MLC-SLM (en)", qwen: 90.9, gemini: 56.3 },
    ],
  },
  {
    key: "everyday",
    label: "Everyday audio",
    note: "ordinary single-speaker ASR/voice — Gemini leads all 4",
    rows: [
      { name: "MMSU", qwen: 82.1, gemini: 83.3 },
      { name: "WildSpeech", qwen: 74.3, gemini: 76.4 },
      { name: "VoiceBench", qwen: 91.6, gemini: 92.3 },
      { name: "Audio-MultiChallenge", qwen: 71.5, gemini: 71.9 },
    ],
  },
]

const QWEN_C = "oklch(0.55 0.18 265)" // indigo, matches the blog's own bar color
const GEMINI_C = "oklch(0.6 0.02 260)" // neutral gray

export function BenchmarkGap() {
  const [ck, setCk] = useState("agentic")
  const cat = CATEGORIES.find((c) => c.key === ck)!
  const max = Math.max(...cat.rows.flatMap((r) => [r.qwen, r.gemini])) * 1.08

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Qwen3.8-Omni-Flash vs Gemini 3.8 Flash</span>
        <span className="font-mono text-[10px] text-muted-foreground">{cat.note}</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCk(c.key)}
              aria-pressed={ck === c.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                ck === c.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: QWEN_C }} />
            Qwen3.8-Omni-Flash
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: GEMINI_C }} />
            Gemini 3.8 Flash
          </span>
          <span className="ml-auto">higher is better on every row shown</span>
        </div>

        <div className="mt-3 space-y-3">
          {cat.rows.map((r) => {
            const delta = r.qwen - r.gemini
            const leads = delta > 0
            return (
              <div key={r.name}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
                  <span className="text-foreground">{r.name}</span>
                  <span
                    className="tabular-nums"
                    style={{ color: leads ? "oklch(0.55 0.15 155)" : "oklch(0.6 0.18 25)" }}
                  >
                    {leads ? "+" : ""}
                    {delta.toFixed(1)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="relative h-4 rounded-sm bg-muted/30">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{ width: `${(r.qwen / max) * 100}%`, background: QWEN_C }}
                    />
                    <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[10px] tabular-nums text-muted-foreground">
                      {r.qwen.toFixed(1)}
                    </span>
                  </div>
                  <div className="relative h-4 rounded-sm bg-muted/30">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm opacity-70"
                      style={{ width: `${(r.gemini / max) * 100}%`, background: GEMINI_C }}
                    />
                    <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[10px] tabular-nums text-muted-foreground">
                      {r.gemini.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </figure>
  )
}
