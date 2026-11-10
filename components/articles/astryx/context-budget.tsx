"use client"

import { useId, useState } from "react"

import { CLI_SIZES, GETS, PROBE } from "@/components/articles/astryx/data"

// Response sizes from the hosted MCP server, measured 2026-11-09: one get()
// per component (24 of them) and the median search() answer at its default
// limit of eight. Tokens are an estimate at four characters per token; the
// server returns JSON text, so a real tokenizer will land near that, not on it.
// The CLI rows are `astryx component <Name>` at 0.7.11, measured 2026-11-10.

const CSS = `
.asx-budget { margin: 2.5rem 0; font-family: var(--font-sans); border-top: 2px solid var(--foreground); border-bottom: 1px solid var(--border); padding: 0.75rem 0 1.25rem; }
.asx-budget-title { font-weight: 700; font-size: 1rem; margin: 0 0 0.25rem; }
.asx-budget-sub { font-size: 0.875rem; color: var(--muted-foreground); margin: 0 0 0.75rem; line-height: 1.5; }
.asx-ctl { display: flex; gap: 0.25rem; flex-wrap: wrap; margin: 0 0 0.75rem; }
.asx-ctl button { font: inherit; font-size: 0.875rem; padding: 0.25rem 0.75rem; min-height: 2.25rem; background: none; color: var(--foreground); border: 1px solid var(--border); cursor: pointer; }
.asx-ctl button[aria-pressed="true"] { border-color: var(--foreground); font-weight: 600; }
.asx-ctl button:focus-visible, .asx-bars button:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }
.asx-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.asx-bars li { display: grid; grid-template-columns: minmax(0, 8.5rem) minmax(0, 1fr) 4.5rem; gap: 0.5rem; align-items: center; font-size: 0.8125rem; }
.asx-bars .lab { font-family: var(--font-mono); overflow-wrap: anywhere; }
.asx-bars .track { position: relative; height: 0.875rem; }
.asx-bars .fill { position: absolute; inset: 0 auto 0 0; background: color-mix(in oklch, var(--foreground) 55%, var(--background)); }
.asx-bars li.is-ref .fill { background: none; border: 1px dashed var(--foreground); }
.asx-bars li.is-search .fill { background: var(--foreground); }
.asx-bars .num { text-align: right; font-variant-numeric: tabular-nums; }
.asx-note { font-size: 0.875rem; margin: 0.75rem 0 0; line-height: 1.5; }
`

type Unit = "chars" | "tokens"
type Sort = "size" | "props"
type Source = "mcp" | "json" | "full" | "brief" | "dense" | "propsJson"

const SOURCES: { k: Source; label: string; desc: string }[] = [
  { k: "mcp", label: "MCP get", desc: "get(name) from the hosted server" },
  { k: "json", label: "CLI --json", desc: "astryx component <Name> --json (the same bytes at every --detail)" },
  { k: "full", label: "CLI text", desc: "astryx component <Name>, text, --detail full" },
  { k: "dense", label: "CLI --dense", desc: "astryx component <Name> --dense" },
  { k: "propsJson", label: "CLI --props --json", desc: "astryx component <Name> --props --json" },
  { k: "brief", label: "CLI brief", desc: "astryx component <Name> --detail brief, text" },
]

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function ContextBudget() {
  const id = useId()
  const [unit, setUnit] = useState<Unit>("tokens")
  const [sort, setSort] = useState<Sort>("size")
  const [src, setSrc] = useState<Source>("mcp")
  const searchMedian = median(PROBE.map((r) => r.chars))
  const sized = GETS.map((g) => {
    const c = CLI_SIZES.find((x) => x.n === g.n)
    const v =
      src === "mcp" || !c
        ? g.chars
        : src === "json"
          ? c.json
          : src === "full"
            ? c.full
            : src === "dense"
              ? c.dense
              : src === "propsJson"
                ? c.props
                : c.brief
    return { n: g.n, props: g.props, chars: v }
  })
  const getMedian = median(sized.map((g) => g.chars))
  // json-render + Jev's catalog request: about 7,100 tokens on every call,
  // reported in this site's own article on it, converted back at 4 chars/token.
  const JEV_TOKENS = 7100

  const show = (chars: number) =>
    unit === "chars" ? Math.round(chars).toLocaleString("en-US") : `~${Math.round(chars / 4).toLocaleString("en-US")}`
  const rows = [...sized].sort((a, b) => (sort === "size" ? b.chars - a.chars : b.props - a.props))
  const max = Math.max(JEV_TOKENS * 4, ...GETS.map((g) => g.chars))

  return (
    <figure className="asx-budget" aria-labelledby={`${id}-t`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p className="asx-budget-title" id={`${id}-t`}>
        What one answer costs an agent&apos;s context
      </p>
      <p className="asx-budget-sub">
        Size of each component read, from the hosted server or from the CLI, beside the median MCP{" "}
        <code>search(query)</code> answer. Tokens are estimated at four characters each.
      </p>
      <div className="asx-ctl" role="group" aria-label="Unit and order">
        <button type="button" aria-pressed={unit === "tokens"} onClick={() => setUnit("tokens")}>
          Tokens (est.)
        </button>
        <button type="button" aria-pressed={unit === "chars"} onClick={() => setUnit("chars")}>
          Characters (measured)
        </button>
        <button type="button" aria-pressed={sort === "size"} onClick={() => setSort("size")}>
          Sort by size
        </button>
        <button type="button" aria-pressed={sort === "props"} onClick={() => setSort("props")}>
          Sort by prop count
        </button>
      </div>
      <div className="asx-ctl" role="group" aria-label="Which channel answers">
        {SOURCES.map((x) => (
          <button key={x.k} type="button" aria-pressed={src === x.k} onClick={() => setSrc(x.k)} title={x.desc}>
            {x.label}
          </button>
        ))}
      </div>
      <ul className="asx-bars">
        <li className="is-ref">
          <span className="lab">json-render catalog</span>
          <span className="track" aria-hidden="true">
            <span className="fill" style={{ width: `${((JEV_TOKENS * 4) / max) * 100}%` }} />
          </span>
          <span className="num">{show(JEV_TOKENS * 4)}</span>
        </li>
        <li className="is-search">
          <span className="lab">search, median</span>
          <span className="track" aria-hidden="true">
            <span className="fill" style={{ width: `${(searchMedian / max) * 100}%` }} />
          </span>
          <span className="num">{show(searchMedian)}</span>
        </li>
        {rows.map((g) => (
          <li key={g.n}>
            <span className="lab">
              {g.n} <span style={{ color: "var(--muted-foreground)" }}>· {g.props} props</span>
            </span>
            <span className="track" aria-hidden="true">
              <span className="fill" style={{ width: `${(g.chars / max) * 100}%` }} />
            </span>
            <span className="num">{show(g.chars)}</span>
          </li>
        ))}
      </ul>
      <p className="asx-note">
        {SOURCES.find((x) => x.k === src)?.desc}: median {show(getMedian)} {unit === "chars" ? "characters" : "tokens"}. A page that needs a
        table, a dialog, a selector and a toast pulls about{" "}
        {show(["Table", "Dialog", "Selector", "Toast"].reduce((s, n) => s + (sized.find((g) => g.n === n)?.chars ?? 0), 0))}{" "}
        {unit === "chars" ? "characters" : "tokens"} of reference, once. The dashed bar is the catalog json-render sends
        on every call (reported in the article linked below the chart, not measured here).
      </p>
    </figure>
  )
}
