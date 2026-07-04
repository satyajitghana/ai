"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Cosmos 3's Mixture-of-Transformers, drawn as a scene. Two towers share ONE token
// sequence: an autoregressive Reasoner (its keys/values = K_AR) and a diffusion
// Generator (K_DM). The load-bearing move is dual-stream JOINT ATTENTION: the
// diffusion query Q_DM attends over the CONCATENATION [K_AR ; K_DM] — it reads the
// reasoner's keys, so planning flows into generation. Meanwhile the reasoner attends
// only causally over its own K_AR. Step: reason -> attend -> generate. Illustrative.

const REASON = "oklch(0.58 0.15 262)" // AR reasoner (blue-violet, matches paper)
const GEN = "oklch(0.70 0.15 55)" // DM generator (orange, matches paper)

type Stage = "reason" | "attend" | "generate"

// scene geometry (viewBox units)
const W = 760
const H = 352
const AR_N = 5
const DM_N = 4
const BW = 44
const GAP = 10
const GROUPGAP = 44
const STRIP_W = AR_N * BW + (AR_N - 1) * GAP + GROUPGAP + DM_N * BW + (DM_N - 1) * GAP
const SX = (W - STRIP_W) / 2
const DMSTART = SX + AR_N * BW + (AR_N - 1) * GAP + GROUPGAP
const BY = 66
const BH = 34
const QY = 250
const QH = 46
const QX = W / 2
const QW = 232
const DIV = (SX + AR_N * BW + (AR_N - 1) * GAP + DMSTART) / 2

const arX = (i: number) => SX + i * (BW + GAP)
const dmX = (j: number) => DMSTART + j * (BW + GAP)

type Key = { x: number; kind: "ar" | "dm"; label: string }
const KEYS: Key[] = [
  ...Array.from({ length: AR_N }, (_, i) => ({ x: arX(i), kind: "ar" as const, label: `r${i + 1}` })),
  ...Array.from({ length: DM_N }, (_, j) => ({ x: dmX(j), kind: "dm" as const, label: `f${j + 1}` })),
]

// filmstrip (generate stage)
const FRAME_N = 4
const FW = 46
const FGAP = 10
const FSTRIP = FRAME_N * FW + (FRAME_N - 1) * FGAP
const FSX = (W - FSTRIP) / 2
const FY = 308
const FH = 34

export function DualStream() {
  const [stage, setStage] = useState<Stage>("attend")

  // vertical S-curve from the query up to a key block's bottom edge
  const curve = (x2: number) => {
    const x1 = QX, y1 = QY, y2 = BY + BH
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }
  // small causal bow between two adjacent AR keys (reason stage)
  const bow = (x1: number, x2: number) => {
    const y = BY + BH + 6
    return `M ${x1} ${y} C ${x1} ${y + 16}, ${x2} ${y + 16}, ${x2} ${y}`
  }

  const attend = stage === "attend"
  const gen = stage === "generate"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mixture-of-transformers · one sequence, two towers</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Two towers share one token sequence. The reasoner's keys K_AR sit on the left, the generator's keys K_DM on the right. During joint attention the diffusion query attends over both K_AR and K_DM; the reasoner attends only causally over K_AR.`}>
          <defs>
            <marker id="cw-ar" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={REASON} strokeWidth={1.5} />
            </marker>
            <marker id="cw-dm" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GEN} strokeWidth={1.5} />
            </marker>
            <filter id="cw-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* group labels */}
          <text x={(SX + arX(AR_N - 1) + BW) / 2} y={30} textAnchor="middle" className="font-mono" fontSize={11} fill={REASON}>reasoner keys · K_AR</text>
          <text x={(DMSTART + dmX(DM_N - 1) + BW) / 2} y={30} textAnchor="middle" className="font-mono" fontSize={11} fill={GEN}>generator keys · K_DM</text>
          <text x={W / 2} y={48} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>one shared sequence  [ K_AR ; K_DM ]</text>

          {/* group divider */}
          <line x1={DIV} y1={BY - 10} x2={DIV} y2={BY + BH + 10} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />

          {/* connectors, drawn behind nodes */}
          {stage === "reason" &&
            Array.from({ length: AR_N - 1 }, (_, i) => (
              <path key={`b${i}`} d={bow(arX(i) + BW / 2, arX(i + 1) + BW / 2)} fill="none" stroke={REASON} strokeWidth={1.5} opacity={0.55} markerEnd="url(#cw-ar)" />
            ))}

          {attend &&
            KEYS.map((k, i) => (
              <path key={`f${i}`} d={curve(k.x + BW / 2)} fill="none" stroke={k.kind === "ar" ? REASON : GEN} strokeWidth={1.5} opacity={0.75} markerEnd={`url(#cw-${k.kind})`} className="transition-all duration-300" />
            ))}

          {/* key blocks */}
          {KEYS.map((k, i) => {
            const isAr = k.kind === "ar"
            const base = isAr ? REASON : GEN
            let fill = base
            let op = 0.85
            let stroke = base
            if (stage === "reason") {
              if (!isAr) { fill = "var(--muted)"; op = 0.14; stroke = "transparent" }
            } else if (gen) {
              op = isAr ? 0.35 : 0.55
            }
            return (
              <g key={i}>
                <rect x={k.x} y={BY} width={BW} height={BH} rx={7} fill={fill} opacity={op} stroke={stroke} strokeWidth={1.5} filter={op > 0.5 ? "url(#cw-soft)" : undefined} className="transition-all duration-300" />
                <text x={k.x + BW / 2} y={BY + BH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={10} fill={op > 0.5 ? "var(--background)" : "var(--muted-foreground)"}>{k.label}</text>
              </g>
            )
          })}

          {/* query node */}
          <g opacity={stage === "reason" ? 0.4 : 1} className="transition-all duration-300">
            <rect x={QX - QW / 2} y={QY} width={QW} height={QH} rx={9} fill="var(--background)" stroke={GEN} strokeWidth={1.5} filter="url(#cw-soft)" />
            <text x={QX} y={QY + 19} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill="var(--foreground)">generator query · Q_DM</text>
            <text x={QX} y={QY + 34} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">
              {stage === "reason" ? "waiting on the plan" : attend ? "attends [ K_AR ; K_DM ]" : "denoises the next frames"}
            </text>
          </g>

          {/* generate filmstrip */}
          {gen && (
            <g className="transition-all duration-300">
              <path d={`M ${QX} ${QY + QH} C ${QX} ${QY + QH + 8}, ${QX} ${FY - 8}, ${QX} ${FY}`} fill="none" stroke={GEN} strokeWidth={1.5} opacity={0.8} markerEnd="url(#cw-dm)" />
              {Array.from({ length: FRAME_N }, (_, i) => (
                <g key={i}>
                  <rect x={FSX + i * (FW + FGAP)} y={FY} width={FW} height={FH} rx={5} fill={GEN} opacity={0.9} filter="url(#cw-soft)" />
                  <text x={FSX + i * (FW + FGAP) + FW / 2} y={FY + FH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--background)">t+{i + 1}</text>
                </g>
              ))}
            </g>
          )}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            {(["reason", "attend", "generate"] as Stage[]).map((s) => (
              <button key={s} type="button" onClick={() => setStage(s)} aria-pressed={stage === s}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", stage === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {stage === "reason" ? (
              <>the <span style={{ color: REASON }}>reasoner</span> plans, causal over its own keys</>
            ) : attend ? (
              <>the <span style={{ color: GEN }}>generator query</span> reads <span style={{ color: REASON }}>K_AR</span> + <span style={{ color: GEN }}>K_DM</span></>
            ) : (
              <>the <span style={{ color: GEN }}>generator</span> emits the next frames</>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two towers, one sequence. The <span style={{ color: REASON }}>Reasoner</span> is autoregressive and attends
          only <span className="text-foreground">causally over its own keys</span> — it does the planning. The{" "}
          <span style={{ color: GEN }}>Generator</span> is a diffusion model, and its query fans out over the{" "}
          <span className="text-foreground">concatenation [ K_AR ; K_DM ]</span> — so it can read the reasoner&apos;s
          keys and values directly. That single cross-stream read is how a plan turns into pixels: reasoning is fused
          into generation inside one attention operation, not bolted on afterward.
        </p>
      </div>
    </figure>
  )
}
