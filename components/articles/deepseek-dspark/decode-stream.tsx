"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Watch speculative decoding actually run. Each round the drafter proposes a block
// of W tokens (shown faint, ahead of the cursor); the target verifies them in one
// forward, the matching prefix turns solid, the first miss flashes and is replaced
// by the target's bonus token, and the cursor jumps by the accepted length g. The
// SVG chart tots up tokens per target forward — the speedup is just the mean g,
// the tokens each expensive forward bought. Hand-authored trace; loops forever.

const CYAN = "oklch(0.72 0.15 195)"
const GREEN = "oklch(0.72 0.15 150)"

const TOKENS =
  "def is_prime(n): if n < 2: return False for i in range(2, int(n ** 0.5) + 1): if n % i == 0: return False return True"
    .split(" ")

// per-round count of the W=5 drafted tokens the target accepts (rest dropped; +1
// bonus always emitted). Cycles to vary g like real traffic.
const ACCEPT = [5, 4, 5, 3, 5, 4, 5, 2]

type Phase = "draft" | "verify" | "commit"
type State = { committed: number; round: number; forwards: number; phase: Phase }

const START: State = { committed: 0, round: 0, forwards: 0, phase: "draft" }

function acceptFor(s: State) {
  return Math.min(ACCEPT[s.round % ACCEPT.length], TOKENS.length - s.committed - 1)
}

function next(s: State): State {
  if (s.phase === "draft") return { ...s, phase: "verify" }
  if (s.phase === "verify") return { ...s, phase: "commit" }
  const g = Math.max(1, acceptFor(s) + 1)
  const committed = s.committed + g
  if (committed >= TOKENS.length - 1) return START // loop
  return { committed, round: s.round + 1, forwards: s.forwards + 1, phase: "draft" }
}

// throughput chart geometry (viewBox units)
const CW = 680
const CH = 96
const AXIS_MAX = 5
const PLOT_X0 = 92
const PLOT_X1 = 656
const xFor = (v: number) => PLOT_X0 + (Math.min(v, AXIS_MAX) / AXIS_MAX) * (PLOT_X1 - PLOT_X0)

export function DecodeStream() {
  const [s, setS] = useState<State>(START)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setS((prev) => next(prev)), 850)
    return () => clearInterval(id)
  }, [playing])

  const accept = acceptFor(s)
  const draftLen = Math.min(5, TOKENS.length - s.committed)
  const g = Math.max(1, accept + 1)
  const avgG = s.forwards > 0 ? s.committed / s.forwards : g

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>speculative decoding · live</span>
        <button type="button" onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        {/* the stream — an invisible full-text spacer fixes the height so the
            layout never shifts as tokens stream in (the visible text is always a
            prefix, so it wraps identically). */}
        <div className="relative overflow-hidden rounded-md border bg-muted/20 font-mono text-sm leading-7">
          <div aria-hidden className="invisible p-3">{TOKENS.join(" ")}</div>
          <div className="absolute inset-0 p-3">
            {TOKENS.slice(0, s.committed).map((t, i) => (
              <span key={i} className="text-foreground">{t}{" "}</span>
            ))}
            {s.phase !== "commit" &&
              TOKENS.slice(s.committed, s.committed + draftLen).map((t, i) => {
                const accepted = i < accept
                const isBonus = i === accept
                if (s.phase === "draft") {
                  return <span key={i} className="text-muted-foreground/40">{t}{" "}</span>
                }
                return (
                  <span key={i}
                    className={cn("rounded px-0.5",
                      accepted ? "text-background"
                        : isBonus ? "text-foreground underline decoration-dotted"
                          : "text-destructive line-through opacity-50")}
                    style={accepted ? { background: GREEN } : undefined}>
                    {t}{" "}
                  </span>
                )
              })}
            <span className="inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-foreground/60" aria-hidden />
          </div>
        </div>

        {/* all three phase captions overlaid in one grid cell so the line reserves
            the tallest case and never reflows the layout as the phase flips */}
        <div className="grid font-mono text-[11px] text-muted-foreground">
          {[
            `1 · drafter proposes ${draftLen} tokens in one pass (faint)`,
            `2 · target verifies in one forward → keep ${accept}, drop ${draftLen - accept}, +1 bonus`,
            `3 · commit ${g} tokens, advance the cursor`,
          ].map((msg, i) => {
            const activeIdx = s.phase === "draft" ? 0 : s.phase === "verify" ? 1 : 2
            return (
              <div key={i} aria-hidden={i !== activeIdx}
                className={cn("col-start-1 row-start-1 transition-opacity duration-300",
                  i === activeIdx ? "opacity-100" : "pointer-events-none opacity-0")}>
                {msg}
              </div>
            )
          })}
        </div>

        {/* throughput: tokens produced per one expensive target forward */}
        <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img"
          aria-label={`Tokens per target forward: DSpark ${avgG.toFixed(2)}, vanilla 1`}>
          <defs>
            <filter id="ds-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>
          <text x={PLOT_X0} y={12} className="fill-muted-foreground font-mono" fontSize={10}>tokens per target forward</text>
          {/* gridlines 1..5 */}
          {Array.from({ length: AXIS_MAX }, (_, k) => k + 1).map((v) => (
            <g key={v}>
              <line x1={xFor(v)} y1={20} x2={xFor(v)} y2={82} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text x={xFor(v)} y={94} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>{v}</text>
            </g>
          ))}
          {/* DSpark bar */}
          <text x={PLOT_X0 - 8} y={39} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>DSpark</text>
          <rect x={PLOT_X0} y={26} width={Math.max(xFor(avgG) - PLOT_X0, 2)} height={20} rx={5} fill={CYAN} filter="url(#ds-soft)" className="transition-all duration-500" />
          <text x={xFor(avgG) + 8} y={40} className="fill-foreground font-mono tabular-nums" fontSize={11} fontWeight={600}>{avgG.toFixed(2)}× </text>
          {/* vanilla bar */}
          <text x={PLOT_X0 - 8} y={71} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>vanilla</text>
          <rect x={PLOT_X0} y={58} width={Math.max(xFor(1) - PLOT_X0, 2)} height={20} rx={5} fill="var(--muted-foreground)" opacity={0.55} />
          <text x={xFor(1) + 8} y={72} className="fill-muted-foreground font-mono tabular-nums" fontSize={11}>1×</text>
        </svg>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>tokens out <span className="text-foreground tabular-nums">{s.committed}</span></span>
          <span>target forwards <span className="text-foreground tabular-nums">{s.forwards}</span></span>
          <span className="ml-auto">mean g <span className="tabular-nums" style={{ color: CYAN }}>{avgG.toFixed(2)}</span></span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Vanilla decoding emits exactly one token per target forward. Speculative decoding emits{" "}
          <span className="text-foreground">g</span> — and because the acceptance rule is exact, the text is identical either way. DSpark&rsquo;s job is to push the mean g up (better drafting) and spend forwards only where they pay off (smarter verification).
        </p>
      </div>
    </figure>
  )
}
