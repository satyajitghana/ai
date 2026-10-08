"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One function, four representations, two builds. Left: DX-Ball's 0x406400 as REA
// recorded it (website/evidence/dx-ball-sound-pan.md, REA 4.1.0 + Ghidra 12.1.4).
// Right: the same C compiled by me with GCC 13.3.0, `gcc -m32 -O0 -mfpmath=387`,
// disassembled with objdump. No decompiler was run on my build.

type Layer = { id: string; label: string; what: string; left: string; right: string; note: string }

const LAYERS: Layer[] = [
  {
    id: "bytes",
    label: "data bytes",
    what: "The constants the arithmetic reads, as raw little-endian bytes.",
    left: "0x420068: 00 00 00 00 00 00 f9 3f   (1.5625)\n0x420070: 00 00 00 00 00 40 7f 40   (500.0)\n0x4210a0: 00 00 00 00 00 00 f0 3f   (1.0, pan scale)\n\nfrom read_bytes",
    right: ".rodata+0: 00 00 00 00 00 00 f9 3f\n.rodata+8: 00 00 00 00 00 40 7f 40\n.data+0:   00 00 00 00 00 00 f0 3f\n\nfrom objdump -s pan32.o",
    note: "Byte for byte the same. IEEE-754 doubles do not care which compiler emitted them, which is why reading constants is the most reliable step in the whole investigation.",
  },
  {
    id: "asm",
    label: "instructions",
    what: "What the CPU executes. The left column is VC4.0 output from 1996; the right is a modern GCC at -O0.",
    left: "PUSH EBP / MOV EBP, ESP / SUB ESP, 0xc\nPUSH EBX / PUSH ESI / PUSH EDI\nMOV EAX, [EBP+0x8]\nMOV [EBP-0xc], EAX\nFILD dword [EBP-0xc]\nFMUL qword [0x420068]\nFSUB qword [0x420070]\nFMUL qword [0x4210a0]\nCALL 0x41678c        ; __ftol\nPOP EDI / POP ESI / POP EBX\nLEAVE / RET\n\n23 instructions, 63 bytes",
    right: "push ebp / mov ebp, esp / sub esp, 0x18\nfild dword [ebp+0x8]\nfstp qword [ebp-0x8]\nfld  qword [ebp-0x8]\nfld  qword [.rodata+0]\nfmulp st(1), st\n…  fsubp, fmulp  …\nfnstcw / or ah, 0xc / fldcw\nfistp dword [ebp-0x18]   ; inline truncation\nfldcw / mov eax, [ebp-0x18]\nleave / ret\n\n85 bytes",
    note: "Same C, different code. VC4.0 calls a runtime helper to truncate a double; GCC switches the x87 rounding mode and stores inline. A byte-exact reconstruction therefore has to be checked against the original compiler, which is what the DX-Ball project's pinned VC4.0 replay does.",
  },
  {
    id: "decomp",
    label: "decompiler",
    what: "Pseudo-C reconstructed from the instructions by a decompiler.",
    left: "longlong FUN_00406400(void)\n{\n  longlong lVar1;\n  lVar1 = __ftol();\n  return lVar1;\n}\n\nGhidra 12.1.4, through REA",
    right: "(not run)\n\nI have no Ghidra or Hopper on this machine,\nand this widget does not pretend otherwise.",
    note: "The parameter and every arithmetic step are missing from the pseudo-C. My guess is that the decompiler lost the value __ftol takes from the x87 stack and then pruned everything feeding it as dead; the case study does not say why. The instructions were right; the decompiler's summary of them was not.",
  },
  {
    id: "source",
    label: "source",
    what: "The C a person maintains. Names are chosen, not recovered.",
    left: "DxBallInt dxball_screen_pan(DxBallInt x)\n{\n    double pan;\n    pan = (double)x;\n    pan = pan * 1.5625;\n    pan = pan - 500.0;\n    pan = pan * dxball_pan_scale;\n    return (DxBallInt)pan;\n}\n\nN0zoM1z0/dx-ball src/gameplay.c:131",
    right: "double pan_scale = 1.0;\nint screen_pan(int x)\n{\n    double pan;\n    pan = (double)x;\n    pan = pan * 1.5625;\n    pan = pan - 500.0;\n    pan = pan * pan_scale;\n    return (int)pan;\n}\n\nmy pan.c, the input to the right column",
    note: "The executable carries no names for any of this. dxball_screen_pan is the project's label for 0x406400, and the agent's explanation of what it does rests on the caller and the constants, not on a symbol.",
  },
]

export function FunctionLayers() {
  const [id, setId] = useState("asm")
  const l = LAYERS.find((x) => x.id === id) ?? LAYERS[0]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one function, four views</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Layer">
          {LAYERS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              aria-pressed={x.id === id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 text-xs transition-colors",
                x.id === id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 px-4 py-4" aria-live="polite">
        <p className="text-sm text-muted-foreground">{l.what}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">DX-Ball 1.07 · VC4.0 · as REA recorded it</div>
            <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">{l.left}</pre>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">same C · GCC 13.3 -m32 -O0 · my build</div>
            <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">{l.right}</pre>
          </div>
        </div>
        <p className="text-sm leading-relaxed">{l.note}</p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Left column quoted from REA&apos;s DX-Ball evidence note (setup and stores abbreviated); right column is my own
        compile of an equivalent function. The left assembly leaves out the four intermediate FST stores and the epilogue
        jump.
      </figcaption>
    </figure>
  )
}
