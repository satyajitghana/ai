// Minimal, hand-rolled WebGL2 renderer for ~140k instanced points + up to a
// few hundred thousand line-segment edges. No three.js / react-three-fiber:
// this repo carries no 3D library today, 166k points is trivial for a single
// gl.POINTS draw call, and the site's own convention (see
// components/articles/scaling-laws-2026/loss-surface.tsx) is to hand-write
// small canvas/GL renderers rather than pull in a scene-graph library for one
// component. All matrix/trig math below feeds GPU uniforms, never the DOM, so
// lib/dmath's determinism rule does not apply here (see its own header comment
// and CLAUDE.md: "Inside a WebGL shader or a canvas draw loop this does not
// apply").

export type Mat4 = Float32Array

export function perspective(fovyRad: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovyRad / 2)
  const out = new Float32Array(16)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) / (near - far)
  out[11] = -1
  out[14] = (2 * far * near) / (near - far)
  return out
}

export function lookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Mat4 {
  const [ex, ey, ez] = eye
  let zx = ex - target[0]
  let zy = ey - target[1]
  let zz = ez - target[2]
  let len = Math.hypot(zx, zy, zz) || 1
  zx /= len
  zy /= len
  zz /= len

  let xx = up[1] * zz - up[2] * zy
  let xy = up[2] * zx - up[0] * zz
  let xz = up[0] * zy - up[1] * zx
  len = Math.hypot(xx, xy, xz) || 1
  xx /= len
  xy /= len
  xz /= len

  const yx = zy * xz - zz * xy
  const yy = zz * xx - zx * xz
  const yz = zx * xy - zy * xx

  const out = new Float32Array(16)
  out[0] = xx
  out[1] = yx
  out[2] = zx
  out[4] = xy
  out[5] = yy
  out[6] = zy
  out[8] = xz
  out[9] = yz
  out[10] = zz
  out[12] = -(xx * ex + xy * ey + xz * ez)
  out[13] = -(yx * ex + yy * ey + yz * ez)
  out[14] = -(zx * ex + zy * ey + zz * ez)
  out[15] = 1
  return out
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3]
    }
  }
  return out
}

/** Orbit-camera eye position: yaw around +Y, pitch clamped away from the poles. */
export function orbitEye(yaw: number, pitch: number, distance: number): [number, number, number] {
  const cp = Math.cos(pitch)
  return [distance * Math.sin(yaw) * cp, distance * Math.sin(pitch), distance * Math.cos(yaw) * cp]
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)
  if (!sh) throw new Error("createShader failed")
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader compile error: ${log}`)
  }
  return sh
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc)
  const prog = gl.createProgram()
  if (!prog) throw new Error("createProgram failed")
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog)
    gl.deleteProgram(prog)
    throw new Error(`program link error: ${log}`)
  }
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return prog
}

const POINT_VS = `#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in float aRegion;
layout(location=2) in float aHighlight;
layout(location=3) in float aActivity;

uniform mat4 uViewProj;
uniform vec3 uRegionColors[4];
uniform float uPointSize;
uniform int uColorMode; // 0 = region, 1 = highlight-focus, 2 = activity
uniform vec3 uHighlightColor;

out vec3 vColor;
out float vAlpha;

void main() {
  vec4 clip = uViewProj * vec4(aPosition, 1.0);
  gl_Position = clip;
  float d = max(clip.w, 0.05);
  int region = int(aRegion + 0.5);

  if (uColorMode == 1) {
    if (aHighlight > 0.5) {
      vColor = uHighlightColor;
      vAlpha = 1.0;
      gl_PointSize = clamp(uPointSize * 1.6 / d, 1.5, 18.0);
    } else {
      vColor = vec3(0.42, 0.44, 0.48);
      vAlpha = 0.07;
      gl_PointSize = clamp(uPointSize * 0.7 / d, 1.0, 10.0);
    }
  } else if (uColorMode == 2) {
    vec3 base = uRegionColors[region];
    vColor = mix(base * 0.35, vec3(1.0, 0.86, 0.25), aActivity);
    vAlpha = clamp(0.30 + aActivity * 0.9, 0.0, 1.0);
    gl_PointSize = clamp((uPointSize + aActivity * 10.0) / d, 1.0, 20.0);
  } else {
    vColor = uRegionColors[region];
    vAlpha = 0.6;
    gl_PointSize = clamp(uPointSize / d, 1.0, 14.0);
  }
}
`

const POINT_FS = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float edge = smoothstep(1.0, 0.55, r2);
  outColor = vec4(vColor, vAlpha * edge);
}
`

const LINE_VS = `#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in float aWeight;
uniform mat4 uViewProj;
uniform float uMaxWeight;
out float vT;
void main() {
  gl_Position = uViewProj * vec4(aPosition, 1.0);
  vT = clamp(aWeight / max(uMaxWeight, 1.0), 0.0, 1.0);
}
`

const LINE_FS = `#version 300 es
precision mediump float;
in float vT;
uniform vec3 uColor;
uniform float uBaseAlpha;
out vec4 outColor;
void main() {
  outColor = vec4(uColor, uBaseAlpha * (0.35 + 0.65 * vT));
}
`

interface PointBuffers {
  position: WebGLBuffer
  region: WebGLBuffer
  highlight: WebGLBuffer
  activity: WebGLBuffer
}

export class NeuronGLRenderer {
  gl: WebGL2RenderingContext
  private pointProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private pointBuffers: PointBuffers
  private pointVao: WebGLVertexArrayObject
  private n = 0

  private backboneVao: WebGLVertexArrayObject | null = null
  private backboneCount = 0
  private backboneMaxWeight = 1

  private highlightVao: WebGLVertexArrayObject | null = null
  private highlightCount = 0
  private highlightMaxWeight = 1

  private highlightBuf = new Float32Array(0)
  private activityBuf = new Float32Array(0)

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.pointProgram = linkProgram(gl, POINT_VS, POINT_FS)
    this.lineProgram = linkProgram(gl, LINE_VS, LINE_FS)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error("createVertexArray failed")
    this.pointVao = vao
    this.pointBuffers = {
      position: this.mustBuffer(),
      region: this.mustBuffer(),
      highlight: this.mustBuffer(),
      activity: this.mustBuffer(),
    }

    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private mustBuffer(): WebGLBuffer {
    const b = this.gl.createBuffer()
    if (!b) throw new Error("createBuffer failed")
    return b
  }

  setSomas(positions: Float32Array, region: Uint8Array) {
    const gl = this.gl
    this.n = region.length
    this.highlightBuf = new Float32Array(this.n)
    this.activityBuf = new Float32Array(this.n)

    const regionF = new Float32Array(region.length)
    for (let i = 0; i < region.length; i++) regionF[i] = region[i]

    gl.bindVertexArray(this.pointVao)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffers.position)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffers.region)
    gl.bufferData(gl.ARRAY_BUFFER, regionF, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffers.highlight)
    gl.bufferData(gl.ARRAY_BUFFER, this.highlightBuf, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffers.activity)
    gl.bufferData(gl.ARRAY_BUFFER, this.activityBuf, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(null)
  }

  /** indices=null clears the highlight set. */
  setHighlight(indices: Uint32Array | null) {
    this.highlightBuf.fill(0)
    if (indices) for (const i of indices) if (i < this.highlightBuf.length) this.highlightBuf[i] = 1
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffers.highlight)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.highlightBuf)
  }

  setActivity(activity: Float32Array) {
    this.activityBuf.set(activity)
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffers.activity)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.activityBuf)
  }

  clearActivity() {
    this.activityBuf.fill(0)
    this.setActivity(this.activityBuf)
  }

  private buildLineVao(positions: Float32Array, src: Uint32Array, dst: Uint32Array, weight: Uint16Array) {
    const gl = this.gl
    const count = src.length
    const verts = new Float32Array(count * 2 * 3)
    const wts = new Float32Array(count * 2)
    let maxW = 1
    for (let e = 0; e < count; e++) {
      const s = src[e]
      const d = dst[e]
      const w = weight[e]
      if (w > maxW) maxW = w
      verts[e * 6] = positions[s * 3]
      verts[e * 6 + 1] = positions[s * 3 + 1]
      verts[e * 6 + 2] = positions[s * 3 + 2]
      verts[e * 6 + 3] = positions[d * 3]
      verts[e * 6 + 4] = positions[d * 3 + 1]
      verts[e * 6 + 5] = positions[d * 3 + 2]
      wts[e * 2] = w
      wts[e * 2 + 1] = w
    }
    const vao = gl.createVertexArray()
    if (!vao) throw new Error("createVertexArray failed")
    gl.bindVertexArray(vao)
    const posBuf = this.mustBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
    const wBuf = this.mustBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, wBuf)
    gl.bufferData(gl.ARRAY_BUFFER, wts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    return { vao, count: count * 2, maxW }
  }

  setBackboneEdges(positions: Float32Array, src: Uint32Array, dst: Uint32Array, weight: Uint16Array) {
    const { vao, count, maxW } = this.buildLineVao(positions, src, dst, weight)
    this.backboneVao = vao
    this.backboneCount = count
    this.backboneMaxWeight = maxW
  }

  setHighlightEdges(positions: Float32Array, src: Uint32Array, dst: Uint32Array, weight: Uint16Array) {
    if (this.highlightVao) this.gl.deleteVertexArray(this.highlightVao)
    if (src.length === 0) {
      this.highlightVao = null
      this.highlightCount = 0
      return
    }
    const { vao, count, maxW } = this.buildLineVao(positions, src, dst, weight)
    this.highlightVao = vao
    this.highlightCount = count
    this.highlightMaxWeight = maxW
  }

  clearHighlightEdges() {
    if (this.highlightVao) this.gl.deleteVertexArray(this.highlightVao)
    this.highlightVao = null
    this.highlightCount = 0
  }

  render(opts: {
    width: number
    height: number
    viewProj: Mat4
    colorMode: 0 | 1 | 2
    regionColors: [number, number, number][]
    pointSize: number
    highlightColor: [number, number, number]
    showBackbone: boolean
    backboneColor: [number, number, number]
    backboneAlpha: number
    highlightEdgeColor: [number, number, number]
  }) {
    const gl = this.gl
    gl.viewport(0, 0, opts.width, opts.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    if (opts.showBackbone && this.backboneVao && this.backboneCount > 0) {
      gl.useProgram(this.lineProgram)
      const u = (name: string) => gl.getUniformLocation(this.lineProgram, name)
      gl.uniformMatrix4fv(u("uViewProj"), false, opts.viewProj)
      gl.uniform3fv(u("uColor"), opts.backboneColor)
      gl.uniform1f(u("uBaseAlpha"), opts.backboneAlpha)
      gl.uniform1f(u("uMaxWeight"), this.backboneMaxWeight)
      gl.bindVertexArray(this.backboneVao)
      gl.drawArrays(gl.LINES, 0, this.backboneCount)
    }

    if (this.highlightVao && this.highlightCount > 0) {
      gl.useProgram(this.lineProgram)
      const u = (name: string) => gl.getUniformLocation(this.lineProgram, name)
      gl.uniformMatrix4fv(u("uViewProj"), false, opts.viewProj)
      gl.uniform3fv(u("uColor"), opts.highlightEdgeColor)
      gl.uniform1f(u("uBaseAlpha"), 0.9)
      gl.uniform1f(u("uMaxWeight"), this.highlightMaxWeight)
      gl.bindVertexArray(this.highlightVao)
      gl.drawArrays(gl.LINES, 0, this.highlightCount)
    }

    gl.useProgram(this.pointProgram)
    const u = (name: string) => gl.getUniformLocation(this.pointProgram, name)
    gl.uniformMatrix4fv(u("uViewProj"), false, opts.viewProj)
    gl.uniform3fv(u("uRegionColors"), new Float32Array(opts.regionColors.flat()))
    gl.uniform1f(u("uPointSize"), opts.pointSize)
    gl.uniform1i(u("uColorMode"), opts.colorMode)
    gl.uniform3fv(u("uHighlightColor"), opts.highlightColor)
    gl.bindVertexArray(this.pointVao)
    gl.drawArrays(gl.POINTS, 0, this.n)
    gl.bindVertexArray(null)
  }

  dispose() {
    const gl = this.gl
    gl.deleteVertexArray(this.pointVao)
    if (this.backboneVao) gl.deleteVertexArray(this.backboneVao)
    if (this.highlightVao) gl.deleteVertexArray(this.highlightVao)
    gl.deleteProgram(this.pointProgram)
    gl.deleteProgram(this.lineProgram)
    Object.values(this.pointBuffers).forEach((b) => gl.deleteBuffer(b))
  }
}
