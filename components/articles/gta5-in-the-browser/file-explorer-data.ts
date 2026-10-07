// Generated from the files playgta5.com served on 6 October 2026 (scratch gen.py): every excerpt is the
// verbatim source lines (tabs as two spaces, common indent removed), numbered as in that file. game.js ships
// as one line, so its numbers are from a prettier-formatted copy. game.wasm is described from its section
// headers and name section only; none of its code is reproduced.

export type Excerpt = { file: string; start: number; lang: string; code: string; why: string }

export const EXCERPTS: Record<string, Excerpt> = {
 "isolation": {
  "file": "index.html",
  "start": 356,
  "lang": "js",
  "code": "if (!crossOriginIsolated) { document.getElementById('label').textContent = 'not cross-origin isolated: open the page over https (or localhost); the server sends COOP/COEP'; document.getElementById('label').style.color = '#e66'; }\nelse {\n  const offscreen = canvas.transferControlToOffscreen();",
  "why": "The gate and the handoff. Without COOP/COEP there is no SharedArrayBuffer, so the page refuses to start; with them, the canvas leaves the main thread before anything else happens."
 },
 "audio-start": {
  "file": "index.html",
  "start": 447,
  "lang": "js",
  "code": "const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });\nawait ctx.audioWorklet.addModule(BASE + '/audio-worklet.js');\nconst node = new AudioWorkletNode(ctx, 'game-audio', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: audioPending });\nnode.connect(ctx.destination);",
  "why": "The worklet gets no audio from the page. processorOptions carries the shared memory and the ring's address, so the worklet reads the engine's mixer output directly."
 },
 "workers": {
  "file": "loader.js",
  "start": 22,
  "lang": "js",
  "code": "const gpu = new Worker(B + '/wgpu_worker.js' + (gq.toString() ? '?' + gq : ''));\nconst io = new Worker(B + '/io_worker.js');\nio.postMessage({ init: true, base: self.location.origin + '/data/', noStore: !!m.noStore, record: !!m.record, trace: !!m.trace, log: !!m.remoteLog, noHints: !!m.noHints, bootset: m.lowMemory ? 'bootset_low.json' : 'bootset.json' });    // starts the prefetch of the boot read set at once    // HTTP reads of all engine threads (platform/file/httpfs_wasm.cpp); same reason to create it up front\nlet loaded = 0;\nio.onmessage = (e) => { if (e.data.loaded && ++loaded === 2) start(); };\ngpu.onmessage = (e) => {\n  if (e.data.loaded && ++loaded === 2) start();\n};",
  "why": "Both helper workers are created before game.js is imported, and the engine starts only when both report loaded. The IO worker's first message already names the boot set, so the prefetch overlaps the 63 MB engine download."
 },
 "retry": {
  "file": "loader.js",
  "start": 30,
  "lang": "js",
  "code": "// An overloaded host answers 503/500/429 (2026-10-06): retried up to 8 times with growing, jittered waits (~20 s in all) instead of compiling an error page.\nconst fetchWasm = async () => {\n  for (let attempt = 0; ; attempt++) {\n    let res = null, err = null;\n    try { res = await fetch(B + '/game.wasm'); } catch (e) { err = e; }\n    if (res && res.ok) return res;\n    if (attempt >= 7) { if (res) throw new Error('HTTP ' + res.status + ' for game.wasm'); throw err; }\n    bc0.postMessage({ label: 'The server is busy, retrying (' + (attempt + 1) + ')' });\n    await new Promise((r) => setTimeout(r, Math.min(5000, 300 * 2 ** attempt) * (0.5 + Math.random())));\n  }\n};",
  "why": "Eight attempts, a wait that doubles from 300 ms to a 5 s cap, each scaled by a random 0.5 to 1.5. The jitter keeps thousands of tabs from retrying in lockstep against a host that is already failing."
 },
 "pool": {
  "file": "game.js (formatted)",
  "start": 529,
  "lang": "js",
  "code": "initMainThread() {\n  var pthreadPoolSize = Math.min(160, navigator.hardwareConcurrency <= 2 ? 28 : 36 + 4 * navigator.hardwareConcurrency);\n  while (pthreadPoolSize--) {\n    PThread.allocateUnusedWorker();\n  }\n  addOnPreRun(async () => {\n    var pthreadPoolReady = PThread.loadWasmModuleToAllWorkers();\n    addRunDependency(\"loading-workers\");\n    await pthreadPoolReady;\n    removeRunDependency(\"loading-workers\");\n  });",
  "why": "Emscripten pre-spawns the pthread pool before main() runs: a worker created later would need loader.js's event loop to load its script, and once main() starts that loop never runs again. On a 16-core machine the formula gives 100 workers."
 },
 "manifest": {
  "file": "game.js (formatted)",
  "start": 4756,
  "lang": "js",
  "code": "  if (bytes === undefined) {\n    bytes = null;\n    try {\n      const x = new XMLHttpRequest();\n      x.open(\"GET\", self.location.origin + \"/data/manifest.json\", false);\n      x.send();\n      if (x.status === 200) bytes = new TextEncoder().encode(x.responseText);\n    } catch (e) {\n      console.error(\"httpfs: manifest failed: \" + e);\n    }\n    globalThis.__httpfsManifest = bytes;\n  }\n  if (bytes === null) return -1;\n  if (cap > bytes.length) {\n    (growMemViews(), HEAPU8).set(bytes, Number(buf));\n    (growMemViews(), HEAPU8)[Number(buf) + bytes.length] = 0;\n    globalThis.__httpfsManifest = undefined;\n  }\n  return bytes.length;\n}",
  "why": "The body of wasm_httpfs_manifest_js(buf, cap), one of the 13 imports the porter added. It makes a synchronous XMLHttpRequest, which a worker is still allowed to make. It returns the length first; the C++ side calls again with a buffer that big, and the bytes are copied into the heap and dropped. That is how the engine learns every path and size under /game/ before the IO worker serves a single read."
 },
 "canvas": {
  "file": "game.js (formatted)",
  "start": 4814,
  "lang": "js",
  "code": "var transfer = [];\nif (Module[\"canvas\"] && typeof OffscreenCanvas !== \"undefined\" && Module[\"canvas\"] instanceof OffscreenCanvas) {\n  msg.canvas = Module[\"canvas\"];\n  transfer.push(msg.canvas);\n}",
  "why": "The OffscreenCanvas the page transferred to loader.js is transferred once more, to the GPU worker, which is the only place WebGPU ever touches it."
 },
 "worklet-ctor": {
  "file": "audio-worklet.js",
  "start": 4,
  "lang": "js",
  "code": "constructor(options) {\n  super();\n  const { memory, ring, capacity } = options.processorOptions;\n  this.hdr = new Int32Array(memory.buffer, ring, 8);    // word 4: peak sample since the page last looked (x 1e6), diagnostics\n  this.data = new Float32Array(memory.buffer, ring + 64, capacity * 2);\n  this.mask = capacity - 1;\n}",
  "why": "Two views on the same shared memory: an eight-word header and the float samples 64 bytes after it. The capacity is a power of two, so wrapping is a mask instead of a modulo."
 },
 "worklet-tail": {
  "file": "audio-worklet.js",
  "start": 20,
  "lang": "js",
  "code": "let peak = 0;\nfor (let i = 0; i < take; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));\nif (peak > 0) Atomics.store(this.hdr, 4, Math.max(Atomics.load(this.hdr, 4), (peak * 1e6) | 0));\nfor (let i = take; i < n; i++) { left[i] = 0; right[i] = 0; }    // underrun: silence\nAtomics.store(this.hdr, 1, (read + take) | 0);\nAtomics.add(this.hdr, 3, 1);",
  "why": "The part the article skipped: after copying, the worklet records the peak level in word 4 and bumps a call counter in word 3, the heartbeat the page's ?mem=1 diagnostics read to tell a silent game from a dead worklet."
 },
 "journal-head": {
  "file": "io_worker.js",
  "start": 131,
  "lang": "js",
  "code": "const head = new DataView(new ArrayBuffer(16));\nlet ok = false;\nif (j.getSize() >= 16) {\n  j.read(new Uint8Array(head.buffer), { at: 0 });\n  ok = head.getUint32(0, true) === 0x4a415449 && head.getFloat64(8, true) === version;\n}\nif (!ok) {\n  s.truncate(0); j.truncate(0);\n  head.setUint32(0, 0x4a415449, true); head.setFloat64(8, version, true);\n  j.write(new Uint8Array(head.buffer), { at: 0 });\n  j.flush();\n}\nstoreEnd = s.getSize();",
  "why": "The journal's 16-byte header is a magic number and the manifest version as a float64. Any mismatch truncates both files, so a new game build can never be served stale blocks from an old one."
 },
 "hints": {
  "file": "io_worker.js",
  "start": 550,
  "lang": "js",
  "code": "function drainHints(bell) {\n  const ring = Atomics.load(HEAP32, bell + 2), cap = Atomics.load(HEAP32, bell + 3);\n  if (!ring || !cap || !sh || noHints) return;    // an engine without hints, no store to fetch into, or ?nohints=1\n  const head = Atomics.load(HEAP32, bell + 4) >>> 0;\n  let tail = Atomics.load(HEAP32, bell + 5) >>> 0;\n  if (((head - tail) >>> 0) > cap) tail = (head - cap) >>> 0;    // the engine lapped us: the oldest hints were overwritten\n  while (tail !== head) {\n    const e = bell + ring + 4 * (tail % cap);\n    const raw = Atomics.load(HEAP32, e + 3);\n    if (!raw) break;    // claimed but not written yet: its writer rings the doorbell again when it is\n    (raw & 0x40000000 ? lowQueue : hintQueue).push([HEAP32[e], (HEAP32[e + 1] >>> 0) + (HEAP32[e + 2] >>> 0) * 4294967296, raw & 0x3fffffff]);\n    hintsSeen++;\n    Atomics.store(HEAP32, e + 3, 0);\n    tail = (tail + 1) >>> 0;\n  }\n  Atomics.store(HEAP32, bell + 5, tail);\n  if (hintQueue.length > HINT_QUEUE_MAX) hintQueue.splice(0, hintQueue.length - HINT_QUEUE_MAX);\n  if (lowQueue.length > HINT_QUEUE_MAX) lowQueue.splice(0, lowQueue.length - HINT_QUEUE_MAX);\n  pumpHints();\n}",
  "why": "The streamer's queued reads, drained from a ring in the wasm heap. The length word is written last and doubles as the ready flag, and bit 30 marks a look-ahead hint that goes to the low-priority queue."
 },
 "features": {
  "file": "wgpu_worker.js",
  "start": 490,
  "lang": "js",
  "code": "adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });\nif (!adapter) throw new Error('no WebGPU adapter');\nconst want = ['texture-compression-bc', 'texture-compression-bc-sliced-3d', 'depth32float-stencil8', 'float32-filterable', 'indirect-first-instance', 'rg11b10ufloat-renderable', 'bgra8unorm-storage', 'depth-clip-control', 'clip-distances', 'texture-formats-tier1', 'dual-source-blending'];\nconst requiredFeatures = want.filter((f) => adapter.features.has(f));",
  "why": "The worker asks for eleven optional features and takes whichever the adapter has. texture-compression-bc is the one that matters: GTA's textures are BC1 to BC7 and are uploaded as they are."
 },
 "fence": {
  "file": "wgpu_worker.js",
  "start": 2811,
  "lang": "js",
  "code": "case 8 /* FENCE */: {\n  flush('fence');\n  await device.queue.onSubmittedWorkDone();\n  refreshViews();\n  const addr = u32[p] + u32[p + 1] * 4294967296;\n  Atomics.store(i32, w32(addr), u32[p + 2] | 0);\n  Atomics.notify(i32, w32(addr));\n  break;\n}",
  "why": "How a blocked C++ thread learns the GPU finished. The worker awaits onSubmittedWorkDone, writes the fence value at a 64-bit address in the wasm heap and notifies it, the same futex pattern as the file slots."
 },
 "vs-out": {
  "file": "pack0 · VS_PassthroughComposite.wgsl",
  "start": 24,
  "lang": "wgsl",
  "code": "struct tint_symbol_1 {\n  @builtin(position)\n  o0 : vec4<f32>,\n  @location(1u)\n  o1 : vec4<f32>,\n}",
  "why": "The output struct the earlier listing elided: DXBC's o0 becomes the position builtin and o1 keeps location 1, so register numbers survive the translation."
 }
}

export const WASM = {
 "sections": [
  [
   "type",
   21379,
   "1,969 function signatures"
  ],
  [
   "import",
   2350,
   "86 imports"
  ],
  [
   "function",
   95486,
   "91,026 function declarations"
  ],
  [
   "table",
   9,
   "one 64-bit table, 89,368 entries"
  ],
  [
   "global",
   334,
   "57 globals"
  ],
  [
   "export",
   551,
   "21 functions and the table"
  ],
  [
   "start",
   1,
   ""
  ],
  [
   "element",
   237057,
   "one segment: the function table"
  ],
  [
   "datacount",
   2,
   ""
  ],
  [
   "code",
   48192941,
   "the compiled engine"
  ],
  [
   "data",
   7828019,
   "4,077 segments"
  ],
  [
   "custom: name",
   6823623,
   "91,111 function names"
  ]
 ],
 "imports": [
  [
   "env",
   "memory",
   "1",
   "shared, 64-bit, 49,152 to 262,144 pages (3 GB to 16 GB)"
  ],
  [
   "env",
   "the porter's JS imports",
   "13",
   "wasm_httpfs_manifest_js, wasm_httpfs_io_start_js, wgpu_start_worker, wasm_audio_publish_js, wasm_input_publish_js, wasm_userdata_put_js…"
  ],
  [
   "env",
   "Emscripten runtime",
   "26",
   "threads and mailboxes, time, heap growth, stack traces, longjmp"
  ],
  [
   "env",
   "file-system syscalls",
   "16",
   "openat, fstat64, getdents64, renameat…"
  ],
  [
   "env",
   "socket syscalls",
   "9",
   "socket, connect, sendto, recvfrom… linked in, never reached under -nonetwork"
  ],
  [
   "env",
   "invoke_* trampolines",
   "11",
   "C++ exceptions and setjmp, routed through JS"
  ],
  [
   "wasi_snapshot_preview1",
   "WASI",
   "10",
   "fd_read, fd_write, fd_seek, fd_pread, clock_time_get, proc_exit…"
  ]
 ],
 "exports": "22: Emscripten's thread, stack and start-up entry points and the function table. No game function is exported; everything enters through main().",
 "names": [
  "wasm_null_d3d::NullDevice::CreateTexture2D(D3D11_TEXTURE2D_DESC const*, D3D11_SUBRESOURCE_DATA const*, ID3D11Texture2D**)",
  "wasm_null_d3d::NullContext::DrawIndexed(unsigned int, unsigned int, int)",
  "wasm_null_d3d::NullSwapChain::Present(unsigned int, unsigned int)",
  "wasm_httpfs_lookup",
  "wasm_httpfs_pread",
  "wasm_wait_begin",
  "wasm_streaming_report",
  "rage::wasm_cb::S<void (*)(), &rage::tcDebug::ModifierChanged(), 1>::thunk(void*, void*, void*)",
  "rage::fiDeviceRelative::Read(fiHandle__*, void*, int) const",
  "rage::AES::Decrypt(void*, unsigned int)",
  "rage::scrThread::Run(int)",
  "rage::strStreamingLoaderManager::LoadAllRequestedObjects(bool)",
  "rage::HangDetectThread(void*)",
  "rage::audDecoderOpus::Init(rage::audWaveFormat::audStreamFormat, unsigned int, unsigned int)"
 ]
}
