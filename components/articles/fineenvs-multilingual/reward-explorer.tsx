"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The FineEnvs OCR and ASR rewards, re-implemented from the two Spaces'
// server code and run on whatever you type.
//
//   nayana-ocr-env/server/rewards.py   NFC, collapse whitespace, keep case and
//                                      punctuation; CER over code points;
//                                      reward 0 if len(pred) > max(1024, 4 len(ref))
//   fleurs-asr-env/server/rewards.py   NFKC, punctuation -> space, casefold,
//   fleurs-asr-env/data/schema.py      collapse whitespace; error rate over
//                                      code points (ASR_REWARD_UNIT=cer, the
//                                      Kannada run) or words (the default for
//                                      spaced scripts)
//
//   reward = 0.8 * max(0, 1 - error) + 0.2 * exact
//
// The akshara column is not something either environment computes. It splits
// text into grapheme clusters the way a reader of an Indic script sees them:
// a base letter keeps its vowel signs and other marks, and a consonant that
// follows a virama joins the cluster before it (a conjunct). The same rule,
// in Python, reproduced the article's 41% figure over the 838 FLEURS clips.

type Mode = "ocr" | "asr"

type Hyp = { label: string; text: string }
type Preset = { id: string; label: string; reference: string; note: string; hyps: Hyp[] }

const FLEURS_REF =
  "ಘಟನೆಗಳು ನಡೆದ ಯುಗವನ್ನು ಸಾಮಾನ್ಯವಾಗಿ 11 12 ಮತ್ತು 13ನೇ ಶತಮಾನಗಳಲ್ಲಿ ಕ್ರಿ.ಶ. 1000–1300 ಯುರೋಪಿಯನ್ ಇತಿಹಾಸದ ಅವಧಿಯ ಅಧಿಕ ಮಧ್ಯಯುಗ ಎಂದು ಕರೆಯಲಾಗುತ್ತದೆ"

const PRESETS: Preset[] = [
  {
    id: "kannada",
    label: "ಕನ್ನಡ ಭಾಷೆ",
    reference: "ಕನ್ನಡ ಭಾಷೆ",
    note: "“the Kannada language”: 10 code points, 6 aksharas (counting the space), 2 words",
    hyps: [
      { label: "dropped conjunct", text: "ಕನಡ ಭಾಷೆ" },
      { label: "ಭ heard as ಬ", text: "ಕನ್ನಡ ಬಾಷೆ" },
      { label: "wrong vowel sign", text: "ಕನ್ನಡ ಭಾಷಿ" },
      { label: "a Devanagari क", text: "कನ್ನಡ ಭಾಷೆ" },
      { label: "space dropped", text: "ಕನ್ನಡಭಾಷೆ" },
      { label: "exact", text: "ಕನ್ನಡ ಭಾಷೆ" },
    ],
  },
  {
    id: "fleurs",
    label: "FLEURS sentence 1732",
    reference: FLEURS_REF,
    note: "A held-out Kannada test sentence. The reference writes its numbers as digits",
    hyps: [
      {
        label: "base model",
        text: "ಗಟನೆಗಳು ನಡೆದ ಯುಗವನ್ನು ಸಾಮಾನ್ಯವಾಗಿ ಹನ್ನೊಂದು ಹನ್ನೆರಡು ಮತ್ತು ಹದಮೂರನೇ ಶತಮಾನಗಳಲ್ಲಿ ಕ್ರಿಸ್ತಶಕ ಸಾವಿರದಿಂದ ಸಾವಿರದ ಮೂರ hundred ಯುರೋಪಿಯನ್ ಇತಿಹಾಸದ ಅವಧಿಯ ಅಧಿಕ ಮಧ್ಯಯುಗ ಎಂದು ಕರೆಯಲಾಗುತ್ತದೆ",
      },
      {
        label: "after GRPO, step 575",
        text: "ಘಟನೆಗಳು ನಡೆದ ಯುಗವನ್ನು ಸಾಮಾನ್ಯವಾಗಿ 11, 12 ಮತ್ತು 13ನೇ ಶತಮಾನಗಳಲ್ಲಿ ಕ್ರಿ.ಶ. 1000 ರಿಂದ 1300 ಯುರೋಪಿಯನ್ ಇತಿಹಾಸದ ಅವಧಿಯ ಅಧಿಕ ಮಧ್ಯಯುಗ ಎಂದು ಕರೆಯಲಾಗುತ್ತದೆ",
      },
    ],
  },
  {
    id: "nfc",
    label: "ಕೋಟೆ, decomposed",
    reference: "ಕೋಟೆ",
    note: "“fort”. The first hypothesis looks identical but spells ೋ as three code points",
    hyps: [
      { label: "decomposed ೋ", text: "ಕೋಟೆ" },
      { label: "composed", text: "ಕೋಟೆ" },
    ],
  },
  {
    id: "english",
    label: "English",
    reference: "the quick brown fox jumps over the lazy dog",
    note: "A spaced Latin script, where code points and clusters coincide",
    hyps: [
      { label: "one wrong word", text: "the quick brown fox jumped over the lazy dog" },
      { label: "case and punctuation", text: "The quick, brown fox jumps over the lazy dog." },
    ],
  },
]

const VIRAMA = /[्্੍્୍்్್്]/
const MARK = /[\p{M}‌‍]/u
const PUNCT = /\p{P}/u
const LETTER = /\p{L}/u

const collapse = (s: string) => s.split(/\s+/).filter(Boolean).join(" ")

function normalize(s: string, mode: Mode, raw: boolean): string {
  if (raw) return collapse(s)
  if (mode === "ocr") return collapse(s.normalize("NFC"))
  const t = Array.from(s.normalize("NFKC"))
    .map((c) => (PUNCT.test(c) ? " " : c))
    .join("")
    .toLowerCase()
  return collapse(t)
}

function aksharas(s: string): string[] {
  const out: string[] = []
  for (const c of Array.from(s)) {
    const prev = out.length ? Array.from(out[out.length - 1]) : []
    const last = prev.length ? prev[prev.length - 1] : ""
    const join = out.length > 0 && (MARK.test(c) || (VIRAMA.test(last) && LETTER.test(c)))
    if (join) out[out.length - 1] += c
    else out.push(c)
  }
  return out
}

type Op = { kind: "eq" | "sub" | "del" | "ins"; ref?: string; hyp?: string }

// Levenshtein with a backtrace, so the widget can show which units cost.
function align(ref: string[], hyp: string[]): { dist: number; ops: Op[] } {
  const n = ref.length
  const m = hyp.length
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array<number>(m + 1).fill(0)
    row[0] = i
    return row
  })
  for (let j = 0; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  const ops: Op[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      ops.push({ kind: ref[i - 1] === hyp[j - 1] ? "eq" : "sub", ref: ref[i - 1], hyp: hyp[j - 1] })
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ kind: "del", ref: ref[i - 1] })
      i--
    } else {
      ops.push({ kind: "ins", hyp: hyp[j - 1] })
      j--
    }
  }
  ops.reverse()
  return { dist: d[n][m], ops }
}

const reward = (err: number, exact: boolean) => 0.8 * Math.max(0, 1 - err) + 0.2 * (exact ? 1 : 0)
const hex = (s: string) =>
  Array.from(s)
    .map((c) => "U+" + (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0"))
    .join(" ")
const shown = (u: string) => (u === " " ? "␣" : MARK.test(Array.from(u)[0] ?? "") ? "◌" + u : u)

const MAX_LEN = 700

function Strip({ ops, title }: { ops: Op[]; title: string }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-[3px]" lang="kn">
        {ops.map((o, k) => {
          const cls = cn(
            "inline-flex min-w-[1.4rem] flex-col items-center rounded border px-1 py-0.5 text-[13px] leading-tight",
            o.kind === "eq" && "border-transparent bg-muted/40 text-foreground/70",
            o.kind === "sub" && "border-amber-500/60 bg-amber-500/10",
            o.kind === "del" && "border-red-500/60 bg-red-500/10",
            o.kind === "ins" && "border-sky-500/60 bg-sky-500/10"
          )
          const tip =
            o.kind === "eq"
              ? `match ${hex(o.ref ?? "")}`
              : o.kind === "sub"
                ? `substitute ${hex(o.ref ?? "")} with ${hex(o.hyp ?? "")}`
                : o.kind === "del"
                  ? `missing ${hex(o.ref ?? "")}`
                  : `extra ${hex(o.hyp ?? "")}`
          return (
            <span key={k} className={cls} title={tip}>
              {o.kind === "ins" ? (
                <span>{shown(o.hyp ?? "")}</span>
              ) : (
                <span className={cn(o.kind === "del" && "line-through")}>{shown(o.ref ?? "")}</span>
              )}
              {o.kind === "sub" ? <span className="text-[10px] text-amber-700 dark:text-amber-400">{shown(o.hyp ?? "")}</span> : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function RewardExplorer() {
  const [pi, setPi] = useState(0)
  const preset = PRESETS[pi]
  const [hyp, setHyp] = useState(PRESETS[0].hyps[0].text)
  const [mode, setMode] = useState<Mode>("asr")
  const [raw, setRaw] = useState(false)

  const r = useMemo(() => {
    const R = normalize(preset.reference, mode, raw)
    const H = normalize(hyp, mode, raw)
    const exact = R === H
    const cp = align(Array.from(R), Array.from(H))
    const ak = align(aksharas(R), aksharas(H))
    const refWords = R.split(" ").filter(Boolean)
    const wd = align(refWords, H.split(" ").filter(Boolean))
    const nCp = Array.from(R).length
    const nAk = aksharas(R).length
    const cer = nCp ? cp.dist / nCp : 0
    const aer = nAk ? ak.dist / nAk : 0
    const wer = refWords.length ? wd.dist / refWords.length : 0
    const overlong = mode === "ocr" && Array.from(hyp).length > Math.max(1024, 4 * Array.from(preset.reference).length)
    return { R, H, exact, cp, ak, nCp, nAk, nW: refWords.length, cer, aer, wer, wd, overlong }
  }, [preset, hyp, mode, raw])

  const envReward = r.overlong ? 0 : reward(r.cer, r.exact && !r.overlong)
  const rows = [
    {
      key: "cp",
      label: mode === "ocr" ? "code-point CER (OCR env reward)" : "code-point CER (the Kannada run's reward)",
      err: r.cer,
      dist: r.cp.dist,
      n: r.nCp,
      rew: envReward,
      live: true,
    },
    ...(mode === "asr"
      ? [
          {
            key: "w",
            label: "WER (ASR default for spaced scripts)",
            err: r.wer,
            dist: r.wd.dist,
            n: r.nW,
            rew: reward(r.wer, r.exact),
            live: false,
          },
        ]
      : []),
    {
      key: "ak",
      label: "akshara CER (not in either env)",
      err: r.aer,
      dist: r.ak.dist,
      n: r.nAk,
      rew: r.overlong ? 0 : reward(r.aer, r.exact),
      live: false,
    },
  ]

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">reward explorer: the FineEnvs grader, on what you type</span>
        <span className="font-mono text-[10px] text-muted-foreground">0.8 × max(0, 1 − error) + 0.2 × exact</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={chip(i === pi)}
              onClick={() => {
                setPi(i)
                setHyp(p.hyps[0].text)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">reference</div>
          <div className="mt-0.5 break-words rounded-md border bg-muted/30 px-2.5 py-1.5 text-[15px]" lang="kn">
            {preset.reference}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{preset.note}</div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">hypothesis</span>
            {preset.hyps.map((h) => (
              <button key={h.label} type="button" className={chip(h.text === hyp)} onClick={() => setHyp(h.text)}>
                {h.label}
              </button>
            ))}
          </div>
          <textarea
            value={hyp}
            onChange={(e) => setHyp(e.target.value.slice(0, MAX_LEN))}
            rows={preset.id === "fleurs" ? 3 : 1}
            lang="kn"
            aria-label="Hypothesis to score against the reference"
            className="w-full resize-y rounded-md border bg-background px-2.5 py-1.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground">grader:</span>
          <button type="button" className={chip(mode === "asr")} onClick={() => setMode("asr")}>
            ASR transcription
          </button>
          <button type="button" className={chip(mode === "ocr")} onClick={() => setMode("ocr")}>
            OCR section
          </button>
          <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} />
            skip Unicode and punctuation normalization
          </label>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {raw
            ? "No normalization: only whitespace is collapsed. Neither environment does this."
            : mode === "asr"
              ? "ASR: NFKC, punctuation replaced by a space, casefolded, whitespace collapsed, on both sides."
              : "OCR: NFC and whitespace collapsed; case, punctuation, vowel signs and ZWJ/ZWNJ kept. Over-long answers score 0."}
        </div>

        <div className="grid gap-1.5 font-mono text-[11px] sm:grid-cols-3">
          {rows.map((x) => (
            <div key={x.key} className={cn("rounded-md border px-2.5 py-1.5", x.live && "border-foreground/30")}>
              <div className="text-muted-foreground">{x.label}</div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span>
                  {x.dist}/{x.n} = {x.err.toFixed(3)}
                </span>
                <span className="text-sm font-semibold">reward {x.rew.toFixed(3)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                <div
                  className={cn("h-full", x.live ? "bg-foreground/70" : "bg-foreground/30")}
                  style={{ width: `${(Math.min(1, Math.max(0, x.rew)) * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          exact match: {r.exact ? "yes (+0.2)" : "no"}
          {r.overlong ? " · over-long: reward forced to 0" : ""}
        </div>

        <Strip ops={r.cp.ops} title={`code points: ${r.nCp} in the reference, ${r.cp.dist} edits`} />
        <Strip ops={r.ak.ops} title={`aksharas (grapheme clusters): ${r.nAk} in the reference, ${r.ak.dist} edits`} />
        <div className="flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-500/60" />
            substituted (hypothesis below)
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-500/60" />
            missing
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-500/60" />
            extra
          </span>
          <span>◌ marks a vowel sign or virama shown on its own</span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Re-implemented from <code>rewards.py</code> and <code>schema.py</code> in the two FineEnvs Spaces; the same Python
        reproduces every stored reward in both Kannada runs. Python&rsquo;s <code>casefold</code> is approximated with{" "}
        <code>toLowerCase</code>, which differs only for a few Latin letters such as ß.
      </figcaption>
    </figure>
  )
}
