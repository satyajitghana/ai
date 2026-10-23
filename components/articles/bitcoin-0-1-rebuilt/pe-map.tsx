"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The released bitcoin.exe (SHA-256 fbcac071…d30d2d, 6,440,960 bytes, from
// bitcoin-0.1.0.tgz as served by the Satoshi Nakamoto Institute), section by
// section, with the bytes that pin down how it was built. Every offset, size,
// flag and string below was measured from that file with pefile 2024.8.26;
// what each one is evidence FOR is the repository's attribution unless the
// note says I checked it against the package myself.

type Cat = "clock" | "toolchain" | "library" | "shell"

type Section = { name: string; start: number; size: number; note: string }

type Marker = {
  id: string
  sec: string
  off: number
  len: number
  cat: Cat
  label: string
  bytes: string
  pins: string
  how: "measured" | "reported"
  clockBytes?: number
}

const SECTIONS: Section[] = [
  { name: "headers", start: 0, size: 1024, note: "DOS stub, PE header, optional header, 6 section headers" },
  { name: ".text", start: 0x400, size: 5761536, note: "code: bitcoin, wxWidgets, Berkeley DB, libgcc, import thunks" },
  { name: ".data", start: 0x57ee00, size: 67072, note: "initialised data" },
  { name: ".rdata", start: 0x58f400, size: 537088, note: "strings and constants, including debug assert paths" },
  { name: ".idata", start: 0x612600, size: 20480, note: "import tables for 14 descriptors" },
  { name: ".rsrc", start: 0x617600, size: 53760, note: "icons, bitmaps, cursors, a menu and the manifest" },
]

const MARKERS: Marker[] = [
  { id: "ts", sec: "headers", off: 0x88, len: 4, cat: "clock", label: "PE TimeDateStamp", bytes: "1231629360 = 2009-01-10 23:16:00 UTC", pins: "The time strip ran, not the link: strip rewrites this field. The rebuild runs strip under a shim that reports this exact second.", how: "measured", clockBytes: 4 },
  { id: "ck", sec: "headers", off: 0xd8, len: 4, cat: "clock", label: "PE CheckSum", bytes: "0x634606, valid", pins: "A sum over every other byte of the file. Any byte that differs anywhere changes it, so it moves with the clock fields too.", how: "measured", clockBytes: 4 },
  { id: "lv", sec: "headers", off: 0x9a, len: 2, cat: "toolchain", label: "Linker version, no Rich header", bytes: "2.56; no 'Rich' block in the DOS stub", pins: "Not Microsoft's linker. MSVC's link.exe writes its own version here and leaves a Rich header behind; GNU ld writes neither. MinGW, not the Visual C++ 6 makefile that shipped beside it.", how: "measured" },
  { id: "thunk", sec: ".text", off: 0x445000, len: 499 * 8, cat: "toolchain", label: "Import thunks, 8 bytes apart", bytes: "499 consecutive jmp [addr] stubs, stride 8", pins: "Each stub is 6 bytes padded to 8. The repository attributes this packing to binutils 2.18.50, which is why it upgrades binutils before linking.", how: "reported" },
  { id: "boost", sec: ".rdata", off: 0x590cb0, len: 22, cat: "shell", label: "Verbatim include path", bytes: "/boost/boost/array.hpp", pins: "A drive-less Unix-style path survived into an assert string. Under MSYS it would have been rewritten to a C:/msys path before gcc saw it, so the makefile ran from cmd.", how: "measured" },
  { id: "wxs", sec: ".rdata", off: 0x593118, len: 30, cat: "shell", label: "wxWidgets assert path", bytes: "/wxWidgets/include/wx/string.h", pins: "The same evidence for cmd, and that wx headers lived at C:\\wxWidgets, exactly where the makefile's -I flags point.", how: "measured" },
  { id: "db", sec: ".rdata", off: 0x596948, len: 34, cat: "library", label: "Berkeley DB version", bytes: "Berkeley DB 4.7.25: (May 15, 2008)", pins: "The exact Berkeley DB release, linked statically.", how: "measured" },
  { id: "time", sec: ".rdata", off: 0x5b69c9, len: 8, cat: "clock", label: "__TIME__ in wincmn.cpp", bytes: "08:05:59", pins: "wxWidgets' 'compiled at' string. wx was built on 28 November 2008, six weeks before bitcoin itself.", how: "measured", clockBytes: 8 },
  { id: "date", sec: ".rdata", off: 0x5b69d2, len: 11, cat: "clock", label: "__DATE__ in wincmn.cpp", bytes: "Nov 28 2008", pins: "Rebuilt by compiling that one wx source with the clock set to 1227859559.", how: "measured", clockBytes: 11 },
  { id: "gcc", sec: ".rdata", off: 0x5e5b68, len: 0x5e5bec - 0x5e5b68, cat: "toolchain", label: "libgcc's own strings", bytes: "-LIBGCCW32-EH-3-SJLJ-GTHR-MINGW32 and ../../gcc-3.4.5/gcc/config/i386/w32-shared-ptr.c", pins: "gcc 3.4.5 with SJLJ exceptions. Both strings are in libgcc.a from gcc-core-3.4.5-20060117-3, which I checked.", how: "measured" },
  { id: "idata", sec: ".idata", off: 0x612600, len: 20480, cat: "toolchain", label: "Section alignment flags", bytes: ".idata and .rsrc 0xC0300040 (align 4); .text 0x60500060 (align 16)", pins: "The repository says only the 2.18.50 linker sets these flags this way.", how: "reported" },
  { id: "mingwm", sec: ".idata", off: 0x616fd0, len: 12, cat: "library", label: "mingwm10.dll import", bytes: "mingwm10.dll (1 import: thread-key destructor)", pins: "The shipped mingwm10.dll is byte-identical to the one in mingw-runtime-3.13.tar.gz. I hashed both: 1badf397…d7708f.", how: "measured" },
  { id: "rsrc", sec: ".rsrc", off: 0x617604, len: 0x617f88 - 0x617604, cat: "clock", label: "79 resource directory stamps", bytes: "79 x 4 bytes = 2009-01-10 23:08:02 UTC", pins: "windres stamps every resource directory with the time it ran, eight minutes before strip. One clock setting fixes all 316 bytes.", how: "measured", clockBytes: 316 },
  { id: "man", sec: ".rsrc", off: 0x6244e8, len: 658, cat: "library", label: "RT_MANIFEST, CRLF", bytes: "658 bytes, 22 lines, every one ending \\r\\n", pins: "wx.manifest embedded verbatim. Only the Windows installer of wxWidgets 2.8.9 ships it with CRLF; the .tar.gz and .zip are LF and miss by 22 bytes plus every offset after them.", how: "reported" },
]

const CATS: Record<Cat, { label: string; color: string }> = {
  clock: { label: "clock", color: "oklch(0.64 0.16 40)" },
  toolchain: { label: "toolchain", color: "oklch(0.58 0.13 250)" },
  library: { label: "library", color: "oklch(0.6 0.13 150)" },
  shell: { label: "shell", color: "oklch(0.62 0.12 310)" },
}

const fmt = (n: number) => n.toLocaleString("en-US")
const hex = (n: number) => `0x${n.toString(16)}`

export function PeMap() {
  const [sel, setSel] = useState("rsrc")
  const [only, setOnly] = useState<Cat | "all">("all")
  const chosen = MARKERS.find((m) => m.id === sel) ?? MARKERS[0]
  const clockTotal = MARKERS.reduce((a, m) => a + (m.clockBytes ?? 0), 0)
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">bitcoin.exe · 6,440,960 bytes · fbcac071…d30d2d</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter evidence">
          {(["all", "clock", "toolchain", "library", "shell"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={only === c}
              onClick={() => setOnly(c)}
              className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors", only === c ? "bg-foreground text-background" : "hover:bg-muted/50")}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 px-4 py-3">
        {SECTIONS.map((s) => {
          const ms = MARKERS.filter((m) => m.sec === s.name)
          return (
            <div key={s.name} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 sm:grid-cols-[7.5rem_1fr]">
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-semibold">{s.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{fmt(s.size)} B</div>
              </div>
              <div className="relative h-7 rounded-md border bg-muted/30" title={s.note}>
                {ms.map((m) => {
                  const left = ((m.off - s.start) / s.size) * 100
                  const width = Math.max(1.2, (m.len / s.size) * 100)
                  const dim = only !== "all" && only !== m.cat
                  const c = CATS[m.cat].color
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={`${m.label} at ${hex(m.off)}`}
                      aria-pressed={sel === m.id}
                      onClick={() => setSel(m.id)}
                      className={cn("absolute top-0.5 bottom-0.5 rounded-sm border transition-opacity", sel === m.id && "ring-2 ring-foreground/70", dim && "opacity-15")}
                      style={{ left: `${Math.min(left, 98.5).toFixed(2)}%`, width: `${Math.min(width, 100 - Math.min(left, 98.5)).toFixed(2)}%`, minWidth: "8px", borderColor: c, background: `color-mix(in oklch, ${c} 45%, transparent)` }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2 sm:grid-cols-[7.5rem_1fr]">
          <div className="font-mono text-[11px] text-muted-foreground">.bss</div>
          <div className="font-mono text-[10px] text-muted-foreground">no bytes in the file (129,832 in memory)</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-2 font-mono text-[10px] text-muted-foreground">
        <span>each row is one section stretched to full width</span>
        {(Object.keys(CATS) as Cat[]).map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ borderColor: CATS[c].color, background: `color-mix(in oklch, ${CATS[c].color} 45%, transparent)` }} />
            {CATS[c].label}
          </span>
        ))}
      </div>
      <div className="space-y-1.5 border-t px-4 py-3" aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold">{chosen.label}</span>
          <span className="rounded-full border px-2 py-0.5 font-mono text-[10px]" style={{ borderColor: CATS[chosen.cat].color, color: CATS[chosen.cat].color }}>
            {CATS[chosen.cat].label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {chosen.sec} @ {hex(chosen.off)}
          </span>
        </div>
        <div className="break-words font-mono text-xs">{chosen.bytes}</div>
        <p className="text-sm leading-relaxed">{chosen.pins}</p>
        <div className="font-mono text-[10px] text-muted-foreground">
          offset and bytes: measured · what it pins: {chosen.how === "measured" ? "measured against the package" : "the repository's attribution"}
        </div>
      </div>
      {only === "clock" ? (
        <div className="border-t px-4 py-2.5 font-mono text-[11px]">
          bytes that carry a clock: 4 + 4 + 316 + 8 + 11 = {clockTotal}. The README says a build without the three fixed times differs in 335.
        </div>
      ) : null}
    </figure>
  )
}
