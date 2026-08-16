"use client"

import { cn } from "@/lib/utils"

// The cleanest controlled comparison in the whole experiment, and it is a
// footnote in the results table: Kimi K3 appears twice, under two harnesses.
//
// Same weights, same task, same rulebook family, same node. Different harness.
// The Prime Agent run reached a better record on a sixth of the tokens.
//
// The honest caveat, from the repository README rather than the blog: the Prime
// Agent run is labelled "serial era", meaning it ran under program-serial.md,
// a variant used between 20 July and 13 August that made agents wait for each
// run instead of delegating it to a subagent. So this is not a clean A/B — the
// rulebooks differ too, and Prime Intellect says those runs are being redone.

type Run = {
  harness: string
  record: number
  totalTok: number // millions
  outTok: number // thousands
  calls: number
  days: number
  serial: boolean
}

const RUNS: Run[] = [
  { harness: "prime-agent · max", record: 2930, totalTok: 112, outTok: 2200, calls: 488, days: 3.6, serial: true },
  { harness: "kimi-code · max", record: 2974, totalTok: 682, outTok: 1400, calls: 4000, days: 5.1, serial: false },
]

const BASE = 3290
const HUMAN = 2600

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

export function HarnessDelta() {
  const [a, b] = RUNS
  const gap = (r: Run) => (100 * (BASE - r.record)) / (BASE - HUMAN)

  const metrics = [
    { l: "record, in steps", a: a.record.toLocaleString(), b: b.record.toLocaleString(), better: "a" },
    { l: "share of the gap closed", a: `${gap(a).toFixed(1)}%`, b: `${gap(b).toFixed(1)}%`, better: "a" },
    { l: "total tokens", a: `${a.totalTok}M`, b: `${b.totalTok}M`, better: "a" },
    { l: "tool calls", a: a.calls.toLocaleString(), b: `${(b.calls / 1000).toFixed(0)}k`, better: "a" },
    { l: "days on the node", a: `${a.days}`, b: `${b.days}`, better: "a" },
    { l: "output tokens", a: `${(a.outTok / 1000).toFixed(1)}M`, b: `${(b.outTok / 1000).toFixed(1)}M`, better: "b" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Kimi K3, twice — same model, two harnesses</span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          6.1× fewer tokens, 44 steps better
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1">
          <span />
          <span className="pb-1 text-right font-mono text-[10px]" style={{ color: ACCENT }}>
            prime-agent
          </span>
          <span className="pb-1 text-right font-mono text-[10px] text-muted-foreground">kimi-code</span>
          {metrics.map((m) => (
            <div key={m.l} className="contents">
              <span className="border-t py-1 font-mono text-[10px] text-muted-foreground">{m.l}</span>
              <span
                className={cn("border-t py-1 text-right font-mono text-[11px] tabular-nums", m.better === "a" ? "font-semibold" : "")}
                style={{ color: m.better === "a" ? GOOD : "inherit" }}
              >
                {m.a}
              </span>
              <span
                className={cn("border-t py-1 text-right font-mono text-[11px] tabular-nums", m.better === "b" ? "font-semibold" : "")}
                style={{ color: m.better === "b" ? GOOD : "inherit" }}
              >
                {m.b}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border px-3 py-2 text-sm leading-6 text-muted-foreground" style={{ borderColor: WARM }}>
          <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: WARM }}>
            not a clean A/B
          </span>
          <br />
          The Prime Agent run is tagged <span className="font-mono text-foreground">serial era</span>: it ran under{" "}
          <span className="font-mono text-foreground">program-serial.md</span>, a rulebook variant used between 20
          July and 13 August that made agents wait for each training run instead of delegating it to a subagent. So
          two things differ, not one, and Prime Intellect says those runs are being redone under the standard
          rulebook. Five of the twenty rows carry this tag — including second and third place.
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Even with that caveat, this is the most interesting pair in the table. One model, run two ways, lands 44
          steps apart on the record and <span className="text-foreground">6.1× apart on token spend</span> — a
          bigger swing than separates several adjacent models from each other. Prime Agent gives the model a
          persistent IPython kernel instead of a tool menu, and the traces show what that buys: K3 wrote its own
          experiment driver, its own loss-curve comparator, a routine to restore a clean baseline, and eventually a
          numerical laboratory for retuning Newton-Schulz coefficients before spending a single GPU-hour testing
          them. The token split is the tell: under Prime Agent it wrote{" "}
          <span className="text-foreground">more output — 2.2M against 1.4M — across an eighth as many tool calls</span>.
          That is the signature of a model writing programs instead of issuing commands, and programs are why its
          total context stayed small enough to fit in 112M tokens.
        </p>
      </div>
    </figure>
  )
}
