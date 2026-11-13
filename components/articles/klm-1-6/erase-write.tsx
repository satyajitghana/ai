"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A 4x4 toy of one Gated DeltaNet-2 head. KLM-1.6's heads are 128x128
// (config.json: gdn_heads 4, gdn_head_dim 128). The update is the one in
// MinimaLabs/KLM-1.6 modeling_klm.py, recurrence():
//
//   S <- diag(alpha) S                     decay, per key channel (a scalar here)
//   r  = (b * k)^T S                       read the old content through the erase gate
//   S <- S + k (w * v - r)^T               write the gated value, minus what was read
//   o  = q^T S                             read out
//
// b (erase, per key channel) and w (write, per value channel) are separate
// sigmoids in the real layer. Tie them to one scalar and this is Kimi Delta
// Attention; also make the decay a scalar and it is Gated DeltaNet
// (arXiv 2605.22791, Eq. 10). Tokens 1 and 2 are plain delta-rule writes
// (b = w = 1); the sliders set the gates of token 3, which rewrites key k1.
// Keys are unit length, as l2norm() makes them. Only + - * / below, so server
// and client render the same numbers.

type Vec = number[]
type Mat = number[][]

const K1: Vec = [0.8, 0.6, 0, 0]
const K2: Vec = [0, 0.6, 0.8, 0]
const V1: Vec = [1, 0, 0, 0]
const V2: Vec = [0, 1, 0, 0]
const V3: Vec = [0, 0, 1, 0]

const TOKENS = [
  { k: K1, v: V1, text: "token 1 writes v₁ at key k₁" },
  { k: K2, v: V2, text: "token 2 writes v₂ at key k₂ (k₁·k₂ = 0.36: they share channel 2)" },
  { k: K1, v: V3, text: "token 3 rewrites key k₁ with v₃, using the gates below" },
]

const zeros = (): Mat => [0, 1, 2, 3].map(() => [0, 0, 0, 0])

function update(S: Mat, k: Vec, v: Vec, alpha: number, b: Vec, w: number): Mat {
  const D = S.map((row) => row.map((s) => s * alpha))
  const r = [0, 1, 2, 3].map((j) => D.reduce((acc, row, i) => acc + b[i] * k[i] * row[j], 0))
  return D.map((row, i) => row.map((s, j) => s + k[i] * (w * v[j] - r[j])))
}

const readAt = (S: Mat, q: Vec): Vec => [0, 1, 2, 3].map((j) => S.reduce((acc, row, i) => acc + q[i] * row[j], 0))

const f2 = (x: number) => {
  const r = Math.round(x * 100) / 100
  return (r === 0 ? 0 : r).toFixed(2)
}

function cellColor(x: number): string {
  const m = Math.min(1, Math.abs(x))
  const hue = x >= 0 ? 250 : 30
  return `oklch(0.62 0.14 ${hue} / ${Math.round(m * 85) / 100})`
}

function Readout({ label, y, target }: { label: string; y: Vec; target: Vec }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-xs text-muted-foreground">{label}</div>
      <div className="grid grid-cols-4 gap-1">
        {y.map((val, j) => (
          <div key={j} className="flex flex-col items-center gap-1">
            <div className="relative h-16 w-full rounded-sm bg-muted/40">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-sm"
                style={{
                  height: `${Math.round(Math.min(1, Math.abs(val)) * 100)}%`,
                  background: val >= 0 ? "oklch(0.62 0.14 250)" : "oklch(0.66 0.15 30)",
                }}
              />
              {target[j] > 0 ? (
                <div className="absolute left-0 right-0 border-t-2 border-dashed border-foreground/70" style={{ bottom: "100%" }} />
              ) : null}
            </div>
            <span className="font-mono text-[11px] tabular-nums">{f2(val)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EraseWrite() {
  const [n, setN] = useState(3)
  const [b, setB] = useState(1)
  const [w, setW] = useState(1)
  const [alpha, setAlpha] = useState(1)
  const [tied, setTied] = useState(true)
  const [protect, setProtect] = useState(false)

  const wEff = tied ? b : w
  let S = zeros()
  for (let t = 0; t < n; t++) {
    const tok = TOKENS[t]
    if (t < 2) S = update(S, tok.k, tok.v, 1, [1, 1, 1, 1], 1)
    else S = update(S, tok.k, tok.v, alpha, [b, protect ? 0 : b, b, b], wEff)
  }
  const y1 = readAt(S, K1)
  const y2 = readAt(S, K2)
  const t1 = n >= 3 ? V3 : V1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Gated Delta Rule-2 · one 4x4 head, three tokens</span>
        <span className="text-muted-foreground/60">update from modeling_klm.py</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="tokens processed">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setN(i)}
              aria-pressed={n === i}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                n === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i === 0 ? "empty state" : `after token ${i}`}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-muted-foreground">{n === 0 ? "nothing written yet" : TOKENS[n - 1].text}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>erase gate b (token 3)</span>
              <span className="tabular-nums text-foreground">{f2(b)}</span>
            </span>
            <Range min={0} max={1} step={0.05} value={b} onChange={(e) => setB(Number(e.target.value))} aria-label="erase gate" />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>write gate w (token 3)</span>
              <span className="tabular-nums text-foreground">{f2(wEff)}</span>
            </span>
            <Range
              min={0}
              max={1}
              step={0.05}
              value={wEff}
              disabled={tied}
              onChange={(e) => setW(Number(e.target.value))}
              aria-label="write gate"
            />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>decay α before token 3</span>
              <span className="tabular-nums text-foreground">{f2(alpha)}</span>
            </span>
            <Range min={0.5} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} aria-label="decay" />
          </label>
          <div className="flex flex-col gap-2 font-mono text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tied}
                onChange={(e) => {
                  setTied(e.target.checked)
                  if (!e.target.checked) setW(b)
                }}
              />
              <span>tie w to b (Gated DeltaNet, KDA)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
              <span>channel-wise b: no erase through channel 2</span>
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div>
            <div className="mb-1 font-mono text-xs text-muted-foreground">state S (key rows x value columns)</div>
            <div className="grid w-fit grid-cols-4 gap-1">
              {S.flatMap((row, i) =>
                row.map((s, j) => (
                  <div
                    key={`${i}-${j}`}
                    className="flex h-11 w-11 items-center justify-center rounded-sm border font-mono text-[11px] tabular-nums"
                    style={{ background: cellColor(s) }}
                  >
                    {f2(s)}
                  </div>
                )),
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Readout label={`read at k₁ (want ${n >= 3 ? "v₃" : "v₁"})`} y={y1} target={n >= 1 ? t1 : [0, 0, 0, 0]} />
            <Readout label="read at k₂ (want v₂)" y={y2} target={n >= 2 ? V2 : [0, 0, 0, 0]} />
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Bars are the four value channels a query reads back; the dashed line marks the value that key should hold. With the
        gates tied, token 3 can only blend old and new. Untie them and set b to 1 with w at 0.5: k₁&apos;s old value is gone and
        the new one is written at half strength, which no tied setting gives. A toy: KLM-1.6&apos;s heads are 128 wide, and its
        gates and decay differ per channel and per token.
      </figcaption>
    </figure>
  )
}
