"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The README's feature claims, each traced to the code that implements it and to the evidence that it was
// checked. Sources: nullmoth/nvidia-macos-driver at b9a5a2b; "validated" means listed in docs/RELEASE-1.1.0.md,
// docs/CARD-SUPPORT.md or the v1.1.0 VALIDATION.json release asset. "User report" means a GitHub issue, not the
// project's own testing.

type Evidence = "validated" | "user report" | "none"
type How = "native" | "emulated" | "Apple's layer" | "no specific code"

type Row = {
  feature: string
  how: How
  vulkan: string
  detail: string
  at: string
  evidence: Evidence
  proof: string
}

const ROWS: Row[] = [
  {
    feature: "Argument buffers, tier 2",
    how: "native",
    vulkan: "descriptor indexing, VK_EXT_mutable_descriptor_type, buffer device addresses",
    detail:
      "The device answers MTLArgumentBuffersTier2 unconditionally. Underneath, a bindless heap of mutable descriptors holds textures and samplers, and the translator rewrites buffer pointers inside argument buffers into 64-bit device addresses read from a table at a synthetic binding.",
    at: "plugin/NVMTLDevice.m:1597; plugin/nvmtl_vk.c:681, 758; translator/wrapper/src/buffer_addresses.rs",
    evidence: "none",
    proof: "No argument-buffer case in the 1.1.0 validation list.",
  },
  {
    feature: "Ray tracing",
    how: "emulated",
    vulkan: "VK_KHR_acceleration_structure, VK_KHR_ray_query",
    detail:
      "Metal's intersector maps onto ray queries, not onto Vulkan's ray-tracing pipelines. The patch's own header calls it software ray tracing: Mesa's shared builder writes lavapipe's BVH layout, traversal is shader code compiled into every ray-query shader, and \"No RT hardware is touched\". The translator gained a ray_query pass that upstream metal2vulkan does not have.",
    at: "plugin/NVMTLDevice.m:1520; nvk/nvk-macos.patch (nvk_acceleration_structure.c, nvk_nir_lower_ray_queries.c); translator/translator/src/passes/air_calls/ray_query.rs",
    evidence: "none",
    proof: "Not in the 1.1.0 validation list.",
  },
  {
    feature: "Mesh shaders",
    how: "emulated",
    vulkan: "none: compute dispatch, then an ordinary draw",
    detail:
      "No VK_EXT_mesh_shader. A draw ends the render pass, runs the mesh function as a compute kernel that writes vertices into a scratch buffer allocated per draw, resumes the pass, and draws those vertices with a generated vertex shader. Pipelines with no indirect variant refuse drawMeshThreadgroupsWithIndirectBuffer.",
    at: "plugin/NVMTLLibraryLoad.m:2448; translator/translator/src/mesh_lower.rs",
    evidence: "none",
    proof: "Not in the 1.1.0 validation list.",
  },
  {
    feature: "Metal Performance Shaders",
    how: "Apple's layer",
    vulkan: "compute pipelines from Apple's own metallibs",
    detail:
      "MPS ships its kernels as metallibs; they go through the same AIR to SPIR-V path as any app's. A hand-written convolution fast path lives in plugin/nvconv.metal.",
    at: "plugin/nvconv.metal; plugin/NVMTLLibraryLoad.m",
    evidence: "validated",
    proof: "Five MPS Gaussian blur runs, zero incorrect image components (RTX 5060, macOS 15.8.1).",
  },
  {
    feature: "Core Image",
    how: "Apple's layer",
    vulkan: "as MPS",
    detail: "Core Image filter graphs compile to Metal and run through the plugin like any other client.",
    at: "docs/CARD-SUPPORT.md:56",
    evidence: "validated",
    proof: "One Core Image filter graph, zero incorrect interior image components.",
  },
  {
    feature: "OpenGL",
    how: "Apple's layer",
    vulkan: "Apple's GL-on-Metal renderer",
    detail:
      "Once a display is armed, NVAccel sets IOGLBundleName to AppleMetalOpenGLRenderer, Apple's OpenGL implementation written on top of Metal. The plugin borrows that renderer's code generator to lower its shaders to AIR.",
    at: "kexts/NVRM/accel/nvrm-accel.cpp:332; plugin/NVMTLGL.m:10",
    evidence: "none",
    proof: "Not in the 1.1.0 validation list.",
  },
  {
    feature: "OpenCL",
    how: "Apple's layer",
    vulkan: "Apple's GL/CL layer over Metal",
    detail:
      "OpenCL kernels arrive the same way as GL ones, through Apple's AppleMetalOpenGLRenderer plugin. Reflection fixes for Geekbench's OpenCL build were made on 7 October after crash reports.",
    at: "plugin/NVMTLGL.m:217, 266",
    evidence: "user report",
    proof: "Issue #26: Geekbench lists the RTX 2080 Super as a GPU but offers only the Intel iGPU as an OpenCL device.",
  },
  {
    feature: "MetalFX",
    how: "no specific code",
    vulkan: "would run as ordinary Metal compute",
    detail:
      "The README says \"MetalFX path\". Nothing in plugin/ names MetalFX; if it works, it is because MetalFX is itself Metal code running on whatever device it is given.",
    at: "README.md:25",
    evidence: "none",
    proof: "Not in the 1.1.0 validation list.",
  },
  {
    feature: "H.264 / HEVC decode",
    how: "native",
    vulkan: "NVDEC, registered with VideoToolbox",
    detail:
      "The plugin registers its own VideoToolbox decoders and encoders for avc1 and HEVC at rating 1000 in every process except WindowServer.",
    at: "plugin/NVMTLDevice.m:174",
    evidence: "user report",
    proof: "Issue #24: a user measured 239 frames of 4K 10-bit HEVC decoded in 1.00 s with hardware decode on.",
  },
]

const HOW_COLOR: Record<How, string> = {
  native: "oklch(0.6 0.13 150)",
  emulated: "oklch(0.65 0.15 60)",
  "Apple's layer": "oklch(0.58 0.14 250)",
  "no specific code": "oklch(0.6 0.02 260)",
}

const EV_LABEL: Record<Evidence, string> = {
  validated: "checked by the project",
  "user report": "user report only",
  none: "not checked",
}

export function FeatureMatrix() {
  const [i, setI] = useState(2)
  const r = ROWS[i]
  const counts = {
    validated: ROWS.filter((x) => x.evidence === "validated").length,
    report: ROWS.filter((x) => x.evidence === "user report").length,
    none: ROWS.filter((x) => x.evidence === "none").length,
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="mr-auto font-mono text-xs text-muted-foreground">README claim → code → evidence</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {counts.validated} checked · {counts.report} user report · {counts.none} not checked
        </span>
      </div>

      <div className="grid gap-0 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <ul className="border-b sm:border-r sm:border-b-0" role="listbox" aria-label="Feature">
          {ROWS.map((row, k) => (
            <li key={row.feature}>
              <button
                type="button"
                role="option"
                aria-selected={k === i}
                onClick={() => setI(k)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-1.5 text-left text-sm transition-colors",
                  k === i ? "bg-muted/60 font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{row.feature}</span>
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      row.evidence === "validated"
                        ? "oklch(0.6 0.13 150)"
                        : row.evidence === "user report"
                          ? "oklch(0.65 0.15 60)"
                          : "oklch(0.6 0.02 260)",
                  }}
                />
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-3 px-4 py-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{r.feature}</span>
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[11px]"
              style={{ borderColor: HOW_COLOR[r.how], color: HOW_COLOR[r.how] }}
            >
              {r.how}
            </span>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {EV_LABEL[r.evidence]}
            </span>
          </div>
          <div className="font-mono text-xs">
            <span className="text-muted-foreground">Vulkan side:</span> {r.vulkan}
          </div>
          <p className="text-sm leading-relaxed">{r.detail}</p>
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Evidence.</span> {r.proof}
          </p>
          <div className="font-mono text-xs text-muted-foreground">{r.at}</div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Each feature the README lists, traced to where the repository implements it and to whether anything checked
        it. &quot;Checked by the project&quot; means it appears in docs/RELEASE-1.1.0.md, docs/CARD-SUPPORT.md or the
        1.1.0 VALIDATION.json.
      </figcaption>
    </figure>
  )
}
