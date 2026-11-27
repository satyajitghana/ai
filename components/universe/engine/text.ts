// Type as performance. Each scene has one Canvas 2D layer in a 1920×1080 design space. A scene
// describes its type every frame in immediate mode (`g.text(...)`, `g.rect(...)`), with a progress
// value per call; the layer keeps a signature of the calls and only repaints and re-uploads the
// texture when something actually moved. Text can arrive by glyph, word or line, be typed with a
// caret, and be deleted again, because every call is a pure function of the beat clock.

import * as THREE from "three/webgpu"

import { clamp, E, type Ease } from "./ease"

export const DW = 1920
export const DH = 1080

export type FontKey = "sans" | "serif" | "mono" | "tall" | "arial" | "fell" | "typer"
export type FontMap = Record<FontKey, string>

export type TextOpts = {
  size: number
  font?: FontKey
  weight?: number | string
  italic?: boolean
  color?: string
  align?: "left" | "center" | "right"
  /** Letter spacing in em. */
  track?: number
  /** Line height as a multiple of size. */
  lh?: number
  alpha?: number
  /** Arrival progress 0..1 (default 1 = fully shown). */
  p?: number
  /** How units arrive. `type` shows whole glyphs in order with a caret. */
  style?: "rise" | "fade" | "type" | "slam" | "drop" | "blur" | "none"
  by?: "glyph" | "word" | "line"
  /** Fraction of the total time each unit is offset from the previous one. */
  stagger?: number
  ease?: Ease
  rot?: number
  caret?: boolean
  shadow?: { color: string; blur: number; y?: number }
}

type Unit = { s: string; x: number; line: number; w: number }
type Layout = { units: Unit[]; widths: number[]; lines: number }

const r2 = (n: number) => Math.round(n * 100) / 100

export class Type2D {
  readonly canvas: HTMLCanvasElement
  readonly c: CanvasRenderingContext2D
  readonly tex: THREE.CanvasTexture
  private ops: (() => void)[] = []
  private sig: string[] = []
  private last = ""
  private cache = new Map<string, Layout>()
  private scale = 1
  private xf: [number, number, number, number, number] | null = null
  private rotv = 0
  empty = true

  constructor(private fonts: FontMap) {
    this.canvas = document.createElement("canvas")
    this.canvas.width = 16
    this.canvas.height = 9
    this.c = this.canvas.getContext("2d")!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.NoColorSpace
    this.tex.generateMipmaps = false
    this.tex.minFilter = THREE.LinearFilter
    this.tex.premultiplyAlpha = true
  }

  /** A face arrived after type was measured with its fallback: forget the layouts and draw again. */
  refont() {
    this.cache.clear()
    this.last = "?"
  }

  resize(w: number, h: number) {
    if (this.canvas.width === w && this.canvas.height === h) return
    this.canvas.width = w
    this.canvas.height = h
    this.scale = w / DW
    this.last = "?"
    this.tex.dispose()
  }

  css(o: Pick<TextOpts, "size" | "font" | "weight" | "italic">) {
    const fam = this.fonts[o.font ?? "sans"]
    return `${o.italic ? "italic " : ""}${o.weight ?? 400} ${o.size}px ${fam}`
  }

  begin() {
    this.ops.length = 0
    this.sig.length = 0
    this.xf = null
  }

  /**
   * Zoom everything issued after this call: design point (x, y) is drawn at (sx, sy), scaled by z.
   * Canvas 2D re-rasterizes vector type at any zoom, so a 200× push-in stays sharp. `null` resets.
   */
  view(v: { x: number; y: number; z: number; sx?: number; sy?: number; rot?: number } | null) {
    this.xf = v ? [v.x, v.y, v.z, v.sx ?? v.x, v.sy ?? v.y] : null
    this.rotv = v?.rot ?? 0
    this.sig.push(v ? `v${r2(v.x)},${r2(v.y)},${Math.round(v.z * 1000)},${r2(v.sx ?? 0)},${r2(v.sy ?? 0)},${r2((v.rot ?? 0) * 1000)}` : "v0")
  }

  private push(op: () => void) {
    const xf = this.xf
    const rot = this.rotv
    if (!xf) this.ops.push(op)
    else
      this.ops.push(() => {
        const c = this.c
        c.translate(xf[3], xf[4])
        if (rot) c.rotate(rot)
        c.scale(xf[2], xf[2])
        c.translate(-xf[0], -xf[1])
        op()
      })
  }

  /** Repaint if anything changed. Returns true when the texture was updated. */
  flush(): boolean {
    const sig = this.sig.join("|")
    if (sig === this.last) return false
    this.last = sig
    const c = this.c
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, this.canvas.width, this.canvas.height)
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    for (const op of this.ops) {
      c.save()
      op()
      c.restore()
    }
    this.empty = this.ops.length === 0
    this.tex.needsUpdate = true
    return true
  }

  private layout(str: string, o: TextOpts): Layout {
    const by = o.by ?? "glyph"
    const key = `${this.css(o)}|${o.track ?? 0}|${by}|${str}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const c = this.c
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.font = this.css(o)
    const track = (o.track ?? 0) * o.size
    const units: Unit[] = []
    const widths: number[] = []
    str.split("\n").forEach((ln, line) => {
      // Advance by measuring prefixes, so kerning pairs stay intact however the line is split.
      const chars = [...ln]
      const adv = (n: number) => c.measureText(chars.slice(0, n).join("")).width + track * n
      if (by === "line") {
        units.push({ s: ln, x: 0, line, w: adv(chars.length) })
      } else if (by === "word") {
        let i = 0
        while (i < chars.length) {
          if (chars[i] === " ") {
            i++
            continue
          }
          let j = i
          while (j < chars.length && chars[j] !== " ") j++
          units.push({ s: chars.slice(i, j).join(""), x: adv(i), line, w: adv(j) - adv(i) })
          i = j
        }
      } else {
        for (let i = 0; i < chars.length; i++) units.push({ s: chars[i], x: adv(i), line, w: adv(i + 1) - adv(i) })
      }
      widths.push(adv(chars.length))
    })
    c.restore()
    const out = { units, widths, lines: widths.length }
    if (this.cache.size > 600) this.cache.clear()
    this.cache.set(key, out)
    return out
  }

  measure(str: string, o: TextOpts) {
    return Math.max(...this.layout(str, { ...o, by: "line" }).widths)
  }

  /** Draw text at a design-space anchor; `y` is the first line's alphabetic baseline. */
  text(str: string, x: number, y: number, o: TextOpts) {
    const alpha = o.alpha ?? 1
    const p = clamp(o.p ?? 1)
    if (alpha <= 0.003 || (p <= 0 && o.style !== "none") || !str) return
    this.sig.push(`t${str}${r2(x)},${r2(y)},${o.size},${o.font},${o.weight},${o.color},${r2(alpha)},${r2(p * 500)},${o.style},${r2(o.rot ?? 0)}`)
    this.push(() => this.paint(str, x, y, o, alpha, p))
  }

  private paint(str: string, x: number, y: number, o: TextOpts, alpha: number, p: number) {
    const c = this.c
    const L = this.layout(str, o)
    const style = o.style ?? "rise"
    const ease = o.ease ?? E.out4
    const lh = (o.lh ?? 1.12) * o.size
    const track = (o.track ?? 0) * o.size
    const n = L.units.length
    const stag = o.stagger ?? (o.by === "line" ? 0.5 : o.by === "word" ? 0.3 : 0.06)
    const span = 1 + stag * Math.max(0, n - 1)
    c.font = this.css(o)
    c.fillStyle = o.color ?? "#fff"
    c.textBaseline = "alphabetic"
    if (track) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${track}px`
    if (o.shadow) {
      c.shadowColor = o.shadow.color
      c.shadowBlur = o.shadow.blur * this.scale
      c.shadowOffsetY = (o.shadow.y ?? 0) * this.scale
    }
    if (o.rot) {
      c.translate(x, y)
      c.rotate(o.rot)
      c.translate(-x, -y)
    }
    const shown = style === "type" ? Math.floor(p * n + 1e-6) : n
    let caretX = x
    let caretY = y
    for (let i = 0; i < n; i++) {
      const u = L.units[i]
      const lw = L.widths[u.line]
      const ox = o.align === "center" ? -lw / 2 : o.align === "right" ? -lw : 0
      const ux = x + ox + u.x
      const uy = y + u.line * lh
      if (style === "type") {
        if (i >= shown) break
        c.globalAlpha = alpha
        c.fillText(u.s, ux, uy)
        caretX = ux + u.w
        caretY = uy
        continue
      }
      const q = style === "none" ? 1 : ease(clamp(p * span - stag * i))
      if (q <= 0) continue
      let dx = 0
      let dy = 0
      let sc = 1
      let a = alpha
      let masked = false
      if (style === "rise") {
        // a masked rise: the unit comes up from behind the bottom of its own line box
        dy = (1 - q) * o.size * 1.15
        masked = q < 0.999
      } else if (style === "drop") {
        dy = -(1 - q) * o.size * 0.9
        a = alpha * Math.min(1, q * 1.6)
      } else if (style === "fade") a = alpha * q
      else if (style === "slam") {
        sc = 1 + (1 - q) * 1.4
        a = alpha * Math.min(1, q * 3)
      } else if (style === "blur") {
        dx = (1 - q) * o.size * 0.12
        a = alpha * Math.min(1, q * 1.4)
        c.filter = q < 0.98 ? `blur(${r2((1 - q) * o.size * 0.28 * this.scale)}px)` : "none"
      }
      c.globalAlpha = a
      if (masked) {
        c.save()
        c.beginPath()
        c.rect(ux - o.size * 0.2, uy - o.size * 0.98, u.w + o.size * 0.4, o.size * 1.3)
        c.clip()
        c.fillText(u.s, ux, uy + dy)
        c.restore()
      } else if (sc !== 1) {
        const cx = ux + u.w / 2
        const cy = uy - o.size * 0.35
        c.save()
        c.translate(cx, cy)
        c.scale(sc, sc)
        c.fillText(u.s, -u.w / 2, o.size * 0.35)
        c.restore()
      } else c.fillText(u.s, ux + dx, uy + dy)
    }
    if (style === "type" && o.caret !== false && n > 0) {
      if (shown === 0) {
        const lw = L.widths[0]
        caretX = x + (o.align === "center" ? -lw / 2 : o.align === "right" ? -lw : 0)
      }
      c.globalAlpha = alpha
      c.fillRect(caretX + o.size * 0.04, caretY - o.size * 0.82, Math.max(2, o.size * 0.045), o.size * 1.02)
    }
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number; alpha?: number; r?: number }) {
    const alpha = o.alpha ?? 1
    if (alpha <= 0.003) return
    this.sig.push(`r${r2(x)},${r2(y)},${r2(w)},${r2(h)},${o.fill},${o.stroke},${r2(alpha)}`)
    this.push(() => {
      const c = this.c
      c.globalAlpha = alpha
      c.beginPath()
      if (o.r) c.roundRect(x, y, w, h, o.r)
      else c.rect(x, y, w, h)
      if (o.fill) {
        c.fillStyle = o.fill
        c.fill()
      }
      if (o.stroke) {
        c.strokeStyle = o.stroke
        c.lineWidth = o.lw ?? 2
        c.stroke()
      }
    })
  }

  line(x1: number, y1: number, x2: number, y2: number, o: { color: string; lw?: number; alpha?: number; dash?: number[] }) {
    const alpha = o.alpha ?? 1
    if (alpha <= 0.003) return
    this.sig.push(`l${r2(x1)},${r2(y1)},${r2(x2)},${r2(y2)},${o.color},${r2(alpha)}`)
    this.push(() => {
      const c = this.c
      c.globalAlpha = alpha
      c.strokeStyle = o.color
      c.lineWidth = o.lw ?? 2
      if (o.dash) c.setLineDash(o.dash)
      c.beginPath()
      c.moveTo(x1, y1)
      c.lineTo(x2, y2)
      c.stroke()
    })
  }

  /** A slide-editor selection box: thin blue frame with eight handles and a rotate stalk. */
  selbox(x: number, y: number, w: number, h: number, alpha = 1, color = "#2f6bff") {
    if (alpha <= 0.003) return
    this.sig.push(`s${r2(x)},${r2(y)},${r2(w)},${r2(h)},${r2(alpha)}`)
    this.push(() => {
      const c = this.c
      c.globalAlpha = alpha
      c.strokeStyle = color
      c.lineWidth = 2
      c.strokeRect(x, y, w, h)
      c.beginPath()
      c.moveTo(x + w / 2, y)
      c.lineTo(x + w / 2, y - 26)
      c.stroke()
      c.fillStyle = "#fff"
      const hs: [number, number][] = [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]
      for (const [u, v] of hs) {
        c.beginPath()
        c.arc(x + u * w, y + v * h, 6, 0, Math.PI * 2)
        c.fill()
        c.stroke()
      }
      c.beginPath()
      c.arc(x + w / 2, y - 26, 6, 0, Math.PI * 2)
      c.fill()
      c.stroke()
    })
  }

  /** Anything else. `key` must change whenever the drawing would. */
  custom(key: string, fn: (c: CanvasRenderingContext2D) => void) {
    this.sig.push(`c${key}`)
    this.push(() => fn(this.c))
  }

  dispose() {
    this.tex.dispose()
  }
}

/** Progress helpers for typed text: type in over [a,b], hold, delete over [c,d]. Returns 0..1 shown. */
export function typed(t: number, a: number, b: number, c = Infinity, d = Infinity) {
  if (t < a) return 0
  if (t < b) return (t - a) / (b - a)
  if (t < c) return 1
  if (t < d) return 1 - (t - c) / (d - c)
  return 0
}
