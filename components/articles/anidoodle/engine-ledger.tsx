"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Counted with wc / grep / find on two checkouts: the vendored skill in this repo (brand-crew/skills/hand-drawn-canvas-animation)
// and anidoodle at commit 9c20e77 (2026-10-31). Nothing here was rendered; these are sizes, not speeds.
const METRICS = [
  {
    id: "src",
    label: "Drawing code (bytes)",
    a: 177880,
    b: 3291767,
    note: "Vendored: assets/*.js (core, paper3d, roto, sand). anidoodle: every .ts in engine/src/canvas-core.",
  },
  {
    id: "files",
    label: "Art modules (files)",
    a: 4,
    b: 191,
    note: "Vendored: four JS files in assets/. anidoodle: 191 .ts files in canvas-core, plus 11 in three-core and a page host per film.",
  },
  {
    id: "docs",
    label: "Documentation (words)",
    a: 17445,
    b: 44695,
    note: "Vendored: SKILL.md and references/*.md. anidoodle: SKILL.md, references/*.md and references/workflows/*.md.",
  },
  {
    id: "looks",
    label: "Distinct looks",
    a: 5,
    b: 32,
    note: "Vendored: five looks in one core. anidoodle: 32 hands after folding draw-film variants (see the count below).",
  },
  {
    id: "tests",
    label: "Test and fixture files",
    a: 0,
    b: 104,
    note: "Vendored: no test directory ships. anidoodle: 104 files under engine/test.",
  },
] as const

export function EngineLedger() {
  const [id, setId] = useState<(typeof METRICS)[number]["id"]>("src")
  const m = METRICS.find((x) => x.id === id) ?? METRICS[0]
  const max = Math.max(m.a, m.b)
  const row = (label: string, v: number, tone: string) => (
    <div className="mt-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono">{v.toLocaleString("en-US")}</span>
      </div>
      <div className="mt-1 h-3 rounded bg-muted">
        <div className={cn("h-3 rounded", tone)} style={{ width: `${Math.max(0.5, (v / max) * 100).toFixed(2)}%` }} />
      </div>
    </div>
  )
  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {METRICS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === id}
            onClick={() => setId(x.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              x.id === id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      {row("hand-drawn-canvas-animation (vendored here)", m.a, "bg-amber-500")}
      {row("anidoodle", m.b, "bg-sky-600")}
      <p className="mt-3 text-sm text-muted-foreground">
        {m.note} Ratio: {m.a > 0 ? `${(m.b / m.a).toFixed(1)}x` : "not defined (zero on one side)"}.
      </p>
      <figcaption className="mt-2 text-xs text-muted-foreground">Measured with wc, grep and find. Size is not quality; it is how much there is to read before you trust it.</figcaption>
    </figure>
  )
}
