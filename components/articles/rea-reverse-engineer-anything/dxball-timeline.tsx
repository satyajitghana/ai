"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The DX-Ball sound-pan investigation, one step at a time. Every call, address,
// instruction and byte string below is quoted from REA's own case study
// (website/public/showcase/dx-ball/index.html) and its evidence note
// (website/evidence/dx-ball-sound-pan.md) at REA commit 84a17d5. The C is the
// reconstruction project's src/gameplay.c:131.

type Who = "you" | "REA observed" | "agent inferred" | "project verified"

type Step = { stage: string; who: Who; title: string; call?: string; result: string; text: string }

const WHO_COLOR: Record<Who, string> = {
  you: "oklch(0.6 0.02 260)",
  "REA observed": "oklch(0.62 0.15 230)",
  "agent inferred": "oklch(0.66 0.15 65)",
  "project verified": "oklch(0.6 0.15 150)",
}

const STEPS: Step[] = [
  {
    stage: "see the feature",
    who: "you",
    title: "A brick breaks on the left; the sound comes from the left",
    call: "Use REA to find how DX-Ball calculates sound panning.\nExplain the calculation and show the code.",
    result: "DXBALL.EXE  158,208 bytes  PE i386\nsha256 756da1ba09edce71…44e70490\nDX-Ball 1.07, 1996, English Windows build",
    text: "The question is about behaviour you can hear. The target is a local copy of the original executable, identified by its digest, which every later Evidence record carries as its subject.",
  },
  {
    stage: "open the binary",
    who: "REA observed",
    title: "Bind one provider to one target",
    call: 'open_binary {"path": "/abs/path/DXBALL.EXE", "provider_id": "ghidra"}',
    result: "REA 4.1.0 · Ghidra 12.1.4 · Linux x64\nanalyzeHeadless … -import DXBALL.EXE -readOnly -deleteProject\n  -postScript ReaGhidraBridge.java <descriptor>",
    text: "REA starts Ghidra headless on a throwaway project, runs its bridge script after auto-analysis, and talks to it over a private socket. The provider is fixed for the session; REA never swaps engines behind your back.",
  },
  {
    stage: "find the function",
    who: "agent inferred",
    title: "Follow the sound call to a position-to-pan helper",
    result: "0x406400 … 0x40643e   63 bytes, inclusive\ncalled from the brick-hit routine at 0x411f40",
    text: "The case study starts at 0x406400 and does not publish the search that found it; the README describes it as following a sound call into its helper. Which function to look at is the agent's choice, made from tool results.",
  },
  {
    stage: "decompile",
    who: "REA observed",
    title: "The decompiler gets it wrong",
    call: 'analyze_function {"procedure": "0x406400"}',
    result: "longlong FUN_00406400(void)\n{\n  longlong lVar1;\n  lVar1 = __ftol();\n  return lVar1;\n}",
    text: "No parameter, no arithmetic, just a call to the float-to-integer helper. Ghidra lost the stack input and the whole x87 expression. An agent that stopped here would explain a function that does nothing.",
  },
  {
    stage: "read the instructions",
    who: "REA observed",
    title: "The same result carries the assembly, and it disagrees",
    call: "(same analyze_function result, instruction facet)",
    result: "0x406409: MOV EAX, dword ptr [EBP + 0x8]\n0x40640f: FILD dword ptr [EBP + -0xc]\n0x406415: FMUL double ptr [0x00420068]\n0x40641e: FSUB double ptr [0x00420070]\n0x406427: FMUL double ptr [0x004210a0]\n0x406430: CALL 0x0041678c   ; __ftol",
    text: "[EBP+8] is the first stack argument; FILD loads it as an integer; then a multiply, a subtract and a second multiply by doubles stored in memory. The dossier returns pseudocode and assembly side by side, which is what exposes the decompiler's mistake.",
  },
  {
    stage: "follow the caller",
    who: "REA observed",
    title: "What gets passed in",
    call: 'analyze_function {"procedure": "0x411f40"}',
    result: "0x411f50: MOV EAX, dword ptr [EBP + 0x8]\n0x411f53: ADD EAX, EAX\n0x411f55: LEA EAX, [EAX + EAX*0x2]\n0x411f58: LEA EAX, [EAX + EAX*0x4]\n0x411f5b: ADD EAX, 0x14\n0x411f5e: PUSH EAX\n0x411f5f: CALL 0x00406400",
    text: "x2, then x3, then x5 is x30; plus 0x14 is plus 20. The argument is 20 + 30 x tile_x: the brick's horizontal screen position. That reading is arithmetic on observed instructions; calling it a screen coordinate is interpretation.",
  },
  {
    stage: "read the constants",
    who: "REA observed",
    title: "The numbers behind the addresses",
    call: 'read_bytes {"address": "0x420068", "length": 16}\nread_bytes {"address": "0x4210a0", "length": 8}',
    result: "000000000000f93f → 1.5625\n0000000000407f40 → 500.0\n000000000000f03f → 1.0",
    text: "REA returns raw bytes; the decoding to little-endian doubles is the case study's. 1.5625 x 640 = 1000, so a 640-pixel-wide screen maps to 0..1000, and subtracting 500 centres it: -500 at the left edge, 0 in the middle, 500 at the right.",
  },
  {
    stage: "reimplement",
    who: "agent inferred",
    title: "Write it as C, and name things",
    result: "DxBallInt dxball_screen_pan(DxBallInt x)\n{\n    double pan;\n    pan = (double)x;\n    pan = pan * 1.5625;\n    pan = pan - 500.0;\n    pan = pan * dxball_pan_scale;\n    return (DxBallInt)pan;\n}",
    text: "Every line maps to an instruction above. The names dxball_screen_pan, x and dxball_pan_scale are the project's, not the binary's: the executable has no symbols for them.",
  },
  {
    stage: "check it",
    who: "project verified",
    title: "Two independent checks, neither of them REA",
    result: "3,205 cases: x = 0..640 at scales 0, 0.5, 1, 20, -1\n  original x86 return == maintained C return\n63 bytes: C rebuilt with the pinned VC4.0 compiler\n  matches the whole function after relocations",
    text: "This is what turns a plausible explanation into a fact. The reconstruction project runs the original x86 function against the C, and rebuilds the C with the 1996 compiler until the bytes match. REA supplied the evidence; the oracles live in the project.",
  },
]

export function DxBallTimeline() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">DX-Ball 1.07 · sound pan · 0x406400</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Step">
          {STEPS.map((st, k) => (
            <button
              key={st.stage}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={k === i}
              aria-label={`Step ${k + 1}: ${st.stage}`}
              className={cn(
                "h-6 w-6 cursor-pointer rounded-md border font-mono text-xs transition-colors",
                k === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b px-4 py-2" aria-hidden="true">
        {STEPS.map((st, k) => (
          <div
            key={st.stage}
            className={cn("h-1.5 min-w-6 flex-1 rounded-full transition-opacity", k <= i ? "opacity-100" : "opacity-25")}
            style={{ background: WHO_COLOR[st.who] }}
          />
        ))}
      </div>
      <div className="space-y-3 px-4 py-4" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="text-sm font-semibold">
            <span className="mr-2 font-mono text-xs text-muted-foreground">{s.stage}</span>
            {s.title}
          </div>
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ borderColor: WHO_COLOR[s.who], color: WHO_COLOR[s.who] }}
          >
            {s.who}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {s.call && (
            <div className="overflow-hidden rounded-lg border">
              <div className="border-b bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
                {s.who === "you" ? "prompt" : "agent → REA"}
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-2 font-mono text-xs leading-relaxed">{s.call}</pre>
            </div>
          )}
          <div className={cn("overflow-hidden rounded-lg border", !s.call && "md:col-span-2")}>
            <div className="border-b bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
              {s.who === "project verified" ? "reconstruction project" : s.who === "agent inferred" ? "agent's working" : "REA → agent"}
            </div>
            <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">{s.result}</pre>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setI((k) => Math.max(0, k - 1))}
            disabled={i === 0}
            className="cursor-pointer rounded-md border px-2.5 py-1 text-xs disabled:cursor-default disabled:opacity-40"
          >
            ← back
          </button>
          <button
            type="button"
            onClick={() => setI((k) => Math.min(STEPS.length - 1, k + 1))}
            disabled={i === STEPS.length - 1}
            className="cursor-pointer rounded-md border px-2.5 py-1 text-xs disabled:cursor-default disabled:opacity-40"
          >
            next →
          </button>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Calls, instructions and bytes quoted from REA&apos;s DX-Ball case study and its evidence note; the colour says who
        established each step. Only the blue steps are REA output.
      </figcaption>
    </figure>
  )
}
