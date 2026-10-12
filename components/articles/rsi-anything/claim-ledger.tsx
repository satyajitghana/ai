"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import {
  CODE_BARS,
  CODE_PAIRED,
  CODE_SEEDS,
  CODE_TRANSFER,
  GUI_CROSS,
  GUI_RULE,
  LAB_REFS,
  LAB_VERSIONS,
  RXN_BO,
  RXN_PAPER,
  RXN_POOL_BEST,
  RXN_RELEASE,
} from "@/components/articles/rsi-anything/data"

// The four launch numbers, each next to the comparison that decides what it
// means. Code repair: the bars with the paper's one paired interval and the
// per-seed spread of the released checkpoint. GUI: the crossed policy x world
// evaluation from RESULTS.md, under either controller. Lab: the five versions
// against Table 3's references. Reaction: the 40-experiment race with the
// pool's ceiling drawn in. Only + - * / are used for coordinates.

const ACC = "oklch(0.60 0.13 160)"
const BASE = "oklch(0.60 0.02 260)"
const WARN = "oklch(0.62 0.19 25)"
const ALT = "oklch(0.70 0.14 75)"

type Tab = "code" | "gui" | "lab" | "rxn"
const TABS: { id: Tab; label: string; claim: string }[] = [
  { id: "code", label: "Code repair", claim: "26.3% → 31.2%, with the coder fixed" },
  { id: "gui", label: "GUI agent", claim: "39.4% fewer actions, with higher completion" },
  { id: "lab", label: "Lab planning", claim: "21.80% → 46.01% over five policy versions" },
  { id: "rxn", label: "Reaction yield", claim: "96.15% vs 82.16% for Bayesian optimization, 40 experiments" },
]

export function ClaimLedger() {
  const [tab, setTab] = useState<Tab>("code")
  const t = TABS.find((x) => x.id === tab) ?? TABS[0]
  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 font-heading text-sm font-semibold">Four headline numbers, each with what it is measured against</div>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Claim">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === tab}
            onClick={() => setTab(x.id)}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (x.id === tab ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="mb-3 font-mono text-xs text-muted-foreground">launch post: “{t.claim}”</div>
      {tab === "code" && <CodePanel />}
      {tab === "gui" && <GuiPanel />}
      {tab === "lab" && <LabPanel />}
      {tab === "rxn" && <RxnPanel />}
    </div>
  )
}

function CodePanel() {
  const [seeds, setSeeds] = useState(false)
  const W = 600
  const L = 150
  const R = 60
  const x0 = 20
  const x1 = 36
  const xOf = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R)
  const rowH = 30
  const H = CODE_BARS.length * rowH + 40
  const seedPct = CODE_SEEDS.map((s) => s / 2)
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={seeds} onChange={(e) => setSeeds(e.target.checked)} />
        <span>show the released checkpoint&apos;s three seeds (69, 62 and 57 of 200)</span>
      </label>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="CodeContests hidden-test success for four selection methods">
          {[20, 24, 28, 32, 36].map((v) => (
            <g key={v}>
              <line x1={xOf(v)} x2={xOf(v)} y1={6} y2={H - 26} stroke="currentColor" strokeOpacity={0.12} />
              <text x={xOf(v)} y={H - 10} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.6}>
                {v}%
              </text>
            </g>
          ))}
          {CODE_BARS.map((b, i) => {
            const y = 20 + i * rowH
            const rsi = i >= 2
            return (
              <g key={b.label}>
                <text x={L - 8} y={y + 4} fontSize={11} textAnchor="end" fill="currentColor" fontWeight={rsi ? 700 : 400}>
                  {b.label}
                </text>
                <rect x={xOf(x0)} y={y - 8} width={xOf(b.value) - xOf(x0)} height={16} rx={3} fill={rsi ? ACC : BASE} opacity={0.85} />
                <text x={xOf(b.value) + 6} y={y + 4} fontSize={11} fill="currentColor">
                  {b.value.toFixed(1)}%
                </text>
                {i === 3 &&
                  seeds &&
                  seedPct.map((p, k) => (
                    <circle key={k} cx={xOf(p)} cy={y} r={4} fill="white" stroke={WARN} strokeWidth={2} />
                  ))}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-dashed p-3">
          The paper gives one interval: fixed world model over static verifier, paired, +{CODE_PAIRED.gain} points, 95% [{CODE_PAIRED.lo},{" "}
          {CODE_PAIRED.hi}]. The adaptation step, +2.0 points, gets none.
          {seeds && (
            <span>
              {" "}
              The released checkpoint scores {seedPct.join("%, ")}% across its seeds: a {(seedPct[0] - seedPct[2]).toFixed(1)}-point
              spread, wider than the step it is meant to show.
            </span>
          )}
        </div>
        <div className="rounded-md border border-dashed p-3">
          <div className="font-mono text-xs text-muted-foreground">transfer, 3 seeds, same coder</div>
          {CODE_TRANSFER.map((r) => (
            <div key={r.bench} className="mt-1 text-xs">
              {r.bench}: initial {r.initial}, random {r.random}, static {r.stat},{" "}
              <span className="font-semibold">RSI {r.rsi}</span>. Static verifier is{" "}
              {r.stat < r.random ? "below random" : "above random"}.
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GuiPanel() {
  const [mode, setMode] = useState<"selected" | "pure">("selected")
  const [upd, setUpd] = useState<0 | 1>(0)
  const block = GUI_CROSS[upd]
  const cell = (p: "old" | "new", w: "old" | "new") => {
    const a = block.arms.find((x) => x.policy === p && x.world === w)
    return a ? a[mode] : null
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex gap-1">
          {(["selected", "pure"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={"rounded border px-2 py-1 " + (mode === m ? "bg-foreground text-background" : "")}
            >
              {m === "selected" ? "reported controller (alpha = 0)" : "world-model ranking"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {([0, 1] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUpd(u)}
              className={"rounded border px-2 py-1 " + (upd === u ? "bg-foreground text-background" : "")}
            >
              update {u + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-sm">
        <div />
        <div className="text-center font-mono text-xs text-muted-foreground">old world</div>
        <div className="text-center font-mono text-xs text-muted-foreground">new world</div>
        {(["old", "new"] as const).map((p) => (
          <div key={p} className="contents">
            <div className="self-center pr-2 text-right font-mono text-xs text-muted-foreground">{p} policy</div>
            {(["old", "new"] as const).map((w) => {
              const c = cell(p, w)
              if (!c) return <div key={w} />
              const shade = c.success / 100
              return (
                <div
                  key={w}
                  className="rounded-md border p-2 text-center"
                  style={{ background: `color-mix(in oklch, ${ACC} ${(shade * 45).toFixed(0)}%, transparent)` }}
                >
                  <div className="text-lg font-semibold">{c.success}%</div>
                  <div className="text-[11px] leading-tight text-muted-foreground">
                    {c.steps.toFixed(2)} actions · {c.repeats} repeats · {c.wrong} wrong submits
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed">
        {mode === "selected" ? (
          <>
            Under the reported controller the two columns are identical in every cell: swapping the world model changes
            nothing, because at alpha = 0 it is never consulted. Every gain is the policy row.
          </>
        ) : (
          <>
            Ranked by the world model, the new world lifts the old policy from{" "}
            {block.arms[0].pure.success}% to {block.arms[1].pure.success}%. That is the world model&apos;s real result,
            and it is not the number in the launch post.
          </>
        )}{" "}
        For scale: a scripted rule controller scores {GUI_RULE.success}% at {GUI_RULE.steps} actions.
      </p>
    </div>
  )
}

function LabPanel() {
  const W = 600
  const H = 230
  const L = 44
  const R = 170
  const T = 14
  const B = 30
  const y0 = 15
  const y1 = 50
  const xOf = (i: number) => L + (i / (LAB_VERSIONS.length - 1)) * (W - L - R)
  const yOf = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B)
  const path = LAB_VERSIONS.map((v, i) => `${i ? "L" : "M"}${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ")
  const names = ["initial", "v2", "v3", "v4", "final"]
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="LabHorizon Level-2 score across five policy versions with reference systems">
        {[20, 30, 40, 50].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="currentColor" strokeOpacity={0.1} />
            <text x={L - 6} y={yOf(v) + 3} fontSize={10} textAnchor="end" fill="currentColor" opacity={0.6}>
              {v}%
            </text>
          </g>
        ))}
        {LAB_REFS.map((r, i) => (
          <g key={r.label}>
            <line x1={L} x2={W - R} y1={yOf(r.value)} y2={yOf(r.value)} stroke={i === 0 ? WARN : BASE} strokeDasharray="4 3" strokeOpacity={0.8} />
            <text x={W - R + 6} y={yOf(r.value) + (i === 0 ? -2 : i === 1 ? 4 : 3)} fontSize={10} fill="currentColor" opacity={0.8}>
              {r.label} {r.value.toFixed(2)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke={ACC} strokeWidth={2.5} />
        {LAB_VERSIONS.map((v, i) => (
          <g key={i}>
            <circle cx={xOf(i)} cy={yOf(v)} r={4} fill={ACC} />
            <text x={xOf(i)} y={yOf(v) - 8} fontSize={10} textAnchor="middle" fill="currentColor">
              {v.toFixed(2)}
            </text>
            <text x={xOf(i)} y={H - 10} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.6}>
              {names[i]}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-sm leading-relaxed">
        One process, one score per version, no seeds or intervals, and no description of what changed between versions.
        The final version clears the reference by 0.69 points; the jump that matters is initial to version 2.
      </p>
    </div>
  )
}

function interp(pts: [number, number][], n: number): number | null {
  if (n < pts[0][0]) return null
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i][0] <= n) {
      const a = pts[i]
      const b = pts[i + 1]
      if (!b || a[0] === n) return a[1]
      return a[1] + ((n - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
    }
  }
  return null
}
// a running best only steps up, so the RSI series are held flat between points
function step(pts: [number, number][], n: number): number | null {
  let v: number | null = null
  for (const p of pts) if (p[0] <= n) v = p[1]
  return v
}

function RxnPanel() {
  const [n, setN] = useState(10)
  const W = 600
  const H = 240
  const L = 44
  const R = 20
  const T = 14
  const B = 30
  const y0 = 65
  const y1 = 100
  const xOf = (e: number) => L + ((e - 8) / 32) * (W - L - R)
  const yOf = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B)
  const stepPath = (pts: [number, number][]) => {
    let d = ""
    pts.forEach((p, i) => {
      if (i === 0) d += `M${xOf(p[0]).toFixed(1)} ${yOf(p[1]).toFixed(1)}`
      else d += ` H${xOf(p[0]).toFixed(1)} V${yOf(p[1]).toFixed(1)}`
    })
    return d
  }
  const linePath = (pts: [number, number][]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${xOf(p[0]).toFixed(1)} ${yOf(p[1]).toFixed(1)}`).join(" ")
  const bo = interp(RXN_BO, n)
  const paper = step(RXN_PAPER, n)
  const rel = step(RXN_RELEASE, n)
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>experiments run (first 8 are the shared random design)</span>
        <span>{n}</span>
      </div>
      <Range min={8} max={40} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} accent={ACC} className="mt-2 w-full" aria-label="Experiments run" />
      <div className="mt-2 w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="Mean best observed yield against experiment count for RSI-Anything and Bayesian optimization">
          {[70, 80, 90, 100].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={L - 6} y={yOf(v) + 3} fontSize={10} textAnchor="end" fill="currentColor" opacity={0.6}>
                {v}%
              </text>
            </g>
          ))}
          {[8, 10, 20, 30, 40].map((e) => (
            <text key={e} x={xOf(e)} y={H - 10} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.6}>
              {e}
            </text>
          ))}
          <line x1={L} x2={W - R} y1={yOf(RXN_POOL_BEST)} y2={yOf(RXN_POOL_BEST)} stroke={WARN} strokeDasharray="5 4" />
          <text x={W - R} y={yOf(RXN_POOL_BEST) - 5} fontSize={10} textAnchor="end" fill={WARN}>
            best row in the 321-row pool: {RXN_POOL_BEST}
          </text>
          <path d={linePath(RXN_BO)} fill="none" stroke={BASE} strokeWidth={2} strokeDasharray="1 0" />
          {RXN_BO.map((p) => (
            <circle key={p[0]} cx={xOf(p[0])} cy={yOf(p[1])} r={3} fill={BASE} />
          ))}
          <path d={stepPath(RXN_RELEASE)} fill="none" stroke={ALT} strokeWidth={2} />
          <path d={stepPath(RXN_PAPER)} fill="none" stroke={ACC} strokeWidth={2.5} strokeOpacity={0.9} />
          <line x1={xOf(n)} x2={xOf(n)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.4} />
        </svg>
      </div>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-md border p-2">
          <span style={{ color: ACC }} className="font-semibold">
            RSI, paper figure
          </span>
          : {paper?.toFixed(2)}%
        </div>
        <div className="rounded-md border p-2">
          <span style={{ color: ALT }} className="font-semibold">
            RSI, released replay
          </span>
          : {rel?.toFixed(2)}%
        </div>
        <div className="rounded-md border p-2">
          <span className="font-semibold">Bayesian optimization</span>: {bo?.toFixed(2)}%
          <span className="text-muted-foreground"> (straight line between the paper&apos;s labelled points)</span>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {n >= 10
          ? "From the tenth experiment on, every RSI run sits on the pool's best row. The remaining 30 experiments of the budget cannot move the RSI number; they only give Bayesian optimization time to catch up, which it does not."
          : "Before the tenth experiment the released model and the paper's figure disagree: 80.14 against 95.06 after nine experiments."}
      </p>
    </div>
  )
}
