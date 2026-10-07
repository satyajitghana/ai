"use client"

import { useMemo, useState } from "react"

// A small re-implementation of the sibling loop in Shaders' composer
// (packages/core/src/gpu/composer.ts, composeSiblings, at commit 935f71a), run
// over a layer stack you edit. It keeps the four rules that decide how many
// GPU passes a stack costs:
//
//   generator          evaluated inline at uv, blended over what is below
//   pointwise filter   replaces the composed colour with f(composed), inline
//   gather filter      requiresRTT: what is below is rendered to a texture first
//   sibling warp run   consecutive uvRemap leaves fold into one UV, one texture
//   warp around a gen  analytic push-down: the generator is evaluated at the
//                      folded UV, no texture at all
//
// The Blur entry follows std/effects/blurs.ts gaussianBlur: an RTT of the child,
// then a horizontal and a vertical compute pass at a fixed 1024 x 640
// (gpu/kit/blur.ts DEFAULT_COMPUTE_WIDTH/HEIGHT). Function names in the emitted
// text follow the composer's snapshots (blend_normal, textureSample(rtt_0, …),
// linearToSrgb(tone_linear(…))); bodies are abbreviated. Masks, boxes, layer
// transforms, blend modes other than normal and nesting beyond one warp are left out.

type Kind = "gradient" | "noise" | "tint" | "blur" | "pixelate" | "twirl" | "twirlGradient"

const KINDS: Record<Kind, { label: string; role: string; tone: string }> = {
  gradient: { label: "LinearGradient", role: "generator", tone: "oklch(0.66 0.14 250)" },
  noise: { label: "SimplexNoise", role: "generator", tone: "oklch(0.66 0.14 250)" },
  twirlGradient: { label: "Twirl ▸ LinearGradient", role: "warp wrapping a generator", tone: "oklch(0.66 0.14 250)" },
  tint: { label: "Tint", role: "pointwise filter", tone: "oklch(0.68 0.15 150)" },
  blur: { label: "Blur", role: "gather filter, compute-backed", tone: "oklch(0.66 0.19 25)" },
  pixelate: { label: "Pixelate", role: "gather filter", tone: "oklch(0.66 0.19 25)" },
  twirl: { label: "Twirl", role: "warp (sibling)", tone: "oklch(0.7 0.15 75)" },
}

const PRESETS: { name: string; layers: Kind[] }[] = [
  { name: "all pointwise", layers: ["gradient", "noise", "tint"] },
  { name: "blur in the middle", layers: ["gradient", "noise", "blur", "tint"] },
  { name: "two twirls in a row", layers: ["gradient", "noise", "twirl", "twirl"] },
  { name: "twirl nested", layers: ["twirlGradient", "noise", "tint"] },
]

// A 1440 x 900 CSS-pixel hero at the desktop DPR cap of 2 (utilities/device.ts).
const FW = 2880
const FH = 1800
const FRAME_PX = FW * FH
const BLUR_PX = 1024 * 640
// RTT format defaults to rgba16float (passManager.ts): 8 bytes a pixel.
const RTT_BYTES = FRAME_PX * 8

type Pass = { key: string; target: string; body: string }
type Plan = { rtt: Pass[]; compute: string[]; final: string; notes: string[] }

function gen(kind: Kind): string {
  if (kind === "gradient") return "linearGradient(uv)"
  if (kind === "noise") return "simplexNoise(uv)"
  return "linearGradient(twirlUV(uv))"
}

function plan(layers: Kind[]): Plan {
  const rtt: Pass[] = []
  const compute: string[] = []
  const notes: string[] = []
  let composed: string | undefined
  let n = 0
  for (let i = 0; i < layers.length; i++) {
    const k = layers[i]
    if (k === "gradient" || k === "noise" || k === "twirlGradient") {
      const e = gen(k)
      composed = composed === undefined ? e : `blend_normal(${composed}, ${e}, 1.0)`
      continue
    }
    if (composed === undefined) {
      notes.push(`${KINDS[k].label} has nothing below it and returns transparent black.`)
      composed = "vec4f(0.0)"
      continue
    }
    if (k === "tint") {
      composed = `tint(${composed})`
      continue
    }
    if (k === "twirl") {
      let uv = "twirlUV(uv)"
      let j = i
      while (j + 1 < layers.length && layers[j + 1] === "twirl") {
        j++
        uv = `twirlUV(${uv})`
      }
      if (j > i) notes.push(`${j - i + 1} twirls in a row fold into one UV and share one texture.`)
      const key = `rtt_${n++}`
      rtt.push({ key, target: key, body: `blend_normal(vec4f(0.0), ${composed}, 1.0)` })
      composed = `textureSample(${key}, linearClamp, ${uv})`
      i = j
      continue
    }
    const key = `rtt_${n++}`
    rtt.push({ key, target: key, body: `blend_normal(vec4f(0.0), ${composed}, 1.0)` })
    if (k === "blur") {
      compute.push(`blur H: ${key} → tmp_${key} (1024 x 640, 49 taps)`, `blur V: tmp_${key} → blur_${key} (1024 x 640, 49 taps)`)
      composed = `vec4f(textureSample(blur_${key}, linearClamp, uv).rgb, textureSample(${key}, linearClamp, uv).a)`
    } else {
      composed = `pixelate(${key}, linearClamp, uv)`
    }
  }
  const body = composed ?? "vec4f(0.0)"
  return {
    rtt,
    compute,
    final: `var composed_0 = ${body};\nreturn vec4f(linearToSrgb(tone_linear(composed_0.rgb)), composed_0.a);`,
    notes,
  }
}

const fmt = (x: number) => x.toLocaleString("en-US")

export function PassPlanner() {
  const [layers, setLayers] = useState<Kind[]>(PRESETS[1].layers)
  const p = useMemo(() => plan(layers), [layers])

  const renderPasses = p.rtt.length + 1
  const fragments = renderPasses * FRAME_PX
  const computePx = p.compute.length * BLUR_PX
  const memMB = (p.rtt.length * RTT_BYTES) / 1e6

  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= layers.length) return
    const next = layers.slice()
    const t = next[i]
    next[i] = next[j]
    next[j] = t
    setLayers(next)
  }

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      aria-label="Edit a Shaders layer stack and see how many GPU passes the composer turns it into"
    >
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="space-y-3 font-mono text-xs">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            stack, first child at the top
          </div>
          <ol className="space-y-1">
            {layers.map((k, i) => (
              <li key={`${k}-${i}`} className="flex items-center gap-1 rounded border bg-background/60 px-2 py-1">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KINDS[k].tone }} />
                <span className="min-w-0 flex-1 truncate" title={KINDS[k].role}>
                  {KINDS[k].label}
                </span>
                <button type="button" className="px-1 text-muted-foreground hover:text-foreground" onClick={() => move(i, -1)} aria-label={`move ${KINDS[k].label} up`}>
                  ↑
                </button>
                <button type="button" className="px-1 text-muted-foreground hover:text-foreground" onClick={() => move(i, 1)} aria-label={`move ${KINDS[k].label} down`}>
                  ↓
                </button>
                <button
                  type="button"
                  className="px-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setLayers(layers.filter((_, j) => j !== i))}
                  aria-label={`remove ${KINDS[k].label}`}
                >
                  ×
                </button>
              </li>
            ))}
            {layers.length === 0 && <li className="text-muted-foreground">empty: add a layer</li>}
          </ol>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                disabled={layers.length >= 7}
                onClick={() => setLayers([...layers, k])}
                className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40"
                title={KINDS[k].role}
              >
                + {KINDS[k].label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {PRESETS.map((pr) => (
              <button
                key={pr.name}
                type="button"
                onClick={() => setLayers(pr.layers)}
                className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {pr.name}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-2 font-mono text-[11px]">
          {p.compute.length > 0 || p.rtt.length > 0 ? null : (
            <div className="text-muted-foreground">No texture boundary: the whole stack is one fragment function.</div>
          )}
          {p.rtt.map((r, i) => (
            <div key={r.key} className="rounded border border-dashed px-2 py-1.5">
              <div className="mb-1 text-muted-foreground">
                pass {i + 1}: render to {r.target} (rgba16float)
              </div>
              <pre className="whitespace-pre-wrap break-all text-foreground">{`return ${r.body};`}</pre>
            </div>
          ))}
          {p.compute.map((c) => (
            <div key={c} className="rounded border border-dotted px-2 py-1 text-muted-foreground">
              compute: {c}
            </div>
          ))}
          <div className="rounded border px-2 py-1.5">
            <div className="mb-1 text-muted-foreground">pass {p.rtt.length + 1}: final, to the canvas</div>
            <pre className="whitespace-pre-wrap break-all text-foreground">{p.final}</pre>
          </div>
          {p.notes.map((t) => (
            <div key={t} className="text-muted-foreground">
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-[11px] tabular-nums text-muted-foreground">
        <span>render passes per frame</span>
        <span className="text-right text-foreground">{renderPasses}</span>
        <span>compute dispatches per frame</span>
        <span className="text-right text-foreground">{p.compute.length}</span>
        <span>fragment invocations, 1440 x 900 hero at DPR 2</span>
        <span className="text-right text-foreground">{fmt(fragments)}</span>
        <span>compute pixels (fixed, any canvas size)</span>
        <span className="text-right text-foreground">{fmt(computePx)}</span>
        <span>intermediate textures, full-frame</span>
        <span className="text-right text-foreground">
          {p.rtt.length} ({memMB.toFixed(1)} MB)
        </span>
      </div>
    </figure>
  )
}
