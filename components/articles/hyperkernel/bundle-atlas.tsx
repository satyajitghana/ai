"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every megakernel bundle Hyperstitioncc/Hyperkernel ships, at commit 5f30018.
//
// MEASURED on CPU, no GPU: I decompressed each kernels/b300/**/entry.cubin.zst,
// parsed the ELF section table myself (Python stdlib + zstandard, no NVIDIA
// tools), and divided the size of its one .text section by 16 bytes per SASS
// instruction. Where the bundle also ships entry.sass, I counted the
// instructions in it too: the two counts agree exactly for all 37 that have one.
// MMA / TMA / sync counts are opcode sites in that listing (UTC*MMA, UTMA* /
// UBLKCP, SYNCS* / BAR*), not executions. Grid, threads, cluster and GPUs are
// the bundle's own reference.json.
//
// "Launches" is READ from the Rust host (src/), not run: whether the kernel is
// launched once and fed through a ring, once per call, or once per stage.

type Bundle = { name: string; instr: number; mma?: number; tma?: number; sync?: number }
type Model = {
  key: string
  label: string
  claim: string
  gpus: number
  cluster: number
  pattern: "resident" | "per call" | "per stage"
  launches: string
  bundles: Bundle[]
  note: string
}

const MODELS: Model[] = [
  {
    key: "dsv4",
    label: "DeepSeek-V4.1-Flash",
    claim: "inference",
    gpus: 4,
    cluster: 16,
    pattern: "resident",
    launches: "1 at boot (a clustered part + a dependent part), then requests through a ring",
    bundles: [
      { name: "c1", instr: 247592, mma: 234, tma: 334, sync: 3172 },
      { name: "c2", instr: 343512, mma: 304, tma: 607, sync: 5102 },
      { name: "c4", instr: 447896, mma: 378, tma: 887, sync: 7058 },
      { name: "c5", instr: 567304, mma: 472, tma: 1173, sync: 9090 },
      { name: "c8", instr: 567304, mma: 472, tma: 1173, sync: 9090 },
    ],
    note: "One kernel per maximum concurrency. c6 and c7 reuse c5. The code grows with the concurrency it is built for: c5 is 2.3x the instructions of c1.",
  },
  {
    key: "qwen",
    label: "Qwen3-30B-A3B training",
    claim: "pretraining",
    gpus: 8,
    cluster: 2,
    pattern: "per call",
    launches: "1 per training step, with a host watchdog around it",
    bundles: [{ name: "qwen30b-train", instr: 245864, mma: 336, tma: 328, sync: 3346 }],
    note: "The only non-cooperative launch in the set. Its own help text says it has shown intermittent hangs.",
  },
  {
    key: "pi0",
    label: "π₀-FAST",
    claim: "robotics",
    gpus: 1,
    cluster: 16,
    pattern: "resident",
    launches: "1 at load, then one observation per request through a ring",
    bundles: [
      { name: "pi0fast", instr: 62432, mma: 264, tma: 49, sync: 647 },
      { name: "pi0fast-fixed60", instr: 62432, mma: 264, tma: 49, sync: 647 },
    ],
    note: "The benchmarked kernel is the fixed60 one: exactly 60 tokens, end-of-sequence off.",
  },
  {
    key: "act",
    label: "ACT (ALOHA)",
    claim: "robotics",
    gpus: 1,
    cluster: 1,
    pattern: "per call",
    launches: "1 per camera frame: ResNet-18, encoder, decoder and action head",
    bundles: [{ name: "act", instr: 43296, mma: 160, tma: 82, sync: 974 }],
    note: "The smallest kernel in the release, and the closest to the post's 'single launch' wording.",
  },
  {
    key: "op",
    label: "openpilot driving model",
    claim: "self-driving",
    gpus: 1,
    cluster: 2,
    pattern: "per call",
    launches: "1 per frame (both cameras in one input)",
    bundles: [{ name: "openpilot", instr: 81112, mma: 444, tma: 208, sync: 1383 }],
    note: "Weights are converted from openpilot v0.11.2's ONNX file by a script in the repo.",
  },
  {
    key: "evo2",
    label: "Evo 2 7B",
    claim: "genomics",
    gpus: 1,
    cluster: 1,
    pattern: "per stage",
    launches: "prefill per chunk, then 1 step kernel per generated base",
    bundles: [
      { name: "prefill", instr: 59344 },
      { name: "step", instr: 54240 },
    ],
    note: "No SASS listing shipped, so only the instruction count is read from the cubin.",
  },
  {
    key: "mg3",
    label: "Matrix-Game 3.0",
    claim: "world model",
    gpus: 2,
    cluster: 1,
    pattern: "per stage",
    launches: "first clip, then a chunk kernel and a VAE kernel per 40 frames",
    bundles: [
      { name: "mg3first", instr: 93744 },
      { name: "mg3chunk", instr: 89592 },
      { name: "mg3vae", instr: 58464 },
    ],
    note: "Three megakernels. No SASS listing shipped.",
  },
  {
    key: "esm",
    label: "ESMFold, 164 residues",
    claim: "protein folding",
    gpus: 1,
    cluster: 1,
    pattern: "per stage",
    launches: "9 per fold: the language model, then trunk + structure module for each of 4 recycles",
    bundles: [
      { name: "lm", instr: 28000, mma: 64, tma: 32, sync: 294 },
      { name: "trunk", instr: 64824, mma: 232, tma: 48, sync: 509 },
      { name: "sm", instr: 40952, mma: 100, tma: 60, sync: 491 },
    ],
    note: "Compiled per protein length: 9 lengths ship (76 to 248), 27 kernels. Any other length is refused.",
  },
]

const MAX = 567304
const fmt = (n: number) => n.toLocaleString("en-US")

const PATTERN: Record<Model["pattern"], string> = {
  resident: "bg-amber-500/85 dark:bg-amber-400/80",
  "per call": "bg-sky-500/80 dark:bg-sky-400/75",
  "per stage": "bg-violet-500/75 dark:bg-violet-400/70",
}

export function BundleAtlas() {
  const [sel, setSel] = useState("dsv4")
  const m = MODELS.find((x) => x.key === sel) ?? MODELS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          kernels/b300 · 42 bundles · SASS instructions per megakernel
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">measured from the cubins</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(PATTERN) as Model["pattern"][]).map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", PATTERN[p])} />
              {p === "resident" ? "launched once, fed through a ring" : p === "per call" ? "one launch per call" : "several kernels per call"}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          {MODELS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "block w-full rounded-md border px-2.5 py-2 text-left",
                sel === x.key ? "border-foreground/40 bg-foreground/[0.05]" : "hover:bg-foreground/[0.03]"
              )}
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px]">
                <span>
                  {x.label} <span className="text-muted-foreground">· {x.claim}</span>
                </span>
                <span className="text-muted-foreground">
                  {x.gpus} GPU{x.gpus > 1 ? "s" : ""} · {x.bundles.length} kernel{x.bundles.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-0.5">
                {x.bundles.map((b) => (
                  <div key={b.name} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate font-mono text-[10px] text-muted-foreground">{b.name}</span>
                    <div className="relative h-3 flex-1 rounded-sm bg-foreground/[0.04]">
                      <div
                        className={cn("absolute top-0 left-0 h-3 rounded-sm", PATTERN[x.pattern])}
                        style={{ width: `${((b.instr / MAX) * 100).toFixed(2)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums">{fmt(b.instr)}</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-md border bg-background/60 p-3 font-mono text-[11px]">
          <div className="mb-2 text-foreground">{m.label}</div>
          <div className="grid gap-x-6 gap-y-1 tabular-nums sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">grid × threads</span>
              <span>148 × 384</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">thread-block cluster</span>
              <span>{m.cluster}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">instructions, all kernels</span>
              <span>{fmt(m.bundles.reduce((a, b) => a + b.instr, 0))}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">tensor-core MMA sites</span>
              <span>{m.bundles[0].mma === undefined ? "no listing" : fmt(m.bundles.reduce((a, b) => a + (b.mma ?? 0), 0))}</span>
            </div>
          </div>
          <div className="mt-2 text-muted-foreground">
            <span className="text-foreground">launches:</span> {m.launches}
          </div>
          <p className="mt-2 font-sans text-xs leading-5 text-muted-foreground">{m.note}</p>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Bar length is the SASS instruction count of one kernel&rsquo;s single <code>.text</code> section, on one
          linear scale (c5 = 567,304). Every kernel is called <code>mega_main</code> (the training one is{" "}
          <code>entry</code>) and asks for 148 blocks of 384 threads and 232,448 bytes of dynamic shared memory
          (232,400 for training). ESMFold shows one of its nine lengths. The launch pattern is read from the host
          code, not observed on a GPU.
        </p>
      </div>
    </figure>
  )
}
