"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"

// SenseNova-Loop-9B's execution plan, from modeling_sensenova_loop.py:
//   range(0,4) + range(4,28) * passes + range(28,32)
// Every fourth physical layer (3, 7, ..., 31) is full attention; the rest are
// Gated DeltaNet. Each execution gets its own cache slot, so the KV cache grows
// with executions, not with stored layers. Parameter figures are my counts from
// the safetensors headers (billions): layers 0-3 and 28-31 together 1.7299,
// layers 4-27 5.1928, output head 1.0171.

const PRE = 1.7299
const LOOP = 5.1928
const HEAD = 1.0171
// one full-attention cache slot: K and V, 4 KV heads, head dim 256, bf16
const SLOT_KIB = (2 * 4 * 256 * 2) / 1024

function plan(passes: number) {
  const out: number[] = []
  for (let i = 0; i < 4; i++) out.push(i)
  for (let p = 0; p < passes; p++) for (let i = 4; i < 28; i++) out.push(i)
  for (let i = 28; i < 32; i++) out.push(i)
  return out
}
const isFull = (i: number) => i % 4 === 3

// log-space Sinkhorn, 20 iterations, as in MHCRouter
function sinkhorn(l: number[][], iters = 20) {
  const m = l.map((r) => r.slice())
  const lse = (xs: number[]) => {
    const mx = Math.max(...xs)
    return mx + mlog(xs.reduce((s, x) => s + mexp(x - mx), 0))
  }
  for (let t = 0; t < iters; t++) {
    for (let i = 0; i < 2; i++) {
      const z = lse(m[i])
      m[i] = m[i].map((x) => x - z)
    }
    for (let j = 0; j < 2; j++) {
      const z = lse([m[0][j], m[1][j]])
      m[0][j] -= z
      m[1][j] -= z
    }
  }
  return m.map((r) => r.map((x) => mexp(x)))
}

export function LoopDepth() {
  const [passes, setPasses] = useState(2)
  const [a, setA] = useState(2.4) // logit, stream 1 keeps itself
  const [b, setB] = useState(0) // logit, stream 1 <- stream 2
  const [c, setC] = useState(0.5) // logit, stream 2 <- stream 1
  const exec = useMemo(() => plan(passes), [passes])
  const slots = exec.filter(isFull).length
  const perToken = PRE + LOOP * passes + HEAD
  const mix = useMemo(() => sinkhorn([[a, b], [c, 0]]), [a, b, c])

  const W = 640
  const cell = W / exec.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>32 stored layers, run as a schedule</span>
        <span className="text-muted-foreground/60">plan and cache arithmetic from the released code</span>
      </div>
      <div className="px-4 pt-3">
        <svg viewBox={`0 0 ${W} 120`} className="h-auto w-full" role="img" aria-label={`${exec.length} layer executions for ${passes} passes`}>
          {/* physical layers */}
          {Array.from({ length: 32 }, (_, i) => (
            <rect
              key={`p${i}`}
              x={i * (W / 32) + 1}
              y={6}
              width={W / 32 - 2}
              height={18}
              rx={2}
              className={i >= 4 && i < 28 ? "fill-violet-500/40" : "fill-muted-foreground/25"}
              stroke={isFull(i) ? "currentColor" : "none"}
              strokeWidth={isFull(i) ? 1.2 : 0}
            />
          ))}
          <text x={2} y={38} className="fill-muted-foreground font-mono" fontSize={10}>
            stored: 0-3 | 4-27 (looped) | 28-31; outlined = full attention
          </text>
          {/* executions */}
          {exec.map((i, k) => {
            const pass = k < 4 ? -1 : k >= exec.length - 4 ? -1 : Math.floor((k - 4) / 24)
            return (
              <rect
                key={`e${k}`}
                x={k * cell + 0.3}
                y={56}
                width={Math.max(0.6, cell - 0.6)}
                height={isFull(i) ? 30 : 18}
                className={pass < 0 ? "fill-muted-foreground/40" : pass % 2 === 0 ? "fill-violet-500/70" : "fill-sky-500/70"}
              />
            )
          })}
          {/* stream split and merge at each pass boundary */}
          {Array.from({ length: passes }, (_, p) => {
            const x0 = (4 + p * 24) * cell
            const x1 = (4 + (p + 1) * 24) * cell
            return (
              <g key={`s${p}`} stroke="currentColor" strokeWidth={0.8} fill="none" opacity={0.7}>
                <path d={`M ${x0} 98 L ${x0 + 6} 94 L ${x1 - 6} 94 L ${x1} 98`} />
                <path d={`M ${x0} 98 L ${x0 + 6} 102 L ${x1 - 6} 102 L ${x1} 98`} />
              </g>
            )
          })}
          <text x={2} y={116} className="fill-muted-foreground font-mono" fontSize={10}>
            executed: {exec.length}; tall = full attention (own KV slot); the two lines are mHC streams, averaged at 27, re-copied at 4
          </text>
        </svg>
        <label className="mt-2 block font-mono text-[11px] text-muted-foreground">
          passes through layers 4-27: <span className="text-foreground">{passes}</span>
          {passes === 2 ? " (shipped)" : " (the checkpoint was trained for 2)"}
          <Range min={1} max={4} step={1} value={passes} onChange={(e) => setPasses(Number(e.target.value))} aria-label="passes" />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <Stat k="layer executions" v={`${exec.length}`} />
          <Stat k="full-attn KV slots" v={`${slots}`} />
          <Stat k="KV per token, bf16" v={`${slots * SLOT_KIB} KiB`} />
          <Stat k="params touched / token" v={`${perToken.toFixed(1)}B`} />
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          For scale: Qwen3.5-9B, 8 slots, 32 KiB, 7.9B; Qwen3.8-27B, 16 slots, 64 KiB, 25.6B.
        </p>
      </div>
      <div className="mt-3 border-t px-4 pb-3 pt-3">
        <div className="font-mono text-[11px] text-muted-foreground">
          how one layer mixes its two streams: router logits in, 20 Sinkhorn rounds, a doubly stochastic 2x2 out
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <Slider label="logit 1←1" v={a} set={setA} />
            <Slider label="logit 1←2" v={b} set={setB} />
            <Slider label="logit 2←1" v={c} set={setC} />
            <div className="font-mono text-[10px] text-muted-foreground">logit 2←2 fixed at 0; only differences matter after normalising</div>
          </div>
          <table className="self-center font-mono text-xs">
            <tbody>
              {mix.map((r, i) => (
                <tr key={i}>
                  {r.map((x, j) => (
                    <td key={j} className="border px-3 py-1.5 text-center" style={{ background: `rgba(139,92,246,${(x * 0.6).toFixed(3)})` }}>
                      {x.toFixed(2)}
                    </td>
                  ))}
                  <td className="pl-2 text-[10px] text-muted-foreground">row {(r[0] + r[1]).toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                {[0, 1].map((j) => (
                  <td key={j} className="pt-1 text-center text-[10px] text-muted-foreground">
                    col {(mix[0][j] + mix[1][j]).toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border bg-background/60 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{k}</div>
      <div className="text-sm text-foreground">{v}</div>
    </div>
  )
}

function Slider({ label, v, set }: { label: string; v: number; set: (x: number) => void }) {
  return (
    <label className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <span>{label}</span>
      <Range min={-3} max={3} step={0.1} value={v} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
      <span className="text-right text-foreground">{v.toFixed(1)}</span>
    </label>
  )
}
