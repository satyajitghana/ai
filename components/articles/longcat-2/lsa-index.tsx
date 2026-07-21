"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// LongCat Sparse Attention (LSA), drawn against MiniMax's MSA as the reference point.
// Both make attention sparse by scoring the past KV and reading only a chosen subset.
// The difference is *granularity of selection*:
//   MSA  — score whole 128-token blocks, keep the top-k blocks, attend every token in them.
//   LSA  — Hierarchical Indexing: a cheap COARSE pass recalls candidate blocks, then a
//          FINE pass picks the most relevant individual *tokens* inside those blocks.
// Flip the mode to watch the budget move from whole blocks to token-precise selection.
// Illustrative — real configs and budgets are described in the prose.

const LSA = "oklch(0.62 0.16 150)" // LongCat green
const MSA = "oklch(0.60 0.15 255)" // MiniMax blue (ties to the MSA article)
const LOCAL = "oklch(0.72 0.15 60)"

const NB = 8 // key blocks shown
const T = 8 // tokens drawn per block
const BLK_K = 3 // MSA: top-k whole blocks (+ local)
const RECALL = 4 // LSA: coarse-recalled candidate blocks (+ local)
const FINE = 3 // LSA: fine tokens kept per recalled block

// deterministic block-level saliency for a given query position
function blockScore(q: number, b: number) {
  const s = Math.sin((b + 1) * 1.9 + q * 0.7)
  const t = Math.cos((b + 1) * 0.5 + q * 0.3)
  return Math.min(1, Math.max(0, (s * 0.6 + t * 0.4 + 1) / 2))
}
// deterministic token-level saliency inside a block
function tokenScore(q: number, b: number, t: number) {
  const s = Math.sin((t + 1) * 2.3 + (b + 1) * 1.1 + q * 0.4)
  return Math.min(1, Math.max(0, (s + 1) / 2))
}

// scene geometry (viewBox units)
const W = 760
const H = 322
const MX = 36
const GAP = 16
const BW = (W - 2 * MX - (NB - 1) * GAP) / NB
const BY = 58
const BH = 46
const PAD = 5
const INW = BW - 2 * PAD
const CGAP = 2
const CW = (INW - (T - 1) * CGAP) / T
const CY = BY + 12
const CH = BH - 18
const QY = 250
const QH = 44

const bx = (b: number) => MX + b * (BW + GAP)
const cx = (b: number) => bx(b) + BW / 2
const tx = (b: number, t: number) => bx(b) + PAD + t * (CW + CGAP)

type Mode = "msa" | "lsa"
type Stage = "recall" | "select"

export function LsaIndex() {
  const [mode, setMode] = useState<Mode>("lsa")
  const [stage, setStage] = useState<Stage>("select")
  const [q, setQ] = useState(NB - 1)

  const ACC = mode === "lsa" ? LSA : MSA
  const local = q // query's own (local) block

  // block ranking by coarse score (excluding the local block, always kept)
  const ranked = Array.from({ length: q }, (_, b) => b).sort(
    (a, b) => blockScore(q, b) - blockScore(q, a)
  )
  const msaBlocks = new Set<number>([local, ...ranked.slice(0, BLK_K)])
  const recalled = new Set<number>([local, ...ranked.slice(0, RECALL)])

  // LSA fine selection: top-FINE tokens within each recalled block
  const fineTokens = new Map<number, Set<number>>()
  for (const b of recalled) {
    const ts = Array.from({ length: T }, (_, t) => t)
      .sort((a, c) => tokenScore(q, b, c) - tokenScore(q, b, a))
      .slice(0, FINE)
    fineTokens.set(b, new Set(ts))
  }

  const qx = W / 2
  const curve = (x2: number, y2: number) => {
    const x1 = qx
    const y1 = QY
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  // which blocks get a connector
  const linked = mode === "msa" ? msaBlocks : recalled

  // readout
  const msaTokens = msaBlocks.size * 128
  const lsaTokens = [...recalled].reduce(
    (n, b) => n + (b === local ? 128 : (fineTokens.get(b)?.size ?? 0) * (128 / T)),
    0
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>sparse attention · block top-k vs hierarchical index</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A query at block ${q}. In ${mode.toUpperCase()} mode it attends ${
            mode === "msa" ? `${msaBlocks.size} whole blocks` : `tokens inside ${recalled.size} recalled blocks`
          }.`}
        >
          <defs>
            <marker id="lsa-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACC} strokeWidth={1.5} />
            </marker>
            <marker id="lsa-arr-local" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={LOCAL} strokeWidth={1.5} />
            </marker>
            <filter id="lsa-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>
            key blocks · 128 tokens each →
          </text>
          <text x={W - MX} y={30} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={10}>
            {mode === "msa" ? "select whole blocks" : stage === "recall" ? "stage 1 · coarse block recall" : "stage 2 · fine token select"}
          </text>

          {/* connectors behind nodes */}
          {[...linked].map((b) => {
            const isLocal = b === local
            return (
              <path
                key={b}
                d={curve(cx(b), BY + BH)}
                fill="none"
                stroke={isLocal ? LOCAL : ACC}
                strokeWidth={1.5}
                markerEnd={`url(#${isLocal ? "lsa-arr-local" : "lsa-arr"})`}
                opacity={0.7}
              />
            )
          })}

          {/* key blocks */}
          {Array.from({ length: NB }, (_, b) => {
            const visible = b <= q
            const isLocal = b === local
            const inMsa = msaBlocks.has(b)
            const inRecall = recalled.has(b)
            const score = blockScore(q, b)

            // outer block frame
            let frameFill = "var(--muted)"
            let frameOp = visible ? 0.28 : 0.1
            let frameStroke = "transparent"
            if (visible && !isLocal) {
              if (mode === "msa" && inMsa) {
                frameFill = MSA
                frameOp = 0.85
                frameStroke = MSA
              } else if (mode === "lsa" && inRecall) {
                // recalled candidates: light tint; fine stage keeps frame light
                frameFill = LSA
                frameOp = stage === "recall" ? 0.32 : 0.14
                frameStroke = LSA
              }
            }
            if (isLocal && visible) {
              frameFill = LOCAL
              frameOp = mode === "msa" ? 0.85 : 0.5
              frameStroke = LOCAL
            }

            return (
              <g key={b}>
                <rect
                  x={bx(b)}
                  y={BY}
                  width={BW}
                  height={BH}
                  rx={6}
                  fill={frameFill}
                  opacity={frameOp}
                  stroke={frameStroke}
                  strokeWidth={1.5}
                  filter={(inMsa && mode === "msa") || (inRecall && mode === "lsa") ? "url(#lsa-soft)" : undefined}
                  className="transition-all duration-300"
                />

                {/* token cells — only meaningful in LSA fine stage */}
                {Array.from({ length: T }, (_, t) => {
                  const fineSel = mode === "lsa" && stage === "select" && inRecall && !isLocal && fineTokens.get(b)?.has(t)
                  const localAll = isLocal && visible
                  const ts = tokenScore(q, b, t)
                  let f = "var(--muted-foreground)"
                  let o = 0.12
                  if (fineSel) {
                    f = LSA
                    o = 0.95
                  } else if (localAll && mode === "lsa") {
                    f = LOCAL
                    o = 0.55
                  } else if (mode === "lsa" && stage === "recall" && inRecall) {
                    // hint the underlying token saliency during recall
                    f = LSA
                    o = 0.1 + 0.25 * ts
                  }
                  if (!visible) o = 0.06
                  return (
                    <rect
                      key={t}
                      x={tx(b, t)}
                      y={CY}
                      width={CW}
                      height={CH}
                      rx={1.5}
                      fill={f}
                      opacity={o}
                      className="transition-all duration-300"
                    />
                  )
                })}

                {/* coarse score pip above block (both modes score at block level first) */}
                {visible && !isLocal && (
                  <rect
                    x={bx(b)}
                    y={BY - 8}
                    width={BW * score}
                    height={3}
                    rx={1.5}
                    fill={ACC}
                    opacity={0.5}
                    className="transition-all duration-300"
                  />
                )}

                <text x={cx(b)} y={BY + BH + 13} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>
                  {b}
                </text>
              </g>
            )
          })}

          {/* query node */}
          <g>
            <rect x={qx - 96} y={QY} width={192} height={QH} rx={8} fill="var(--background)" stroke={ACC} strokeWidth={1.5} filter="url(#lsa-soft)" />
            <text x={qx} y={QY + 18} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
              query · block {q}
            </text>
            <text x={qx} y={QY + 33} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {mode === "msa" ? `top-${BLK_K} blocks + local` : `recall ${RECALL} → keep top tokens`}
            </text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">mode</span>
            <button
              type="button"
              onClick={() => setMode("msa")}
              aria-pressed={mode === "msa"}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                mode === "msa" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === "msa" ? { background: MSA } : undefined}
            >
              MSA block top-k
            </button>
            <button
              type="button"
              onClick={() => setMode("lsa")}
              aria-pressed={mode === "lsa"}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                mode === "lsa" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === "lsa" ? { background: LSA } : undefined}
            >
              LSA hierarchical
            </button>
          </div>

          {mode === "lsa" && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">stage</span>
              {(["recall", "select"] as Stage[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  aria-pressed={stage === s}
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                    stage === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "recall" ? "1 · recall" : "2 · select"}
                </button>
              ))}
            </div>
          )}

          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {mode === "msa" ? (
              <>
                reads <span style={{ color: MSA }}>{msaBlocks.size}</span> whole blocks · ~{msaTokens} tok
              </>
            ) : (
              <>
                reads <span style={{ color: LSA }}>tokens</span> in {recalled.size} recalled blocks · ~{Math.round(lsaTokens)} tok
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">query position (drag)</div>
          <Range
            min={RECALL + 1}
            max={NB - 1}
            value={q}
            onChange={(e) => setQ(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: ACC }}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both methods first score the past at the <span className="text-foreground">block</span> level (the pips above each block).{" "}
          <span style={{ color: MSA }}>MSA</span> stops there — it keeps the top-{BLK_K} whole blocks and attends every token inside them.{" "}
          <span style={{ color: LSA }}>LSA</span> treats that as a coarse <em>recall</em>, then runs a second, fine pass that keeps only
          the most relevant individual <span className="text-foreground">tokens</span> inside the recalled blocks — token-precise selection
          for a smaller candidate set to score. The local block (
          <span style={{ color: LOCAL }}>amber</span>) is always kept.
        </p>
      </div>
    </figure>
  )
}
