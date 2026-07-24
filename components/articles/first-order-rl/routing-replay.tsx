"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why MoE breaks the token-level IS ratio, and how Routing Replay repairs it.
// For one token, the inference engine (µ, FP8) routes it to a set of experts eµ;
// the training engine (π, BF16) would independently route it to eπ. When those
// sets differ, the ratio πθ(yₜ)/µθ(yₜ) is computed over DIFFERENT active
// parameters, so it no longer measures a small per-token change — the first-order
// approximation collapses. Routing Replay fixes the routed experts to the
// rollout's choice, so the training engine reuses the same experts and the token
// is optimized like a dense one. Toggle replay; watch the two engines' expert
// sets snap into alignment. SSR-safe: fixed sets, no Date/random.

const ACCENT = "oklch(0.62 0.15 255)" // matched / rollout routing
const WARN = "oklch(0.66 0.17 35)" // training-side divergence

const NE = 8
const INFER = [0, 3, 5] // eµ — inference engine (FP8) top-k
const TRAIN_DRIFT = [1, 3, 6] // eπ — training engine (BF16) diverges when not replayed

const W = 760
const H = 320
const MX = 70
const EW = 52
const EGAP = (W - 2 * MX - NE * EW) / (NE - 1)
const EY = 54
const EH = 34
const ex = (i: number) => MX + i * (EW + EGAP)
const ecx = (i: number) => ex(i) + EW / 2

const ENG_Y = 244
const ENG_H = 50

export function RoutingReplay() {
  const [replay, setReplay] = useState(false)

  const infer = INFER
  const train = replay ? INFER : TRAIN_DRIFT
  const inferSet = new Set(infer)
  const trainSet = new Set(train)
  const overlap = infer.filter((i) => trainSet.has(i)).length

  // engine anchor points (top-center of each engine node)
  const infAnchor = { x: 200, y: ENG_Y }
  const trnAnchor = { x: 560, y: ENG_Y }

  const curve = (from: { x: number; y: number }, i: number) => {
    const x2 = ecx(i)
    const y2 = EY + EH
    const my = (from.y + y2) / 2
    return `M ${from.x} ${from.y} C ${from.x} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>MoE routing · one token, two engines</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A token routed through 8 experts. Inference and training engines share ${overlap} of 3 routed experts; Routing Replay is ${replay ? "on, so both engines use identical experts" : "off, so the engines diverge"}.`}
        >
          <defs>
            <marker id="rr-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="rr-arrow-warn" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={WARN} strokeWidth={1.5} />
            </marker>
            <filter id="rr-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={32} className="fill-muted-foreground font-mono" fontSize={11}>
            expert bank · router activates top-k per token
          </text>

          {/* expert bank */}
          {Array.from({ length: NE }, (_, i) => {
            const inInf = inferSet.has(i)
            const inTrn = trainSet.has(i)
            const both = inInf && inTrn
            const trainOnly = inTrn && !inInf
            let fill = "var(--muted)"
            let op = 0.35
            let stroke = "transparent"
            if (both) { fill = ACCENT; op = 0.9; stroke = ACCENT }
            else if (inInf) { fill = ACCENT; op = 0.16; stroke = ACCENT }
            else if (trainOnly) { fill = WARN; op = 0.85; stroke = WARN }
            return (
              <g key={i}>
                <rect
                  x={ex(i)}
                  y={EY}
                  width={EW}
                  height={EH}
                  rx={7}
                  fill={fill}
                  opacity={op}
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={trainOnly ? "4 3" : undefined}
                  filter={both ? "url(#rr-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text x={ecx(i)} y={EY + 22} textAnchor="middle" className={cn("font-mono", both || trainOnly ? "fill-background" : "fill-muted-foreground")} fontSize={12} fontWeight={600}>
                  E{i + 1}
                </text>
              </g>
            )
          })}

          {/* routing connectors — inference (accent) then training (accent if matched, warn if diverged) */}
          {infer.map((i) => (
            <path key={`inf-${i}`} d={curve(infAnchor, i)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#rr-arrow)" opacity={0.55} />
          ))}
          {train.map((i) => {
            const matched = inferSet.has(i)
            return (
              <path
                key={`trn-${i}`}
                d={curve(trnAnchor, i)}
                fill="none"
                stroke={matched ? ACCENT : WARN}
                strokeWidth={1.5}
                strokeDasharray={matched ? undefined : "5 3"}
                markerEnd={matched ? "url(#rr-arrow)" : "url(#rr-arrow-warn)"}
                opacity={matched ? 0.55 : 0.85}
              />
            )
          })}

          {/* engine nodes */}
          <g>
            <rect x={infAnchor.x - 92} y={ENG_Y} width={184} height={ENG_H} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#rr-soft)" />
            <text x={infAnchor.x} y={ENG_Y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
              inference engine
            </text>
            <text x={infAnchor.x} y={ENG_Y + 36} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              rollout µθ · FP8 · picks eµ
            </text>
          </g>
          <g>
            <rect x={trnAnchor.x - 92} y={ENG_Y} width={184} height={ENG_H} rx={9} fill="var(--background)" stroke={replay ? ACCENT : WARN} strokeWidth={1.5} filter="url(#rr-soft)" />
            <text x={trnAnchor.x} y={ENG_Y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
              training engine
            </text>
            <text x={trnAnchor.x} y={ENG_Y + 36} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              target πθ · BF16 · picks eπ
            </text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">Routing Replay</span>
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setReplay(v)}
                aria-pressed={replay === v}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  replay === v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={replay === v ? { background: v ? ACCENT : WARN } : undefined}
              >
                {v ? "on" : "off"}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            expert overlap <span style={{ color: replay ? ACCENT : WARN }}>{overlap}/3</span> ·{" "}
            {replay ? "IS ratio valid — optimized like dense" : "IS ratio invalid — routing entangled"}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Off, the two engines route the same token to <span style={{ color: WARN }}>different experts</span> — the
          per-token ratio compares different active parameters and stops meaning &ldquo;a small policy change,&rdquo; so
          the first-order approximation collapses. On, replay pins the training engine to the{" "}
          <span style={{ color: ACCENT }}>rollout&rsquo;s experts</span>, and the token is optimized like a dense one.
          The trade: pinning the experts subtly biases the target policy away from its own natural routing.
        </p>
      </div>
    </figure>
  )
}
