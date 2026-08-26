"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The numbers in this control are copied out of flash_fwd_kernel_sm90.h:
//
//   LoadRegisterRequirement = NumMmaWarpGroups == 1 ? 56
//                           : (NumMmaWarpGroups == 2 ? (Use_TMA_KV ? 24 : 40) : 32)
//   MmaRegisterRequirement  = NumMmaWarpGroups == 1 ? 256
//                           : (NumMmaWarpGroups == 2 ? (Use_TMA_KV ? 240 : 232) : 160)
//
// They are arguments to `setmaxnreg`, the Hopper instruction that lets a
// warpgroup hand registers back to the SM's pool so another warpgroup can take
// more than the uniform allocation would allow. That only means anything if the
// warpgroups do different jobs — which is the whole point of warp
// specialization, and the reason FA3 is structured the way it is.
//
// Multiply them out against an SM's 65,536 32-bit registers and the tuning
// becomes visible: the three-warpgroup configuration lands on exactly 65,536,
// and the two-warpgroup ones on 64,512. These are not round numbers that
// happened to work. They are the largest allocations that fit.

const LOAD = "oklch(0.68 0.13 85)"
const MMA = "oklch(0.60 0.15 255)"
const FREE = "oklch(0.62 0.03 250)"
const GOOD = "oklch(0.55 0.16 155)"

const REGS_PER_SM = 65536
const THREADS_PER_WG = 128

type Cfg = { k: string; label: string; mmaWgs: number; load: number; mma: number; note: string }

const CFGS: Cfg[] = [
  { k: "1", label: "1 MMA warpgroup", mmaWgs: 1, load: 56, mma: 256, note: "256 is the per-thread architectural maximum — the consumer cannot be given more" },
  { k: "2tma", label: "2 MMA warpgroups · TMA", mmaWgs: 2, load: 24, mma: 240, note: "TMA does the addressing in hardware, so the loader barely needs registers at all" },
  { k: "2cp", label: "2 MMA warpgroups · cp.async", mmaWgs: 2, load: 40, mma: 232, note: "without TMA the producer computes its own addresses — 16 more registers, and the consumers pay for them" },
  { k: "3", label: "3 MMA warpgroups", mmaWgs: 3, load: 32, mma: 160, note: "more warpgroups to hide latency, but each gets far fewer registers" },
]

export function RegisterFile() {
  const [sel, setSel] = useState("2tma")
  const c = CFGS.find((x) => x.k === sel)!

  const loadThreads = THREADS_PER_WG
  const mmaThreads = THREADS_PER_WG * c.mmaWgs
  const loadRegs = loadThreads * c.load
  const mmaRegs = mmaThreads * c.mma
  const used = loadRegs + mmaRegs
  const spare = REGS_PER_SM - used

  // what a uniform allocation would have to give everyone
  const uniform = Math.floor(REGS_PER_SM / (loadThreads + mmaThreads) / 8) * 8

  const W = 700
  const BAR = W - 20
  const px = (v: number) => (v / REGS_PER_SM) * BAR

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one SM&rsquo;s register file · {(loadThreads + mmaThreads).toLocaleString()} threads
        </span>
        <span className="font-mono text-[10px]" style={{ color: spare === 0 ? GOOD : spare < 2000 ? GOOD : FREE }}>
          {used.toLocaleString()} / {REGS_PER_SM.toLocaleString()} used —{" "}
          {((used / REGS_PER_SM) * 100).toFixed(1)}%
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CFGS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setSel(x.k)}
              aria-pressed={sel === x.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} 118`} width={W} height={118} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A bar representing an SM's 65,536 registers, split between one producer warpgroup holding ${c.load} registers per thread and ${c.mmaWgs} consumer warpgroup${c.mmaWgs > 1 ? "s" : ""} holding ${c.mma} each. Total used: ${used.toLocaleString()}, leaving ${spare.toLocaleString()} idle.`}
            </title>

            <rect x={10} y={20} width={BAR} height={30} rx={4} fill="currentColor" fillOpacity={0.05} />
            <rect x={10} y={20} width={Math.max(2, px(loadRegs))} height={30} rx={4} fill={LOAD} fillOpacity={0.8} />
            <rect x={10 + px(loadRegs)} y={20} width={Math.max(2, px(mmaRegs))} height={30} rx={4} fill={MMA} fillOpacity={0.8} />

            <text x={14} y={14} fontSize={8.5} fill={LOAD} fontFamily="ui-monospace, monospace">
              producer · 1 warpgroup × {c.load} regs = {loadRegs.toLocaleString()}
            </text>
            <text x={10 + px(loadRegs) + 6} y={14} fontSize={8.5} fill={MMA} fontFamily="ui-monospace, monospace">
              consumers · {mmaThreads} threads × {c.mma} = {mmaRegs.toLocaleString()}
            </text>
            {spare > 1200 ? (
              <text x={10 + BAR - 4} y={14} fontSize={8.5} textAnchor="end" fill={FREE} fontFamily="ui-monospace, monospace">
                {spare.toLocaleString()} idle
              </text>
            ) : null}

            {/* the line a uniform allocation would sit at */}
            <line x1={10} y1={62} x2={10 + BAR} y2={62} stroke="currentColor" strokeOpacity={0.15} />
            <text x={14} y={76} fontSize={8.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              without setmaxnreg every thread gets the same allocation:{" "}
              <tspan fill={FREE}>{uniform}</tspan> registers
            </text>
            <text x={14} y={90} fontSize={8.5} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              warp specialization gives the maths warps{" "}
              <tspan fill={MMA}>{c.mma}</tspan> — {(c.mma / uniform).toFixed(2)}× as many
            </text>
            <text x={14} y={108} fontSize={8} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              {c.note}
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "producer regs/thread", v: String(c.load), c: LOAD },
            { l: "consumer regs/thread", v: String(c.mma), c: MMA },
            { l: "register file used", v: `${((used / REGS_PER_SM) * 100).toFixed(1)}%`, c: spare < 2000 ? GOOD : FREE },
            { l: "left on the table", v: spare.toLocaleString(), c: spare === 0 ? GOOD : FREE },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A GPU thread&rsquo;s register allocation is normally uniform across the block, and it is
          the binding constraint on attention kernels: the accumulator for a tile of the output, the
          running softmax statistics and the operand fragments all live in registers, and when they
          do not fit the compiler spills to local memory and the kernel loses.
          <br />
          <br />
          Hopper&rsquo;s <span className="font-mono text-[11px] text-foreground">setmaxnreg</span>{" "}
          lets a warpgroup return registers to the pool so another can exceed the uniform share. That
          is only useful if warpgroups do <em>different</em>{" "}work — which is why FA3 splits them
          into one producer that does nothing but issue loads and up to three consumers that do
          nothing but arithmetic. The producer needs almost no state; with TMA it needs{" "}
          <span style={{ color: LOAD }}>24 registers</span>, because the copy engine does the
          addressing in hardware.
          <br />
          <br />
          Now read the totals.{" "}
          <span className="text-foreground">
            Three warpgroups land on exactly 65,536 registers — the entire file, to the register
          </span>
          , and both two-warpgroup configurations on 64,512. Switch between TMA and cp.async and
          watch the producer take sixteen more registers per thread while the consumers give up
          eight each to pay for it. These constants were not chosen for elegance; they are the
          largest values that fit.
        </p>
      </div>
    </figure>
  )
}
