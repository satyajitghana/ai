"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"

import { AXES_BY_MODEL, GRID_BY_MODEL, GRID_DOSES, type ModelKey } from "./data"

// Both widgets draw data.ts: the output of scripts/neuron-lab/data_discover.py and data_steergrid.py for each model.
// Nothing is interpolated except the lines between measured doses.

const ACCENT = "oklch(0.65 0.16 55)"
const VIOLET = "oklch(0.6 0.16 295)"
const fmt = (v: number | null) => (v == null ? "n/a" : String(v))
const dose = (d: number) => `${d < 0 ? "−" : "+"}${Math.abs(d)}`
const KEYS: { key: ModelKey; label: string }[] = [
  { key: "qwen3-0.6b", label: "Qwen3-0.6B" },
  { key: "qwen3.5-0.8b", label: "Qwen3.5-0.8B" },
]

function ModelTabs({ model, set }: { model: ModelKey; set: (m: ModelKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Model">
      {KEYS.map((k) => (
        <button key={k.key} aria-pressed={k.key === model} onClick={() => set(k.key)} className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", k.key === model ? "border-foreground bg-muted" : "text-muted-foreground hover:text-foreground")}>
          {k.label}
        </button>
      ))}
    </div>
  )
}

export function AxisResults() {
  const [model, setModel] = useState<ModelKey>("qwen3-0.6b")
  const AXES = AXES_BY_MODEL[model]
  const [open, setOpen] = useState("bridges")
  const cur = AXES.find((a) => a.axis === open) ?? AXES[0]
  const worked = AXES.filter((a) => a.works).map((a) => a.replicated).sort((a, b) => a - b)
  const missed = AXES.filter((a) => !a.works).map((a) => a.replicated).sort((a, b) => a - b)
  const W = 520
  const sx = (n: number) => 20 + (n / 40) * (W - 40)
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        axes searched on each model: which ones gave a neuron that works (measured)
      </div>
      <div className="space-y-3 px-4 py-3">
        <ModelTabs model={model} set={(m) => { setModel(m); setOpen(AXES_BY_MODEL[m][0].axis) }} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">axis</th>
                <th className="py-1 pr-2 font-normal">held up of 40</th>
                <th className="py-1 pr-2 font-normal">largest d&apos;</th>
                <th className="py-1 font-normal">result</th>
              </tr>
            </thead>
            <tbody>
              {AXES.map((a) => {
                const singles = a.found.filter((f) => !f.pair).length
                const pairs = a.found.length - singles
                return (
                  <tr key={a.axis} className={cn("cursor-pointer border-t", a.axis === cur.axis && "bg-muted")} onClick={() => setOpen(a.axis)}>
                    <td className="py-1 pr-2">
                      <button className="text-left" aria-pressed={a.axis === cur.axis} onClick={() => setOpen(a.axis)}>
                        {a.label}
                      </button>
                    </td>
                    <td className="py-1 pr-2 font-mono tabular-nums">{a.replicated}</td>
                    <td className="py-1 pr-2 font-mono tabular-nums">{a.topD}</td>
                    <td className="py-1" style={{ color: a.works ? ACCENT : VIOLET }}>
                      {a.works ? `${singles} ${singles === 1 ? "neuron" : "neurons"}${pairs ? `, ${pairs} ${pairs === 1 ? "pair" : "pairs"}` : ""}` : "none"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <svg viewBox={`0 0 ${W} 74`} className="w-full" role="img" aria-label={`Each axis placed by how many of its 40 strongest contrasts held up. Axes with a working neuron sit at ${worked.join(", ")}; axes with none sit at ${missed.join(", ")}.`}>
          <line x1={20} x2={W - 20} y1={34} y2={34} stroke="currentColor" opacity={0.25} />
          {[0, 10, 20, 30, 40].map((n) => (
            <g key={n}>
              <line x1={sx(n)} x2={sx(n)} y1={30} y2={38} stroke="currentColor" opacity={0.35} />
              <text x={sx(n)} y={52} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>{n}</text>
            </g>
          ))}
          {AXES.map((a, i) => {
            const stack = AXES.slice(0, i).filter((b) => b.replicated === a.replicated && b.works === a.works).length
            return (
              <circle key={a.axis} cx={sx(a.replicated)} cy={a.works ? 25 - stack * 9 : 43 + stack * 9} r={4} fill={a.works ? ACCENT : VIOLET} opacity={a.axis === cur.axis ? 1 : 0.55} stroke={a.axis === cur.axis ? "currentColor" : "none"}>
                <title>{`${a.label}: ${a.replicated} of 40`}</title>
              </circle>
            )
          })}
          <text x={W - 20} y={12} textAnchor="end" fontSize={9} fill={ACCENT}>worked</text>
          <text x={W - 20} y={70} textAnchor="end" fontSize={9} fill={VIOLET}>nothing worked</text>
          <text x={20} y={70} fontSize={9} fill="currentColor" opacity={0.6}>how many of the 40 strongest contrasts held up on the held-out half</text>
        </svg>
        <div className="border-t pt-3 text-xs leading-5">
          <div className="font-medium">{cur.label}</div>
          <p className="text-muted-foreground">
            {cur.nA} texts with the idea against {cur.nB} without. Random neurons have a mean |d&apos;| of {cur.randMean}; the largest was {cur.topD}. In screening ({cur.screened} candidates against {cur.screened} random neurons), the best random neuron lifted the score by {fmt(cur.stage1ControlBest)}.
          </p>
          {cur.found.length ? (
            <ul className="mt-2 space-y-1">
              {cur.found.map((f) => {
                const loops = f.rep != null && f.repBase != null && f.rep - f.repBase >= 10
                return (
                  <li key={f.id} className="font-mono text-[11px]">
                    <a href={f.link} className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
                      {f.neurons.map((n) => `L${n[0]} N${n[1]} ${dose(n[2])}`).join(" + ")}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      {f.pair ? "pair, " : ""}lift {fmt(f.lift)} (needs {fmt(f.minLift)}), best random {fmt(f.random)}, perplexity {fmt(f.ppl)} against {fmt(f.basePpl)}
                      {f.rep != null ? <span style={loops ? { color: ACCENT } : undefined}>, repeated trigrams {fmt(f.rep)}% against {fmt(f.repBase)}%</span> : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No neuron changed the output: none of the {cur.screened} screened, and none of those swept over doses, cleared the bar.</p>
          )}
          {cur.found.length && Math.max(...cur.found.map((f) => f.random ?? 0)) >= 5 ? (
            <p className="mt-2 text-muted-foreground">
              Caution: random neurons reach a lift of {fmt(Math.max(...cur.found.map((f) => f.random ?? 0)))} on this axis. A lift shows the push changes the text; it does not show the neuron is specific to the idea.
            </p>
          ) : null}
        </div>
      </div>
    </figure>
  )
}

export function PerplexityCliff() {
  const [model, setModel] = useState<ModelKey>("qwen3-0.6b")
  const GRID = GRID_BY_MODEL[model]
  const [i, setI] = useState(6)
  const d = GRID_DOSES[i]
  const base = GRID[0].ppl[0]
  const all = GRID.flatMap((g) => g.ppl)
  const lo = Math.floor(Math.min(...all) * 0.8)
  const hi = Math.max(...all) * 1.3
  const W = 520
  const H = 190
  const x = (k: number) => 38 + (k / (GRID_DOSES.length - 1)) * (W - 60)
  const y = (p: number) => H - 24 - ((mlog10(p) - mlog10(lo)) / (mlog10(hi) - mlog10(lo))) * (H - 40)
  const line = (v: number[]) => v.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)} ${y(p).toFixed(1)}`).join(" ")
  const ticks = [10, 20, 50, 100, 300, 1000, 3000, 10000].filter((t) => t > lo && t < hi)
  const at = (dd: number) => GRID.map((g) => g.ppl[GRID_DOSES.indexOf(dd)])
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what a push costs: held-out perplexity by dose for the neurons in each model&apos;s steer grid (measured, log scale)
      </div>
      <div className="space-y-3 px-4 py-3">
        <ModelTabs model={model} set={(m) => { setModel(m) }} />
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Perplexity rises with dose. At dose 0.5 the ${GRID.length} neurons range from ${Math.min(...at(0.5))} to ${Math.max(...at(0.5))}; at dose 1.0 from ${Math.min(...at(1))} to ${Math.max(...at(1))}. Unsteered it is ${base}.`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={38} x2={W - 22} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.1} />
              <text x={32} y={y(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>{v}</text>
            </g>
          ))}
          <line x1={38} x2={W - 22} y1={y(3 * base)} y2={y(3 * base)} stroke={ACCENT} strokeDasharray="4 3" opacity={0.7} />
          <text x={W - 22} y={y(3 * base) - 3} textAnchor="end" fontSize={9} fill={ACCENT}>3 &times; unsteered: the bar a recipe had to stay under</text>
          {GRID.map((g, k) => (
            <path key={k} d={line(g.ppl)} fill="none" stroke={g.axis === "repeat" ? VIOLET : "currentColor"} strokeWidth={g.axis === "bridges" ? 2.2 : 1.2} opacity={g.axis === "bridges" || g.axis === "repeat" ? 0.9 : 0.4} />
          ))}
          <line x1={x(i)} x2={x(i)} y1={10} y2={H - 24} stroke={ACCENT} opacity={0.5} />
          {GRID_DOSES.map((dd, k) => (
            <text key={dd} x={x(k)} y={H - 8} textAnchor="middle" fontSize={9} fill="currentColor" opacity={k === i ? 1 : 0.6}>{dd}</text>
          ))}
        </svg>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-12 shrink-0 font-mono text-muted-foreground">dose</span>
          <Range className="w-full" min={0} max={GRID_DOSES.length - 1} step={1} value={i} onChange={(e) => setI(+e.target.value)} accent={ACCENT} aria-label="Dose" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{d}</span>
        </label>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
          {GRID.map((g, k) => (
            <li key={k} className="flex justify-between gap-2 font-mono">
              <span className={cn(g.axis === "bridges" ? "font-medium" : "text-muted-foreground")}>{g.axis} L{g.layer} N{g.neuron}</span>
              <span className="tabular-nums">{g.ppl[i]}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">
          Unsteered perplexity is {base}. Every neuron gets worse text as the dose grows, and the repetition neurons (violet, 0.6B only) go furthest. Most recipes were found between about 0.1 and 0.5, which is where the text is still readable.
        </p>
      </div>
    </figure>
  )
}
