// Page side of browser-test.mts: drives the public engine API from a real browser tab.
import { configureEngine, loadModel, cacheStatus, clearCache, generate, generateMany, activations, logits, unloadModel, isLoaded, MODEL_INFO, chatPrompt } from "../../components/neuron-lab/engine"

declare global { interface Window { run(cal: unknown, steers: unknown, text: string): Promise<unknown>; reload(): Promise<unknown> } }
const t = () => performance.now()

window.run = async (cal, steers, text) => {
  const out: Record<string, unknown> = { crossOriginIsolated: self.crossOriginIsolated, simd: true }
  configureEngine({ calibration: cal as never, workerFactory: () => new Worker("/worker.js", { type: "module" }) })
  out.cacheBefore = await cacheStatus()
  const prog: Array<[number, string]> = []
  let t0 = t()
  await loadModel((f, m) => { if (!prog.length || m !== prog[prog.length - 1][1]) prog.push([Math.round(f * 1000) / 1000, m]) })
  out.firstLoadSec = (t() - t0) / 1000
  out.progressSamples = prog.filter((_, i) => i % 6 === 0 || i === prog.length - 1).slice(0, 14)
  out.cacheAfter = await cacheStatus()
  out.isLoaded = isLoaded()

  const toks: string[] = []
  t0 = t()
  const g = await generate({ prompt: "The capital of France is", steers: [], maxNewTokens: 24, temperature: 0, topK: 1, seed: 1, onToken: (s) => toks.push(s) })
  out.plain = { text: g.text, streamed: toks.join("") === g.text, msPerToken: g.msPerToken, wallMs: t() - t0 }

  const gs = await generate({ prompt: "The capital of France is", steers: steers as never, maxNewTokens: 24, temperature: 0, topK: 1, seed: 1, onToken: () => {} })
  out.steered = { text: gs.text, differs: gs.text !== g.text, steers }

  // sampling is seeded and reproducible
  const a = await generate({ prompt: "Once upon a time", steers: [], maxNewTokens: 16, temperature: 0.8, topK: 40, seed: 7, onToken: () => {} })
  const b = await generate({ prompt: "Once upon a time", steers: [], maxNewTokens: 16, temperature: 0.8, topK: 40, seed: 7, onToken: () => {} })
  const c = await generate({ prompt: "Once upon a time", steers: [], maxNewTokens: 16, temperature: 0.8, topK: 40, seed: 8, onToken: () => {} })
  out.seeded = { sameSeedSame: a.text === b.text, otherSeedDiffers: a.text !== c.text }

  // three steered variants decoded together, streamed per variant
  {
    const cols = ["", "", ""]
    const st = (d: number) => (steers as { layer: number; neuron: number; dose: number }[]).map((s) => ({ ...s, dose: d }))
    t0 = t()
    const r = await generateMany({ prompt: "The sea is", variants: [st(-0.8), [], st(0.8)], maxNewTokens: 20, temperature: 0, topK: 1, seed: 1, onToken: (v, s) => { cols[v] += s } })
    const solo = await generate({ prompt: "The sea is", steers: [], maxNewTokens: 20, temperature: 0, topK: 1, seed: 1, onToken: () => {} })
    out.generateMany = { ms: t() - t0, streamedEqualsResult: cols.every((c, i) => c === r[i].text), baselineEqualsSolo: r[1].text === solo.text, texts: r.map((x) => x.text.slice(0, 50)) }
  }

  // abort
  const ac = new AbortController()
  let n = 0
  const ab = await generate({ prompt: "Count slowly: one", steers: [], maxNewTokens: 200, temperature: 0, topK: 1, seed: 1, signal: ac.signal, onToken: () => { if (++n === 5) ac.abort() } })
  out.abort = { tokens: ab.tokens, stoppedEarly: ab.tokens < 200 }

  t0 = t()
  const act = await activations(text)
  out.activations = { ms: t() - t0, tokens: act.tokens.length, maxLen: act.max.length, expectLen: MODEL_INFO.layers * MODEL_INFO.neurons, byToken: !!act.byToken, sample: act.byToken ? Array.from(act.byToken(10, 5)).slice(0, 4) : null }
  const lg = await logits("Hello", [])
  out.logitsLen = lg.length
  out.chatPrompt = chatPrompt("Hi")
  return out
}

window.reload = async () => {
  unloadModel()
  const out: Record<string, unknown> = { cacheBefore: await cacheStatus() }
  const prog: Array<[number, string]> = []
  const t0 = t()
  await loadModel((f, m) => { if (!prog.length || m !== prog[prog.length - 1][1]) prog.push([Math.round(f * 1000) / 1000, m]) })
  out.reloadSec = (t() - t0) / 1000
  out.messages = prog.map((p) => p[1]).filter((m, i, a) => a.indexOf(m) === i).slice(0, 6)
  const g = await generate({ prompt: "The capital of France is", steers: [], maxNewTokens: 8, temperature: 0, topK: 1, seed: 1, onToken: () => {} })
  out.text = g.text
  await clearCache()
  out.cacheAfterClear = await cacheStatus()
  return out
}
