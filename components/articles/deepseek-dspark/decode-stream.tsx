"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Watch speculative decoding actually run. Each round the drafter proposes a block
// of W tokens (shown faint, ahead of the cursor); the target verifies them in one
// forward, the matching prefix turns solid, the first miss flashes and is replaced
// by the target's bonus token, and the cursor jumps by the accepted length g. The
// meters tot up real tokens vs target forwards — the speedup is just the mean g,
// the tokens each expensive forward bought. Hand-authored trace; loops forever.

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
  // commit
  const g = Math.max(1, acceptFor(s) + 1)
  const committed = s.committed + g
  if (committed >= TOKENS.length - 1) return START // loop
  return { committed, round: s.round + 1, forwards: s.forwards + 1, phase: "draft" }
}

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
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>speculative decoding · live</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* the stream */}
        <div className="min-h-[92px] rounded-md border bg-muted/20 p-3 font-mono text-sm leading-7">
          {TOKENS.slice(0, s.committed).map((t, i) => (
            <span key={i} className="text-foreground">
              {t}{" "}
            </span>
          ))}
          {s.phase !== "commit" &&
            TOKENS.slice(s.committed, s.committed + draftLen).map((t, i) => {
              const accepted = i < accept
              const isBonus = i === accept
              if (s.phase === "draft") {
                return (
                  <span key={i} className="text-muted-foreground/40">
                    {t}{" "}
                  </span>
                )
              }
              return (
                <span
                  key={i}
                  className={cn(
                    "rounded px-0.5",
                    accepted
                      ? "text-background"
                      : isBonus
                        ? "text-foreground underline decoration-dotted"
                        : "text-destructive line-through opacity-50"
                  )}
                  style={accepted ? { background: "oklch(0.72 0.15 150)" } : undefined}
                >
                  {t}{" "}
                </span>
              )
            })}
          <span
            className="inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-foreground/60"
            aria-hidden
          />
        </div>

        <div className="font-mono text-[11px] text-muted-foreground">
          {s.phase === "draft"
            ? `1 · drafter proposes ${draftLen} tokens in one pass (faint)`
            : s.phase === "verify"
              ? `2 · target verifies in one forward → keep ${accept}, drop ${draftLen - accept}, +1 bonus`
              : `3 · commit ${g} tokens, advance the cursor`}
        </div>

        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="tokens out" value={`${s.committed}`} />
          <Stat label="target forwards" value={`${s.forwards}`} />
          <Stat label="mean g" value={`${avgG.toFixed(2)}`} highlight />
          <Stat label="vs vanilla" value={`${avgG.toFixed(1)}×`} highlight />
        </div>

        <div className="space-y-1.5">
          <Bar label="DSpark" frac={1} note={`${avgG.toFixed(1)}× tokens / forward`} highlight />
          <Bar label="vanilla" frac={1 / Math.max(avgG, 1)} note="1 token / forward" />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Vanilla decoding emits exactly one token per target forward. Speculative
          decoding emits <span className="text-foreground">g</span> — and because the
          acceptance rule is exact, the text is identical either way. DSpark&rsquo;s job
          is to push the mean g up (better drafting) and spend forwards only where they
          pay off (smarter verification).
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium text-foreground", highlight && "")}>{value}</div>
    </div>
  )
}

function Bar({
  label,
  frac,
  note,
  highlight,
}: {
  label: string
  frac: number
  note: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      <span className="w-14 shrink-0 text-right text-muted-foreground">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
        <div
          className="h-full rounded transition-all duration-500"
          style={{
            width: `${Math.max(frac * 100, 4)}%`,
            background: highlight ? "oklch(0.72 0.15 195)" : "oklch(0.62 0.02 260)",
          }}
        />
      </div>
      <span className="w-40 shrink-0 text-[10px] text-muted-foreground">{note}</span>
    </div>
  )
}
