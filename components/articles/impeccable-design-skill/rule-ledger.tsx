"use client"

import { useId, useState } from "react"

import { RULES, type Bucket, type Engine } from "@/components/articles/impeccable-design-skill/rules"

// Every entry in impeccable.style's slop catalogue (59 detector rules from the
// repo's registry plus 6 that only the model's design review checks), sorted
// by what the rule actually measures. The bucket is this article's call.

const BUCKETS: { key: Bucket; label: string; note: string }[] = [
  { key: "taste", label: "Taste, as a threshold", note: "a habit the authors judge generated, given a number so code can find it" },
  { key: "reading", label: "Readability", note: "contrast, size, measure, leading: checked against a standard that predates AI" },
  { key: "defect", label: "Rendering defects", note: "broken images, script errors, clipped or hidden text" },
  { key: "system", label: "Your design system", note: "values outside the fonts, colours, sizes and radii in your DESIGN.md" },
  { key: "review", label: "Model review only", note: "no code checks these; the critique agent judges them" },
]

const ENGINES: { key: Engine | "all"; label: string }[] = [
  { key: "all", label: "Any engine" },
  { key: "source", label: "Reads source" },
  { key: "browser", label: "Needs a browser" },
  { key: "review", label: "Model only" },
]

const CSS = `
/* The same plate as the slop bench: interface face, an ink rule on top. The
   taste bucket is the one in the page's pink, because it is the article's
   finding; the other four are steps of the ink. */
.imp-ledger { margin: 2.5rem 0; font-family: var(--font-sans); border-top: 2px solid var(--foreground); border-bottom: 1px solid var(--imp-rule, var(--border)); padding: 0.75rem 0 1.5rem; }
.imp-ledger-title { font-weight: 700; font-size: 1rem; margin: 0 0 0.75rem; }
.imp-bar { display: flex; gap: 2px; height: 0.75rem; }
.imp-bar span { flex: var(--n) 1 0; background: var(--c); transition: opacity 150ms ease-out; }
.imp-bar span.is-dim { opacity: 0.2; }
.imp-keys { list-style: none; padding: 0; margin: 0.75rem 0 0; display: grid; gap: 0.25rem; }
@media (min-width: 48rem) { .imp-keys { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 1.5rem; } }
.imp-keys button { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: grid; grid-template-columns: 0.75rem 2rem minmax(0, 1fr); align-items: baseline; gap: 0.5rem; padding: 0.5rem 0.5rem; min-height: 2.5rem; font-size: 0.9375rem; line-height: 1.45; }
.imp-keys button:hover { background: var(--imp-wash, var(--muted)); }
.imp-keys button[aria-pressed="true"] { box-shadow: inset 0 0 0 1px var(--foreground); }
.imp-keys button:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }
.imp-keys i, .imp-rows i { width: 0.75rem; height: 0.75rem; background: var(--c); align-self: center; }
.imp-keys b { font-variant-numeric: tabular-nums lining-nums; text-align: right; }
.imp-keys span { color: var(--imp-quiet, var(--muted-foreground)); }
.imp-keys strong { color: var(--foreground); font-weight: 600; }
.imp-show-all { font: inherit; color: var(--foreground); background: none; border: 0; padding: 0; text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; }
.imp-filter { display: flex; flex-wrap: wrap; gap: 0.25rem; border: 0; padding: 0; margin: 1.5rem 0 0.25rem; min-width: 0; }
.imp-filter legend { font-size: 0.9375rem; font-weight: 600; margin-bottom: 0.25rem; padding: 0; }
.imp-filter label { position: relative; display: inline-flex; align-items: center; font-size: 0.9375rem; padding: 0.25rem 0.75rem; min-height: 2.5rem; border: 1px solid var(--imp-rule, var(--border)); cursor: pointer; }
.imp-filter label:has(input:checked) { border-color: var(--foreground); font-weight: 600; }
.imp-filter label:has(input:focus-visible) { outline: 2px solid var(--foreground); outline-offset: 2px; }
.imp-filter input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.imp-shown { font-size: 0.9375rem; color: var(--imp-quiet, var(--muted-foreground)); margin: 0.75rem 0 0.25rem; font-variant-numeric: tabular-nums; }
/* The rows read as an index: grouped by bucket, two columns read downwards on
   a wide screen, and no inner scroll box, so the page has one scroll. */
.imp-rows { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); border-bottom: 1px solid var(--imp-rule, var(--border)); }
@media (min-width: 48rem) {
  .imp-rows { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows), auto); grid-auto-flow: column; column-gap: 1.5rem; }
}
.imp-rows li { border-top: 1px solid var(--imp-rule, var(--border)); }
.imp-rows li:hover { background: var(--imp-wash, var(--muted)); }
.imp-rows summary { display: grid; grid-template-columns: 0.75rem minmax(0, 1fr) auto; align-items: baseline; gap: 0.5rem; padding: 0.375rem 0.25rem; min-height: 2.5rem; box-sizing: border-box; cursor: pointer; list-style: none; font-size: 0.9375rem; line-height: 1.4; }
.imp-rows summary > span { padding-top: 0.25rem; }
.imp-rows summary::-webkit-details-marker { display: none; }
.imp-rows summary:focus-visible { outline: 2px solid var(--foreground); outline-offset: -2px; }
.imp-rows summary small { font-size: 0.8125rem; color: var(--imp-quiet, var(--muted-foreground)); white-space: nowrap; }
.imp-rows details[open] summary > span { font-weight: 600; }
.imp-row-body { padding: 0 0.25rem 0.75rem 1.5rem; font-size: 0.9375rem; line-height: 1.55; max-width: 60ch; }
.imp-row-body p { margin: 0.25rem 0 0; }
.imp-row-body code { font-size: 0.8125rem; }
`

// The taste bucket takes the page's flag colour; the rest are steps of the ink.
const ink = (pct: number) => `color-mix(in oklch, var(--foreground) ${pct}%, var(--background))`
const TONE: Record<Bucket, string> = {
  taste: "var(--imp-flag, var(--foreground))",
  reading: ink(80),
  defect: ink(56),
  system: ink(36),
  review: ink(20),
}
const ORDER = BUCKETS.map((b) => b.key)

export function RuleLedger() {
  const [bucket, setBucket] = useState<Bucket | "all">("all")
  const [engine, setEngine] = useState<Engine | "all">("all")
  const id = useId()
  const rows = RULES.filter(
    (r) => (bucket === "all" || r.bucket === bucket) && (engine === "all" || r.engine === engine)
  ).sort((a, b) => ORDER.indexOf(a.bucket) - ORDER.indexOf(b.bucket))
  const count = (b: Bucket) => RULES.filter((r) => r.bucket === b).length

  return (
    <figure className="imp-ledger" aria-labelledby={`${id}-t`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p className="imp-ledger-title" id={`${id}-t`}>
        What the {RULES.length} catalogue entries measure
      </p>
      <div className="imp-bar" aria-hidden="true">
        {BUCKETS.map((b) => (
          <span
            key={b.key}
            className={bucket === "all" || bucket === b.key ? undefined : "is-dim"}
            style={{ ["--n" as string]: count(b.key), ["--c" as string]: TONE[b.key] }}
          />
        ))}
      </div>
      <ul className="imp-keys">
        {BUCKETS.map((b) => (
          <li key={b.key}>
            <button
              type="button"
              aria-pressed={bucket === b.key}
              onClick={() => setBucket(bucket === b.key ? "all" : b.key)}
            >
              <i style={{ ["--c" as string]: TONE[b.key] }} aria-hidden="true" />
              <b>{count(b.key)}</b>
              <span>
                <strong>{b.label}</strong>: {b.note}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <fieldset className="imp-filter">
        <legend>Where the check runs</legend>
        {ENGINES.map((e) => (
          <label key={e.key}>
            <input type="radio" name={`${id}-e`} checked={engine === e.key} onChange={() => setEngine(e.key)} />
            {e.label}
          </label>
        ))}
      </fieldset>
      <p className="imp-shown" aria-live="polite">
        Showing {rows.length} of {RULES.length}
        {bucket !== "all" ? `, ${BUCKETS.find((b) => b.key === bucket)!.label.toLowerCase()}` : ""}.
        {bucket !== "all" ? (
          <>
            {" "}
            <button type="button" className="imp-show-all" onClick={() => setBucket("all")}>
              Show every bucket
            </button>
          </>
        ) : null}
      </p>
      <ul className="imp-rows" style={{ ["--rows" as string]: Math.ceil(rows.length / 2) }}>
        {rows.map((r) => (
          <li key={r.id}>
            <details>
              <summary>
                <i style={{ ["--c" as string]: TONE[r.bucket] }} aria-hidden="true" />
                <span>{r.name}</span>
                <small>
                  {r.engine === "review" ? "model review" : r.engine === "browser" ? "browser" : "source"}
                  {r.sev === "advisory" ? " · advisory" : r.sev === "error" ? " · error" : ""}
                </small>
              </summary>
              <div className="imp-row-body">
                <code>{r.id}</code>
                <p>“{r.text}”</p>
                <p>
                  {r.line
                    ? `crates/foundation/src/registry.rs:${r.line}`
                    : "impeccable.style/slop (no detector rule)"}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </figure>
  )
}
