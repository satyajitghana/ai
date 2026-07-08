"use client"

import { useState } from "react"

// Long-context / KV-cache widget for Hy3.
// Native trained window is 256K. The community Hy3-1M-GGUF YaRN-extends to
// 1,048,576 tokens — that upper region is EXTRAPOLATED and not needle-certified,
// drawn hatched. The readout computes the real KV-cache size from the actual
// GQA config (8 KV heads · head_dim 128 · 80 layers), and shows what full MHA
// (64 KV heads) would have cost. First render is deterministic (256K). No timers.

const HY = "oklch(0.60 0.19 258)"
const WARN = "oklch(0.72 0.15 60)"

const N_KV = 8
const HEAD_DIM = 128
const N_LAYERS = 80
const NATIVE_EXP = 18 // 2^18 = 262,144 ≈ 256K
const MIN_EXP = 12 // 4K
const MAX_EXP = 20 // 1,048,576

// bytes/token for the KV cache at `bytesPerElem` (K and V, all layers).
function kvBytesPerToken(nKv: number, bytesPerElem: number) {
  return 2 * nKv * HEAD_DIM * N_LAYERS * bytesPerElem
}
const GiB = 1024 ** 3

function fmtTokens(n: number) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n % (1024 * 1024) ? 1 : 0)}M`
  return `${Math.round(n / 1024)}K`
}
function fmtGiB(bytes: number) {
  const g = bytes / GiB
  return g >= 10 ? g.toFixed(0) : g.toFixed(1)
}
// Locale-independent thousands grouping (toLocaleString() can differ between the
// SSR render and the client locale and trip a hydration mismatch).
function grouped(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export function Hy3Context() {
  const [exp, setExp] = useState(NATIVE_EXP)
  const ctx = 2 ** exp
  const extended = exp > NATIVE_EXP

  const kvFp16 = kvBytesPerToken(N_KV, 2) * ctx
  const kvFp8 = kvBytesPerToken(N_KV, 1) * ctx
  const kvMha = kvBytesPerToken(N_KV * 8, 2) * ctx // full MHA = 64 KV heads

  const frac = (exp - MIN_EXP) / (MAX_EXP - MIN_EXP)
  const nativeFrac = (NATIVE_EXP - MIN_EXP) / (MAX_EXP - MIN_EXP)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>context window · KV-cache cost (GQA, 8 KV heads)</span>
        <span className="text-muted-foreground/50">256K native</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* track */}
        <div className="relative mt-1 h-9 w-full overflow-hidden rounded-md border bg-muted/30">
          {/* extended (unverified) region */}
          <div
            className="absolute inset-y-0"
            style={{
              left: `${nativeFrac * 100}%`,
              right: 0,
              background: `repeating-linear-gradient(45deg, ${WARN}22, ${WARN}22 6px, transparent 6px, transparent 12px)`,
            }}
            aria-hidden
          />
          {/* fill up to current context */}
          <div
            className="absolute inset-y-0 left-0 transition-all"
            style={{
              width: `${frac * 100}%`,
              background: extended
                ? `linear-gradient(90deg, ${HY}cc, ${WARN}cc)`
                : `${HY}cc`,
            }}
          />
          {/* native boundary */}
          <div className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${nativeFrac * 100}%` }} aria-hidden />
          <span
            className="absolute top-1 font-mono text-[9px] text-foreground/70"
            style={{ left: `calc(${nativeFrac * 100}% + 4px)` }}
          >
            256K trained
          </span>
        </div>
        {/* ticks */}
        <div className="relative mt-1 h-4">
          {[12, 15, 18, 20].map((e) => (
            <span
              key={e}
              className="absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground tabular-nums"
              style={{ left: `${((e - MIN_EXP) / (MAX_EXP - MIN_EXP)) * 100}%` }}
            >
              {fmtTokens(2 ** e)}
            </span>
          ))}
        </div>

        {/* slider */}
        <input
          type="range"
          min={MIN_EXP}
          max={MAX_EXP}
          step={1}
          value={exp}
          onChange={(e) => setExp(Number(e.target.value))}
          className="mt-2 w-full cursor-pointer"
          style={{ accentColor: extended ? WARN : HY }}
          aria-label="context length"
        />

        {/* readout */}
        <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">context</div>
            <div className="font-mono text-lg text-foreground tabular-nums">{fmtTokens(ctx)}</div>
            <div className="font-mono text-[9px] text-muted-foreground">{grouped(ctx)} tok</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">KV cache (fp16 / fp8)</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: HY }}>
              {fmtGiB(kvFp16)} / {fmtGiB(kvFp8)} GiB
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">on top of the weights</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">if it were full MHA</div>
            <div className="font-mono text-lg text-muted-foreground tabular-nums">{fmtGiB(kvMha)} GiB</div>
            <div className="font-mono text-[9px] text-muted-foreground">8× larger (64 KV heads)</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          GQA is what makes the window affordable: 8 KV heads instead of 64 shrinks the cache 8×. Even so, KV cost is{" "}
          <span className="text-foreground">linear in context</span> — every doubling doubles the memory.{" "}
          {extended ? (
            <>
              Past the <span style={{ color: WARN }}>256K</span> line you are in the community YaRN extension: the
              hatched region is <span style={{ color: WARN }}>extrapolated</span>, not trained, and the GGUF card marks it
              experimental and not needle-certified.
            </>
          ) : (
            <>This is inside the trained 256K window. Drag past it to enter the community 1M YaRN extension.</>
          )}
        </p>
      </div>
    </figure>
  )
}
