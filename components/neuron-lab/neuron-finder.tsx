"use client"

import { useState } from "react"

import { fmtNeuron } from "./types"

export type Pick = { layer: number; neuron: number }

/**
 * Pick a neuron by number instead of by aim: a layer and a neuron field, each with
 * steppers and a slider, Enter to jump, and the last few picks to hop back to.
 */
export function NeuronFinder({
  neuronInputRef,
  ...p
}: {
  layers: number
  neurons: number
  cols: number
  layer: number
  selected: Pick | null
  recent: Pick[]
  onLayer: (layer: number) => void
  onPick: (layer: number, neuron: number) => void
  neuronInputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const sel = p.selected
  // a field shows its draft only while it is being typed in; otherwise it follows the selection
  const [draftL, setDraftL] = useState<string | null>(null)
  const [draftN, setDraftN] = useState<string | null>(null)
  const layerText = draftL ?? String(p.layer)
  const neuronText = draftN ?? String(sel?.neuron ?? 0)

  const clampL = (v: number) => Math.max(0, Math.min(p.layers - 1, Math.round(v)))
  const clampN = (v: number) => Math.max(0, Math.min(p.neurons - 1, Math.round(v)))
  const layerNum = layerText.trim() !== "" && Number.isFinite(+layerText) ? clampL(+layerText) : p.layer
  const neuronNum = neuronText.trim() !== "" && Number.isFinite(+neuronText) ? clampN(+neuronText) : (sel?.neuron ?? 0)
  const row = Math.floor(neuronNum / p.cols)
  const col = neuronNum % p.cols
  const isCurrent = !!sel && sel.layer === layerNum && sel.neuron === neuronNum

  const go = (l = layerNum, n = neuronNum) => {
    setDraftL(null)
    setDraftN(null)
    p.onPick(l, n)
  }
  const setL = (l: number) => {
    const v = clampL(l)
    setDraftL(null)
    p.onLayer(v)
    if (sel) p.onPick(v, neuronNum)
  }
  const stepN = (d: number) => go(layerNum, clampN(neuronNum + d))

  const keys = (kind: "layer" | "neuron") => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const big = e.shiftKey ? 10 : 1
    if (e.key === "Enter") {
      e.preventDefault()
      go()
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault()
      const d = (e.key === "ArrowUp" ? 1 : -1) * big
      if (kind === "layer") setL(layerNum + d)
      else stepN(d)
    }
  }

  return (
    <section className="nl-finder" aria-label="Find a neuron">
      <div className="nl-finder-head">
        <b>Find a neuron</b>
        <span className="nl-note nl-mono">
          L0–{p.layers - 1} · N0–{p.neurons - 1}
        </span>
      </div>

      <div className="nl-finder-row">
        <label htmlFor="nl-find-layer">Layer</label>
        <button className="nl-iconbtn" aria-label="Previous layer" onClick={() => setL(layerNum - 1)} disabled={layerNum <= 0}>
          −
        </button>
        <input
          id="nl-find-layer"
          className="nl-input nl-mono"
          inputMode="numeric"
          value={layerText}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d]/g, "")
            setDraftL(t)
            if (t !== "") p.onLayer(clampL(+t))
          }}
          onBlur={() => setDraftL(null)}
          onKeyDown={keys("layer")}
        />
        <button className="nl-iconbtn" aria-label="Next layer" onClick={() => setL(layerNum + 1)} disabled={layerNum >= p.layers - 1}>
          +
        </button>
      </div>
      <input
        type="range"
        className="nl-range"
        aria-label="Layer slider"
        min={0}
        max={p.layers - 1}
        value={layerNum}
        onChange={(e) => setL(+e.target.value)}
      />

      <div className="nl-finder-row">
        <label htmlFor="nl-find-neuron">Neuron</label>
        <button className="nl-iconbtn" aria-label="Previous neuron" onClick={() => stepN(-1)} disabled={neuronNum <= 0}>
          −
        </button>
        <input
          id="nl-find-neuron"
          ref={neuronInputRef}
          className="nl-input nl-mono"
          inputMode="numeric"
          value={neuronText}
          onChange={(e) => setDraftN(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => setDraftN(null)}
          onKeyDown={keys("neuron")}
        />
        <button className="nl-iconbtn" aria-label="Next neuron" onClick={() => stepN(1)} disabled={neuronNum >= p.neurons - 1}>
          +
        </button>
      </div>
      <input
        type="range"
        className="nl-range"
        aria-label="Neuron slider"
        min={0}
        max={p.neurons - 1}
        value={neuronNum}
        onChange={(e) => go(layerNum, +e.target.value)}
      />

      <div className="nl-finder-foot">
        <span className="nl-note">
          Grid row {row}, column {col} ({p.cols} per row)
        </span>
        <button className="nl-btn small primary" onMouseDown={(e) => e.preventDefault()} onClick={() => go()} disabled={isCurrent}>
          {isCurrent ? fmtNeuron(layerNum, neuronNum) : `Go to ${fmtNeuron(layerNum, neuronNum)}`}
        </button>
      </div>
      <div className="nl-note">
        <span className="nl-kbd">Enter</span> jumps · <span className="nl-kbd">↑</span>
        <span className="nl-kbd">↓</span> step (<span className="nl-kbd">⇧</span> ×10) · <span className="nl-kbd">[</span>
        <span className="nl-kbd">]</span> prev/next · <span className="nl-kbd">g</span> focus
      </div>

      {p.recent.length ? (
        <div className="nl-finder-recent" aria-label="Recent neurons">
          {p.recent.map((r) => (
            <button
              key={`${r.layer}:${r.neuron}`}
              className="nl-chip nl-mono"
              aria-pressed={!!sel && sel.layer === r.layer && sel.neuron === r.neuron}
              onClick={() => go(r.layer, r.neuron)}
            >
              {fmtNeuron(r.layer, r.neuron)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
