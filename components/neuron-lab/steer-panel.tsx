"use client"

import { useEffect, useRef, useState } from "react"

import { showToken } from "./data"
import { activationDelta, fmtDose, MAX_STEERS, writeLength } from "./search"
import { MODELS, MODEL_NOTES, type ModelId } from "./lab-models"
import { RecipesFound } from "./recipes-card"
import type { AxisFinding, Discovery, LayerLens, ModelMeta, NeuronEngine, Steer } from "./types"
import { fmtNeuron } from "./types"

// Qwen3 chat template with thinking switched off (the model's own enable_thinking=false form).
export const chatWrap = (user: string) => `<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`

export type EngineState = {
  status: "none" | "idle" | "loading" | "ready" | "error"
  frac: number
  msg: string
  cached: "cached" | "missing" | "unknown"
  error?: string
  /** which backend runs the loaded model */
  backend?: "cpu" | "webgpu"
  backendMsg?: string
  backendErr?: string
}

type Col = { key: string; label: string; sign: -1 | 0 | 1; kind: "neg" | "base" | "pos"; text: string; state: "idle" | "queued" | "running" | "done" | "stopped" | "error"; tokens: number; msPerToken: number }

const DEFAULT_PROMPT = "Write a few sentences about whatever you like."

export function SteerPanel(p: {
  meta: ModelMeta
  layers: Map<number, LayerLens>
  selected: { layer: number; neuron: number } | null
  steers: Steer[]
  setSteers: (f: (s: Steer[]) => Steer[]) => void
  discoveries: Discovery[]
  findings: AxisFinding[]
  engine: NeuronEngine | null
  engineState: EngineState
  onLoad: () => void
  onSelect: (layer: number, neuron: number) => void
  toast: (s: string) => void
  prompt: string
  setPrompt: (s: string) => void
  chat: boolean
  setChat: (b: boolean) => void
  modelId: ModelId
  onBackend: (kind: "cpu" | "webgpu") => void
}) {
  const { chat, setChat } = p
  const { meta, steers } = p
  const [compare, setCompare] = useState<"3" | "2">("3")
  const [maxNew, setMaxNew] = useState(60)
  const [temp, setTemp] = useState(0)
  const [seed, setSeed] = useState(1)
  const [cols, setCols] = useState<Col[]>([])
  const [running, setRunning] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const outRef = useRef<HTMLDivElement>(null)
  const [openDisc, setOpenDisc] = useState<string | null>(null)

  const ready = p.engineState.status === "ready"

  const add = (layer: number, neuron: number, dose = 0.8) => {
    if (steers.length >= MAX_STEERS) return p.toast(`A recipe holds up to ${MAX_STEERS} neurons. Remove one first.`)
    if (steers.some((s) => s.layer === layer && s.neuron === neuron)) return p.toast("That neuron is already in the recipe.")
    p.setSteers((s) => [...s, { layer, neuron, dose }])
  }

  const loadDiscovery = (d: Discovery) => {
    p.setSteers(() => d.neurons.slice(0, MAX_STEERS).map((n) => ({ ...n })))
    if (d.samples[0]) p.setPrompt(d.samples[0].prompt)
    setChat(false)
    setOpenDisc(d.id)
    p.toast(`Loaded "${d.label}": ${d.neurons.length} neuron${d.neurons.length === 1 ? "" : "s"}.`)
  }

  const run = async () => {
    const eng = p.engine
    if (!eng) return
    if (!ready) return p.onLoad()
    const prompt = p.prompt.trim() || DEFAULT_PROMPT
    // Name each column by the push it applies: the actual dose for a one-neuron recipe, else the recipe
    // reversed / as set. A recipe with a negative dose must not put "+ dose" over the column that pushes down.
    const one = steers.length === 1 ? steers[0] : null
    const named = (sign: -1 | 1) =>
      one
        ? one.mode === "mul"
          ? `× ${Math.round((1 + sign * (one.dose - 1)) * 100) / 100}${sign === 1 ? " (as set)" : " (mirrored)"}`
          : `dose ${fmtDose(one.dose * sign)}${sign === 1 ? " (as set)" : " (mirrored)"}`
        : sign === 1
          ? "recipe as set"
          : "recipe reversed"
    const spec: Omit<Col, "text" | "state" | "tokens" | "msPerToken">[] =
      compare === "3"
        ? [
            { key: "n", label: named(-1), sign: -1, kind: "neg" },
            { key: "b", label: "baseline (no push)", sign: 0, kind: "base" },
            { key: "p", label: named(1), sign: 1, kind: "pos" },
          ]
        : [
            { key: "b", label: "baseline (no push)", sign: 0, kind: "base" },
            { key: "p", label: named(1), sign: 1, kind: "pos" },
          ]
    const ac = new AbortController()
    abort.current = ac
    setRunning(true)
    setCols(spec.map((s) => ({ ...s, text: "", state: "queued", tokens: 0, msPerToken: 0 })))
    requestAnimationFrame(() => outRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }))
    // The mirror of a multiply factor f is 2 - f (the same distance from 1 on the other side), as in the studio.
    const withSign = (sign: number): Steer[] =>
      steers.flatMap((x) => {
        if (x.mode === "mul") {
          const f = 1 + sign * (x.dose - 1)
          return f === 1 ? [] : [{ ...x, dose: f }]
        }
        return x.dose * sign !== 0 ? [{ ...x, dose: x.dose * sign }] : []
      })
    if (eng.generateMany) {
      setCols((c) => c.map((x) => ({ ...x, state: "running" })))
      try {
        const rs = await eng.generateMany({
          prompt: chat ? chatWrap(prompt) : prompt,
          variants: spec.map((s) => withSign(s.sign)),
          maxNewTokens: maxNew,
          temperature: temp,
          topK: 40,
          seed,
          signal: ac.signal,
          onToken: (v, t) => setCols((c) => c.map((x, j) => (j === v ? { ...x, text: x.text + t } : x))),
        })
        setCols((c) => c.map((x, j) => ({ ...x, state: ac.signal.aborted ? "stopped" : "done", tokens: rs[j]?.tokens ?? 0, msPerToken: rs[j]?.msPerToken ?? 0 })))
      } catch (e) {
        setCols((c) => c.map((x) => ({ ...x, state: "error", text: x.text || String(e instanceof Error ? e.message : e) })))
      }
    } else {
      for (let i = 0; i < spec.length; i++) {
        if (ac.signal.aborted) break
        const s = spec[i]
        setCols((c) => c.map((x, j) => (j === i ? { ...x, state: "running" } : x)))
        try {
          const r = await eng.generate({
            prompt: chat ? chatWrap(prompt) : prompt,
            steers: withSign(s.sign),
            maxNewTokens: maxNew,
            temperature: temp,
            topK: 40,
            seed,
            signal: ac.signal,
            onToken: (t) => setCols((c) => c.map((x, j) => (j === i ? { ...x, text: x.text + t } : x))),
          })
          setCols((c) => c.map((x, j) => (j === i ? { ...x, state: ac.signal.aborted ? "stopped" : "done", tokens: r.tokens, msPerToken: r.msPerToken } : x)))
        } catch (e) {
          setCols((c) => c.map((x, j) => (j === i ? { ...x, state: "error", text: x.text || String(e instanceof Error ? e.message : e) } : x)))
          break
        }
      }
    }
    setRunning(false)
  }

  const stop = () => abort.current?.abort()
  useEffect(() => () => abort.current?.abort(), [])

  const sel = p.selected
  const selLens = sel ? p.layers.get(sel.layer) : undefined

  return (
    <div className="nl-pane">
      {sel && selLens ? (
        <div className="nl-card">
          <h3>Selected neuron</h3>
          <div className="nl-neuronhead">
            <h2 className="nl-mono">{fmtNeuron(sel.layer, sel.neuron)}</h2>
            <button className="nl-btn small primary" onClick={() => add(sel.layer, sel.neuron)} disabled={steers.length >= MAX_STEERS}>
              + Steer this neuron
            </button>
          </div>
          <div className="nl-lens" style={{ marginTop: 8 }}>
            <span className="sg p">+</span>
            <span className="t">{selLens.up[sel.neuron].map(showToken).join("   ")}</span>
            <span className="sg m">{"−"}</span>
            <span className="t">{selLens.down[sel.neuron].map(showToken).join("   ")}</span>
          </div>
          <p className="nl-note" style={{ margin: "8px 0 0" }}>
            Pushing this neuron up writes toward the + tokens and away from the {"−"} ones. Pushing it down does the opposite.
          </p>
        </div>
      ) : (
        <div className="nl-card">
          <h3>Pick a neuron</h3>
          <p className="nl-note" style={{ margin: 0 }}>
            Search a word on the left, or click a dot on the map, then press <b>Steer this neuron</b>. Or start from a recipe we found.
          </p>
        </div>
      )}

      <RecipesFound discoveries={p.discoveries} findings={p.findings} openId={openDisc} onLoad={loadDiscovery} modelLabel={MODELS[p.modelId].label} notRun={MODEL_NOTES[p.modelId].notRun} />

      <div className="nl-card">
        <h3>Recipe ({steers.length}/{MAX_STEERS})</h3>
        {steers.length === 0 ? <p className="nl-note" style={{ margin: 0 }}>Empty. The model runs unchanged until you add a neuron.</p> : null}
        {steers.map((s, i) => {
          const mul = s.mode === "mul"
          const wl = writeLength(meta, s)
          const dl = activationDelta(meta, s)
          const patch = (f: (x: Steer) => Steer) => p.setSteers((a) => a.map((x, j) => (j === i ? f(x) : x)))
          return (
            <div key={`${s.layer}.${s.neuron}`} className="nl-steerrow">
              <button className="nl-link nl-mono" onClick={() => p.onSelect(s.layer, s.neuron)} title="Show this neuron on the map">
                {fmtNeuron(s.layer, s.neuron)}
              </button>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="nl-seg" role="group" aria-label={`Mode for ${fmtNeuron(s.layer, s.neuron)}`}>
                  <button aria-pressed={!mul} onClick={() => patch((x) => (x.mode === "mul" ? { ...x, mode: "add", dose: 0.8 } : x))} title="Add a dose of the neuron's own direction">
                    add
                  </button>
                  <button aria-pressed={mul} onClick={() => patch((x) => (x.mode === "mul" ? x : { ...x, mode: "mul", dose: 0 }))} title="Multiply the neuron's activation: 1 leaves it alone, 0 switches it off">
                    multiply
                  </button>
                </span>
                <button className="nl-iconbtn" aria-label={`Remove ${fmtNeuron(s.layer, s.neuron)}`} onClick={() => p.setSteers((a) => a.filter((_, j) => j !== i))}>
                  {"×"}
                </button>
              </span>
              <div className="nl-slider">
                <input
                  type="range"
                  min={mul ? 0 : -2}
                  max={2}
                  step={0.05}
                  value={s.dose}
                  aria-label={mul ? `Factor for ${fmtNeuron(s.layer, s.neuron)}` : `Dose for ${fmtNeuron(s.layer, s.neuron)}`}
                  onChange={(e) => patch((x) => ({ ...x, dose: +e.target.value }))}
                />
                <input
                  className="nl-input nl-mono"
                  type="number"
                  step={0.05}
                  min={mul ? 0 : -3}
                  max={mul ? 4 : 3}
                  value={s.dose}
                  aria-label={mul ? "Factor" : "Dose"}
                  onChange={(e) => patch((x) => ({ ...x, dose: Math.max(mul ? 0 : -3, Math.min(mul ? 4 : 3, +e.target.value || 0)) }))}
                />
              </div>
              <div className="sub">
                {mul ? (
                  <>
                    activation {"×"} {Math.round(s.dose * 100) / 100}: {s.dose === 0 ? "the neuron is switched off." : s.dose === 1 ? "no change." : s.dose < 1 ? "it is damped." : "it is amplified."} Applied at every position.
                  </>
                ) : (
                  <>
                    dose {fmtDose(s.dose)} writes {Math.abs(Math.round(wl * 10) / 10)} units {s.dose < 0 ? "against" : "along"} the neuron&apos;s direction: {fmtDose(s.dose)} {"×"} {Math.round(meta.resNormMedian[s.layer] * 10) / 10} (a typical residual length at L{s.layer}). That is {fmtDose(Math.round(dl * 10) / 10)} on the neuron&apos;s activation.
                  </>
                )}
              </div>
            </div>
          )
        })}
        {steers.length ? (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button className="nl-btn small ghost" onClick={() => p.setSteers(() => [])}>
              Clear recipe
            </button>
          </div>
        ) : null}
      </div>

      <div className="nl-card">
        <h3>Prompt</h3>
        <textarea
          className="nl-textarea"
          value={p.prompt}
          placeholder={DEFAULT_PROMPT}
          aria-label="Prompt"
          onChange={(e) => p.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (!running) run()
            }
          }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          {running ? (
            <button className="nl-btn" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className="nl-btn primary" onClick={run} disabled={!p.engine || p.engineState.status === "loading" || (ready && steers.length === 0)}>
              {!p.engine ? "Engine unavailable" : ready ? "Run" : p.engineState.status === "loading" ? "Loading…" : `Load model (${p.engine.info.downloadMB} MB) and run`}
            </button>
          )}
          <div className="nl-seg" role="group" aria-label="Comparison layout">
            <button aria-pressed={compare === "3"} onClick={() => setCompare("3")} title="Same prompt at minus dose, no steering, plus dose">
              {"−"} / 0 / +
            </button>
            <button aria-pressed={compare === "2"} onClick={() => setCompare("2")} title="Baseline against the recipe at full dose">
              base / steered
            </button>
          </div>
          <span className="nl-note">Enter runs, Shift+Enter adds a line.{!chat ? " Chat format is off: the model continues your text." : ""}</span>
        </div>
        <details style={{ marginTop: 8 }}>
          <summary className="nl-note" style={{ cursor: "pointer" }}>
            Settings
          </summary>
          <div className="nl-kv" style={{ marginTop: 6, gridTemplateColumns: "1fr auto" }}>
            <label htmlFor="nl-maxnew">New tokens</label>
            <input id="nl-maxnew" className="nl-input nl-mono" type="number" min={8} max={400} value={maxNew} onChange={(e) => setMaxNew(Math.max(8, Math.min(400, +e.target.value || 60)))} style={{ width: 80 }} />
            <label htmlFor="nl-temp">Temperature (0 = greedy)</label>
            <input id="nl-temp" className="nl-input nl-mono" type="number" min={0} max={1.5} step={0.1} value={temp} onChange={(e) => setTemp(Math.max(0, Math.min(1.5, +e.target.value || 0)))} style={{ width: 80 }} />
            <label htmlFor="nl-seed">Seed</label>
            <input id="nl-seed" className="nl-input nl-mono" type="number" value={seed} onChange={(e) => setSeed(Math.round(+e.target.value || 0))} style={{ width: 80 }} />
            <label htmlFor="nl-chat" title="On: the prompt is a user message and the model answers. Off: the model simply continues your text, which is how the recipes we found were tested.">Chat format</label>
            <input id="nl-chat" type="checkbox" checked={chat} onChange={(e) => setChat(e.target.checked)} style={{ justifySelf: "end" }} />
          </div>
        </details>
      </div>

      {cols.length ? (
        <div className="nl-cols" data-n={cols.length} ref={outRef}>
          {cols.map((c) => (
            <div key={c.key} className="nl-col" data-kind={c.kind}>
              <header>
                <b>{c.label}</b>
                <span className="nl-mono">
                  {c.state === "running" ? "generating" : c.state === "queued" ? "queued" : c.state === "stopped" ? "stopped" : c.state === "error" ? "error" : c.msPerToken ? `${Math.round(c.msPerToken)} ms/token` : ""}
                </span>
              </header>
              <div className="out" aria-live={c.state === "running" ? "polite" : "off"}>
                {c.text}
                {c.state === "running" ? <span className="nl-caret" /> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <EngineStatus engine={p.engine} state={p.engineState} onLoad={p.onLoad} modelId={p.modelId} onBackend={p.onBackend} findings={p.findings} />

    </div>
  )
}

export function EngineStatus(p: { engine: NeuronEngine | null; state: EngineState; onLoad: () => void; modelId: ModelId; onBackend: (kind: "cpu" | "webgpu") => void; findings: AxisFinding[] }) {
  const { engine, state } = p
  const spec = MODELS[p.modelId]
  const notes = MODEL_NOTES[p.modelId]
  const lighter = p.findings.filter((f) => f.screened < 32).length
  if (!engine) {
    return (
      <div className="nl-card">
        <h3>Model</h3>
        <p className="nl-note" style={{ margin: 0 }}>
          The in-browser model is not part of this build, so generation is off. Everything else (map, search, recipes we found) works without it.
        </p>
      </div>
    )
  }
  const info = engine.info
  return (
    <div className="nl-card">
      <h3>Model: {spec.label}</h3>
      <p className="nl-note" style={{ margin: "0 0 8px" }}>
        {notes.arch}
      </p>
      {state.status === "ready" ? (
        <p className="nl-note" style={{ margin: 0 }}>
          {info.model} is running in this tab ({info.backend}). Nothing you type leaves the page.
        </p>
      ) : state.status === "loading" ? (
        <div className="nl-note">
          <span className="nl-bar">
            <i style={{ width: `${Math.round(state.frac * 100)}%` }} />
          </span>{" "}
          {Math.round(state.frac * 100)}% {state.msg}
        </div>
      ) : (
        <>
          <p className="nl-note" style={{ margin: "0 0 8px" }}>
            {state.cached === "cached"
              ? `${spec.label} is already stored in this browser, so loading is quick and works offline.`
              : `Runs ${info.model} entirely in this tab. The first load downloads about ${info.downloadMB} MB from Hugging Face and keeps it in this browser; after that it is instant. Needs about ${info.memoryMB} MB of memory.`}
          </p>
          <button className="nl-btn" onClick={p.onLoad}>
            Load {spec.label} ({info.downloadMB} MB)
          </button>
          {state.status === "error" ? <p className="nl-note nl-warn">Could not load: {state.error}</p> : null}
        </>
      )}
      {engine.webgpuAvailable && state.status === "ready" ? (
        <div style={{ marginTop: 10 }}>
          <div className="nl-seg" role="group" aria-label="Backend">
            <button aria-pressed={state.backend !== "webgpu"} onClick={() => p.onBackend("cpu")} title="WebAssembly SIMD on the CPU: the default, and the path every number on this page was measured on">
              CPU (WebAssembly)
            </button>
            <button aria-pressed={state.backend === "webgpu"} onClick={() => p.onBackend("webgpu")} title="Opt-in. Verified for correctness against the CPU path on a software adapter only; speed not measured.">
              WebGPU (experimental)
            </button>
          </div>
          <p className="nl-note" style={{ margin: "6px 0 0" }}>
            The WebGPU path was checked against the CPU path for correctness on a software adapter only. I have not measured its speed on a real GPU, so it may be slower or faster than the CPU.
            {state.backendMsg ? ` ${state.backendMsg}` : ""}
          </p>
          {state.backendErr ? <p className="nl-note nl-warn">WebGPU failed: {state.backendErr}. The CPU path is still in use.</p> : null}
        </div>
      ) : null}
      <p className="nl-note" style={{ margin: "10px 0 0" }}>
        <b style={{ color: "var(--nl-fg)" }}>About this model&apos;s data.</b> {notes.data}
        {lighter ? ` Lighter screen on ${lighter} of ${p.findings.length} axes.` : ""}
      </p>
    </div>
  )
}
