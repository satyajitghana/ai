// A placeholder scene: a flat colour and the beat's own line. Used while a scene is being built.
// It is also the smallest complete example of the TSL contract: a target, a pass built from a
// TSL node with a uniform bag, `warm()` so the engine can compile it ahead of time, and `finish`.
import * as THREE from "three/webgpu"
import { uniform, vec4 } from "three/tsl"

import { DW } from "../engine/text"
import type { Ctx, SceneInstance } from "../engine/types"

export function create(ctx: Ctx): SceneInstance {
  const hdr = ctx.target({})
  const hue = (ctx.def.id.length * 0.137 + ctx.def.id.charCodeAt(0) * 0.071) % 1
  const uCol = uniform(new THREE.Color().setHSL(hue, 0.35, 0.12, THREE.LinearSRGBColorSpace))
  const bg = ctx.pass(({ uv }) => vec4(uCol.mul(uv.y.add(0.6)), 1), { uCol })
  return {
    warm: () => [{ pass: bg, target: hdr }],
    render() {
      bg.render(hdr)
      ctx.finish(hdr.texture, { tone: "none" })
    },
    type(g, s) {
      const b = ctx.def.beats[s.beat]
      g.text(b.head, DW / 2, 520, { size: 64, font: "serif", align: "center", by: "word", p: s.k(s.beat, 0, 1.2) })
      if (b.sub) g.text(b.sub, DW / 2, 600, { size: 26, font: "mono", align: "center", style: "fade", by: "line", p: s.k(s.beat, 0.6, 1.4), alpha: 0.7 })
    },
  }
}
