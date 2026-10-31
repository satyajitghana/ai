/* eslint-disable @typescript-eslint/no-explicit-any */
// Real-browser test of the engine: headless Chromium, OPFS cache, Web Worker, Range downloads.
// The Hugging Face URLs are served from local files (with HTTP Range) so the test needs no network.
//   NODE_PATH=/opt/node-tools/node_modules tsx scripts/neuron-lab/browser-test.mts <gguf> <tokenizer.json> <ref-dir>
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
const [gguf, tokPath, refDir, modelArg] = process.argv.slice(2)
const modelId = (modelArg ?? "qwen3-0.6b") as ModelId
const files = MODELS[modelId].files
const ggufName = files.ggufUrl.split("/").pop()!.replace(/\./g, "\\.")
const out = join(process.env.TMPDIR || "/tmp", "neuron-lab-bt"); mkdirSync(out, { recursive: true })

await esbuild.build({ entryPoints: { page: join(here, "browser-test-page.ts"), worker: join(here, "../../components/neuron-lab/engine/worker.ts") }, bundle: true, format: "esm", outdir: out, target: "es2022", logLevel: "error" })
const server = createServer((req, res) => {
  const p = req.url === "/" ? "/index.html" : req.url!
  if (p === "/index.html") { res.setHeader("content-type", "text/html"); res.end(`<!doctype html><script type="module" src="/page.js"></script>`); return }
  try { res.setHeader("content-type", "text/javascript"); res.end(readFileSync(join(out, p))) } catch { res.statusCode = 404; res.end() }
}).listen(0)
const port = (server.address() as { port: number }).port

// the 0.6B run uses the PyTorch calibration; any other model is left to calibrate itself in the browser
const cal = modelId === "qwen3-0.6b" ? JSON.parse(readFileSync(join(refDir, "calibration.json"), "utf8")) : null
const fd = openSync(gguf, "r"), size = statSync(gguf).size
const tokText = readFileSync(tokPath)
let ggufRequests = 0, ggufBytes = 0
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
page.on("console", (m: { text(): string }) => { const t = m.text(); if (/error|fail/i.test(t)) console.log("[page]", t.slice(0, 200)) })
page.on("pageerror", (e: Error) => console.log("[pageerror]", e.message))
await page.route(new RegExp(`huggingface\\.co/.*${ggufName}`), async (route: any) => {
  const range = route.request().headers()["range"]
  const m = /bytes=(\d+)-(\d+)/.exec(range || "")
  if (!m) return route.fulfill({ status: 200, body: Buffer.alloc(0) })
  const a = +m[1], b = Math.min(+m[2], size - 1), buf = Buffer.alloc(b - a + 1)
  readSync(fd, buf, 0, buf.length, a)
  ggufRequests++; ggufBytes += buf.length
  await route.fulfill({ status: 206, headers: { "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "access-control-allow-origin": "*" }, body: buf })
})
await page.route(/huggingface\.co\/.*tokenizer\.json/, (route: any) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: tokText }))
if (size !== files.ggufBytes) console.log("NOTE: local gguf size differs from the pinned size", size, files.ggufBytes)

const dead = new Promise<never>((_, rej) => {
  page.on("crash", () => rej(new Error("page crashed (the renderer was killed, usually out of memory)")))
  setTimeout(() => rej(new Error("browser test timed out after 25 minutes")), 25 * 60e3).unref()
})
dead.catch(() => {})
await page.goto(`http://127.0.0.1:${port}/`)
const steers = [{ layer: 14, neuron: 1000, dose: 0.8 }]
const r1 = await Promise.race([dead, page.evaluate(([c, s, m]: [unknown, unknown, string]) => (window as any).run(c, s, "Le chat dort sur le canapé.", m), [cal, steers, modelId] as [unknown, unknown, string])])
console.log(JSON.stringify(r1, null, 1))
console.log(`gguf Range requests served: ${ggufRequests}, ${(ggufBytes / 1e6).toFixed(0)} MB`)
const before = ggufRequests
const r2 = await Promise.race([dead, page.evaluate(() => (window as any).reload())])
console.log(JSON.stringify(r2, null, 1))
console.log(`second load: extra gguf requests ${ggufRequests - before} (0 expected: served from OPFS)`)
await browser.close(); server.close()
