// A small WebGL2 scene for the neuron map: every layer is a translucent slab, every MLP neuron a
// point on it (index order: row-major on a COLS x ROWS grid), glowing lines for connections.
// Client only. No dependencies: the camera, the matrices and the picking are written here.
// Plain Math is fine in this file: nothing computed here is serialised into server-rendered markup.

export type Kind = "match" | "match2" | "sel" | "up" | "down" | "fed" | "feeds" | "dim"

export interface SceneOptions {
  layers: number
  neurons: number
  cols: number
  rows: number
  onPick: (layer: number, neuron: number) => void
  onHover: (hit: { layer: number; neuron: number; x: number; y: number } | null) => void
  onCamera?: () => void
  reducedMotion: boolean
}

export interface Palette {
  light: boolean
  dot: [number, number, number]
  top: [number, number, number]
  match: [number, number, number]
  match2: [number, number, number]
  sel: [number, number, number]
  up: [number, number, number]
  down: [number, number, number]
  fed: [number, number, number]
  feeds: [number, number, number]
  plane: [number, number, number]
}

export const DARK: Palette = {
  light: false,
  dot: [0.62, 0.7, 0.82],
  top: [0.82, 0.88, 0.97],
  match: [1.0, 0.72, 0.28],
  match2: [1.0, 0.42, 0.7],
  sel: [1, 1, 1],
  up: [1.0, 0.68, 0.25],
  down: [0.7, 0.58, 1.0],
  fed: [1.0, 0.45, 0.72],
  feeds: [0.42, 0.85, 1.0],
  plane: [0.7, 0.8, 0.95],
}

export const LIGHT: Palette = {
  light: true,
  dot: [0.3, 0.36, 0.5],
  top: [0.15, 0.2, 0.32],
  match: [0.86, 0.45, 0.0],
  match2: [0.82, 0.12, 0.45],
  sel: [0.05, 0.05, 0.1],
  up: [0.86, 0.45, 0.0],
  down: [0.45, 0.25, 0.85],
  fed: [0.82, 0.12, 0.45],
  feeds: [0.0, 0.5, 0.75],
  plane: [0.25, 0.35, 0.55],
}

type Mat = Float32Array

const mul = (a: Mat, b: Mat): Mat => {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
const persp = (fovy: number, asp: number, n: number, f: number): Mat => {
  const t = 1 / Math.tan(fovy / 2)
  const o = new Float32Array(16)
  o[0] = t / asp
  o[5] = t
  o[10] = (f + n) / (n - f)
  o[11] = -1
  o[14] = (2 * f * n) / (n - f)
  return o
}
const lookAt = (e: number[], c: number[], up: number[]): Mat => {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]
  const zl = Math.hypot(zx, zy, zz) || 1
  zx /= zl; zy /= zl; zz /= zl
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx
  const xl = Math.hypot(xx, xy, xz) || 1
  xx /= xl; xy /= xl; xz /= xl
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx
  const o = new Float32Array(16)
  o[0] = xx; o[1] = yx; o[2] = zx
  o[4] = xy; o[5] = yy; o[6] = zy
  o[8] = xz; o[9] = yz; o[10] = zz
  o[12] = -(xx * e[0] + xy * e[1] + xz * e[2])
  o[13] = -(yx * e[0] + yy * e[1] + yz * e[2])
  o[14] = -(zx * e[0] + zy * e[1] + zz * e[2])
  o[15] = 1
  return o
}

const VS_POINTS = `#version 300 es
in vec3 aPos; in vec4 aCol; in float aSize;
uniform mat4 uVP; uniform float uScale;
out vec4 vCol;
void main(){
  vec4 p = uVP * vec4(aPos, 1.0);
  gl_Position = p;
  gl_PointSize = aSize * uScale * clamp(13.0 / max(p.w, 0.5), 0.6, 3.4);
  vCol = aCol;
}`
const FS_POINTS = `#version 300 es
precision mediump float;
in vec4 vCol; out vec4 o;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0; float d = dot(c, c);
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.25, d);
  o = vec4(vCol.rgb, vCol.a * a);
}`
const VS_FLAT = `#version 300 es
in vec3 aPos; in vec4 aCol;
uniform mat4 uVP;
out vec4 vCol;
void main(){ gl_Position = uVP * vec4(aPos, 1.0); vCol = aCol; }`
const FS_FLAT = `#version 300 es
precision mediump float;
in vec4 vCol; out vec4 o;
void main(){ o = vCol; }`

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (t: number, src: string) => {
    const s = gl.createShader(t)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader")
    return s
  }
  const p = gl.createProgram()!
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs))
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link")
  return p
}

export interface Style {
  layer: number
  neuron: number
  kind: Kind
}
export interface EdgeLine {
  a: [number, number]
  b: [number, number]
  kind: "feeds" | "fed"
  w: number
}

export class NeuronScene {
  readonly gl: WebGL2RenderingContext
  private opts: SceneOptions
  private pal: Palette = DARK
  private nPoints: number
  private pos: Float32Array
  private col: Uint8Array
  private size: Float32Array
  private base: Float32Array // 0 dim, 1 "top" neuron of its layer
  private styles = new Map<number, Kind>()
  private progP: WebGLProgram
  private flatP: WebGLProgram
  private bufPos: WebGLBuffer
  private bufCol: WebGLBuffer
  private bufSize: WebGLBuffer
  private vaoPts: WebGLVertexArrayObject
  private planeBuf: WebGLBuffer
  private planeCol: WebGLBuffer
  private planeVao: WebGLVertexArrayObject
  private planeFillVerts = 0
  private planeLineVerts = 0
  private lineBuf: WebGLBuffer
  private lineCol: WebGLBuffer
  private lineVao: WebGLVertexArrayObject
  private lineVerts = 0
  private lineAlpha = 1
  private dirty = true
  private raf = 0
  private destroyed = false
  private selectedLayer = 0
  private selected: { layer: number; neuron: number } | null = null
  private dim = 1
  // camera
  yaw = 0.78
  pitch = 0.3
  dist = 15
  target = [10, 0, 0]
  private tween: null | { from: number[]; to: number[]; t0: number; ms: number } = null
  private vp: Mat = new Float32Array(16)
  private W = 1
  private H = 1
  private dpr = 1
  private pointers = new Map<number, { x: number; y: number }>()
  private dragMoved = 0
  private lastPinch = 0
  private hoverRaf = 0
  private pendingHover: { x: number; y: number } | null = null
  readonly spacing = 1.25
  readonly cell = 0.075

  constructor(private canvas: HTMLCanvasElement, opts: SceneOptions) {
    this.opts = opts
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: false })
    if (!gl) throw new Error("WebGL2 is not available")
    this.gl = gl
    this.nPoints = opts.layers * opts.neurons
    this.pos = new Float32Array(this.nPoints * 3)
    this.col = new Uint8Array(this.nPoints * 4)
    this.size = new Float32Array(this.nPoints)
    this.base = new Float32Array(this.nPoints)
    this.progP = compile(gl, VS_POINTS, FS_POINTS)
    this.flatP = compile(gl, VS_FLAT, FS_FLAT)
    const { layers, neurons, cols, rows } = opts
    for (let l = 0; l < layers; l++)
      for (let n = 0; n < neurons; n++) {
        const i = l * neurons + n
        const r = Math.floor(n / cols), c = n % cols
        this.pos[i * 3] = l * this.spacing
        this.pos[i * 3 + 1] = ((rows - 1) / 2 - r) * this.cell * (64 / cols) * 1.0
        this.pos[i * 3 + 2] = (c - (cols - 1) / 2) * this.cell * (64 / cols)
      }
    this.target = [((layers - 1) * this.spacing) / 2, 0, 0]
    this.bufPos = gl.createBuffer()!
    this.bufCol = gl.createBuffer()!
    this.bufSize = gl.createBuffer()!
    this.vaoPts = gl.createVertexArray()!
    gl.bindVertexArray(this.vaoPts)
    const attr = (p: WebGLProgram, name: string, buf: WebGLBuffer, n: number, type: number, norm: boolean) => {
      const loc = gl.getAttribLocation(p, name)
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, n, type, norm, 0, 0)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPos)
    gl.bufferData(gl.ARRAY_BUFFER, this.pos, gl.STATIC_DRAW)
    attr(this.progP, "aPos", this.bufPos, 3, gl.FLOAT, false)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol)
    gl.bufferData(gl.ARRAY_BUFFER, this.col, gl.DYNAMIC_DRAW)
    attr(this.progP, "aCol", this.bufCol, 4, gl.UNSIGNED_BYTE, true)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSize)
    gl.bufferData(gl.ARRAY_BUFFER, this.size, gl.DYNAMIC_DRAW)
    attr(this.progP, "aSize", this.bufSize, 1, gl.FLOAT, false)
    gl.bindVertexArray(null)

    this.planeBuf = gl.createBuffer()!
    this.planeCol = gl.createBuffer()!
    this.planeVao = gl.createVertexArray()!
    this.lineBuf = gl.createBuffer()!
    this.lineCol = gl.createBuffer()!
    this.lineVao = gl.createVertexArray()!
    this.buildPlanes()
    this.recolor()
    this.attachInput()
  }

  // ---- data ------------------------------------------------------------

  setPalette(p: Palette) {
    this.pal = p
    this.buildPlanes()
    this.recolor()
    this.setEdgeStyle()
  }

  /** Mark the strongest neurons of a layer (by activation) so they read brighter than the rest. */
  setLayerTop(layer: number, actMax: number[], keep = 256) {
    const idx = actMax.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, keep)
    const base = layer * this.opts.neurons
    for (let n = 0; n < this.opts.neurons; n++) this.base[base + n] = 0
    for (const [, n] of idx) this.base[base + n] = 1
    this.recolor()
  }

  private crowd = 1

  setStyles(list: Style[]) {
    this.styles.clear()
    const n = list.length
    // many highlighted neurons: draw them smaller so the map stays legible
    this.crowd = n > 3000 ? 0.45 : n > 800 ? 0.6 : n > 250 ? 0.8 : n > 60 ? 1 : 1.5
    for (const s of list) this.styles.set(s.layer * this.opts.neurons + s.neuron, s.kind)
    this.recolor()
  }

  setSelected(sel: { layer: number; neuron: number } | null, focus = true) {
    this.selected = sel
    if (sel) {
      this.selectedLayer = sel.layer
      if (focus) this.focusLayer(sel.layer)
    }
    this.buildPlanes()
    this.recolor()
  }

  setLayer(layer: number, focus = true) {
    this.selectedLayer = layer
    this.buildPlanes()
    if (focus) this.focusLayer(layer)
    this.invalidate()
  }

  setDim(d: number) {
    this.dim = d
    this.recolor()
  }

  setEdges(edges: EdgeLine[]) {
    const gl = this.gl
    const P = this.pal
    const verts: number[] = []
    const cols: number[] = []
    const n = this.opts.neurons
    const at = (l: number, k: number) => [this.pos[(l * n + k) * 3], this.pos[(l * n + k) * 3 + 1], this.pos[(l * n + k) * 3 + 2]]
    for (const e of edges) {
      const c = e.kind === "feeds" ? P.feeds : P.fed
      const A = at(e.a[0], e.a[1]), B = at(e.b[0], e.b[1])
      verts.push(...A, ...B)
      const a0 = 0.9 * (0.35 + 0.65 * e.w)
      cols.push(c[0], c[1], c[2], a0, c[0], c[1], c[2], a0 * 0.25)
    }
    this.lineVerts = edges.length * 2
    gl.bindVertexArray(this.lineVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW)
    const lp = gl.getAttribLocation(this.flatP, "aPos")
    gl.enableVertexAttribArray(lp)
    gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineCol)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.DYNAMIC_DRAW)
    const lc = gl.getAttribLocation(this.flatP, "aCol")
    gl.enableVertexAttribArray(lc)
    gl.vertexAttribPointer(lc, 4, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    this.invalidate()
  }

  private setEdgeStyle() {
    this.invalidate()
  }

  // ---- geometry --------------------------------------------------------

  private buildPlanes() {
    const gl = this.gl
    const { layers, cols, rows } = this.opts
    const P = this.pal
    const w = (cols * this.cell * (64 / cols)) / 2 + 0.05
    const h = (rows * this.cell * (64 / cols)) / 2 + 0.05
    const fill: number[] = [], fillC: number[] = []
    const line: number[] = [], lineC: number[] = []
    for (let l = 0; l < layers; l++) {
      const x = l * this.spacing
      const sel = l === this.selectedLayer
      const a = sel ? 0.12 : P.light ? 0.04 : 0.055
      const la = sel ? 0.85 : P.light ? 0.26 : 0.42
      const q = [[x, h, -w], [x, h, w], [x, -h, w], [x, -h, -w]]
      for (const i of [0, 1, 2, 0, 2, 3]) {
        fill.push(...q[i])
        fillC.push(P.plane[0], P.plane[1], P.plane[2], a)
      }
      for (let i = 0; i < 4; i++) {
        line.push(...q[i], ...q[(i + 1) % 4])
        for (let k = 0; k < 2; k++) lineC.push(P.plane[0], P.plane[1], P.plane[2], la)
      }
    }
    this.planeFillVerts = fill.length / 3
    this.planeLineVerts = line.length / 3
    gl.bindVertexArray(this.planeVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.planeBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...fill, ...line]), gl.STATIC_DRAW)
    const lp = gl.getAttribLocation(this.flatP, "aPos")
    gl.enableVertexAttribArray(lp)
    gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.planeCol)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...fillC, ...lineC]), gl.STATIC_DRAW)
    const lc = gl.getAttribLocation(this.flatP, "aCol")
    gl.enableVertexAttribArray(lc)
    gl.vertexAttribPointer(lc, 4, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    this.invalidate()
  }

  private recolor() {
    const P = this.pal
    const N = this.opts.neurons
    const light = P.light
    for (let i = 0; i < this.nPoints; i++) {
      const l = Math.floor(i / N)
      const onSel = l === this.selectedLayer
      const k = this.styles.get(i)
      let c = P.dot
      let a = onSel ? 0.4 : 0.14
      let s = onSel ? 1.7 : 1.2
      if (this.base[i] > 0) {
        c = P.top
        a = onSel ? 0.85 : 0.5
        s = onSel ? 2.6 : 1.9
      }
      if (this.dim < 1 && this.styles.size) {
        a *= this.dim
      }
      if (k) {
        c = P[k === "dim" ? "dot" : (k as keyof Palette) as "match"] as [number, number, number]
        a = k === "match" || k === "match2" ? 1 : 0.95
        s = k === "sel" ? 8 : k === "up" || k === "down" ? 5.5 * this.crowd : k === "fed" || k === "feeds" ? 3.8 : k === "match2" ? 6 : 3.6
        if (light && k === "dim") a = 0.1
      }
      this.col[i * 4] = Math.round(c[0] * 255)
      this.col[i * 4 + 1] = Math.round(c[1] * 255)
      this.col[i * 4 + 2] = Math.round(c[2] * 255)
      this.col[i * 4 + 3] = Math.round(Math.min(1, a) * 255)
      this.size[i] = s
    }
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.col)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSize)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.size)
    this.invalidate()
  }

  // ---- camera ----------------------------------------------------------

  private eye(): number[] {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch)
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw)
    // spherical around the target; x is the layer axis
    return [this.target[0] + this.dist * cp * sy, this.target[1] + this.dist * sp, this.target[2] + this.dist * cp * cy]
  }

  private matrices() {
    const asp = this.W / Math.max(1, this.H)
    const P = persp(0.62, asp, 0.5, 400)
    const V = lookAt(this.eye(), this.target, [0, 1, 0])
    this.vp = mul(P, V)
  }

  focusLayer(layer: number) {
    const to = [layer * this.spacing, 0, 0]
    if (this.opts.reducedMotion) {
      this.target = to
      this.invalidate()
      return
    }
    this.tween = { from: [...this.target], to, t0: performance.now(), ms: 420 }
    this.invalidate()
  }

  resetView() {
    this.yaw = 0.78
    this.pitch = 0.3
    this.dist = 15
    this.focusLayer(Math.min(this.opts.layers - 1, Math.max(0, this.selectedLayer)))
  }

  /** Tell the overlay (labels, ring) the camera moved, with matrices that already include the move. */
  private notifyCamera() {
    this.matrices()
    this.opts.onCamera?.()
  }

  zoomBy(f: number) {
    this.dist = Math.min(80, Math.max(3, this.dist * f))
    this.invalidate()
    this.notifyCamera()
  }

  orbitBy(dyaw: number, dpitch: number) {
    this.yaw += dyaw
    this.pitch = Math.min(1.45, Math.max(-1.45, this.pitch + dpitch))
    this.invalidate()
    this.notifyCamera()
  }

  // ---- projection & picking -------------------------------------------

  project(layer: number, neuron: number): { x: number; y: number; visible: boolean } {
    const i = (layer * this.opts.neurons + neuron) * 3
    return this.projectXYZ(this.pos[i], this.pos[i + 1], this.pos[i + 2])
  }

  projectXYZ(x: number, y: number, z: number) {
    const m = this.vp
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12]
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13]
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15]
    if (cw <= 0.01) return { x: 0, y: 0, visible: false }
    return { x: ((cx / cw) * 0.5 + 0.5) * this.W, y: (1 - ((cy / cw) * 0.5 + 0.5)) * this.H, visible: true }
  }

  layerLabelAt(layer: number): { x: number; y: number; visible: boolean } {
    const { cols, rows } = this.opts
    const w = (cols * this.cell * (64 / cols)) / 2
    const h = (rows * this.cell * (64 / cols)) / 2
    return this.projectXYZ(layer * this.spacing, h + 0.12, w + 0.05)
  }

  pick(px: number, py: number, radius = 10): { layer: number; neuron: number } | null {
    this.matrices()
    const m = this.vp
    let best = -1
    let bestScore = Infinity
    const N = this.nPoints
    const W = this.W, H = this.H
    for (let i = 0; i < N; i++) {
      const x = this.pos[i * 3], y = this.pos[i * 3 + 1], z = this.pos[i * 3 + 2]
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15]
      if (cw <= 0.01) continue
      const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw * 0.5 + 0.5) * W
      const sy = (1 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / cw * 0.5 + 0.5)) * H
      const dx = sx - px, dy = sy - py
      const d2 = dx * dx + dy * dy
      if (d2 > radius * radius) continue
      const k = this.styles.get(i)
      const weight = k ? 0.25 : this.base[i] > 0 ? 0.6 : 1
      const onSel = Math.floor(i / this.opts.neurons) === this.selectedLayer ? 0.7 : 1
      const score = d2 * weight * onSel + cw * 0.01
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) return null
    return { layer: Math.floor(best / this.opts.neurons), neuron: best % this.opts.neurons }
  }

  // ---- input -----------------------------------------------------------

  private attachInput() {
    const c = this.canvas
    c.style.touchAction = "none"
    c.addEventListener("pointerdown", this.onDown)
    c.addEventListener("pointermove", this.onMove)
    c.addEventListener("pointerup", this.onUp)
    c.addEventListener("pointercancel", this.onUp)
    c.addEventListener("pointerleave", this.onLeave)
    c.addEventListener("wheel", this.onWheel, { passive: false })
    c.addEventListener("contextmenu", (e) => e.preventDefault())
  }

  private onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.dragMoved = 0
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.lastPinch = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId)
    const rect = this.canvas.getBoundingClientRect()
    if (!p) {
      this.pendingHover = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (!this.hoverRaf)
        this.hoverRaf = requestAnimationFrame(() => {
          this.hoverRaf = 0
          const h = this.pendingHover
          if (!h || this.destroyed) return
          const hit = this.pick(h.x, h.y, 9)
          this.opts.onHover(hit ? { ...hit, x: h.x, y: h.y } : null)
        })
      return
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    this.dragMoved += Math.abs(dx) + Math.abs(dy)
    this.tween = null
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (this.lastPinch > 0) this.zoomBy(this.lastPinch / Math.max(1, d))
      this.lastPinch = d
      return
    }
    if (e.shiftKey || e.buttons === 2 || e.buttons === 4) {
      const k = this.dist * 0.0016
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw)
      this.target[0] += (-cy * dx) * k
      this.target[2] += (sy * dx) * k
      this.target[1] += dy * k
      this.invalidate()
      this.notifyCamera()
    } else {
      this.orbitBy(-dx * 0.006, dy * 0.006)
    }
  }

  private onUp = (e: PointerEvent) => {
    const had = this.pointers.has(e.pointerId)
    this.pointers.delete(e.pointerId)
    this.lastPinch = 0
    if (had && this.dragMoved < 5 && this.pointers.size === 0) {
      const rect = this.canvas.getBoundingClientRect()
      const hit = this.pick(e.clientX - rect.left, e.clientY - rect.top, 12)
      if (hit) this.opts.onPick(hit.layer, hit.neuron)
    }
  }

  private onLeave = () => {
    this.pendingHover = null
    this.opts.onHover(null)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.zoomBy(Math.exp(e.deltaY * 0.0012))
  }

  // ---- render loop -----------------------------------------------------

  invalidate() {
    this.dirty = true
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(this.frame)
  }

  resize(w: number, h: number, dpr: number) {
    this.W = Math.max(1, w)
    this.H = Math.max(1, h)
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.invalidate()
    this.notifyCamera()
  }

  private frame = (t: number) => {
    this.raf = 0
    if (this.destroyed) return
    let animating = false
    if (this.tween) {
      const k = Math.min(1, (t - this.tween.t0) / this.tween.ms)
      const e = 1 - Math.pow(1 - k, 3)
      for (let i = 0; i < 3; i++) this.target[i] = this.tween.from[i] + (this.tween.to[i] - this.tween.from[i]) * e
      if (k >= 1) this.tween = null
      else animating = true
      this.notifyCamera()
    }
    this.draw()
    this.dirty = false
    if (animating) this.raf = requestAnimationFrame(this.frame)
  }

  private draw() {
    const gl = this.gl
    const P = this.pal
    this.matrices()
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    if (P.light) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
    gl.disable(gl.DEPTH_TEST)
    gl.useProgram(this.flatP)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.flatP, "uVP"), false, this.vp)
    gl.bindVertexArray(this.planeVao)
    gl.drawArrays(gl.TRIANGLES, 0, this.planeFillVerts)
    gl.drawArrays(gl.LINES, this.planeFillVerts, this.planeLineVerts)
    if (this.lineVerts) {
      gl.bindVertexArray(this.lineVao)
      gl.drawArrays(gl.LINES, 0, this.lineVerts)
    }
    gl.useProgram(this.progP)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progP, "uVP"), false, this.vp)
    gl.uniform1f(gl.getUniformLocation(this.progP, "uScale"), this.dpr * (this.H / 760) * 1.05 + 0.25)
    gl.bindVertexArray(this.vaoPts)
    gl.drawArrays(gl.POINTS, 0, this.nPoints)
    gl.bindVertexArray(null)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    cancelAnimationFrame(this.hoverRaf)
    const c = this.canvas
    c.removeEventListener("pointerdown", this.onDown)
    c.removeEventListener("pointermove", this.onMove)
    c.removeEventListener("pointerup", this.onUp)
    c.removeEventListener("pointercancel", this.onUp)
    c.removeEventListener("pointerleave", this.onLeave)
    c.removeEventListener("wheel", this.onWheel)
    // Free what we made but keep the context alive: React may mount again on the same canvas, and a
    // context we had "lost" would make every shader on it fail to compile with an empty log.
    const gl = this.gl
    for (const b of [this.bufPos, this.bufCol, this.bufSize, this.planeBuf, this.planeCol, this.lineBuf, this.lineCol]) gl.deleteBuffer(b)
    for (const v of [this.vaoPts, this.planeVao, this.lineVao]) gl.deleteVertexArray(v)
    gl.deleteProgram(this.progP)
    gl.deleteProgram(this.flatP)
  }
}
