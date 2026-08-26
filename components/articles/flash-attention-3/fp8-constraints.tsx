"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What choosing FP8 forces, read out of mainloop_fwd_sm90_tma_gmma_ws.hpp.
//
// FP8 attention is usually described as "the same kernel, smaller numbers".
// It is not. Four separate things in the FA3 forward mainloop change shape the
// moment Element is float_e4m3_t, and three of them are static_asserts or type
// switches rather than runtime branches — which is to say the kernel is a
// different kernel, compiled differently:
//
//   Is_FP8       = is_same_v<Element, float_e4m3_t> || is_same_v<Element, float_e5m2_t>
//   Transpose_V  = Is_FP8 && !V_colmajor
//   MmaMajorV    = !Is_FP8 && !V_colmajor ? GMMA::Major::MN : GMMA::Major::K
//   static_assert(!(!MmaPV_is_RS && Is_FP8), "MmaPV must be RS if FP8")
//
// plus per-tensor descale pointers with their own strides, which is how the
// numerics are kept sane — scaling per head rather than per tensor.

const ON = "oklch(0.60 0.15 255)"
const FORCED = "oklch(0.62 0.16 35)"
const FREE = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Row = {
  k: string
  what: string
  fp16: string
  fp8: string
  why: string
  cost: "free" | "forced"
}

const ROWS: Row[] = [
  {
    k: "v",
    what: "V layout",
    fp16: "used as stored — MN-major",
    fp8: "transposed in shared memory with LDSM.T + STSM",
    why: "the PV GEMM needs V K-major for FP8 WGMMA, so a row-major V has to be physically transposed on the way in. The kernel does it with a 64×32 or 32×64 tile depending on whether kHeadDimV is a multiple of 64.",
    cost: "forced",
  },
  {
    k: "p",
    what: "P operand source",
    fp16: "shared memory or registers",
    fp8: "registers only",
    why: "a static_assert, not a fallback: `MmaPV must be RS if FP8`. The probabilities have to be in registers when the second GEMM issues, which constrains everything upstream of it.",
    cost: "forced",
  },
  {
    k: "scale",
    what: "scaling",
    fp16: "none needed",
    fp8: "separate Q, K and V descale tensors, each with a stride",
    why: "E4M3 has about 4 bits of mantissa and a narrow range, so a single global scale wastes most of it. Strided pointers mean the scale varies per batch and head rather than per tensor.",
    cost: "forced",
  },
  {
    k: "overlap",
    what: "when pingpong turns on",
    fp16: "head dim ≤ 128",
    fp8: "head dim ≥ 128",
    why: "the same tuning switch, inverted. FP8 halves the time in the GEMM but not the time in the softmax, so the balance the scheduler barrier is correcting for moves to the other side of 128.",
    cost: "free",
  },
]

export function Fp8Constraints() {
  const [fp8, setFp8] = useState(true)
  const [sel, setSel] = useState("v")
  const r = ROWS.find((x) => x.k === sel)!

  const forced = ROWS.filter((x) => x.cost === "forced").length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {fp8 ? "Element = float_e4m3_t" : "Element = cutlass::half_t"}
        </span>
        <span className="font-mono text-[10px]" style={{ color: fp8 ? FORCED : FREE }}>
          {fp8 ? `${forced} structural changes, not tuning` : "the straightforward path"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setFp8((v) => !v)}
          aria-pressed={fp8}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            fp8
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          compile for FP8
        </button>

        <div className="mt-3 rounded-lg border bg-muted/15 p-1.5">
          {ROWS.map((x) => {
            const changed = fp8
            return (
              <button
                key={x.k}
                type="button"
                onClick={() => setSel(x.k)}
                aria-pressed={sel === x.k}
                className={cn(
                  "flex w-full cursor-pointer flex-wrap items-baseline gap-x-3 rounded-md px-2.5 py-2 text-left transition-colors",
                  sel === x.k ? "bg-muted/60" : "hover:bg-muted/30",
                )}
              >
                <span className="w-36 shrink-0 font-mono text-[10.5px] text-foreground">{x.what}</span>
                <span
                  className="flex-1 font-mono text-[10px]"
                  style={{ color: changed ? (x.cost === "forced" ? FORCED : ON) : MUTED }}
                >
                  {changed ? x.fp8 : x.fp16}
                </span>
                {changed ? (
                  <span
                    className="font-mono text-[9px] uppercase tracking-wide"
                    style={{ color: x.cost === "forced" ? FORCED : FREE }}
                  >
                    {x.cost === "forced" ? "forced" : "retuned"}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: `color-mix(in oklch, ${FORCED} 35%, transparent)` }}>
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">why</div>
          <div className="text-sm leading-6 text-muted-foreground">{r.why}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The story told about low precision is that it is a knob. In this kernel it is a
          recompilation: three of these four differences are static type switches or a bare
          <span className="font-mono text-[11px] text-foreground"> static_assert</span>, so an FP8
          FlashAttention-3 and an FP16 one are not the same code with a different accumulator. They
          are different kernels that happen to share a file.
          <br />
          <br />
          The V transpose is the one that surprises people.{" "}
          <span style={{ color: FORCED }}>
            WGMMA wants the second GEMM&rsquo;s operand K-major, and a row-major V is not
          </span>
          , so the kernel physically transposes V in shared memory using{" "}
          <span className="font-mono text-[11px] text-foreground">LDSM.T</span>{" "}and{" "}
          <span className="font-mono text-[11px] text-foreground">STSM</span> — for FP16 it does no
          transposing at all. If you can hand it a column-major V,{" "}
          <span className="font-mono text-[11px] text-foreground">V_colmajor</span>{" "}skips the whole
          thing, which is a real and rarely-mentioned reason to care how your KV cache is laid out.
          <br />
          <br />
          And the descale tensors are the quiet quality story. E4M3 carries roughly four bits of
          mantissa; one scale for a whole tensor throws most of that away when heads differ in
          magnitude, which they reliably do. Per-head scaling is why FP8 attention here is usable
          rather than merely fast — and it is the sort of thing that never appears in a speedup
          chart.
        </p>
      </div>
    </figure>
  )
}
