/* eslint-disable @typescript-eslint/no-explicit-any */
// Node parity test for the in-browser engine against the PyTorch reference (engine_reference.py).
//   tsx scripts/neuron-lab/verify-engine.mts <gguf> <tokenizer.json> <ref-dir>
import { readFileSync, openSync, readSync, fstatSync } from "node:fs"
import { Runtime } from "../../components/neuron-lab/engine/runtime"
import type { ByteSource } from "../../components/neuron-lab/engine/types"

const [gguf, tokPath, refDir] = process.argv.slice(2)
const fd = openSync(gguf, "r")
const src: ByteSource = {
  size: fstatSync(fd).size,
  async read(off, dst) { let n = 0; while (n < dst.length) { const r = readSync(fd, dst, n, dst.length - n, off + n); if (!r) throw new Error("eof"); n += r } },
}
const prompts = JSON.parse(readFileSync(new URL("./test-prompts.json", import.meta.url), "utf8"))
const ref = JSON.parse(readFileSync(`${refDir}/ref.json`, "utf8"))
const cal = JSON.parse(readFileSync(`${refDir}/calibration.json`, "utf8"))
const f32 = (p: string) => { const b = readFileSync(p); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) }
const V = ref.vocab, NL = ref.n_layers, NI = ref.inter

let t0 = performance.now()
const rt = await Runtime.create(src, JSON.parse(readFileSync(tokPath, "utf8")))
rt.setCalibration(cal)
console.log(`load: ${((performance.now() - t0) / 1000).toFixed(1)} s`)

// 1. tokenizer
let tokBad = 0
for (const c of ref.tokenizer) {
  const got = rt.tokenize(c.text)
  if (JSON.stringify(got) !== JSON.stringify(c.ids)) { tokBad++; console.log("TOKENIZER MISMATCH", JSON.stringify(c.text).slice(0, 80), c.ids.slice(0, 12), got.slice(0, 12)) }
}
console.log(`tokenizer: ${ref.tokenizer.length - tokBad}/${ref.tokenizer.length} exact`)

function metrics(a: Float32Array, b: Float32Array) {
  let num = 0, den = 0, maxAbs = 0, maxRef = 0
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; num += d * d; den += b[i] * b[i]; if (Math.abs(d) > maxAbs) maxAbs = Math.abs(d); if (Math.abs(b[i]) > maxRef) maxRef = Math.abs(b[i]) }
  let ai = 0, bi = 0
  for (let i = 1; i < a.length; i++) { if (a[i] > a[ai]) ai = i; if (b[i] > b[bi]) bi = i }
  return { relL2: Math.sqrt(num / den), maxAbsOverMaxLogit: maxAbs / maxRef, top1: ai === bi }
}

// 2. logits
const L = f32(`${refDir}/logits.f32`)
const rows: ReturnType<typeof metrics>[] = []
t0 = performance.now()
let ntok = 0
prompts.prompts.forEach((p: string, i: number) => {
  const got = rt.logits(p, [])
  ntok += rt.tokenize(p).length
  rows.push(metrics(got, L.subarray(i * V, (i + 1) * V)))
})
const secs = (performance.now() - t0) / 1000
const mx = (k: "relL2" | "maxAbsOverMaxLogit") => Math.max(...rows.map((r) => r[k]))
console.log(`logits (${rows.length} prompts, ${ntok} tokens, ${secs.toFixed(1)} s): worst relL2 ${mx("relL2").toExponential(2)}, worst max|dlogit|/max|logit| ${mx("maxAbsOverMaxLogit").toExponential(2)}, top-1 agree ${rows.filter((r) => r.top1).length}/${rows.length}`)

// 3. steering: engine(steered)-engine(base) vs torch(steered)-torch(base)
const LS = f32(`${refDir}/logits_steer.f32`), LB = f32(`${refDir}/logits_steer_base.f32`)
prompts.steers.forEach((c: { prompt: string; steers: any[] }, i: number) => {
  const base = rt.logits(c.prompt, []), st = rt.logits(c.prompt, c.steers)
  const dE = new Float32Array(V), dR = new Float32Array(V)
  for (let j = 0; j < V; j++) { dE[j] = st[j] - base[j]; dR[j] = LS[i * V + j] - LB[i * V + j] }
  const m = metrics(st, LS.subarray(i * V, (i + 1) * V))
  let num = 0, den = 0, dot = 0, ne = 0
  for (let j = 0; j < V; j++) { num += (dE[j] - dR[j]) ** 2; den += dR[j] ** 2; dot += dE[j] * dR[j]; ne += dE[j] ** 2 }
  console.log(`steer case ${i}: steered logits relL2 ${m.relL2.toExponential(2)} top1 ${m.top1} | delta-logit relL2 ${den ? Math.sqrt(num / den).toFixed(4) : "n/a"} cos ${den ? (dot / Math.sqrt(den * ne)).toFixed(5) : "n/a"} |delta| ${Math.sqrt(den).toFixed(2)}`)
})

// 4. activations
const AM = f32(`${refDir}/act_max.f32`)
prompts.activationTexts.forEach((t: string, i: number) => {
  const a = rt.activations(t)
  const m = metrics(a.max, AM.subarray(i * NL * NI, (i + 1) * NL * NI))
  // top-20 overlap of the most active neurons
  const top = (x: Float32Array) => Array.from(x.keys()).sort((p, q) => x[q] - x[p]).slice(0, 20)
  const A = new Set(top(a.max)), B = top(AM.subarray(i * NL * NI, (i + 1) * NL * NI))
  console.log(`activations text ${i}: relL2 ${m.relL2.toExponential(2)}, top-20 overlap ${B.filter((x) => A.has(x)).length}/20, byToken ${a.byToken ? "yes" : "no"}`)
})

// 5. greedy generation vs torch float32
for (const g of ref.greedy) {
  let out: number[] = []
  const r = await rt.generate({ prompt: g.prompt, steers: [], maxNewTokens: g.ids.length, temperature: 0, topK: 1, seed: 1, onToken: () => {} })
  out = rt.tokenize(g.prompt).length ? [] : out
  const ids: number[] = []
  // re-run to capture ids through the sampler directly
  rt.core.reset()
  let lg = rt.core.forward(rt.tokenize(g.prompt), true)!
  for (let k = 0; k < g.ids.length; k++) { let b = 0; for (let j = 1; j < lg.length; j++) if (lg[j] > lg[b]) b = j; ids.push(b); lg = rt.core.forward([b], true)! }
  let same = 0
  while (same < ids.length && ids[same] === g.ids[same]) same++
  console.log(`greedy "${g.prompt.slice(0, 30).replace(/\n/g, " ")}": ${same}/${g.ids.length} tokens identical to torch f32; ${r.msPerToken.toFixed(0)} ms/token`)
}

// 6. batched decode: three steered variants of one prompt in one pass equal three separate runs
{
  const P = "Write one sentence about the sea."
  const st = (d: number) => [{ layer: 14, neuron: 1000, dose: d }, { layer: 20, neuron: 2000, dose: d }]
  const variants = [st(-0.8), [], st(0.8)]
  const solo: string[] = []
  let t = performance.now()
  for (const v of variants) solo.push((await rt.generate({ prompt: P, steers: v, maxNewTokens: 24, temperature: 0, topK: 1, seed: 3, onToken: () => {} })).text)
  const soloMs = performance.now() - t
  const got: string[] = ["", "", ""]
  t = performance.now()
  const r = await rt.generateMany({ prompt: P, variants, maxNewTokens: 24, temperature: 0, topK: 1, seed: 3, onToken: (b, s) => { got[b] += s } })
  const batchMs = performance.now() - t
  console.log(`batched decode: ${variants.map((_, b) => (r[b].text === solo[b] && got[b] === r[b].text ? "identical" : "DIFFERENT")).join(", ")}; 3 solo runs ${(soloMs / 1000).toFixed(1)} s vs one batch ${(batchMs / 1000).toFixed(1)} s (${(soloMs / batchMs).toFixed(2)}x)`)
  const T2 = await rt.generateMany({ prompt: P, variants, maxNewTokens: 12, temperature: 0.8, topK: 40, seed: 5, onToken: () => {} })
  const S2: string[] = []
  for (const v of variants) S2.push((await rt.generate({ prompt: P, steers: v, maxNewTokens: 12, temperature: 0.8, topK: 40, seed: 5, onToken: () => {} })).text)
  console.log(`batched sampling (seeded): ${T2.map((x, b) => (x.text === S2[b] ? "identical" : "DIFFERENT")).join(", ")}`)
  console.log("variants:", JSON.stringify(solo.map((x) => x.slice(0, 60))))
}
