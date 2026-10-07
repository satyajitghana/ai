// What playgta5.com served, laid out by URL path as of 6 October 2026. Sizes are the bytes I
// downloaded; "lines" counts the file as served. Excerpt ids point into file-explorer-data.ts.
// Entries marked `virtual` are endpoints the IO worker calls, not files you could list.

export type Kind = "folder" | "html" | "js" | "wasm" | "json" | "shader" | "font" | "image" | "endpoint"

export type FileEntry = {
  id: string
  name: string
  kind: Kind
  size?: string
  role: string
  about?: string
  talks?: string
  facts?: [string, string][]
  sample?: { label: string; lang: string; code: string }
  excerpts?: string[]
  wasm?: boolean
  virtual?: boolean
  children?: FileEntry[]
}

export const SITE: FileEntry[] = [
  {
    id: "root",
    name: "/",
    kind: "folder",
    role: "the page itself",
    about:
      "Only the page lives at the root. Everything it loads comes from a build-specific prefix that can be cached for a year, and everything the engine reads comes from /data/.",
    children: [
      {
        id: "index",
        name: "index.html",
        kind: "html",
        size: "44 KB",
        role: "title screen, start menu, input, audio start-up, command line",
        about:
          "The only file that runs on the browser's main thread. It refuses to start without cross-origin isolation, hands the canvas to a worker as an OffscreenCanvas, picks the low-memory profile and builds the engine's command line. After that it handles input, starts audio on the first gesture and plays the rebuilt Scaleform loading screen.",
        talks:
          "postMessage to loader.js with the transferred canvas and the arguments. Atomics.store into the input block in shared memory. The 'game-progress' BroadcastChannel for the progress bar. An AudioWorkletNode created with the audio ring's address.",
        facts: [
          ["bytes", "45,087"],
          ["lines", "603"],
        ],
        excerpts: ["isolation", "audio-start"],
      },
    ],
  },
  {
    id: "build",
    name: "b/8b0b5899ed/",
    kind: "folder",
    role: "engine, workers, shaders, title art",
    about:
      "The build prefix. Every engine file sits under it, so a new build gets new URLs and old ones can be cached for a year.",
    children: [
      {
        id: "loader",
        name: "loader.js",
        kind: "js",
        size: "9 KB",
        role: "worker that becomes the engine's main thread",
        about:
          "Started by the page as a worker. It creates the GPU and IO workers first, streams and compiles game.wasm, restores savegames from IndexedDB, then calls importScripts('game.js'), and main() takes the worker over for good.",
        talks:
          "new Worker for wgpu_worker.js and io_worker.js, each answering { loaded } before the engine starts. Progress on the 'game-progress' BroadcastChannel. Module.wgpuWorker and Module.ioWorker hand both workers to the glue.",
        facts: [
          ["bytes", "9,201"],
          ["lines", "146"],
        ],
        excerpts: ["workers", "retry"],
      },
      {
        id: "gamejs",
        name: "game.js",
        kind: "js",
        size: "124 KB",
        role: "Emscripten glue, prejs.js and the 13 JS imports",
        about:
          "Minified onto one line: Emscripten's runtime, the porter's prejs.js (logging, progress, crash reports) and the functions the engine imports. It runs in loader.js and again in every pthread worker, all against the same shared memory.",
        talks:
          "Imports memory and functions into game.wasm. Posts the input block and audio ring addresses up to the page, the slot table to the IO worker and the command ring plus the canvas to the GPU worker.",
        facts: [
          ["bytes", "124,240"],
          ["lines", "1 as served, 5,199 formatted"],
        ],
        excerpts: ["pool", "manifest", "canvas"],
      },
      {
        id: "wasm",
        name: "game.wasm",
        kind: "wasm",
        size: "63 MB",
        role: "RAGE and GTA V, compiled to wasm64",
        about:
          "Rockstar's engine and game code, compiled from C++ by Emscripten. Shown here from the outside only: the section headers, the import list and a few names from the name section. None of its code is reproduced.",
        talks:
          "Calls the 13 imports in game.js. Everything else crosses through shared memory: the file slot table and hint ring, the 32 MB command ring, the audio ring and the input block.",
        wasm: true,
      },
      {
        id: "wgpu",
        name: "wgpu_worker.js",
        kind: "js",
        size: "194 KB",
        role: "replays Direct3D 11 commands on WebGPU",
        about:
          "Owns the WebGPU device and every GPU object. It drains the command ring, translates D3D11 state into pipelines and bind groups, compiles pipelines ahead from recipes and presents to the canvas.",
        talks:
          "Reads the 32 MB ring that the engine's fake D3D11 device writes; wakes blocked engine threads with Atomics.notify on fence words; fetches shaders/ and pipeline recipes; keeps learned recipes in IndexedDB.",
        facts: [
          ["bytes", "194,031"],
          ["lines", "2,969"],
          ["opcodes", "48 (0 to 47)"],
        ],
        excerpts: ["features", "fence"],
      },
      {
        id: "io",
        name: "io_worker.js",
        kind: "js",
        size: "41 KB",
        role: "serves every engine file read from HTTP and OPFS",
        about:
          "Turns the engine's blocking reads into HTTP Range requests and caches 4 KB blocks in an append-only store in the Origin Private File System. It also prefetches the boot set and the streamer's queued reads.",
        talks:
          "Parks on a doorbell word with Atomics.waitAsync; serves 16-word slots, one per engine thread; drains the hint ring; reads and writes store.bin and journal.bin; keeps savegames in IndexedDB.",
        facts: [
          ["bytes", "41,287"],
          ["lines", "644"],
        ],
        excerpts: ["journal-head", "hints"],
      },
      {
        id: "worklet",
        name: "audio-worklet.js",
        kind: "js",
        size: "1.5 KB",
        role: "plays the engine's mixer output",
        about:
          "The smallest file in the port. An AudioWorkletProcessor that copies 128 stereo frames per callback out of a ring in the wasm heap and plays silence when the ring runs dry.",
        talks:
          "Reads the audio ring's write word and advances its read word; bumps a heartbeat counter the page can read. No messages at all once it is running.",
        facts: [
          ["bytes", "1,496"],
          ["lines", "29"],
        ],
        excerpts: ["worklet-ctor", "worklet-tail"],
      },
      {
        id: "shaders",
        name: "shaders/",
        kind: "folder",
        role: "translated WGSL and pipeline recipes",
        about:
          "Everything the GPU worker needs to turn a DXBC hash into a pipeline: an index, 18 packs of WGSL and two seeds of recipes to compile ahead.",
        children: [
          {
            id: "sindex",
            name: "index.json",
            kind: "json",
            size: "686 KB",
            role: "4,919 shaders: hash to stage, effect, program, pack",
            about:
              "Keyed by the FNV-1a 64 hash of each shader's DXBC. Each entry names the stage, the effect and program, whether the translation worked, and where the WGSL sits: pack, byte offset, length.",
            facts: [
              ["bytes", "685,955"],
              ["shaders", "4,919"],
              ["packs listed", "18"],
            ],
            sample: {
              label: "one entry",
              lang: "json",
              code: '"f0642e033efc4a11": { "stage": "vs", "effect": "adaptiveDof",\n  "program": "VS_PassthroughComposite", "ok": true, "p": [0, 1320912, 843, 0] }',
            },
          },
          {
            id: "packs",
            name: "pack0..17.<hash>.bin",
            kind: "shader",
            size: "18 × ~4.2 MB",
            role: "the WGSL, bundled by effect",
            about:
              "About 20 requests instead of one per shader. The index entry for VS_PassthroughComposite points 1,320,912 bytes into pack0 for 843 bytes of WGSL, the vertex shader the article prints in full; the struct below is the part it elided.",
            facts: [
              ["bytes, all packs", "71,761,794"],
              ["pack0", "484 shaders, 4,183,080 bytes"],
            ],
            excerpts: ["vs-out"],
          },
          {
            id: "pipes",
            name: "pipelines.json",
            kind: "json",
            size: "359 KB",
            role: "720 pipeline recipes to compile ahead",
            about:
              "Recorded by the porter's Node harness. Each recipe holds the keys the worker hashes a pipeline by: vs and ps shader hashes, input elements (el), strides (st), topology (tp), strip index format (sf), the raw blend, depth and raster words (b, d, r), target formats (rt), sample count (n), depth format (ds) and read-only flags (ro).",
            facts: [
              ["bytes", "359,210"],
              ["recipes", "720"],
            ],
            sample: {
              label: "the first recipe, trimmed",
              lang: "json",
              code: '{ "vs": "028921879df627f5", "ps": "943b0ad9542193ff", "st": [36], "tp": 4,\n  "rt": ["bgra8unorm"], "n": 1, "ds": "", "ro": 0, … }',
            },
          },
          {
            id: "pipeslow",
            name: "pipelines_low.json",
            kind: "json",
            size: "223 KB",
            role: "425 recipes for the low-memory profile",
            about: "The same format, recorded with the low-memory settings, fetched when the GPU worker's URL carries low=1.",
            facts: [
              ["bytes", "223,284"],
              ["recipes", "425"],
            ],
          },
        ],
      },
      {
        id: "title",
        name: "title/",
        kind: "folder",
        role: "loading-screen art, logo and font",
        about:
          "Pulled out of the game by the porter's make_title.py for the HTML rebuild of the Scaleform loading movie. I did not keep these files, so no sizes.",
        children: [
          {
            id: "art",
            name: "art/<layer>.webp",
            kind: "image",
            role: "background and foreground layers of the loading screens",
            about: "One WebP per layer, positioned and tweened on a tilted 3D plane by the page's CSS.",
          },
          {
            id: "font",
            name: "chalet.woff",
            kind: "font",
            role: "$Font2, Chalet London 1960",
            about: "The font the loading movie names, used for the menu and the progress label.",
          },
          { id: "logo", name: "logo.png", kind: "image", role: "the GTA V logo", about: "Bottom left of the loading screen." },
          { id: "spin", name: "spinner.png", kind: "image", role: "the loading spinner", about: "Animated with CSS steps(60)." },
        ],
      },
    ],
  },
  {
    id: "data",
    name: "data/",
    kind: "folder",
    role: "the game folder and its indexes",
    about:
      "What the engine sees as /game/. Every URL carries ?v=<manifest version>, so the same URL always means the same bytes.",
    children: [
      {
        id: "manifest",
        name: "manifest.json",
        kind: "json",
        size: "393 KB",
        role: "5,814 paths, sizes and times",
        about:
          "The whole game folder as a list. The engine reads it once, synchronously, at start-up (the excerpt in game.js), and the IO worker reads it again to map file ids to URLs.",
        facts: [
          ["bytes", "393,014"],
          ["files", "5,814"],
          ["version", "1791169379-5814"],
        ],
        sample: {
          label: "head and one entry",
          lang: "json",
          code: '{ "mount": "/game/", "version": "1791169379-5814", "files": [\n  ["common/data/action/strike_bones.meta", 6631, 1790488931], …',
        },
      },
      {
        id: "boot",
        name: "bootset.json",
        kind: "json",
        size: "193 KB",
        role: "the byte ranges read while booting",
        about:
          "Recorded with ?record=1 and the porter's record_bootset.py. The IO worker starts fetching it the moment loader.js creates it, in 32 range lanes and 4 batch lanes.",
        facts: [
          ["bytes", "192,733"],
          ["files", "2,918"],
          ["ranges", "4,162"],
          ["bytes it reads", "581,823,449"],
        ],
        sample: {
          label: "first entry, trimmed",
          lang: "json",
          code: '["x64/audio/audio.rpf", [[0, 22239], [27648, 40212], [44544, 66796], …]]',
        },
      },
      {
        id: "bootlow",
        name: "bootset_low.json",
        kind: "json",
        size: "190 KB",
        role: "the boot set of the low-memory profile",
        about: "The same 2,918 files, fewer bytes: 4,042 ranges and 508,852,403 bytes.",
        facts: [
          ["bytes", "190,351"],
          ["ranges", "4,042"],
        ],
      },
      {
        id: "batch",
        name: "batch",
        kind: "endpoint",
        virtual: true,
        role: "POST: many block runs in one gzipped answer",
        about:
          "Small compressible files travel whole, up to 300 per request, and come back gzipped through DecompressionStream. The boot set is the same for everyone, so each batch is first asked for as a static copy, batchc/<sha1>.bin, which Cloudflare can cache.",
      },
      {
        id: "range",
        name: "<path>?v=<version>",
        kind: "endpoint",
        virtual: true,
        size: "20.9 GB",
        role: "Range reads of the 5,814 game files",
        about:
          "4 KB blocks of RPF archives, shader effects, metadata and audio, fetched with HTTP Range requests. A blocking read is cut into 128 KB slices at high priority; everything speculative runs at low priority.",
      },
    ],
  },
]
