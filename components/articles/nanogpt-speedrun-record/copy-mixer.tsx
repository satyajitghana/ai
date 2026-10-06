"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of CPLM's output distribution (PR #379, track_1_short/model/gpt.py:1002-1008):
//   p(y) = p_lm(y) * (1 - alpha * (1 - a_sink)) + alpha * p_copy(y)
// p_copy(y) is the pointer's attention mass on earlier positions of the same document that hold
// token y; a_sink is the mass on a learned sink key, handed back to the LM. The scores below are
// invented for illustration; the default gate 0.06 is near the record's measured validation mean.

const DOC = ["Dr", ".", "Okafor", "measured", "the", "loss", ".", "Then", "Dr", "."]
// raw pointer scores q.k_j / sqrt(d) for the query at the last position (toy values)
const SCORES = [0.5, 0.2, 3.0, 0.8, 0.3, 0.6, 0.2, 0.1, 0.9]
const TARGETS = ["Okafor", "Dr", "loss", "Smith"] as const

const ACCENT = "oklch(0.62 0.17 45)"
const LM = "oklch(0.60 0.13 255)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 25)"

export function CopyMixer() {
  const [target, setTarget] = useState<(typeof TARGETS)[number]>("Okafor")
  const [alpha, setAlpha] = useState(0.06)
  const [gain, setGain] = useState(1)
  const [sink, setSink] = useState(0)
  const [plm, setPlm] = useState(0.02)

  const e = SCORES.map((s) => mexp(gain * s))
  const eSink = mexp(gain * sink)
  const Z = e.reduce((a, b) => a + b, 0) + eSink
  const att = e.map((x) => x / Z)
  const aSink = eSink / Z
  const pCopy = att.reduce((acc, a, j) => acc + (DOC[j] === target ? a : 0), 0)
  const lmShare = 1 - alpha * (1 - aSink)
  const p = plm * lmShare + alpha * pCopy
  const nll = -mlog(p)
  const nllLm = -mlog(plm)
  const delta = nll - nllLm
  const maxAtt = Math.max(...att, aSink)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          p(y) = p_lm(y)·(1 − α(1 − a_sink)) + α·p_copy(y)
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">toy scores, real formula</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">
            target y (the token after the last position)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                aria-pressed={target === t}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  target === t
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
                {t === "Smith" ? " (not in the document)" : ""}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">
            pointer attention from the last position over earlier tokens of the same document, plus the sink
          </div>
          <div className="flex h-28 items-end gap-1">
            {[...att, aSink].map((a, j) => {
              const isSink = j === att.length
              const hit = !isSink && DOC[j] === target
              return (
                <div key={j} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                  <div className="text-center font-mono text-[8px] tabular-nums text-muted-foreground">
                    {(a * 100).toFixed(0)}%
                  </div>
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${Math.max(2, (a / maxAtt) * 78)}%`,
                      background: isSink ? LM : hit ? ACCENT : "oklch(0.72 0.02 255)",
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-1">
            {[...DOC.slice(0, att.length), "sink"].map((t, j) => (
              <div
                key={j}
                className={cn(
                  "min-w-0 flex-1 truncate text-center font-mono text-[9px]",
                  j < att.length && DOC[j] === target ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t}
              </div>
            ))}
          </div>
          <div className="mt-1 text-right font-mono text-[9px] text-muted-foreground">
            query: the final “{DOC[DOC.length - 1]}” (it cannot point at itself)
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[10px] text-muted-foreground">
            gate α (mass of the &lt;copy&gt; slot): <span className="text-foreground">{alpha.toFixed(3)}</span>
            <Range min={0} max={0.5} step={0.005} value={alpha} accent={ACCENT} onChange={(ev) => setAlpha(Number(ev.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-[10px] text-muted-foreground">
            LM&rsquo;s own p_lm(y): <span className="text-foreground">{plm.toFixed(3)}</span>
            <Range min={0.001} max={0.5} step={0.001} value={plm} accent={LM} onChange={(ev) => setPlm(Number(ev.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-[10px] text-muted-foreground">
            pointer sharpness (QK gain): <span className="text-foreground">{gain.toFixed(2)}</span>
            <Range min={0.25} max={3} step={0.05} value={gain} onChange={(ev) => setGain(Number(ev.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-[10px] text-muted-foreground">
            sink score: <span className="text-foreground">{sink.toFixed(1)}</span>
            <Range min={-2} max={5} step={0.1} value={sink} accent={LM} onChange={(ev) => setSink(Number(ev.target.value))} className="mt-1 w-full" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <Stat k="p_copy(y)" v={pCopy.toFixed(3)} color={ACCENT} />
          <Stat k="a_sink" v={aSink.toFixed(3)} color={LM} />
          <Stat k="LM side keeps" v={`${(lmShare * 100).toFixed(1)}%`} />
          <Stat k="p(y)" v={p.toFixed(4)} />
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5">
          loss on this token: <span className="text-foreground">{nll.toFixed(3)} nats</span> with the pointer,{" "}
          <span className="text-foreground">{nllLm.toFixed(3)}</span> for the LM alone{" "}
          <span style={{ color: delta < 0 ? GOOD : BAD }}>
            ({delta < 0 ? "−" : "+"}
            {Math.abs(delta).toFixed(3)})
          </span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {pCopy > 0 ? (
            <>
              The target sits earlier in the document, so the pointer can put mass on it directly, and a small gate
              already moves the loss. The LM has to <em>encode and recall</em> the token; the pointer only has to{" "}
              <span className="text-foreground">find where it was</span>.
            </>
          ) : (
            <>
              The target never appeared in the document, so p_copy is zero and the gate is pure cost: the LM keeps
              only <span className="text-foreground">{(lmShare * 100).toFixed(1)}%</span> of its probability. Raise
              the sink score and that cost shrinks, because the sink hands its mass back to the LM. That is the
              sink&rsquo;s job.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <div className="text-[9px] text-muted-foreground">{k}</div>
      <div className="tabular-nums text-foreground" style={color ? { color } : undefined}>
        {v}
      </div>
    </div>
  )
}
