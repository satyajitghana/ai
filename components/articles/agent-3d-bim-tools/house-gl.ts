// A small, dependency-free glTF 2.0 (.glb) loader and WebGL2 walk-through
// renderer for the beach house in agent-3d-bim-tools. It reads positions,
// indices (any type), vertex colours (any normalised or float type), a
// baseColor texture with UVs, baseColorFactor, alphaMode, doubleSided and the
// node hierarchy (matrix or TRS). Lighting is baked into the textures, so
// every surface is drawn unlit and NORMAL is not read (the house file ships
// none); the sky and the sea are shaded here. No Draco, no meshopt: the file
// must be plain glTF, and any required extension other than
// KHR_materials_unlit is refused.
//
// Nothing here reaches the DOM as text, so the transcendental Math calls below
// cannot cause a hydration mismatch; this module only runs in the browser.

type Vec3 = [number, number, number]
type Mat4 = Float32Array

export type Prim = {
  name: string
  pos: Float32Array
  idx: Uint32Array
  uv?: Float32Array
  col?: { data: ArrayBufferView; size: number; type: number; normalized: boolean }
  tex?: ImageBitmap | HTMLImageElement
  color: [number, number, number, number]
  blend: boolean
  doubleSided: boolean
  water: boolean
  walkable: boolean
  solid: boolean
}

export type View = { name: string; eye: Vec3; target: Vec3 }
export type Scene = {
  prims: Prim[]
  views: View[]
  min: Vec3
  max: Vec3
  triangles: number
  /** optional, from scene.extras.sun: unit vector toward the sun (glTF axes). Absent: the first house's sun. */
  sun?: Vec3
  /** optional, from scene.extras.interior: the box that counts as "inside" when switching to Walk. */
  interior?: { min: Vec3; max: Vec3 }
}

/* ------------------------------------------------------------------ math */
const m4 = () => {
  const m = new Float32Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}
function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
function trs(t?: number[], q?: number[], s?: number[]): Mat4 {
  const [x, y, z, w] = q ?? [0, 0, 0, 1]
  const [sx, sy, sz] = s ?? [1, 1, 1]
  const m = m4()
  m[0] = (1 - 2 * (y * y + z * z)) * sx
  m[1] = 2 * (x * y + z * w) * sx
  m[2] = 2 * (x * z - y * w) * sx
  m[4] = 2 * (x * y - z * w) * sy
  m[5] = (1 - 2 * (x * x + z * z)) * sy
  m[6] = 2 * (y * z + x * w) * sy
  m[8] = 2 * (x * z + y * w) * sz
  m[9] = 2 * (y * z - x * w) * sz
  m[10] = (1 - 2 * (x * x + y * y)) * sz
  if (t) {
    m[12] = t[0]
    m[13] = t[1]
    m[14] = t[2]
  }
  return m
}
function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}
function lookAt(eye: Vec3, at: Vec3): Mat4 {
  let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2]
  let l = Math.hypot(zx, zy, zz) || 1
  zx /= l; zy /= l; zz /= l
  let xx = zz, xy = 0, xz = -zx // up (0,1,0) x z
  l = Math.hypot(xx, xy, xz) || 1
  xx /= l; xy /= l; xz /= l
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx
  const m = m4()
  m[0] = xx; m[4] = xy; m[8] = xz
  m[1] = yx; m[5] = yy; m[9] = yz
  m[2] = zx; m[6] = zy; m[10] = zz
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2])
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2])
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2])
  return m
}
function invert(a: Mat4): Mat4 {
  const o = new Float32Array(16)
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  const d = det ? 1 / det : 0
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d
  o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d
  o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d
  o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d
  o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d
  o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d
  o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d
  o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d
  o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d
  o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d
  o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d
  o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d
  o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d
  return o
}

/* ------------------------------------------------------------------ glTF */
const COMP: Record<number, { size: number; Ctor: { new (b: ArrayBuffer, o: number, n: number): ArrayBufferView & ArrayLike<number> } }> = {
  5120: { size: 1, Ctor: Int8Array },
  5121: { size: 1, Ctor: Uint8Array },
  5122: { size: 2, Ctor: Int16Array },
  5123: { size: 2, Ctor: Uint16Array },
  5125: { size: 4, Ctor: Uint32Array },
  5126: { size: 4, Ctor: Float32Array },
}
const NCOMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function parseGlb(buf: ArrayBuffer): Promise<Scene> {
  const dv = new DataView(buf)
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("not a .glb file")
  let off = 12
  let json: any = null
  let bin: ArrayBuffer | null = null
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true)
    const type = dv.getUint32(off + 4, true)
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)))
    else if (type === 0x004e4942) bin = buf.slice(off + 8, off + 8 + len)
    off += 8 + len
  }
  if (!json || !bin) throw new Error("glb has no JSON or BIN chunk")
  const body = bin
  for (const ext of json.extensionsRequired ?? []) if (ext !== "KHR_materials_unlit") throw new Error(`unsupported extension ${ext}`)

  // Read an accessor into a tightly packed typed array (handles byteStride).
  const read = (i: number) => {
    const a = json.accessors[i]
    const { size, Ctor } = COMP[a.componentType]
    const n = NCOMP[a.type]
    const bv = json.bufferViews[a.bufferView]
    const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const stride = bv.byteStride ?? 0
    if (!stride || stride === size * n) {
      const copy = body.slice(start, start + a.count * n * size)
      return { data: new Ctor(copy, 0, a.count * n), n, type: a.componentType, normalized: !!a.normalized }
    }
    const out = new Ctor(new ArrayBuffer(a.count * n * size), 0, a.count * n) as any
    const src = new DataView(body)
    const get = (o: number) =>
      a.componentType === 5126 ? src.getFloat32(o, true)
      : a.componentType === 5125 ? src.getUint32(o, true)
      : a.componentType === 5123 ? src.getUint16(o, true)
      : a.componentType === 5122 ? src.getInt16(o, true)
      : a.componentType === 5121 ? src.getUint8(o)
      : src.getInt8(o)
    for (let e = 0; e < a.count; e++) for (let c = 0; c < n; c++) out[e * n + c] = get(start + e * stride + c * size)
    return { data: out as ArrayBufferView & ArrayLike<number>, n, type: a.componentType, normalized: !!a.normalized }
  }

  const images: (Promise<ImageBitmap | HTMLImageElement> | null)[] = (json.images ?? []).map((im: any) => {
    if (im.bufferView === undefined) return null
    const bv = json.bufferViews[im.bufferView]
    const blob = new Blob([new Uint8Array(body, bv.byteOffset ?? 0, bv.byteLength)], { type: im.mimeType })
    if (typeof createImageBitmap === "function") return createImageBitmap(blob)
    return new Promise((res, rej) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = rej
      img.src = URL.createObjectURL(blob)
    })
  })

  const prims: Prim[] = []
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  let triangles = 0
  const visit = async (ni: number, parent: Mat4, flags: { walkable?: boolean; solid?: boolean }) => {
    const node = json.nodes[ni]
    const local = node.matrix ? new Float32Array(node.matrix) : trs(node.translation, node.rotation, node.scale)
    const world = mul(parent, local)
    const f = { ...flags, ...(node.extras ?? {}) }
    if (node.mesh !== undefined) {
      const mesh = json.meshes[node.mesh]
      for (const p of mesh.primitives) {
        if ((p.mode ?? 4) !== 4) continue
        const pr = read(p.attributes.POSITION)
        const src = pr.data as Float32Array
        const pos = new Float32Array(src.length)
        for (let i = 0; i < src.length; i += 3) {
          const x = src[i], y = src[i + 1], z = src[i + 2]
          pos[i] = world[0] * x + world[4] * y + world[8] * z + world[12]
          pos[i + 1] = world[1] * x + world[5] * y + world[9] * z + world[13]
          pos[i + 2] = world[2] * x + world[6] * y + world[10] * z + world[14]
          for (let k = 0; k < 3; k++) {
            if (pos[i + k] < min[k]) min[k] = pos[i + k]
            if (pos[i + k] > max[k]) max[k] = pos[i + k]
          }
        }
        const count = pos.length / 3
        let idx: Uint32Array
        if (p.indices !== undefined) {
          const ir = read(p.indices).data
          idx = ir instanceof Uint32Array ? ir : Uint32Array.from(ir as ArrayLike<number>)
        } else idx = Uint32Array.from({ length: count }, (_, i) => i)
        triangles += idx.length / 3
        const mat = p.material !== undefined ? json.materials[p.material] : {}
        const pbr = mat.pbrMetallicRoughness ?? {}
        let uv: Float32Array | undefined
        let tex: ImageBitmap | HTMLImageElement | undefined
        if (pbr.baseColorTexture && p.attributes.TEXCOORD_0 !== undefined) {
          const ur = read(p.attributes.TEXCOORD_0)
          uv = ur.data instanceof Float32Array ? ur.data : Float32Array.from(ur.data as ArrayLike<number>, (v) => (ur.normalized ? v / (ur.type === 5121 ? 255 : 65535) : v))
          const ti = json.textures[pbr.baseColorTexture.index]
          const im = images[ti.source]
          if (im) tex = await im
        }
        let col: Prim["col"]
        if (p.attributes.COLOR_0 !== undefined) {
          const cr = read(p.attributes.COLOR_0)
          col = { data: cr.data, size: cr.n, type: cr.type, normalized: cr.normalized || cr.type !== 5126 }
        }
        const name = String(mat.name ?? mesh.name ?? "")
        prims.push({
          name,
          pos,
          idx,
          uv,
          tex,
          col,
          color: (pbr.baseColorFactor ?? [1, 1, 1, 1]) as Prim["color"],
          blend: mat.alphaMode === "BLEND",
          doubleSided: !!mat.doubleSided,
          water: name === "water",
          walkable: f.walkable ?? true,
          solid: f.solid ?? true,
        })
      }
    }
    for (const c of node.children ?? []) await visit(c, world, f)
  }
  const scene = json.scenes[json.scene ?? 0]
  for (const n of scene.nodes) await visit(n, m4(), {})
  const views: View[] = (scene.extras?.views ?? []) as View[]
  const vec3 = (v: unknown): Vec3 | undefined => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v as Vec3) : undefined)
  const sun = vec3(scene.extras?.sun)
  const imin = vec3(scene.extras?.interior?.min), imax = vec3(scene.extras?.interior?.max)
  return { prims, views, min, max, triangles, sun, interior: imin && imax ? { min: imin, max: imax } : undefined }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ collision */
// Triangles bucketed on a 1 m grid in XZ. Floors: upward-facing triangles; a
// vertical ray finds the highest floor under the walker's knees. Walls: steep
// triangles, tested with short horizontal rays at knee and chest height.
type Tri = { a: Vec3; b: Vec3; c: Vec3; n: Vec3 }
class Collider {
  floors = new Map<number, Tri[]>()
  walls = new Map<number, Tri[]>()
  key = (x: number, z: number) => ((Math.floor(x) + 4096) << 13) | (Math.floor(z) + 4096)
  constructor(prims: Prim[]) {
    for (const p of prims) {
      if (!p.walkable && !p.solid) continue
      const P = p.pos
      for (let i = 0; i < p.idx.length; i += 3) {
        const ia = p.idx[i] * 3, ib = p.idx[i + 1] * 3, ic = p.idx[i + 2] * 3
        const a: Vec3 = [P[ia], P[ia + 1], P[ia + 2]], b: Vec3 = [P[ib], P[ib + 1], P[ib + 2]], c: Vec3 = [P[ic], P[ic + 1], P[ic + 2]]
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
        const l = Math.hypot(nx, ny, nz)
        if (l < 1e-9) continue
        nx /= l; ny /= l; nz /= l
        const t: Tri = { a, b, c, n: [nx, ny, nz] }
        const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0])
        const z0 = Math.min(a[2], b[2], c[2]), z1 = Math.max(a[2], b[2], c[2])
        if (x1 - x0 > 60 || z1 - z0 > 60) continue // the horizon apron: never walked on
        const map = ny > 0.55 && p.walkable ? this.floors : Math.abs(ny) < 0.6 && p.solid ? this.walls : null
        if (!map) continue
        for (let x = Math.floor(x0); x <= Math.floor(x1); x++)
          for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
            const k = this.key(x, z)
            const list = map.get(k)
            if (list) list.push(t)
            else map.set(k, [t])
          }
      }
    }
  }
  /** highest floor at (x,z) not above `below`, or null */
  floorAt(x: number, z: number, below: number): number | null {
    let best: number | null = null
    for (const t of this.floors.get(this.key(x, z)) ?? []) {
      const { a, b, c } = t
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
      if (Math.abs(d) < 1e-12) continue
      const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d
      const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d
      const l3 = 1 - l1 - l2
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue
      const y = l1 * a[1] + l2 * b[1] + l3 * c[1]
      if (y <= below && (best === null || y > best)) best = y
    }
    return best
  }
  /** distance along a horizontal ray to the nearest wall, with that wall's normal */
  wallHit(o: Vec3, dx: number, dz: number, maxT: number): { t: number; n: Vec3 } | null {
    let best: { t: number; n: Vec3 } | null = null
    const seen = new Set<Tri>()
    const steps = Math.ceil(maxT) + 1
    for (let s = 0; s <= steps; s++) {
      const px = o[0] + dx * Math.min(s, maxT), pz = o[2] + dz * Math.min(s, maxT)
      for (let ox = -1; ox <= 1; ox++)
        for (let oz = -1; oz <= 1; oz++)
          for (const t of this.walls.get(this.key(px + ox, pz + oz)) ?? []) {
            if (seen.has(t)) continue
            seen.add(t)
            const hit = rayTri(o, [dx, 0, dz], t)
            if (hit !== null && hit >= 0 && hit <= maxT && (!best || hit < best.t)) best = { t: hit, n: t.n }
          }
    }
    return best
  }
}
function rayTri(o: Vec3, d: Vec3, t: Tri): number | null {
  const { a, b, c } = t
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2]
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2]
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x
  const det = e1x * px + e1y * py + e1z * pz
  if (Math.abs(det) < 1e-9) return null
  const inv = 1 / det
  const sx = o[0] - a[0], sy = o[1] - a[1], sz = o[2] - a[2]
  const u = (sx * px + sy * py + sz * pz) * inv
  if (u < 0 || u > 1) return null
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv
  if (v < 0 || u + v > 1) return null
  return (e2x * qx + e2y * qy + e2z * qz) * inv
}

/* ------------------------------------------------------------------ shaders */
const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in vec4 aCol;
uniform mat4 uVP;
out vec2 vUv; out vec4 vCol; out vec3 vWorld;
void main(){ vUv=aUv; vCol=aCol; vWorld=aPos; gl_Position=uVP*vec4(aPos,1.0); }`

const FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vCol; in vec3 vWorld;
uniform sampler2D uTex; uniform int uMode; uniform vec4 uColor; uniform vec3 uEye; uniform float uTime;
uniform vec3 uFog; uniform vec3 uSunDir;
out vec4 o;
vec3 enc(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  float dist = length(vWorld-uEye);
  vec4 c;
  if (uMode==0) { c = texture(uTex, vUv); }
  else if (uMode==1) { c = vec4(enc(vCol.rgb), 1.0); }
  else if (uMode==2) { c = uColor; c.rgb = enc(c.rgb); }
  else {
    // sea: depth-tinted, with drifting ripples, a sun glint and foam at the waterline
    float d = vCol.r;
    vec2 p = vWorld.xz;
    float w = n2(p*0.45+vec2(uTime*0.25, uTime*0.17))*0.6 + n2(p*1.3-vec2(uTime*0.4, -uTime*0.2))*0.4;
    vec3 shallow = vec3(0.42,0.72,0.70), deep = vec3(0.08,0.30,0.42);
    vec3 col = mix(shallow, deep, smoothstep(0.0, 0.7, d));
    vec3 v = normalize(uEye - vWorld);
    float fres = pow(1.0 - max(v.y, 0.0), 4.0);
    vec3 sky = vec3(0.98,0.80,0.62);
    col = mix(col, sky, fres*0.7);
    vec3 r = reflect(-v, normalize(vec3((w-0.5)*0.25, 1.0, (w-0.5)*0.25)));
    float glint = pow(max(dot(r, uSunDir), 0.0), 220.0);
    col += vec3(1.0,0.8,0.55) * glint * 2.5;
    col *= 0.92 + 0.16*w;
    float foam = smoothstep(0.10, 0.0, d + (w-0.5)*0.08 - 0.03*sin(uTime*0.9 + p.y*1.7));
    col = mix(col, vec3(0.97,0.95,0.90), foam*0.85);
    float a = mix(0.45, 0.94, smoothstep(0.0, 0.35, d));
    c = vec4(col, max(a, foam));
  }
  float fog = 1.0 - exp(-max(dist-60.0, 0.0)*0.004);
  c.rgb = mix(c.rgb, uFog, fog);
  if (uMode==0 && c.a < 0.5) discard;
  o = c;
}`

const SKY_VS = `#version 300 es
out vec2 vP; void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vP = p*2.0-1.0; gl_Position = vec4(vP, 0.9999, 1.0); }`
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vP; uniform mat4 uInvVP; uniform vec3 uSunDir; uniform vec3 uEye; out vec4 o;
void main(){
  vec4 a = uInvVP*vec4(vP, -1.0, 1.0), b = uInvVP*vec4(vP, 1.0, 1.0);
  vec3 d = normalize(b.xyz/b.w - a.xyz/a.w);
  float y = d.y;
  vec3 zen = vec3(0.36,0.55,0.78), hor = vec3(0.98,0.80,0.62), low = vec3(0.90,0.72,0.58);
  vec3 c = mix(hor, zen, smoothstep(0.0, 0.55, y));
  c = mix(low, c, smoothstep(-0.2, 0.0, y));
  float s = max(dot(d, uSunDir), 0.0);
  c += vec3(1.0,0.62,0.30)*pow(s, 8.0)*0.35 + vec3(1.0,0.85,0.6)*pow(s, 900.0)*3.0;
  o = vec4(c, 1.0);
}`

/* ------------------------------------------------------------------ viewer */
export type Mode = "orbit" | "walk"
export type Viewer = {
  setMode: (m: Mode) => void
  reset: () => void
  goTo: (name: string) => void
  dispose: () => void
  views: View[]
  triangles: number
  /** draw one frame now (tests and posters) */
  frame: (t?: number) => void
  /** current eye position, for tests */
  where: () => Vec3
}

type GPUPrim = { prim: Prim; vao: WebGLVertexArrayObject; ibo: WebGLBuffer; bufs: WebGLBuffer[]; tex?: WebGLTexture; count: number; centre: Vec3 }

const SUN: Vec3 = (() => {
  // Blender scene: elevation 16 deg, azimuth 215 deg from +x toward +y; glTF is Y-up with z = -y_blender
  const el = (16 * Math.PI) / 180, az = (215 * Math.PI) / 180
  return [Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az)]
})()
const FOG: Vec3 = [0.93, 0.80, 0.68]

export function createViewer(
  canvas: HTMLCanvasElement,
  scene: Scene,
  opts: { onMode?: (m: Mode) => void; start?: string; animate?: boolean; /** view to drop the walker at; default "walk", else "deck" */ walkStart?: string } = {},
): Viewer {
  const glc = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" })
  if (!glc) throw new Error("WebGL2 is not available")
  const gl: WebGL2RenderingContext = glc
  const collider = new Collider(scene.prims)
  const sunDir: Vec3 = scene.sun ?? SUN
  let prog: WebGLProgram, sky: WebGLProgram, gpu: GPUPrim[] = [], skyVao: WebGLVertexArrayObject
  let U: Record<string, WebGLUniformLocation | null> = {}
  let SU: Record<string, WebGLUniformLocation | null> = {}
  let lost = false

  const compile = (vs: string, fs: string) => {
    const p = gl.createProgram()!
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) ?? "shader")
      gl.attachShader(p, s)
    }
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p) ?? "link")
    return p
  }

  function initGL() {
    prog = compile(VS, FS)
    sky = compile(SKY_VS, SKY_FS)
    U = Object.fromEntries(["uVP", "uTex", "uMode", "uColor", "uEye", "uTime", "uFog", "uSunDir"].map((n) => [n, gl.getUniformLocation(prog, n)]))
    SU = Object.fromEntries(["uInvVP", "uSunDir", "uEye"].map((n) => [n, gl.getUniformLocation(sky, n)]))
    skyVao = gl.createVertexArray()!
    const maxAniso = gl.getExtension("EXT_texture_filter_anisotropic")
    gpu = scene.prims.map((prim) => {
      const vao = gl.createVertexArray()!
      gl.bindVertexArray(vao)
      const bufs: WebGLBuffer[] = []
      const attr = (loc: number, data: ArrayBufferView, size: number, type: number, norm: boolean) => {
        const b = gl.createBuffer()!
        bufs.push(b)
        gl.bindBuffer(gl.ARRAY_BUFFER, b)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, size, type, norm, 0, 0)
      }
      attr(0, prim.pos, 3, gl.FLOAT, false)
      if (prim.uv) attr(1, prim.uv, 2, gl.FLOAT, false)
      else gl.vertexAttrib2f(1, 0, 0)
      if (prim.col) attr(2, prim.col.data, prim.col.size, prim.col.type, prim.col.normalized)
      else gl.vertexAttrib4f(2, 1, 1, 1, 1)
      const ibo = gl.createBuffer()!
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, prim.idx, gl.STATIC_DRAW)
      gl.bindVertexArray(null)
      let tex: WebGLTexture | undefined
      if (prim.tex) {
        tex = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, prim.tex)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        // the atlases are packed with small islands: deep mips would blend neighbours
        gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAX_LOD, prim.name === "ter" ? 6 : 2)
        if (maxAniso) gl.texParameterf(gl.TEXTURE_2D, maxAniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(maxAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))
      }
      const c: Vec3 = [0, 0, 0]
      for (let i = 0; i < prim.pos.length; i += 3) { c[0] += prim.pos[i]; c[1] += prim.pos[i + 1]; c[2] += prim.pos[i + 2] }
      const n = prim.pos.length / 3 || 1
      return { prim, vao, ibo, bufs, tex, count: prim.idx.length, centre: [c[0] / n, c[1] / n, c[2] / n] as Vec3 }
    })
  }
  initGL()

  /* ---------------- camera state */
  const home = scene.views.find((v) => v.name === (opts.start ?? "aerial")) ?? scene.views[0]
  const orbit = { target: [0, 3, 0] as Vec3, yaw: 0, pitch: 0.4, dist: 30 }
  const walk = { pos: [0, 0, 0] as Vec3, yaw: 0, pitch: 0, vy: 0 }
  let mode: Mode = "orbit"
  const EYE = 1.6

  const setOrbitFrom = (v: View) => {
    const dx = v.eye[0] - v.target[0], dy = v.eye[1] - v.target[1], dz = v.eye[2] - v.target[2]
    orbit.target = [...v.target] as Vec3
    orbit.dist = Math.hypot(dx, dy, dz)
    orbit.yaw = Math.atan2(dx, dz)
    orbit.pitch = Math.asin(dy / orbit.dist)
  }
  const setWalkFrom = (v: View) => {
    const dx = v.target[0] - v.eye[0], dy = v.target[1] - v.eye[1], dz = v.target[2] - v.eye[2]
    const f = collider.floorAt(v.eye[0], v.eye[2], v.eye[1])
    walk.pos = [v.eye[0], f ?? v.eye[1] - EYE, v.eye[2]]
    walk.yaw = Math.atan2(-dx, -dz)
    walk.pitch = Math.atan2(dy, Math.hypot(dx, dz))
    walk.vy = 0
  }
  setOrbitFrom(home)

  const eyeAndTarget = (): [Vec3, Vec3] => {
    if (mode === "orbit") {
      const cp = Math.cos(orbit.pitch)
      const eye: Vec3 = [
        orbit.target[0] + Math.sin(orbit.yaw) * cp * orbit.dist,
        orbit.target[1] + Math.sin(orbit.pitch) * orbit.dist,
        orbit.target[2] + Math.cos(orbit.yaw) * cp * orbit.dist,
      ]
      return [eye, orbit.target]
    }
    const eye: Vec3 = [walk.pos[0], walk.pos[1] + EYE, walk.pos[2]]
    const cp = Math.cos(walk.pitch)
    return [eye, [eye[0] - Math.sin(walk.yaw) * cp, eye[1] + Math.sin(walk.pitch), eye[2] - Math.cos(walk.yaw) * cp]]
  }

  /* ---------------- input */
  const keys = new Set<string>()
  const pointers = new Map<number, { x: number; y: number }>()
  let pinch = 0
  let joy: { id: number; x0: number; y0: number; dx: number; dy: number } | null = null
  let dirty = true

  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "+", "=", "-"].includes(k)) {
      e.preventDefault()
      keys.add(k)
      dirty = true
    }
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
  const onBlur = () => keys.clear()
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    canvas.focus({ preventScroll: true })
    const r = canvas.getBoundingClientRect()
    if (mode === "walk" && e.pointerType === "touch" && e.clientX - r.left < r.width * 0.4 && e.clientY - r.top > r.height * 0.45 && !joy) {
      joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }
      return
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinch = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }
  const onMove = (e: PointerEvent) => {
    if (joy && e.pointerId === joy.id) {
      joy.dx = Math.max(-1, Math.min(1, (e.clientX - joy.x0) / 50))
      joy.dy = Math.max(-1, Math.min(1, (e.clientY - joy.y0) / 50))
      dirty = true
      return
    }
    const p = pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    dirty = true
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch > 0 && mode === "orbit") orbit.dist = Math.max(2, Math.min(120, orbit.dist * (pinch / d)))
      pinch = d
      return
    }
    if (mode === "orbit") {
      if (e.shiftKey || e.buttons === 2 || e.buttons === 4) {
        const s = orbit.dist * 0.0015
        const cy = Math.cos(orbit.yaw), sy = Math.sin(orbit.yaw)
        orbit.target[0] -= dx * cy * s
        orbit.target[2] += dx * sy * s
        orbit.target[1] += dy * s
      } else {
        orbit.yaw -= dx * 0.006
        orbit.pitch = Math.max(-0.1, Math.min(1.45, orbit.pitch + dy * 0.005))
      }
    } else {
      walk.yaw -= dx * 0.004
      walk.pitch = Math.max(-1.3, Math.min(1.3, walk.pitch - dy * 0.004))
    }
  }
  const onUp = (e: PointerEvent) => {
    if (joy && e.pointerId === joy.id) joy = null
    pointers.delete(e.pointerId)
    pinch = 0
  }
  const onWheel = (e: WheelEvent) => {
    if (mode !== "orbit") return
    e.preventDefault()
    orbit.dist = Math.max(2, Math.min(120, orbit.dist * Math.exp(e.deltaY * 0.001)))
    dirty = true
  }
  const onContext = (e: Event) => e.preventDefault()
  canvas.addEventListener("keydown", onKeyDown)
  canvas.addEventListener("keyup", onKeyUp)
  canvas.addEventListener("blur", onBlur)
  canvas.addEventListener("pointerdown", onDown)
  canvas.addEventListener("pointermove", onMove)
  canvas.addEventListener("pointerup", onUp)
  canvas.addEventListener("pointercancel", onUp)
  canvas.addEventListener("wheel", onWheel, { passive: false })
  canvas.addEventListener("contextmenu", onContext)

  /* ---------------- movement */
  const step = (dt: number) => {
    const k = (n: string) => keys.has(n)
    if (mode === "orbit") {
      if (k("arrowleft") || k("a")) orbit.yaw += dt * 1.2
      if (k("arrowright") || k("d")) orbit.yaw -= dt * 1.2
      if (k("arrowup") || k("w")) orbit.pitch = Math.min(1.45, orbit.pitch + dt * 0.8)
      if (k("arrowdown") || k("s")) orbit.pitch = Math.max(-0.1, orbit.pitch - dt * 0.8)
      if (k("+") || k("=") || k("e")) orbit.dist = Math.max(2, orbit.dist * (1 - dt * 1.5))
      if (k("-") || k("q")) orbit.dist = Math.min(120, orbit.dist * (1 + dt * 1.5))
      return
    }
    let fwd = 0, side = 0
    if (k("w") || k("arrowup")) fwd += 1
    if (k("s") || k("arrowdown")) fwd -= 1
    if (k("a")) side -= 1
    if (k("d")) side += 1
    if (k("arrowleft")) walk.yaw += dt * 1.8
    if (k("arrowright")) walk.yaw -= dt * 1.8
    if (joy) { fwd -= joy.dy; side += joy.dx }
    const speed = (k("shift") ? 4.2 : 2.2) * dt
    const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw)
    let mx = (-sy * fwd + cy * side) * speed, mz = (-cy * fwd - sy * side) * speed
    const len = Math.hypot(mx, mz)
    const p = walk.pos
    if (len > 1e-6) {
      const R = 0.28
      for (let iter = 0; iter < 2; iter++) {
        const l = Math.hypot(mx, mz)
        if (l < 1e-6) break
        const dx = mx / l, dz = mz / l
        let hit: { t: number; n: Vec3 } | null = null
        for (const hgt of [0.55, 1.0, 1.2]) {
          const h = collider.wallHit([p[0], p[1] + hgt, p[2]], dx, dz, l + R)
          if (h && (!hit || h.t < hit.t)) hit = h
        }
        if (!hit) break
        // slide along the wall: drop the component into it
        let nx = hit.n[0], nz = hit.n[2]
        const nl = Math.hypot(nx, nz) || 1
        nx /= nl; nz /= nl
        if (nx * dx + nz * dz > 0) { nx = -nx; nz = -nz }
        const into = mx * nx + mz * nz
        const allow = Math.max(0, hit.t - R)
        if (iter === 1) { mx = dx * allow; mz = dz * allow; break }
        mx -= nx * into
        mz -= nz * into
      }
      const nx = p[0] + mx, nz = p[2] + mz
      const f = collider.floorAt(nx, nz, p[1] + 0.45)
      // no stepping off an edge: a floor more than 0.6 m down (deck rail, balcony, stairwell) is a wall
      if (f !== null && f >= p[1] - 0.6) {
        p[0] = nx
        p[2] = nz
      }
    }
    // gravity / step up
    const f = collider.floorAt(p[0], p[2], p[1] + 0.45)
    if (f !== null) {
      if (f > p[1]) { p[1] = Math.min(f, p[1] + dt * 6); walk.vy = 0 }
      else { walk.vy -= 9.8 * dt; p[1] = Math.max(f, p[1] + walk.vy * dt); if (p[1] === f) walk.vy = 0 }
    }
  }

  /* ---------------- render */
  let w = 0, h = 0
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr)), ch = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (cw !== w || ch !== h) {
      w = cw
      h = ch
      canvas.width = w
      canvas.height = h
      dirty = true
    }
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null
  ro?.observe(canvas)
  resize()

  const draw = (time: number) => {
    if (lost) return
    resize()
    const [eye, at] = eyeAndTarget()
    const near = mode === "walk" ? 0.05 : 0.2
    const P = perspective(((mode === "walk" ? 66 : 42) * Math.PI) / 180, w / h, near, 1500)
    const VP = mul(P, lookAt(eye, at))
    gl.viewport(0, 0, w, h)
    gl.clearColor(FOG[0], FOG[1], FOG[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    // sky
    gl.disable(gl.DEPTH_TEST)
    gl.useProgram(sky)
    gl.uniformMatrix4fv(SU.uInvVP, false, invert(VP))
    gl.uniform3fv(SU.uSunDir, sunDir)
    gl.bindVertexArray(skyVao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    // scene
    gl.enable(gl.DEPTH_TEST)
    gl.useProgram(prog)
    gl.uniformMatrix4fv(U.uVP, false, VP)
    gl.uniform3fv(U.uEye, eye)
    gl.uniform1f(U.uTime, time / 1000)
    gl.uniform3fv(U.uFog, FOG)
    gl.uniform3fv(U.uSunDir, sunDir)
    gl.uniform1i(U.uTex, 0)
    const opaque = gpu.filter((g) => !g.prim.blend)
    const blended = gpu.filter((g) => g.prim.blend).sort((a, b) => {
      const da = (a.centre[0] - eye[0]) ** 2 + (a.centre[1] - eye[1]) ** 2 + (a.centre[2] - eye[2]) ** 2
      const db = (b.centre[0] - eye[0]) ** 2 + (b.centre[1] - eye[1]) ** 2 + (b.centre[2] - eye[2]) ** 2
      return db - da
    })
    for (const g of [...opaque, ...blended]) {
      const pr = g.prim
      if (pr.doubleSided || pr.blend) gl.disable(gl.CULL_FACE)
      else gl.enable(gl.CULL_FACE)
      if (pr.blend) {
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.depthMask(false)
      } else {
        gl.disable(gl.BLEND)
        gl.depthMask(true)
      }
      const modeId = pr.water ? 3 : g.tex ? 0 : pr.col ? 1 : 2
      gl.uniform1i(U.uMode, modeId)
      gl.uniform4fv(U.uColor, pr.color)
      if (g.tex) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, g.tex)
      }
      gl.bindVertexArray(g.vao)
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0)
    }
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.bindVertexArray(null)
  }

  /* ---------------- loop */
  let raf = 0, last = 0, visible = true
  const animate = opts.animate !== false
  const loop = (t: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0)
    last = t
    if (!visible || document.hidden) return
    if (keys.size || joy) step(dt)
    else if (mode === "walk") step(dt) // settle onto floors after a teleport
    if (dirty || animate) {
      draw(t)
      dirty = false
    }
  }
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true }) : null
  io?.observe(canvas)
  raf = requestAnimationFrame(loop)

  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    cancelAnimationFrame(raf)
  }
  const onRestored = () => {
    lost = false
    initGL()
    dirty = true
    last = 0
    raf = requestAnimationFrame(loop)
  }
  canvas.addEventListener("webglcontextlost", onLost)
  canvas.addEventListener("webglcontextrestored", onRestored)

  const setMode = (m: Mode) => {
    if (m === mode) return
    if (m === "walk") {
      const [eye] = eyeAndTarget()
      // drop the walker on the front deck, facing the living room, unless the orbit eye is already inside
      const deck = (opts.walkStart ? scene.views.find((v) => v.name === opts.walkStart) : undefined) ?? scene.views.find((v) => v.name === "walk") ?? scene.views.find((v) => v.name === "deck")
      const box = scene.interior ?? { min: [-8, -Infinity, -5] as Vec3, max: [8, 9, 7] as Vec3 }
      const inside = eye[0] > box.min[0] && eye[0] < box.max[0] && eye[1] > box.min[1] && eye[1] < box.max[1] && eye[2] > box.min[2] && eye[2] < box.max[2]
      if (inside) setWalkFrom({ name: "here", eye, target: orbit.target })
      else if (deck) setWalkFrom(deck)
    }
    mode = m
    dirty = true
    opts.onMode?.(m)
  }
  return {
    views: scene.views,
    triangles: scene.triangles,
    setMode,
    reset: () => {
      mode = "orbit"
      setOrbitFrom(home)
      opts.onMode?.("orbit")
      dirty = true
    },
    goTo: (name: string) => {
      const v = scene.views.find((x) => x.name === name)
      if (!v) return
      if (mode === "walk") setWalkFrom(v)
      else setOrbitFrom(v)
      dirty = true
    },
    frame: (t = 0) => draw(t),
    where: () => eyeAndTarget()[0],
    dispose: () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      canvas.removeEventListener("keydown", onKeyDown)
      canvas.removeEventListener("keyup", onKeyUp)
      canvas.removeEventListener("blur", onBlur)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("contextmenu", onContext)
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
      if (!gl.isContextLost()) {
        for (const g of gpu) {
          gl.deleteVertexArray(g.vao)
          gl.deleteBuffer(g.ibo)
          for (const b of g.bufs) gl.deleteBuffer(b)
          if (g.tex) gl.deleteTexture(g.tex)
        }
        gl.deleteProgram(prog)
        gl.deleteProgram(sky)
      }
    },
  }
}
