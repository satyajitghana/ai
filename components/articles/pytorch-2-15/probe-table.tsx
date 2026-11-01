"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Fourteen probes I ran on torch 2.14.1+cpu and torch 2.15.0+cpu (CPython 3.12, one shared 4-vCPU VM, no GPU).
// "changed" = the two wheels answered differently. "same" = identical answer. "blind" = the claim needs hardware or
// a system the CPU wheel does not have, so the probe says nothing about it.

type Row = { claim: string; probe: string; a: string; b: string; v: "changed" | "same" | "blind" }

const ROWS: Row[] = [
  { claim: "Python 3.10 dropped", probe: "wheel tags on PyPI", a: "cp310 to cp314", b: "cp311 to cp315", v: "changed" },
  { claim: "MPS stream API", probe: "dir(torch.mps) for 'stream'", a: "none", b: "Stream, current_stream, default_stream, set_stream, stream, streams", v: "changed" },
  { claim: "FSDP2 fp32 for chosen params", probe: "MixedPrecisionPolicy fields", a: "4 fields", b: "+ param_dtype_override_fn", v: "changed" },
  { claim: "One-sided transports", probe: "ls torch/distributed", a: "flight_recorder", b: "+ _transport, _nccl4py", v: "changed" },
  { claim: "Cuspy profiler config", probe: "names containing 'uspy'", a: "none", b: "CuspyConfig", v: "changed" },
  { claim: "XPU event IPC", probe: "dir(torch.xpu.Event)", a: "none", b: "ipc_handle, from_ipc_handle", v: "changed" },
  { claim: "XPU MemPool non_split", probe: "MemPool.__init__ signature", a: "use_on_oom", b: "use_on_oom, no_split", v: "changed" },
  { claim: "Stable ABI sort", probe: "grep sort in stable/ops.h", a: "no match", b: "match", v: "changed" },
  { claim: "Header-only c10/util", probe: "headeronly/util/irange.h", a: "absent, 46 headers", b: "present, 53 headers", v: "changed" },
  { claim: "FlyDSL in Inductor", probe: "files named *flydsl*", a: "0", b: "10", v: "changed" },
  { claim: "FP8 e4m3fn and _scaled_mm", probe: "CPU cast and a 16x32 scaled_mm", a: "works", b: "works", v: "same" },
  { claim: "F.grouped_mm exists", probe: "bf16, aligned shapes, CPU", a: "works", b: "works", v: "same" },
  { claim: "Compiled output unchanged", probe: "max abs diff, compiled vs eager", a: "1.67e-06", b: "1.67e-06", v: "same" },
  { claim: "Rewritten NCCL by default", probe: "needs a CUDA build and NCCL", a: "not testable", b: "not testable", v: "blind" },
]

const FILTERS = ["all", "changed", "same", "blind"] as const

export function ProbeTable() {
  const [f, setF] = useState<(typeof FILTERS)[number]>("all")
  const rows = ROWS.filter((r) => f === "all" || r.v === f)
  const n = (k: string) => ROWS.filter((r) => r.v === k).length
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter probes">
        {FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={f === k}
            onClick={() => setF(k)}
            className={cn("rounded-full border border-border px-3 py-1 text-xs", f === k ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {k} {k === "all" ? ROWS.length : n(k)}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-normal">Claim</th>
              <th className="py-1 pr-3 font-normal">Probe</th>
              <th className="py-1 pr-3 font-normal">2.14.1</th>
              <th className="py-1 font-normal">2.15.0</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.claim} className="border-t border-border align-top">
                <td className="py-1.5 pr-3 font-medium">{r.claim}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{r.probe}</td>
                <td className="py-1.5 pr-3">{r.a}</td>
                <td className={cn("py-1.5", r.v === "changed" && "font-medium")}>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Measured on the two CPU wheels, CPython 3.12. A probe that sees a new name proves the surface shipped, not that it works or is fast.
      </figcaption>
    </figure>
  )
}
