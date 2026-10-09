"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One Metal draw followed from the app to the GPU through the NullMoth stack. Every code block quotes
// nullmoth/nvidia-macos-driver at b9a5a2b (8 Oct 2026), trimmed to the lines that matter, except the
// GSP queue comment, which is NVIDIA's open-gpu-kernel-modules at tag 610.57.04. Paths are repo paths;
// nvk/nvk-macos.patch line numbers are lines of the patch file itself.

type Layer = "Metal" | "plugin" | "translator" | "NVK" | "kext" | "GSP"

type Stop = {
  layer: Layer
  title: string
  text: string
  code: string
  at: string
}

const STOPS: Stop[] = [
  {
    layer: "Metal",
    title: "1. Metal looks up the accelerator",
    text: "Apple's Metal.framework finds the IOAccelerator attached to the GPU and reads two registry properties to decide which driver bundle to load. NVAccel publishes them from its Info.plist. The name is a relative path: Metal expects a bundle under /System/Library/Extensions, and three dot-dots walk it back out to /Library/GPUBundles, which is writable without touching the sealed system volume.",
    code: `<key>MetalPluginName</key><string>../../../Library/GPUBundles/NVMTLDriver</string>
<key>MetalPluginClassName</key><string>NVMTLDevice</string>`,
    at: "kexts/NVRM/accel/Info.plist:37",
  },
  {
    layer: "plugin",
    title: "2. The plugin becomes the MTLDevice",
    text: "NVMTLDevice subclasses Apple's private MTLIOAccelDevice, so Apple's own base class opens the IOKit connection. Then it checks a per-process allow-list and brings up Vulkan inside the app. If NVK does not come up, the plugin refuses to be the device at all.",
    code: `self = [super initWithAcceleratorPort:port];
if (!self) { ... return nil; }
if (!nvmtl_process_is_allowed()) { ... return nil; }
...
if (nvmtl_vk_init()) {
    nvlog("  NVK did not come up in this process - refusing to be the Metal device ...");
    return nil;
}`,
    at: "plugin/NVMTLDevice.m:344",
  },
  {
    layer: "translator",
    title: "3. The shader: AIR in, SPIR-V out",
    text: "A Metal library holds AIR, Apple's LLVM bitcode. The plugin turns each function into text IR with a bundled air-opt (an LLVM opt binary, spawned with a 20-second limit), hands it to the metal2vulkan-based translator, and caches the SPIR-V on disk by hash.",
    code: `char *argv[] = { NVMTL_AIR_OPT, "-S", (char *)input, "-o", (char *)output, NULL };
...
if (xlate(ll.UTF8String, stage.UTF8String, &spv, &spvn, err, sizeof err) != 0) {
    nvlog("library: translate %s (%s) FAILED: %s", ...); return nil;
}`,
    at: "plugin/NVMTLLibraryLoad.m:318 and :710",
  },
  {
    layer: "plugin",
    title: "4. Encoders become a Vulkan command buffer",
    text: "Render, compute and blit encoders record into a VkCommandBuffer. commit submits it to NVK's queue with a fence; a prologue command buffer carrying pending uploads goes in front of it in the same submit.",
    code: `cbs[ncb++] = c->cb;
VkSubmitInfo si = { VK_STRUCTURE_TYPE_SUBMIT_INFO, NULL, 0, NULL, NULL, ncb, cbs, 0, NULL };
...
result = g_state == 1 ? pvkQueueSubmit(g_queue, 1, &si, fence) : VK_ERROR_DEVICE_LOST;`,
    at: "plugin/nvmtl_vk.c:5014",
  },
  {
    layer: "NVK",
    title: "5. NVK compiles with NAK and speaks RM, not DRM",
    text: "NAK compiles the SPIR-V to NVIDIA machine code. Memory, channels and syncs go through a kernel-mode backend that talks to NVIDIA's resource manager with the same escape codes NVIDIA's own Linux userspace uses. One function decides how an escape leaves the process: an ioctl on Linux, a Haiku device op, or an IOKit call on macOS.",
    code: `#ifdef __HAIKU__
    res = ioctl(fd, cmd + NV_HAIKU_BASE, pParams, paramsSize);
#elif defined(__APPLE__)
    res = nvrm_xnu_ioctl(fd, cmd, pParams, paramsSize);
#else
    res = ioctl(fd, _IOC(IOC_INOUT, NV_IOCTL_MAGIC, cmd, paramsSize), pParams);
#endif`,
    at: "nvk/nvk-macos.patch:7080 (src/nouveau/vulkan/nvkmd/nvrm/nvRmApi.c)",
  },
  {
    layer: "NVK",
    title: "6. A file descriptor that is really an IOKit connection",
    text: "macOS has no /dev/nvidia0. The shim opens /dev/null to get a real descriptor number, uses it as an index into a table of io_connect_t handles, and turns each escape into an IOConnectCallMethod on selector 1 with the escape code as the scalar argument.",
    code: `uint64_t in = cmd; size_t out = size;
kern_return_t kr = IOConnectCallMethod(conn, SEL_ESC, &in, 1, data, size,
                                       NULL, NULL, data, &out);`,
    at: "nvk/nvk-macos.patch:11687 (nvkmd/nvrm/nvrm_xnu.c)",
  },
  {
    layer: "kext",
    title: "7. The kext hands the escape to NVIDIA's RM",
    text: "NVRM's user client has seven selectors. Anything it does not handle itself falls through to rm_ioctl, the entry point of NVIDIA's open resource manager, compiled for Darwin and linked into the kext.",
    code: `default: {
    NV_STATUS st = rm_ioctl(NULL, nv, &fNvfp, cmd, data, size);
    if (st != NV_OK) kprintf("NVRM-xnu: esc 0x%x size %u -> RM status 0x%x\\n", cmd, size, st);
    return st == NV_OK ? kIOReturnSuccess : kIOReturnError;
}`,
    at: "kexts/NVRM/NVRM.cpp:1310",
  },
  {
    layer: "GSP",
    title: "8. Most of RM runs on the GPU",
    text: "On Turing and later, the CPU-side RM is a thin client. Control calls become RPCs written into a command queue in shared memory, which GSP-RM, a RISC-V firmware image NVIDIA ships, reads on the GPU and answers through a status queue. The kext loaded that image from disk at boot and called rm_init_adapter to start it.",
    code: `// Shared memory layout.
//
// Each of the following are page aligned:
//   Shared memory layout header (includes page table)
//   RM Command queue header
//   RM Command queue entries
//   RM Status queue header
//   RM Status queue entries`,
    at: "open-gpu-kernel-modules 610.57.04: src/nvidia/src/kernel/gpu/gsp/message_queue_cpu.c:297",
  },
]

const LAYER_COLOR: Record<Layer, string> = {
  Metal: "oklch(0.6 0.02 260)",
  plugin: "oklch(0.6 0.15 30)",
  translator: "oklch(0.6 0.13 300)",
  NVK: "oklch(0.58 0.14 250)",
  kext: "oklch(0.6 0.13 150)",
  GSP: "oklch(0.62 0.14 80)",
}

const LAYERS: Layer[] = ["Metal", "plugin", "translator", "NVK", "kext", "GSP"]

export function DrawCallPath() {
  const [i, setI] = useState(0)
  const s = STOPS[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="mr-auto font-mono text-xs text-muted-foreground">life of one draw call</span>
        <button
          type="button"
          onClick={() => setI((i + STOPS.length - 1) % STOPS.length)}
          className="cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          prev
        </button>
        <button
          type="button"
          onClick={() => setI((i + 1) % STOPS.length)}
          className="cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          next
        </button>
      </div>

      <div className="flex flex-wrap items-stretch gap-1 px-4 pt-3" role="group" aria-label="Layer">
        {LAYERS.map((l) => {
          const first = STOPS.findIndex((x) => x.layer === l)
          const on = s.layer === l
          return (
            <button
              key={l}
              type="button"
              onClick={() => setI(first)}
              aria-pressed={on}
              className={cn(
                "flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-center font-mono text-[11px] transition-colors",
                on ? "text-background" : "text-muted-foreground hover:text-foreground",
              )}
              style={on ? { background: LAYER_COLOR[l], borderColor: LAYER_COLOR[l] } : { borderColor: LAYER_COLOR[l] }}
            >
              {l}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-1 px-4 pt-2" role="group" aria-label="Step">
        {STOPS.map((st, k) => (
          <button
            key={k}
            type="button"
            onClick={() => setI(k)}
            aria-pressed={k === i}
            aria-label={`Step ${k + 1}: ${st.layer}`}
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
            style={{ borderColor: LAYER_COLOR[s.layer], color: LAYER_COLOR[s.layer] }}
          >
            {s.layer}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{s.text}</p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">{s.code}</pre>
        <div className="font-mono text-xs text-muted-foreground">{s.at}</div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Eight stops from a Metal call to the GPU&apos;s own processor. Code is quoted from the repository at b9a5a2b and,
        for the last stop, from NVIDIA&apos;s open-gpu-kernel-modules at 610.57.04.
      </figcaption>
    </figure>
  )
}
