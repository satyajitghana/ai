"use client"

import { useId, useMemo, useState } from "react"

import { CLI_PROBE, KEYWORDS, PROBE } from "@/components/articles/astryx/data"

// Two views of the hosted search tool's first stage. "Measured" replays the
// 24 queries I sent to astryx.atmeta.com/mcp on 2026-11-09: the eight results
// it returned, in its order, with the keywords that put each one in the
// 90-point band. "Try a query" re-implements only that keyword stage from the
// repository's own rule (apps/docsite/src/app/mcp/keywordIndex.ts): a keyword
// hits when the query contains it or it contains the query. "CLI vs MCP"
// sets the same 24 queries, run through the published CLI (0.7.11) on
// 2026-11-10, beside the server's answers.

const CSS = `
.asx-probe { margin: 2.5rem 0; font-family: var(--font-sans); border-top: 2px solid var(--foreground); border-bottom: 1px solid var(--border); padding: 0.75rem 0 1.25rem; }
.asx-probe-title { font-weight: 700; font-size: 1rem; margin: 0 0 0.25rem; }
.asx-probe-sub { font-size: 0.875rem; color: var(--muted-foreground); margin: 0 0 0.75rem; line-height: 1.5; }
.asx-tabs { display: flex; gap: 0.25rem; margin: 0 0 0.75rem; flex-wrap: wrap; }
.asx-tabs button { font: inherit; font-size: 0.875rem; padding: 0.25rem 0.75rem; min-height: 2.25rem; background: none; color: var(--foreground); border: 1px solid var(--border); cursor: pointer; }
.asx-tabs button[aria-pressed="true"] { border-color: var(--foreground); font-weight: 600; }
.asx-tabs button:focus-visible, .asx-qs button:focus-visible, .asx-probe input:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }
.asx-qs { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0 0 0.75rem; }
.asx-qs button { font: inherit; font-size: 0.8125rem; padding: 0.125rem 0.5rem; min-height: 2rem; border: 1px solid var(--border); background: none; color: var(--foreground); cursor: pointer; }
.asx-qs button[aria-pressed="true"] { background: var(--foreground); color: var(--background); border-color: var(--foreground); }
.asx-qs button.is-miss { border-style: dashed; }
.asx-rows { list-style: none; margin: 0; padding: 0; counter-reset: r; }
.asx-rows li { display: grid; grid-template-columns: 1.5rem minmax(0, 10rem) minmax(0, 1fr); gap: 0.5rem; align-items: baseline; padding: 0.375rem 0.25rem; border-top: 1px solid var(--border); font-size: 0.9rem; }
.asx-rows li.is-exp { background: color-mix(in oklch, var(--foreground) 8%, var(--background)); }
.asx-rows li.is-exp .asx-name { font-weight: 700; }
.asx-rows li > b { font-variant-numeric: tabular-nums; color: var(--muted-foreground); font-weight: 500; text-align: right; }
.asx-name { font-family: var(--font-mono); font-size: 0.8125rem; overflow-wrap: anywhere; }
.asx-kws { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.asx-kw { font-family: var(--font-mono); font-size: 0.75rem; padding: 0 0.375rem; border: 1px solid var(--border); }
.asx-kw.is-infix { border-color: var(--foreground); border-style: dashed; }
.asx-none { font-size: 0.8125rem; color: var(--muted-foreground); }
.asx-verdict { font-size: 0.9rem; margin: 0.75rem 0 0; line-height: 1.5; font-variant-numeric: tabular-nums; }
.asx-probe input[type="text"] { font: inherit; font-size: 0.9375rem; width: 100%; max-width: 24rem; padding: 0.375rem 0.5rem; border: 1px solid var(--border); background: var(--background); color: var(--foreground); }
.asx-legend { font-size: 0.8125rem; color: var(--muted-foreground); margin: 0.5rem 0 0; }
.asx-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
@media (max-width: 40rem) { .asx-pair { grid-template-columns: minmax(0, 1fr); } }
.asx-pair h4 { font-size: 0.875rem; margin: 0 0 0.25rem; font-weight: 600; }
.asx-pair .asx-rows li { grid-template-columns: 1.5rem minmax(0, 1fr) auto; font-size: 0.8125rem; }
.asx-tag { font-size: 0.75rem; color: var(--muted-foreground); text-align: right; font-variant-numeric: tabular-nums; }
.asx-grid { width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0.75rem 0 0; font-variant-numeric: tabular-nums; }
.asx-grid th, .asx-grid td { border-top: 1px solid var(--border); padding: 0.25rem 0.375rem; text-align: right; }
.asx-grid th:first-child, .asx-grid td:first-child { text-align: left; }
.asx-grid tr.is-sel td { background: color-mix(in oklch, var(--foreground) 8%, var(--background)); font-weight: 600; }
.asx-up { color: var(--foreground); font-weight: 600; }
.asx-dn { color: var(--muted-foreground); text-decoration: line-through; text-decoration-thickness: 1px; }
`

const DOMAIN: Record<string, string> = { c: "component", h: "hook", d: "doc", t: "template" }
const rankText = (r: number | null) => (r === null ? "none" : r > 8 ? `${r} (outside 8)` : String(r))

/** True when the keyword sits inside a query word rather than at its start. */
function isInfix(q: string, k: string): boolean {
  const s = q.toLowerCase()
  if (k.includes(s)) return false
  let i = s.indexOf(k)
  while (i >= 0) {
    if (i === 0 || s[i - 1] === " ") return false
    i = s.indexOf(k, i + 1)
  }
  return true
}

function Kws({ q, ks }: { q: string; ks: string[] }) {
  if (ks.length === 0) return <span className="asx-none">no keyword hit (description or name match)</span>
  return (
    <span className="asx-kws">
      {ks.map((k) => (
        <span key={k} className={isInfix(q, k) ? "asx-kw is-infix" : "asx-kw"}>
          {k}
        </span>
      ))}
    </span>
  )
}

const ENTRIES = Object.entries(KEYWORDS)

type Mode = "measured" | "cli" | "live"

export function SearchProbe({ start = "measured" }: { start?: Mode }) {
  const id = useId()
  const [mode, setMode] = useState<Mode>(start)
  const [qi, setQi] = useState(1)
  const [text, setText] = useState("toast notification")
  const row = PROBE[qi]
  const cli = CLI_PROBE[qi]

  const at = (k: number) => PROBE.filter((r) => r.rank !== null && r.rank <= k).length
  const altAt = (k: number) => PROBE.filter((r) => r.alt !== null && r.alt <= k).length
  const cliAt = (k: number, key: "cli" | "comp") => CLI_PROBE.filter((r) => r[key] !== null && (r[key] ?? 99) <= k).length

  const band = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (q.length === 0) return []
    return ENTRIES.map(([n, ks]) => ({ n, k: ks.filter((k) => k.length > 0 && (q.includes(k) || k.includes(q))) }))
      .filter((e) => e.k.length > 0)
      .sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0))
  }, [text])

  return (
    <figure className="asx-probe" aria-labelledby={`${id}-t`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p className="asx-probe-title" id={`${id}-t`}>
        {mode === "cli" ? "The same 24 queries: hosted search against astryx search" : "What the hosted search tool returns"}
      </p>
      <p className="asx-probe-sub">
        Measured: 24 queries phrased as a person would describe the interface, sent to the MCP server on 9 November 2026.
        CLI vs MCP: the same queries through the published CLI at 0.7.11, run locally on 10 November. Try a query: the
        keyword stage only, re-implemented from the repository.
      </p>
      <div className="asx-tabs" role="group" aria-label="View">
        <button type="button" aria-pressed={mode === "measured"} onClick={() => setMode("measured")}>
          Measured (24 queries)
        </button>
        <button type="button" aria-pressed={mode === "cli"} onClick={() => setMode("cli")}>
          CLI vs MCP
        </button>
        <button type="button" aria-pressed={mode === "live"} onClick={() => setMode("live")}>
          Try a query
        </button>
      </div>

      {mode !== "live" ? (
        <div className="asx-qs" role="group" aria-label="Query">
            {PROBE.map((r, i) => (
              <button
                key={r.q}
                type="button"
                aria-pressed={i === qi}
                className={((mode === "cli" ? CLI_PROBE[i].cli : r.rank) ?? 99) > 8 ? "is-miss" : undefined}
                onClick={() => setQi(i)}
              >
                {r.q}
              </button>
            ))}
        </div>
      ) : null}

      {mode === "measured" ? (
        <>
          <ol className="asx-rows" aria-live="polite">
            {row.top.map((t, i) => (
              <li key={t.n} className={t.n === row.expected ? "is-exp" : undefined}>
                <b>{i + 1}</b>
                <span className="asx-name">
                  {t.n}
                  {t.t !== "c" ? ` (${t.t === "d" ? "doc" : "template"})` : ""}
                </span>
                <Kws q={row.q} ks={t.k} />
              </li>
            ))}
          </ol>
          <p className="asx-verdict">
            Expected <code>{row.expected}</code>:{" "}
            {row.rank === null ? "not returned" : `rank ${row.rank}${row.rank > 8 ? ", outside the default eight" : ""}`}.
            {row.alt !== null && row.rank !== null && row.alt < row.rank
              ? ` Ordering the tied band by whole-word keyword hits would put it at ${row.alt}.`
              : ""}
          </p>
          <p className="asx-verdict">
            Across all 24: first result {at(1)}/24, top three {at(3)}/24, top eight {at(8)}/24. With the whole-word
            tie-break (my reordering of the same eight, not the server): {altAt(1)}/24 and {altAt(3)}/24.
          </p>
        </>
      ) : mode === "cli" ? (
        <>
          <div className="asx-pair" aria-live="polite">
            <div>
              <h4>Hosted MCP server, 9 Nov</h4>
              <ol className="asx-rows">
                {row.top.map((t, i) => (
                  <li key={t.n} className={t.n === row.expected ? "is-exp" : undefined}>
                    <b>{i + 1}</b>
                    <span className="asx-name">{t.n}</span>
                    <span className="asx-tag">{t.k.length > 0 ? "90, keyword" : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h4>astryx search 0.7.11, 10 Nov</h4>
              <ol className="asx-rows">
                {cli.top.map((t, i) => (
                  <li key={`${t.n}-${t.d}-${i}`} className={t.n === row.expected ? "is-exp" : undefined}>
                    <b>{i + 1}</b>
                    <span className="asx-name">
                      {t.n}
                      {t.d !== "c" ? ` (${DOMAIN[t.d] ?? t.d})` : ""}
                    </span>
                    <span className="asx-tag" title={t.r}>
                      {t.s}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="asx-verdict">
            Expected <code>{row.expected}</code>: MCP rank {rankText(row.rank)}, CLI rank {rankText(cli.cli)}, CLI with{" "}
            <code>--type component</code> rank {rankText(cli.comp)}. The CLI&apos;s reason for its first result: “
            {cli.top[0]?.r}”.
          </p>
          <table className="asx-grid">
            <caption className="asx-legend" style={{ captionSide: "bottom", textAlign: "left" }}>
              Rank of the expected component. Bold: the CLI moved it up; struck: the CLI moved it down. Pick a query above to
              see both lists.
            </caption>
            <thead>
              <tr>
                <th scope="col">Query</th>
                <th scope="col">MCP</th>
                <th scope="col">CLI</th>
                <th scope="col">CLI, components</th>
              </tr>
            </thead>
            <tbody>
              {CLI_PROBE.map((r, i) => {
                const m = PROBE[i].rank ?? 999
                const c = r.cli ?? 999
                return (
                  <tr key={r.q} className={i === qi ? "is-sel" : undefined}>
                    <td>{r.q}</td>
                    <td>{PROBE[i].rank ?? "none"}</td>
                    <td className={c < m ? "asx-up" : c > m ? "asx-dn" : undefined}>{r.cli ?? "none"}</td>
                    <td>{r.comp ?? "none"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="asx-verdict">
            First result: MCP {at(1)}/24, CLI {cliAt(1, "cli")}/24, CLI with <code>--type component</code>{" "}
            {cliAt(1, "comp")}/24. Top three: {at(3)}, {cliAt(3, "cli")}, {cliAt(3, "comp")}. Top eight: {at(8)},{" "}
            {cliAt(8, "cli")}, {cliAt(8, "comp")}.
          </p>
        </>
      ) : (
        <>
          <label htmlFor={`${id}-q`} className="asx-probe-sub" style={{ display: "block" }}>
            Query
          </label>
          <input id={`${id}-q`} type="text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <p className="asx-verdict" aria-live="polite">
            {band.length} of {ENTRIES.length} documented components and hooks land in the 90-point band, all tied. The
            server breaks the tie by registry order, shown here alphabetically.
          </p>
          <ol className="asx-rows">
            {band.slice(0, 24).map((e, i) => (
              <li key={e.n}>
                <b>{i + 1}</b>
                <span className="asx-name">{e.n}</span>
                <Kws q={text} ks={e.k} />
              </li>
            ))}
          </ol>
          {band.length > 24 ? <p className="asx-legend">and {band.length - 24} more.</p> : null}
        </>
      )}
      <p className="asx-legend">
        Numbers in the CLI column are the CLI&apos;s own scores; hover one for its reason. A dashed keyword matched inside a query word, not at its start (<code>as</code> inside “toast”). A dashed query
        button never put its expected component in the first eight (on the CLI tab, in the CLI’s first eight).
      </p>
    </figure>
  )
}
