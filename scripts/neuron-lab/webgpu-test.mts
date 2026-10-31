/* eslint-disable @typescript-eslint/no-explicit-any */
// WebGPU parity test: headless Chromium with its software adapter (SwiftShader), the engine in a Worker.
// Checks the GPU path against the CPU path and the PyTorch reference; says nothing about GPU speed.
//   NODE_PATH=/opt/node-tools/node_modules tsx scripts/neuron-lab/webgpu-test.mts <gguf> <tokenizer.json> <ref-dir> <model-id> [prompts.json]
import { createRequire } from "node:module"
import { readFileSync, statSync, openSync, readSync, mkdirSync } from "node:fs"
import { createServer } from "node:http"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { MODELS, type ModelId } from "../../components/neuron-lab/engine/models"

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const esbuild = require(require.resolve("esbuild", { paths: [process.cwd() + "/node_modules/.pnpm/esbuild@0.28.2/node_modules"] }))
const { chromium } = require("playwright")
const [gguf, tokPath, refDir, modelArg, promptsPath] = process.argv.slice(2)
const modelId = (modelArg ?? "qwen3.5-0.8b") as ModelId
const files = MODELS[modelId].files
const ggufName = files.ggufUrl.split("/").pop()!.replace(/\./g, "\\.")
const out = join(process.env.TMPDIR || "/tmp", "neuron-lab-gpu"); mkdirSync(out, { recursive: true })

await esbuild.build({ entryPoints: { page: join(here, "webgpu-test-page.ts"), worker: join(here, "../../components/neuron-lab/engine/worker.ts") }, bundle: true, format: "esm", outdir: out, target: "es2022", logLevel: "error" })
const server = createServer((req, res) => {
  const p = req.url === "/" ? "/index.html" : req.url!
  if (p === "/index.html") { res.setHeader("content-type", "text/html"); res.end(`<!doctype html><script type="module" src="/page.js"></script>`); return }
  try { res.setHeader("content-type", "text/javascript"); res.end(readFileSync(join(out, p))) } catch { res.statusCode = 404; res.end() }
}).listen(0)
const port = (server.address() as { port: number }).port

const prompts = JSON.parse(readFileSync(promptsPath ?? join(here, "test-prompts.json"), "utf8"))
const V = MODELS[modelId].vocab
// <ref-dir> "-" skips the PyTorch comparison (GPU vs the CPU engine only)
const N = refDir === "-" ? 0 : 2
const refAll = N ? readFileSync(join(refDir, "logits.f32")) : Buffer.alloc(0)
const refB64 = N ? Buffer.from(refAll.buffer, refAll.byteOffset, N * V * 4).toString("base64") : ""
const cases = {
  prompts: prompts.prompts.slice(0, 2),
  steers: [
    { name: "add +0.8 at 14.1000", prompt: "The sea is", steers: [{ layer: 14, neuron: 1000, dose: 0.8 }] },
    { name: "multiply x0 plus add", prompt: "The sea is", steers: [{ layer: 10, neuron: 500, dose: 0, mode: "mul" }, { layer: 6, neuron: 100, dose: 4, mode: "add" }] },
  ],
  gen: ["The capital of France is"],
  genTokens: 6,
  variants: [[{ layer: 14, neuron: 1000, dose: -0.8 }], [], [{ layer: 14, neuron: 1000, dose: 0.8 }]],
}

const fd = openSync(gguf, "r"), size = statSync(gguf).size
const tokText = readFileSync(tokPath)
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader"] })
const page = await (await browser.newContext()).newPage()
page.on("console", (m: any) => { const t = m.text(); if (t.startsWith("[gpu]") || (/error|fail|warn/i.test(t) && !/404/.test(t))) console.log(t.slice(0, 600)) })
page.on("pageerror", (e: Error) => console.log("[pageerror]", e.message))
const dead = new Promise<never>((_, rej) => {
  page.on("crash", () => rej(new Error("page crashed (renderer killed, usually out of memory)")))
  setTimeout(() => rej(new Error("webgpu test timed out after 3 hours")), 3 * 60 * 60e3).unref()
})
dead.catch(() => {})
await page.route(new RegExp(`huggingface\\.co/.*${ggufName}`), async (route: any) => {
  const m = /bytes=(\d+)-(\d+)/.exec(route.request().headers()["range"] || "")
  if (!m) return route.fulfill({ status: 200, body: Buffer.alloc(0) })
  const a = +m[1], b = Math.min(+m[2], size - 1), buf = Buffer.alloc(b - a + 1)
  readSync(fd, buf, 0, buf.length, a)
  await route.fulfill({ status: 206, headers: { "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "access-control-allow-origin": "*" }, body: buf })
})
await page.route(/huggingface\.co\/.*tokenizer\.json/, (route: any) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: tokText }))
await page.goto(`http://127.0.0.1:${port}/`)
const r = await Promise.race([dead, page.evaluate(([m, b, n, c]: [string, string, number, unknown]) => (window as any).runGpu(m, b, n, c), [modelId, refB64, N, cases] as [string, string, number, unknown])])
console.log(JSON.stringify(r, null, 1))
await browser.close(); server.close()
