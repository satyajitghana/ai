"use client"

import { useId, useState } from "react"

// The three ways an agent learns Astryx, as the repository describes them
// (packages/cli/foundation/agent-docs, packages/cli/README.md,
// apps/docsite/src/app/mcp/route.ts at da85f28). Which version answers is the
// row that matters: two channels follow the project's install, one follows
// whatever the docsite last deployed.

type Channel = {
  key: string
  name: string
  where: string
  carries: string[]
  version: string
  ran: string
}

const CHANNELS: Channel[] = [
  {
    key: "init",
    name: "astryx init",
    where: "a managed block in AGENTS.md and CLAUDE.md, an import line in GEMINI.md; with --user, a SKILL.md in ~/.agents/skills linked into ~/.claude/skills",
    carries: [
      "the CLI prefix to use",
      "the CSS imports without which components render unstyled",
      "the component count and the docs topics to ask for",
    ],
    version: "written from the installed Core; doctor and upgrade refresh it",
    ran: "read only: the CLI did not run here",
  },
  {
    key: "cli",
    name: "astryx <command> --json",
    where: "16 commands in the project, through the package manager's runner",
    carries: [
      "search, component, hook, docs, template, build, theme, swizzle",
      "typed envelopes: apiVersion, type, data, meta.answeredBy",
      "--detail brief | compact | full, --dense, --zh",
    ],
    version: "the project's own install answers; meta.answeredBy says which copy",
    ran: "read only: the permission layer refused to execute the package",
  },
  {
    key: "mcp",
    name: "MCP at astryx.atmeta.com/mcp",
    where: "a Next.js route on the docsite, Streamable HTTP, no install",
    carries: ["search(query, limit = 8)", "get(name, section?)", "nothing else: two tools"],
    version: "whatever the docsite deployed; serverInfo says 2.0.0",
    ran: "measured: 84 tool calls on 9 November 2026",
  },
]

const CSS = `
.asx-ch { margin: 2.5rem 0; font-family: var(--font-sans); border-top: 2px solid var(--foreground); border-bottom: 1px solid var(--border); padding: 0.75rem 0 1.25rem; }
.asx-ch-title { font-weight: 700; font-size: 1rem; margin: 0 0 0.75rem; }
.asx-ch-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.5rem; }
@media (min-width: 48rem) { .asx-ch-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.asx-ch-row button { all: unset; box-sizing: border-box; cursor: pointer; border: 1px solid var(--border); padding: 0.5rem 0.75rem; min-height: 2.75rem; font-family: var(--font-mono); font-size: 0.8125rem; overflow-wrap: anywhere; }
.asx-ch-row button[aria-pressed="true"] { border-color: var(--foreground); background: color-mix(in oklch, var(--foreground) 8%, var(--background)); font-weight: 700; }
.asx-ch-row button:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }
.asx-ch dl { margin: 0.75rem 0 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.25rem 1rem; font-size: 0.9rem; line-height: 1.5; }
@media (min-width: 48rem) { .asx-ch dl { grid-template-columns: 9rem minmax(0, 1fr); } }
.asx-ch dt { font-weight: 600; }
.asx-ch dd { margin: 0; }
.asx-ch ul { margin: 0; padding-left: 1.1rem; }
`

export function AgentChannels() {
  const id = useId()
  const [k, setK] = useState("mcp")
  const c = CHANNELS.find((x) => x.key === k) ?? CHANNELS[2]
  return (
    <figure className="asx-ch" aria-labelledby={`${id}-t`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p className="asx-ch-title" id={`${id}-t`}>
        Three ways an agent learns Astryx
      </p>
      <div className="asx-ch-row" role="group" aria-label="Channel">
        {CHANNELS.map((x) => (
          <button key={x.key} type="button" aria-pressed={x.key === k} onClick={() => setK(x.key)}>
            {x.name}
          </button>
        ))}
      </div>
      <dl aria-live="polite">
        <dt>Where it lives</dt>
        <dd>{c.where}</dd>
        <dt>What it carries</dt>
        <dd>
          <ul>
            {c.carries.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </dd>
        <dt>Which version answers</dt>
        <dd>{c.version}</dd>
        <dt>What I did with it</dt>
        <dd>{c.ran}</dd>
      </dl>
    </figure>
  )
}
