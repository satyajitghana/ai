// The deck's shared type scale. A scene that has nothing special to do with its headline calls
// `titles(g, s, def, opts)`: the current beat's head arrives word by word, its source line fades
// in under it, and the previous beat's pair leaves first. Scenes with their own staging (the
// template, the clock) draw their own, but use the same sizes.

import type { SceneDef } from "../script"
import { clamp, E } from "./ease"
import type { FontKey, Type2D } from "./text"
import type { State } from "./types"

// Headlines 76 to 112, sources 28 to 36, on the 1920×1080 stage.
export const TYPE = { head: 100, sub: 29, x: 124, y: 214, gap: 66 }

export type TitleOpts = {
  color?: string
  x?: number
  y?: number
  align?: "left" | "center" | "right"
  font?: FontKey
  size?: number
  italic?: boolean
  /** Seconds into a beat at which its headline starts to arrive (per beat, or one for all). */
  delay?: number | number[]
  shadow?: string
  /** Replace the on-screen text of some beats (the script's `head` is the default). */
  heads?: (string | null | undefined)[]
  subs?: (string | null | undefined)[]
  /** Beats to skip (the scene draws those itself). */
  skip?: number[]
  style?: "rise" | "blur" | "slam" | "fade" | "drop"
  subAlpha?: number
  maxLine?: number
}

/** Break a headline into lines of at most `max` characters, on spaces. */
export function wrap(str: string, max: number) {
  const out: string[] = []
  let line = ""
  for (const w of str.split(" ")) {
    if (line && (line + " " + w).length > max) {
      out.push(line)
      line = w
    } else line = line ? line + " " + w : w
  }
  if (line) out.push(line)
  return out.join("\n")
}

export function titles(g: Type2D, s: State, def: SceneDef, o: TitleOpts = {}) {
  const x = o.x ?? TYPE.x
  const y = o.y ?? TYPE.y
  const size = o.size ?? TYPE.head
  const color = o.color ?? "#ffffff"
  const shadow = o.shadow ? { color: o.shadow, blur: 28 } : undefined
  const draw = (b: number, pIn: number, alpha: number) => {
    if (o.skip?.includes(b) || alpha <= 0) return
    const beat = def.beats[b]
    const head = wrap(o.heads?.[b] ?? beat.head, o.maxLine ?? 30)
    const lines = head.split("\n").length
    g.text(head, x, y, { size, font: o.font ?? "serif", italic: o.italic, color, align: o.align, by: "word", style: o.style ?? "rise", p: pIn, alpha, lh: 1.02, shadow, track: -0.01 })
    const sub = o.subs?.[b] === null ? null : (o.subs?.[b] ?? beat.sub)
    if (sub) g.text(sub, x + (o.align === "right" ? -4 : o.align === "center" ? 0 : 4), y + (lines - 1) * size * 1.02 + TYPE.gap, { size: TYPE.sub, font: "mono", color, align: o.align, style: "blur", by: "line", p: clamp(pIn * 2.2 - 1.1), alpha: alpha * (o.subAlpha ?? 0.78), shadow, track: 0.01 })
  }
  const b = s.beat
  const d = Array.isArray(o.delay) ? (o.delay[b] ?? 0.3) : (o.delay ?? 0.3)
  // the previous pair leaves in the first 0.4 s of a new beat
  if (b > 0 && s.t < 0.4) draw(b - 1, 1, 1 - E.out2(clamp(s.t / 0.4)))
  draw(b, clamp((s.t - d) / 1.5), (1 - s.exit * 1.5 < 0 ? 0 : 1 - s.exit * 1.5))
}
