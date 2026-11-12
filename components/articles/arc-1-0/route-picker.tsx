"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog, mpow } from "@/lib/dmath"

// ARC's two policies, as its report's Appendix A writes them:
//   utility:      pick argmax over eligible m of  V * p(m) - C(m)
//   prefer-local: if the local model's p >= threshold, use it; otherwise apply utility to the cloud set.
// V and the threshold range over what presets.json and the card allow (V from 0.1 to 30 dollars; Sage 4.5, Swift
// 0.1; prefer-local 0.85). The three candidates are illustrative: ARC would supply p and the token counts, and the
// caller the prices. Nothing below is a measurement of any real model.

type Cand = { id: string; name: string; cost: number; local: boolean }

const CANDS: Cand[] = [
  { id: "local", name: "local 1.7B on the laptop", cost: 0, local: true },
  { id: "mid", name: "mid-tier cloud model", cost: 0.08, local: false },
  { id: "top", name: "frontier cloud model", cost: 0.9, local: false },
]

const V_MIN = 0.1
const V_MAX = 30
const vFrom = (x: number) => V_MIN * mpow(V_MAX / V_MIN, x / 100)
const xFrom = (v: number) => Math.round((mlog(v / V_MIN) / mlog(V_MAX / V_MIN)) * 100)

export function RoutePicker() {
  const [x, setX] = useState(() => xFrom(4.5))
  const [pLocal, setPLocal] = useState(80)
  const [pMid, setPMid] = useState(88)
  const [pTop, setPTop] = useState(93)
  const [thr, setThr] = useState(85)
  const [policy, setPolicy] = useState<"utility" | "local">("utility")

  const V = vFrom(x)
  const p: Record<string, number> = { local: pLocal / 100, mid: pMid / 100, top: pTop / 100 }
  const util = CANDS.map((c) => ({ ...c, p: p[c.id], u: V * p[c.id] - c.cost }))

  let chosen: string
  let why: string
  if (policy === "local" && p.local >= thr / 100) {
    chosen = "local"
    why = `local p ${p.local.toFixed(2)} clears the ${(thr / 100).toFixed(2)} threshold, so the local model runs and utility is never consulted`
  } else {
    const pool = policy === "local" ? util.filter((c) => !c.local) : util
    const best = pool.reduce((a, b) => (b.u > a.u ? b : a))
    chosen = best.id
    why =
      policy === "local"
        ? `local p ${p.local.toFixed(2)} is under the threshold, so utility picks among the cloud models`
        : `highest V·p − C`
  }

  const maxAbs = Math.max(0.01, ...util.map((c) => Math.abs(c.u)))
  const vLabel = V < 1 ? V.toFixed(2) : V.toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">ARC&apos;s decision rule · illustrative candidates</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Policy">
          {(
            [
              ["utility", "utility"],
              ["local", "prefer-local"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPolicy(id)}
              aria-pressed={policy === id}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${policy === id ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              V, the value of a success: <span className="font-mono">${vLabel}</span>{" "}
              <span className="text-muted-foreground">(one point of success is worth {(V).toFixed(V < 1 ? 2 : 1)} cents)</span>
            </span>
            <span className="flex gap-1">
              <button type="button" className="rounded border px-1.5 font-mono text-[11px]" onClick={() => setX(xFrom(0.1))}>
                Swift 0.1
              </button>
              <button type="button" className="rounded border px-1.5 font-mono text-[11px]" onClick={() => setX(xFrom(4.5))}>
                Sage 4.5
              </button>
            </span>
          </div>
          <Range min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label="Value of success V" />
        </div>
        {policy === "local" && (
          <div className="space-y-1">
            <div className="text-xs">
              Prefer-local threshold: <span className="font-mono">{(thr / 100).toFixed(2)}</span>
            </div>
            <Range min={50} max={99} value={thr} onChange={(e) => setThr(Number(e.target.value))} aria-label="Prefer-local threshold" />
          </div>
        )}
        <ul className="space-y-3">
          {util.map((c) => {
            const set = c.id === "local" ? setPLocal : c.id === "mid" ? setPMid : setPTop
            const pct = (Math.abs(c.u) / maxAbs) * 50
            const on = c.id === chosen
            return (
              <li key={c.id} className={`rounded-lg border p-2.5 ${on ? "border-foreground" : "border-border/60"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className={on ? "font-semibold" : ""}>
                    {on ? "→ " : ""}
                    {c.name}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    p {c.p.toFixed(2)} · C ${c.cost.toFixed(2)} · V·p − C = {c.u >= 0 ? "" : "−"}${Math.abs(c.u).toFixed(3)}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-[1fr_1fr] items-center gap-3">
                  <Range min={50} max={99} value={Math.round(c.p * 100)} onChange={(e) => set(Number(e.target.value))} aria-label={`Predicted success of ${c.name}`} />
                  <span className="relative h-3 rounded-sm bg-muted/40" aria-hidden>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
                    <span
                      className="absolute inset-y-0 rounded-sm"
                      style={{
                        background: on ? "var(--hg-accent, oklch(0.6 0.15 250))" : "oklch(0.7 0.02 250)",
                        left: c.u >= 0 ? "50%" : `${50 - pct}%`,
                        width: `${pct}%`,
                      }}
                    />
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-xs">
          Picks <span className="font-semibold">{CANDS.find((c) => c.id === chosen)?.name}</span>: {why}.
        </p>
        <p className="text-xs text-muted-foreground">
          Sliders set each candidate&apos;s predicted success p. The costs per task are made up; ARC predicts four token counts per candidate and the caller&apos;s prices turn them into C. At V = 0.1 the cheapest model wins almost regardless of p; at V = 4.5 a few points of p are worth paying for.
        </p>
      </div>
    </figure>
  )
}
