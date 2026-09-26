"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Qwen-Audio-3.1 moves ASR and TTS from per-second / per-character billing to
// per-token billing, and the announcement quotes the cut as "ASR up to 95% off"
// and "TTS ~70% off". Neither claim can be checked without knowing how many
// tokens a second of audio bills as, and the ASR and TTS price pages do not
// say. The one published rule is for the realtime dialogue models: audio
// tokens = seconds x 12.5 (Alibaba Cloud Model Studio pricing page). This
// widget makes that the default and lets you move it.
//
// List prices, as published on 2026-09-26:
//   qwencloud.com (international, USD): qwen-audio-3.0-asr-flash(-filetrans)
//     $0.000035/s; qwen-audio-3.1-asr-flash(-filetrans) $0.15/M in, $0.47/M out.
//   help.aliyun.com model-pricing (Beijing, CNY): qwen-audio-3.0-asr-flash
//     (-filetrans) 0.00022/s; qwen-audio-3.1-asr-flash(-filetrans) 0.8/M in,
//     2.7/M out; qwen-audio-3.0-tts-flash 1 per 10,000 characters (a Chinese
//     character counts as 2); qwen-audio-3.1-tts-flash 1.5/M in, 12/M out.
// Speech rates for TTS come from the Qwen-Audio-3.1 blog's own long-form demos:
//   Mandarin, 449 Chinese characters + 44 other characters read in 98 s;
//   English, 1,122 characters read in 72 s.
// Input text tokens are bounded above at one token per character.

type Region = "cn" | "intl"
type Mode = "asr" | "tts"
type Lang = "zh" | "en"

const ASR = {
  cn: { cur: "CNY", sym: "¥", oldPerSec: 0.00022, inPerM: 0.8, outPerM: 2.7 },
  intl: { cur: "USD", sym: "$", oldPerSec: 0.000035, inPerM: 0.15, outPerM: 0.47 },
} as const

const TTS = {
  oldPer10k: 1, // CNY per 10,000 billing characters, qwen-audio-3.0-tts-flash
  inPerM: 1.5, // CNY, qwen-audio-3.1-tts-flash
  outPerM: 12,
  zh: { billingPerSec: (449 * 2 + 44) / 98, charsPerSec: 493 / 98 },
  en: { billingPerSec: 1122 / 72, charsPerSec: 1122 / 72 },
} as const

const RATES = [12.5, 25, 50]
const OLD = "oklch(0.7 0.02 260)"
const NEW = "oklch(0.62 0.15 160)"

function money(sym: string, v: number) {
  if (v >= 0.1) return `${sym}${v.toFixed(3)}`
  return `${sym}${v.toFixed(4)}`
}

function Bar({ label, v, max, color, text }: { label: string; v: number; max: number; color: string; text: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr_5rem] items-center gap-2 sm:grid-cols-[9rem_1fr_5.5rem]">
      <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
      <div className="relative h-4 rounded-sm bg-muted/30">
        <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.max(0.6, (v / max) * 100)}%`, background: color }} />
      </div>
      <span className="text-right font-mono text-[11px] tabular-nums text-foreground">{text}</span>
    </div>
  )
}

export function PriceMath() {
  const [mode, setMode] = useState<Mode>("asr")
  const [region, setRegion] = useState<Region>("cn")
  const [lang, setLang] = useState<Lang>("zh")
  const [rateIdx, setRateIdx] = useState(0)
  const [outTok, setOutTok] = useState(12000)
  const rate = RATES[rateIdx]

  let oldCost = 0
  let newCost = 0
  let newInputOnly = 0
  let sym = "¥"
  let unitLabel = ""
  let claim = ""
  let oldName = ""
  let newName = ""

  if (mode === "asr") {
    const p = ASR[region]
    sym = p.sym
    oldCost = p.oldPerSec * 3600
    newInputOnly = (rate * 3600 * p.inPerM) / 1e6
    newCost = newInputOnly + (outTok * p.outPerM) / 1e6
    unitLabel = `${p.cur} per hour of audio`
    claim = "announced: “up to 95% off”"
    oldName = "3.0 ASR-Flash"
    newName = "3.1 ASR-Flash"
  } else {
    const l = TTS[lang]
    oldCost = ((l.billingPerSec * 60) / 10000) * TTS.oldPer10k
    const outCost = (rate * 60 * TTS.outPerM) / 1e6
    const inCost = (l.charsPerSec * 60 * TTS.inPerM) / 1e6
    newCost = outCost + inCost
    newInputOnly = outCost
    unitLabel = "CNY per minute of speech (Beijing)"
    claim = "announced: “TTS ~70% off”"
    oldName = "3.0 TTS-Flash"
    newName = "3.1 TTS-Flash"
  }

  const cut = (1 - newCost / oldCost) * 100
  const cutIn = (1 - newInputOnly / oldCost) * 100
  const max = Math.max(oldCost, newCost)

  const pill = (on: boolean) =>
    `rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
      on ? "border-transparent bg-foreground text-background" : "bg-muted/20 text-muted-foreground hover:text-foreground"
    }`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">per-second billing &rarr; per-token billing</span>
        <span className="font-mono text-[10px] text-muted-foreground">list prices, 2026-09-26</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={pill(mode === "asr")} aria-pressed={mode === "asr"} onClick={() => setMode("asr")}>
            ASR
          </button>
          <button type="button" className={pill(mode === "tts")} aria-pressed={mode === "tts"} onClick={() => setMode("tts")}>
            TTS
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          {mode === "asr" ? (
            <>
              <button type="button" className={pill(region === "cn")} aria-pressed={region === "cn"} onClick={() => setRegion("cn")}>
                Beijing, CNY
              </button>
              <button type="button" className={pill(region === "intl")} aria-pressed={region === "intl"} onClick={() => setRegion("intl")}>
                qwencloud, USD
              </button>
            </>
          ) : (
            <>
              <button type="button" className={pill(lang === "zh")} aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>
                Mandarin
              </button>
              <button type="button" className={pill(lang === "en")} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
                English
              </button>
            </>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>audio tokens per second (assumed)</span>
              <span className="tabular-nums text-foreground">{rate}</span>
            </div>
            <Range
              min={0}
              max={2}
              step={1}
              value={rateIdx}
              onChange={(e) => setRateIdx(+e.target.value)}
              className="w-full"
              aria-label="audio tokens per second"
              accent={NEW}
            />
            <div className="mt-0.5 flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>12.5 (realtime rule)</span>
              <span>25</span>
              <span>50</span>
            </div>
          </div>

          {mode === "asr" ? (
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>transcript tokens per hour (assumed)</span>
                <span className="tabular-nums text-foreground">{outTok.toLocaleString("en-US")}</span>
              </div>
              <Range
                min={0}
                max={20000}
                step={1000}
                value={outTok}
                onChange={(e) => setOutTok(+e.target.value)}
                className="w-full"
                aria-label="transcript tokens per hour"
                accent={NEW}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="font-mono text-[10px] text-muted-foreground">{unitLabel}</div>
          <Bar label={oldName} v={oldCost} max={max} color={OLD} text={money(sym, oldCost)} />
          <Bar label={newName} v={newCost} max={max} color={NEW} text={money(sym, newCost)} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">cheaper, all in</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: NEW }}>
              {cut.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">
              {mode === "asr" ? "cheaper, audio input only" : "cheaper, audio output only"}
            </div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{cutIn.toFixed(1)}%</div>
          </div>
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">{claim}</div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "asr"
            ? "At the 12.5 tokens/s rule the realtime models publish, the audio side alone lands on the announced 95% in Beijing and just under it on qwencloud; the transcript tokens are what keep the all-in figure lower. The ASR pages do not publish their own rate, so the slider is the honest part of this."
            : "The TTS cut depends almost entirely on how many output tokens a second of speech bills as, which no page publishes. At 12.5 tokens/s the new price is far more than 70% below the old one; near 25 tokens/s Mandarin lands close to 70%. Input text is bounded at one token per character and costs almost nothing either way."}
        </p>
      </div>
    </figure>
  )
}
