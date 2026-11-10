"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { STATIC_ROWS } from "./data"

// Six logits, then the same six with one constant added to every one of them.
// In exact arithmetic the softmax cannot tell the difference. Here each shifted
// logit is rounded to the chosen format the way an LM-head GEMM writes its
// output (fp32 bits rounded to nearest even at 7 fraction bits for BF16, 10 for
// FP16), then the softmax runs in float64 on the rounded values, which is
// generous: it is the rounding of the logits that loses the information, and
// subtracting the max afterwards cannot bring it back.

type Fmt = "bf16" | "fp16" | "fp32"

const F32 = new Float32Array(1)
const U32 = new Uint32Array(F32.buffer)

// Round an fp32 value to `keep` fraction bits, round-to-nearest-even.
function roundBits(x: number, keep: number): number {
  F32[0] = x
  if (keep >= 23 || x === 0 || !Number.isFinite(F32[0])) return F32[0]
  const drop = 23 - keep
  const u = U32[0]
  const lsb = (u >>> drop) & 1
  const half = (1 << (drop - 1)) - 1
  U32[0] = (((u + half + lsb) >>> drop) << drop) >>> 0
  return F32[0]
}

const FMT: { id: Fmt; label: string; bits: number }[] = [
  { id: "bf16", label: "BF16 (7 fraction bits)", bits: 7 },
  { id: "fp16", label: "FP16 (10)", bits: 10 },
  { id: "fp32", label: "FP32 (23)", bits: 23 },
]

const TOKENS = [
  { t: "the", z: 2.0 },
  { t: "a", z: 1.0 },
  { t: "this", z: 0.6 },
  { t: "our", z: 0.0 },
  { t: "every", z: -0.7 },
  { t: "zebra", z: -2.0 },
]

const SHIFTS = [0, -8, -32, -64, -128, -256, -512, -1024, -2048]

function softmax(z: number[]): number[] {
  const m = Math.max(...z)
  const e = z.map((v) => mexp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function ulpAt(x: number, bits: number): number {
  const a = Math.abs(x)
  if (a < 1) return 2 ** -bits
  let e = 0
  while (2 ** (e + 1) <= a) e++
  return 2 ** (e - bits)
}

const pct = (p: number) => (p * 100).toFixed(1)

export function RoundingLab() {
  const [si, setSi] = useState(6)
  const [fmt, setFmt] = useState<Fmt>("bf16")
  const shift = SHIFTS[si]
  const bits = FMT.find((f) => f.id === fmt)?.bits ?? 7
  const exact = softmax(TOKENS.map((x) => x.z))
  const rounded = TOKENS.map((x) => roundBits(x.z + shift, bits))
  const got = softmax(rounded)
  let kl = 0
  for (let i = 0; i < exact.length; i++) kl += exact[i] * (mlog(exact[i]) - mlog(Math.max(got[i], 1e-300)))
  const ulp = ulpAt(shift === 0 ? 2 : shift, bits)
  const distinct = new Set(rounded).size
  const row = STATIC_ROWS.find((r) => r.shift === -shift)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">computed in your browser: add one constant to six logits, round, softmax</span>
        <span className="font-mono text-[10px] text-muted-foreground">exact answer never changes</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {FMT.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFmt(f.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                fmt === f.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="mt-3 block font-mono text-[11px] text-muted-foreground">
          mean logit shift: <span className="text-foreground">{shift}</span> · spacing between representable values there:{" "}
          <span className="text-foreground">{ulp >= 1 ? ulp : ulp.toPrecision(3)}</span>
          <Range min={0} max={SHIFTS.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} className="mt-2 w-full" aria-label="mean logit shift" />
        </label>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">token</th>
                <th className="py-1 pr-2 text-right font-normal">logit</th>
                <th className="py-1 pr-2 text-right font-normal">+ shift, stored</th>
                <th className="py-1 pr-2 text-right font-normal">p exact</th>
                <th className="py-1 text-right font-normal">p from stored</th>
              </tr>
            </thead>
            <tbody>
              {TOKENS.map((x, i) => {
                const off = Math.abs(got[i] - exact[i]) > 0.005
                return (
                  <tr key={x.t} className="border-t border-border/60">
                    <td className="py-1 pr-2">{x.t}</td>
                    <td className="py-1 pr-2 text-right">{x.z.toFixed(1)}</td>
                    <td className="py-1 pr-2 text-right">{rounded[i]}</td>
                    <td className="py-1 pr-2 text-right">{pct(exact[i])}%</td>
                    <td className={cn("py-1 text-right", off ? "text-orange-600 dark:text-orange-400" : "")}>{pct(got[i])}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">distinct stored logits</div>
            <div className="font-mono text-lg">{distinct} of 6</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">KL(exact ‖ stored), six tokens</div>
            <div className="font-mono text-lg">{kl < 1e-6 ? "< 1e-6" : kl.toPrecision(3)}</div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">measured, 50,257-token rows, std 2</div>
            <div className="font-mono text-[12px] leading-5">
              {row ? (
                <>
                  BF16 KL {row.bf16.kl} · FP16 KL {row.fp16.kl}
                </>
              ) : (
                "not in the sweep"
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          The softmax only reads differences between logits. The format only stores each logit to a fixed number of significant bits, so the absolute
          error grows with the size of the number. A shift that is invisible in exact arithmetic moves every logit to where the grid is coarse.
          FP16 behaves like BF16 at one eighth of the shift, because it keeps three more bits.
        </p>
      </div>
    </figure>
  )
}
