"use client"

import { useMemo, useState, type ReactNode } from "react"

import { showToken } from "./data"
import { fmtDose, parseNeuron, similarNeurons } from "./search"
import type { Context, Edge, LayerLens, ModelMeta, NeuronEngine, NeuronKey } from "./types"
import { fmtNeuron, nkey } from "./types"

const sgn = (v: number) => (v >= 0 ? "p" : "m")

function NeuronLink({ l, n, onSelect }: { l: number; n: number; onSelect: (l: number, n: number) => void }) {
  return (
    <button className="nl-link nl-mono" onClick={() => onSelect(l, n)}>
      {fmtNeuron(l, n)}
    </button>
  )
}

function Lens({ lens, n }: { lens: LayerLens; n: number }) {
  return (
    <div className="nl-lens">
      <span className="sg p">+</span>
      <span className="t">{lens.up[n].map(showToken).join("   ")}</span>
      <span className="sg m">{"−"}</span>
      <span className="t">{lens.down[n].map(showToken).join("   ")}</span>
    </div>
  )
}

/** Rank of a neuron's peak activation within its layer (1 = strongest). */
function layerRank(lens: LayerLens, n: number) {
  let r = 1
  const v = lens.actMax[n]
  for (const x of lens.actMax) if (x > v) r++
  return r
}

// ---- Details ---------------------------------------------------------------

export function DetailsPanel(p: {
  meta: ModelMeta
  layers: Map<number, LayerLens>
  contexts: Record<string, Context[]>
  links: Map<NeuronKey, Edge[]>
  fedBy: Map<NeuronKey, Edge[]>
  selected: { layer: number; neuron: number } | null
  onSelect: (l: number, n: number) => void
  names: Record<string, string>
}) {
  const s = p.selected
  const lens = s ? p.layers.get(s.layer) : undefined
  const sim = useMemo(() => null, [])
  const [similar, setSimilar] = useState<ReturnType<typeof similarNeurons> | null>(sim)
  if (!s || !lens) {
    return (
      <div className="nl-pane">
        <div className="nl-empty">Select a neuron (click a dot, a row on the left, or type an id such as L16 N477) to see what it does.</div>
      </div>
    )
  }
  const k = nkey(s.layer, s.neuron)
  const ctx = p.contexts[`${s.layer}.${s.neuron}`] ?? []
  const feeds = p.links.get(k) ?? []
  const fed = p.fedBy.get(k) ?? []
  const rank = layerRank(lens, s.neuron)
  return (
    <div className="nl-pane">
      <div className="nl-card">
        <h3>What it writes (logit lens)</h3>
        <Lens lens={lens} n={s.neuron} />
        <p className="nl-note" style={{ margin: "8px 0 0" }}>
          The neuron&apos;s output column is read through the model&apos;s final norm and its token embedding. + tokens are made more likely when the neuron is high; {"−"} tokens less likely.
        </p>
      </div>
      <div className="nl-card">
        <h3>Numbers</h3>
        <dl className="nl-kv">
          <dt>Peak activation on the reference text</dt>
          <dd className="nl-mono">{lens.actMax[s.neuron]}</dd>
          <dt>Mean activation</dt>
          <dd className="nl-mono">{lens.actMean[s.neuron]}</dd>
          <dt>Rank in its layer</dt>
          <dd className="nl-mono">
            {rank} of {p.meta.neurons}
          </dd>
          <dt>Output column length</dt>
          <dd className="nl-mono">{p.meta.colNorm[s.layer][s.neuron]}</dd>
          <dt>Typical residual length at this layer</dt>
          <dd className="nl-mono">{Math.round(p.meta.resNormMedian[s.layer] * 10) / 10}</dd>
          <dt>Activation offset at dose +1</dt>
          <dd className="nl-mono">{fmtDose(Math.round((p.meta.resNormMedian[s.layer] / p.meta.colNorm[s.layer][s.neuron]) * 10) / 10)}</dd>
        </dl>
      </div>
      <div className="nl-card">
        <h3>Texts that make it fire</h3>
        {ctx.length ? (
          ctx.map((c, i) => (
            <div key={i} className="nl-ctx">
              {c.text} <b className="nl-mono">{c.act}</b>
            </div>
          ))
        ) : (
          <p className="nl-note" style={{ margin: 0 }}>
            No stored texts for this neuron. We keep up to five for the 256 strongest neurons in each layer, taken from {p.meta.corpus?.name ?? "the reference corpus"}.
          </p>
        )}
      </div>
      <div className="nl-card">
        <h3>Feeds (strongest later neurons it writes toward)</h3>
        {feeds.length ? (
          feeds.map((e, i) => (
            <div key={i} className="nl-kv" style={{ gridTemplateColumns: "1fr auto" }}>
              <NeuronLink l={e.layer} n={e.neuron} onSelect={p.onSelect} />
              <span className="nl-mono">{e.score}</span>
            </div>
          ))
        ) : (
          <p className="nl-note" style={{ margin: 0 }}>None stored for this neuron.</p>
        )}
        <h3 style={{ marginTop: 10 }}>Fed by</h3>
        {fed.length ? (
          fed.slice(0, 8).map((e, i) => (
            <div key={i} className="nl-kv" style={{ gridTemplateColumns: "1fr auto" }}>
              <NeuronLink l={e.layer} n={e.neuron} onSelect={p.onSelect} />
              <span className="nl-mono">{e.score}</span>
            </div>
          ))
        ) : (
          <p className="nl-note" style={{ margin: 0 }}>None stored for this neuron.</p>
        )}
      </div>
      <div className="nl-card">
        <h3>Neurons with similar output</h3>
        {similar ? (
          similar.map((e, i) => (
            <div key={i} className="nl-kv" style={{ gridTemplateColumns: "auto 1fr" }}>
              <NeuronLink l={e.layer} n={e.neuron} onSelect={p.onSelect} />
              <span className="nl-note" style={{ textAlign: "right" }}>{e.shared.slice(0, 4).join(" ")}</span>
            </div>
          ))
        ) : (
          <button className="nl-btn small" onClick={() => setSimilar(similarNeurons(p.layers, s.layer, s.neuron, 10))}>
            Find neurons that promote the same tokens
          </button>
        )}
      </div>
    </div>
  )
}

// ---- Investigate: scripted tools, no AI agent -----------------------------

interface Entry {
  id: number
  cmd: string
  body: ReactNode
}

const HELP = (
  <div className="nl-result">
    <div>Commands (each one runs a fixed tool over the published data; there is no AI model behind this panel):</div>
    <div className="nl-mono">explain [L16 N477]</div>
    <div className="nl-mono">compare L16.N477 L14.N2201</div>
    <div className="nl-mono">search tree</div>
    <div className="nl-mono">top 16</div>
    <div className="nl-mono">similar [L16 N477]</div>
    <div className="nl-mono">trace [L16 N477]</div>
    <div className="nl-mono">steer L16.N477 0.8</div>
  </div>
)

export function InvestigatePanel(p: {
  meta: ModelMeta
  layers: Map<number, LayerLens>
  contexts: Record<string, Context[]>
  links: Map<NeuronKey, Edge[]>
  selected: { layer: number; neuron: number } | null
  layer: number
  onSelect: (l: number, n: number) => void
  onSearch: (q: string, result?: { hits: number }) => void
  onSteer: (layer: number, neuron: number, dose: number) => void
  searchCount: (q: string) => { count: number; byLayer: [number, number][] }
}) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [text, setText] = useState("")
  const [id, setId] = useState(1)

  const sel = (arg: string | undefined) => (arg ? parseNeuron(arg, p.meta.layers, p.meta.neurons) : p.selected)

  const explain = (l: number, n: number): ReactNode => {
    const lens = p.layers.get(l)
    if (!lens) return <div className="nl-result">Layer {l} has not finished loading.</div>
    const rank = layerRank(lens, n)
    const ctx = p.contexts[`${l}.${n}`] ?? []
    const feeds = p.links.get(nkey(l, n)) ?? []
    return (
      <div className="nl-result">
        <Lens lens={lens} n={n} />
        <div style={{ marginTop: 6 }}>
          Peak activation {lens.actMax[n]} (rank {rank} of {p.meta.neurons} in layer {l}); mean {lens.actMean[n]}.
          {ctx[0] ? (
            <>
              {" "}
              Strongest stored text: <i>&ldquo;{ctx[0].text}&rdquo;</i> ({ctx[0].act}).
            </>
          ) : (
            " No stored activating text."
          )}
        </div>
        {feeds.length ? (
          <div>
            Writes toward:{" "}
            {feeds.slice(0, 3).map((e, i) => (
              <span key={i}>
                {i ? ", " : ""}
                <NeuronLink l={e.layer} n={e.neuron} onSelect={p.onSelect} />
              </span>
            ))}
            .
          </div>
        ) : null}
        <div className="nl-note">This is a fixed template over the published numbers, not a model&apos;s opinion.</div>
      </div>
    )
  }

  const exec = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    const [cmd, ...rest] = t.split(/\s+/)
    const arg = rest.join(" ")
    let body: ReactNode
    switch (cmd.toLowerCase()) {
      case "help":
        body = HELP
        break
      case "explain": {
        const s = sel(arg)
        body = s ? explain(s.layer, s.neuron) : <div className="nl-result">Select a neuron or pass one, like L16 N477.</div>
        if (s) p.onSelect(s.layer, s.neuron)
        break
      }
      case "compare": {
        const m = arg.split(/\s+(?=L?\d)/)
        const a = parseNeuron(m[0] ?? "", p.meta.layers, p.meta.neurons)
        const b = parseNeuron(m[1] ?? "", p.meta.layers, p.meta.neurons)
        if (!a || !b) {
          body = <div className="nl-result">Usage: compare L16.N477 L14.N2201</div>
          break
        }
        const la = p.layers.get(a.layer), lb = p.layers.get(b.layer)
        if (!la || !lb) {
          body = <div className="nl-result">A layer has not finished loading.</div>
          break
        }
        const up = new Set(la.up[a.neuron].map((x) => showToken(x).toLowerCase()))
        const shared = lb.up[b.neuron].map((x) => showToken(x).toLowerCase()).filter((x) => up.has(x))
        body = (
          <div className="nl-result">
            <div><NeuronLink l={a.layer} n={a.neuron} onSelect={p.onSelect} /></div>
            <Lens lens={la} n={a.neuron} />
            <div style={{ marginTop: 6 }}><NeuronLink l={b.layer} n={b.neuron} onSelect={p.onSelect} /></div>
            <Lens lens={lb} n={b.neuron} />
            <div style={{ marginTop: 6 }}>{shared.length ? `They both promote: ${shared.join(", ")}.` : "They promote no token in common."}</div>
          </div>
        )
        break
      }
      case "search": {
        if (!arg) {
          body = <div className="nl-result">Usage: search tree</div>
          break
        }
        const r = p.searchCount(arg)
        p.onSearch(arg)
        const top = [...r.byLayer].sort((x, y) => y[1] - x[1]).slice(0, 3)
        body = r.count ? (
          <div className="nl-result">
            {r.count} neurons promote or suppress &ldquo;{arg}&rdquo;; most in {top.map(([l, c]) => `L${l} (${c})`).join(", ")}. They are listed on the left and lit on the map.
          </div>
        ) : (
          <div className="nl-result">
            No neuron has &ldquo;{arg}&rdquo; among its top tokens. Try a related or shorter word, or switch the search to <i>fires</i>.
          </div>
        )
        break
      }
      case "top": {
        const l = arg ? Math.min(p.meta.layers - 1, Math.max(0, parseInt(arg.replace(/\D/g, ""), 10) || 0)) : p.layer
        const lens = p.layers.get(l)
        if (!lens) {
          body = <div className="nl-result">Layer {l} has not finished loading.</div>
          break
        }
        const order = lens.actMax.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 8)
        body = (
          <div className="nl-result">
            {order.map(([v, i]) => (
              <div key={i} className="nl-kv" style={{ gridTemplateColumns: "auto 1fr auto" }}>
                <NeuronLink l={l} n={i} onSelect={p.onSelect} />
                <span className="nl-note">+ {lens.up[i].slice(0, 3).map(showToken).join(" ")}</span>
                <span className="nl-mono">{v}</span>
              </div>
            ))}
          </div>
        )
        break
      }
      case "similar": {
        const s = sel(arg)
        if (!s) {
          body = <div className="nl-result">Select a neuron first.</div>
          break
        }
        const sim = similarNeurons(p.layers, s.layer, s.neuron, 8)
        body = (
          <div className="nl-result">
            {sim.length ? sim.map((e, i) => (
              <div key={i} className="nl-kv" style={{ gridTemplateColumns: "auto 1fr" }}>
                <NeuronLink l={e.layer} n={e.neuron} onSelect={p.onSelect} />
                <span className="nl-note" style={{ textAlign: "right" }}>{e.shared.slice(0, 4).join(" ")}</span>
              </div>
            )) : "No neuron shares a promoted token with it."}
          </div>
        )
        break
      }
      case "trace": {
        const s = sel(arg)
        if (!s) {
          body = <div className="nl-result">Select a neuron first.</div>
          break
        }
        const chain: Edge[] = []
        let cur = { layer: s.layer, neuron: s.neuron }
        for (let i = 0; i < 4; i++) {
          const e = (p.links.get(nkey(cur.layer, cur.neuron)) ?? [])[0]
          if (!e) break
          chain.push(e)
          cur = { layer: e.layer, neuron: e.neuron }
        }
        body = (
          <div className="nl-result">
            {chain.length ? (
              <>
                <NeuronLink l={s.layer} n={s.neuron} onSelect={p.onSelect} />
                {chain.map((e, i) => (
                  <span key={i}>
                    {" → "}
                    <NeuronLink l={e.layer} n={e.neuron} onSelect={p.onSelect} />
                  </span>
                ))}
                <div className="nl-note">Following the strongest stored &ldquo;feeds&rdquo; edge at each step.</div>
              </>
            ) : (
              "No stored edges leave this neuron."
            )}
          </div>
        )
        break
      }
      case "steer": {
        const m = /^(\S+(?:\s+N?\d+)?)\s+(-?\d*\.?\d+)\s*$/i.exec(arg)
        const s = m ? parseNeuron(m[1], p.meta.layers, p.meta.neurons) : null
        if (!m || !s) {
          body = <div className="nl-result">Usage: steer L16.N477 0.8</div>
          break
        }
        p.onSteer(s.layer, s.neuron, Math.max(-3, Math.min(3, +m[2])))
        body = <div className="nl-result">Added {fmtNeuron(s.layer, s.neuron)} at dose {fmtDose(+m[2])} to the recipe. Open the Steer tab to run it.</div>
        break
      }
      default:
        body = <div className="nl-result">Unknown command &ldquo;{cmd}&rdquo;. Type <span className="nl-mono">help</span>.</div>
    }
    setEntries((e) => [...e, { id, cmd: t, body }])
    setId((i) => i + 1)
    setText("")
  }

  const sl = p.selected
  return (
    <div className="nl-pane">
      <div className="nl-note">
        An investigation you drive yourself. Every line below is a fixed tool over the published data; there is no AI agent here and nothing leaves the page.
      </div>
      <div className="nl-chips" style={{ padding: 0 }}>
        {sl ? (
          <>
            <button className="nl-chip" onClick={() => exec(`explain L${sl.layer} N${sl.neuron}`)}>Explain selected</button>
            <button className="nl-chip" onClick={() => exec(`similar L${sl.layer} N${sl.neuron}`)}>Find similar</button>
            <button className="nl-chip" onClick={() => exec(`trace L${sl.layer} N${sl.neuron}`)}>Trace feeds</button>
          </>
        ) : null}
        <button className="nl-chip" onClick={() => exec(`top ${p.layer}`)}>Top neurons in L{p.layer}</button>
        <button className="nl-chip" onClick={() => exec("help")}>Help</button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {entries.length === 0 ? <div className="nl-empty" style={{ padding: 0 }}>Nothing yet. Pick a command above or type one below.</div> : null}
        {entries.map((e) => (
          <div key={e.id}>
            <div className="nl-tool">
              <b>&gt; {e.cmd.split(" ")[0]}</b> {e.cmd.split(" ").slice(1).join(" ")}
            </div>
            {e.body}
          </div>
        ))}
      </div>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          exec(text)
        }}
        style={{ display: "flex", gap: 6 }}
      >
        <input className="nl-input nl-mono" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="explain L16 N477   ·   search tree   ·   help" aria-label="Command" />
        <button className="nl-btn" type="submit">Run</button>
      </form>
    </div>
  )
}

// ---- Find: contrast search in the browser ----------------------------------

const EXAMPLES: { label: string; a: string; b: string }[] = [
  {
    label: "French vs English",
    a: "Je voudrais un café avec du lait, s’il vous plaît.\nNous allons à la plage ce week-end avec nos amis.\nIl fait très beau aujourd’hui, vous ne trouvez pas ?\nLe train pour Lyon part dans dix minutes.",
    b: "I would like a coffee with milk, please.\nWe are going to the beach this weekend with our friends.\nIt is very nice today, don’t you think?\nThe train to Lyon leaves in ten minutes.",
  },
  {
    label: "Cooking vs other",
    a: "Whisk the eggs and sugar, then fold in the flour and bake for twenty minutes.\nSimmer the garlic and onions in butter until soft, then add the tomatoes.\nKnead the dough, let it rise, and brush it with olive oil.\nSeason the soup with salt and a splash of lemon.",
    b: "The committee will meet on Tuesday to review the quarterly budget.\nThe rocket reached orbit after a smooth second-stage burn.\nShe parked the car and walked to the station.\nThe court dismissed the appeal on procedural grounds.",
  },
  {
    label: "Formal vs casual",
    a: "I am writing to inform you that your application has been received and will be reviewed.\nWe regret to advise that the meeting has been rescheduled.\nPlease find the attached document for your consideration.\nKindly confirm your attendance at your earliest convenience.",
    b: "hey just letting you know we got your application, will take a look\nbtw the meeting got moved, sorry!\nhere's the doc, lmk what you think\ncan you tell me if you're coming? thx",
  },
]

export function FindPanel(p: {
  meta: ModelMeta
  engine: NeuronEngine | null
  ready: boolean
  onLoad: () => void
  onSelect: (l: number, n: number) => void
  onSteer: (l: number, n: number, d: number) => void
  layers: Map<number, LayerLens>
}) {
  const [a, setA] = useState(EXAMPLES[0].a)
  const [b, setB] = useState(EXAMPLES[0].b)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [rows, setRows] = useState<{ layer: number; neuron: number; d: number; ma: number; mb: number }[] | null>(null)

  const run = async () => {
    if (!p.engine) return
    if (!p.ready) return p.onLoad()
    const A = a.split("\n").map((x) => x.trim()).filter(Boolean)
    const B = b.split("\n").map((x) => x.trim()).filter(Boolean)
    if (A.length < 2 || B.length < 2) return setErr("Give at least two lines in each box.")
    setBusy(true)
    setErr("")
    try {
      const size = p.meta.layers * p.meta.neurons
      const stat = async (lines: string[]) => {
        const sum = new Float64Array(size), sq = new Float64Array(size)
        for (const t of lines) {
          const r = await p.engine!.activations(t)
          for (let i = 0; i < size; i++) {
            sum[i] += r.max[i]
            sq[i] += r.max[i] * r.max[i]
          }
        }
        const n = lines.length
        const mean = new Float64Array(size), vr = new Float64Array(size)
        for (let i = 0; i < size; i++) {
          mean[i] = sum[i] / n
          vr[i] = Math.max(0, sq[i] / n - mean[i] * mean[i])
        }
        return { mean, vr }
      }
      const SA = await stat(A)
      const SB = await stat(B)
      const out: { layer: number; neuron: number; d: number; ma: number; mb: number }[] = []
      const N = p.meta.neurons
      for (let i = 0; i < size; i++) {
        const d = (SA.mean[i] - SB.mean[i]) / Math.sqrt((SA.vr[i] + SB.vr[i]) / 2 + 0.25)
        out.push({ layer: Math.floor(i / N), neuron: i % N, d, ma: SA.mean[i], mb: SB.mean[i] })
      }
      out.sort((x, y) => y.d - x.d)
      setRows(out.slice(0, 30))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="nl-pane">
      <div className="nl-note">
        Find neurons for an idea of your own. Put examples that have it in the first box and examples that do not in the second (one per line). The model reads every line and we rank neurons by how much more they fire on the first set. Needs the model loaded.
      </div>
      <div className="nl-chips" style={{ padding: 0 }}>
        {EXAMPLES.map((e) => (
          <button key={e.label} className="nl-chip" onClick={() => { setA(e.a); setB(e.b); setRows(null) }}>
            {e.label}
          </button>
        ))}
      </div>
      <label className="nl-note" htmlFor="nl-a">Has the thing</label>
      <textarea id="nl-a" className="nl-textarea" value={a} onChange={(e) => setA(e.target.value)} style={{ minHeight: 110 }} />
      <label className="nl-note" htmlFor="nl-b">Does not</label>
      <textarea id="nl-b" className="nl-textarea" value={b} onChange={(e) => setB(e.target.value)} style={{ minHeight: 110 }} />
      <div>
        <button className="nl-btn primary" onClick={run} disabled={!p.engine || busy}>
          {!p.engine ? "Engine unavailable" : busy ? "Reading the texts…" : p.ready ? "Rank neurons" : `Load model (${p.engine.info.downloadMB} MB) first`}
        </button>
      </div>
      {err ? <div className="nl-note nl-warn">{err}</div> : null}
      {rows ? (
        <div className="nl-card">
          <h3>Top 30 by contrast (effect size, mean peak on each set)</h3>
          {rows.map((r, i) => {
            const lens = p.layers.get(r.layer)
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 8, alignItems: "baseline", padding: "3px 0", borderTop: i ? "1px solid var(--nl-line)" : 0 }}>
                <NeuronLink l={r.layer} n={r.neuron} onSelect={p.onSelect} />
                <span className="nl-note" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lens ? lens.up[r.neuron].slice(0, 3).map(showToken).join(" ") : ""}
                </span>
                <span className="nl-mono" title={`${r.ma.toFixed(1)} vs ${r.mb.toFixed(1)}`}>{r.d.toFixed(1)}</span>
                <button className="nl-btn small" onClick={() => p.onSteer(r.layer, r.neuron, 0.8)}>+ steer</button>
              </div>
            )
          })}
          <p className="nl-note">A high contrast says the neuron fires differently on your two sets. Whether pushing it changes the model&apos;s writing is a separate test: try it in the Steer tab, and compare against a random neuron.</p>
        </div>
      ) : null}
    </div>
  )
}

export { sgn }
