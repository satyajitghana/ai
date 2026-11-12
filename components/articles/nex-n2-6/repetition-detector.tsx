"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A toy repetition detector, using the article's own definition (Nex has not
// published theirs):
//
//   1. split the trace into lowercase word tokens;
//   2. for every start position j, the n-gram tokens[j .. j+n-1] is a REPEAT
//      if the same n-gram already started at some earlier position k < j;
//   3. every token covered by a repeated n-gram is marked;
//   4. the trace's repetition share r = marked tokens / all tokens;
//   5. the trace is FLAGGED as looping when r >= tau.
//
// A set-level "repetition rate" is then the share of traces flagged. The three
// presets are short traces written for this article to show the cases. None is
// output from Nex-N2.6 or any other model.

const PRESETS = [
  {
    id: "steady",
    label: "steady",
    text:
      "The test fails on line 42 because parse_date returns None for ISO strings that end in Z. " +
      "The regex accepts an offset like +05:30 but not the literal Z. Add Z as an alternative in the " +
      "timezone group, rerun the one failing test, then run the full suite. If it passes, check the " +
      "serializer as well, since it writes the same format back out.",
  },
  {
    id: "loop",
    label: "loop",
    text:
      "The test fails because parse_date returns None. Let me check the regex. The regex accepts an " +
      "offset but not Z, so I should add Z to the regex. Wait, let me check the regex again. The regex " +
      "accepts an offset but not Z, so I should add Z to the regex. Wait, let me check the regex again. " +
      "The regex accepts an offset but not Z, so I should add Z to the regex. Actually, let me re-read " +
      "the test first. The test fails because parse_date returns None. Let me check the regex.",
  },
  {
    id: "retry",
    label: "tool retry",
    text:
      "Run pytest tests/test_dates.py. Output: ModuleNotFoundError: no module named dateutil. " +
      "Run pytest tests/test_dates.py. Output: ModuleNotFoundError: no module named dateutil. " +
      "The same error twice, so retrying will not help. The package is missing from the environment: " +
      "install python-dateutil, then run the test file again.",
  },
] as const

type Piece = { text: string; word: boolean; idx: number }

function split(text: string): { pieces: Piece[]; words: string[] } {
  const pieces: Piece[] = []
  const words: string[] = []
  const re = /[A-Za-z0-9_]+(?:['.:+][A-Za-z0-9_]+)*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) pieces.push({ text: text.slice(last, m.index), word: false, idx: -1 })
    pieces.push({ text: m[0], word: true, idx: words.length })
    words.push(m[0].toLowerCase())
    last = m.index + m[0].length
  }
  if (last < text.length) pieces.push({ text: text.slice(last), word: false, idx: -1 })
  return { pieces, words }
}

function analyse(words: string[], n: number) {
  const marked = new Array<boolean>(words.length).fill(false)
  const seen = new Set<string>()
  for (let j = 0; j + n <= words.length; j++) {
    const g = words.slice(j, j + n).join(" ")
    if (seen.has(g)) {
      for (let t = j; t < j + n; t++) marked[t] = true
    } else {
      seen.add(g)
    }
  }
  let count = 0
  let run = 0
  let longest = 0
  for (const b of marked) {
    if (b) {
      count++
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  const share = words.length ? count / words.length : 0
  return { marked, count, share, longest }
}

const MARK = "oklch(0.70 0.16 45 / 0.35)"
const FLAG = "oklch(0.58 0.19 27)"
const OK = "oklch(0.55 0.16 155)"

export function RepetitionDetector() {
  const [preset, setPreset] = useState<string>("loop")
  const [custom, setCustom] = useState<string>("")
  const [n, setN] = useState(6)
  const [tau, setTau] = useState(30)

  const text = preset === "custom" ? custom : PRESETS.find((p) => p.id === preset)!.text
  const { pieces, words } = useMemo(() => split(text), [text])
  const res = useMemo(() => analyse(words, n), [words, n])
  const flagged = words.length > 0 && res.share * 100 >= tau

  const corpus = useMemo(
    () =>
      PRESETS.map((p) => {
        const w = split(p.text).words
        const a = analyse(w, n)
        return { id: p.id, label: p.label, share: a.share, flagged: a.share * 100 >= tau }
      }),
    [n, tau],
  )
  const nFlagged = corpus.filter((c) => c.flagged).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">repetition detector, n-gram toy</span>
        <span className="font-mono text-[10px]" style={{ color: flagged ? FLAG : OK }}>
          {words.length === 0 ? "paste a trace" : flagged ? "flagged: looping" : "not flagged"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {[...PRESETS.map((p) => ({ id: p.id as string, label: p.label as string })), { id: "custom", label: "paste your own" }].map(
            (p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={preset === p.id}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  preset === p.id
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ),
          )}
        </div>

        {preset === "custom" ? (
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={6}
            placeholder="Paste a reasoning trace here. Nothing leaves your browser."
            className="mt-3 w-full rounded-lg border bg-background p-2 font-mono text-xs"
            aria-label="Reasoning trace to analyse"
          />
        ) : null}

        <div
          className="mt-3 max-h-64 overflow-y-auto rounded-lg border bg-muted/10 p-3 font-mono text-[11px] leading-relaxed"
          aria-live="polite"
        >
          {words.length === 0 ? (
            <span className="text-muted-foreground">Nothing to analyse yet.</span>
          ) : (
            pieces.map((p, i) =>
              p.word && res.marked[p.idx] ? (
                <mark key={i} style={{ background: MARK, color: "inherit" }} className="rounded-sm">
                  {p.text}
                </mark>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">
              n-gram length n = {n} words
            </span>
            <Range min={3} max={12} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground">
              flag threshold tau = {tau}% of tokens
            </span>
            <Range min={5} max={70} step={5} value={tau} onChange={(e) => setTau(Number(e.target.value))} className="w-full" />
          </label>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">repeated share r</div>
            <div className="font-mono text-sm tabular-nums">
              {(res.share * 100).toFixed(1)}%{" "}
              <span className="text-muted-foreground">
                ({res.count} of {words.length} tokens)
              </span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">longest repeated run</div>
            <div className="font-mono text-sm tabular-nums">{res.longest} tokens</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">set rate, three presets</div>
            <div className="font-mono text-sm tabular-nums">
              {nFlagged} of {corpus.length} flagged
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {corpus.map((c) => (
            <span key={c.id} style={{ color: c.flagged ? FLAG : undefined }}>
              {c.label}: {(c.share * 100).toFixed(0)}%{c.flagged ? " flagged" : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        The article&apos;s own toy metric, not Nex&apos;s (which is unpublished). A token is marked when it sits
        inside an n-gram that already appeared earlier in the trace; a trace is flagged when the marked share
        reaches tau. The presets are illustrative traces written for this article, not model output. The
        tool-retry preset shows the false positive: a repeated command and its repeated error are not a
        reasoning loop.
      </figcaption>
    </figure>
  )
}
