"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// How big the bispectrum of one image is, full against selective.
// Image on the torus: the group is C_side x C_side, |G| = side^2. TorusOnTorus(selective=False)
// keeps the upper triangle, |G|(|G|+1)/2 complex entries (its Table 3 row: 1,024 -> 524,800);
// selective keeps |G| (1,024 -> 1,024). The library stores complex64: 8 bytes per entry.
// Sphere: counts are the paper's Table 5 (augmented selective vs the full set SO3onS2(selective=False)
// computes), not a formula, so only the band limits the paper lists are offered.

const SIDES = [8, 16, 32, 64, 128, 256, 512]
const SPHERE = [
  { L: 4, sel: 32, full: 42 },
  { L: 5, sel: 52, full: 69 },
  { L: 15, sel: 380, full: 1124 },
  { L: 16, sel: 426, full: 1341 },
]
const GPU24 = 24e9
const GPU80 = 80e9

function bytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
  return `${b} B`
}

export function SizeCalc() {
  const [si, setSi] = useState(5)
  const side = SIDES[si]
  const G = side * side
  const full = (G * (G + 1)) / 2
  const sel = G
  const bFull = full * 8
  const bSel = sel * 8
  const top = mlog10(GPU80 * 4)
  const w = (b: number) => Math.max(0.5, (mlog10(Math.max(b, 1)) / top) * 100)

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">One image&apos;s bispectrum, full against selective (complex64, 8 bytes an entry)</figcaption>
      <label className="block">
        <span className="text-muted-foreground">
          Image side: <span className="font-mono text-foreground">{side} × {side}</span> pixels, so |G| ={" "}
          <span className="font-mono text-foreground">{G.toLocaleString("en-US")}</span> translations
        </span>
        <Range min={0} max={SIDES.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} className="w-full" aria-label="Image side" />
      </label>

      <div className="relative mt-4 mb-5 space-y-3">
        {[
          { label: "Full: every pair of frequencies", n: full, b: bFull, tone: "bg-slate-500/80" },
          { label: "Selective: one product per pixel", n: sel, b: bSel, tone: "bg-orange-600/85" },
        ].map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{r.label}</span>
              <span className="font-mono text-foreground">
                {r.n.toLocaleString("en-US")} entries · {bytes(r.b)}
              </span>
            </div>
            <div className="mt-1 h-4 w-full rounded bg-muted">
              <div className={cn("h-4 rounded", r.tone)} style={{ width: `${w(r.b)}%` }} />
            </div>
          </div>
        ))}
        {[
          { b: GPU24, label: "24 GB", side: "right-full mr-1" },
          { b: GPU80, label: "80 GB", side: "left-full ml-1" },
        ].map((g) => (
          <div key={g.label} className="pointer-events-none absolute top-5 bottom-0" style={{ left: `${w(g.b)}%` }}>
            <div className="h-full border-l border-dashed border-red-500/70" />
            <span className={cn("absolute -bottom-4 whitespace-nowrap font-mono text-[10px] text-red-600 dark:text-red-400", g.side)}>{g.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Log scale; the dashed lines are a 24 GB and an 80 GB card. {bFull > GPU24 ? "The full bispectrum of this one image no longer fits on a 24 GB card." : ""} Full is {Math.floor(full / sel).toLocaleString("en-US")}× the selective size at this side, and the ratio is (|G| + 1) / 2, so it doubles every time the pixel count doubles.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-normal">Sphere, band limit L</th>
              <th className="py-1 pr-3 font-normal">augmented selective</th>
              <th className="py-1 pr-3 font-normal">full</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {SPHERE.map((s) => (
              <tr key={s.L} className="border-t border-border">
                <td className="py-1 pr-3">{s.L}</td>
                <td className="py-1 pr-3">{s.sel.toLocaleString("en-US")}</td>
                <td className="py-1 pr-3">{s.full.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted-foreground">The sphere&apos;s counts are the paper&apos;s Table 5. There the saving is a power of L, not of the pixel count, so it is modest at the classifier&apos;s L = 15.</p>
      </div>
    </figure>
  )
}
