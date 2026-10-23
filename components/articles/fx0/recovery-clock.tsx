"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How long a crashed fx0 turn waits before another Vercel function continues it.
//
// Every constant is from the fx0 and libfx READMEs (reported): an 800-second
// maxDuration, a prompt backstop due 5 seconds after that limit, a redelivery
// about 1 second after a process exits, a queue hold of up to five minutes for a
// function that stops without exiting, and a 15-second lease when the app opts
// into vercel({ leaseMs: 15_000 }). The arithmetic is mine (reasoned).

const ACCENT = "oklch(0.60 0.15 40)"
const MUTED = "oklch(0.62 0.03 255)"

const MAX = 800
const BACKSTOP = 5

type Row = { key: string; label: string; sub: string; delay: (t: number) => number; accent?: boolean }

const ROWS: Row[] = [
  {
    key: "prompt",
    label: "prompt request dies",
    sub: "default: lease held to the limit",
    delay: (t) => MAX + BACKSTOP - t,
    accent: true,
  },
  { key: "exit", label: "delivery, process exits", sub: "queue redelivers", delay: () => 1 },
  { key: "stall", label: "delivery stalls", sub: "queue hold runs out", delay: () => 300 },
  { key: "lease", label: "with leaseMs 15000", sub: "every prompt via the queue", delay: () => 15 },
]

const W = 760
const X0 = 200
const X1 = 730
const SPAN = 820

function fmt(s: number): string {
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${m} min ${r} s`
}

export function RecoveryClock() {
  const [t, setT] = useState(20)
  const px = (s: number) => X0 + (Math.min(s, SPAN) / SPAN) * (X1 - X0)
  const H = 40 + ROWS.length * 40 + 24

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Time from a crash to the turn continuing, for a crash ${t} seconds into a turn. Prompt request dies: ${fmt(MAX + BACKSTOP - t)}. Delivery whose process exits: about 1 second. Delivery that stalls: up to 5 minutes. With a 15 second lease: about 15 seconds.`}
      >
        <text x={X0} y={20} className="fill-muted-foreground font-mono" fontSize={9.5}>
          WAIT BEFORE ANOTHER FUNCTION CONTINUES THE TURN
        </text>
        {[0, 200, 400, 600, 800].map((s) => (
          <g key={s}>
            <line x1={px(s)} y1={30} x2={px(s)} y2={H - 22} stroke="var(--border)" strokeWidth={1} />
            <text x={px(s)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {s} s
            </text>
          </g>
        ))}
        {ROWS.map((r, i) => {
          const y = 38 + i * 40
          const d = r.delay(t)
          return (
            <g key={r.key}>
              <text x={X0 - 10} y={y + 11} textAnchor="end" className="fill-foreground" fontSize={11}>
                {r.label}
              </text>
              <text x={X0 - 10} y={y + 24} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
                {r.sub}
              </text>
              <rect
                x={X0}
                y={y + 2}
                width={Math.max(2, px(d) - X0)}
                height={20}
                rx={4}
                fill={r.accent ? ACCENT : MUTED}
                opacity={r.accent ? 0.9 : 0.55}
              />
              <text
                x={Math.min(px(d) + 6, X1 - 4)}
                y={y + 16}
                textAnchor={px(d) + 80 > X1 ? "end" : "start"}
                className="font-mono"
                fontSize={10}
                fill={r.accent ? "var(--background)" : "var(--foreground)"}
              >
                {r.key === "stall" ? "up to " : r.key === "prompt" ? "" : "about "}
                {fmt(d)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground">crash at</span>
        <Range
          min={0}
          max={790}
          step={5}
          value={t}
          accent={ACCENT}
          onChange={(e) => setT(Number(e.currentTarget.value))}
          className="min-w-[180px] flex-1"
          aria-label="Seconds into the turn when the function crashes"
        />
        <span className="w-20 text-right font-mono text-xs tabular-nums">{t} s in</span>
      </div>
      <figcaption className="border-t px-4 py-3 text-center font-mono text-xs leading-5 text-muted-foreground">
        Constants reported by the fx0 and libfx READMEs; the subtraction is mine. A crash in
        the request that sent the prompt always resumes at 805 s from the send, so the
        earlier it dies, the longer the wait. Not measured: I made no Vercel deployment.
      </figcaption>
    </figure>
  )
}
