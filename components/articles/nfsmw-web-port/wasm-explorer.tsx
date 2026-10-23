"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What SpeedRecomp.wasm and its data package contain, from my own parser run
// over the served files on 23 October 2026. Every number is a count or a byte
// size read from the files; nothing is estimated. The module has no `name`
// section, so the code is described through the symbol table the build ships
// beside it (/app/resources/symbols.json inside SpeedRecomp.data).

type Bar = { label: string; value: number; note: string; tone?: "a" | "b" | "c" }

const SECTIONS: Bar[] = [
  { label: "code", value: 73962373, note: "46,868 function bodies; median 509 bytes, largest 129,441", tone: "a" },
  { label: "data", value: 2831679, note: "536 segments: strings, WGSL templates, fonts, tables" },
  { label: "element", value: 124388, note: "one table segment, 46,979 entries" },
  { label: "function", value: 46936, note: "the type index of each defined function" },
  { label: "import", value: 12019, note: "353 functions and one shared memory" },
  { label: "export", value: 3014, note: "115 exports" },
  { label: "type", value: 1567, note: "function signatures" },
  { label: "global, table, start", value: 93, note: "" },
]

const IMPORTS: Bar[] = [
  { label: "WebGL (emscripten_gl*)", value: 167, note: "linked with SDL3; the strings name no WebGL renderer for the game", tone: "c" },
  { label: "WebGPU (wgpu*, emwgpu*)", value: 56, note: "Dawn's emdawnwebgpu bindings: the Direct3D 9 renderer", tone: "a" },
  { label: "WasmFS", value: 44, note: "OPFS backend, fetch backend, JS-implemented files, preloads", tone: "a" },
  { label: "HTML5 events", value: 29, note: "keys, wheel, pointer lock, gamepads, full screen, resize, focus" },
  { label: "C++ exceptions, setjmp", value: 17, note: "invoke_* trampolines and __cxa_throw" },
  { label: "threads, main loop", value: 17, note: "pthread creation, mailboxes, main-thread proxying" },
  { label: "libc, clock", value: 13, note: "time zones, exit, clocks" },
  { label: "EM_ASM (inline JS)", value: 5, note: "where the AudioWorklet and its ring are set up" },
  { label: "WASI", value: 5, note: "environment, clock, random" },
]

const KINDS: Bar[] = [
  { label: "entry", value: 26447, note: "function starts; 26,545 entries in all are marked hookable", tone: "a" },
  { label: "block", value: 13052, note: "jump targets inside functions, named sub_X.blk_Y" },
  { label: "continuation", value: 2948, note: "resume points; my reading: where a call returns" },
  { label: "alternate", value: 98, note: "second entries into a function, FUN_X.alt_Y" },
]

const PROVENANCE: Bar[] = [
  { label: "listed", value: 25543, note: "in the disassembler's function list", tone: "a" },
  { label: "data", value: 8575, note: "an address found in the executable's data" },
  { label: "immediate", value: 3454, note: "an address found as an instruction operand" },
  { label: "table", value: 3324, note: "from a jump table" },
  { label: "initterm", value: 847, note: "from the C runtime's constructor tables" },
  { label: "config", value: 686, note: "named in the build's config" },
  { label: "branch", value: 116, note: "a branch target" },
]

const NAMES: Bar[] = [
  { label: "FUN_00xxxxxx", value: 20732, note: "Ghidra's default name for a function", tone: "a" },
  { label: "sub_X.blk_Y", value: 10564, note: "a block inside a function" },
  { label: "FUN_X.blk_Y", value: 5100, note: "a block inside a Ghidra-named function" },
  { label: "Unwind@ / Catch@", value: 4851, note: "MSVC exception funclets, Ghidra's naming" },
  { label: "real names", value: 629, note: "C runtime only: _malloc, _qsort, __CxxFrameHandler", tone: "b" },
  { label: "thunk_FUN_X", value: 235, note: "jump thunks" },
]

const TABS = [
  { k: "sections", title: "sections", unit: "bytes", bars: SECTIONS, caption: "76,982,114 bytes uncompressed, 16,086,019 gzipped on the wire. No name section, no producers section, no DWARF." },
  { k: "imports", title: "imports", unit: "functions", bars: IMPORTS, caption: "353 imported functions. Memory is imported shared, 32-bit: 8,192 pages (512 MiB) at start, 65,536 (4 GiB) at most." },
  { k: "kinds", title: "translated units", unit: "entries", bars: KINDS, caption: "42,545 entries in symbols.json, every one an address in speed.exe between 0x00401000 and 0x0088f283." },
  { k: "prov", title: "how each was found", unit: "entries", bars: PROVENANCE, caption: "Where each translated address came from. Most are the disassembler's own function list; the rest were found by scanning the binary." },
  { k: "names", title: "names", unit: "entries", bars: NAMES, caption: "No EA name survives. The names are Ghidra's defaults plus the C runtime it recognises by signature." },
] as const

function fmt(n: number, unit: string): string {
  if (unit === "bytes") {
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`
    return `${n} B`
  }
  return n.toLocaleString("en-US")
}

const TONE = {
  a: "bg-[oklch(0.65_0.14_150/0.75)]",
  b: "bg-[oklch(0.7_0.15_60/0.75)]",
  c: "bg-[oklch(0.7_0.03_250/0.6)]",
} as const

export function WasmExplorer() {
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("sections")
  const t = TABS.find((x) => x.k === tab) ?? TABS[0]
  const max = Math.max(...t.bars.map((b) => b.value))

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap gap-1 border-b px-3 py-2 font-mono text-xs">
        <span className="mr-2 self-center text-muted-foreground">SpeedRecomp.wasm ·</span>
        {TABS.map((x) => (
          <button
            key={x.k}
            type="button"
            onClick={() => setTab(x.k)}
            className={cn("rounded px-2 py-0.5", tab === x.k ? "bg-foreground text-background" : "hover:bg-muted")}
          >
            {x.title}
          </button>
        ))}
      </div>

      <ul className="space-y-2 px-4 py-3">
        {t.bars.map((b) => (
          <li key={b.label} className="grid grid-cols-1 gap-x-3 @min-[560px]:grid-cols-[11rem_1fr_6.5rem]">
            <span className="font-mono text-xs">{b.label}</span>
            <span className="relative h-4 self-center rounded bg-muted/50">
              <span
                className={cn("absolute inset-y-0 left-0 rounded", TONE[b.tone ?? "c"])}
                style={{ width: `${Math.max(0.6, (b.value / max) * 100).toFixed(2)}%` }}
              />
            </span>
            <span className="font-mono text-xs tabular-nums @min-[560px]:text-right">{fmt(b.value, t.unit)}</span>
            {b.note && <span className="col-span-full text-[11px] text-muted-foreground">{b.note}</span>}
          </li>
        ))}
      </ul>

      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed" aria-live="polite">
        {t.caption}
      </figcaption>
    </figure>
  )
}
