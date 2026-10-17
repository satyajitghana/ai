"use client"

// Tokenizer fertility, measured: the same sentence through four tokenizers.
//
// Every split below is real output, produced on a shared 4-core CPU VM with the
// `tokenizers` library (0.23.3) loading each repository's own tokenizer.json:
//   gpt2  — openai-community/gpt2 (English-centric byte-level BPE, the reference)
//   qwen3 — Qwen/Qwen3-8B
//   k2s   — IFM/K2-Horizon-0.9B, the 64K vocabulary the smallest size uses
//   k2    — IFM/K2-Horizon-3.7B / 7B / 32B / 36B / 375B, the 250K vocabulary
// Jais 3's tokenizer.json is byte-identical (same sha256) to its K2 Horizon base
// at every size, so the "k2" rows are the Jais 3 rows.
//
// The sentences are passage 10 of Belebele (facebook/belebele, CC-BY-SA 4.0) in
// English, Modern Standard Arabic and Egyptian Arabic, plus one short sentence I
// wrote fully voweled. Byte-level BPE can split one Arabic letter into two
// byte-tokens; those share a character span, so a chip marked ×2 is one
// character that cost two tokens.
//
// The corpus panel is the whole of Belebele's 488 unique passages per variant.

import { useState } from "react"

type TokId = "gpt2" | "qwen3" | "k2s" | "k2"
type Seg = [string, number]
type Sample = {
  id: "en" | "msa" | "arz" | "diac"
  label: string
  note: string
  dir: "ltr" | "rtl"
  words: number
  tok: Record<TokId, Seg[]>
}
type Corpus = { vocab: number; arabic: number; en: number; msa: number; arz: number; ary: number }

const TOKS: { id: TokId; name: string; sub: string }[] = [
  { id: "gpt2", name: "GPT-2", sub: "50K, English-centric" },
  { id: "qwen3", name: "Qwen3", sub: "151K, multilingual" },
  { id: "k2s", name: "K2 Horizon 0.9B", sub: "64K = Jais 3 0.9B" },
  { id: "k2", name: "K2 Horizon 3.7B+", sub: "250K = Jais 3 3.7B+" },
]

const SAMPLES: Sample[] = [
  {
    id: "en",
    label: "English",
    note: "The Belebele passage, English original",
    dir: "ltr",
    words: 28,
    tok: {
      gpt2: [["Every", 1], [" morning", 1], [",", 1], [" people", 1], [" leave", 1], [" small", 1], [" country", 1], [" towns", 1], [" in", 1], [" cars", 1], [" to", 1], [" go", 1], [" their", 1], [" workplace", 1], [" and", 1], [" are", 1], [" passed", 1], [" by", 1], [" others", 1], [" whose", 1], [" work", 1], [" destination", 1], [" is", 1], [" the", 1], [" place", 1], [" they", 1], [" have", 1], [" just", 1], [" left", 1], [".", 1]],
      qwen3: [["Every", 1], [" morning", 1], [",", 1], [" people", 1], [" leave", 1], [" small", 1], [" country", 1], [" towns", 1], [" in", 1], [" cars", 1], [" to", 1], [" go", 1], [" their", 1], [" workplace", 1], [" and", 1], [" are", 1], [" passed", 1], [" by", 1], [" others", 1], [" whose", 1], [" work", 1], [" destination", 1], [" is", 1], [" the", 1], [" place", 1], [" they", 1], [" have", 1], [" just", 1], [" left", 1], [".", 1]],
      k2s: [["Every", 1], [" morning", 1], [",", 1], [" people", 1], [" leave", 1], [" small", 1], [" country", 1], [" towns", 1], [" in", 1], [" cars", 1], [" to", 1], [" go", 1], [" their", 1], [" workplace", 1], [" and", 1], [" are", 1], [" passed", 1], [" by", 1], [" others", 1], [" whose", 1], [" work", 1], [" destination", 1], [" is", 1], [" the", 1], [" place", 1], [" they", 1], [" have", 1], [" just", 1], [" left", 1], [".", 1]],
      k2: [["Every", 1], [" morning", 1], [",", 1], [" people", 1], [" leave", 1], [" small", 1], [" country", 1], [" towns", 1], [" in", 1], [" cars", 1], [" to", 1], [" go", 1], [" their", 1], [" workplace", 1], [" and", 1], [" are", 1], [" passed", 1], [" by", 1], [" others", 1], [" whose", 1], [" work", 1], [" destination", 1], [" is", 1], [" the", 1], [" place", 1], [" they", 1], [" have", 1], [" just", 1], [" left", 1], [".", 1]],
    },
  },
  {
    id: "msa",
    label: "Arabic (MSA)",
    note: "The same sentence, Modern Standard Arabic",
    dir: "rtl",
    words: 23,
    tok: {
      gpt2: [["ي", 1], ["ُ", 2], ["غ", 2], ["اد", 1], ["د", 1], ["ر", 1], [" ال", 1], ["ن", 1], ["اس", 1], ["س", 1], [" ال", 1], ["م", 1], ["د", 1], ["ن", 1], [" ال", 1], ["ص", 2], ["غ", 2], ["ي", 1], ["ر", 1], ["ة", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" س", 1], ["س", 1], ["ي", 1], ["ا", 1], ["ر", 1], ["ات", 1], ["ت", 1], ["ه", 1], ["م", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" ك", 1], ["ك", 1], ["ل", 1], [" ص", 1], ["ص", 1], ["ب", 1], ["اح", 1], ["ح", 1], [" ", 1], ["ل", 1], ["ي", 1], ["ذ", 2], ["ه", 1], ["ب", 1], ["و", 1], ["ا", 1], [" إ", 1], ["إ", 1], ["ل", 1], ["ى", 2], [" أ", 1], ["أ", 1], ["م", 1], ["ا", 1], ["ك", 2], ["ن", 1], [" ع", 1], ["ع", 1], ["م", 1], ["ل", 1], ["ه", 1], ["م", 1], [" و", 1], ["ي", 1], ["ق", 2], ["اب", 1], ["ب", 1], ["ل", 1], ["ه", 1], ["م", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" ال", 1], ["ط", 2], ["ر", 1], ["ي", 1], ["ق", 2], [" ال", 1], ["آ", 2], ["خ", 2], ["ر", 1], ["و", 1], ["ن", 1], [" ال", 1], ["ع", 1], ["ا", 1], ["م", 1], ["ل", 1], ["و", 1], ["ن", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" ال", 1], ["م", 1], ["ك", 2], ["ا", 1], ["ن", 1], [" ال", 1], ["ذ", 2], ["ي", 1], [" غ", 1], ["غ", 1], ["اد", 1], ["د", 1], ["ر", 1], ["و", 1], ["ه", 1], [" ", 1], ["ل", 1], ["ل", 1], ["ت", 1], ["و", 1], [".", 1]],
      qwen3: [["ي", 1], ["ُ", 1], ["غ", 1], ["ادر", 1], [" الناس", 1], [" الم", 1], ["دن", 1], [" الص", 1], ["غ", 1], ["يرة", 1], [" في", 1], [" سي", 1], ["ارات", 1], ["هم", 1], [" في", 1], [" كل", 1], [" صباح", 1], [" لي", 1], ["ذهب", 1], ["وا", 1], [" إلى", 1], [" أما", 1], ["كن", 1], [" عمل", 1], ["هم", 1], [" وي", 1], ["قابل", 1], ["هم", 1], [" في", 1], [" الطريق", 1], [" الآ", 1], ["خ", 1], ["رون", 1], [" الع", 1], ["امل", 1], ["ون", 1], [" في", 1], [" الم", 1], ["كان", 1], [" الذي", 1], [" غ", 1], ["اد", 1], ["رو", 1], ["ه", 1], [" لل", 1], ["تو", 1], [".", 1]],
      k2s: [["ي", 1], ["ُ", 1], ["غ", 1], ["ادر", 1], [" الناس", 1], [" المدن", 1], [" الصغيرة", 1], [" في", 1], [" سيارات", 1], ["هم", 1], [" في", 1], [" كل", 1], [" صباح", 1], [" لي", 1], ["ذهب", 1], ["وا", 1], [" إلى", 1], [" أماكن", 1], [" عمل", 1], ["هم", 1], [" ويق", 1], ["ابل", 1], ["هم", 1], [" في", 1], [" الطريق", 1], [" الآخر", 1], ["ون", 1], [" العام", 1], ["لون", 1], [" في", 1], [" المكان", 1], [" الذي", 1], [" غ", 1], ["اد", 1], ["روه", 1], [" للت", 1], ["و", 1], [".", 1]],
      k2: [["ي", 1], ["ُ", 1], ["غادر", 1], [" الناس", 1], [" المدن", 1], [" الصغيرة", 1], [" في", 1], [" سيارات", 1], ["هم", 1], [" في", 1], [" كل", 1], [" صباح", 1], [" لي", 1], ["ذهب", 1], ["وا", 1], [" إلى", 1], [" أماكن", 1], [" عملهم", 1], [" ويق", 1], ["ابل", 1], ["هم", 1], [" في", 1], [" الطريق", 1], [" الآخرون", 1], [" العاملون", 1], [" في", 1], [" المكان", 1], [" الذي", 1], [" غ", 1], ["اد", 1], ["روه", 1], [" للتو", 1], [".", 1]],
    },
  },
  {
    id: "arz",
    label: "Egyptian Arabic",
    note: "The same sentence, Egyptian dialect",
    dir: "rtl",
    words: 27,
    tok: {
      gpt2: [["ال", 1], ["ن", 1], ["اس", 1], ["س", 1], [" ب", 1], ["ب", 1], ["ي", 1], ["م", 1], ["ش", 2], ["و", 1], ["ا", 1], [" م", 1], ["ن", 1], [" ال", 1], ["م", 1], ["د", 1], ["ن", 1], [" ال", 1], ["ص", 2], ["غ", 2], ["ي", 1], ["ر", 1], ["ة", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" ع", 1], ["ع", 1], ["ر", 1], ["ب", 1], ["ي", 1], ["ات", 1], ["ت", 1], ["ه", 1], ["م", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" ك", 1], ["ك", 1], ["ل", 1], [" ص", 1], ["ص", 1], ["ب", 1], ["اح", 1], ["ح", 1], [" ع", 1], ["ع", 1], ["ش", 2], ["ا", 1], ["ن", 1], [" ي", 1], ["ي", 1], ["ر", 1], ["و", 1], ["ح", 2], ["و", 1], ["ا", 1], [" ", 1], ["ل", 1], ["أ", 2], ["م", 1], ["ا", 1], ["ك", 2], ["ن", 1], [" ع", 1], ["ع", 1], ["م", 1], ["ل", 1], ["ه", 1], ["م", 1], [" و", 1], ["ب", 1], ["ي", 1], ["ق", 2], ["اب", 1], ["ب", 1], ["ل", 1], ["ه", 1], ["م", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" ال", 1], ["ط", 2], ["ر", 1], ["ي", 1], ["ق", 2], [" ال", 1], ["ن", 1], ["اس", 1], ["س", 1], [" ال", 1], ["ت", 1], ["ا", 1], ["ن", 1], ["ي", 1], ["ي", 1], ["ن", 1], [" ال", 1], ["ل", 1], ["ي", 1], [" ب", 1], ["ب", 1], ["ي", 1], ["ش", 2], ["ت", 1], ["غ", 2], ["ل", 1], ["و", 1], ["ا", 1], [" ف", 1], ["ف", 1], ["ي", 1], [" ال", 1], ["م", 1], ["ك", 2], ["ا", 1], ["ن", 1], [" ال", 1], ["ل", 1], ["ي", 1], [" س", 1], ["س", 1], ["اب", 1], ["ب", 1], ["و", 1], ["ه", 1], [" ", 1], ["ل", 1], ["س", 1], ["ه", 1], [" د", 1], ["د", 1], ["ل", 1], ["و", 1], ["ق", 2], ["ت", 1], ["ي", 1], [".", 1]],
      qwen3: [["ال", 1], ["ناس", 1], [" ب", 1], ["يم", 1], ["ش", 1], ["وا", 1], [" من", 1], [" الم", 1], ["دن", 1], [" الص", 1], ["غ", 1], ["يرة", 1], [" في", 1], [" عربي", 1], ["اتهم", 1], [" في", 1], [" كل", 1], [" صباح", 1], [" ع", 1], ["ش", 1], ["ان", 1], [" ي", 1], ["روح", 1], ["وا", 1], [" لأ", 1], ["ما", 1], ["كن", 1], [" عمل", 1], ["هم", 1], [" و", 1], ["بيق", 1], ["ابل", 1], ["هم", 1], [" في", 1], [" الطريق", 1], [" الناس", 1], [" الت", 1], ["اني", 1], ["ين", 1], [" اللي", 1], [" ب", 1], ["يش", 1], ["ت", 1], ["غل", 1], ["وا", 1], [" في", 1], [" الم", 1], ["كان", 1], [" اللي", 1], [" ساب", 1], ["وه", 1], [" ل", 1], ["سه", 1], [" د", 1], ["ل", 1], ["وق", 1], ["تي", 1], [".", 1]],
      k2s: [["الن", 1], ["اس", 1], [" ب", 1], ["يم", 1], ["ش", 1], ["وا", 1], [" من", 1], [" المدن", 1], [" الصغيرة", 1], [" في", 1], [" عرب", 1], ["يات", 1], ["هم", 1], [" في", 1], [" كل", 1], [" صباح", 1], [" عشان", 1], [" ي", 1], ["روح", 1], ["وا", 1], [" لأ", 1], ["ماكن", 1], [" عمل", 1], ["هم", 1], [" و", 1], ["بيق", 1], ["ابل", 1], ["هم", 1], [" في", 1], [" الطريق", 1], [" الناس", 1], [" الت", 1], ["انيين", 1], [" اللي", 1], [" ب", 1], ["يش", 1], ["ت", 1], ["غل", 1], ["وا", 1], [" في", 1], [" المكان", 1], [" اللي", 1], [" ساب", 1], ["وه", 1], [" لس", 1], ["ه", 1], [" دل", 1], ["وق", 1], ["تي", 1], [".", 1]],
      k2: [["الناس", 1], [" بيم", 1], ["شوا", 1], [" من", 1], [" المدن", 1], [" الصغيرة", 1], [" في", 1], [" عرب", 1], ["ياتهم", 1], [" في", 1], [" كل", 1], [" صباح", 1], [" عشان", 1], [" يروح", 1], ["وا", 1], [" لأماكن", 1], [" عملهم", 1], [" و", 1], ["بيق", 1], ["ابل", 1], ["هم", 1], [" في", 1], [" الطريق", 1], [" الناس", 1], [" الت", 1], ["انيين", 1], [" اللي", 1], [" بيش", 1], ["تغل", 1], ["وا", 1], [" في", 1], [" المكان", 1], [" اللي", 1], [" ساب", 1], ["وه", 1], [" لسه", 1], [" دلوقتي", 1], [".", 1]],
    },
  },
  {
    id: "diac",
    label: "Fully voweled",
    note: "A short sentence with every haraka written",
    dir: "rtl",
    words: 5,
    tok: {
      gpt2: [["ذ", 2], ["َ", 1], ["ه", 1], ["َ", 1], ["ب", 1], ["َ", 1], [" ال", 1], ["و", 1], ["َ", 1], ["ل", 1], ["َ", 1], ["د", 1], ["ُ", 2], [" إ", 1], ["إ", 1], ["ِ", 1], ["ل", 1], ["َ", 1], ["ى", 2], [" ال", 1], ["م", 1], ["َ", 1], ["د", 1], ["ْ", 1], ["ر", 1], ["َ", 1], ["س", 1], ["َ", 1], ["ة", 1], ["ِ", 1], [" ص", 1], ["ص", 1], ["َ", 1], ["ب", 1], ["َ", 1], ["اح", 1], ["ح", 1], ["ً", 2], ["ا", 1], [".", 1]],
      qwen3: [["ذ", 1], ["َ", 1], ["ه", 1], ["َ", 1], ["ب", 1], ["َ", 1], [" الو", 1], ["َ", 1], ["ل", 1], ["َ", 1], ["د", 1], ["ُ", 1], [" إ", 1], ["ِ", 1], ["ل", 1], ["َ", 1], ["ى", 1], [" الم", 1], ["َ", 1], ["د", 1], ["ْ", 1], ["ر", 1], ["َ", 1], ["س", 1], ["َ", 1], ["ة", 1], ["ِ", 1], [" ص", 1], ["َ", 1], ["ب", 1], ["َ", 1], ["اح", 1], ["ًا", 1], [".", 1]],
      k2s: [["ذ", 1], ["َ", 1], ["ه", 1], ["َب", 1], ["َ", 1], [" الو", 1], ["َل", 1], ["َد", 1], ["ُ", 1], [" إ", 1], ["ِل", 1], ["َ", 1], ["ى", 1], [" الم", 1], ["َد", 1], ["ْر", 1], ["َ", 1], ["س", 1], ["َة", 1], ["ِ", 1], [" ص", 1], ["َب", 1], ["َ", 1], ["اح", 1], ["ًا", 1], [".", 1]],
      k2: [["ذ", 1], ["َه", 1], ["َب", 1], ["َ", 1], [" الو", 1], ["َل", 1], ["َد", 1], ["ُ", 1], [" إِل", 1], ["َى", 1], [" الم", 1], ["َد", 1], ["ْر", 1], ["َس", 1], ["َةِ", 1], [" ص", 1], ["َب", 1], ["َ", 1], ["اح", 1], ["ًا", 1], [".", 1]],
    },
  },
]

const CORPUS: Record<TokId, Corpus> = {
  gpt2: { vocab: 50257, arabic: 22, en: 47265, msa: 207591, arz: 199763, ary: 198373 },
  qwen3: { vocab: 151669, arabic: 4018, en: 48219, msa: 78734, arz: 79174, ary: 82164 },
  k2s: { vocab: 64256, arabic: 12512, en: 50228, msa: 58392, arz: 58736, ary: 63409 },
  k2: { vocab: 250624, arabic: 49568, en: 46409, msa: 48675, arz: 48499, ary: 52922 },
}
const WORDS = { en: 38331, msa: 34461, arz: 34272, ary: 33625 }

const CONTEXT = 524_288

function fmtInt(n: number): string {
  return n.toLocaleString("en-US")
}

export function FertilityComparator() {
  const [sid, setSid] = useState<Sample["id"]>("msa")
  const [tid, setTid] = useState<TokId>("k2")
  const sample = SAMPLES.find((s) => s.id === sid) ?? SAMPLES[0]
  const segs = sample.tok[tid]
  const n = segs.reduce((a, [, c]) => a + c, 0)
  const variant: "en" | "msa" | "arz" = sid === "en" ? "en" : sid === "arz" ? "arz" : "msa"
  const corpusMax = Math.max(...TOKS.map((t) => CORPUS[t.id][variant] / WORDS[variant]))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        tokenizer fertility · real splits, measured locally on CPU
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSid(s.id)}
            aria-pressed={s.id === sid}
            className={
              "rounded border px-2 py-1 text-xs " +
              (s.id === sid ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 border-b px-3 py-2 sm:grid-cols-4">
        {TOKS.map((t) => {
          const tn = sample.tok[t.id].reduce((a, [, c]) => a + c, 0)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTid(t.id)}
              aria-pressed={t.id === tid}
              className={
                "rounded border px-2 py-1 text-left " +
                (t.id === tid ? "border-foreground bg-muted" : "hover:bg-muted/50")
              }
            >
              <div className="text-xs font-medium">{t.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{t.sub}</div>
              <div className="font-mono text-sm tabular-nums">
                {tn} tok · {(tn / sample.words).toFixed(2)}/word
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-3 py-3">
        <div className="mb-2 font-mono text-[10px] text-muted-foreground">
          {sample.note} · {sample.words} words · {n} tokens
        </div>
        <div dir={sample.dir} className="flex flex-wrap gap-[3px] leading-7">
          {segs.map(([text, c], i) => (
            <span
              key={i}
              className={
                "relative rounded-sm border px-[3px] text-base " +
                (c > 1 ? "border-red-400/70 bg-red-500/10" : i % 2 ? "bg-sky-500/10" : "bg-amber-500/10")
              }
            >
              {text.replace(/ /g, "·")}
              {c > 1 ? (
                <sup className="ml-[1px] font-mono text-[9px] text-red-600 dark:text-red-400">
                  ×{c}
                </sup>
              ) : null}
            </span>
          ))}
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">
          · marks a leading space. A red chip is one character the tokenizer had no merge for,
          spent as {"≥"}2 byte tokens.
        </div>
      </div>

      <div className="border-t px-3 py-3">
        <div className="mb-2 font-mono text-xs">
          whole corpus · 488 Belebele passages ·{" "}
          {variant === "en" ? "English" : variant === "arz" ? "Egyptian Arabic" : "Modern Standard Arabic"}
        </div>
        <div className="space-y-1">
          {TOKS.map((t) => {
            const tpw = CORPUS[t.id][variant] / WORDS[variant]
            const vsEn = CORPUS[t.id][variant] / CORPUS[t.id].en
            const ctxWords = CONTEXT / tpw
            return (
              <div key={t.id} className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-xs">
                <div className={t.id === tid ? "font-medium" : "text-muted-foreground"}>{t.name}</div>
                <div>
                  <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
                    <div
                      className={t.id === "k2" || t.id === "k2s" ? "h-full bg-emerald-600/70" : "h-full bg-muted-foreground/40"}
                      style={{ width: `${((tpw / corpusMax) * 100).toFixed(1)}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {tpw.toFixed(2)} tok/word · {fmtInt(CORPUS[t.id][variant])} tokens
                    {variant !== "en" ? ` · ${vsEn.toFixed(2)}× its English` : ""} · 512K context ≈{" "}
                    {fmtInt(Math.round(ctxWords / 1000) * 1000)} words
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">
          {fmtInt(CORPUS.k2.arabic)} of {fmtInt(CORPUS.k2.vocab)} entries in the 250K vocabulary decode to
          Arabic script; GPT-2 has {CORPUS.gpt2.arabic}.
        </div>
      </div>
    </figure>
  )
}
