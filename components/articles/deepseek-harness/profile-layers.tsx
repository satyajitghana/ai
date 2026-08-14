"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What `dsh --profile <name> --dump-config` actually composes.
//
// Every number here was parsed out of the three committed bundle patches at
// 47f9438 (packages/bundle/{base,web-app,headless}/cordis.patch.yml), not read
// off the prose:
//
//   base      one `insert` of 78 rows, 78 unique ids, no overrides
//   web-app   51 further rows inserted, 27 base rows re-configured
//   headless   3 further rows inserted,  3 base rows re-configured
//
// Every override id in both mode bundles resolves to a row base inserted —
// checked, zero dangling targets. An override replaces the targeted row's whole
// `config`; it never adds a row. So the final row count is base + inserts, and
// the override count is how much of base each mode rewrites.

const BASE = 78

type Mode = "web" | "headless"

const MODES: Record<Mode, { label: string; bundle: string; insert: number; over: number; blurb: string }> = {
  web: {
    label: "web",
    bundle: "dsh-web-app",
    insert: 51,
    over: 27,
    blurb:
      "The browser application: an HTTP server, the whole client UI surface, the tool set a coding agent expects. It rewrites a quarter of base — the system prompt gets a persona, the tool rows get real configs, session storage moves to SQLite.",
  },
  headless: {
    label: "headless",
    bundle: "dsh-headless",
    insert: 3,
    over: 3,
    blurb:
      "A one-shot runner with no server at all. Three rows added, three rewritten — and one of the three it rewrites is the tool registry. Headless is very nearly bare base, which is the clearest evidence that base really is the shared core rather than the web product with bits switched off.",
  },
}

const ACCENT = "oklch(0.60 0.15 255)"
const OVER = "oklch(0.68 0.13 85)"
const MUT = "oklch(0.62 0.03 250)"

export function ProfileLayers() {
  const [mode, setMode] = useState<Mode>("web")
  const m = MODES[mode]
  const total = BASE + m.insert
  const untouched = BASE - m.over

  // widths of the stacked bar, as percentages of the larger of the two totals
  const scale = BASE + MODES.web.insert

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">config rows composed at boot</span>
        <div className="flex gap-1">
          {(Object.keys(MODES) as Mode[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              --profile {k}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* the layer stack */}
        <div className="space-y-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-foreground">dsh-base</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                one insert · {BASE} rows
              </span>
            </div>
            <div className="mt-1.5 flex h-3 overflow-hidden rounded-sm bg-muted/40">
              <div style={{ width: `${(untouched / scale) * 100}%`, background: MUT }} />
              <div style={{ width: `${(m.over / scale) * 100}%`, background: OVER }} />
            </div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">
              model adapters, tools, persistence, sandbox and approval policy, settings, credentials, telemetry
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-foreground">{m.bundle}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                +{m.insert} rows · {m.over} base rows re-configured
              </span>
            </div>
            <div className="mt-1.5 flex h-3 overflow-hidden rounded-sm bg-muted/40">
              <div style={{ width: `${(m.insert / scale) * 100}%`, background: ACCENT }} />
            </div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">{m.blurb}</div>
          </div>

          <div className="rounded-lg border border-dashed px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                profile cordis.patch.yml → home patch → --patch overlay
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">yours, last write wins</span>
            </div>
          </div>
        </div>

        {/* legend + totals */}
        <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {[
            { c: MUT, k: `${untouched}`, v: "base rows kept as-is" },
            { c: OVER, k: `${m.over}`, v: "base rows re-configured" },
            { c: ACCENT, k: `${m.insert}`, v: "rows this mode adds" },
          ].map((s) => (
            <div key={s.v} className="rounded-lg border bg-muted/15 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.c }} />
                <span className="truncate">{s.v}</span>
              </div>
              <div className="font-mono text-sm tabular-nums text-foreground">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2">
          <span className="font-mono text-[11px]" style={{ color: ACCENT }}>
            --profile {m.label} boots {total} rows
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A patch targets a row by id and replaces its whole{" "}
          <span className="font-mono text-foreground">config</span>, so a value that differs between modes cannot
          live in base — it belongs to each mode bundle, which restates the row completely. That rule is written
          into base&rsquo;s own header comment, and it is why headless is so small: it is not base minus the web
          bits, it is base plus three. The layering ends with files you own, so any row the vendor shipped is a row
          you can replace without forking anything.
        </p>
      </div>
    </figure>
  )
}
