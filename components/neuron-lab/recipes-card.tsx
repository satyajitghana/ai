"use client"

import { useMemo, useState } from "react"

import { fmtDose } from "./search"
import type { AxisFinding, Discovery } from "./types"
import { fmtNeuron } from "./types"

const lift = (n: number | undefined) => (n == null ? "n/a" : String(Math.round(n * 10) / 10))

/** The recipes the search found, grouped by axis, with the evidence next to each: lift against the best random
 *  neuron, perplexity against the unsteered model, and the pipeline's own coherence note. Misses are listed too. */
export function RecipesFound(p: {
  discoveries: Discovery[]
  findings: AxisFinding[]
  openId: string | null
  onLoad: (d: Discovery) => void
  modelLabel: string
  notRun: string[]
}) {
  const [showMisses, setShowMisses] = useState(false)
  const groups = useMemo(() => {
    const by = new Map<string, Discovery[]>()
    for (const d of p.discoveries) by.set(d.axis, [...(by.get(d.axis) ?? []), d])
    return [...by.entries()]
  }, [p.discoveries])
  // a lift is evidence the push changes the text; it is evidence about THIS neuron only if random neurons do not match it
  const maxRandom = (list: Discovery[]) => Math.max(0, ...list.map((d) => d.evidence?.controlScores?.bestRandomLiftAtDose ?? 0))
  const label = (axis: string) => p.findings.find((f) => f.axis === axis)?.label ?? axis
  const open = p.discoveries.find((d) => d.id === p.openId) ?? null
  const misses = p.findings.filter((f) => f.verdict === "miss")

  if (!p.discoveries.length && !p.findings.length) return null
  return (
    <div className="nl-card">
      <h3>Recipes we found (measured offline, {p.modelLabel})</h3>
      <p className="nl-note" style={{ margin: "0 0 8px" }}>
        Each one beat random neurons of the same layers and kept perplexity under three times the unsteered model. They were tested on plain text continuation, so choosing one turns chat format off.
      </p>
      {groups.map(([axis, list]) => (
        <details key={axis} open={list.some((d) => d.id === p.openId)} style={{ marginBottom: 6 }}>
          <summary className="nl-note" style={{ cursor: "pointer", color: "var(--nl-fg)" }}>
            {label(axis)} <span className="nl-note">· {list.length} {list.length === 1 ? "recipe" : "recipes"}</span>
          </summary>
          {axis === "repeat" ? (
            <p className="nl-note nl-warn" style={{ margin: "4px 0" }}>
              Caution: repetition is easy to cause. In screening, random neurons lifted this score by up to 30, so only the entries whose random control stays low are clean.
            </p>
          ) : null}
          {axis !== "repeat" && maxRandom(list) >= 5 ? (
            <p className="nl-note nl-warn" style={{ margin: "4px 0" }}>
              Random neurons reach a lift of {lift(maxRandom(list))} on this axis, so a lift shows the push changes the text, not that this neuron is specific to the idea.
            </p>
          ) : null}
          {list.map((d) => {
            const e = d.evidence
            return (
              <button key={d.id} className="nl-row" style={{ gridTemplateColumns: "1fr" }} aria-pressed={p.openId === d.id} onClick={() => p.onLoad(d)}>
                <span>
                  <span className="nl-mono">
                    {d.neurons.map((n) => `${fmtNeuron(n.layer, n.neuron)} ${fmtDose(n.dose)}`).join(" + ")}
                  </span>{" "}
                  <span className="toks wrap">
                    lift {lift(e?.lift)} vs random {lift(e?.controlScores?.bestRandomLiftAtDose)}
                    {e?.perplexity != null && e.baselinePerplexity != null ? ` · perplexity ${lift(e.perplexity)} (was ${lift(e.baselinePerplexity)})` : ""}
                    {e?.repetitionPct != null && e.baselineRepetitionPct != null ? (
                      <span style={e.repetitionPct - e.baselineRepetitionPct >= 10 ? { color: "var(--nl-amber)" } : undefined}>
                        {" "}· repeated trigrams {lift(e.repetitionPct)}% (unsteered {lift(e.baselineRepetitionPct)}%)
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            )
          })}
        </details>
      ))}
      {open ? (
        <div style={{ marginTop: 8 }}>
          {open.samples.slice(0, 2).map((s, i) => (
            <div key={i} className="nl-cols" data-n="2" style={{ marginTop: 6 }}>
              <div className="nl-col" style={{ minHeight: 0 }}>
                <header>
                  <b>unsteered</b>
                </header>
                <div className="out">{s.baseline}</div>
              </div>
              <div className="nl-col" data-kind="pos" style={{ minHeight: 0 }}>
                <header>
                  <b>steered</b>
                </header>
                <div className="out">{s.steered}</div>
              </div>
            </div>
          ))}
          {open.coherenceNote ? <p className="nl-note">{open.coherenceNote}</p> : null}
        </div>
      ) : null}
      {misses.length ? (
        <div style={{ marginTop: 8 }}>
          <button className="nl-btn small ghost" aria-expanded={showMisses} onClick={() => setShowMisses((v) => !v)}>
            {showMisses ? "Hide" : "Show"} the {misses.length} axes where nothing worked
          </button>
          {showMisses ? (
            <div style={{ marginTop: 6 }}>
              {misses.map((m) => (
                <p key={m.axis} className="nl-note" style={{ margin: "0 0 6px" }}>
                  <b style={{ color: "var(--nl-fg)" }}>{m.label}.</b> {m.contrast.splitHalfReplicated_top40} of the 40 strongest contrasts held up on the held-out half (largest effect {m.contrast.topAbsD}), yet none of the {m.screened} screened neurons changed the output.
                </p>
              ))}
              {p.notRun.length ? <p className="nl-note" style={{ margin: 0 }}>Not run on this model: {p.notRun.join(", ")}.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
