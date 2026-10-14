"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { FIXED, PRETOKENS, SPEAKER_IDS } from "./token-table"

// Direct one line of Drama 3 word by word and read back the exact prompt the
// model receives. The prompt layout is sglang-omni's prompt.py
// (reference-bracket-v1, commit 5e9b664): every literal is tokenized on its
// own, the user text gets a leading <|speaker:0|>, and the assistant turn opens
// with <|voice|>. Token counts are exact for every markup this widget can build:
// the pre-token table was generated from the shipped tokenizer.json and checked
// against full encodes (see token-table.ts). The reference clip is the 3.9 s
// en0 clip from the model card; its frame count is reasoned (3.9 x 21.53).

const WORDS = ["Promise", "me", "you", "won't", "tell", "her", "about", "the", "party", "tonight."]

type Brush =
  | { kind: "none"; label: string }
  | { kind: "point"; tag: string; label: string }
  | { kind: "scope"; tag: string; label: string }

const BRUSHES: Brush[] = [
  { kind: "none", label: "plain" },
  { kind: "point", tag: "[sighs]", label: "[sighs]" },
  { kind: "point", tag: "[pause]", label: "[pause]" },
  { kind: "point", tag: "[laughs]", label: "[laughs]" },
  { kind: "point", tag: "[gasps]", label: "[gasps]" },
  { kind: "scope", tag: "whisper", label: "<whisper>" },
  { kind: "scope", tag: "emphasis", label: "<emphasis>" },
  { kind: "scope", tag: "slow", label: "<slow>" },
  { kind: "point", tag: "<|speaker:1|>", label: "switch voice" },
]

const STYLES = ["", "[with bright eager excitement]", "[icy calm, as if you already accepted it]"]

const REF_FRAMES = 84 // 3.9 s x 21.53 frames/s, rounded (reasoned)
const REF_TEXT = "We asked over twenty different people, and they all said it was his."

const PRETOKEN_RE =
  /'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD]|[^\r\n\p{L}\p{N}]?[\p{L}\p{M}]+|\p{N}| ?[^\s\p{L}\p{M}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu

type Piece = { text: string; id: number; role: "speaker" | "word" | "tag" | "mixed" }

// Build the user text exactly as the generator did, remembering which
// characters belong to a control so each BPE piece can be classed.
function render(states: number[], style: string, lang: boolean) {
  let text = ""
  const ctl: boolean[] = []
  const push = (s: string, isCtl: boolean) => {
    text += s
    for (let i = 0; i < s.length; i++) ctl.push(isCtl)
  }
  push("<|speaker:0|>", true)
  push(" ", false)
  if (style) {
    push(style, true)
    push(" ", false)
  }
  let open: string | null = null
  WORDS.forEach((w, i) => {
    const b = BRUSHES[states[i]]
    const sc = b.kind === "scope" ? b.tag : null
    if (open && sc !== open) {
      push(`</${open}>`, true)
      open = null
    }
    if (i > 0) push(" ", false)
    if (b.kind === "point") {
      push(b.tag, true)
      push(" ", false)
    }
    if (sc && sc !== open) {
      push(`<${sc}>`, true)
      open = sc
    }
    if (open && w.endsWith(".")) {
      push(w.slice(0, -1), false)
      push(`</${open}>`, true)
      push(".", false)
      open = null
    } else {
      push(w, false)
    }
  })
  if (open) push(`</${open}>`, true)
  if (lang) push(" [language: en]", true)
  return { text, ctl }
}

function tokenize(text: string, ctl: boolean[]): Piece[] | null {
  const out: Piece[] = []
  let base = 0
  for (const seg of text.split(/(<\|speaker:\d+\|>)/)) {
    if (!seg) continue
    if (SPEAKER_IDS[seg] !== undefined) {
      out.push({ text: seg, id: SPEAKER_IDS[seg], role: "speaker" })
      base += seg.length
      continue
    }
    for (const m of seg.matchAll(PRETOKEN_RE)) {
      const entry = PRETOKENS[m[0]]
      if (!entry) return null
      let off = base + (m.index ?? 0)
      entry[1].forEach((p, k) => {
        // class by the visible characters only: a separator space never counts
        let c = 0
        let n = 0
        for (let j = off; j < off + p.length; j++) {
          if (text[j] === " ") continue
          n++
          if (ctl[j]) c++
        }
        const role = c === 0 ? "word" : c === n ? "tag" : "mixed"
        out.push({ text: p, id: entry[0][k], role })
        off += p.length
      })
    }
    base += seg.length
  }
  return out
}

const PLAIN_USER = 13 // "<|speaker:0|> Promise me you won't tell her about the party tonight." (measured)

const ROLE_CLASS: Record<Piece["role"], string> = {
  speaker: "border-violet-500/50 bg-violet-500/15",
  word: "border-border bg-background/60",
  tag: "border-amber-500/50 bg-amber-500/15",
  mixed: "border-rose-500/60 bg-rose-500/20",
}

export function DirectionExplorer() {
  const [states, setStates] = useState<number[]>(() => WORDS.map((_, i) => (i === 4 || i === 5 ? 5 : i === 8 ? 1 : 0)))
  const [brush, setBrush] = useState(5)
  const [style, setStyle] = useState(0)
  const [lang, setLang] = useState(false)
  const [ref, setRef] = useState(true)

  const { text, pieces } = useMemo(() => {
    const r = render(states, STYLES[style], lang)
    return { text: r.text, pieces: tokenize(r.text, r.ctl) }
  }, [states, style, lang])

  const paint = (i: number) =>
    setStates((s) => s.map((v, j) => (j === i ? (v === brush ? 0 : brush) : v)))

  const user = pieces ? pieces.length : 0
  const sys = FIXED.sysStart + (ref ? FIXED.refInstr + FIXED.refHeader + REF_FRAMES : FIXED.ttsInstr) + FIXED.msgEnd
  const total = sys + FIXED.userStart + user + FIXED.msgEnd + FIXED.genStart
  const mixed = pieces ? pieces.filter((p) => p.role === "mixed").length : 0
  const tagOnly = pieces ? pieces.filter((p) => p.role === "tag").length : 0

  const prompt =
    "<|im_start|>system\n" +
    (ref
      ? `convert the provided text to speech reference to the following:\n\n[Reference 1]\nText: <|speaker:0|> ${REF_TEXT}\nSpeech: {{${REF_FRAMES} frames of the reference clip}}`
      : "convert the provided text to speech") +
    "<|im_end|>\n<|im_start|>user\n" +
    text +
    "<|im_end|>\n<|im_start|>assistant\n<|voice|>"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          direct one line, read the prompt Drama 3 receives
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">tokenizer: fishaudio/drama-3 @ e0a9218</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            1. pick a control, then click words
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Control to apply">
            {BRUSHES.map((b, i) => (
              <button
                key={b.label}
                type="button"
                role="radio"
                aria-checked={brush === i}
                onClick={() => setBrush(i)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  brush === i
                    ? "border-foreground/40 bg-muted/60 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {WORDS.map((w, i) => {
              const b = BRUSHES[states[i]]
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => paint(i)}
                  aria-label={`${w}: ${b.label}`}
                  className={cn(
                    "flex cursor-pointer flex-col items-center rounded-md border px-2 py-1 text-sm transition-colors hover:border-foreground/40",
                    b.kind === "none" ? "border-border" : b.kind === "point" ? "border-amber-500/60 bg-amber-500/10" : "border-sky-500/60 bg-sky-500/10",
                  )}
                >
                  <span>{w}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{b.kind === "none" ? " " : b.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px]">
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">style prefix</span>
            <select
              value={style}
              onChange={(e) => setStyle(Number(e.target.value))}
              className="rounded border bg-background px-1.5 py-0.5"
            >
              {STYLES.map((s, i) => (
                <option key={s || "none"} value={i}>
                  {s || "none"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={lang} onChange={(e) => setLang(e.target.checked)} />
            <span>[language: en] hint</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={ref} onChange={(e) => setRef(e.target.checked)} />
            <span>clone from a 3.9 s reference</span>
          </label>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            2. the user turn, as BPE pieces
          </div>
          {pieces ? (
            <div className="flex flex-wrap gap-[3px] font-mono text-[11px]">
              {pieces.map((p, i) => (
                <span
                  key={i}
                  title={`id ${p.id}`}
                  className={cn("whitespace-pre rounded border px-1 py-px", ROLE_CLASS[p.role])}
                >
                  {p.text}
                </span>
              ))}
            </div>
          ) : (
            <div className="font-mono text-xs text-muted-foreground">(no token table entry for this markup)</div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-500/50" />one vocabulary entry</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-500/50" />control text</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-rose-500/60" />control and word fused</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ["user turn", `${user} tokens`],
            ["spent on direction", `${user - PLAIN_USER} tokens`],
            ["pieces fusing tag + word", `${mixed}`],
            ["whole prompt", `${total} positions`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-background/40 px-3 py-2 font-mono text-[11px] leading-5">
              <div className="text-muted-foreground">{k}</div>
              <div className="text-foreground">{v}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            3. the full prompt (sglang-omni layout)
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-background/60 p-3 font-mono text-[11px] leading-5">
            {prompt}
          </pre>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Of the {total} positions, {ref ? `${REF_FRAMES} are reference audio frames and ` : ""}
          {total - (ref ? REF_FRAMES : 0)} are text tokens; {tagOnly} of the user turn&apos;s pieces are pure
          control text. Only the speaker tokens are single vocabulary entries. Every bracket and angle tag is
          ordinary BPE, and a scoped tag changes how its own word is cut: <code>tell</code> alone is one
          token, <code>&lt;whisper&gt;tell</code> ends in <code>&gt;t</code> + <code>ell</code>.
        </p>
      </div>
    </figure>
  )
}
