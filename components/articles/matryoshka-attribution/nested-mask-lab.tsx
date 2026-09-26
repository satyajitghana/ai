"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

import {
  IDS,
  IG_STEPS,
  KINDS,
  MATTR_STEPS,
  NC,
  oracleCurve,
  runAll,
  sigmoidTopK,
  type Kind,
  type MethodId,
  type Objective,
} from "./toy"

// Four ways to rank the 12 components of a toy network whose circuit is known,
// scored the way MIB scores a circuit: keep the top-k at their base values,
// patch everything else to the source, and read faithfulness f(k). Everything
// shown is computed in toy.ts from the same pure functions on the server and in
// the browser (including the 200 MAttr training steps), so there is nothing
// random and nothing precomputed.

const METHOD: Record<MethodId, { name: string; short: string; color: string; cost: string }> = {
  exact: {
    name: "Activation patching",
    short: "patching",
    color: "oklch(0.64 0.17 38)",
    cost: `${NC + 1} forward`,
  },
  linear: {
    name: "Attribution patching (I×G)",
    short: "linear",
    color: "oklch(0.76 0.14 88)",
    cost: "1 fwd + 1 bwd",
  },
  ig: {
    name: "Integrated gradients",
    short: "IG",
    color: "oklch(0.62 0.11 180)",
    cost: `${IG_STEPS} fwd + ${IG_STEPS} bwd`,
  },
  mattr: {
    name: "Matryoshka Attribution",
    short: "MAttr",
    color: "oklch(0.55 0.18 268)",
    cost: `${MATTR_STEPS} fwd + ${MATTR_STEPS} bwd`,
  },
}
const ORACLE_C = "var(--muted-foreground)"

const KIND: Record<Kind, { label: string; color: string }> = {
  linear: { label: "L linear path", color: "oklch(0.62 0.05 245)" },
  saturating: { label: "S saturated unit", color: "oklch(0.60 0.16 318)" },
  backup: { label: "R redundant backups", color: "oklch(0.62 0.14 150)" },
  suppressor: { label: "N suppressor", color: "oklch(0.58 0.2 20)" },
  noise: { label: "X noise", color: "oklch(0.65 0.01 250)" },
}

const W = 640
const H = 250
const PL = 44
const PR = 16
const PT = 14
const PB = 30
const YMAX = 1.3
const xk = (k: number) => PL + (k / NC) * (W - PL - PR)
const yf = (f: number) => PT + ((YMAX - Math.max(0, Math.min(YMAX, f))) / YMAX) * (H - PT - PB)

function Toggle<T extends string>({
  options,
  value,
  onChange,
  color,
}: {
  options: { v: T; label: string }[]
  value: T
  onChange: (v: T) => void
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
            value === o.v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
          style={value === o.v ? { background: color } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Chip({ i, kept, fill }: { i: number; kept: boolean; fill?: number }) {
  const c = KIND[KINDS[i]].color
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-[23px] shrink-0 items-center justify-center overflow-hidden rounded font-mono text-[9px] sm:w-[30px] sm:text-[10px]",
        kept ? "border text-foreground" : "border border-dashed text-muted-foreground/60"
      )}
      style={{
        borderColor: kept ? c : "var(--border)",
        background: kept ? `color-mix(in oklch, ${c} 20%, transparent)` : undefined,
      }}
      title={`${IDS[i]}: ${KIND[KINDS[i]].label.slice(2)}${kept ? " (kept)" : " (patched)"}`}
    >
      {fill !== undefined && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${(fill * 100).toFixed(1)}%`, background: `color-mix(in oklch, ${c} 38%, transparent)` }}
        />
      )}
      <span className="relative">{IDS[i]}</span>
    </span>
  )
}

export function NestedMaskLab() {
  const [nonlin, setNonlin] = useState(true)
  const [objective, setObjective] = useState<Objective>("logit")
  const [k, setK] = useState(2)

  const results = useMemo(() => runAll(nonlin, objective), [nonlin, objective])
  const oracle = useMemo(() => oracleCurve(nonlin), [nonlin])
  const mattr = results[3]
  const soft = useMemo(() => sigmoidTopK(mattr.scores, k), [mattr.scores, k])
  const softSum = soft.reduce((a, b) => a + b, 0)

  const allSame = results.every((r) => r.order.every((v, j) => v === results[0].order[j]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>four rankings of a 12-part toy · keep the top k, patch the rest</span>
        <span className="shrink-0 text-muted-foreground/50">toy · computed live</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* controls */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span>model</span>
            <Toggle
              options={[
                { v: "on", label: "nonlinear" },
                { v: "off", label: "all linear" },
              ]}
              value={nonlin ? "on" : "off"}
              onChange={(v) => setNonlin(v === "on")}
              color="var(--foreground)"
            />
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span>MAttr loss</span>
            <Toggle<Objective>
              options={[
                { v: "logit", label: "max logit diff" },
                { v: "match", label: "match the model" },
              ]}
              value={objective}
              onChange={setObjective}
              color={METHOD.mattr.color}
            />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="shrink-0">
            budget k = <span className="text-foreground">{k}</span> of {NC}
          </span>
          <Range
            min={0}
            max={NC}
            step={1}
            value={k}
            onChange={(e) => setK(parseInt(e.target.value, 10))}
            className="h-1 flex-1 cursor-pointer"
            accent={METHOD.mattr.color}
            aria-label="Circuit size k: how many components are kept at their base values"
          />
        </label>

        {/* faithfulness curves */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Faithfulness of the top-k circuit against k for four ranking methods and a brute-force best. At k = ${k}: ${results
            .map((r) => `${METHOD[r.id].short} ${r.curve[k].toFixed(2)}`)
            .join(", ")}, best possible ${oracle[k].toFixed(2)}.`}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={PL}
                x2={W - PR}
                y1={yf(f)}
                y2={yf(f)}
                stroke="var(--border)"
                strokeDasharray={f === 1 ? "5 4" : undefined}
                strokeWidth={f === 1 ? 1.4 : 1}
              />
              <text x={PL - 6} y={yf(f) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>
                {f.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={W - PR} y={yf(1) - 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>
            f = 1: the full model
          </text>
          {Array.from({ length: NC + 1 }, (_, i) => (
            <text key={i} x={xk(i)} y={H - PB + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
              {i}
            </text>
          ))}
          <text x={PL} y={H - 3} className="fill-muted-foreground font-mono" fontSize={11}>
            k kept →
          </text>
          <text x={PL + 4} y={PT + 8} className="fill-muted-foreground font-mono" fontSize={11}>
            faithfulness f(k)
          </text>

          {/* budget cursor */}
          <line x1={xk(k)} x2={xk(k)} y1={PT} y2={H - PB} stroke="var(--muted-foreground)" strokeOpacity={0.35} />

          {/* brute-force best */}
          <polyline
            points={oracle.map((f, i) => `${xk(i).toFixed(1)},${yf(f).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={ORACLE_C}
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeDasharray="2 3"
          />

          {results.map((r) => (
            <g key={r.id}>
              <polyline
                points={r.curve.map((f, i) => `${xk(i).toFixed(1)},${yf(f).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={METHOD[r.id].color}
                strokeWidth={r.id === "mattr" ? 2.4 : 1.8}
              />
              <circle
                cx={xk(k)}
                cy={yf(r.curve[k])}
                r={r.id === "mattr" ? 4.5 : 3.5}
                fill={METHOD[r.id].color}
                stroke="var(--background)"
                strokeWidth={1.2}
              />
            </g>
          ))}
          {allSame && (
            <text x={xk(6)} y={yf(0.3)} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={12}>
              all four rankings coincide: every motif is a straight line
            </text>
          )}
        </svg>

        {/* rankings */}
        <div className="mt-2 space-y-2">
          {results.map((r) => (
            <div key={r.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] sm:w-44 sm:shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: METHOD[r.id].color }} />
                  <span className="text-foreground">{METHOD[r.id].name}</span>
                </span>
                <span className="sm:hidden" style={{ color: METHOD[r.id].color }}>
                  f = {r.curve[k].toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-[2px] sm:gap-[3px]">
                {r.order.map((i, rank) => (
                  <Chip key={i} i={i} kept={rank < k} fill={r.id === "mattr" ? soft[i] : undefined} />
                ))}
              </div>
              <span className="hidden font-mono text-[11px] sm:ml-auto sm:inline" style={{ color: METHOD[r.id].color }}>
                f = {r.curve[k].toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>
              MAttr chip fill = its soft mask at this k (sums to {softSum.toFixed(2)}); it only rises as k grows
            </span>
            <span className="shrink-0 pl-2">best possible f = {oracle[k].toFixed(2)}</span>
          </div>
        </div>

        {/* summary */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse font-mono text-[10px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">method</th>
                <th className="py-1 pr-2 text-right font-normal">area ↑</th>
                <th className="py-1 pr-2 text-right font-normal">gap to 1 ↓</th>
                <th className="py-1 text-right font-normal">passes to score all</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1 pr-2" style={{ color: METHOD[r.id].color }}>
                    {METHOD[r.id].short}
                  </td>
                  <td className="py-1 pr-2 text-right text-foreground">{r.area.toFixed(3)}</td>
                  <td className="py-1 pr-2 text-right text-foreground">{r.gap.toFixed(3)}</td>
                  <td className="py-1 text-right text-muted-foreground">{METHOD[r.id].cost}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">brute force</td>
                <td className="py-1 pr-2 text-right text-muted-foreground">—</td>
                <td className="py-1 pr-2 text-right text-muted-foreground">—</td>
                <td className="py-1 text-right text-muted-foreground">{(1 << NC).toLocaleString("en-US")} forward</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(KIND) as Kind[]).map((kd) => (
            <span key={kd} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KIND[kd].color }} />
              {KIND[kd].label}
            </span>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Twelve components, one output. <span className="text-foreground">S</span>{" "}sits in a saturated tanh, so
          its gradient at the clean run is nearly zero although patching it removes 2.49 of the output.{" "}
          <span className="text-foreground">R1–R3</span>{" "}feed a soft OR: any one of them carries most of the
          path, so patching a single one costs 0.04 of the output at most. <span className="text-foreground">N</span>{" "}pushes against the
          behaviour. Each row is one method&rsquo;s ranking; the first k chips are kept at their base values and the
          rest are patched to the source, and f(k) is how much of the full output survives. &ldquo;Area&rdquo; is the
          mean f over k = 1…12 (a CPR analogue on a linear grid) and &ldquo;gap&rdquo; the mean |1 − f| (a CMD
          analogue). Switch the loss to &ldquo;match the model&rdquo; and watch N move up the MAttr ranking: area
          falls and the gap shrinks.
        </p>
      </div>
    </figure>
  )
}
