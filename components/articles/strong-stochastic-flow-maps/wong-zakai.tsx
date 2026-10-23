"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { useHydrated } from "@/lib/use-hydrated"

import { M, NS, SIG, makePath, roughSlopeRms, rms, smooth } from "./wz-core"

// One seeded Brownian path, its degree-N shifted Legendre polynomial, and the
// random ODE that polynomial drives. See wz-core.ts for the maths. Everything
// is computed in the browser after hydration from three fixed seeds.

const SEEDS = [7, 11, 23]
const W = 640
const PH = 150
const PAD = 30
const C_ROUGH = "oklch(0.62 0.02 260)"
const C_POLY = "oklch(0.55 0.15 255)"
const C_SDE = "oklch(0.45 0.03 260)"
const C_RODE = "oklch(0.66 0.17 45)"

function line(a: Float64Array, ty: (v: number) => number, stride: number) {
  let d = ""
  for (let i = 0; i < a.length; i += stride) {
    const x = PAD + (i / (a.length - 1)) * (W - PAD - 8)
    d += `${i ? "L" : "M"}${x.toFixed(1)},${ty(a[i]).toFixed(1)}`
  }
  return d
}

export function WongZakai() {
  const hydrated = useHydrated()
  const [ni, setNi] = useState(2)
  const [si, setSi] = useState(0)
  const N = NS[ni]
  const seed = SEEDS[si]

  const path = useMemo(() => (hydrated ? makePath(seed) : null), [hydrated, seed])
  const sm = useMemo(() => (path ? smooth(path, N) : null), [path, N])
  const sweep = useMemo(() => (path ? NS.map((n) => ({ n, s: smooth(path, n) })) : null), [path])

  const range = (arrs: Float64Array[]) => {
    let lo = Infinity
    let hi = -Infinity
    for (const a of arrs) for (let i = 0; i < a.length; i++) {
      lo = Math.min(lo, a[i])
      hi = Math.max(hi, a[i])
    }
    const pad = 0.08 * (hi - lo || 1)
    return [lo - pad, hi + pad] as const
  }
  const mk = (lo: number, hi: number) => (v: number) => 8 + ((hi - v) / (hi - lo)) * (PH - 20)

  let top = null
  let bot = null
  if (path && sm) {
    const [wl, wh] = range([path.W, sm.Wn])
    const tyW = mk(wl, wh)
    const [xl, xh] = range([path.X, sm.Xn])
    const tyX = mk(xl, xh)
    top = (
      <>
        <path d={line(path.W, tyW, 2)} fill="none" stroke={C_ROUGH} strokeWidth={0.8} />
        <path d={line(sm.Wn, tyW, 8)} fill="none" stroke={C_POLY} strokeWidth={2} />
      </>
    )
    bot = (
      <>
        <path d={line(path.X, tyX, 2)} fill="none" stroke={C_SDE} strokeWidth={0.8} />
        <path d={line(sm.Xn, tyX, 8)} fill="none" stroke={C_RODE} strokeWidth={2} />
      </>
    )
  }
  const placeholder = (
    <text x={W / 2} y={PH / 2} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
      drawing {M.toLocaleString("en-US")} Brownian increments…
    </text>
  )

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">
        Wong–Zakai on one path: a smooth polynomial driver converging to the SDE
      </figcaption>
      <label className="flex flex-wrap items-center gap-3">
        <span className="w-44 font-mono text-xs">N = {N} Legendre coefficients</span>
        <Range
          min={0}
          max={NS.length - 1}
          step={1}
          value={ni}
          onChange={(e) => setNi(Number(e.target.value))}
          className="min-w-40 flex-1"
          aria-label="Number of shifted Legendre coefficients N"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Brownian path:</span>
        {SEEDS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setSi(i)}
            className={`rounded-md border px-2 py-0.5 font-mono ${i === si ? "border-foreground" : "border-border text-muted-foreground"}`}
            aria-pressed={i === si}
          >
            seed {s}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">Top: the Brownian path W and its degree-N polynomial W⁽ᴺ⁾ on [0, 1].</p>
      <svg viewBox={`0 0 ${W} ${PH}`} className="mt-1 w-full" role="img" aria-label="Brownian path and its polynomial approximation">
        {top ?? placeholder}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        Bottom: dX = 4(X − X³) dt + dW from X₀ = 0.3, solved two ways on the same path.
      </p>
      <svg viewBox={`0 0 ${W} ${PH}`} className="mt-1 w-full" role="img" aria-label="SDE solution and random ODE solution">
        {bot ?? placeholder}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span><span style={{ color: C_ROUGH }}>━</span> Brownian path W ({M.toLocaleString("en-US")} steps)</span>
        <span><span style={{ color: C_POLY }}>━</span> polynomial W⁽ᴺ⁾</span>
        <span><span style={{ color: C_SDE }}>━</span> SDE, Euler–Maruyama on W</span>
        <span><span style={{ color: C_RODE }}>━</span> random ODE driven by dW⁽ᴺ⁾/dt</span>
      </div>

      {path && sm && sweep ? (
        <>
          <p className="mt-3 text-xs">
            The rough path&apos;s finite-difference slope has RMS {roughSlopeRms(path).toFixed(1)} at this grid and grows
            as 1/√dt when the grid is refined; it has no limit. The polynomial&apos;s slope dW⁽ᴺ⁾/dt has RMS{" "}
            {rms(sm.Wdot).toFixed(2)} and is an ordinary function a JVP can differentiate. Both curves end at the same
            point, W(1) = {path.W[M].toFixed(3)}, for every N.
          </p>
          <table className="mt-3 w-full text-left text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">N</th>
                <th className="py-1 font-normal">sup |W⁽ᴺ⁾ − W|</th>
                <th className="py-1 font-normal">sup |X⁽ᴺ⁾ − X|</th>
                <th className="py-1 font-normal">|X⁽ᴺ⁾(1) − X(1)|</th>
                <th className="py-1 font-normal">RMS dW⁽ᴺ⁾/dt</th>
              </tr>
            </thead>
            <tbody>
              {sweep.map(({ n, s }) => (
                <tr key={n} className={n === N ? "font-semibold" : undefined}>
                  <td className="py-0.5">{n}</td>
                  <td>{s.supW.toFixed(3)}</td>
                  <td>{s.supX.toFixed(3)}</td>
                  <td>{s.endX.toFixed(4)}</td>
                  <td>{s.Wdot.length ? rms(s.Wdot).toFixed(2) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            σ = {SIG}. N = 1 is the straight chord: the random ODE sees only the increment W(1) − W(0), which is all a
            map conditioned on the increment alone can know. Errors fall as N grows, unevenly, because they depend on
            where along this particular path the kicks landed.
          </p>
        </>
      ) : null}
    </figure>
  )
}
