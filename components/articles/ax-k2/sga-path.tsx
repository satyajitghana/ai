"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

// Sparse Gated Attention (SGA), drawn as a data path. GatedNorm feeds two
// things that were previously separate stabilizers in A.X K1: an Indexer +
// Selector pair (the DeepSeek-V3.2-style sparse top-k mechanism, new in K2)
// and an Output Gate (the head-specific gate already present throughout
// pretraining). MLA attends only to the selector's chosen KV entries; its
// output is multiplied elementwise by the gate before the Wo projection.
//
// Two controls carry the article's honesty point directly in the diagram:
// - a context-length slider changes how few of the cached KV blocks the
//   fixed k=2048 budget actually covers (illustrative cell count, exact %
//   printed as text);
// - a dense/sparse toggle swaps which path is active and reads out the
//   report's own LongBench ablation (62.80 dense vs 62.99 sparse) — the
//   near-zero quality cost for the efficiency gain.

const IDX = "oklch(0.60 0.15 255)" // indexer / selector — blue
const GATE = "oklch(0.70 0.17 40)" // output gate — warm
const ATT = "oklch(0.62 0.16 150)" // MLA / attended path — green

const NB = 20
const BUDGET = 2048
const LENS = [
  { label: "4K", n: 4096 },
  { label: "16K", n: 16384 },
  { label: "64K", n: 65536 },
  { label: "128K", n: 131072 },
  { label: "256K", n: 262144 },
] as const

function score(i: number) {
  return (msin((i + 1) * 1.7) * 0.6 + mcos((i + 1) * 0.6) * 0.4 + 1) / 2
}

// geometry (viewBox units)
const SX = 40
const SW = 300
const CW = 13
const GAP = 2
const cx = (i: number) => SX + i * (CW + GAP) + CW / 2

export function SGAPath() {
  const [li, setLi] = useState(LENS.length - 1)
  const [mode, setMode] = useState<"sparse" | "dense">("sparse")

  const L = LENS[li].n
  const fracExact = (BUDGET / L) * 100
  const fracStr = fracExact >= 1 ? fracExact.toFixed(1) : fracExact.toFixed(2)
  const selectedCount = mode === "dense" ? NB : Math.min(NB, Math.max(1, Math.round(NB * (BUDGET / L))))

  const selected = useMemo(() => {
    if (mode === "dense") return new Set(Array.from({ length: NB }, (_, i) => i))
    const ranked = Array.from({ length: NB }, (_, i) => i).sort((a, b) => score(b) - score(a))
    return new Set(ranked.slice(0, selectedCount))
  }, [mode, selectedCount])

  const sparse = mode === "sparse"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>sparse gated attention · data path</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 820 480"
          className="w-full"
          role="img"
          aria-label={`Sparse Gated Attention data path. Hidden states pass through GatedNorm, which feeds an Indexer and Selector that pick top-k cached key-value blocks, and an Output Gate computed in parallel. MLA attends only the selected blocks; its output is multiplied by the gate before the output projection and residual add. In ${mode} mode the model attends ${selectedCount} of ${NB} shown cache blocks, ${fracStr}% of a ${LENS[li].label}-token context.`}
        >
          <defs>
            <filter id="sga-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.15" />
            </filter>
            <marker id="sga-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.4} />
            </marker>
            <marker id="sga-arrow-idx" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={IDX} strokeWidth={1.4} />
            </marker>
          </defs>

          {/* ── KV cache strip ── */}
          <text x={SX} y={162} className="fill-muted-foreground font-mono" fontSize={10.5}>
            KV cache · past tokens
          </text>
          <text x={SX + SW} y={162} textAnchor="end" className="font-mono" fontSize={10.5} fill={sparse ? IDX : "var(--muted-foreground)"}>
            {sparse ? `${selectedCount} of ${NB} shown · ${fracStr}% of ${LENS[li].label}` : "100% — full dense cache"}
          </text>
          {Array.from({ length: NB }, (_, i) => {
            const on = selected.has(i)
            return (
              <rect
                key={i}
                x={cx(i) - CW / 2}
                y={176}
                width={CW}
                height={26}
                rx={3}
                fill={on ? (sparse ? IDX : ATT) : "var(--muted-foreground)"}
                opacity={on ? 0.85 : 0.12}
                className="transition-all duration-300"
              />
            )
          })}

          {/* Indexer / Selector column */}
          <g opacity={sparse ? 1 : 0.35}>
            <line x1={cx(9)} y1={202} x2={cx(9)} y2={222} stroke={IDX} strokeWidth={1.4} markerEnd="url(#sga-arrow-idx)" />
            <rect x={40} y={222} width={140} height={38} rx={8} fill="var(--background)" stroke={IDX} strokeWidth={1.5} strokeDasharray={sparse ? undefined : "4 3"} filter={sparse ? "url(#sga-soft)" : undefined} />
            <text x={110} y={238} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>Indexer</text>
            <text x={110} y={251} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>score + rank</text>

            <line x1={180} y1={241} x2={196} y2={241} stroke={IDX} strokeWidth={1.4} markerEnd="url(#sga-arrow-idx)" />
            <rect x={196} y={222} width={140} height={38} rx={8} fill="var(--background)" stroke={IDX} strokeWidth={1.5} strokeDasharray={sparse ? undefined : "4 3"} filter={sparse ? "url(#sga-soft)" : undefined} />
            <text x={266} y={238} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>Selector</text>
            <text x={266} y={251} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>top-k = {BUDGET}</text>

            <path
              d="M 336 241 C 400 241, 410 280, 470 280"
              fill="none"
              stroke={IDX}
              strokeWidth={1.4}
              strokeDasharray={sparse ? "4 3" : "2 4"}
              markerEnd="url(#sga-arrow-idx)"
            />
            <text x={352} y={268} className="font-mono" fontSize={9} fill={IDX}>
              {sparse ? "KV[I_topk]" : "(bypassed)"}
            </text>
          </g>

          {/* MLA box */}
          <rect x={470} y={258} width={180} height={44} rx={10} fill="var(--background)" stroke={sparse ? ATT : "var(--border)"} strokeWidth={1.5} filter="url(#sga-soft)" />
          <text x={560} y={276} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>MLA</text>
          <text x={560} y={290} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>latent attention</text>

          {/* Output Gate box */}
          <rect x={650} y={258} width={140} height={44} rx={10} fill="var(--background)" stroke={GATE} strokeWidth={1.5} filter="url(#sga-soft)" />
          <text x={720} y={276} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>Output Gate</text>
          <text x={720} y={290} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>G = σ(Wg·q)</text>

          {/* GatedNorm box + branches up */}
          <line x1={560} y1={350} x2={560} y2={302} stroke="var(--muted-foreground)" strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <path d="M 650 350 C 700 350, 720 320, 720 302" fill="none" stroke={GATE} strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <rect x={470} y={350} width={180} height={38} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={560} y={374} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>GatedNorm</text>

          {/* ⊙ combine MLA and gate */}
          <line x1={560} y1={258} x2={560} y2={235} stroke={ATT} strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <path d="M 720 258 C 720 220, 590 208, 573 220" fill="none" stroke={GATE} strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <circle cx={560} cy={222} r={13} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} filter="url(#sga-soft)" />
          <text x={560} y={227} textAnchor="middle" className="fill-foreground font-mono" fontSize={12}>⊙</text>

          {/* Wo project */}
          <line x1={560} y1={209} x2={560} y2={200} stroke="var(--muted-foreground)" strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <rect x={490} y={170} width={140} height={30} rx={7} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={560} y={189} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>Wo project</text>

          {/* residual add */}
          <line x1={560} y1={170} x2={560} y2={151} stroke="var(--muted-foreground)" strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <path d="M 470 430 C 300 430, 300 140, 549 140" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.4} opacity={0.6} markerEnd="url(#sga-arrow)" />
          <circle cx={560} cy={140} r={11} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} />
          <text x={560} y={144} textAnchor="middle" className="fill-foreground font-mono" fontSize={12}>+</text>

          {/* output pill */}
          <line x1={560} y1={129} x2={560} y2={72} stroke="var(--muted-foreground)" strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <rect x={470} y={40} width={180} height={32} rx={9} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={560} y={60} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5}>block output</text>

          {/* hidden state input pill */}
          <line x1={560} y1={414} x2={560} y2={388} stroke="var(--muted-foreground)" strokeWidth={1.4} markerEnd="url(#sga-arrow)" />
          <rect x={470} y={414} width={180} height={32} rx={9} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={560} y={434} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5}>hidden state (token)</text>
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">mode</span>
            {(["sparse", "dense"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={mode === m ? { background: m === "sparse" ? IDX : "var(--muted-foreground)" } : undefined}
              >
                {m === "sparse" ? "sparse (SGA)" : "dense (pre-adapt)"}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            LongBench:{" "}
            <span className={cn(mode === "dense" ? "font-semibold text-foreground" : "")}>62.80 dense</span>
            {" → "}
            <span className={cn(mode === "sparse" ? "font-semibold" : "")} style={mode === "sparse" ? { color: IDX } : undefined}>
              62.99 sparse
            </span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>context length (sparse mode) · {LENS[li].label}</span>
            <span>k = {BUDGET} tokens fixed</span>
          </div>
          <Range min={0} max={LENS.length - 1} value={li} onChange={(e) => setLi(Number(e.target.value))} className="w-full cursor-pointer" accent={IDX} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="text-foreground">Dense</span>{" "}mode is A.X K2 before the sparse-warmup stage: the Indexer and
          Selector are bypassed, MLA reads the full cache, and the Output Gate — present throughout pretraining, not
          added for long context — is the only stabilizer. Switch to{" "}
          <span style={{ color: IDX }} className="font-medium">sparse</span>{" "}and the Indexer scores every cached
          block, the Selector keeps a fixed budget of {BUDGET.toLocaleString()} tokens, and MLA attends only those —
          a shrinking slice as the slider moves from 4K to 256K. The gate does not change between modes; only the
          Indexer/Selector path and what MLA reads do. The report&rsquo;s own ablation is the honest part: swapping
          in sparsity moves LongBench from 62.80 to 62.99 — an improvement, not a cost, for cutting attention compute
          at long context.
        </p>
      </div>
    </figure>
  )
}
