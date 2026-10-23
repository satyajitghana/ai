"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Five ways to put a 2005 Windows game in a browser tab, and how each thing I
// measured in the itch.io build of NFS: Most Wanted sits with each one. The
// NFSMW Online article drew four paths from outside a login; with the engine in
// hand, "run the shipped binary" splits in two, because translating x86 ahead
// of time and translating it while the game runs leave different files behind.
// "fits" = what that path produces; "strains" = the path would have to be
// stretched to explain it; "neutral" = does not tell the paths apart.

type Path = "source" | "decomp" | "static" | "dynamic" | "rewrite"
type Cell = "fits" | "strains" | "neutral"

const PATHS: { k: Path; name: string; sub: string; example: string }[] = [
  { k: "source", name: "Original source", sub: "compile the studio's C++", example: "GTA V, playgta5.com" },
  { k: "decomp", name: "Decompiled source", sub: "compile C++ rebuilt from the binary", example: "reVC" },
  { k: "static", name: "Binary, ahead of time", sub: "translate the .exe once, at build", example: "N64Recomp, XenonRecomp" },
  { k: "dynamic", name: "Binary, at run time", sub: "translate x86 as it executes", example: "Wine plus an x86 JIT" },
  { k: "rewrite", name: "New engine", sub: "read the original data", example: "OpenMW" },
]

type Ev = { id: string; text: string; cells: Record<Path, Cell>; why: string }

const EVIDENCE: Ev[] = [
  {
    id: "exe",
    text: "The engine is started with --exe=/opfs/nfsmw/game/speed.exe, and the launcher refuses an executable whose SHA-256 differs",
    cells: { source: "strains", decomp: "strains", static: "fits", dynamic: "fits", rewrite: "strains" },
    why: "A build from source, original or decompiled, is the program; it needs the game's data files, never its old executable. Both binary paths need that exact executable, and a static translator needs exactly the build it translated, which is why the hash is pinned.",
  },
  {
    id: "table",
    text: "symbols.json: 42,545 addresses inside speed.exe, with Ghidra's default names and none of EA's",
    cells: { source: "strains", decomp: "strains", static: "fits", dynamic: "strains", rewrite: "strains" },
    why: "A source port carries the studio's names, and a decompilation carries the ones its authors recovered (the public one calls 0x00612420 Game_ClearAIControl). A run-time translator discovers code as it runs and has no reason to ship a table. A static translator needs one: every function and jump target it compiled, so an indirect jump at run time can find its block.",
  },
  {
    id: "nojit",
    text: "74 MB of wasm code, and the glue never compiles a second module",
    cells: { source: "neutral", decomp: "neutral", static: "fits", dynamic: "strains", rewrite: "neutral" },
    why: "The only WebAssembly instantiation in SpeedRecomp.js is the standard one, plus each pthread worker instantiating the same module. A browser JIT for x86 would have to emit and compile new modules while the game runs.",
  },
  {
    id: "errors",
    text: "Its error strings: 'no block entry for indirect jump', 'unmodelled SSE instruction'",
    cells: { source: "strains", decomp: "strains", static: "fits", dynamic: "strains", rewrite: "strains" },
    why: "These are the two classic failure modes of static recompilation: a computed jump to an address the translator never saw, and an instruction it does not model. A run-time translator would translate the new address on the spot.",
  },
  {
    id: "win32",
    text: "Windows rebuilt inside the module: 51 DLL names, SEH frames, CreateThread, Direct3D 9, DirectSound, DirectInput, XInput",
    cells: { source: "strains", decomp: "neutral", static: "fits", dynamic: "fits", rewrite: "strains" },
    why: "A binary calls Windows, so whatever runs it has to answer as Windows. A source port usually swaps the platform layer in C++ instead, as the GTA V port did. A decompilation could go either way.",
  },
  {
    id: "hooks",
    text: "Widescreen and frame-rate fixes as hooks on addresses, because 'patched code bytes mean nothing to a recompiled game'",
    cells: { source: "strains", decomp: "strains", static: "fits", dynamic: "strains", rewrite: "strains" },
    why: "That sentence is from the port's own nfsmw mod.toml. Under a run-time translator, a byte patch to the .exe still works. Ahead of time, the bytes were already translated, so a fix has to replace a translated function by its address.",
  },
  {
    id: "decomp",
    text: "20,417 of its 26,447 function entries start where the public decompilation's PC 1.3 functions start",
    cells: { source: "neutral", decomp: "strains", static: "fits", dynamic: "neutral", rewrite: "neutral" },
    why: "Two tools disassembled the same executable and agree on most function boundaries. That confirms the build, PC version 1.3. It does not mean the port uses the decompilation: none of the decompilation's names or C++ appear.",
  },
]

const CELL_STYLE: Record<Cell, string> = {
  fits: "bg-[oklch(0.72_0.14_150/0.25)] text-foreground",
  strains: "bg-[oklch(0.68_0.16_30/0.22)] text-foreground",
  neutral: "text-muted-foreground",
}

export function PortPlacer() {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(EVIDENCE.map((e) => [e.id, true])))
  const [sel, setSel] = useState<string>("table")
  const count = (p: Path, c: Cell) => EVIDENCE.filter((e) => on[e.id] && e.cells[p] === c).length
  const ev = EVIDENCE.find((e) => e.id === sel) ?? EVIDENCE[0]

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>five ways into a browser tab · all evidence measured from the served files</span>
        <span className="hidden @min-[560px]:inline">untick a row to see what it carries</span>
      </div>

      <div className="overflow-x-auto px-2 pt-3">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-[34%] text-left font-mono font-normal text-muted-foreground">evidence</th>
              {PATHS.map((p) => (
                <th key={p.k} className="align-bottom font-normal">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-muted-foreground">{p.sub}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">e.g. {p.example}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVIDENCE.map((e) => (
              <tr key={e.id} className={cn(!on[e.id] && "opacity-40")}>
                <td className={cn("rounded-md px-1.5 py-1 align-top", sel === e.id && "bg-muted")}>
                  <label className="flex cursor-pointer items-start gap-1.5">
                    <input
                      type="checkbox"
                      checked={on[e.id]}
                      onChange={() => setOn((o) => ({ ...o, [e.id]: !o[e.id] }))}
                      className="mt-0.5"
                      aria-label={`count: ${e.text}`}
                    />
                    <button type="button" onClick={() => setSel(e.id)} className="cursor-pointer text-left leading-snug">
                      {e.text}
                    </button>
                  </label>
                </td>
                {PATHS.map((p) => (
                  <td
                    key={p.k}
                    onClick={() => setSel(e.id)}
                    className={cn("cursor-pointer rounded-md text-center font-mono", CELL_STYLE[e.cells[p.k]])}
                  >
                    {e.cells[p.k]}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-1.5 py-1 text-right font-mono text-muted-foreground">fits / strains</td>
              {PATHS.map((p) => (
                <td key={p.k} className="py-1 text-center font-mono text-sm font-semibold tabular-nums">
                  {count(p.k, "fits")} / {count(p.k, "strains")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed" aria-live="polite">
        <div className="font-mono text-xs text-muted-foreground">{ev.text}</div>
        <p className="mt-1">{ev.why}</p>
      </figcaption>
    </figure>
  )
}
