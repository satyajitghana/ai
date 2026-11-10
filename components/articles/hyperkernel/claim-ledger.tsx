"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The launch thread's per-model claims (REPORTED: @hyperstition_cc, 5 November
// 2026, posts 1 to 11), set against what Hyperstitioncc/Hyperkernel at commit
// 5f30018 actually contains. "Kernel" = a bundle under kernels/b300/ for that
// model (MEASURED: listed and parsed). "Evidence" = a results file, log or
// number in the repo that backs the claim (MEASURED: grepped every text file).
// Nothing here was timed on a GPU by me.

type Status = "kernel + number" | "kernel only" | "no kernel"
type Row = {
  model: string
  domain: string
  claim: string
  baseline: string
  status: Status
  evidence: string
}

const ROWS: Row[] = [
  {
    model: "DeepSeek-V4.1-Flash",
    domain: "inference",
    claim: "36.7% higher per-user speed at concurrency 1",
    baseline: "NVIDIA's published vLLM results, B300",
    status: "kernel only",
    evidence:
      "Five kernels (c1 to c8). The logs are correctness, not speed: top-1 agreement 0.976 and mean KL 0.0147 with SGLang over 1,638 positions, against SGLang's own run-to-run KL of 0.0131. No throughput log.",
  },
  {
    model: "Kimi, GLM",
    domain: "inference",
    claim: "20-30% inference efficiency gains across all concurrencies",
    baseline: "not named",
    status: "no kernel",
    evidence: "No bundle, no host code. The post says the serving stack for both comes later.",
  },
  {
    model: "Qwen3-30B-A3B",
    domain: "pretraining",
    claim: "31% MFU on one node; 11% higher than NVIDIA's implementation",
    baseline: "NVIDIA's Qwen 30B MoE implementation",
    status: "kernel + number",
    evidence:
      "The help text of scripts/qwen30b/qwen30b says 491.58 ms and 30.6%, and the MFU formula reproduces 30.6% exactly from reference.json. The NVIDIA number is not in the repo.",
  },
  {
    model: "the training kernel",
    domain: "fault recovery",
    claim: "hardware fault detection and replanning",
    baseline: "none",
    status: "kernel only",
    evidence:
      "A device watchdog word, bounds and range flags, and a host timeout. On a trip the host prints HANG, voids the timing and exits: 'this kernel has shown intermittent hangs'. No replanning path in the released code.",
  },
  {
    model: "π₀-FAST",
    domain: "robotics",
    claim: "94 ms vs 243 ms for prefill plus 60 tokens",
    baseline: "a custom PyTorch + CUDA graph reference",
    status: "kernel only",
    evidence: "The benchmark kernel is pi0fast-fixed60: exactly 60 tokens, end-of-sequence off. The reference is not in the repo.",
  },
  {
    model: "ACT",
    domain: "robotics",
    claim: "0.81 ms vs 2.21 ms per frame",
    baseline: "Hugging Face LeRobot, BF16, torch.compile",
    status: "kernel only",
    evidence: "Kernel and a per-tick timer in the host. No result file.",
  },
  {
    model: "Matrix-Game 3.0",
    domain: "world model",
    claim: "37.4 FPS vs 11.6 FPS",
    baseline: "PyTorch + CUDA graph reference",
    status: "kernel only",
    evidence: "Three kernels on 2 GPUs. The baseline's GPU count is not stated anywhere.",
  },
  {
    model: "openpilot",
    domain: "self-driving",
    claim: "2,570 cars at once vs 1,590; 7.4 ms vs 15.7 ms",
    baseline: "NVIDIA TensorRT",
    status: "kernel only",
    evidence: "Kernel, an ONNX-to-safetensors converter and a per-frame timer. No result file.",
  },
  {
    model: "Moshi",
    domain: "voice",
    claim: "6.8 ms vs 9.45 ms per frame",
    baseline: "PyTorch reference with CUDA graphs",
    status: "no kernel",
    evidence: "No bundle, no host code, no mention in any text file.",
  },
  {
    model: "Evo 2 7B",
    domain: "genomics",
    claim: "9.0 ms vs 27.3 ms per base pair",
    baseline: "Arc's stock implementation",
    status: "kernel only",
    evidence: "A prefill and a step kernel, one step launch per base. 13.17 GB of weights per step kernel. No result file.",
  },
  {
    model: "ESMFold",
    domain: "protein folding",
    claim: "195 ms vs 677 ms for 164 residues, within 1 Å",
    baseline: "PyTorch + CUDA graph reference",
    status: "kernel only",
    evidence: "Nine lengths compiled, 164 among them. A fold is 9 launches. No result file and no structure comparison.",
  },
]

const CHIP: Record<Status, string> = {
  "kernel + number": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  "kernel only": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  "no kernel": "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
}

const FILTERS: ("all" | Status)[] = ["all", "kernel + number", "kernel only", "no kernel"]

export function ClaimLedger() {
  const [f, setF] = useState<(typeof FILTERS)[number]>("all")
  const [open, setOpen] = useState<string | null>("DeepSeek-V4.1-Flash")
  const rows = ROWS.filter((r) => f === "all" || r.status === f)
  const n = (s: Status) => ROWS.filter((r) => r.status === s).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the thread&rsquo;s claims vs commit 5f30018</span>
        <span className="font-mono text-[10px] text-muted-foreground">claims reported · repo contents measured</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setF(x)}
              aria-pressed={f === x}
              className={cn("rounded-sm border px-2 py-0.5 font-mono text-[10px]", f === x ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]")}
            >
              {x === "all" ? `all · ${ROWS.length}` : `${x} · ${n(x)}`}
            </button>
          ))}
        </div>

        <div className="mt-3 divide-y rounded-md border">
          {rows.map((r) => {
            const isOpen = open === r.model
            return (
              <div key={r.model}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.model)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-foreground/[0.03]"
                >
                  <span className="font-mono text-[11px]">
                    {r.model} <span className="text-muted-foreground">· {r.domain}</span>
                  </span>
                  <span className={cn("rounded-sm border px-1.5 py-px font-mono text-[10px]", CHIP[r.status])}>{r.status}</span>
                  <span className="w-full text-xs leading-5 text-muted-foreground">{r.claim}</span>
                </button>
                {isOpen && (
                  <div className="space-y-1 px-3 pb-3 text-xs leading-5">
                    <div>
                      <span className="font-mono text-[10px] text-muted-foreground">baseline </span>
                      {r.baseline}
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-muted-foreground">in the repo </span>
                      {r.evidence}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Every speed figure is the thread&rsquo;s. &ldquo;Kernel only&rdquo; means the megakernel ships and the claim can be
          rerun by anyone with the GPUs and the weights, but no timing log, results table or baseline script is in the
          repo to check it against. One claim has a number in the repo. Three of the models the thread names (Kimi, GLM and Moshi) have no kernel at all.
        </p>
      </div>
    </figure>
  )
}
