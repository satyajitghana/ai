"use client"

import { useState } from "react"

import { mlog, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Three rungs from "seven products instead of eight" to an exponent.
//  1. Strassen's 1969 identity evaluated live on a 2×2 example you can edit,
//     checked against the schoolbook product.
//  2. Recursion: a rank-r scheme for d×d blocks gives exponent log_d r. The
//     schemes listed are classical and verifiable: Strassen ⟨2,2,2⟩ rank 7,
//     Laderman ⟨3,3,3⟩ rank 23 (1976), and AlphaTensor's ⟨4,4,4⟩ rank 47,
//     which holds only in characteristic 2 (Fawzi et al., Nature 2022).
//  3. Tensor powers: the elementary bound of the openai/math 2.258 paper
//     (Theorem 3.7): b copies of the border-rank-3 tensor CW_1, degenerated and
//     completed, keep s_b = 4^b + 3^b − 2^(b+1) scalar pieces that its
//     label-separation lemma turns into matrix volume, so ω ≤ 3b·ln3 / ln s_b.
//     I recounted s_2 = 17, s_3 = 75, s_4 = 305 by enumeration.

const ACCENT = "oklch(0.55 0.15 250)"

type M2 = [[number, number], [number, number]]

const SCHEMES = [
  { name: "schoolbook 2×2", d: 2, r: 8, note: "8 products, exponent 3" },
  { name: "Strassen 2×2", d: 2, r: 7, note: "1969, every field" },
  { name: "Laderman 3×3", d: 3, r: 23, note: "1976; worse than Strassen as an exponent" },
  { name: "AlphaTensor 4×4", d: 4, r: 47, note: "2022, characteristic 2 only" },
]

function strassen(A: M2, B: M2) {
  const [[a11, a12], [a21, a22]] = A
  const [[b11, b12], [b21, b22]] = B
  const m = [
    (a11 + a22) * (b11 + b22),
    (a21 + a22) * b11,
    a11 * (b12 - b22),
    a22 * (b21 - b11),
    (a11 + a12) * b22,
    (a21 - a11) * (b11 + b12),
    (a12 - a22) * (b21 + b22),
  ]
  const C: M2 = [
    [m[0] + m[3] - m[4] + m[6], m[2] + m[4]],
    [m[1] + m[3], m[0] - m[1] + m[2] + m[5]],
  ]
  return { m, C }
}

const LABELS = [
  "(a11+a22)(b11+b22)",
  "(a21+a22)·b11",
  "a11·(b12−b22)",
  "a22·(b21−b11)",
  "(a11+a12)·b22",
  "(a21−a11)(b11+b12)",
  "(a12−a22)(b21+b22)",
]

function MatIn({ M, onChange, name }: { M: M2; onChange: (M: M2) => void; name: string }) {
  return (
    <div className="inline-grid grid-cols-2 gap-1 rounded border border-border p-1" aria-label={`matrix ${name}`}>
      {[0, 1].map((i) =>
        [0, 1].map((j) => (
          <input
            key={`${i}${j}`}
            aria-label={`${name}${i + 1}${j + 1}`}
            type="number"
            value={M[i][j]}
            onChange={(e) => {
              const n = Number(e.target.value)
              const next: M2 = [[...M[0]] as [number, number], [...M[1]] as [number, number]]
              next[i][j] = Number.isFinite(n) ? n : 0
              onChange(next)
            }}
            className="w-12 rounded bg-muted px-1 py-0.5 text-center font-mono text-xs"
          />
        )),
      )}
    </div>
  )
}

function Mat({ M }: { M: M2 }) {
  return (
    <div className="inline-grid grid-cols-2 gap-1 rounded border border-border p-1 font-mono text-xs">
      {M.flat().map((x, k) => (
        <span key={k} className="w-12 px-1 py-0.5 text-center">
          {x}
        </span>
      ))}
    </div>
  )
}

const sb = (b: number) => 4 ** b + 3 ** b - 2 ** (b + 1)

export function StrassenLadder() {
  const [A, setA] = useState<M2>([
    [1, 2],
    [3, 4],
  ])
  const [B, setB] = useState<M2>([
    [5, 6],
    [7, 8],
  ])
  const [scheme, setScheme] = useState(1)
  const [levels, setLevels] = useState(5)
  const [b, setB2] = useState(3)

  const { m, C } = strassen(A, B)
  const naive: M2 = [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ]
  const ok = C.every((row, i) => row.every((x, j) => x === naive[i][j]))

  const S = SCHEMES[scheme]
  const n = mpow(S.d, levels)
  const prodsFast = mpow(S.r, levels)
  const prodsNaive = mpow(S.d, 3 * levels)
  const expo = mlog(S.r) / mlog(S.d)

  const bounds = Array.from({ length: 8 }, (_, i) => {
    const bb = i + 1
    const s = sb(bb)
    return { b: bb, s, w: (3 * bb * mlog(3)) / mlog(s) }
  })
  const cur = bounds[b - 1]
  const wMin = 2.25
  const wMax = 3.0
  const barX = (w: number) => ((wMax - w) / (wMax - wMin)) * 100

  return (
    <figure className="not-prose my-8 space-y-5 rounded-xl border border-border bg-card p-4 text-sm">
      <section>
        <div className="mb-2 font-medium">1 · Seven products instead of eight</div>
        <div className="flex flex-wrap items-center gap-3">
          <MatIn M={A} onChange={setA} name="a" />
          <span>×</span>
          <MatIn M={B} onChange={setB} name="b" />
          <span>=</span>
          <Mat M={C} />
          <span className={cn("rounded px-2 py-0.5 text-xs", ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-500/15 text-red-600")}>
            {ok ? "matches the schoolbook product" : "mismatch"}
          </span>
        </div>
        <ol className="mt-3 grid gap-1 font-mono text-xs sm:grid-cols-2">
          {m.map((x, i) => (
            <li key={i}>
              m{i + 1} = {LABELS[i]} = <span style={{ color: ACCENT }}>{x}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          c11 = m1+m4−m5+m7, c12 = m3+m5, c21 = m2+m4, c22 = m1−m2+m3+m6. Nothing uses commutativity, so the entries can themselves be matrix blocks.
        </p>
      </section>

      <section>
        <div className="mb-2 font-medium">2 · Recursion turns a rank into an exponent</div>
        <div className="flex flex-wrap gap-2">
          {SCHEMES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setScheme(i)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                scheme === i ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs">
          levels of recursion: {levels}
          <input type="range" min={1} max={8} value={levels} onChange={(e) => setLevels(Number(e.target.value))} className="flex-1" />
        </label>
        <div className="mt-2 grid gap-1 font-mono text-xs">
          <div>
            n = {S.d}^{levels} = {n.toLocaleString("en-US")}
          </div>
          <div>
            scalar products: {S.r}^{levels} = {prodsFast.toLocaleString("en-US")} vs {S.d}^{3 * levels} = {prodsNaive.toLocaleString("en-US")} ({((prodsFast / prodsNaive) * 100).toFixed(2)}%)
          </div>
          <div>
            exponent log_{S.d} {S.r} = <span style={{ color: ACCENT }}>{expo.toFixed(4)}</span> · {S.note}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 font-medium">3 · Tensor powers: many tiny savings, one exponent</div>
        <label className="flex items-center gap-3 text-xs">
          copies of CW₁ completed together, b = {b}
          <input type="range" min={1} max={8} value={b} onChange={(e) => setB2(Number(e.target.value))} className="flex-1" />
        </label>
        <div className="mt-2 font-mono text-xs">
          kept pieces s_b = 4^{b} + 3^{b} − 2^{b + 1} = {cur.s.toLocaleString("en-US")}; rank paid 3^{b} = {(3 ** b).toLocaleString("en-US")}; ω ≤ 3b·ln 3 / ln s_b = <span style={{ color: ACCENT }}>{cur.w.toFixed(6)}</span>
        </div>
        <svg viewBox="0 0 100 34" className="mt-2 h-auto w-full" role="img" aria-label="bound for each b">
          {bounds.map((x) => (
            <g key={x.b}>
              <rect x={0} y={x.b * 3.6 - 2.6} width={barX(x.w)} height={2.6} fill={x.b === b ? ACCENT : "currentColor"} fillOpacity={x.b === b ? 1 : 0.25} />
            </g>
          ))}
        </svg>
        <p className="text-xs text-muted-foreground">
          Bars grow as the bound falls toward 2.25 (left edge = 3). The best is b = 3 at 2.2901, already below every published laser-method bound; b = 4 is worse, so bigger is not automatically better. This rung is the 2.258 paper’s warm-up, not the 9/4 proof.
        </p>
      </section>
    </figure>
  )
}
