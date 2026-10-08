"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What LinuxElfPatcher::Patch (core/relinker/elfpatcher/src/linux/LinuxElfPatcher.cpp, commit 4b6ab6b)
// does to a file, as a map you can click. The order and contents of the appended block follow that
// function line by line; the kept and dropped segments follow SegmentFilter.cpp and
// ProgramHeaderLayoutBuilder.cpp. Block heights are schematic, not to scale.

type Fate = "kept" | "patched" | "dropped" | "new"

type Block = { id: string; label: string; sub: string; fate: Fate; h: number; note: string; at: string; intel?: boolean }

const BEFORE: Block[] = [
  { id: "ehdr", label: "ELF header", sub: "Sony type and ABI bytes", fate: "patched", h: 1, note: "The OS ABI and ABI version bytes are zeroed, e_type becomes ET_DYN so the host loader treats the file as a position-independent executable, and the section header fields are cleared. e_entry is pointed at a new stub further down.", at: "LinuxElfPatcher.cpp:83" },
  { id: "phdr", label: "program headers", sub: "the console's segment list", fate: "patched", h: 1, note: "Rewritten in place: a PT_PHDR, a read-only PT_LOAD for the header block, every kept original segment, then three new ones (the appended block, a new PT_DYNAMIC, PT_INTERP).", at: "ProgramHeaderLayoutBuilder.cpp:170" },
  { id: "text", label: "PT_LOAD code", sub: "x86-64, Zen 2", fate: "kept", h: 5, note: "Byte for byte what the console would map, at the same relative addresses. The only change is that every load segment gets the read bit, and a segment with no flags at all gets read, write and execute. The code does not say why; my guess is code the console maps execute-only, which a host loader cannot express.", at: "ProgramHeaderLayoutBuilder.cpp:94" },
  { id: "data", label: "PT_LOAD data", sub: "GOT, .data, .bss", fate: "kept", h: 3, note: "Kept. The GOT is still at its original address, so every PLT stub in the code keeps jumping through the same slots. Only who fills those slots changes.", at: "LinuxElfPatcher.cpp:150" },
  { id: "tls", label: "PT_TLS", sub: "thread-local template", fate: "kept", h: 1, note: "Kept as is on Linux. The console and glibc both put x86-64 thread-local storage below the thread pointer in fs, so the game's fs-relative accesses resolve against a block glibc's loader allocates. On Windows every fs access is rewritten instead (see the article).", at: "SegmentFilter.cpp:13" },
  { id: "procparam", label: "PT_SCE_PROCPARAM", sub: "0x61000001", fate: "kept", h: 1, note: "The one Sony segment the filter keeps: process parameters, which the replacement libkernel hands back from sceKernelGetProcParam (libkernel/System/src/Process.cpp:184).", at: "SegmentFilter.cpp:14" },
  { id: "dyn", label: "PT_DYNAMIC", sub: "DT_OS_* tags", fate: "dropped", h: 1, note: "Read, then dropped. Its Sony tags (0x61000027 to 0x6100003f) give the symbol table, strings and relocations as offsets into the file rather than as addresses.", at: "RelinkerPipeline.cpp:101" },
  { id: "dynlib", label: "PT_SCE_DYNLIBDATA", sub: "0x61000000", fate: "dropped", h: 2, note: "The console's symbol and relocation tables. The bytes stay in the file, but no program header maps them any more: the relinker has already copied what it needs into new SysV tables.", at: "SegmentFilter.cpp:6" },
]

const AFTER: Block[] = [
  { id: "ehdr", label: "ELF header", sub: "ET_DYN, OS ABI 0", fate: "patched", h: 1, note: "Now an ordinary x86-64 Linux PIE header with e_entry at the stub below.", at: "LinuxElfPatcher.cpp:83" },
  { id: "phdr", label: "program headers", sub: "PHDR, LOADs, DYNAMIC, INTERP", fate: "patched", h: 1, note: "Every header a Linux loader needs and none it does not understand.", at: "ProgramHeaderLayoutBuilder.cpp:170" },
  { id: "text", label: "PT_LOAD code", sub: "unchanged bytes", fate: "kept", h: 5, note: "The game's machine code, untouched. With --to-intel, each AMD-only instruction is overwritten with a 5-byte jump (and NOPs) to a stub in the appended block.", at: "LinuxElfPatcher.cpp:63" },
  { id: "data", label: "PT_LOAD data", sub: "GOT filled by ld.so", fate: "kept", h: 3, note: "The same bytes. At startup glibc's ld.so writes a host address into each GOT slot named by the new relocations.", at: "LinuxElfPatcher.cpp:150" },
  { id: "tls", label: "PT_TLS", sub: "glibc allocates it", fate: "kept", h: 1, note: "Unchanged.", at: "SegmentFilter.cpp:13" },
  { id: "procparam", label: "PT_SCE_PROCPARAM", sub: "still mapped", fate: "kept", h: 1, note: "Unchanged.", at: "SegmentFilter.cpp:14" },
  { id: "dynstr", label: ".dynstr", sub: "NIDs, DT_NEEDED, runpath", fate: "new", h: 1, note: "Library names such as libSceVideoOut.prx, every imported NID with its '#…' tail cut off, and $ORIGIN/libs. Appended at the end of the file, which is where the new block starts.", at: "LinuxElfPatcher.cpp:100" },
  { id: "dynsym", label: ".dynsym", sub: "24 bytes per import", fate: "new", h: 1, note: "One global function symbol per kept import, value 0, so the loader must find it in a library.", at: "LinuxElfPatcher.cpp:110" },
  { id: "rela", label: ".rela.dyn / .rela.plt", sub: "RELATIVE, GLOB_DAT, JUMP_SLOT", fate: "new", h: 1, note: "The original relocations re-expressed against the new symbol indices. JUMP_SLOT entries keep their original order, because each PLT stub has its slot index baked in.", at: "LinuxElfPatcher.cpp:115" },
  { id: "dynamic", label: "new PT_DYNAMIC", sub: "BIND_NOW, RUNPATH", fate: "new", h: 1, note: "Standard tags only: DT_NEEDED per library, DT_STRTAB, DT_SYMTAB, DT_RELA, DT_JMPREL, DT_PLTGOT at the original GOT, DT_FLAGS = DF_BIND_NOW, DT_RUNPATH.", at: "LinuxElfPatcher.cpp:134" },
  { id: "stub", label: "entry stub", sub: "17 bytes", fate: "new", h: 1, note: "mov rdi, rsp; and rsp, -16; xor rsi, rsi; call entry; ud2. Linux starts a process with argc and argv on the stack in the same shape the console's entry expects behind its first argument, so a pointer to the stack is the whole adapter.", at: "EntryStubBuilder.cpp:18" },
  { id: "tramp", label: "--to-intel stubs", sub: "16-byte aligned", fate: "new", h: 1, intel: true, note: "Out-of-line replacements for instructions Intel CPUs lack (SSE4a EXTRQ/INSERTQ, CLZERO, SHA, and AMD's approximate VRCPPS/VRSQRTPS). Each ends in a jump back to the instruction after the patched site.", at: "LinuxElfPatcher.cpp:32" },
  { id: "interp", label: "PT_INTERP", sub: "/lib64/ld-linux-x86-64.so.2", fate: "new", h: 1, note: "Names glibc's dynamic loader, which from here on does what the console's kernel loader did.", at: "LinuxElfPatcher.cpp:172" },
]

const FATE: Record<Fate, { label: string; color: string }> = {
  kept: { label: "kept", color: "oklch(0.6 0.13 150)" },
  patched: { label: "patched", color: "oklch(0.62 0.13 80)" },
  dropped: { label: "unmapped", color: "oklch(0.6 0.03 260)" },
  new: { label: "appended", color: "oklch(0.58 0.14 250)" },
}

function Column({ title, blocks, sel, onSel }: { title: string; blocks: Block[]; sel: string; onSel: (k: string) => void }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-1">
        {blocks.map((b) => {
          const key = `${title}:${b.id}`
          const c = FATE[b.fate].color
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSel(key)}
              aria-pressed={sel === key}
              className={cn(
                "flex cursor-pointer flex-col justify-center rounded-md border px-2 text-left transition-colors",
                sel === key ? "ring-2 ring-foreground/60" : "hover:bg-muted/40",
                b.fate === "dropped" && "border-dashed opacity-70",
              )}
              style={{ minHeight: `${1.7 + (b.h - 1) * 0.9}rem`, borderColor: c, background: `color-mix(in oklch, ${c} 10%, transparent)` }}
            >
              <span className="font-mono text-[11px] font-semibold leading-tight">{b.label}</span>
              <span className="font-mono text-[10px] leading-tight text-muted-foreground">{b.sub}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RelinkLayout() {
  const [intel, setIntel] = useState(false)
  const [sel, setSel] = useState("after:stub")
  const after = AFTER.filter((b) => intel || !b.intel)
  const [side, id] = sel.split(":")
  const pool = side === "before" ? BEFORE : AFTER
  const chosen = pool.find((b) => b.id === id) ?? AFTER[10]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">relinker input.elf app.elf</span>
        <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px]">
          <input type="checkbox" checked={intel} onChange={(e) => setIntel(e.target.checked)} />
          --to-intel
        </label>
      </div>
      <div className="flex gap-3 px-4 py-3">
        <Column title="before" blocks={BEFORE} sel={sel} onSel={setSel} />
        <div className="flex items-center font-mono text-muted-foreground" aria-hidden>
          →
        </div>
        <Column title="after" blocks={after} sel={sel} onSel={setSel} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-2 font-mono text-[10px] text-muted-foreground">
        {(Object.keys(FATE) as Fate[]).map((f) => (
          <span key={f} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ borderColor: FATE[f].color, background: `color-mix(in oklch, ${FATE[f].color} 25%, transparent)` }} />
            {FATE[f].label}
          </span>
        ))}
      </div>
      <div className="space-y-1.5 border-t px-4 py-3" aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold">{chosen.label}</span>
          <span className="rounded-full border px-2 py-0.5 font-mono text-[10px]" style={{ borderColor: FATE[chosen.fate].color, color: FATE[chosen.fate].color }}>
            {FATE[chosen.fate].label}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{chosen.note}</p>
        <div className="font-mono text-xs text-muted-foreground">core/relinker/…/{chosen.at}</div>
      </div>
    </figure>
  )
}
