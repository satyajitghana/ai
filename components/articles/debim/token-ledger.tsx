"use client"

// What fits in a context window. Every number here is MEASURED on this site's
// run (2026-11-09): four public IFC samples that ship in debim's own
// tests/fixtures (buildingSMART's Building-* trio and the Duplex_A model), each
// tokenised whole with tiktoken's o200k_base; the repo's own estimate
// (file bytes / 3.5, the formula in tools/kaggle/debim_kaggle_stress_test.py);
// and a bounding-box manifest I wrote with my own script, one YAML record per
// physical element in the shape of debim's catch-all IfcCustomElement (class,
// tag, source, position, width/depth/height, layer). That last column is NOT
// debim's output: the sandbox refused to run the cloned importer, so it stands
// in for the floor of what an element-per-record text costs. SSR-safe: plain
// state, no transcendental maths.

import { useState } from "react"

type Row = {
  file: string
  bytes: number
  ifc: number // o200k_base tokens of the whole IFC text
  est: number // bytes / 3.5, the repo's estimate
  box: number // o200k_base tokens of my bounding-box YAML
  elements: number
}

const ROWS: Row[] = [
  { file: "Building-Hvac.ifc", bytes: 111375, ifc: 54929, est: 31821, box: 494, elements: 6 },
  { file: "Building-Architecture.ifc", bytes: 142325, ifc: 69273, est: 40664, box: 1109, elements: 13 },
  { file: "Building-Structural.ifc", bytes: 185185, ifc: 90370, est: 52910, box: 1578, elements: 17 },
  { file: "Duplex_A_20110907.ifc", bytes: 2380763, ifc: 1029326, est: 680218, box: 27580, elements: 218 },
]

const WINDOWS = [
  { id: "128k", n: 128000 },
  { id: "200k", n: 200000 },
  { id: "1M", n: 1000000 },
]

const fmt = (n: number) => n.toLocaleString("en-US")

export function TokenLedger() {
  const [w, setW] = useState(1)
  const win = WINDOWS[w].n
  const max = 1100000
  const px = (n: number) => `${Math.max(0.4, (n / max) * 100)}%`
  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      aria-label="Token counts of four IFC files against their bounding-box manifests"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>token ledger · o200k_base</span>
        <span className="text-muted-foreground/60">measured</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">context window:</span>
          {WINDOWS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setW(i)}
              aria-pressed={i === w}
              className={
                "rounded-md border px-2 py-0.5 " +
                (i === w ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
              }
            >
              {x.id}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {ROWS.map((r) => {
            const fits = r.ifc <= win
            return (
              <div key={r.file} className="space-y-1">
                <div className="flex flex-wrap justify-between gap-x-3 font-mono text-xs">
                  <span>{r.file}</span>
                  <span className="text-muted-foreground">
                    {fmt(r.bytes)} B · {r.elements} elements
                  </span>
                </div>
                <div className="relative h-3 rounded bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded bg-sky-500/70" style={{ width: px(r.ifc) }} />
                  <div
                    className="absolute inset-y-0 w-px bg-foreground"
                    style={{ left: `${(win / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="relative h-2 rounded bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded bg-amber-500/80" style={{ width: px(r.est) }} />
                </div>
                <div className="relative h-2 rounded bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded bg-emerald-500/80" style={{ width: px(r.box) }} />
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 font-mono text-[11px] text-muted-foreground">
                  <span>
                    IFC {fmt(r.ifc)} · bytes/3.5 says {fmt(r.est)} · boxes {fmt(r.box)}
                  </span>
                  <span className={fits ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    raw IFC {fits ? "fits" : "does not fit"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded bg-sky-500/70 align-middle" />
            whole IFC, real tokens
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded bg-amber-500/80 align-middle" />
            the repo&apos;s bytes/3.5 estimate
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded bg-emerald-500/80 align-middle" />
            one box record per element (my script)
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-px bg-foreground align-middle" /> window
          </span>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Bars share one scale, so the three small files are slivers next to the Duplex. The real tokenizer counts 1.51 to 1.73
          times what bytes/3.5 predicts on IFC, because STEP text is dense with short numbers and punctuation. The green bar is my
          stand-in, not debim&apos;s output: the importer itself was not run here.
        </p>
      </div>
    </figure>
  )
}
