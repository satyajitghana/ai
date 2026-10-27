"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The page ships a shim that rewrites WGSL storage-texture formats to core
// formats on devices without the texture-formats-tier1 feature. The format map
// and the regular expression below are copied from that script (game.html
// "[notier1]"); the three shaders are mine and synthetic, not the game's.

const MAP: Record<string, string> = {
  r8unorm: "r32float", rg8unorm: "rg32float", r8snorm: "r32float", rg8snorm: "rg32float",
  r8uint: "r32uint", rg8uint: "rg32uint", r8sint: "r32sint", rg8sint: "rg32sint",
  r16uint: "r32uint", r16sint: "r32sint", rg16uint: "rg32uint", rg16sint: "rg32sint",
  r16float: "r32float", rg16float: "rg32float", rgb10a2unorm: "rgba16float", rgb10a2uint: "rgba16uint",
  rg11b10ufloat: "rgba16float", r16unorm: "r32float", r16snorm: "r32float",
  rg16unorm: "rgba16float", rg16snorm: "rgba16float", rgba16unorm: "rgba16float", rgba16snorm: "rgba16float",
}

const RE = /texture_storage_(1d|2d|2d_array|3d)\s*<\s*([a-z0-9]+)\s*,/g

const SAMPLES: { id: string; title: string; code: string }[] = [
  {
    id: "hdr",
    title: "HDR colour target",
    code: `@group(0) @binding(0) var hdr : texture_storage_2d<rg11b10ufloat, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  textureStore(hdr, id.xy, vec4<f32>(0.2, 0.4, 0.8, 1.0));
}`,
  },
  {
    id: "mask",
    title: "Mask and depth helper",
    code: `@group(0) @binding(0) var mask  : texture_storage_2d<r8unorm, write>;
@group(0) @binding(1) var depth : texture_storage_2d_array<r16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  textureStore(mask, id.xy, vec4<f32>(1.0));
  textureStore(depth, id.xy, 0, vec4<f32>(0.5));
}`,
  },
  {
    id: "core",
    title: "Already a core format",
    code: `@group(0) @binding(0) var out : texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  textureStore(out, id.xy, vec4<f32>(1.0));
}`,
  },
]

function rewrite(code: string) {
  let n = 0
  const out = code.replace(RE, (m: string, dim: string, f: string) => {
    if (MAP[f]) {
      n += 1
      return `texture_storage_${dim}<${MAP[f]},`
    }
    return m
  })
  return { out, n }
}

export function Tier1Rewriter() {
  const [id, setId] = useState("hdr")
  const [has, setHas] = useState(false)
  const s = SAMPLES.find((x) => x.id === id) ?? SAMPLES[0]
  const r = has ? { out: s.code, n: 0 } : rewrite(s.code)
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">The storage-format shim, run on synthetic shaders</div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        {SAMPLES.map((x) => (
          <button key={x.id} type="button" onClick={() => setId(x.id)} className={cn("rounded-full border px-3 py-1 text-xs", id === x.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>{x.title}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs">
          <input type="checkbox" checked={has} onChange={(e) => setHas(e.target.checked)} />
          device has texture-formats-tier1
        </label>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="p-4">
          <div className="mb-1 text-xs font-medium text-muted-foreground">As the engine would submit it</div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-5"><code>{s.code}</code></pre>
        </div>
        <div className="p-4">
          <div className="mb-1 text-xs font-medium text-muted-foreground">{has ? "Untouched: the device has the feature" : `After the shim: ${r.n} declaration${r.n === 1 ? "" : "s"} rewritten`}</div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-5"><code>{r.out}</code></pre>
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        The map has {Object.keys(MAP).length} entries (measured by counting the object in the page&apos;s script). Channel counts survive: one- and two-channel 8/16-bit formats become r32*/rg32*, packed and four-channel 16-bit unorm/snorm formats become rgba16*. Only the declared format changes, because textureStore and textureLoad take a vec4 for every format. The three shaders are mine, written to exercise the page&apos;s regular expression.
      </p>
    </div>
  )
}
