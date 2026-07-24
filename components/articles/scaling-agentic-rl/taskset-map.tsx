"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Scaling Agentic RL — the catalog as a map. One contract (verifiers v1's Harbor
// taskset format) sits over three agentic domains; each domain fans out to its
// tasksets. Pick a domain and its tasksets appear on the right, each with a bar
// whose length is proportional to √(tasks) so the small ones stay visible; the
// exact count is always labelled. Counts are the per-taskset figures Prime
// Intellect displays (shipped/integrated totals). Illustrative.

const ACCENT = "oklch(0.66 0.14 195)"

type Domain = "swe" | "terminal" | "search"

type Taskset = { name: string; count: number; label: string }

const DATA: Record<Domain, { label: string; total: string; note: string; sets: Taskset[] }> = {
  swe: {
    label: "Software Engineering",
    total: "~198k",
    note: "20+ languages",
    sets: [
      { name: "swesmith", count: 83519, label: "83,519" },
      { name: "openswe", count: 36884, label: "36,884" },
      { name: "swerebench_v2", count: 32079, label: "32,079" },
      { name: "scaleswe", count: 17202, label: "17,202" },
      { name: "swelego", count: 15903, label: "15,903" },
      { name: "multiswe", count: 6835, label: "6,835" },
      { name: "r2e_gym", count: 4578, label: "4,578" },
      { name: "swebench_pro", count: 731, label: "731" },
      { name: "swebench_verified", count: 500, label: "500" },
      { name: "swebench_multilingual", count: 300, label: "300" },
      { name: "senior_swe_bench", count: 50, label: "50" },
    ],
  },
  terminal: {
    label: "Terminal",
    total: "~28.6k",
    note: "shell / CLI tasks",
    sets: [
      { name: "tmax", count: 14600, label: "14,600" },
      { name: "terminal_lego", count: 13800, label: "~13,800" },
      { name: "openthoughts_tblite", count: 100, label: "100" },
      { name: "terminal_bench_2", count: 89, label: "89" },
    ],
  },
  search: {
    label: "Search",
    total: "~137.6k",
    note: "tool-free · bring your own retriever",
    sets: [
      { name: "papersearchqa", count: 59907, label: "59,907" },
      { name: "wideseek", count: 44632, label: "44,632" },
      { name: "s1_deepresearch", count: 15000, label: "~15,000" },
      { name: "openseeker", count: 11677, label: "11,677" },
      { name: "deepdive", count: 3250, label: "3,250" },
      { name: "browsecomp", count: 1266, label: "1,266" },
      { name: "redsearcher", count: 1000, label: "1,000" },
      { name: "browsecomp_plus", count: 830, label: "830" },
    ],
  },
}

const ORDER: Domain[] = ["swe", "terminal", "search"]

const W = 902
const H = 520

// left column geometry
const HUB = { x: 28, y: 20, w: 200, h: 46 }
const DOM = { x: 40, w: 196, h: 44 }
const DOM_Y: Record<Domain, number> = { swe: 100, terminal: 158, search: 216 }

// right column (taskset rows)
const ROW_ANCHOR = 300 // where connectors land
const NAME_X = 308
const TRACK_X0 = 476
const TRACK_X1 = 824
const TRACK_W = TRACK_X1 - TRACK_X0
const COUNT_X = 832
const ROW_TOP = 40
const ROW_H = 42

function vpath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function TasksetMap() {
  const [domain, setDomain] = useState<Domain>("swe")
  const active = DATA[domain]
  const maxCount = Math.max(...active.sets.map((s) => s.count))
  const domCy = DOM_Y[domain] + DOM.h / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>23 tasksets · one contract · ~365k tasks</span>
        <span className="text-muted-foreground/50">bar ∝ √tasks</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Map of Prime Intellect's agentic taskset catalog. One taskset contract over three domains — Software Engineering (~198k tasks), Terminal (~28.6k), and Search (~137.6k). Showing the ${active.label} domain: ${active.sets.map((s) => `${s.name} ${s.label}`).join(", ")}.`}
        >
          <defs>
            <marker id="tm-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="tm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* hub → domain connectors */}
          {ORDER.map((d) => {
            const sel = d === domain
            return (
              <path
                key={`hc-${d}`}
                d={vpath(HUB.x + HUB.w / 2, HUB.y + HUB.h, DOM.x, DOM_Y[d] + DOM.h / 2)}
                fill="none"
                stroke={sel ? ACCENT : "var(--muted-foreground)"}
                strokeWidth={sel ? 1.75 : 1.25}
                opacity={sel ? 0.8 : 0.3}
                className="transition-all duration-300"
              />
            )
          })}

          {/* selected domain → taskset row connectors */}
          {active.sets.map((s, i) => {
            const ry = ROW_TOP + ROW_H / 2 + i * ROW_H
            return (
              <path
                key={`rc-${s.name}`}
                d={vpath(DOM.x + DOM.w, domCy, ROW_ANCHOR, ry)}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.5}
                markerEnd="url(#tm-arrow)"
                opacity={0.55}
              />
            )
          })}

          {/* hub node */}
          <rect x={HUB.x} y={HUB.y} width={HUB.w} height={HUB.h} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#tm-soft)" />
          <text x={HUB.x + HUB.w / 2} y={HUB.y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            one taskset API
          </text>
          <text x={HUB.x + HUB.w / 2} y={HUB.y + 35} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            one Harbor contract
          </text>

          {/* domain nodes */}
          {ORDER.map((d) => {
            const sel = d === domain
            const dd = DATA[d]
            const y = DOM_Y[d]
            return (
              <g key={`dn-${d}`} className="transition-all duration-300">
                {sel ? (
                  <rect x={DOM.x} y={y} width={DOM.w} height={DOM.h} rx={9} fill={ACCENT} opacity={0.09} />
                ) : null}
                <rect
                  x={DOM.x}
                  y={y}
                  width={DOM.w}
                  height={DOM.h}
                  rx={9}
                  fill="var(--background)"
                  fillOpacity={sel ? 0 : 1}
                  stroke={sel ? ACCENT : "var(--border)"}
                  strokeWidth={sel ? 1.75 : 1.5}
                  opacity={sel ? 1 : 0.6}
                  filter={sel ? "url(#tm-soft)" : undefined}
                />
                <text x={DOM.x + 12} y={y + 19} className="fill-foreground font-mono" fontSize={11} fontWeight={sel ? 600 : 400} opacity={sel ? 1 : 0.7}>
                  {dd.label}
                </text>
                <text x={DOM.x + 12} y={y + 34} className="fill-muted-foreground font-mono" fontSize={9}>
                  {dd.total} · {dd.note}
                </text>
              </g>
            )
          })}

          {/* taskset rows for the selected domain */}
          {active.sets.map((s, i) => {
            const ry = ROW_TOP + ROW_H / 2 + i * ROW_H
            const barW = Number(Math.max(6, Math.sqrt(s.count / maxCount) * TRACK_W).toFixed(2))
            return (
              <g key={`row-${s.name}`}>
                <rect x={TRACK_X0} y={ry - 9} width={TRACK_W} height={18} rx={9} fill="var(--muted)" opacity={0.3} />
                <rect x={TRACK_X0} y={ry - 9} width={barW} height={18} rx={9} fill={ACCENT} opacity={0.85} />
                <text x={NAME_X} y={ry + 4} className="fill-foreground font-mono" fontSize={10}>
                  {s.name}
                </text>
                <text x={COUNT_X} y={ry + 4} className="fill-muted-foreground font-mono tabular-nums" fontSize={10}>
                  {s.label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">domain</span>
            {ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDomain(d)}
                aria-pressed={domain === d}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  domain === d ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={domain === d ? { background: ACCENT } : undefined}
              >
                {DATA[d].label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {active.sets.length} tasksets · <span style={{ color: ACCENT }}>{active.total}</span> tasks
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every taskset loads through the <span className="text-foreground">same</span> contract — a typed config, a
          sandbox from the task&apos;s own prebuilt image, and the taskset&apos;s own upstream grader — so one agent can
          train across all three domains without a bespoke harness per dataset.
        </p>
      </div>
    </figure>
  )
}
