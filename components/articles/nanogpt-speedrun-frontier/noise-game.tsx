"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Why this benchmark is really a statistics exam.
//
// From program.md, the public rulebook: a record requires the mean of eight fixed
// seeds (0xC0FFEE+0..7) to come in below 3.27859, which the file itself derives as
// 3.28 - 0.004/sqrt(8) and calls "one-sided p < 0.001 at per-run sigma ~ 0.0013".
// That arithmetic checks: sigma of an 8-run mean is 0.0013/sqrt(8) = 0.00046, and
// 3.28 - 3.09 * 0.00046 = 3.27858.
//
// The consequence is the whole result. A single screening run has sigma 0.0013 —
// larger than most real improvements — so an agent that treats one trial as a
// verdict is reading noise. The blog's finding is that this, not idea generation,
// is what separates the models.
//
// mexp for the normal CDF so the bar geometry serializes identically on server and
// client. Abramowitz-Stegun 7.1.26 is exp-only, which is why it is used here.

const SIGMA = 0.0013
const TARGET = 3.28
const BAR = 3.27859

// erf via A&S 7.1.26 — exp only, no other transcendentals.
function erf(x: number): number {
  const s = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      mexp(-a * a)
  return s * y
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

// The trust-the-documentation probe, from the blog's own counts.
const FUNNEL = [
  { n: 100, label: "runs on the standard rulebook", note: "each handed a noise estimate in program.md that Prime Intellect had deliberately set slightly too large" },
  { n: 62, label: "measured the noise themselves", note: "rather than trusting the number they were given — and these runs are concentrated at the top of the results table" },
  { n: 42, label: "found same-seed nondeterminism", note: "nobody mentioned that rerunning one recipe on one seed also moves the loss, because GPUs are not deterministic. It is far smaller than seed-to-seed noise, so two recipes compared on a shared seed resolve differences a normal screen cannot — for the same compute" },
]

export function NoiseGame() {
  const [tab, setTab] = useState<"bar" | "probe">("bar")
  const [n, setN] = useState(1)
  const [delta, setDelta] = useState(10)
  const [sharedPct, setSharedPct] = useState(30)
  const shared = sharedPct / 100

  const sigMean = SIGMA / Math.sqrt(n)
  const trueGain = delta / 10000 // slider is in units of 1e-4 loss
  // Error 1 — a false record: a recipe with no real gain sneaking under the bar.
  const falseAlarm = phi((BAR - TARGET) / sigMean)
  // Error 2 — the screening error, which is the one that actually costs you
  // ideas: a recipe that IS `trueGain` better losing a head-to-head against the
  // recipe it should beat, when both are measured on n independent trials.
  const sigDiff = SIGMA * Math.sqrt(2 / n)
  const screenMiss = phi(-trueGain / sigDiff)
  // Sharing a seed cancels the seed-to-seed component and leaves only GPU
  // nondeterminism. The blog says that residual is "much smaller" but never
  // quantifies it, so this is a dial the reader sets, not a measurement.
  const sharedMiss = phi(-trueGain / (sigDiff * shared))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the significance bar, and who checked it</span>
        <span className="font-mono text-[10px] text-muted-foreground">per-run σ ≈ 0.0013</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["bar", "what one trial can tell you"],
              ["probe", "who verified the noise estimate"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tab === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "bar" ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">trials</span>
                <Range min={1} max={16} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} className="flex-1" aria-label="number of trials" accent={ACCENT} />
                <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{n}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">true gain</span>
                <Range min={0} max={40} step={1} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="flex-1" aria-label="true improvement in loss, units of 1e-4" accent={GOOD} />
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {trueGain.toFixed(4)}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { l: `σ of the ${n}-trial mean`, v: sigMean.toFixed(5), c: ACCENT, w: (sigMean / SIGMA) * 100 },
                { l: "margin the bar demands", v: (TARGET - BAR).toFixed(5), c: WARM, w: ((TARGET - BAR) / SIGMA) * 100 },
              ].map((x) => (
                <div key={x.l} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 text-right font-mono text-[10px] text-foreground">{x.l}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${Math.min(100, x.w)}%`, background: x.c }} />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                    {x.v}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">false record</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: falseAlarm > 0.01 ? WARM : GOOD }}>
                  {falseAlarm < 0.001 ? "<0.1%" : `${(falseAlarm * 100).toFixed(1)}%`}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">no real gain, clears the bar anyway</div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">discarded a winner</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: screenMiss > 0.15 ? WARM : GOOD }}>
                  {(screenMiss * 100).toFixed(1)}%
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">better recipe loses a head-to-head</div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">same trials, shared seed</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
                  {(sharedMiss * 100).toFixed(1)}%
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">what the 42 runs found</div>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="w-44 shrink-0 font-mono text-[10px] text-muted-foreground">
                noise a shared seed leaves
              </span>
              <Range min={5} max={100} step={5} value={sharedPct} onChange={(e) => setSharedPct(Number(e.target.value))} className="flex-1" aria-label="fraction of noise remaining when a seed is shared" accent={GOOD} />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{sharedPct}%</span>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Two errors, pulling opposite ways. Set trials to 1: a recipe with{" "}
              <span className="text-foreground">no real improvement at all</span>{" "}clears the bar about{" "}
              {(phi((BAR - TARGET) / SIGMA) * 100).toFixed(0)}% of the time, which is why records need eight fixed
              seeds. But the error that actually costs you a result is the other one — at one trial each, a recipe
              that genuinely is {trueGain.toFixed(4)} better <span className="text-foreground">loses</span>{" "}its
              head-to-head {(phi(-trueGain / (SIGMA * Math.SQRT2)) * 100).toFixed(0)}% of the time. Kill it there
              and the idea is gone. That is exactly the failure the blog describes in the weaker models: families
              killed on one seed, small gains thrown away for not clearing a bar they were never meant to clear
              alone.
              <br />
              <br />
              The third box is the trick 42 runs discovered without being told. Comparing two recipes on a{" "}
              <em>shared</em>{" "}seed cancels the seed-to-seed component and leaves only GPU nondeterminism, so the
              same compute resolves a much smaller difference. Prime Intellect says that residual is &ldquo;much
              smaller&rdquo; but never quantifies it — the slider is yours to set, not a measurement.
            </p>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {FUNNEL.map((f) => (
                <div key={f.label}>
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
                      {f.n}
                    </span>
                    <div className="h-5 flex-1 rounded-sm bg-muted/40">
                      <div className="h-5 rounded-sm" style={{ width: `${f.n}%`, background: ACCENT, opacity: 0.75 }} />
                    </div>
                  </div>
                  <div className="mt-0.5 pl-14 text-sm leading-6">
                    <span className="text-foreground">{f.label}</span>
                    <span className="text-muted-foreground"> — {f.note}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              This is the cleverest thing in the experiment and it is buried in a paragraph. Prime Intellect put a
              number in the rulebook that was <span className="text-foreground">deliberately slightly wrong</span>,
              then counted who checked. It is not a coding test or a knowledge test; it is a test of whether an
              agent treats its documentation as evidence or as a claim — and the ones that checked are the ones at
              the top of the table. Forty-two went further and found a property of the environment nobody
              documented, then rebuilt their screening protocol around it. That is a much better operational
              definition of research capability than any benchmark score, and it happens to be almost free to
              measure: you just have to be willing to write down something untrue.
            </p>
          </>
        )}
      </div>
    </figure>
  )
}
