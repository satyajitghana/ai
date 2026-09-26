"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every parameter in the S2 Pro release, counted two ways.
//
// LM: summed from the safetensors headers of fishaudio/s2-pro at
// 1de9996b6be38b745688de084d87a5633f714e4e (range requests on both shards,
// 358 tensors, all BF16). Total 4,561,852,416, equal to the index's
// metadata.total_parameters.
//
// Codec: codec.pth is a torch zip. Its central directory and data.pkl were read
// by range request and the pickle was walked with a stub unpickler that imports
// nothing, giving 541 entries. Float tensors sum to 391,430,530; the other
// 301,989,888 elements are bool causal masks (16384^2 + 2 * 4096^2) and 1,572,864
// are bf16 RoPE tables, i.e. buffers, not parameters.
//
// Qwen3-4B, for comparison: 4,022,468,096 (Hub safetensors metadata), vocab
// 151,936. S2's slow AR is that plus 3,840 embedding rows x 2560 = 9,830,400.

type Row = { label: string; sub: string; n: number; colour: string }

const SLOW = "oklch(0.58 0.14 300)"
const FAST = "oklch(0.66 0.12 250)"
const FUSE = "oklch(0.72 0.12 70)"
const CODEC = "oklch(0.60 0.10 165)"

const BY_ROLE: Row[] = [
  { label: "slow AR layers", sub: "36 x 100,930,816, Qwen3-4B's shape", n: 3_633_509_376, colour: SLOW },
  { label: "slow AR embedding", sub: "155,776 x 2560, tied to the LM head", n: 398_786_560, colour: SLOW },
  { label: "fast AR layers", sub: "4 x 100,930,560, same width, no qk-norm", n: 403_722_240, colour: FAST },
  { label: "fast AR embed + head", sub: "2 x 4,096 x 2560", n: 20_971_520, colour: FAST },
  { label: "codebook fusion table", sub: "40,960 x 2560, feeds the slow AR", n: 104_857_600, colour: FUSE },
  { label: "codec (codec.pth)", sub: "fp32, buffers excluded", n: 391_430_530, colour: CODEC },
]

const BY_FILE: Row[] = [
  { label: "text_model.*", sub: "safetensors", n: 4_032_298_496, colour: SLOW },
  { label: "audio_decoder.*", sub: "safetensors", n: 529_553_920, colour: FAST },
  { label: "codec.pth", sub: "torch zip", n: 391_430_530, colour: CODEC },
]

const CLAIMS = [
  ["README, model variants", "4B parameters"],
  ["README, slow AR", "4B"],
  ["README, fast AR", "400M"],
  ["report, audio tokenizer", "446M"],
] as const

const LM_TOTAL = 4_561_852_416
const ALL_TOTAL = LM_TOTAL + 391_430_530
const NORMS = 5_120 // two final RMSNorms, counted in the totals only

export function ParamLedger() {
  const [view, setView] = useState<"role" | "file">("role")
  const rows = view === "role" ? BY_ROLE : BY_FILE
  const max = Math.max(...rows.map((r) => r.n))

  const W = 700
  const rowH = 34
  const labelW = 188
  const barW = 330
  const H = rows.length * rowH + 8

  const m = (v: number, d = 1) => `${(v / 1e6).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} M`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          fishaudio/s2-pro, every parameter, read from the file headers
        </span>
        <div className="flex gap-1.5">
          {(
            [
              ["role", "by role"],
              ["file", "by checkpoint name"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={view === k}
              onClick={() => setView(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[620px] max-w-full">
            <title>
              {`S2 Pro parameters ${view === "role" ? "by role" : "by checkpoint name"}: ${rows
                .map((r) => `${r.label} ${m(r.n)}`)
                .join("; ")}. Language model total 4,561.9 million; with the codec 4,953.3 million.`}
            </title>
            {rows.map((r, i) => {
              const y = i * rowH + 4
              const w = Math.max(2, (barW * r.n) / max)
              return (
                <g key={r.label}>
                  <text x={0} y={y + 13} fontSize={10.5} fill="currentColor" fontFamily="ui-monospace, monospace">
                    {r.label}
                  </text>
                  <text x={0} y={y + 26} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                    {r.sub}
                  </text>
                  <rect x={labelW + 20} y={y + 4} width={w} height={18} rx={3} fill={r.colour} fillOpacity={0.5} stroke={r.colour} strokeOpacity={0.8} strokeWidth={0.8} />
                  <text x={labelW + 26 + w} y={y + 17} fontSize={10} fill="currentColor" fontFamily="ui-monospace, monospace">
                    {m(r.n)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-background/40 px-3 py-2 font-mono text-[11px] leading-5">
            <div className="text-muted-foreground">measured</div>
            <div>language model: {LM_TOTAL.toLocaleString("en-US")} (BF16)</div>
            <div>plus codec: {ALL_TOTAL.toLocaleString("en-US")}</div>
            <div className="text-muted-foreground">norms: {NORMS.toLocaleString("en-US")}, in the totals</div>
          </div>
          <div className="rounded-lg border bg-background/40 px-3 py-2 font-mono text-[11px] leading-5">
            <div className="text-muted-foreground">claimed</div>
            {CLAIMS.map(([where, what]) => (
              <div key={where}>
                {where}: <span className="text-foreground">{what}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both halves of the README&apos;s &quot;4B slow, 400M fast&quot; are right once rounded: the
          slow AR is 4,032.3 M and the fast AR 424.7 M. What neither number carries is the{" "}
          <span className="text-foreground">104.9 M</span>{" "}codebook fusion table, which the
          checkpoint files under <code>audio_decoder</code> but which the slow AR reads on every
          input, or the <span className="text-foreground">391.4 M</span>-parameter codec in a
          separate file. The report&apos;s 446 M for the tokenizer does not match the released
          file, whose weights sum to 391.4 M.
        </p>
      </div>
    </figure>
  )
}
