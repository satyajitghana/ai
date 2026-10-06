"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Every number here is copied from the LiFT paper (arXiv 2610.05538):
//   - LiFT L/2 R10 joint sweep: Table 6 (T steps x K_inf loops, TFLOPs per
//     image, FID on 50,000 samples, no classifier-free guidance)
//   - dense L/2 and XL/2 step sweeps: Table 3
// Nothing is interpolated. The widget only filters the measured settings by
// a per-image budget and reports the lowest FID that fits, which is what the
// paper's Figure 5(a) and Table 7 do.

const STEPS = [10, 25, 50, 100]
const LOOPS = [1, 2, 4, 8, 16, 32]

// [T][K] -> [TFLOPs, FID]
const LIFT: [number, number][][] = [
  [[0.942, 48.613], [1.614, 33.633], [2.959, 18.955], [5.648, 15.289], [11.027, 15.094], [21.785, 16.435]],
  [[2.354, 34.819], [4.035, 22.57], [7.397, 13.165], [14.12, 11.39], [27.568, 11.402], [54.463, 12.142]],
  [[4.708, 31.828], [8.07, 20.304], [14.793, 12.255], [28.241, 10.952], [55.136, 10.994], [108.926, 11.567]],
  [[9.415, 30.586], [16.139, 19.422], [29.587, 12.043], [56.482, 10.961], [110.271, 10.999], [217.851, 11.484]],
]

type Dense = { name: string; params: string; rows: [number, number, number][] } // [T, TFLOPs, FID]
const DENSE: Dense[] = [
  {
    name: "dense L/2",
    params: "458M",
    rows: [[10, 1.614, 29.59], [25, 4.035, 19.05], [50, 8.069, 16.94], [100, 16.139, 16.17], [250, 40.347, 15.74]],
  },
  {
    name: "dense XL/2",
    params: "675M",
    rows: [[10, 2.372, 27.8], [25, 5.931, 17.68], [50, 11.862, 15.54], [100, 23.723, 14.69], [250, 59.308, 14.3]],
  },
]

const BUDGETS = [1, 1.7, 2.5, 3, 4.1, 5, 6, 7.5, 8.1, 10, 12, 15, 17, 20, 25, 29, 41, 60, 110, 220]
const ACCENT = "oklch(0.66 0.16 55)"

// FID 10 -> deep, FID 50 -> pale. Linear, clamped; only + - * /.
function shade(fid: number) {
  const t = Math.max(0, Math.min(1, (fid - 10) / 40))
  const l = 0.42 + 0.45 * t
  const c = 0.16 - 0.1 * t
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 300)`
}

export function BudgetSplit() {
  const [bi, setBi] = useState(8)
  const budget = BUDGETS[bi]

  type Pick = { t: number; k: number; c: number; f: number }
  const fits: Pick[] = []
  LIFT.forEach((row, ti) => row.forEach(([c, f], ki) => { if (c <= budget) fits.push({ t: STEPS[ti], k: LOOPS[ki], c, f }) }))
  const lowest = (xs: Pick[]) => xs.reduce<Pick | null>((a, x) => (!a || x.f < a.f ? x : a), null)
  const bb = lowest(fits)
  const bs = lowest(fits.filter((x) => x.k === 1))
  const denseBest = DENSE.map((d) => {
    let b: [number, number, number] | null = null
    for (const r of d.rows) if (r[1] <= budget && (!b || r[2] < b[2])) b = r
    return { d, b }
  })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">budget split · LiFT L/2 R10, Tables 3 and 6</span>
        <span className="font-mono text-[10px] text-muted-foreground">FID, lower is better · 270M params</span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs">
            <span>inference budget per image</span>
            <span className="text-base font-semibold" style={{ color: ACCENT }}>
              {budget} TFLOPs
            </span>
          </span>
          <Range
            min={0}
            max={BUDGETS.length - 1}
            step={1}
            value={bi}
            accent={ACCENT}
            onChange={(e) => setBi(Number(e.target.value))}
            aria-label="Inference budget in TFLOPs per image"
            className="mt-1 w-full"
          />
        </label>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 font-mono text-[11px]">
            <thead>
              <tr>
                <th className="text-left font-normal text-muted-foreground">T \ K</th>
                {LOOPS.map((k) => (
                  <th key={k} className="font-normal text-muted-foreground">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIFT.map((row, ti) => (
                <tr key={STEPS[ti]}>
                  <td className="pr-1 text-muted-foreground">{STEPS[ti]}</td>
                  {row.map(([c, f], ki) => {
                    const fits = c <= budget
                    const isBest = bb && bb.t === STEPS[ti] && bb.k === LOOPS[ki]
                    return (
                      <td
                        key={ki}
                        className="rounded px-1 py-1.5 text-center"
                        style={{
                          background: shade(f),
                          color: "white",
                          opacity: fits ? 1 : 0.18,
                          outline: isBest ? `2px solid ${ACCENT}` : undefined,
                          outlineOffset: 1,
                        }}
                        title={`T=${STEPS[ti]}, K=${LOOPS[ki]}: ${c} TFLOPs, FID ${f}`}
                      >
                        <div className="font-semibold">{f.toFixed(1)}</div>
                        <div className="text-[9px] opacity-80">{c < 10 ? c.toFixed(2) : c.toFixed(0)} TF</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Stat
            k="best LiFT setting that fits"
            v={bb ? `T=${bb.t}, K=${bb.k} → FID ${bb.f.toFixed(2)} (${bb.c} TF)` : "nothing fits"}
            hl
          />
          <Stat k="LiFT with 1 loop, steps only" v={bs ? `T=${bs.t} → FID ${bs.f.toFixed(2)}` : "nothing fits"} />
          {denseBest.map(({ d, b }) => (
            <Stat
              key={d.name}
              k={`${d.name} (${d.params}), steps only`}
              v={b ? `T=${b[0]} → FID ${b[2].toFixed(2)} (${b[1]} TF)` : "nothing fits"}
            />
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Faded cells cost more than the budget. All settings use Euler sampling with no classifier-free guidance; dense
          L/2 trains with the same FLOPs as this checkpoint, dense XL/2 with about 47% more. Rows are integration steps T,
          columns are loops per step K.
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className={hl ? "rounded-lg border border-foreground/40 bg-muted/40 px-3 py-2" : "rounded-lg border px-3 py-2"}>
      <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  )
}
