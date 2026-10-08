"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { computeNid, hex } from "./nid"

// One import, followed from the game's call instruction to the host. Every code block quotes AnyPS5 at
// commit 4b6ab6b (8 Oct 2026) with its file:line, trimmed to the lines that matter; the first block is a
// schematic of what a compiler emits for an imported call, not a disassembly of any title. NIDs are
// computed live by nid.ts, the same function as core/libs/nid/src/NidCompute.cpp.

type Call = {
  name: string
  lib: string
  sig: string
  body: string
  bodyAt: string
  host: string
  hostCode: string
  hostAt: string
}

const CALLS: Call[] = [
  {
    name: "sceKernelUsleep",
    lib: "libkernel",
    sig: "int sceKernelUsleep(KernelUseconds)",
    body: `int APS5_VABI sceKernelUsleep_nid_postfix(KernelUseconds microseconds) {
    TraceSleep(__builtin_return_address(0), microseconds);
    TimedWait::SleepNanos(static_cast<std::uint64_t>(microseconds) * 1000ULL);
    return 0;
}`,
    bodyAt: "core/libs/prx/libkernel/Time/Time.cpp:224",
    host: "A host sleep. The _nid_postfix suffix is cut off before hashing, so the export is still the NID of sceKernelUsleep, while the C++ name cannot collide with anything in the host's own C library.",
    hostCode: `// nid_patcher: StripNidPostfix("sceKernelUsleep_nid_postfix")
//   -> "sceKernelUsleep" -> ComputeNid(...) -> "1jfXLRVzisc"`,
    hostAt: "core/libs/nid/src/NidResolver.cpp:62",
  },
  {
    name: "sceVideoOutOpen",
    lib: "libSceVideoOut",
    sig: "int sceVideoOutOpen(int userId, int busType, int index, const void* param)",
    body: `int APS5_VABI sceVideoOutOpen(int userId, int busType, int index, const void* param) try {
    validateOpenParam(param);
    if (userId != 255 && userId != 0) {
        throw std::runtime_error(std::string(__func__) + ": VIDEO_OUT_ERROR_INVALID_VALUE");
    }
    ...
    const int handle = VideoOutDriver::Get().Open(busType);`,
    bodyAt: "core/libs/prx/libSceVideoOut/src/Output.cpp:54",
    host: "An SDL window and a Vulkan swapchain stand in for the console's display. Note the house rule at work: an argument the console would reject with an error code throws here, and the process ends with the message.",
    hostCode: `target_link_libraries(libSceVideoOut PRIVATE libSceAgcDriver libScePad
    libSceMouse libSceKeyboard libc libkernel SDL2-static)`,
    hostAt: "core/libs/prx/libSceVideoOut/CMakeLists.txt:19",
  },
  {
    name: "scePadRead",
    lib: "libScePad",
    sig: "int scePadRead(int handle, PadData* data, int num)",
    body: `int APS5_VABI scePadRead_nid_postfix(int handle, PadData* data, int num) {
    if (data == nullptr || num <= 0) APS5_INVALID_ARG_EX;
    const int result = scePadReadState(handle, data);
    if (result != 0) return result;
    return 1;
}`,
    bodyAt: "core/libs/prx/libScePad/Export.cpp:161",
    host: "SDL's game-controller state, or the keyboard and mouse through anyps5-input.ini, packed into the console's PadData struct. One current state per call: the title asked for a queue, it gets the newest sample.",
    hostCode: `int APS5_VABI scePadReadState(int handle, PadData* data) {
 if (handle != PAD_HANDLE) return PAD_ERROR_INVALID_HANDLE;
 ...
 *data = Pad::ReadState();`,
    hostAt: "core/libs/prx/libScePad/Export.cpp:169",
  },
  {
    name: "sceAgcDriverSubmitDcb",
    lib: "libSceAgcDriver",
    sig: "int sceAgcDriverSubmitDcb(const Packet* packet)",
    body: `int APS5_VABI sceAgcDriverSubmitDcb(const Packet* packet) {
    AgcDriver::Submit(packet, 0);
    return 0;
}`,
    bodyAt: "core/libs/prx/libSceAgcDriver/Submit/src/Dcb.cpp:43",
    host: "The packet is a pointer into ordinary process memory holding PM4 command words. A queue worker parses them, recompiles any new shader to SPIR-V and records Vulkan commands.",
    hostCode: `require((header & 0xc0000000u) == 0xc0000000u, "unsupported PM4 packet type");
require(packet.size() == ((header >> 16u) & 0x3fffu) + 2u, "invalid PM4 packet size");
const auto opcode = (header >> 8u) & 0xffu;`,
    hostAt: "core/libs/prx/libSceAgcDriver/Execution/src/Pm4.cpp:226",
  },
]

type Os = "linux" | "windows"

type Step = { who: string; title: string; text: string; code: string; at: string }

function stepsFor(call: Call, nid: string, os: Os): Step[] {
  const lib = `${call.lib}.prx`
  return [
    {
      who: "game code",
      title: "1. The game calls through its own PLT",
      text: `Compiled game code never knows where ${call.name} lives. It calls a stub in its procedure linkage table, which jumps through a slot in the global offset table. On the console, the system's loader fills that slot. The relinker does not touch this code at all.`,
      code: `call   ${call.name}@plt        ; schematic, not from a title
${call.name}@plt:
jmp    *GOT[n](%rip)          ; slot n, filled at load time`,
      at: "schematic",
    },
    {
      who: "PS5 ELF",
      title: "2. The import is a hash, not a name",
      text: `The symbol table does not say "${call.name}". It holds an 11-character NID plus two ids after '#' marks. The last one is a module id, written in the same 64-letter alphabet, which an OS-specific dynamic tag maps to a library name.`,
      code: `${nid}#<library id>#<module id>

if (tag.Tag == 0x61000045 && !importModules.emplace(tag.Value >> 48,
        readCStr(tag.Value & 0xffffffffu)).second)`,
      at: "core/relinker/relinker/src/pipeline/RelinkerPipeline.cpp:189",
    },
    {
      who: "relinker",
      title: "3. The relinker writes a standard import",
      text: `It keeps the GOT slot's address, cuts the name at the first '#', and emits an ordinary SysV symbol and an R_X86_64_JUMP_SLOT relocation. The module id became a DT_NEEDED entry for ${lib}. Nothing else about the call changes.`,
      code: `const std::uint32_t nameOff = _appendStr(result.DynStrData, stripHashSuffix(ref.Nid));
...
const std::uint64_t relaInfo = (static_cast<std::uint64_t>(symIdx) << 32) | R_X86_64_JUMP_SLOT;
_appendRela(result.RelaPltData, ref.RelocationAddress, relaInfo, ref.Addend);`,
      at: "core/relinker/relinker/src/output/SysVDynamicSectionBuilder.cpp:134",
    },
    {
      who: "build",
      title: `4. ${lib} exports ${nid}`,
      text: `AnyPS5's replacement library is compiled from C++ with readable names. After linking, nid_patcher rewrites each export's name to its NID: SHA-1 of the name plus a fixed 16-byte suffix, first 8 bytes, base64. The hash box below runs that function on whatever you type.`,
      code: `const auto digest = Sha1(input);           // name + kNidSuffix[16]
uint8_t reversed[8];
for (int i = 0; i < 8; i++)
    reversed[i] = digest[7 - i];`,
      at: "core/libs/nid/src/NidCompute.cpp:27",
    },
    os === "linux"
      ? {
          who: "ld.so",
          title: "5. The ordinary dynamic loader binds it",
          text: `The output has PT_INTERP /lib64/ld-linux-x86-64.so.2, a DT_RUNPATH of $ORIGIN/libs and DF_BIND_NOW. glibc's loader opens ${lib}, finds the symbol named ${nid} and writes its address into the GOT slot before the game's entry point runs. A missing NID fails here, at startup, not halfway through a level.`,
          code: `if (!lazyBinding)
    _appendDynEntry(dynSegBuf, DT_FLAGS, DF_BIND_NOW);
_appendDynEntry(dynSegBuf, DT_RUNPATH, runPathStrOff);`,
          at: "core/relinker/elfpatcher/src/linux/LinuxElfPatcher.cpp:152",
        }
      : {
          who: "entry stub",
          title: "5. A generated stub does the loader's job",
          text: `A PE import table names one DLL per import, and ELF's search-every-library rule does not exist on Windows. So the PE imports only kernel32 functions, and the relinker writes an entry stub, in raw machine code, that calls LoadLibraryExA on each needed .prx (which is really a DLL) and fills every GOT slot itself before jumping to the game.`,
          code: `code.Rip({0x48, 0x8d, 0x0d}, resolvedPaths[index]);
code.Emit({0x31, 0xd2, 0x41, 0xb8, 0, 0x11, 0, 0});
call("LoadLibraryExA");`,
          at: "core/relinker/elfpatcher/src/windows/WindowsEntryStubBuilder.cpp:304",
        },
    {
      who: "HLE library",
      title: `6. ${call.name} runs as native code`,
      text:
        os === "linux"
          ? `The game's call lands in a C++ function compiled for the host. On Linux both sides already use the SysV AMD64 calling convention, so APS5_VABI expands to nothing.`
          : `The game's call lands in a C++ function compiled for the host. On Windows the compiler's default is the Microsoft x64 convention, which passes arguments in different registers, so every export is marked sysv_abi to match the game.`,
      code: `${call.body}

#ifdef _WIN32
#define APS5_VABI __attribute__((sysv_abi))
#else
#define APS5_VABI
#endif`,
      at: `${call.bodyAt}; core/libs/prx/libc/include/general/VabiMacros.hpp:4`,
    },
    {
      who: "host",
      title: "7. Down to the host",
      text: call.host,
      code: call.hostCode,
      at: call.hostAt,
    },
  ]
}

const WHO_COLOR: Record<string, string> = {
  "game code": "oklch(0.6 0.15 30)",
  "PS5 ELF": "oklch(0.6 0.15 30)",
  relinker: "oklch(0.58 0.14 250)",
  build: "oklch(0.6 0.13 150)",
  "ld.so": "oklch(0.58 0.14 250)",
  "entry stub": "oklch(0.58 0.14 250)",
  "HLE library": "oklch(0.6 0.13 150)",
  host: "oklch(0.62 0.12 80)",
}

export function CallTrace() {
  const [ci, setCi] = useState(1)
  const [os, setOs] = useState<Os>("linux")
  const [i, setI] = useState(0)
  const [text, setText] = useState("sceVideoOutOpen")
  const call = CALLS[ci]
  const callNid = useMemo(() => computeNid(call.name).nid, [call.name])
  const steps = stepsFor(call, callNid, os)
  const s = steps[i]
  const typed = useMemo(() => computeNid(text), [text])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="mr-auto font-mono text-xs text-muted-foreground">life of one import</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Function">
          {CALLS.map((c, k) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setCi(k)}
              aria-pressed={k === ci}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                k === ci ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Target">
          {(["linux", "windows"] as Os[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOs(o)}
              aria-pressed={o === os}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                o === os ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o === "linux" ? "Linux ELF" : "Windows PE"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 font-mono text-[11px]">
        <span className="text-muted-foreground">{call.sig}</span>
        <span>
          NID <span className="font-semibold">{callNid}</span> in {call.lib}.prx
        </span>
      </div>

      <div className="flex flex-wrap gap-1 px-4 pt-3" role="group" aria-label="Step">
        {steps.map((st, k) => (
          <button
            key={k}
            type="button"
            onClick={() => setI(k)}
            aria-pressed={k === i}
            aria-label={`Step ${k + 1}: ${st.who}`}
            className={cn(
              "h-6 min-w-6 cursor-pointer rounded-md border px-1.5 font-mono text-xs transition-colors",
              k === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k + 1}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 py-3" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="text-sm font-semibold">{s.title}</div>
          <span
            className="rounded-full border px-2 py-0.5 font-mono text-[11px]"
            style={{ borderColor: WHO_COLOR[s.who], color: WHO_COLOR[s.who] }}
          >
            {s.who}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{s.text}</p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">{s.code}</pre>
        <div className="font-mono text-xs text-muted-foreground">{s.at}</div>
      </div>

      <div className="space-y-2 border-t px-4 py-3">
        <label className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">hash any name</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 font-mono text-xs"
            aria-label="Symbol name to hash"
          />
          <span className="font-mono text-sm font-semibold">{typed.nid}</span>
        </label>
        <div className="overflow-x-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
          <div>sha1(name + suffix) = {hex(typed.digest)}</div>
          <div>first 8 bytes, reversed = {hex(typed.reversed)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-4 py-2">
        <button
          type="button"
          disabled={i === 0}
          onClick={() => setI(i - 1)}
          className="cursor-pointer py-1 font-mono text-xs text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-40"
        >
          ← previous
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">
          {i + 1} / {steps.length}
        </span>
        <button
          type="button"
          disabled={i === steps.length - 1}
          onClick={() => setI(i + 1)}
          className="cursor-pointer py-1 font-mono text-xs text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-40"
        >
          next →
        </button>
      </div>
    </figure>
  )
}
