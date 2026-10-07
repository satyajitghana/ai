"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { CELLS } from "./cells"

// Actual Computer's own speed table (cells.ts, copied from docs/bench/e2e.md), one view at a time.
// "Fresh text" is their cold state: a new scratch per call, so toks's dynamic cache and memo start
// empty while its static tables (built at load) stay; gigatoken gets a fresh state per call too.
// "Replay" is their warm state: the same text a second time, each tool with its own default cache
// (toks a 4 MiB memo and 2 MiB piece cache, gigatoken 512 MiB), which they call an unmatched pair.
// Log axis; positions go through lib/dmath so server and client agree.

const HOSTS = [
  { key: "gb10c-neon", label: "GB10 · NEON" },
  { key: "tr9970x-avx2", label: "Zen 5 · AVX2" },
  { key: "m2ultra2-neon", label: "M2 Ultra · NEON" },
]
const CHUNKS = [
  { key: "4k", label: "4 KiB calls" },
  { key: "whole", label: "whole file" },
]
const CORPORA = [
  { key: "en", label: "English" },
  { key: "code", label: "code" },
  { key: "ml", label: "multilingual" },
  { key: "cjk", label: "CJK" },
]
const NAMES: Record<string, string> = {
  gpt2: "GPT-2",
  llama3: "Llama 3",
  glm53: "GLM 5.3",
  qwen38: "Qwen 3.8",
  o200k: "gpt-oss",
  gemma4: "Gemma 4",
  "nemotron3-4b": "Nemotron 3",
  llama4: "Llama 4",
  minimaxm2: "MiniMax M2",
  dsv4: "DeepSeek V4",
  kimik3: "Kimi K3",
}

const C = {
  toks: "oklch(0.6 0.16 250)",
  giga: "oklch(0.66 0.17 45)",
  tik: "oklch(0.62 0.13 165)",
  hf: "oklch(0.6 0.02 250)",
  loss: "oklch(0.64 0.19 30)",
}

const chip = (active: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
    active
      ? "border-foreground/30 bg-muted/50 text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  )

function Dot({ v, lo, hi, color, shape }: { v: number | null; lo: number; hi: number; color: string; shape: "c" | "d" | "s" }) {
  if (v === null || v <= 0) return null
  const t = (mlog10(v) - mlog10(lo)) / (mlog10(hi) - mlog10(lo))
  const x = Math.round(Math.min(1, Math.max(0, t)) * 1000) / 10
  const r = shape === "d" ? "rotate(45deg)" : undefined
  return (
    <span
      className={cn("absolute top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2", shape === "c" ? "rounded-full" : "rounded-[1px]")}
      style={{ left: `${x}%`, background: color, transform: r ? `translate(-50%, -50%) ${r}` : undefined }}
    />
  )
}

export function SpeedCells() {
  const [host, setHost] = useState("gb10c-neon")
  const [chunk, setChunk] = useState("4k")
  const [corpus, setCorpus] = useState("en")
  const [warm, setWarm] = useState(false)

  const rows = (CELLS[`${host}|${chunk}`] ?? []).filter((r) => r[1] === corpus)
  const lo = warm ? 50 : 2
  const hi = warm ? 30000 : 1000
  const ticks = warm ? [100, 300, 1000, 3000, 10000] : [3, 10, 30, 100, 300, 1000]
  const pos = (v: number) => Math.round(((mlog10(v) - mlog10(lo)) / (mlog10(hi) - mlog10(lo))) * 1000) / 10

  let ahead = 0
  let counted = 0
  for (const r of rows) {
    const t = warm ? r[3] : r[2]
    const g = warm ? r[7] : r[6]
    if (g === null) continue
    counted += 1
    if (t > g) ahead += 1
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Actual&apos;s speed table · one thread · MB/s, log axis</span>
        <div className="flex gap-1" role="group" aria-label="state">
          <button type="button" aria-pressed={!warm} onClick={() => setWarm(false)} className={chip(!warm)}>
            fresh text
          </button>
          <button type="button" aria-pressed={warm} onClick={() => setWarm(true)} className={chip(warm)}>
            replay
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <div className="flex flex-wrap gap-1" role="group" aria-label="machine">
            {HOSTS.map((h) => (
              <button key={h.key} type="button" aria-pressed={host === h.key} onClick={() => setHost(h.key)} className={chip(host === h.key)}>
                {h.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="chunking">
            {CHUNKS.map((h) => (
              <button key={h.key} type="button" aria-pressed={chunk === h.key} onClick={() => setChunk(h.key)} className={chip(chunk === h.key)}>
                {h.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="corpus">
            {CORPORA.map((h) => (
              <button key={h.key} type="button" aria-pressed={corpus === h.key} onClick={() => setCorpus(h.key)} className={chip(corpus === h.key)}>
                {h.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: C.toks }} />
            toks
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rotate-45 align-middle" style={{ background: C.giga }} />
            gigatoken
          </span>
          {!warm && (
            <>
              <span>
                <span className="mr-1 inline-block h-2 w-2 align-middle" style={{ background: C.tik }} />
                tiktoken
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: C.hf }} />
                hf tokenizers 0.23.2
              </span>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          {rows.map((r) => {
            const t = warm ? r[3] : r[2]
            const g = warm ? r[7] : r[6]
            const vsG = g === null ? null : t / g
            return (
              <div key={r[0]} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-2">
                <span className="truncate font-mono text-xs">{NAMES[r[0]] ?? r[0]}</span>
                <div className="relative h-4 rounded-sm bg-muted/30">
                  {!warm && <Dot v={r[4]} lo={lo} hi={hi} color={C.hf} shape="c" />}
                  {!warm && <Dot v={r[5]} lo={lo} hi={hi} color={C.tik} shape="s" />}
                  <Dot v={g} lo={lo} hi={hi} color={C.giga} shape="d" />
                  <Dot v={t} lo={lo} hi={hi} color={C.toks} shape="c" />
                </div>
                <span className="text-right font-mono text-[11px] tabular-nums">
                  <span style={{ color: C.toks }}>{t.toFixed(0)}</span>
                  <span className="text-muted-foreground"> · </span>
                  {vsG === null ? (
                    <span className="text-muted-foreground">n/a</span>
                  ) : (
                    <span style={{ color: vsG < 1 ? C.loss : undefined }}>{vsG.toFixed(2)}×g</span>
                  )}
                </span>
              </div>
            )
          })}
          <div className="grid grid-cols-[5.5rem_1fr_6.5rem] gap-2">
            <span />
            <div className="relative h-4 font-mono text-[10px] text-muted-foreground">
              {ticks.map((v) => (
                <span key={v} className="absolute -translate-x-1/2" style={{ left: `${pos(v)}%` }}>
                  {v >= 1000 ? `${v / 1000}k` : v}
                </span>
              ))}
            </div>
            <span />
          </div>
        </div>

        <p className="font-mono text-[11px] text-muted-foreground">
          {warm
            ? "Replay: the same text a second time. Where it fits, toks answers from its 4 MiB memo (a lookup, not tokenization); where it does not, gigatoken's 512 MiB cache wins: nearly every multilingual replay, and whole-file replays outside code."
            : "Fresh text: a new scratch per call. toks keeps its load-time tables; gigatoken starts each call with an empty cache."}{" "}
          toks ahead of gigatoken in {ahead} of {counted} rows shown. ×g = toks ÷ gigatoken.
        </p>
      </div>
    </figure>
  )
}
