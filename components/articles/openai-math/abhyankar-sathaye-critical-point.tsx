"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Family 049, "An explicit noncoordinate polynomial with affine three-space zero
// fibre" (openai/math, commit adc7f1241), Theorem 1.1. In R = C[h,u,v,w]:
//   x = u^3 + h v,  y = -u^2 + h w,
//   s = 2u^3 v + 3u^4 w + h(v^2 - 3u^2 w^2) + h^2 w^3     (so x^2 + y^3 = h s)
//   p = -2 s^2 x + 3 s y^2 - 3 s^3 y,   F = h - p - 1.
// The paper (and Lean) prove R/(F) ≅ C[3]. A coordinate is one component of a
// polynomial automorphism, whose Jacobian determinant is a nonzero constant, so
// its gradient never vanishes. F has gradient 0 at (2, 0, -1/2, 1/2), on the
// fibre F = -1, so F is not a coordinate.
//
// Everything here is exact: rationals over BigInt, and first derivatives by
// forward-mode dual numbers, so the widget recomputes the paper's check rather
// than displaying it. (F has degree 17, far past float precision.)

type Q = { n: bigint; d: bigint }

const B0 = BigInt(0)
const B1 = BigInt(1)

function gcd(a: bigint, b: bigint): bigint {
  let x = a < B0 ? -a : a
  let y = b < B0 ? -b : b
  while (y !== B0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}
function q(n: bigint, d: bigint = B1): Q {
  if (d < B0) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  return g > B1 ? { n: n / g, d: d / g } : { n, d }
}
const qi = (k: number) => q(BigInt(k))
const qadd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
const qmul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
const qneg = (a: Q) => ({ n: -a.n, d: a.d })
const qzero = (a: Q) => a.n === B0
function qstr(a: Q): string {
  return a.d === B1 ? a.n.toString() : `${a.n.toString()}/${a.d.toString()}`
}

// Dual number: value and the four partials (d/dh, d/du, d/dv, d/dw).
type D = { v: Q; g: [Q, Q, Q, Q] }
const Z = qi(0)
function dconst(c: Q): D {
  return { v: c, g: [Z, Z, Z, Z] }
}
function dvar(c: Q, i: number): D {
  const g: [Q, Q, Q, Q] = [Z, Z, Z, Z]
  g[i] = qi(1)
  return { v: c, g }
}
function dadd(a: D, b: D): D {
  return { v: qadd(a.v, b.v), g: [0, 1, 2, 3].map((i) => qadd(a.g[i], b.g[i])) as [Q, Q, Q, Q] }
}
function dmul(a: D, b: D): D {
  return {
    v: qmul(a.v, b.v),
    g: [0, 1, 2, 3].map((i) => qadd(qmul(a.g[i], b.v), qmul(a.v, b.g[i]))) as [Q, Q, Q, Q],
  }
}
function dscale(k: number, a: D): D {
  return dmul(dconst(qi(k)), a)
}
function dpow(a: D, k: number): D {
  let r = dconst(qi(1))
  for (let i = 0; i < k; i++) r = dmul(r, a)
  return r
}

function evaluate(pt: [Q, Q, Q, Q]) {
  const h = dvar(pt[0], 0)
  const u = dvar(pt[1], 1)
  const v = dvar(pt[2], 2)
  const w = dvar(pt[3], 3)
  const x = dadd(dpow(u, 3), dmul(h, v))
  const y = dadd(dscale(-1, dpow(u, 2)), dmul(h, w))
  const s = dadd(
    dadd(dscale(2, dmul(dpow(u, 3), v)), dscale(3, dmul(dpow(u, 4), w))),
    dadd(dmul(h, dadd(dpow(v, 2), dscale(-3, dmul(dpow(u, 2), dpow(w, 2))))), dmul(dpow(h, 2), dpow(w, 3))),
  )
  const p = dadd(
    dadd(dscale(-2, dmul(dpow(s, 2), x)), dscale(3, dmul(s, dpow(y, 2)))),
    dscale(-3, dmul(dpow(s, 3), y)),
  )
  const F = dadd(dadd(h, dscale(-1, p)), dconst(qi(-1)))
  const cusp = qadd(qadd(qmul(x.v, x.v), qmul(qmul(y.v, y.v), y.v)), qneg(qmul(h.v, s.v)))
  return { F, cusp }
}

// Coordinates move in steps of 1/2 over [-3, 3]; slider index k means k/2.
const NAMES = ["h", "u", "v", "w"] as const
const CRIT: [number, number, number, number] = [4, 0, -1, 1] // (2, 0, -1/2, 1/2) in halves

export function AbhyankarSathayeCriticalPoint() {
  const [k, setK] = useState<[number, number, number, number]>([0, 0, 0, 0])

  const { F, cusp, pt } = useMemo(() => {
    const p = k.map((x) => q(BigInt(x), BigInt(2))) as [Q, Q, Q, Q]
    const r = evaluate(p)
    return { ...r, pt: p }
  }, [k])

  const critical = F.g.every(qzero)

  return (
    <figure className="my-8 rounded-xl border border-border bg-card p-4 not-prose">
      <div className="grid gap-2 sm:grid-cols-2">
        {NAMES.map((name, i) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <span className="w-4 font-mono">{name}</span>
            <input
              type="range"
              min={-6}
              max={6}
              step={1}
              value={k[i]}
              onChange={(e) => {
                const next = [...k] as [number, number, number, number]
                next[i] = Number(e.target.value)
                setK(next)
              }}
              className="hg-range flex-1"
              aria-label={`coordinate ${name}`}
            />
            <span className="w-12 text-right font-mono tabular-nums">{qstr(pt[i])}</span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setK(CRIT)}
          className="rounded-full border border-border px-3 py-0.5 text-xs hover:bg-foreground/5"
        >
          go to (2, 0, −1/2, 1/2)
        </button>
        <button
          type="button"
          onClick={() => setK([0, 0, 0, 0])}
          className="rounded-full border border-border px-3 py-0.5 text-xs hover:bg-foreground/5"
        >
          origin
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">F</dt>
        <dd className="break-all font-mono tabular-nums">{qstr(F.v)}</dd>
        {NAMES.map((name, i) => (
          <div key={name} className="contents">
            <dt className="text-muted-foreground">∂F/∂{name}</dt>
            <dd
              className={cn(
                "break-all font-mono tabular-nums",
                qzero(F.g[i]) ? "text-emerald-700 dark:text-emerald-300" : "",
              )}
            >
              {qstr(F.g[i])}
            </dd>
          </div>
        ))}
        <dt className="text-muted-foreground">x²+y³−hs</dt>
        <dd className="font-mono tabular-nums">{qstr(cusp)}</dd>
      </dl>

      <p
        className={cn(
          "mt-3 rounded-md px-3 py-2 text-sm",
          critical
            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            : "bg-foreground/5 text-muted-foreground",
        )}
      >
        {critical
          ? "All four partial derivatives vanish here, on the fibre F = −1. A coordinate's gradient can never vanish (its Jacobian with the other coordinates is a nonzero constant), so F is not a coordinate, even though F = 0 is a copy of affine 3-space."
          : "The gradient is nonzero here. Move to the critical point to see the obstruction."}
      </p>

      <figcaption className="mt-3 text-xs text-muted-foreground">
        The Abhyankar–Sathaye counterexample of family 049, computed exactly in your browser: F has degree 17
        in h, u, v, w, so every value is a BigInt rational and derivatives come from dual numbers, not
        floating point. The hard half, that the zero fibre is affine 3-space, is in the paper and in Lean
        (OAI.AbhyankarSathaye.exists_noncoordinate_polynomial); this widget only re-checks the easy half.
      </figcaption>
    </figure>
  )
}
