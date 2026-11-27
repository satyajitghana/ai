// The deck's own vocabulary, shared so it looks the same wherever it turns up: the reviewer's
// comment bubble (it types, holds, and deletes itself) and the ripple field that four scenes share.

import { Fn, vec2, vec3 } from "three/tsl"

import { clamp, E } from "./ease"
import type { Type2D } from "./text"
import { fbm, fbm3, sat, type V2, type V3 } from "./tsl"

export const SELECT = "#2f6bff"

/**
 * The reviewer's comment: a pale yellow note with a small header, pointing at (x, y).
 * `t` is seconds on the caller's clock; it pops in at `t0`, types `text` at `cps`, and if `out`
 * is given deletes itself from there. Returns the number of characters shown (for key cues).
 */
export function comment(g: Type2D, text: string, x: number, y: number, t: number, o: { t0: number; out?: number; cps?: number; w?: number; side?: "left" | "right"; who?: string } ) {
  const cps = o.cps ?? 19
  const dt = t - o.t0
  if (dt < 0) return 0
  const typeEnd = 0.25 + text.length / cps
  let n = Math.floor(clamp((dt - 0.25) / (typeEnd - 0.25)) * text.length + 1e-6)
  let alpha = 1
  if (o.out !== undefined && t > o.out) {
    const d = t - o.out
    n = Math.max(0, text.length - Math.floor(d * 34))
    alpha = n > 0 ? 1 : 1 - clamp((d - text.length / 34) / 0.18)
  }
  if (alpha <= 0) return 0
  const pop = E.outBack(clamp(dt / 0.22))
  const w = o.w ?? Math.max(300, g.measure(text, { size: 30, font: "arial" }) + 56)
  const h = 104
  const bx = o.side === "left" ? x - w - 26 : x + 26
  const by = y - h - 18
  g.custom(`cm${Math.round(pop * 100)},${Math.round(alpha * 100)},${bx},${by},${w}`, (c) => {
    c.globalAlpha = alpha
    c.translate(x, y)
    c.scale(pop, pop)
    c.translate(-x, -y)
    c.shadowColor = "rgba(40,50,80,0.28)"
    c.shadowBlur = 22
    c.shadowOffsetY = 8
    c.fillStyle = "#fff6c4"
    c.beginPath()
    c.roundRect(bx, by, w, h, 6)
    c.fill()
    c.shadowColor = "transparent"
    c.beginPath()
    if (o.side === "left") {
      c.moveTo(bx + w - 2, by + h - 30)
      c.lineTo(x - 4, y - 4)
      c.lineTo(bx + w - 2, by + h - 8)
    } else {
      c.moveTo(bx + 2, by + h - 30)
      c.lineTo(x + 4, y - 4)
      c.lineTo(bx + 2, by + h - 8)
    }
    c.fill()
    c.fillStyle = "#e2b100"
    c.fillRect(bx, by, w, 5)
  })
  g.text(o.who ?? "Reviewer", bx + 24, by + 36, { size: 18, font: "arial", weight: 700, color: "#8a6d00", style: "none", alpha: alpha * pop })
  g.text(text.slice(0, n), bx + 24, by + 78, { size: 30, font: "arial", color: "#1c1c1c", style: "none", alpha })
  // caret: solid while typing, blinking once idle
  const idle = dt > typeEnd + 0.4 && (o.out === undefined || t < o.out)
  if (!idle || Math.sin(t * 9) > -0.4) {
    const cx = bx + 24 + g.measure(text.slice(0, n) || " ", { size: 30, font: "arial" }) * (n ? 1 : 0)
    g.rect(cx + 3, by + 52, 2.5, 32, { fill: "#1c1c1c", alpha })
  }
  return n
}

/**
 * The ripples: one seeded field, drawn at the end of inflation and met again as the blotches on
 * the microwave plate, the web the first stars light along and the clumps the galaxy forms from.
 * `ripples(p)` is roughly 0..1 with its mean near 0.5; p in units of about one blotch.
 */
export const ripples = /*@__PURE__*/ Fn(([p_]: [V2]) => {
  const p = p_.add(vec2(13.1, 7.7)).toVar()
  const a = fbm(p.mul(1.3)).toVar()
  const b = fbm(p.mul(2.9).add(a.mul(1.7)).add(4.2))
  return sat(a.sub(0.47).mul(1.5).add(b.sub(0.47).mul(0.9)).add(0.5))
}).setLayout({ name: "ripples", type: "float", inputs: [{ name: "p", type: "vec2" }] })

export const ripples3 = /*@__PURE__*/ Fn(([p_]: [V3]) => {
  const p = p_.add(vec3(13.1, 7.7, 3.3)).toVar()
  const a = fbm3(p.mul(1.3)).toVar()
  const b = fbm3(p.mul(2.9).add(a.mul(1.7)).add(4.2))
  return sat(a.sub(0.47).mul(1.5).add(b.sub(0.47).mul(0.9)).add(0.5))
}).setLayout({ name: "ripples3", type: "float", inputs: [{ name: "p", type: "vec3" }] })

/**
 * How the end of inflation frames the ripples, so the scenes that meet them again can draw the
 * same blotches: p = (uv - .5) * vec2(aspect, 1) * RIPPLE_VIEW, with uv origin bottom-left.
 */
export const RIPPLE_VIEW = 3.0
