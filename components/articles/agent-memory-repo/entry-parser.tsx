"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A reader for one line of an Agent Memory Repo note, written from SPEC.md
// (AgentMemoryRepo/agentmemoryrepo, commit 1db04a5). The spec's grammar is
// four sentences long:
//   - an entry is a bullet on one line,
//   - optional metadata at the end, as [key: value; key: value],
//   - keys are open; `source` and `added` (YYYY-MM-DD) are recommended,
//   - [[path]] links start at the memory root; .md is omitted for Markdown.
// Everything this parser flags is a place where those sentences leave a
// choice to the reader. The presets are lines taken from the spec, the
// README and the cognition.com page, plus one constructed edge case.

type Preset = { name: string; line: string; from: string }

const PRESETS: Preset[] = [
  {
    name: "spec entry",
    line: "- Payments and website share a 2026-10-15 launch deadline [source: https://example.com/sessions/102; added: 2026-09-03]",
    from: "SPEC.md",
  },
  {
    name: "link + source",
    line: "- [[billing/count_paying_customers.sql]] counts organizations with active, paid subscriptions. Excludes test organizations and counts each organization once [source: https://example.com/sessions/105]",
    from: "README.md",
  },
  {
    name: "three sources",
    line: "- Cause: the price cache refresh rebuilds a 2 GB table every 10 seconds [source: https://example.com/sessions/301] [source: https://example.com/sessions/302] [source: https://example.com/sessions/304]",
    from: "cognition.com page, swarm example (shortened)",
  },
  {
    name: "nested reply",
    line: "  - Cache answers: yes. The price cache refresh runs every 10 seconds [source: https://example.com/sessions/304]",
    from: "cognition.com page, questions.md",
  },
  {
    name: "; in a URL",
    line: "- Dashboard lives at the matrix URL [source: https://example.com/d;view=week; added: 2026-10-06]",
    from: "constructed edge case",
  },
]

type Meta = { key: string; value: string }
type Parsed = {
  isEntry: boolean
  indent: number
  text: string
  groups: Meta[][]
  links: { raw: string; file: string }[]
  notes: string[]
}

const META_GROUP = /\s*\[([A-Za-z_][\w-]*:[^\]]*)\]\s*$/

function parse(line: string): Parsed {
  const notes: string[] = []
  const m = /^(\s*)- (.*)$/.exec(line)
  if (!m) {
    return { isEntry: false, indent: 0, text: line, groups: [], links: [], notes: ["Not a bullet, so not an entry."] }
  }
  const indent = m[1].length
  let rest = m[2]
  const groups: Meta[][] = []
  for (;;) {
    const g = META_GROUP.exec(rest)
    if (!g) break
    // [[links]] also end in ']', so never take a group that is really a link.
    if (rest.slice(0, g.index + 1).endsWith("[")) break
    const pairs = g[1].split(";").map((p) => {
      const i = p.indexOf(":")
      return i < 0 ? { key: "?", value: p.trim() } : { key: p.slice(0, i).trim(), value: p.slice(i + 1).trim() }
    })
    groups.unshift(pairs)
    rest = rest.slice(0, g.index)
  }
  const links = Array.from(rest.matchAll(/\[\[([^\]]+)\]\]/g)).map((x) => {
    const raw = x[1]
    const hasExt = /\.[A-Za-z0-9]+$/.test(raw)
    return { raw, file: hasExt ? raw : `${raw}.md` }
  })

  if (indent > 0)
    notes.push(
      "Indented bullet. The spec says an entry is a bullet on one line and says nothing about nesting, so a reader has to decide whether this is its own entry or part of the one above.",
    )
  if (groups.length > 1)
    notes.push(
      `${groups.length} metadata brackets. SPEC.md describes one bracketed list at the end of an entry; the page's own example writes three.`,
    )
  for (const g of groups)
    for (const p of g) {
      if (p.key === "?" || /^\w+=/.test(p.value) || p.key.includes("/"))
        notes.push(`A pair split oddly: "${p.key}: ${p.value}". The ';' separator has no escape, so a value containing ';' is cut in two.`)
      if (p.key === "added" && !/^\d{4}-\d{2}-\d{2}$/.test(p.value))
        notes.push(`"added" should be YYYY-MM-DD; got "${p.value}".`)
    }
  if (groups.length === 0) notes.push("No metadata. Allowed: metadata is optional.")
  return { isEntry: true, indent, text: rest.trim(), groups, links, notes }
}

export function EntryParser() {
  const [line, setLine] = useState(PRESETS[0].line)
  const [from, setFrom] = useState(PRESETS[0].from)
  const p = parse(line)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one entry, read by the spec</span>
        <span className="font-mono text-[11px] text-muted-foreground">from: {from}</span>
      </div>
      <div className="flex flex-wrap gap-1 border-b px-3 py-2.5 sm:px-4">
        {PRESETS.map((pr) => (
          <button
            key={pr.name}
            type="button"
            onClick={() => {
              setLine(pr.line)
              setFrom(pr.from)
            }}
            aria-pressed={line === pr.line}
            className={cn(
              "cursor-pointer rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              line === pr.line
                ? "border-foreground/30 bg-muted/60 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {pr.name}
          </button>
        ))}
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">the line (editable)</span>
          <textarea
            value={line}
            onChange={(e) => {
              setLine(e.target.value.replace(/\n/g, " "))
              setFrom("your edit")
            }}
            rows={3}
            spellCheck={false}
            className="mt-1 w-full resize-y rounded border bg-background/60 px-2 py-1.5 font-mono text-[12px] leading-relaxed"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-mono text-[11px] text-muted-foreground">fact</span>
          <span className="text-sm">{p.isEntry ? p.text : "—"}</span>

          <span className="font-mono text-[11px] text-muted-foreground">metadata</span>
          <div className="flex flex-wrap gap-1.5">
            {p.groups.length === 0 && <span className="text-sm text-muted-foreground">none</span>}
            {p.groups.map((g, gi) =>
              g.map((kv, i) => (
                <span
                  key={`${gi}-${i}`}
                  className="max-w-full break-all rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]"
                >
                  <span className="text-muted-foreground">{kv.key}</span>
                  {" = "}
                  {kv.value}
                </span>
              )),
            )}
          </div>

          <span className="font-mono text-[11px] text-muted-foreground">links (edges)</span>
          <div className="flex flex-wrap gap-1.5">
            {p.links.length === 0 && <span className="text-sm text-muted-foreground">none</span>}
            {p.links.map((l) => (
              <span key={l.raw} className="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]">
                [[{l.raw}]] → &lt;root&gt;/{l.file}
              </span>
            ))}
          </div>
        </div>

        {p.notes.length > 0 && (
          <ul className="m-0 list-none space-y-1 rounded-lg border bg-muted/15 px-3 py-2 text-sm">
            {p.notes.map((n) => (
              <li key={n} className="text-muted-foreground">
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>
    </figure>
  )
}
