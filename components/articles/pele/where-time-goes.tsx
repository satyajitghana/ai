// Where Mermaid 12.1.0 spends a warm render, from Chrome DevTools CPU profiles
// I took on 2026-10-17: headless Chromium 141, the unminified ESM build (so
// function names survive), five warm-up renders, then 20 profiled renders at
// a 100 µs sampling interval. Shares are inclusive (a function plus what it
// calls) as a percentage of all samples, so rows can overlap: ELK may call
// getConfig, and so on. A dash means the group never appeared on that
// diagram's stacks (sequence diagrams do not use ELK, and measure through a
// different function).
//
// Server-rendered, zero JS. Widths are plain percentages: no lib/dmath needed.

type Group = {
  label: string
  what: string
  flow: number | null
  seq: number | null
  cls: number | null
}

const GROUPS: Group[] = [
  {
    label: "getConfig() deep copy",
    what: "assignWithDepth({}, currentConfig) on every getConfig() call",
    flow: 37.2,
    seq: 53.7,
    cls: 53.0,
  },
  { label: "ELK layout", what: "elkjs, the default layout in 12.1.0's config", flow: 32.2, seq: null, cls: 20.1 },
  { label: "DOMPurify", what: "sanitising label HTML and the finished SVG", flow: 12.2, seq: 12.1, cls: 12.6 },
  { label: "DOM measuring", what: "defaultMeasureLayout: insert nodes, read their boxes", flow: 13.1, seq: null, cls: 7.5 },
  { label: "parsing", what: "the generated flowchart parser", flow: 4.5, seq: null, cls: null },
  { label: "garbage collection", what: "", flow: 4.3, seq: 3.2, cls: 2.0 },
]

const COLS: { key: "flow" | "seq" | "cls"; label: string }[] = [
  { key: "flow", label: "flowchart" },
  { key: "seq", label: "sequence" },
  { key: "cls", label: "class" },
]

const COLOR = "oklch(0.58 0.04 260)"
const HOT = "oklch(0.64 0.17 40)"

export function WhereTimeGoes() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          mermaid@12.1.0 · share of CPU samples during warm renders
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">inclusive, rows overlap</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        {GROUPS.map((g, gi) => (
          <div key={g.label}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px] text-foreground">{g.label}</span>
              {g.what ? <span className="text-xs text-muted-foreground">{g.what}</span> : null}
            </div>
            <div className="mt-1 space-y-0.5">
              {COLS.map((c) => {
                const v = g[c.key]
                return (
                  <div key={c.key} className="grid grid-cols-[4.5rem_1fr_2.75rem] items-center gap-2">
                    <span className="text-right font-mono text-[9px] text-muted-foreground">{c.label}</span>
                    <div className="h-2 rounded-sm bg-muted/40">
                      {v !== null ? (
                        <div
                          className="h-2 rounded-sm"
                          style={{ width: `${v}%`, background: gi === 0 ? HOT : COLOR }}
                        />
                      ) : null}
                    </div>
                    <span className="text-right font-mono text-[10px] tabular-nums">
                      {v !== null ? `${v}%` : "—"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <p className="mb-0 text-sm leading-6 text-muted-foreground">
          The biggest single cost is not layout and not the DOM. It is copying the configuration object:
          every <code className="font-mono text-[0.9em]">getConfig()</code> returns a fresh deep merge of the
          whole config, theme variables included, and the build calls it from 258 places. Pele has no such
          object to copy; its colours are CSS variables the browser resolves at paint time.
        </p>
      </div>
    </figure>
  )
}
