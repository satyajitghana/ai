"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A 4x4 toy of one RWKV-7 head. The real head is 64x64 (paper, Figure 2).
// The update is the one in RWKV-LM's rwkv_v7_demo_rnn.py, with the decay w and
// the in-context learning rate a made scalars so they fit on two sliders, and
// the replacement key taken equal to the key (the real model blends it with a):
//
//   S' = S * w  -  a * (S k) k^T  +  v k^T        read: y = S r
//
// a = 0 is plain decayed linear attention: every write is added on top.
// a = 1 with w = 1 is the classic delta rule: the old value stored at k is
// read out and subtracted before the new one is written. Only + - * / here, so
// the numbers are identical on server and client.

type Vec = number[]
type Mat = number[][]

const K1: Vec = [0.8, 0.6, 0, 0]
const K2: Vec = [0, 0.6, 0.8, 0]
const V1: Vec = [1, 0, 0, 0]
const V2: Vec = [0, 1, 0, 0]
const V3: Vec = [0, 0, 1, 0]

const WRITES = [
  { k: K1, v: V1, kName: "k₁", vName: "v₁", text: "write v₁ at key k₁" },
  { k: K2, v: V2, kName: "k₂", vName: "v₂", text: "write v₂ at key k₂ (k₁·k₂ = 0.36, they overlap)" },
  { k: K1, v: V3, kName: "k₁", vName: "v₃", text: "overwrite: write v₃ at key k₁ again" },
]

const zeros = (): Mat => [0, 1, 2, 3].map(() => [0, 0, 0, 0])
const matVec = (S: Mat, x: Vec): Vec => S.map((row) => row.reduce((acc, s, j) => acc + s * x[j], 0))

function step(S: Mat, k: Vec, v: Vec, a: number, w: number): Mat {
  const sk = matVec(S, k)
  return S.map((row, i) => row.map((s, j) => s * w - a * sk[i] * k[j] + v[i] * k[j]))
}

const f2 = (x: number) => {
  const r = Math.round(x * 100) / 100
  return (r === 0 ? 0 : r).toFixed(2)
}

function cellColor(x: number): string {
  const m = Math.min(1, Math.abs(x))
  const hue = x >= 0 ? 250 : 30
  return `oklch(0.62 0.14 ${hue} / ${Math.round(m * 85) / 100})`
}

function err(y: Vec, t: Vec): number {
  return Math.sqrt(y.reduce((acc, yi, i) => acc + (yi - t[i]) * (yi - t[i]), 0))
}

export function DeltaStep() {
  const [n, setN] = useState(3)
  const [a, setA] = useState(1)
  const [w, setW] = useState(1)

  let S = zeros()
  for (let i = 0; i < n; i++) S = step(S, WRITES[i].k, WRITES[i].v, a, w)

  // what each key "should" return: the last value written there
  let t1: Vec | null = null
  let t2: Vec | null = null
  for (let i = 0; i < n; i++) {
    if (WRITES[i].k === K1) t1 = WRITES[i].v
    else t2 = WRITES[i].v
  }
  const reads = [
    { name: "r = k₁", y: matVec(S, K1), t: t1, tName: n >= 3 ? "v₃" : "v₁" },
    { name: "r = k₂", y: matVec(S, K2), t: t2, tName: "v₂" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one head, 4×4 instead of 64×64</span>
        <div className="flex gap-1">
          {[
            { label: "linear attn, a = 0", av: 0 },
            { label: "delta rule, a = 1", av: 1 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setA(p.av)
                setW(1)
              }}
              aria-pressed={a === p.av && w === 1}
              className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                a === p.av && w === 1 ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:border-foreground/25"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[auto_1fr] sm:p-4">
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">state S after {n} write{n === 1 ? "" : "s"}</div>
          <div className="grid w-fit grid-cols-4 gap-0.5">
            {S.flatMap((row, i) =>
              row.map((x, j) => (
                <div
                  key={`${i}-${j}`}
                  className="flex h-11 w-12 items-center justify-center rounded-sm border font-mono text-[11px] tabular-nums"
                  style={{ background: cellColor(x) }}
                >
                  {f2(x)}
                </div>
              )),
            )}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">rows: value dims · columns: key dims</div>
        </div>

        <div className="min-w-0 space-y-3">
          <ol className="space-y-1 font-mono text-[11px]">
            {WRITES.map((wr, i) => (
              <li key={i} className={i < n ? "text-foreground" : "text-muted-foreground/60"}>
                {i + 1}. {wr.text}
              </li>
            ))}
          </ol>

          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="font-normal">read</th>
                <th className="font-normal">y = S r</th>
                <th className="font-normal">want</th>
                <th className="font-normal">error</th>
              </tr>
            </thead>
            <tbody>
              {reads.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="tabular-nums">[{r.y.map(f2).join(", ")}]</td>
                  <td>{r.t ? r.tName : "nothing"}</td>
                  <td className="tabular-nums">{r.t ? f2(err(r.y, r.t)) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>writes</span>
                <span className="text-foreground">{n}</span>
              </div>
              <Range min={1} max={3} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="number of writes" className="w-full" />
            </div>
            <div>
              <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>learning rate a</span>
                <span className="tabular-nums text-foreground">{a.toFixed(2)}</span>
              </div>
              <Range min={0} max={1} step={0.05} value={a} onChange={(e) => setA(Number(e.target.value))} aria-label="in-context learning rate" className="w-full" />
            </div>
            <div>
              <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>decay w</span>
                <span className="tabular-nums text-foreground">{w.toFixed(2)}</span>
              </div>
              <Range min={0.5} max={1} step={0.05} value={w} onChange={(e) => setW(Number(e.target.value))} aria-label="decay" className="w-full" />
            </div>
          </div>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        With a = 0 the overwrite stacks on top: reading k₁ returns v₁ + v₃ plus 0.36 of v₂. With a = 1 it returns
        exactly v₃, but the erase at k₁ also takes 0.36 of the overlap out of k₂&rsquo;s slot. A fixed state stores
        cleanly only what its keys can keep apart.
      </p>
    </figure>
  )
}
