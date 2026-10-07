"use client"

// Schönhage's identity (Lemma 6 of arXiv 2610.06783), evaluated for real on
// small random integers. Ten products phi_λ · psi_λ are formed from the seven
// left numbers (x1..x3, p11..p22) and the seven right numbers (y1..y3,
// q11..q22). Output z_ij reads one product, P_ij; output z0 sums all ten.
// The page checks: z0 equals the inner product p·q exactly, every time, and
// z_ij equals x_i·y_j plus an error that contains a p or a q. Zeroing the inner
// inputs (what happens on the levels where a product is "outer") makes every
// z_ij exact. The forms are transcribed from Section 2.2 of the paper.
//
// Dual-native: the article writes out the forms, the identity and why the
// error is harmless.

import { useState } from "react"

type V = { x: number[]; y: number[]; p: number[][]; q: number[][] }

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) % 19 - 9
  }
}

function draw(seed: number, zeroInner: boolean): V {
  const r = rng(seed)
  const x = [r(), r(), r()]
  const y = [r(), r(), r()]
  const p = [
    [r(), r()],
    [r(), r()],
  ]
  const q = [
    [r(), r()],
    [r(), r()],
  ]
  if (zeroInner) return { x, y, p: [[0, 0], [0, 0]], q: [[0, 0], [0, 0]] }
  return { x, y, p, q }
}

// \hat p: 3x3, columns sum to zero; \hat q: 3x3, rows sum to zero
function phat(p: number[][], i: number, j: number) {
  if (j === 2) return 0
  if (i < 2) return p[i][j]
  return -p[0][j] - p[1][j]
}
function qhat(q: number[][], i: number, j: number) {
  if (i === 2) return 0
  if (j < 2) return q[i][j]
  return -q[i][0] - q[i][1]
}

export function SchonhageCheck() {
  const [seed, setSeed] = useState(7)
  const [zero, setZero] = useState(false)
  const v = draw(seed, zero)

  const prods: { name: string; val: number }[] = []
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      prods.push({
        name: `P${i + 1}${j + 1}`,
        val: (v.x[i] + phat(v.p, i, j)) * (v.y[j] + qhat(v.q, i, j)),
      })
  const sx = v.x[0] + v.x[1] + v.x[2]
  const sy = v.y[0] + v.y[1] + v.y[2]
  prods.push({ name: "P0", val: -sx * sy })

  const z0 = prods.reduce((a, b) => a + b.val, 0)
  const inner = v.p[0][0] * v.q[0][0] + v.p[0][1] * v.q[0][1] + v.p[1][0] * v.q[1][0] + v.p[1][1] * v.q[1][1]
  const outerRows = [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => ({ got: prods[i * 3 + j].val, want: v.x[i] * v.y[j] })),
  )
  const exact = outerRows.flat().filter((c) => c.got === c.want).length

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="mb-2 font-mono text-xs text-muted-foreground">
        10 multiplications for a 3x3 outer product plus a length-4 inner product
      </div>
      <div className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-2">
        <div>
          x = ({v.x.join(", ")}) &nbsp; y = ({v.y.join(", ")})
        </div>
        <div>
          p = ({v.p.flat().join(", ")}) &nbsp; q = ({v.q.flat().join(", ")})
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
        {prods.map((pr) => (
          <span key={pr.name} className="rounded border bg-background/60 px-1.5 py-0.5">
            {pr.name} = {pr.val}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-mono text-xs font-semibold">z0 = sum of all ten</div>
          <div className="font-mono text-xs">
            {z0} vs p·q = {inner}{" "}
            <span className={z0 === inner ? "text-emerald-600" : "text-red-600"}>
              {z0 === inner ? "exact" : "mismatch"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The x·y cross terms cancel against P0, and the p·y and x·q terms cancel because the columns
            of p̂ and the rows of q̂ sum to zero.
          </p>
        </div>
        <div>
          <div className="mb-1 font-mono text-xs font-semibold">z_ij = P_ij alone ({exact}/9 exact)</div>
          <table className="font-mono text-[11px]">
            <tbody>
              {outerRows.map((row, i) => (
                <tr key={i}>
                  {row.map((c, j) => (
                    <td
                      key={j}
                      className={`border px-1.5 py-0.5 text-right ${c.got === c.want ? "" : "bg-orange-500/15"}`}
                      title={`x${i + 1}·y${j + 1} = ${c.want}`}
                    >
                      {c.got}
                      <span className="text-muted-foreground">/{c.want}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            got / x_i·y_j. Shaded cells carry the error E, which always contains a p or a q.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
        <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => setSeed((s) => s + 1)}>
          new random inputs
        </button>
        <button
          type="button"
          aria-pressed={zero}
          className={`rounded border px-2 py-1 hover:bg-muted ${zero ? "ring-2 ring-foreground/40" : ""}`}
          onClick={() => setZero((z) => !z)}
        >
          {zero ? "inner inputs zeroed" : "zero the inner inputs p, q"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        With p and q zeroed every z_ij is exact. That is the whole reason the error is harmless in the
        recursion: an entry the algorithm reads off a z_ij level only ever sees outer inputs there.
      </p>
    </div>
  )
}
