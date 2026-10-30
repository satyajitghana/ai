// Multiply/ablate mode check. For a one-token prompt, scaling a neuron's activation a by f must give the same logits as
// adding (f - 1) * a (the engine's absolute `delta` hook). Also: f = 1 is a no-op and f = 0 changes the logits.
//   tsx scripts/neuron-lab/test-mul.mts <gguf> <tokenizer.json> <ref-dir>
import { readFileSync, openSync, readSync, fstatSync } from "node:fs"
import { Runtime } from "../../components/neuron-lab/engine/runtime"
import type { ByteSource } from "../../components/neuron-lab/engine/types"

const [gguf, tokPath, refDir] = process.argv.slice(2)
const fd = openSync(gguf, "r")
const src: ByteSource = {
  size: fstatSync(fd).size,
  async read(off, dst) { let n = 0; while (n < dst.length) { const r = readSync(fd, dst, n, dst.length - n, off + n); if (!r) throw new Error("eof"); n += r } },
}
const rt = await Runtime.create(src, JSON.parse(readFileSync(tokPath, "utf8")))
rt.setCalibration(JSON.parse(readFileSync(`${refDir}/calibration.json`, "utf8")))
const P = "The"
const maxdiff = (a: Float32Array, b: Float32Array) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m }
const base = rt.logits(P, [])
const act = rt.activations(P)
const NI = 3072
let worst = 0
let cases = 0
for (const [layer, neuron] of [[10, 5], [16, 477], [20, 1505], [23, 1505], [26, 12]]) {
  const a = act.max[layer * NI + neuron]
  for (const f of [0, 0.5, 2]) {
    const mul = rt.logits(P, [{ layer, neuron, dose: f, mode: "mul" }])
    const add = rt.logits(P, [{ layer, neuron, dose: 0, delta: (f - 1) * a }])
    const d = maxdiff(mul, add)
    worst = Math.max(worst, d)
    cases++
  }
}
console.log(`mul vs add-equivalent: ${cases} cases, worst max|dlogit| ${worst.toExponential(2)}`)
console.log(`factor 1 is a no-op: max|dlogit| ${maxdiff(rt.logits(P, [{ layer: 16, neuron: 477, dose: 1, mode: "mul" }]), base).toExponential(2)}`)
console.log(`factor 0 on an active neuron changes logits: max|dlogit| ${maxdiff(rt.logits(P, [{ layer: 16, neuron: 477, dose: 0, mode: "mul" }]), base).toFixed(3)}`)
