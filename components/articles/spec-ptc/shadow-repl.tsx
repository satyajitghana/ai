"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What the shadow REPL can and cannot launch early.
//
// The easy case is a tool call whose arguments are literals: the moment the
// stream closes the parenthesis, the call is fully specified and can go. The
// interesting cases are everything else — arguments that depend on variables
// computed earlier in the cell, calls inside conditionals whose branch is not
// yet decided, calls inside function bodies that have not been invoked.
//
// spec-ptc's answer is a deepcopy fork of the real REPL, run on the partial
// program as it streams, with an allowlist: anything that could touch external
// state (`open`, most library calls) is marked unsafe, and a speculatable tool
// whose inputs depend on an unsafe expression is simply not speculated. The
// fork is never promoted to the real REPL — a cell is one unit of computation,
// and the model might still produce code that errors halfway through.
//
// The four cases below are Alex Zhang's, from the post. Drag the caret and
// watch which calls leave early.

const GOOD = "oklch(0.55 0.16 155)"
const WARM = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 27)"
const MUTED = "oklch(0.62 0.03 250)"

type Kind = "spec" | "dep" | "peek" | "blocked" | "plain"

type Line = { code: string; kind: Kind; note?: string }

const CASES: { k: string; label: string; blurb: string; lines: Line[] }[] = [
  {
    k: "literals",
    label: "1 · literals",
    blurb:
      "Both arguments are string literals, so each call is fully specified the instant its closing parenthesis arrives. No shadow execution needed at all — parsing is enough.",
    lines: [
      { code: 'title = llm_query("Give a title for: The Odyssey")', kind: "spec", note: "parses → launch" },
      { code: 'blurb = llm_query("One-line blurb for: The Odyssey")', kind: "spec", note: "parses → launch" },
      { code: "print(title, blurb)", kind: "plain" },
    ],
  },
  {
    k: "deps",
    label: "2 · input dependencies",
    blurb:
      "The arguments are expressions over variables, not literals. As long as every input is safe to evaluate — pure, no side effects — the shadow REPL computes it and the call goes. A call that depends on a speculation simply waits for it, and still leaves before the stream ends.",
    lines: [
      { code: 'a = llm_query("Triage: " + doc)', kind: "spec", note: "doc is in scope → launch" },
      { code: 'c = llm_query("Summarize: " + str(a))', kind: "dep", note: "waits on a, then launches" },
      { code: "if len(doc) > 10_000:", kind: "plain", note: "len() is on the allowlist → branch evaluated" },
      { code: '    extra = llm_query("Also outline it: " + doc)', kind: "spec", note: "branch taken → launch" },
    ],
  },
  {
    k: "peek",
    label: "3 · peekable or not",
    blurb:
      "A call inside a function body has no arguments yet — the function has not been invoked, so there is nothing to index it by. A call whose argument is a subscript of a variable already in the shadow namespace does: the value can be peeked at directly.",
    lines: [
      { code: "def gist(t):", kind: "plain" },
      { code: '    return llm_query("One-line gist: " + t)', kind: "blocked", note: "non-peekable — t is unbound" },
      { code: "parts = [gist(c) for c in chunks]", kind: "dep", note: "now t is known per iteration" },
      { code: 'side = llm_query("Random title for:", chunks[0])', kind: "peek", note: "peekable — chunks[0] is in the namespace" },
      { code: "print(side, parts)", kind: "plain" },
    ],
  },
  {
    k: "blocked",
    label: "4 · blocked",
    blurb:
      "Reading a file is not pure — running it early could observe or change state the real REPL has not reached yet. So `open` is off the allowlist, and the taint propagates: anything whose input passes through it is not speculated either. Calls that do not touch the tainted variable are unaffected.",
    lines: [
      { code: 'a = llm_query("Triage: " + doc)', kind: "spec", note: "launch" },
      { code: 'notes = open("/tmp/scratch.txt").read()', kind: "blocked", note: "open() is unsafe → not evaluated" },
      { code: 'b = llm_query("Annotate with notes: " + notes)', kind: "blocked", note: "input is tainted → no speculation" },
      { code: 'c = llm_query("Summarize: " + a)', kind: "dep", note: "unaffected — launches after a" },
    ],
  },
]

const STYLE: Record<Kind, { colour: string; tag: string }> = {
  spec: { colour: GOOD, tag: "speculated" },
  dep: { colour: WARM, tag: "queued behind a dep" },
  peek: { colour: GOOD, tag: "speculated (peeked)" },
  blocked: { colour: BAD, tag: "not speculated" },
  plain: { colour: MUTED, tag: "" },
}

export function ShadowRepl() {
  const [caseK, setCaseK] = useState("literals")
  // start with the cell complete so the annotations are the first thing you see;
  // dragging left replays the stream
  const [pos, setPos] = useState(CASES[0].lines.length * 10)

  const c = CASES.find((x) => x.k === caseK)!
  const nLines = c.lines.length
  const p = Math.min(pos / 10, nLines)
  const done = Math.floor(p)

  const launched = c.lines
    .slice(0, done)
    .filter((l) => l.kind === "spec" || l.kind === "peek" || l.kind === "dep").length
  const refused = c.lines.slice(0, done).filter((l) => l.kind === "blocked").length
  const streaming = done < nLines

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the shadow REPL, {streaming ? "still streaming" : "cell complete"}
        </span>
        <span className="font-mono text-[10px]" style={{ color: launched ? GOOD : MUTED }}>
          {launched} launched early · {refused} refused
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CASES.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => {
                setCaseK(x.k)
                setPos(x.lines.length * 10)
              }}
              aria-pressed={caseK === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                caseK === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          {c.lines.map((l, i) => {
            const complete = i < done
            const active = i === done
            const st = STYLE[l.kind]
            const frac = active ? p - done : 0
            const shown = active ? l.code.slice(0, Math.max(1, Math.round(l.code.length * frac))) : l.code
            return (
              <div key={l.code} className="flex flex-wrap items-baseline gap-x-3 py-[3px]">
                <span
                  className="w-4 shrink-0 text-right font-mono text-[9px] tabular-nums"
                  style={{ color: MUTED }}
                >
                  {i + 1}
                </span>
                <code
                  className="whitespace-pre font-mono text-[11px]"
                  style={{ color: complete || active ? undefined : "transparent" }}
                >
                  {complete || active ? shown : l.code}
                  {active ? <span className="opacity-60">▌</span> : null}
                </code>
                {complete && l.note ? (
                  <span className="font-mono text-[9.5px]" style={{ color: st.colour }}>
                    {l.kind === "plain" ? "· " : "· "}
                    {l.note}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            stream position
          </span>
          <Range
            min={0}
            max={nLines * 10}
            step={1}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="flex-1"
            aria-label="how far the model has streamed through the REPL cell"
            accent={GOOD}
          />
          <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {Math.round((p / nLines) * 100)}%
          </span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6 text-muted-foreground">
          {c.blurb}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The whole design rests on one asymmetry:{" "}
          <span className="text-foreground">a wrong speculation costs a wasted request, and a
          skipped speculation costs nothing but the latency you were already paying</span>. So the
          allowlist can be conservative without hurting much — refusing to speculate is always safe,
          and case 4 shows what that conservatism buys. The file read is not merely skipped; the
          taint travels, and the call downstream of it is refused too. What survives is the call
          whose inputs never touched the filesystem.
          <br />
          <br />
          Note also what the shadow REPL is <em>not</em>. It is a deepcopy fork, and it is thrown
          away. The real cell executes from its own clean namespace even when every speculation hit,
          because the model may still have produced code that errors on line five — and a partial
          executor that had already mutated real state would leave the harness in a position no
          retry can recover from.
        </p>
      </div>
    </figure>
  )
}
