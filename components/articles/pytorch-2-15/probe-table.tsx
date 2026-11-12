"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Seventeen probes I ran on torch 2.14.1 and torch 2.15.0, both the macOS arm64 wheels from PyPI, CPython 3.12, on an
// M1 Max (Apple GPU available, no NVIDIA). "changed" = the two wheels answered differently. "same" = identical answer.
// "blind" = the claim needs hardware or a build these wheels do not have, so the probe says nothing about it.

type Row = { claim: string; probe: string; a: string; b: string; v: "changed" | "same" | "blind" }

const ROWS: Row[] = [
  { claim: "Python 3.10 dropped", probe: "wheel tags on PyPI", a: "cp310 to cp314", b: "cp311 to cp315", v: "changed" },
  { claim: "nccl means the rewrite", probe: "registration code for nccl", a: "nccl2 only if TORCH_DIST_USE_NCCL2 == 1", b: "nccl2 unless TORCH_DIST_USE_NCCL2 == 0", v: "changed" },
  { claim: "New backend entry point", probe: "torch.distributed.backends entry points", a: "8 names", b: "+ nccl4py", v: "changed" },
  { claim: "One-sided transports, Python watchdog", probe: "ls torch/distributed", a: "flight_recorder", b: "+ _transport, _nccl4py, _watchdog", v: "changed" },
  { claim: "FSDP2 fp32 for chosen params", probe: "MixedPrecisionPolicy fields", a: "4 fields", b: "+ param_dtype_override_fn", v: "changed" },
  { claim: "MPS stream API", probe: "dir(torch.mps) for 'stream'", a: "none", b: "Stream, current_stream, default_stream, set_stream, stream, streams", v: "changed" },
  { claim: "FP8 on MPS", probe: "cast a tensor on mps to float8_e4m3fn", a: "Undefined type Float8_e4m3fn", b: "works", v: "changed" },
  { claim: "Cuspy profiler config", probe: "names containing 'uspy'", a: "none", b: "CuspyConfig", v: "changed" },
  { claim: "XPU event IPC", probe: "dir(torch.xpu.Event)", a: "none", b: "ipc_handle, from_ipc_handle", v: "changed" },
  { claim: "XPU MemPool split policy", probe: "MemPool.__init__ signature", a: "use_on_oom", b: "use_on_oom, no_split", v: "changed" },
  { claim: "Stable ABI sort", probe: "sort( in stable/ops.h", a: "no", b: "yes", v: "changed" },
  { claim: "Header-only c10/util", probe: "headers in headeronly/util", a: "29", b: "36", v: "changed" },
  { claim: "FlyDSL in Inductor", probe: "files named *flydsl*", a: "0", b: "10", v: "changed" },
  { claim: "FP8 _scaled_mm on CPU", probe: "a 16x32 _scaled_mm on CPU", a: "works", b: "works", v: "same" },
  { claim: "grouped_mm on MPS", probe: "bf16 F.grouped_mm, 4 groups, on mps", a: "works", b: "works", v: "same" },
  { claim: "Reconfigure contract", probe: "gloo shrink and grow, 4 processes", a: "6, 3, 7", b: "6, 3, 7", v: "same" },
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
        Run on the two macOS wheels from PyPI, CPython 3.12, M1 Max. A probe that sees a new name proves the surface shipped, not that it works or is fast.
      </figcaption>
    </figure>
  )
}
