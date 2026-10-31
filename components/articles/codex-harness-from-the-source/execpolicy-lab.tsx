"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { EXEC_RESULTS, EXEC_RULES } from "./data"
import { Chip, Panel, Src, Tag, type Tone } from "./ui"

// A TypeScript port of toy 4: prefix rules from execpolicy/examples/example.codexpolicy (the only rule file the repo ships) and the
// splitting rule of shell-command/src/bash.rs:29-52 (word-only commands joined by && || ; |). Not tree-sitter: a small scanner.
type Decision = "allow" | "prompt" | "forbidden"
const RANK: Record<Decision, number> = { allow: 0, prompt: 1, forbidden: 2 }
const TONE: Record<Decision, Tone> = { allow: "emerald", prompt: "amber", forbidden: "rose" }

const words = (s: string): string[] | null => {
  const out: string[] = []
  let cur = ""
  let q: string | null = null
  let any = false
  for (const c of s) {
    if (q) {
      if (c === q) q = null
      else cur += c
    } else if (c === "'" || c === '"') {
      q = c
      any = true
    } else if (c === " " || c === "\t") {
      if (cur || any) out.push(cur)
      cur = ""
      any = false
    } else cur += c
  }
  if (q) return null
  if (cur || any) out.push(cur)
  return out
}

function plain(script: string): string[][] | null {
  const parts: string[] = []
  let cur = ""
  let q: string | null = null
  for (let i = 0; i < script.length; i++) {
    const c = script[i]
    if (q === "'") {
      cur += c
      if (c === "'") q = null
    } else if (q === '"') {
      if (c === "$" || c === "`") return null
      cur += c
      if (c === '"') q = null
    } else if (c === "'" || c === '"') {
      q = c
      cur += c
    } else if ("$`<>(){}~*?[]#\n\\".includes(c)) return null
    else if ((c === "&" && script[i + 1] === "&") || (c === "|" && script[i + 1] === "|")) {
      parts.push(cur)
      cur = ""
      i++
    } else if (c === "&") return null
    else if (c === ";" || c === "|") {
      parts.push(cur)
      cur = ""
    } else cur += c
  }
  if (q) return null
  parts.push(cur)
  const out: string[][] = []
  for (const p of parts) {
    const w = words(p)
    if (!w || w.length === 0) return null
    out.push(w)
  }
  return out
}

function dangerous(argv: string[], depth = 0): boolean {
  if (depth > 8 || argv.length === 0) return depth > 8
  const c = argv[0].split("/").pop()
  if (c === "sudo") return dangerous(argv.slice(1), depth + 1)
  if (c === "env") {
    let rest = argv.slice(1)
    while (rest.length && (rest[0] === "-i" || /^\w+=/.test(rest[0]))) rest = rest.slice(1)
    return dangerous(rest, depth + 1)
  }
  if (c === "rm") {
    for (const a of argv.slice(1)) {
      if (a === "--") break
      if (a === "--force" || (a.startsWith("-") && !a.startsWith("--") && a.includes("f"))) return true
    }
  }
  return false
}

type Rule = { pattern: readonly (string | readonly string[])[]; decision: string; justification: string | null }
const RULES = EXEC_RULES as unknown as Rule[]

function classify(argv: string[]) {
  const isShell = argv.length === 3 && ["bash", "sh", "zsh"].includes(argv[0].split("/").pop() ?? "") && (argv[1] === "-c" || argv[1] === "-lc")
  const cmds = (isShell ? plain(argv[2]) : null) ?? [argv]
  const split = isShell && plain(argv[2]) !== null
  let worst: Decision = "allow"
  let explicit = true
  const segs = cmds.map((c) => {
    const hit = RULES.filter((r) => c.length >= r.pattern.length && r.pattern.every((e, i) => (Array.isArray(e) ? (e as string[]).includes(c[i]) : e === c[i])))
    let d: Decision
    let why: string
    if (hit.length) {
      d = hit.map((h) => h.decision as Decision).sort((a, b) => RANK[b] - RANK[a])[0]
      why = `rule [${hit[0].pattern.join(" ")}] says ${d}`
      if (d !== "allow") explicit = false
    } else {
      explicit = false
      if (dangerous(c)) { d = "prompt"; why = "no rule; flagged dangerous (rm with a force flag)" }
      else { d = "allow"; why = "no rule; it may run inside the sandbox (on-request, restricted filesystem)" }
    }
    if (RANK[d] > RANK[worst]) worst = d
    return { c, d, why }
  })
  return { worst, split, segs, bypass: worst === "allow" && explicit }
}

const EXAMPLES = ["ls -la", "git reset --hard HEAD~1", "bash -lc 'ls && git reset --hard'", "bash -lc 'git reset --hard $(git rev-parse HEAD)'", "rm -rf build", "sudo rm -rf /tmp/x", "cp a b", "git status"]

export function ExecpolicyLab() {
  const [text, setText] = useState(EXAMPLES[3])
  const [filter, setFilter] = useState<Decision | "all">("all")
  const r = useMemo(() => {
    const w = words(text)
    return w && w.length ? classify(w) : null
  }, [text])
  return (
    <Panel title="Rules are prefixes; the shell decides whether they apply" sub="the repo's example rules, a live matcher">
      <div className="mb-2 flex flex-wrap gap-1.5">{EXAMPLES.map((e) => (<Chip key={e} active={text === e} onClick={() => setText(e)}><code className="font-mono">{e}</code></Chip>))}</div>
      <input value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="command" className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12.5px]" />
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        {r ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2"><Tag tone={TONE[r.worst]}>{r.worst}</Tag><span className="text-muted-foreground">{r.split ? `split into ${r.segs.length} segment${r.segs.length > 1 ? "s" : ""}; the strictest decision wins` : "evaluated as one command"}{r.bypass ? "; every segment is explicitly allowed, so it may skip the sandbox" : ""}</span></div>
            <ul className="space-y-1">{r.segs.map((s, i) => (<li key={i} className="flex flex-wrap items-center gap-2 text-[12px]"><Tag tone={TONE[s.d]}>{s.d}</Tag><code className="font-mono">{s.c.join(" ")}</code><span className="text-muted-foreground">{s.why}</span></li>))}</ul>
          </>
        ) : (<span className="text-muted-foreground">Type a command.</span>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        A <code>bash -lc</code> script is split only if it is words, quoted strings and numbers joined by <code>&amp;&amp;</code>, <code>||</code>, <code>;</code> or <code>|</code>. A <code>$(…)</code>, a redirection or a <code>&amp;</code> makes the whole script one command that no prefix rule matches; the literal-word parser is used only to spot a dangerous <code>rm</code>, never to match rules. <Src>shell-command/src/bash.rs:29-52, 136</Src>
      </p>
      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-sm font-medium">Our 32-command run</span>
          {(["all", "allow", "prompt", "forbidden"] as const).map((f) => (<Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>))}
        </div>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {EXEC_RESULTS.filter((e) => filter === "all" || e.effective === filter).map((e) => (
            <li key={e.command} className={cn("flex items-center gap-2 text-[12px]")}>
              <span className="w-20 shrink-0"><Tag tone={TONE[e.effective as Decision]}>{e.effective}</Tag></span>
              <code className="truncate font-mono">{e.command}</code>
              {e.bypass ? <span className="ml-auto shrink-0 text-[10.5px] text-muted-foreground">may skip sandbox</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
