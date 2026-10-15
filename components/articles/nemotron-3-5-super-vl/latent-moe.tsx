"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One latent-MoE block of Nemotron 3.5 Super VL and the whole model's parameter
// ledger. Every shape and count is from the BF16 safetensors headers:
//   gate.weight              [512, 4096]   router, on the full-width hidden state
//   fc1_latent_proj.weight   [1024, 4096]  down to the latent
//   experts.N.up_proj        [2688, 1024]  (512 of them, ReLU^2, no gate matrix)
//   experts.N.down_proj      [1024, 2688]
//   fc2_latent_proj.weight   [4096, 1024]  back up
//   shared_experts.up/down   [5376, 4096] / [4096, 5376], full width
// num_experts_per_tok = 22 in config.json. Which 22 light up below is illustrative.

const N_EXP = 512
const TOP_K = 22

const PARTS = [
  { key: "routed", label: "routed experts", color: "oklch(0.64 0.15 145)", total: 112_742_891_520, active: 4_844_421_120 },
  { key: "mamba", label: "Mamba-2 mixers", color: "oklch(0.60 0.15 255)", total: 4_385_602_560, active: 4_385_602_560 },
  { key: "shared", label: "shared experts", color: "oklch(0.52 0.12 145)", total: 1_761_607_680, active: 1_761_607_680 },
  { key: "latent", label: "latent projections + routers", color: "oklch(0.78 0.10 145)", total: 419_614_720, active: 419_614_720 },
  { key: "attn", label: "attention mixers", color: "oklch(0.70 0.16 55)", total: 285_245_440, active: 285_245_440 },
  { key: "head", label: "output head", color: "oklch(0.62 0.02 260)", total: 536_870_912, active: 536_870_912 },
  { key: "emb", label: "embedding table", color: "oklch(0.72 0.02 260)", total: 536_870_912, active: 0 },
  { key: "mtp", label: "MTP draft head", color: "oklch(0.66 0.10 320)", total: 2_942_325_248, active: 0 },
  { key: "vision", label: "C-RADIO + connector", color: "oklch(0.66 0.13 25)", total: 842_360_328, active: 0 },
] as const

const TOTAL = 124_453_395_976
const ACTIVE = 12_233_369_088

const fmtB = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(0)}M`)

// A fixed, deterministic "router choice" for the picture.
const CHOSEN = new Set(Array.from({ length: TOP_K }, (_, i) => (i * 97 + 41) % N_EXP))

export function LatentMoe() {
  const [view, setView] = useState<"total" | "active">("active")
  const denom = view === "total" ? TOTAL : ACTIVE

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one latent MoE block · one token</span>
        <span className="text-muted-foreground/60">shapes from the safetensors header</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 760 200" className="w-full" role="img" aria-label="A token's 4,096-wide hidden state is routed at full width, projected down to 1,024, sent to 22 of 512 experts that work in the latent, summed, projected back to 4,096 and added to a full-width shared expert's output.">
          <defs>
            <marker id="lmoe-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="var(--muted-foreground)" />
            </marker>
          </defs>
          {/* input */}
          <rect x={8} y={70} width={78} height={60} rx={6} fill="oklch(0.60 0.15 255)" opacity={0.85} />
          <text x={47} y={96} textAnchor="middle" className="fill-white font-mono" fontSize={11} fontWeight={600}>h</text>
          <text x={47} y={112} textAnchor="middle" className="fill-white font-mono" fontSize={9}>4,096</text>

          {/* router */}
          <rect x={112} y={10} width={92} height={30} rx={5} fill="none" stroke="var(--foreground)" strokeOpacity={0.5} />
          <text x={158} y={29} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>router 512</text>
          <path d="M 86 90 C 100 60 100 30 110 26" fill="none" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />

          {/* down proj */}
          <polygon points="112,72 182,88 182,112 112,128" fill="oklch(0.78 0.10 145)" opacity={0.9} />
          <text x={147} y={104} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>down</text>
          <path d="M 86 100 L 110 100" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />
          <text x={198} y={70} className="fill-muted-foreground font-mono" fontSize={9}>latent 1,024</text>

          {/* experts grid 32 x 16 */}
          {Array.from({ length: N_EXP }, (_, e) => {
            const on = CHOSEN.has(e)
            return (
              <rect
                key={e}
                x={200 + (e % 32) * 9}
                y={78 + Math.floor(e / 32) * 6.5}
                width={7.5}
                height={5}
                rx={1}
                fill={on ? "oklch(0.64 0.15 145)" : "var(--muted-foreground)"}
                opacity={on ? 1 : 0.16}
              />
            )
          })}
          <path d="M 182 100 L 198 100" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />
          <path d="M 204 26 C 330 26 340 40 344 74" fill="none" stroke="var(--muted-foreground)" strokeDasharray="3 3" markerEnd="url(#lmoe-arrow)" />
          <text x={260} y={20} className="fill-muted-foreground font-mono" fontSize={9}>picks 22</text>
          <text x={200} y={196} className="fill-muted-foreground font-mono" fontSize={9}>512 experts, 1,024 → 2,688 → 1,024, ReLU²</text>

          {/* up proj */}
          <polygon points="500,88 570,72 570,128 500,112" fill="oklch(0.78 0.10 145)" opacity={0.9} />
          <text x={535} y={104} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>up</text>
          <path d="M 490 100 L 498 100" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />

          {/* shared expert */}
          <rect x={430} y={14} width={140} height={34} rx={5} fill="oklch(0.52 0.12 145)" opacity={0.9} />
          <text x={500} y={35} textAnchor="middle" className="fill-white font-mono" fontSize={9}>shared expert 5,376</text>
          <path d="M 70 70 C 90 0 380 0 428 28" fill="none" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />

          {/* sum + out */}
          <circle cx={620} cy={100} r={14} fill="none" stroke="var(--foreground)" strokeOpacity={0.6} />
          <text x={620} y={104} textAnchor="middle" className="fill-foreground font-mono" fontSize={13}>+</text>
          <path d="M 570 100 L 604 100" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />
          <path d="M 570 31 C 610 31 620 60 620 84" fill="none" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />
          <rect x={660} y={70} width={92} height={60} rx={6} fill="oklch(0.60 0.15 255)" opacity={0.85} />
          <text x={706} y={96} textAnchor="middle" className="fill-white font-mono" fontSize={11} fontWeight={600}>out</text>
          <text x={706} y={112} textAnchor="middle" className="fill-white font-mono" fontSize={9}>4,096</text>
          <path d="M 634 100 L 658 100" stroke="var(--muted-foreground)" markerEnd="url(#lmoe-arrow)" />
        </svg>
        <div className="font-mono text-[10px] text-muted-foreground/70">which 22 light up is illustrative; the router picks per token</div>

        <div className="mt-4 mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">whole checkpoint</span>
          {(["total", "active"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                view === v ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "total" ? `stored: ${fmtB(TOTAL)}` : `active per text token: ${fmtB(ACTIVE)}`}
            </button>
          ))}
        </div>
        <div className="flex h-6 w-full overflow-hidden rounded-md border bg-muted/30">
          {PARTS.map((p) => {
            const n = view === "total" ? p.total : p.active
            return (
              <div
                key={p.key}
                title={`${p.label}: ${fmtB(n)}`}
                style={{ width: `${((n / denom) * 100).toFixed(3)}%`, background: p.color }}
                className="h-full transition-all duration-300"
              />
            )
          })}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-3">
          {PARTS.map((p) => {
            const n = view === "total" ? p.total : p.active
            return (
              <div key={p.key} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: p.color }} />
                <span>
                  {p.label} {n === 0 ? "—" : `${fmtB(n)} (${((n / denom) * 100).toFixed(1)}%)`}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Stored, the checkpoint is 90.6% routed experts. Per text token only 22 of each layer&apos;s 512 run, so the
          routed experts drop to 4.84B and the Mamba-2 mixers, which always run, are almost as large a share of the work.
          The embedding table is a lookup, the draft head runs only when speculative decoding is on, and the vision tower
          runs once per image, so none of them is counted as active.
        </p>
      </div>
    </figure>
  )
}
