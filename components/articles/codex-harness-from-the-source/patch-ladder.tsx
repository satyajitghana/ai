"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { PATCH_CASES, PATCH_EXAMPLES } from "./data"
import { Chip, Panel, Src, Tag } from "./ui"

// A TypeScript port of seek_sequence (codex-rs/apply-patch/src/seek_sequence.rs:12-104): four passes, each scanning the
// whole remaining file before the next, more permissive pass starts.
const PASSES = ["exact", "trailing whitespace ignored", "both ends trimmed", "trimmed + Unicode punctuation normalised"]

const norm = (s: string) =>
  Array.from(s.trim())
    .map((c) => {
      if ("‐‑‒–—―−".includes(c)) return "-"
      if ("‘’‚‛".includes(c)) return "'"
      if ("“”„‟".includes(c)) return '"'
      if ("            　".includes(c)) return " "
      return c
    })
    .join("")

const CMP: ((a: string, b: string) => boolean)[] = [
  (a, b) => a === b,
  (a, b) => a.trimEnd() === b.trimEnd(),
  (a, b) => a.trim() === b.trim(),
  (a, b) => norm(a) === norm(b),
]

function seek(lines: string[], pattern: string[], start: number, eof: boolean): { at: number; pass: number } | null {
  if (pattern.length === 0) return { at: start, pass: 0 }
  if (pattern.length > lines.length) return null
  const from = eof && lines.length >= pattern.length ? Math.max(lines.length - pattern.length, start) : start
  for (let p = 0; p < CMP.length; p++) {
    for (let i = from; i <= lines.length - pattern.length; i++) {
      if (pattern.every((x, k) => CMP[p](lines[i + k], x))) return { at: i, pass: p }
    }
  }
  return null
}

const FILE = [
  "def load(path):",
  "    with open(path) as f:",
  "        return f.read()",
  "",
  "# TODO – handle errors",
  "def main():",
  "    x = 1 ",
  "    return x",
  "",
  "def other():",
  "    x = 1",
  "    return x",
]

const PRESETS = [
  { id: "exact", label: "an exact line", pattern: "    with open(path) as f:", note: "Pass 1 finds it." },
  { id: "indent", label: "no indentation in the patch", pattern: "with open(path) as f:", note: "Pass 3 matches on trimmed text. The replacement lines are written as the patch spells them, so the file's indentation is not preserved." },
  { id: "dash", label: "hyphen where the file has an en dash", pattern: "# TODO - handle errors", note: "Pass 4 normalises dashes, quotes and odd spaces to ASCII." },
  { id: "shadow", label: "the line I meant has a trailing space", pattern: "    x = 1", note: "Pass 1 scans the whole file first and finds the exact line in other(). The patch lands in the wrong function." },
  { id: "none", label: "a line that is not there", pattern: "def missing():", note: "No pass matches: the hunk fails with an error." },
]

export function PatchLadder() {
  const [pat, setPat] = useState(PRESETS[3].pattern)
  const [start, setStart] = useState(0)
  const [eof, setEof] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const pattern = useMemo(() => pat.split("\n"), [pat])
  const hit = useMemo(() => seek(FILE, pattern, start, eof), [pattern, start, eof])
  const note = PRESETS.find((p) => p.pattern === pat)?.note
  return (
    <Panel title="Where does a hunk land? The four-pass matcher, live" sub="a port of seek_sequence; edit the pattern">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (<Chip key={p.id} active={pat === p.pattern} onClick={() => setPat(p.pattern)}>{p.label}</Chip>))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">the patch&apos;s old lines (one per row)</div>
          <textarea value={pat} onChange={(e) => setPat(e.target.value)} rows={3} spellCheck={false} className="w-full rounded-md border border-border bg-background p-2 font-mono text-[12px]" aria-label="old lines of the hunk" />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
            <label className="flex items-center gap-1.5">search from line <input type="number" min={0} max={FILE.length - 1} value={start} onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))} className="w-14 rounded border border-border bg-background px-1" /></label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={eof} onChange={(e) => setEof(e.target.checked)} /> end-of-file hunk</label>
          </div>
        </div>
        <ol className="rounded-md border border-border bg-muted/30 py-1 font-mono text-[12px]">
          {FILE.map((l, i) => {
            const on = hit && i >= hit.at && i < hit.at + pattern.length
            return (
              <li key={i} className={cn("flex gap-2 px-2", on && "bg-amber-500/25")}>
                <span className="w-5 shrink-0 select-none text-right text-muted-foreground">{i + 1}</span>
                <span className="whitespace-pre">{l === "" ? " " : l.replace(/ $/, "·")}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        {hit ? (
          <>Matched at line <span className="font-medium">{hit.at + 1}</span> on <span className="font-medium">pass {hit.pass + 1}: {PASSES[hit.pass]}</span>.</>
        ) : (
          <>No pass matches. The real code returns <code>Failed to find expected lines in &lt;path&gt;</code> and the hunk fails.</>
        )}
        {note ? <span className="text-muted-foreground"> {note}</span> : null}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-1 text-sm font-medium">Eighteen test patches run through our port of the whole apply loop</div>
        <p className="mb-2 text-xs text-muted-foreground">Constructed to probe the matcher, not sampled from model output: they say what can happen, not how often. Click a row marked wrong.</p>
        <ul className="space-y-1">
          {PATCH_CASES.map((c, i) => {
            const wrong = c.result.startsWith("APPLIED, NOT")
            const ex = PATCH_EXAMPLES.findIndex((e) => e.name === c.name)
            return (
              <li key={c.name}>
                <button type="button" disabled={ex < 0} onClick={() => setOpen(open === i ? null : i)} className={cn("flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded px-2 py-1 text-left text-[12px]", ex >= 0 ? "hover:bg-muted" : "cursor-default")}>
                  <span className="w-60 shrink-0">{c.name}</span>
                  <span className="w-44 shrink-0 text-muted-foreground">{c.passes.join(" + ")}</span>
                  <Tag tone={wrong ? "rose" : c.result.startsWith("PARTIAL") ? "amber" : c.result.startsWith("error") ? "slate" : "emerald"}>{wrong ? "wrong place" : c.result.startsWith("PARTIAL") ? "partial" : c.result.startsWith("error") ? "clean error" : "as intended"}</Tag>
                </button>
                {open === i && ex >= 0 ? (
                  <pre className="mx-2 mb-2 overflow-x-auto rounded bg-muted/50 p-2 text-[11.5px] leading-snug">{PATCH_EXAMPLES[ex].diff}</pre>
                ) : null}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Source of the matcher: <Src>apply-patch/src/seek_sequence.rs:12-104</Src>; chunk handling: <Src>apply-patch/src/file_update.rs:63-155</Src>.</p>
      </div>
    </Panel>
  )
}
