"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Three ways to survive routing imbalance in an MoE layer, on eight experts.
//   drop     : fixed capacity C per expert, overflow tokens are dropped
//   pad      : allocate for the worst expert, memory = E x max load
//   rounds   : MAI-Base-2's multi-round dropless MoE. Fixed capacity C per expert,
//              overflow runs in extra dispatch -> compute -> collect rounds, and an
//              overloaded expert may borrow unused capacity from its expert group.
// The round count is global, so the slowest group sets it. Illustrative loads.

const ACCENT = "oklch(0.6 0.16 45)"
const ALT = "oklch(0.55 0.12 200)"
const WARN = "oklch(0.58 0.2 20)"

const E = 8
const MEAN = 32 // tokens per expert at perfect balance
const TOTAL = E * MEAN
const PERM = [2, 6, 0, 4, 7, 1, 5, 3] // which expert gets the k-th hottest share

const W = 760
const H = 330
const X0 = 60
const PW = 640
const BASE = 280
const TOPY = 40
const R2 = (n: number): number => Math.round(n * 100) / 100

function loads(skew: number): number[] {
  const w = Array.from({ length: E }, (_, k) => mpow(k + 1, -skew))
  const sum = w.reduce((a, b) => a + b, 0)
  const raw = w.map((x) => (x / sum) * TOTAL)
  const fl = raw.map((x) => Math.floor(x))
  let left = TOTAL - fl.reduce((a, b) => a + b, 0)
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (const [, i] of order) {
    if (left <= 0) break
    fl[i] += 1
    left -= 1
  }
  const out = new Array<number>(E).fill(0)
  PERM.forEach((expert, k) => {
    out[expert] = fl[k]
  })
  return out
}

export function MultiRoundMoE() {
  const [skew, setSkew] = useState(0.6)
  const [cf, setCf] = useState(1.25)
  const [group, setGroup] = useState(4)

  const L = loads(skew)
  const C = Math.round(MEAN * cf)
  const maxL = Math.max(...L)
  const dropped = L.reduce((a, l) => a + Math.max(0, l - C), 0)

  const groups = Array.from({ length: E / group }, (_, g) => L.slice(g * group, (g + 1) * group))
  const roundsByGroup = groups.map((gl) => Math.max(1, Math.ceil(gl.reduce((a, b) => a + b, 0) / (group * C))))
  const rounds = Math.max(...roundsByGroup)
  const noBorrow = Math.max(...L.map((l) => Math.max(1, Math.ceil(l / C))))

  const yMax = Math.max(maxL, C) * 1.15
  const y = (v: number) => R2(BASE - (v / yMax) * (BASE - TOPY))
  const colW = PW / E
  const capY = y(C)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>multi-round dropless MoE · fixed memory, variable rounds</span>
        <span className="text-muted-foreground/50">illustrative loads</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Eight experts, capacity ${C} tokens each. Dropping would lose ${dropped} of ${TOTAL} tokens; multi-round dropless needs ${rounds} round(s) with groups of ${group}.`}
        >
          {groups.map((_, g) => (
            <g key={g}>
              <rect
                x={R2(X0 + g * group * colW + 3)}
                y={TOPY - 22}
                width={R2(group * colW - 6)}
                height={BASE - TOPY + 44}
                rx={8}
                fill="none"
                stroke="var(--border)"
                strokeDasharray="4 3"
              />
              <text x={R2(X0 + g * group * colW + 10)} y={TOPY - 8} className="fill-muted-foreground font-mono" fontSize={9}>
                {group > 1 ? `group ${g} · ${roundsByGroup[g]} round${roundsByGroup[g] > 1 ? "s" : ""}` : `${roundsByGroup[g]}r`}
              </text>
            </g>
          ))}

          {L.map((l, i) => {
            const x = R2(X0 + i * colW + colW * 0.22)
            const w = R2(colW * 0.56)
            const inCap = Math.min(l, C)
            const over = Math.max(0, l - C)
            return (
              <g key={i}>
                <rect x={x} y={y(inCap)} width={w} height={R2(BASE - y(inCap))} rx={3} fill={ALT} />
                {over > 0 && (
                  <rect x={x} y={y(l)} width={w} height={R2(y(C) - y(l))} rx={3} fill={WARN} fillOpacity={0.75} />
                )}
                <text x={R2(x + w / 2)} y={y(l) - 5} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
                  {l}
                </text>
                <text x={R2(x + w / 2)} y={BASE + 15} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                  E{i}
                </text>
              </g>
            )
          })}

          <line x1={X0} y1={capY} x2={X0 + PW} y2={capY} stroke={ACCENT} strokeWidth={1.6} strokeDasharray="6 4" />
          <text x={X0 - 6} y={capY + 4} textAnchor="end" className="font-mono" fontSize={10} fill={ACCENT}>
            C={C}
          </text>
          <line x1={X0} y1={BASE} x2={X0 + PW} y2={BASE} stroke="var(--border)" />
        </svg>

        <div className="mt-1 grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">drop overflow</div>
            <div style={{ color: dropped > 0 ? WARN : undefined }}>
              {dropped} of {TOTAL} tokens lost ({((dropped / TOTAL) * 100).toFixed(1)}%)
            </div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">pad for the worst expert</div>
            <div>
              {E * maxL} slots vs {E * C} ({((maxL / C) * 100).toFixed(0)}% of fixed)
            </div>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground">multi-round (MAI-Base-2)</div>
            <div style={{ color: ACCENT }}>
              {E * C} slots · {rounds} round{rounds > 1 ? "s" : ""}
              {noBorrow !== rounds ? ` (${noBorrow} without borrowing)` : ""}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>routing skew</span>
              <span className="text-foreground">{skew.toFixed(2)}</span>
            </div>
            <Range min={0} max={1.6} step={0.05} value={skew} onChange={(e) => setSkew(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} aria-label="routing skew" />
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>capacity per expert (× mean load)</span>
              <span className="text-foreground">{cf.toFixed(2)}</span>
            </div>
            <Range min={1} max={2.5} step={0.05} value={cf} onChange={(e) => setCf(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} aria-label="capacity factor" />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">expert group size</span>
          {[1, 2, 4, 8].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                (group === g ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
              }
            >
              {g}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Memory is fixed at experts × capacity whatever the router does. Imbalance now costs time, not a crash or lost
          tokens: each overflow forces another round for everyone, because the round count is global. Bigger groups let a
          hot expert borrow a cold neighbour&apos;s slots, which is why they need fewer rounds. The loads are made up; the
          schedule is the one Microsoft describes.
        </p>
      </div>
    </figure>
  )
}
