"use client"

import { useState } from "react"
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr"

// One round of speculative decoding, drawn as a scene. A cheap draft proposes a
// block of W tokens in a single pass (top row); the target verifies all W in ONE
// forward and accepts the longest prefix that matches its own greedy choice, then
// emits one free "bonus" token at the mismatch. Green connectors = accepted, the
// red one = the first disagreement (tail thrown away), the accent one = the
// target's own correction. Accepted length g is what that one expensive forward
// bought. Hand-authored trace of a code-generation example; illustrative.

const GREEN = "oklch(0.72 0.15 150)"
const RED = "oklch(0.62 0.20 25)"
const ACCENT = "oklch(0.60 0.15 255)"

type Round = {
  ctx: string
  draft: string[]
  // index of the first REJECTED draft token (everything before it is accepted)
  accept: number
  bonus: string // the token the target emits at the mismatch position (always correct)
}

// Generating a small Python function, block size W = 5 (DSpark's released config).
const ROUNDS: Round[] = [
  { ctx: "def fib(n):", draft: ["\\n", "    if", " n", " <", " 2"], accept: 5, bonus: ":" },
  { ctx: "…if n < 2:", draft: ["\\n", "        return", " n", "\\n", "    return"], accept: 5, bonus: " fib" },
  { ctx: "…return fib", draft: ["(n", "-1)", " +", " fib(n", "-3)"], accept: 4, bonus: "-2)" },
]

// scene geometry (viewBox units)
const W = 680
const H = 226
const MX = 30
const COLS = 5
const COLW = (W - 2 * MX) / COLS
const colCx = (i: number) => MX + COLW * (i + 0.5)
const PH = 30 // pill height
const DRAFT_Y = 40 // draft row top
const BAND_Y = 106
const BAND_H = 32
const OUT_Y = 172
const disp = (t: string) => t.trim() || "␣"
const pillW = (t: string) => Math.min(COLW - 14, Math.max(30, disp(t).length * 7 + 16))

export function DraftVerify() {
  const [r, setR] = useState(0)
  const round = ROUNDS[r]
  const accept = Math.min(round.accept, round.draft.length)
  const allMatched = round.accept >= round.draft.length
  const g = accept + 1 // accepted drafts + the bonus token

  // short vertical S-curve between two points
  const link = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>speculative round · draft → verify → accept</span>
        <span className="text-muted-foreground/60">round {r + 1}/{ROUNDS.length}</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 font-mono text-xs text-muted-foreground">
          context so far: <span className="text-foreground">{round.ctx}</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={`Draft proposes 5 tokens; target accepts ${accept} then emits a bonus token, for ${g} real tokens in one forward`}>
          <defs>
            <marker id="dv-g" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GREEN} strokeWidth={1.5} />
            </marker>
            <marker id="dv-a" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="dv-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
            1 · draft proposes {round.draft.length} tokens · one pass →
          </text>

          {/* draft → target connectors */}
          {round.draft.map((_, i) => {
            const ok = i < accept
            const mismatch = i === accept
            const stroke = ok ? GREEN : mismatch ? RED : "var(--border)"
            return (
              <path key={i} d={link(colCx(i), DRAFT_Y + PH, colCx(i), BAND_Y)} fill="none"
                stroke={stroke} strokeWidth={1.5} strokeDasharray={i > accept ? "3 3" : undefined}
                opacity={i > accept ? 0.4 : 0.85} />
            )
          })}

          {/* draft pills */}
          {round.draft.map((t, i) => {
            const dropped = i >= accept
            return (
              <g key={i}>
                <rect x={colCx(i) - pillW(t) / 2} y={DRAFT_Y} width={pillW(t)} height={PH} rx={7}
                  fill="var(--background)" stroke={dropped ? "var(--border)" : GREEN} strokeWidth={1.5}
                  opacity={dropped && !allMatched ? 0.5 : 1} filter="url(#dv-soft)" />
                <text x={colCx(i)} y={DRAFT_Y + 19} textAnchor="middle"
                  className={dropped && !allMatched ? "fill-muted-foreground font-mono" : "fill-foreground font-mono"}
                  fontSize={11} textDecoration={i === accept ? "line-through" : undefined}>
                  {disp(t)}
                </text>
              </g>
            )
          })}

          {/* target band */}
          <rect x={MX} y={BAND_Y} width={W - 2 * MX} height={BAND_H} rx={8}
            fill="var(--muted)" opacity={0.5} stroke="var(--border)" strokeWidth={1.5} />
          <rect x={MX} y={BAND_Y} width={W - 2 * MX} height={BAND_H} rx={8} fill="none"
            stroke="var(--border)" strokeWidth={1.5} filter="url(#dv-soft)" />
          <text x={W / 2} y={BAND_Y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            2 · target · verifies all {round.draft.length} in one forward
          </text>

          {/* target → output connectors + output pills */}
          {Array.from({ length: g }, (_, i) => {
            const bonus = i === accept
            const t = bonus ? round.bonus : round.draft[i]
            const stroke = bonus ? ACCENT : GREEN
            return (
              <g key={i}>
                <path d={link(colCx(i), BAND_Y + BAND_H, colCx(i), OUT_Y)} fill="none"
                  stroke={stroke} strokeWidth={1.5} markerEnd={`url(#${bonus ? "dv-a" : "dv-g"})`} opacity={0.9} />
                <rect x={colCx(i) - pillW(t) / 2} y={OUT_Y} width={pillW(t)} height={PH} rx={7}
                  fill={bonus ? "var(--background)" : GREEN} stroke={stroke} strokeWidth={1.5} filter="url(#dv-soft)" />
                <text x={colCx(i)} y={OUT_Y + 19} textAnchor="middle"
                  className="font-mono" fontSize={11} fontWeight={600}
                  fill={bonus ? ACCENT : "var(--background)"}>
                  {bonus ? "+" : ""}{disp(t)}
                </text>
              </g>
            )
          })}
          <text x={MX} y={OUT_Y + PH + 16} className="fill-muted-foreground font-mono" fontSize={11}>
            3 · commit — accepted prefix{" "}
            <tspan fill={ACCENT}>+ 1 free bonus token</tspan>
          </text>
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>1 target forward → <span className="text-foreground">{g} real tokens</span></span>
          <span style={{ color: GREEN }}>accepted {accept}</span>
          <span style={{ color: ACCENT }}>+1 bonus</span>
          <span className="ml-auto">{g}× vs autoregressive</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {allMatched
            ? `All ${round.draft.length} drafts matched — one expensive target pass produced ${g} real tokens instead of 1.`
            : `The target disagreed at token ${accept + 1}, so the tail is thrown away — but its own correction is emitted for free, so the round still nets ${g} tokens. Output is bit-identical to plain decoding; only the speed changes.`}
        </p>
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-2 font-mono text-xs">
        <button type="button" onClick={() => setR((n) => Math.max(0, n - 1))} disabled={r === 0}
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
          ← prev
        </button>
        <button type="button" onClick={() => setR((n) => Math.min(ROUNDS.length - 1, n + 1))} disabled={r === ROUNDS.length - 1}
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
          next round →
        </button>
        <button type="button" onClick={() => setR(0)}
          className="ml-auto flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
          <ArrowCounterClockwiseIcon size={13} weight="bold" />
          reset
        </button>
      </div>
    </figure>
  )
}
