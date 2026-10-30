"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A schematic of the lab page (not a screenshot): the four regions and what each one does. Positions are literal
// SVG coordinates, so the markup is identical on the server and the client.

const PARTS = [
  { id: "bar", n: 1, name: "Top bar", x: 8, y: 8, w: 624, h: 30, text: "Switch between the 3D map and a flat grid, pick a layer, jump to a neuron by id (L16 N477), or search a word. lens finds neurons whose output pushes toward that word; fires finds neurons that light up on text containing it." },
  { id: "list", n: 2, name: "Neuron list", x: 8, y: 46, w: 150, h: 300, text: "Every match for the word, with +1 where the neuron promotes it and −1 where it suppresses it. Before you search, it holds suggestions and the recipes we found." },
  { id: "map", n: 3, name: "Map", x: 166, y: 46, w: 270, h: 300, text: "Each layer is a slab and each neuron a dot, in index order. The strongest neurons of a layer are brighter, matches are amber (promote) and violet (suppress), and thin lines run from the selected neuron to the neurons it feeds or is fed by. Drag to orbit, scroll to zoom." },
  { id: "steer", n: 4, name: "Steer", x: 444, y: 46, w: 188, h: 148, text: "Your recipe: up to four neurons, each with a dose slider that says in plain numbers what it does. Add a prompt, press Run, and read three answers side by side: minus the dose, unchanged, and plus the dose." },
  { id: "tabs", n: 5, name: "Details, Investigate, Find", x: 444, y: 202, w: 188, h: 144, text: "Details shows a neuron's numbers, the texts that fire it and its links. Investigate runs fixed tools over the data (no AI agent). Find ranks neurons for an idea you describe with two sets of example sentences." },
] as const

export function LabAnatomy() {
  const [active, setActive] = useState<string>("map")
  const cur = PARTS.find((p) => p.id === active) ?? PARTS[2]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">the lab page, region by region (schematic)</div>
      <div className="px-4 py-3">
        <svg viewBox="0 0 640 354" role="img" aria-label="Schematic of the neuron lab: a top bar, a neuron list on the left, the map in the middle, and the steering and details panels on the right." className="w-full">
          {PARTS.map((p) => {
            const on = p.id === active
            return (
              <g key={p.id} className="cursor-pointer" onClick={() => setActive(p.id)}>
                <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={6} fill={on ? "oklch(0.65 0.16 55 / 0.14)" : "oklch(0.6 0.02 255 / 0.08)"} stroke={on ? "oklch(0.65 0.16 55)" : "oklch(0.6 0.02 255 / 0.5)"} strokeWidth={on ? 2 : 1} />
                <circle cx={p.x + 14} cy={p.y + 14} r={9} fill={on ? "oklch(0.65 0.16 55)" : "oklch(0.55 0.02 255)"} />
                <text x={p.x + 14} y={p.y + 18} textAnchor="middle" fontSize={11} fill="white" fontWeight={600}>{p.n}</text>
                <text x={p.x + 30} y={p.y + 18} fontSize={11} fill="currentColor" opacity={0.8}>{p.name}</text>
              </g>
            )
          })}
          {/* a few slabs and dots so the map region reads as a map */}
          {[0, 1, 2, 3].map((i) => (
            <polygon key={i} points={`${208 + i * 26},${110 + i * 4} ${300 + i * 26},${96 + i * 4} ${300 + i * 26},${248 + i * 4} ${208 + i * 26},${262 + i * 4}`} fill="none" stroke="oklch(0.6 0.02 255 / 0.45)" strokeWidth={1} />
          ))}
          {[[240, 150], [262, 190], [226, 214], [284, 170], [300, 220], [268, 132]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3} fill={i % 2 ? "oklch(0.62 0.17 295)" : "oklch(0.7 0.15 65)"} />
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Regions">
          {PARTS.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === active} onClick={() => setActive(p.id)} className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", p.id === active ? "border-foreground bg-muted" : "text-muted-foreground hover:text-foreground")}>
              {p.n} {p.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5">
          <span className="font-medium">{cur.n}. {cur.name}.</span> {cur.text}
        </p>
      </div>
    </figure>
  )
}
