"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import "./neuron-lab.css"
import { loadEngine } from "./engine-loader"
import { DEFAULT_MODEL, MODELS, MODEL_IDS, MODEL_NOTES, isModelId, modelOptionLabel, type ModelId } from "./lab-models"
import { showToken } from "./data"
import { DetailsPanel, FindPanel, InvestigatePanel } from "./inspect-panels"
import { NeuronGrid } from "./neuron-grid"
import { NeuronMap } from "./neuron-map"
import type { EdgeLine, Style } from "./scene"
import { MAX_STEERS, parseNeuron, searchFires, searchLens, type Hit } from "./search"
import { EngineStatus, SteerPanel, type EngineState } from "./steer-panel"
import type { NeuronEngine, Steer } from "./types"
import { fmtNeuron, nkey } from "./types"
import { useLabData } from "./use-lab-data"

type Tab = "steer" | "details" | "investigate" | "find"
type Pane = "map" | "list" | "panel"

const SUGGESTIONS = ["tree", "cook", "ocean", "court", "bonjour", "happy"]
const LS = "neuron-lab-v1"

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)")
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

const startLayer = (id: ModelId) => Math.round(MODELS[id].layers * 0.57)

function encodeHash(model: ModelId, steers: Steer[], prompt: string, chat: boolean) {
  const r = steers.map((s) => `${s.layer}.${s.neuron}.${s.mode === "mul" ? "x" : ""}${s.dose}`).join(",")
  const q = prompt.trim() ? `&p=${encodeURIComponent(prompt.trim().slice(0, 300))}` : ""
  const c = chat ? "" : "&c=0"
  const m = model === DEFAULT_MODEL ? "" : `&m=${model}`
  return steers.length || q ? `#r=${r}${q}${c}${m}` : m ? `#m=${model}` : ""
}

/** The model a shared link names (null when it names none, meaning the default). */
function hashModel(h: string): ModelId | null {
  const m = /[#&]m=([^&]*)/.exec(h)
  return m && isModelId(m[1]) ? m[1] : null
}

function decodeHash(h: string, model: ModelId, layers: number, neurons: number): { steers: Steer[]; prompt: string; chat: boolean } | null {
  // a link made for the other model carries neuron ids that mean something else here: ignore its recipe
  if ((hashModel(h) ?? DEFAULT_MODEL) !== model) return null
  const m = /[#&]r=([^&]*)/.exec(h)
  if (!m) return null
  const steers: Steer[] = []
  for (const part of m[1].split(",")) {
    const [l, n, d] = part.split(".")
    const layer = +l, neuron = +n
    // dose may contain a decimal point and a minus sign, e.g. 3.2210.-0.5 splits as 3,2210,"-0","5"
    const raw = part.split(".").slice(2).join(".")
    const mul = raw.startsWith("x")
    const dose = +(mul ? raw.slice(1) : raw)
    if (Number.isInteger(layer) && Number.isInteger(neuron) && layer >= 0 && layer < layers && neuron >= 0 && neuron < neurons && Number.isFinite(dose) && d !== undefined) {
      steers.push(mul ? { layer, neuron, dose: Math.max(0, Math.min(4, dose)), mode: "mul" } : { layer, neuron, dose: Math.max(-3, Math.min(3, dose)) })
    }
  }
  const p = /[#&]p=([^&]*)/.exec(h)
  return { steers: steers.slice(0, MAX_STEERS), prompt: p ? decodeURIComponent(p[1]) : "", chat: !/[#&]c=0/.test(h) }
}

export function NeuronLabApp() {
  // null until the address and storage have been read, so nothing is fetched for the wrong model first
  const [modelId, setModelId] = useState<ModelId | null>(null)
  const data = useLabData(modelId, modelId ? startLayer(modelId) : 16)
  const { meta, layers, contexts, links, fedBy, discoveries, findings } = data
  const reduced = useReducedMotion()

  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [view, setView] = useState<"map" | "grid">("map")
  const [layer, setLayer] = useState(16)
  const [selected, setSelected] = useState<{ layer: number; neuron: number } | null>(null)
  const [qInput, setQInput] = useState("")
  const [q, setQ] = useState("")
  const [mode, setMode] = useState<"lens" | "fires">("lens")
  const [filter, setFilter] = useState("")
  const [shuffle, setShuffle] = useState(false)
  const [limit, setLimit] = useState(250)
  const [steers, setSteersRaw] = useState<Steer[]>([])
  const history = useRef<Steer[][]>([])
  const [prompt, setPrompt] = useState("")
  const [chat, setChat] = useState(true)
  const [tab, setTab] = useState<Tab>("steer")
  const [pane, setPane] = useState<Pane>("map")
  const [about, setAbout] = useState(false)
  const [toastMsg, setToastMsg] = useState("")
  const [idText, setIdText] = useState("")
  const [resetKey, setResetKey] = useState(0)
  const [noGl, setNoGl] = useState("")
  const [wide, setWide] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const [engine, setEngine] = useState<NeuronEngine | null>(null)
  const [eng, setEng] = useState<EngineState>({ status: "none", frac: 0, msg: "", cached: "unknown" })
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((s: string) => {
    setToastMsg(s)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToastMsg(""), 2600)
  }, [])

  // ---- persistence & sharing ------------------------------------------
  useEffect(() => {
    try {
      const t = localStorage.getItem(`${LS}:theme`)
      if (t === "light" || t === "dark") setTheme(t)
      setNames(JSON.parse(localStorage.getItem(`${LS}:names`) ?? "{}"))
    } catch {}
  }, [])

  // which model: the link, else the last one used here, else the default
  useEffect(() => {
    let id: ModelId = DEFAULT_MODEL
    try {
      const fromLink = hashModel(window.location.hash)
      const stored = localStorage.getItem(`${LS}:model`)
      id = fromLink ?? (isModelId(stored) ? stored : DEFAULT_MODEL)
    } catch {}
    setModelId(id)
    setLayer(startLayer(id))
  }, [])

  const hashed = useRef(false)
  useEffect(() => {
    if (!meta || !modelId || hashed.current) return
    hashed.current = true
    const fromHash = decodeHash(window.location.hash, modelId, meta.layers, meta.neurons)
    if (fromHash && (fromHash.steers.length || fromHash.prompt)) {
      setSteersRaw(fromHash.steers)
      setPrompt(fromHash.prompt)
      setChat(fromHash.chat)
      if (fromHash.steers[0]) {
        setSelected({ layer: fromHash.steers[0].layer, neuron: fromHash.steers[0].neuron })
        setLayer(fromHash.steers[0].layer)
      }
      return
    }
    try {
      const s = JSON.parse(localStorage.getItem(`${LS}:state:${modelId}`) ?? "null")
      if (s) {
        setSteersRaw(Array.isArray(s.steers) ? s.steers.slice(0, MAX_STEERS) : [])
        setPrompt(typeof s.prompt === "string" ? s.prompt : "")
        setChat(s.chat !== false)
      }
    } catch {}
  }, [meta, modelId])

  useEffect(() => {
    if (!hashed.current || !modelId) return
    try {
      localStorage.setItem(`${LS}:state:${modelId}`, JSON.stringify({ steers, prompt, chat }))
      history_replace(encodeHash(modelId, steers, prompt, chat))
    } catch {}
  }, [steers, prompt, chat, modelId])

  const setSteers = useCallback((f: (s: Steer[]) => Steer[]) => {
    setSteersRaw((cur) => {
      const next = f(cur)
      if (JSON.stringify(next) !== JSON.stringify(cur)) {
        history.current.push(cur)
        if (history.current.length > 50) history.current.shift()
      }
      return next
    })
  }, [])
  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (prev) {
      setSteersRaw(prev)
      toast("Undid the last recipe change.")
    }
  }, [toast])

  // ---- engine ----------------------------------------------------------
  const engineStarted = useRef(false)
  useEffect(() => {
    if (!modelId || engineStarted.current) return
    engineStarted.current = true
    const allowMock = new URLSearchParams(window.location.search).get("mock") === "1"
    loadEngine(allowMock, modelId).then(async (e) => {
      setEngine(e)
      if (!e) return setEng({ status: "none", frac: 0, msg: "", cached: "unknown" })
      const cached = await e.cached().catch(() => "unknown" as const)
      setEng({ status: e.isLoaded() ? "ready" : "idle", frac: 0, msg: "", cached, backend: e.backend() })
    })
  }, [modelId])

  const onLoad = useCallback(async () => {
    if (!engine || eng.status === "loading" || eng.status === "ready") return
    setEng((s) => ({ ...s, status: "loading", frac: 0, msg: "starting" }))
    try {
      await engine.load((frac, msg) => setEng((s) => ({ ...s, status: "loading", frac, msg })))
      setEng((s) => ({ ...s, status: "ready", frac: 1, msg: "", cached: "cached", backend: engine.backend() }))
    } catch (e) {
      setEng((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : String(e) }))
    }
  }, [engine, eng.status])

  // Choose the other CPU/GPU backend for the loaded model (opt-in; needs navigator.gpu).
  const onBackend = useCallback(
    async (kind: "cpu" | "webgpu") => {
      if (!engine || eng.status !== "ready" || eng.backend === kind) return
      setEng((s) => ({ ...s, backendMsg: kind === "webgpu" ? "preparing the GPU path\u2026" : "switching to the CPU\u2026", backendErr: undefined }))
      try {
        const r = await engine.setBackend(kind, (f, m) => setEng((s) => ({ ...s, backendMsg: `${Math.round(f * 100)}% ${m}` })))
        setEng((s) => ({
          ...s,
          backend: r.backend,
          backendMsg: r.adapter ? `adapter: ${r.adapter.description || r.adapter.architecture || r.adapter.vendor}${r.adapter.fallback ? " (a software adapter)" : ""}` : "",
        }))
      } catch (e) {
        setEng((s) => ({ ...s, backend: engine.backend(), backendMsg: "", backendErr: e instanceof Error ? e.message : String(e) }))
      }
    },
    [engine, eng.status, eng.backend],
  )

  // Switch model: unload the other one (its weights leave memory), forget what only made sense for it.
  const switchModel = useCallback(
    (id: ModelId) => {
      if (id === modelId) return
      engine?.select(id)
      hashed.current = false
      history.current = []
      setSteersRaw([])
      setSelected(null)
      setIdText("")
      setLayer(startLayer(id))
      setModelId(id)
      try {
        localStorage.setItem(`${LS}:model`, id)
      } catch {}
      setEng({ status: engine ? "idle" : "none", frac: 0, msg: "", cached: "unknown", backend: "cpu" })
      engine?.cached(id).then((c) => setEng((s) => (s.status === "idle" ? { ...s, cached: c } : s))).catch(() => {})
      toast(`Switched to ${MODELS[id].label}. The other model was unloaded. The recipe shown is the one you last used with this model.`)
    },
    [engine, modelId, toast],
  )

  // ---- search ----------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 140)
    return () => clearTimeout(t)
  }, [qInput])
  useEffect(() => setLimit(250), [q, mode, filter])

  const result = useMemo(
    () => (mode === "lens" ? searchLens(layers, q) : searchFires(contexts, q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, mode, data.version, contexts, layers],
  )
  const searching = q.length > 0

  const listed: Hit[] = useMemo(() => {
    let h = result.hits
    if (filter.trim()) {
      const f = filter.trim().toLowerCase()
      h = h.filter((x) => `l${x.layer} n${x.neuron} ${x.tokens.join(" ")}`.toLowerCase().includes(f))
    }
    if (shuffle) {
      const a = [...h]
      let s = 7
      for (let i = a.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) & 0x7fffffff
        const j = s % (i + 1)
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      h = a
    }
    return h
  }, [result, filter, shuffle])

  const searchCount = useCallback(
    (query: string) => {
      const r = searchLens(layers, query)
      const by = new Map<number, number>()
      for (const h of r.hits) by.set(h.layer, (by.get(h.layer) ?? 0) + 1)
      return { count: r.hits.length, byLayer: [...by.entries()] as [number, number][] }
    },
    [layers],
  )

  // ---- selection ------------------------------------------------------
  const select = useCallback(
    (l: number, n: number) => {
      setSelected({ layer: l, neuron: n })
      setLayer(l)
      setIdText(`L${l} N${n}`)
    },
    [],
  )

  const changeLayer = useCallback(
    (l: number) => {
      if (!meta) return
      const v = Math.max(0, Math.min(meta.layers - 1, l))
      setLayer(v)
    },
    [meta],
  )

  // ---- map styles & edges ----------------------------------------------
  const styles: Style[] = useMemo(() => {
    const out: Style[] = []
    for (const h of result.hits.slice(0, 4000)) out.push({ layer: h.layer, neuron: h.neuron, kind: h.sign > 0 ? "up" : "down" })
    if (selected) {
      const k = nkey(selected.layer, selected.neuron)
      for (const e of (links.get(k) ?? []).slice(0, 8)) out.push({ layer: e.layer, neuron: e.neuron, kind: "feeds" })
      for (const e of (fedBy.get(k) ?? []).slice(0, 8)) out.push({ layer: e.layer, neuron: e.neuron, kind: "fed" })
    }
    for (const s of steers) out.push({ layer: s.layer, neuron: s.neuron, kind: "match2" })
    if (selected) out.push({ layer: selected.layer, neuron: selected.neuron, kind: "sel" })
    return out
  }, [result, selected, links, fedBy, steers])

  const edges: EdgeLine[] = useMemo(() => {
    if (!selected) return []
    const k = nkey(selected.layer, selected.neuron)
    const out: EdgeLine[] = []
    const f = (links.get(k) ?? []).slice(0, 8)
    const mx = Math.max(0.0001, ...f.map((e) => Math.abs(e.score)))
    for (const e of f) out.push({ a: [selected.layer, selected.neuron], b: [e.layer, e.neuron], kind: "feeds", w: Math.abs(e.score) / mx })
    const g = (fedBy.get(k) ?? []).slice(0, 8)
    const mg = Math.max(0.0001, ...g.map((e) => Math.abs(e.score)))
    for (const e of g) out.push({ a: [e.layer, e.neuron], b: [selected.layer, selected.neuron], kind: "fed", w: Math.abs(e.score) / mg })
    return out
  }, [selected, links, fedBy])

  // ---- keyboard --------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault()
        undo()
        return
      }
      if (e.key === "Escape") {
        if (about) setAbout(false)
        else if (typing) (el as HTMLElement).blur()
        else setSelected(null)
        return
      }
      if (typing) return
      if (e.key === "/") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === "PageUp") {
        e.preventDefault()
        changeLayer(layer + 1)
      } else if (e.key === "PageDown") {
        e.preventDefault()
        changeLayer(layer - 1)
      } else if (e.key === "r") setResetKey((k) => k + 1)
      else if (e.key === "?") setAbout(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [about, layer, undo, changeLayer])

  // body scroll lock while the app overlay is up
  useEffect(() => {
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [])

  const saveName = (v: string) => {
    if (!selected) return
    const k = `${modelId}:${nkey(selected.layer, selected.neuron)}`
    const n = { ...names, [k]: v }
    if (!v) delete n[k]
    setNames(n)
    try {
      localStorage.setItem(`${LS}:names`, JSON.stringify(n))
    } catch {}
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast("Link copied. It carries your recipe and prompt.")
    } catch {
      toast("Copy the address bar: it already carries your recipe.")
    }
  }

  const lens = selected ? layers.get(selected.layer) : undefined
  const loadingLayers = meta && data.loadedLayers < meta.layers
  const effectiveView = noGl ? "grid" : view
  const selKey = selected ? nkey(selected.layer, selected.neuron) : ""

  if (!modelId) {
    return (
      <div ref={rootRef} className="nl-root" data-theme={theme}>
        <div className="nl-top">
          <Link className="nl-brand" href="/">
            {"←"} <span>neuron lab</span> <small>ai.thesatyajit.com</small>
          </Link>
        </div>
        <div className="nl-empty" style={{ padding: 24 }}>Loading…</div>
      </div>
    )
  }

  if (data.status === "missing") {
    return (
      <div ref={rootRef} className="nl-root" data-theme={theme}>
        <div className="nl-top">
          <Link className="nl-brand" href="/">
            {"←"} ai.thesatyajit.com
          </Link>
        </div>
        <div className="nl-empty" style={{ padding: 24, maxWidth: 560 }}>
          <b>The neuron data is not available.</b>
          <p>
            This page reads a few static files (the logit lens of every neuron, the strongest connections, recipes we found). They did not load, so there is nothing to draw. Try reloading; the article on this page explains what the files are.
          </p>
          <Link href="/articles/neuron-lab" style={{ color: "var(--nl-cyan)" }}>
            Read the article
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="nl-root" data-theme={theme}>
      <header className="nl-top">
        <Link className="nl-brand" href="/" title="Back to the site">
          {"←"} <span>neuron lab</span> <small>ai.thesatyajit.com</small>
        </Link>
        <select
          className="nl-select"
          aria-label="Model"
          title={`${MODEL_NOTES[modelId].arch} The other model is unloaded when you switch.`}
          value={modelId}
          onChange={(e) => switchModel(e.target.value as ModelId)}
        >
          {MODEL_IDS.map((id) => (
            <option key={id} value={id}>
              {modelOptionLabel(id)}
            </option>
          ))}
        </select>
        <div className="nl-seg" role="group" aria-label="View">
          <button aria-pressed={effectiveView === "map"} onClick={() => !noGl && setView("map")} disabled={!!noGl} title={noGl ? "WebGL is not available here" : "3D map of every layer"}>
            map
          </button>
          <button aria-pressed={effectiveView === "grid"} onClick={() => setView("grid")} title="One layer as a flat grid (works everywhere, keyboard friendly)">
            grid
          </button>
        </div>
        <select className="nl-select nl-mono" aria-label="Layer" value={layer} onChange={(e) => changeLayer(+e.target.value)}>
          {meta ? Array.from({ length: meta.layers }, (_, l) => <option key={l} value={l}>L{l}</option>) : <option>L16</option>}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!meta) return
            const s = parseNeuron(idText, meta.layers, meta.neurons)
            if (s) select(s.layer, s.neuron)
            else toast(`Try an id like L16 N477 (layers 0–${meta.layers - 1}, neurons 0–${meta.neurons - 1}).`)
          }}
        >
          <input className="nl-input nl-mono nl-id" aria-label="Go to neuron" placeholder="L16 N477" value={idText} onChange={(e) => setIdText(e.target.value)} />
        </form>
        <input
          ref={searchRef}
          className="nl-input nl-search"
          aria-label="Search tokens"
          placeholder={mode === "lens" ? "Search a word: which neurons write it?   ( / )" : "Search a word: which neurons fire on it?"}
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <div className="nl-seg" role="group" aria-label="Search mode">
          <button aria-pressed={mode === "lens"} onClick={() => setMode("lens")} title="Neurons whose output pushes toward (or away from) the word">
            lens
          </button>
          <button aria-pressed={mode === "fires"} onClick={() => setMode("fires")} title="Neurons that fire on texts containing the word">
            fires
          </button>
        </div>
        <span className="nl-spacer" />
        <button className="nl-btn small" onClick={share} title="Copy a link that includes your recipe">
          Share
        </button>
        <button
          className="nl-iconbtn"
          aria-label="Switch theme"
          title="Switch theme"
          onClick={() => {
            const t = theme === "dark" ? "light" : "dark"
            setTheme(t)
            try {
              localStorage.setItem(`${LS}:theme`, t)
            } catch {}
          }}
        >
          {theme === "dark" ? "☾" : "☀"}
        </button>
        <button className="nl-iconbtn" aria-label="About and shortcuts" title="About and shortcuts ( ? )" onClick={() => setAbout(true)}>
          ?
        </button>
      </header>

      <div className="nl-main" data-pane={pane} data-wide={wide}>
        <aside className="nl-left" aria-label="Neuron list">
          <div className="nl-panelhead">
            {searching ? (
              <>
                <div className="nl-count">
                  <b style={{ color: "var(--nl-fg)" }}>{result.hits.length.toLocaleString("en-US")}</b> {result.hits.length === 1 ? "neuron" : "neurons"} · {result.tokenCount} {result.tokenCount === 1 ? "token" : "tokens"}
                  {loadingLayers && mode === "lens" ? ` · still indexing (${data.loadedLayers}/${meta?.layers})` : ""}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input className="nl-input" style={{ flex: 1 }} placeholder="filter these" aria-label="Filter results" value={filter} onChange={(e) => setFilter(e.target.value)} />
                  <label className="nl-note" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> random
                  </label>
                </div>
              </>
            ) : (
              <div className="nl-count">Search a word above, or start here.</div>
            )}
          </div>
          <div className="nl-list" role="listbox" aria-label="Matching neurons">
            {searching ? (
              listed.length ? (
                <>
                  {listed.slice(0, limit).map((h) => {
                    const k = nkey(h.layer, h.neuron)
                    return (
                      <button key={k} className="nl-row" role="option" aria-selected={selKey === k} onClick={() => select(h.layer, h.neuron)}>
                        <span className="id nl-mono">{fmtNeuron(h.layer, h.neuron)}</span>
                        <span className={`sg nl-mono ${h.sign > 0 ? "p" : "m"}`}>{h.sign > 0 ? "+1" : "−1"}</span>
                        <span className="toks">{names[`${modelId}:${k}`] ? `${names[`${modelId}:${k}`]} · ` : ""}{h.tokens.join(" ")}</span>
                      </button>
                    )
                  })}
                  {listed.length > limit ? (
                    <button className="nl-btn small" style={{ margin: 8 }} onClick={() => setLimit((l) => l + 500)}>
                      Show more ({listed.length - limit} left)
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="nl-empty">
                  {loadingLayers ? "Still reading layers…" : `No neuron matched “${q}”. Try a shorter word, or switch between lens and fires.`}
                </div>
              )
            ) : (
              <>
                <div className="nl-sec">Try a word</div>
                <div className="nl-chips">
                  {SUGGESTIONS.map((w) => (
                    <button key={w} className="nl-chip" onClick={() => setQInput(w)}>
                      {w}
                    </button>
                  ))}
                </div>
                {findings.length ? (
                  <>
                    <div className="nl-sec">What we tried ({findings.length} axes)</div>
                    {[...findings].sort((x, y) => (x.verdict === y.verdict ? 0 : x.verdict === "works" ? -1 : 1)).map((f) => {
                      const mine = discoveries.filter((d) => d.axis === f.axis)
                      const best = [...mine.filter((d) => d.kind !== "pair")].sort(
                        (x, y) => (y.evidence?.lift ?? 0) / Math.max(0.1, y.evidence?.controlScores?.bestRandomLiftAtDose ?? 0.1) - (x.evidence?.lift ?? 0) / Math.max(0.1, x.evidence?.controlScores?.bestRandomLiftAtDose ?? 0.1),
                      )[0]
                      return (
                        <button
                          key={f.axis}
                          className="nl-row"
                          style={{ gridTemplateColumns: "1fr" }}
                          disabled={!best}
                          onClick={() => {
                            if (!best) return
                            setSteers(() => best.neurons.slice(0, MAX_STEERS).map((n) => ({ ...n })))
                            if (best.samples[0]) setPrompt(best.samples[0].prompt)
                            setChat(false)
                            select(best.neurons[0].layer, best.neurons[0].neuron)
                            setTab("steer")
                            setPane("panel")
                            toast(`Loaded the strongest recipe for "${f.label}".`)
                          }}
                        >
                          <span>
                            <b>{f.label}</b>{" "}
                            <span className="toks" style={{ color: f.verdict === "works" ? "var(--nl-amber)" : "var(--nl-violet)" }}>
                              {f.verdict === "works" ? `${mine.length} ${mine.length === 1 ? "recipe" : "recipes"}` : "nothing worked"}
                            </span>
                            <br />
                            <span className="toks wrap">
                              {f.contrast.splitHalfReplicated_top40}/40 contrasts held up
                              {f.verdict === "miss" ? ", but no neuron changed the output" : ""}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </>
                ) : null}
                <div className="nl-sec">How this works</div>
                <div className="nl-empty">
                  Every layer of {MODELS[modelId].label} has {MODELS[modelId].neurons.toLocaleString("en-US")} small units called neurons. Pick one, push it up or down, and watch the model&apos;s writing change. Press <span className="nl-kbd">?</span> for a tour.
                </div>
              </>
            )}
          </div>
        </aside>

        <main className="nl-centre" aria-label="Neuron map">
          {meta ? (
            effectiveView === "map" ? (
              <NeuronMap
                key={modelId}
                meta={meta}
                layers={layers}
                version={data.version}
                selected={selected}
                layer={layer}
                styles={styles}
                edges={edges}
                theme={theme}
                reducedMotion={reduced}
                resetKey={resetKey}
                onPick={(l, n) => {
                  select(l, n)
                  setPane("panel")
                }}
                onUnsupported={(why) => {
                  setNoGl(why)
                }}
              />
            ) : (
              <NeuronGrid key={modelId} meta={meta} lens={lens ?? layers.get(layer)} layer={layer} selected={selected} styles={styles} theme={theme} onPick={select} />
            )
          ) : (
            <div className="nl-banner">Loading the neuron data…</div>
          )}
          {loadingLayers ? (
            <div className="nl-banner">
              Indexing layers {data.loadedLayers}/{meta?.layers}
              <span className="nl-bar">
                <i style={{ width: `${Math.round((data.loadedLayers / (meta?.layers ?? 28)) * 100)}%` }} />
              </span>
            </div>
          ) : null}
          {noGl ? <div className="nl-banner" style={{ top: 48 }}>3D view unavailable ({noGl}). Showing the grid.</div> : null}
          {effectiveView === "map" ? (
            <div className="nl-hud">
              <button className="nl-btn small" onClick={() => setResetKey((k) => k + 1)} title="Reset the camera ( r )">
                reset view
              </button>
              <span>drag orbit · scroll zoom · shift+drag pan · click a dot</span>
            </div>
          ) : null}
          <div className="nl-legend" aria-hidden>
            <span><i className="nl-dot" style={{ background: "var(--nl-amber)" }} />promotes word</span>
            <span><i className="nl-dot" style={{ background: "var(--nl-violet)" }} />suppresses</span>
            <span><i className="nl-dot" style={{ background: "var(--nl-pink)" }} />in recipe</span>
          </div>
          {toastMsg ? (
            <div className="nl-toast" role="status">
              {toastMsg}
            </div>
          ) : null}
        </main>

        <aside className="nl-right" aria-label="Neuron details and steering">
          <div className="nl-panelhead" style={{ paddingBottom: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {selected ? (
              <div className="nl-neuronhead" style={{ flex: 1 }}>
                <h2 className="nl-mono" style={{ margin: 0, fontSize: 16 }}>{fmtNeuron(selected.layer, selected.neuron)}</h2>
                <input
                  className="nl-input"
                  style={{ flex: 1 }}
                  aria-label="Your name for this neuron (saved in this browser)"
                  placeholder="name it (saved here)"
                  value={names[`${modelId}:${selKey}`] ?? ""}
                  onChange={(e) => saveName(e.target.value)}
                />
              </div>
            ) : (
              <div className="nl-count" style={{ flex: 1 }}>No neuron selected</div>
            )}
            <button className="nl-iconbtn nl-widebtn" aria-pressed={wide} aria-label={wide ? "Narrow this panel" : "Widen this panel to read outputs side by side"} title={wide ? "Narrow this panel" : "Widen this panel"} onClick={() => setWide((w) => !w)}>
              {wide ? "\u21e5" : "\u21e4"}
            </button>
            </div>
          </div>
          <div className="nl-tabs" role="tablist">
            {(
              [
                ["steer", "Steer"],
                ["details", "Details"],
                ["investigate", "Investigate"],
                ["find", "Find"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} className="nl-tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
          {meta ? (
            tab === "steer" ? (
              <SteerPanel
                key={modelId}
                modelId={modelId}
                onBackend={onBackend}
                meta={meta}
                layers={layers}
                selected={selected}
                steers={steers}
                setSteers={setSteers}
                discoveries={discoveries}
                findings={findings}
                engine={engine}
                engineState={eng}
                onLoad={onLoad}
                onSelect={select}
                toast={toast}
                prompt={prompt}
                setPrompt={setPrompt}
                chat={chat}
                setChat={setChat}
              />
            ) : tab === "details" ? (
              <DetailsPanel meta={meta} layers={layers} contexts={contexts} links={links} fedBy={fedBy} selected={selected} onSelect={select} names={names} />
            ) : tab === "investigate" ? (
              <InvestigatePanel
                meta={meta}
                layers={layers}
                contexts={contexts}
                links={links}
                selected={selected}
                layer={layer}
                onSelect={select}
                onSearch={(w) => {
                  setMode("lens")
                  setQInput(w)
                  setPane("list")
                }}
                onSteer={(l, n, d) => {
                  setSteers((s) => (s.length >= MAX_STEERS ? s : [...s.filter((x) => !(x.layer === l && x.neuron === n)), { layer: l, neuron: n, dose: d }]))
                  setTab("steer")
                }}
                searchCount={searchCount}
              />
            ) : (
              <FindPanel
                meta={meta}
                engine={engine}
                ready={eng.status === "ready"}
                onLoad={onLoad}
                onSelect={select}
                layers={layers}
                onSteer={(l, n, d) => {
                  setSteers((s) => (s.length >= MAX_STEERS ? s : [...s.filter((x) => !(x.layer === l && x.neuron === n)), { layer: l, neuron: n, dose: d }]))
                  setTab("steer")
                  toast(`Added ${fmtNeuron(l, n)} to the recipe.`)
                }}
              />
            )
          ) : (
            <div className="nl-empty">Loading…</div>
          )}
        </aside>
      </div>

      <nav className="nl-mobilebar" aria-label="Panels">
        <button aria-pressed={pane === "list"} onClick={() => setPane("list")}>Neurons</button>
        <button aria-pressed={pane === "map"} onClick={() => setPane("map")}>Map</button>
        <button aria-pressed={pane === "panel"} onClick={() => setPane("panel")}>Steer</button>
      </nav>

      {about ? (
        <div className="nl-dialog" role="dialog" aria-modal="true" aria-label="About neuron lab" onClick={() => setAbout(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <h2>Neuron lab</h2>
            <p>
              {MODELS[modelId].label} has {MODELS[modelId].layers} layers, and each layer has {MODELS[modelId].neurons.toLocaleString("en-US")} small units (MLP neurons). Each neuron adds a fixed direction to the model&apos;s running state when it fires. Steering writes that direction in by hand: pick a neuron, choose a dose, and the model runs with the extra push at every position.
            </p>
            <p>
              The dose is a multiple of the layer&apos;s typical state length, divided by the neuron&apos;s own column length, so a dose of 1 means the same thing in every layer. It is the recipe from <a href="https://github.com/lyramakesmusic/neuron-explorer" target="_blank" rel="noreferrer">neuron-explorer</a>; <a href="https://huggingface.co/spaces/webml-community/neuron-studio" target="_blank" rel="noreferrer">Neuron Studio</a> showed it can run in a browser tab with Qwen3.5-4B. This page is our own build for two small models, Qwen3-0.6B and the hybrid Qwen3.5-0.8B.
            </p>
            <p>
              <b>What it is not:</b> there is no AI agent here. The Investigate tab runs fixed tools over published data. The model, when you load it, runs inside this tab on your device; nothing you type is sent anywhere.
            </p>
            <p>
              Read how it works and what we measured in <Link href="/articles/neuron-lab">the article</Link> and in <Link href="/articles/neuron-steering">the neuron steering article</Link>.
            </p>
            <ul style={{ paddingLeft: 18 }}>
              <li><span className="nl-kbd">/</span> or <span className="nl-kbd">Ctrl K</span> search · <span className="nl-kbd">PgUp</span>/<span className="nl-kbd">PgDn</span> change layer · <span className="nl-kbd">r</span> reset view</li>
              <li><span className="nl-kbd">Ctrl Z</span> undo a recipe change · <span className="nl-kbd">Esc</span> deselect · <span className="nl-kbd">Enter</span> in the prompt runs</li>
              <li>Grid view: arrow keys move between neurons.</li>
            </ul>
            <button className="nl-btn primary" onClick={() => setAbout(false)}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {selected && lens ? `${fmtNeuron(selected.layer, selected.neuron)} promotes ${lens.up[selected.neuron].slice(0, 4).map(showToken).join(", ")}` : ""}
      </span>
    </div>
  )
}

function history_replace(hash: string) {
  const url = window.location.pathname + window.location.search + hash
  window.history.replaceState(null, "", url)
}

// keep the unused import surface honest
export type { Hit }
export { EngineStatus }
