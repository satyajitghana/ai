"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { Chip, Panel, Src, Tag } from "./ui"

// codex-rs/skills/src/parser.rs:4, 200-220 (frontmatter), ext/skills/src/catalog_prompt.rs, skills/src/mentions.rs.
const STEPS = [
  { t: "A directory with a SKILL.md", n: "The file starts with YAML frontmatter between --- lines. name (at most 64 characters) and description are required; short_description is optional. Extra metadata (display name, icons, a policy, dependencies on MCP servers) lives in an agents/ subfolder. Conventional subfolders: scripts/, references/, assets/." },
  { t: "Discovered by scope", n: "User, Repo, System, Admin, a plugin, an executor or a cloud package. A skill can live on a remote executor, which is why skills have skill:// locators." },
  { t: "Listed in a catalog message", n: "Name, description and a path or locator per skill go into the prompt; the bodies do not. Four prompt variants exist. The catalog travels as world-state with deltas and dedup." },
  { t: "Triggered", n: "Either the user names it ($Name or plain text) or the task clearly matches a description. The prompt says the agent “must use that skill for that turn” and not carry it over unless it is mentioned again." },
  { t: "Read in full, then used", n: "The agent must read the whole SKILL.md before acting and not delegate that to a subagent. Relative paths resolve against the skill's directory; provided scripts are preferred over retyped code." },
]

const SAMPLE = `---
name: review-agent
description: Review a diff against the repo's conventions and report findings.
---

# Review

Read the changed files first.`

function check(src: string) {
  const lines = src.split("\n")
  if (lines[0]?.trim() !== "---") return { ok: false, msg: "missing YAML frontmatter delimited by ---" }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---")
  if (end < 0) return { ok: false, msg: "frontmatter is not closed with ---" }
  const fm = Object.fromEntries(lines.slice(1, end).map((l) => { const k = l.indexOf(":"); return k < 0 ? ["", ""] : [l.slice(0, k).trim(), l.slice(k + 1).trim()] }))
  if (!fm.name) return { ok: false, msg: "name is required" }
  if (fm.name.length > 64) return { ok: false, msg: `name is ${fm.name.length} characters; the limit is 64` }
  if (!fm.description) return { ok: false, msg: "description is required" }
  return { ok: true, msg: `valid: ${fm.name} (${fm.name.length} of 64 characters)` }
}

export function SkillLife() {
  const [i, setI] = useState(0)
  const [src, setSrc] = useState(SAMPLE)
  const r = useMemo(() => check(src), [src])
  return (
    <Panel title="A skill's life, from a folder to a turn" sub="progressive disclosure: only the description is always in context">
      <ol className="flex flex-col gap-1.5 md:flex-row md:gap-1">
        {STEPS.map((s, k) => (<li key={s.t} className="md:flex-1"><Chip active={i === k} onClick={() => setI(k)}><span className="mr-1 text-muted-foreground">{k + 1}</span>{s.t}</Chip></li>))}
      </ol>
      <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px] text-muted-foreground">{STEPS[i].n}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">edit a SKILL.md header</div>
          <textarea value={src} onChange={(e) => setSrc(e.target.value)} rows={7} spellCheck={false} aria-label="SKILL.md" className="w-full rounded-md border border-border bg-background p-2 font-mono text-[12px]" />
        </div>
        <div className="flex flex-col justify-center gap-2 text-[13px]">
          <div><Tag tone={r.ok ? "emerald" : "rose"}>{r.ok ? "parses" : "rejected"}</Tag></div>
          <p className={cn("text-muted-foreground")}>{r.msg}</p>
          <p className="text-xs text-muted-foreground">Our check follows the parser&apos;s rules; the real one also repairs sloppy third-party YAML such as <code>description: Build for AWS: ECS</code> by quoting it. <Src>skills/src/parser.rs:52-57, 200-220</Src></p>
        </div>
      </div>
    </Panel>
  )
}
