"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import {
  AUDIO_TOK_PER_S,
  CHUNK_S,
  CHUNK_TOKENS,
  CONTEXT,
  KV_ALL_ATTENTION,
  KV_BYTES_PER_TOKEN,
  LANGS,
  SSM_STATE_MB,
} from "./data"

// What a recording costs the language model. The front end is the one in the config (25 ms windows,
// 10 ms hop, 128 mel bins, features stacked 8 to one), which I ran on synthetic audio: 3,001 frames and
// 376 tokens for a 30 s chunk (measured). 12.5 audio tokens a second follows. The KV cache is six attention
// layers x K and V x 2 heads x 128 x 2 bytes = 6,144 bytes a token (config arithmetic); the Mamba layers keep a
// fixed 48.2 MB state however long the audio is (arithmetic: 23 x 64 x 64 x 128 x 4 bytes). The all-attention
// column is hypothetical: the same heads in all 52 layers. Tokens per word come from the real tokenizer on one
// sentence per language that I wrote, so treat the language rows as a rough guide.

const PRESETS = [
  { t: "30 s", s: 30 },
  { t: "10 min", s: 600 },
  { t: "1 h", s: 3600 },
  { t: "87 min", s: 5243 },
]

const fmtDur = (s: number) => {
  if (s < 90) return `${s.toFixed(0)} s`
  if (s < 5400) return `${(s / 60).toFixed(1)} min`
  return `${(s / 3600).toFixed(2)} h`
}

export function AudioBudget() {
  const [sec, setSec] = useState(3600)
  const [lang, setLang] = useState<(typeof LANGS)[number]["id"]>("en")
  const [wps, setWps] = useState(2.5)

  const L = LANGS.find((l) => l.id === lang) ?? LANGS[0]
  const tokPerWord = L.tokens / L.words
  const audioTok = sec * AUDIO_TOK_PER_S
  const chunks = Math.ceil(sec / CHUNK_S)
  const textTok = sec * wps * tokPerWord
  const used = audioTok + textTok
  const kvMB = (used * KV_BYTES_PER_TOKEN) / 1e6
  const kvAllMB = (used * KV_ALL_ATTENTION) / 1e6
  const fill = used / CONTEXT
  const over = used > CONTEXT

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one recording through the language model · front end measured, memory from the config, speech rate yours
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">length</span>
        {PRESETS.map((p) => (
          <button
            key={p.t}
            type="button"
            onClick={() => setSec(p.s)}
            aria-pressed={sec === p.s}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              sec === p.s ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {p.t}
          </button>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">language</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as typeof lang)}
          aria-label="Transcript language"
          className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]"
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 px-4 pt-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-36 shrink-0 font-mono text-muted-foreground">audio length</span>
          <Range min={30} max={5400} step={30} value={Math.min(5400, Math.max(30, sec))} onChange={(e) => setSec(Number(e.target.value))} aria-label="Audio length in seconds" className="w-full" />
          <span className="w-20 shrink-0 text-right font-mono tabular-nums">{fmtDur(sec)}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-36 shrink-0 font-mono text-muted-foreground">speaking rate</span>
          <Range min={1} max={4} step={0.1} value={wps} onChange={(e) => setWps(Number(e.target.value))} aria-label="Words per second" className="w-full" />
          <span className="w-20 shrink-0 text-right font-mono tabular-nums">{wps.toFixed(1)} w/s</span>
        </label>
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
        <div className="space-y-2 font-mono text-[11px]">
          <div className="text-muted-foreground">context used, of {CONTEXT.toLocaleString("en-US")} tokens</div>
          <div className="flex h-4 overflow-hidden rounded bg-muted" role="img" aria-label={`${audioTok.toFixed(0)} audio tokens and ${textTok.toFixed(0)} transcript tokens, ${(fill * 100).toFixed(0)} percent of the context.`}>
            <div style={{ width: `${Math.min(100, (audioTok / CONTEXT) * 100).toFixed(1)}%`, background: "oklch(0.58 0.15 255)" }} />
            <div style={{ width: `${Math.min(100 - Math.min(100, (audioTok / CONTEXT) * 100), (textTok / CONTEXT) * 100).toFixed(1)}%`, background: "oklch(0.70 0.15 70)" }} />
          </div>
          <div className={cn("tabular-nums", over && "text-foreground")}>
            {audioTok.toFixed(0)} audio + {textTok.toFixed(0)} text = {(fill * 100).toFixed(0)}%{over ? " (over the trained limit)" : ""}
          </div>
          <div className="text-muted-foreground">
            {chunks} chunks of {CHUNK_S} s through the encoder, {CHUNK_TOKENS} tokens each
          </div>
          <div className="text-muted-foreground">
            {L.name}: {tokPerWord.toFixed(2)} tokens a word, so {(wps * tokPerWord).toFixed(1)} text tokens a second against {AUDIO_TOK_PER_S} audio tokens a second
          </div>
        </div>

        <div className="grid grid-cols-2 content-start gap-x-4 gap-y-3 font-mono text-xs">
          <div>
            <div className="text-muted-foreground">KV cache, 6 attention layers</div>
            <div className="text-xl tabular-nums">{kvMB.toFixed(0)} MB</div>
            <div className="text-[10px] text-muted-foreground">{KV_BYTES_PER_TOKEN.toLocaleString("en-US")} B a token</div>
          </div>
          <div>
            <div className="text-muted-foreground">Mamba state</div>
            <div className="text-xl tabular-nums">{SSM_STATE_MB} MB</div>
            <div className="text-[10px] text-muted-foreground">fixed, any length</div>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground">same heads in all 52 layers (hypothetical)</div>
            <div className="text-xl tabular-nums">{(kvAllMB / 1000).toFixed(2)} GB</div>
            <div className="text-[10px] text-muted-foreground">{(kvAllMB / kvMB).toFixed(1)}x the real cache</div>
          </div>
        </div>
      </div>
    </figure>
  )
}
