"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { APPS, type AppKey, type ModeRow } from "./data"

// Every combination of the three snapshot flags that change what comes back (`--skeleton`, `-i`, `--compact`) on the
// two toy trees. Numbers are MEASURED on synthetic trees through our port of the ref allocator; see data.ts.

const C_BAR = "oklch(0.62 0.15 250)"
const C_SEL = "oklch(0.62 0.17 30)"

function flagLabel(r: ModeRow): string {
  const f = ["snapshot"]
  if (r.skeleton) f.push("--skeleton")
  if (r.interactive) f.push("-i")
  if (r.compact) f.push("--compact")
  return f.join(" ")
}

function Chip(props: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={props.title}
      aria-pressed={props.on}
      onClick={props.onClick}
      className={cn(
        "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
        props.on ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {props.children}
    </button>
  )
}

export function SnapshotModes() {
  const [app, setApp] = useState<AppKey>("chat-app")
  const [skeleton, setSkeleton] = useState(false)
  const [interactive, setInteractive] = useState(false)
  const [compact, setCompact] = useState(false)

  const data = APPS[app]
  const base = data.rows[0].tokens
  const sel = data.rows.find((r) => r.skeleton === skeleton && r.interactive === interactive && r.compact === compact) ?? data.rows[0]
  const max = Math.max(...data.rows.map((r) => r.tokens))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what each snapshot flag costs · measured on two synthetic trees, tokens by the Qwen3 tokenizer
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">app</span>
        {(Object.keys(APPS) as AppKey[]).map((k) => (
          <Chip key={k} on={app === k} onClick={() => setApp(k)} title={APPS[k].blurb}>
            {APPS[k].label}
          </Chip>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">flags</span>
        <Chip on={skeleton} onClick={() => setSkeleton(!skeleton)} title="depth capped at 3, children_count on cut branches">
          --skeleton
        </Chip>
        <Chip on={interactive} onClick={() => setInteractive(!interactive)} title="drop leaves that cannot take a ref">
          -i
        </Chip>
        <Chip on={compact} onClick={() => setCompact(!compact)} title="collapse single-child unnamed wrappers">
          --compact
        </Chip>
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_15rem]">
        <ul className="space-y-1.5" aria-label="tokens by flag combination">
          {data.rows.map((r) => {
            const on = r === sel
            return (
              <li key={flagLabel(r)}>
                <button
                  type="button"
                  onClick={() => {
                    setSkeleton(r.skeleton)
                    setInteractive(r.interactive)
                    setCompact(r.compact)
                  }}
                  className="block w-full text-left"
                  aria-label={`${flagLabel(r)}: ${r.tokens.toLocaleString("en-US")} tokens, ${r.nodes} nodes, ${r.refs} refs`}
                >
                  <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                    <span className={on ? "text-foreground" : "text-muted-foreground"}>{flagLabel(r)}</span>
                    <span className="tabular-nums">{r.tokens.toLocaleString("en-US")}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded bg-muted" aria-hidden="true">
                    <div className="h-full" style={{ width: `${((r.tokens / max) * 100).toFixed(1)}%`, background: on ? C_SEL : C_BAR }} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="grid content-start gap-3 font-mono text-xs">
          <div>
            <div className="text-muted-foreground">tokens</div>
            <div className="text-xl tabular-nums">{sel.tokens.toLocaleString("en-US")}</div>
            <div className="text-[10px] text-muted-foreground">{((sel.tokens / base) * 100).toFixed(0)}% of plain `snapshot`</div>
          </div>
          <div>
            <div className="text-muted-foreground">nodes returned / refs</div>
            <div className="text-xl tabular-nums">
              {sel.nodes.toLocaleString("en-US")} <span className="text-xs">/ {sel.refs}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">of {data.rawNodes.toLocaleString("en-US")} nodes in the tree</div>
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">
          then `snapshot --root &lt;ref&gt; -i --compact` on one region of the same tree
        </div>
        <ul className="grid gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-2">
          {data.drills.map((d) => (
            <li key={d.region} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{d.region}</span>
              <span className="tabular-nums">
                {d.tokens.toLocaleString("en-US")} tokens · {d.nodes} nodes · {d.refs} refs
              </span>
            </li>
          ))}
        </ul>
      </div>

      <figcaption className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        On the file manager the flags barely matter: the tree is shallow and wide, and the skeleton cuts depth, not breadth. On the chat app it takes a
        snapshot from 38,070 tokens to 8,708. Toy trees: read the ratios, not the totals.
      </figcaption>
    </figure>
  )
}
