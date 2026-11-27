// Scene 5, dark: "Then, darkness."
//
// Idea. A truly black slide, held. Then the first stars come on along a web of gas, and the
// picture turns out to be in a mirror: we back out through the gold segments that found the
// earliest galaxy anyone has confirmed.
//
// Story parameter. `lit`, the number of stars on: 0 to 40 on a closed-form schedule in which every
// gap is a little shorter than the last (IGN). Then `phase`: the mirror's eighteen images walking
// into one (SETTLE). Nothing is accumulated; every frame is drawn from the beat clock.
//
// World rule (TSL `gasLight`, with the star table as its JS twin). The gas has no light of its
// own. Its brightness is the sum over lit stars of L / (d² + r0²), behind a front that leaves
// each star at one speed, so an ignition is a ring spreading through the web.
//
// The web. 60,000 motes drawn from the shared ripple field (engine/ui.ts `ripples`, the picture at
// the end of inflation and on fog's plate): a JS twin of that function fills a density grid, and
// the motes are sampled from its distribution with a seed. World units are ripple units, so the
// rectangle 5.333 × 3 at z = 0 is that picture's frame. Depth comes from a second noise, and it is
// multiplied by `uDepth`, which is 0 until the hand-off lands: seen square-on and flat, the motes
// are exactly the plate's hot blotches (transitions/lightsout.ts leaves them there as embers).
//
// The mirror (third beat). Two cameras. The field (motes, stars) is drawn once into its own
// target. The telescope is real geometry: 18 flat-topped hexagonal prisms in columns of 3, 4, 4, 4, 3
// with the centre missing, on a dark backplane, the aft-optics cone in the hole, a secondary on a
// tripod, a five-layer shield underneath. A segment's face shows the field target in screen space,
// displaced by that segment's own tilt, times the reflectance of gold. At t = 0 the lens is inside
// one segment with no tilt and no gold, so the frame is the field itself, and the pull back starts
// from the picture the viewer was already looking at.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp as clampN, cos, dot, exp, faceDirection, float, Fn, fwidth, If, instanceIndex, length, Loop, max, min, mix as mixN, normalGeometry, normalize, positionGeometry, pow, reflect, sin, smoothstep, sqrt, step, uniform, uniformArray, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { projectPortal } from "../engine/quad"
import { disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos, type Pos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, wrap, type TitleOpts } from "../engine/titles"
import { sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, Portal, PostOpts, SceneInstance, State } from "../engine/types"
import { comment, RIPPLE_VIEW, SELECT } from "../engine/ui"
import { HEX_BOX } from "../transitions/hex"
import { EMBER_T } from "../transitions/lightsout"

// ---------------------------------------------------------------- the ripple field, on the CPU
// (the same arithmetic as engine/tsl.ts hash21 / vnoise / fbm and engine/ui.ts ripples)
const fr = (x: number) => x - Math.floor(x)
function h21(x: number, y: number) {
  let a = fr(x * 0.1031)
  let b = fr(y * 0.1031)
  let c = a
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += d
  b += d
  c += d
  return fr((a + b) * c)
}
function vn(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = h21(ix, iy)
  const b = h21(ix + 1, iy)
  const c = h21(ix, iy + 1)
  const d = h21(ix + 1, iy + 1)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}
function fbmJ(x: number, y: number) {
  let a = 0.5
  let s = 0
  for (let i = 0; i < 5; i++) {
    s += a * vn(x, y)
    const nx = 1.6 * x - 1.2 * y
    y = 1.2 * x + 1.6 * y
    x = nx
    a *= 0.5
  }
  return s
}
/** JS twin of `ripples(p)`. */
export function ripplesJS(x: number, y: number) {
  x += 13.1
  y += 7.7
  const a = fbmJ(x * 1.3, y * 1.3)
  const b = fbmJ(x * 2.9 + a * 1.7 + 4.2, y * 2.9 + a * 1.7 + 4.2)
  return clamp((a - 0.47) * 1.5 + (b - 0.47) * 0.9 + 0.5)
}

// ---------------------------------------------------------------- measurements
const MOTES = 60000
const NS = 40 // stars
const FRAME_H = RIPPLE_VIEW // the ripple picture is 16/9·3 by 3 world units
const FOV = 30
const TANV = Math.tan((FOV * Math.PI) / 360)
const D0 = FRAME_H / 2 / TANV // from here the picture fills the frame exactly
const WEB = { x: 6.6, y: 4.0, nx: 264, ny: 160 }
const FRONT = 0.6 // world units a second: how fast a new star's light crosses the gas
const R0 = 0.3

// the ignition schedule: the first star at IGN0, every gap IGR of the one before
const IGN0 = 0.8 // the first star has the screen to itself
const IGN1 = 2.6
const IGG = 0.5
const IGR = 0.92
const ignT = (i: number) => (i === 0 ? IGN0 : IGN1 + (IGG * (1 - IGR ** (i - 1))) / (1 - IGR))
const IGN = Array.from({ length: NS }, (_, i) => ignT(i))

// ---------------------------------------------------------------- the mirror's layout
/** Flat-topped hexagons of circumradius 1, rings 1 and 2 of the grid: columns of 3, 4, 4, 4, 3. */
const PITCH = 1.0
export const MIRROR = (() => {
  const seg: { q: number; r: number; x: number; y: number; wing: number }[] = []
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++) {
      const s = -q - r
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s))
      if (ring < 1 || ring > 2) continue
      seg.push({ q, r, x: 1.5 * q * PITCH, y: Math.sqrt(3) * (r + q / 2) * PITCH, wing: Math.abs(q) === 2 ? Math.sign(q) : 0 })
    }
  return { seg, gap: 0.03, hingeX: 2.25 * PITCH, halfW: 4.0, halfH: 2.5 * Math.sqrt(3) }
})()
const NSEG = MIRROR.seg.length // 18
const HOME = MIRROR.seg.findIndex((s) => s.q === -1 && s.r === 1) // the segment the lens starts inside
const SMUDGE_SEG = MIRROR.seg.findIndex((s) => s.q === 1 && s.r === 0)
const ZS = 9.2 // the secondary stands this far in front of the primary
// One strut from above the top segment, two from the backplane below the bottom row, each of those 30
// degrees off the vertical: so their diffraction spikes fall on the hexagons' (the upright strut alone
// adds the faint level pair, as in Webb's images: Rigby et al. 2023, arXiv 2207.05632)
const STRUT_FEET: [number, number][] = [[0, 4.55], [-2.3, -3.98], [2.3, -3.98]]
const STRUT_R = 0.085
const SEC_R = 0.5
const SHIELD_Y = -5.25
const GOLDC: [number, number, number] = [1.0, 0.74, 0.3]

// the order the segments are walked in, and when each one arrives (once the whole mirror is in frame)
const WALK0 = 4.3
const WALK_STEP = 0.1
const SETTLE = (() => {
  const r = rng(77)
  const order = MIRROR.seg.map((_, i) => i).filter((i) => i !== HOME).sort((a, b) => Math.hypot(MIRROR.seg[a].x, MIRROR.seg[a].y) - Math.hypot(MIRROR.seg[b].x, MIRROR.seg[b].y) + (r() - 0.5) * 0.8)
  const at = new Array<number>(NSEG).fill(-1)
  const tilt: [number, number][] = MIRROR.seg.map(() => [0, 0])
  order.forEach((s, k) => {
    at[s] = WALK0 + k * WALK_STEP
    const a = r() * 6.2832
    const m = 0.5 + 0.5 * r()
    tilt[s] = [Math.cos(a) * m, Math.sin(a) * m]
  })
  return { at, tilt }
})()
const WING_T = 6.1 // the wings latch
const SEL_T = 7.1 // the selection box lands on the smudge
const PULL: [number, number] = [0.45, 5.6]
const DIST: [number, number] = [1.3, 20.5]

// the reviewer
const Q1 = "Is the projector off?"
const Q2 = "No."
const CPS = 17
const RV = { q1: 2.3, q1out: 5.3, q2: 6.3, q2out: 8.0 }

export function create(ctx: Ctx): SceneInstance {
  const field = ctx.target({})
  const stage = stageTarget(ctx)
  const fieldScene = new THREE.Scene()
  const fcam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 200)
  const tele = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 400)

  // ---------------------------------------------------------------- the web: a density grid, then the motes
  const R = rng(1380)
  const { nx, ny } = WEB
  const gv = new Float32Array(nx * ny)
  const gf = new Float32Array(nx * ny) // how close a cell is to a filament
  const cdf = new Float32Array(nx * ny) // the clumps: the plate's hot blotches
  const cdfF = new Float32Array(nx * ny) // the filaments that join them
  {
    // filaments: the walls between the cells of a warped Voronoi net, heavier where the field is dense
    const CELL = 1.15
    const edge = (x: number, y: number) => {
      const wx = x + (vn(x * 0.6 + 5, y * 0.6 + 9) - 0.5) * 1.1
      const wy = y + (vn(x * 0.6 + 21, y * 0.6 + 2) - 0.5) * 1.1
      const cx = Math.floor(wx / CELL)
      const cy = Math.floor(wy / CELL)
      let f1 = 9
      let f2 = 9
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          const px = (cx + a + 0.15 + 0.7 * h21(cx + a + 40, cy + b + 17)) * CELL
          const py = (cy + b + 0.15 + 0.7 * h21(cx + a + 3, cy + b + 91)) * CELL
          const d = Math.hypot(px - wx, py - wy)
          if (d < f1) {
            f2 = f1
            f1 = d
          } else if (d < f2) f2 = d
        }
      return f2 - f1
    }
    let acc = 0
    let accF = 0
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = ((i + 0.5) / nx - 0.5) * 2 * WEB.x
        const y = ((j + 0.5) / ny - 0.5) * 2 * WEB.y
        const v = ripplesJS(x, y)
        gv[j * nx + i] = v
        const k = smooth(0.4, 0.9, v)
        acc += k * k * (0.35 + k) + 0.004
        cdf[j * nx + i] = acc
        const e = edge(x, y)
        const f = Math.exp(-(e * e) / 0.0015)
        gf[j * nx + i] = f
        accF += f * (0.12 + smooth(0.25, 0.8, v)) + 0.003
        cdfF[j * nx + i] = accF
      }
  }
  // the fold of the sheet in depth; `br` picks one of three leaves so that turned, it is a web and not a film
  const depthAt = (x: number, y: number, br: number) => {
    const a = (vn(x * 0.5 + 31, y * 0.5 + 7) - 0.5) * 2.4 + (vn(x * 1.6 + 3, y * 1.6 + 11) - 0.5) * 0.8
    if (br === 0) return a
    const b = (vn(x * 0.42 + 71 * br, y * 0.42 + 13) - 0.5) * 2.2
    return (br === 1 ? 1.25 : -1.35) + b - a * 0.35
  }
  const leafAt = (x: number, y: number) => {
    const n = vn(x * 0.33 + 50, y * 0.33 + 60)
    return n < 0.42 ? 1 : n > 0.6 ? 2 : 0
  }
  const moteGeo = new THREE.InstancedBufferGeometry()
  moteGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  moteGeo.setIndex([0, 1, 2, 0, 2, 3])
  {
    const aP = new Float32Array(MOTES * 4)
    const aS = new Float32Array(MOTES * 4)
    for (let m = 0; m < MOTES; m++) {
      const fil = m % 20 < 13 // 65% of the gas is in filaments
      const table = fil ? cdfF : cdf
      const u = R() * table[table.length - 1]
      let lo = 0
      let hi = table.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (table[mid] < u) lo = mid + 1
        else hi = mid
      }
      const x = (((lo % nx) + R()) / nx - 0.5) * 2 * WEB.x
      const y = ((Math.floor(lo / nx) + R()) / ny - 0.5) * 2 * WEB.y
      const v = gv[lo]
      // whole strands share a leaf, so a filament is one line in depth and its neighbour may be far behind it
      const br = fil || R() < 0.7 ? leafAt(x, y) : Math.floor(R() * 3)
      const g = (R() + R() + R() - 1.5) * 0.9
      aP[m * 4] = x
      aP[m * 4 + 1] = y
      aP[m * 4 + 2] = depthAt(x, y, br) + g * (fil ? 0.05 : 0.1 + 0.45 * (1 - v))
      aP[m * 4 + 3] = v
      aS[m * 4] = fil ? R() * 0.5 : 0.5 + R() * 0.5 // below a half: a filament mote; the top of the range: a big soft puff
      aS[m * 4 + 1] = R()
      aS[m * 4 + 2] = R()
      aS[m * 4 + 3] = R()
    }
    moteGeo.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4))
    moteGeo.setAttribute("aS", new THREE.InstancedBufferAttribute(aS, 4))
    moteGeo.instanceCount = MOTES
  }

  // ---------------------------------------------------------------- the stars: density maxima, lit along the web
  const stars: { x: number; y: number; z: number; L: number }[] = []
  {
    const cand: { x: number; y: number; v: number }[] = []
    for (let j = 2; j < ny - 2; j += 2)
      for (let i = 2; i < nx - 2; i += 2) {
        const x = ((i + 0.5) / nx - 0.5) * 2 * WEB.x
        const y = ((j + 0.5) / ny - 0.5) * 2 * WEB.y
        if (Math.abs(x) > 4.3 || Math.abs(y) > 2.35) continue
        cand.push({ x, y, v: 0.6 * gv[j * nx + i] + 0.5 * gf[j * nx + i] + 0.02 * R() })
      }
    cand.sort((a, b) => b.v - a.v)
    const picked: { x: number; y: number }[] = []
    for (const c of cand) {
      if (picked.length >= NS) break
      if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > 0.62)) picked.push(c)
    }
    // the first is the one nearest a point right of centre; each next is the unlit one nearest anything lit
    const left = picked.slice()
    const take = (k: number) => {
      const p = left.splice(k, 1)[0]
      stars.push({ x: p.x, y: p.y, z: depthAt(p.x, p.y, leafAt(p.x, p.y)), L: 0.55 + 1.1 * R() * R() + (stars.length === 0 ? 0.6 : 0) })
    }
    let k0 = 0
    left.forEach((p, k) => {
      if (Math.hypot(p.x - 0.9, p.y - 0.15) < Math.hypot(left[k0].x - 0.9, left[k0].y - 0.15)) k0 = k
    })
    take(k0)
    while (left.length && stars.length < NS) {
      let best = 0
      let bd = 1e9
      left.forEach((p, k) => {
        let d = 1e9
        for (const s of stars) d = Math.min(d, Math.hypot(s.x - p.x, s.y - p.y))
        if (d < bd) {
          bd = d
          best = k
        }
      })
      take(best)
    }
    while (stars.length < NS) stars.push({ x: 0, y: 0, z: 0, L: 0 })
  }
  const starV = stars.map((s) => new THREE.Vector4(s.x, s.y, s.z, s.L))
  const ages = new Array<number>(NS).fill(-1)
  const uStar = uniformArray(starV, "vec4")
  const uAge = uniformArray(ages, "float")

  // ---------------------------------------------------------------- uniforms
  const U = {
    uDepth: uniform(0), // 0: the web is flat (the plate); 1: it has its depth
    uShove: uniform(0), // the knock the hand-off gives it
    uLoose: uniform(1), // gravity: the motes close on the filaments
    uEmber: uniform(0), // glow left over from the plate
    uEmberT: uniform(EMBER_T),
    uAmb: uniform(1), // the gas at the edge of visibility
    uFocus: uniform(D0),
    uAp: uniform(0), // aperture: how fast a mote goes soft off the focal plane
    uPx: uniform(1000), // pixels per world unit at depth 1
    uMinPx: uniform(1.1), // no mote is drawn smaller than this (more when the mirror minifies the field)
    uSpike: uniform(0), // the telescope's diffraction spikes
    uGain: uniform(1),
    uSmudge: uniform(0),
    uSmAt: uniform(new THREE.Vector2()),
    uAsp: uniform(16 / 9),
  }
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const mat = (vertex: THREE.Node | null, fragment: THREE.Node, o: THREE.MaterialParameters = {}) => {
    const m = new THREE.NodeMaterial()
    if (vertex) m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    m.setValues(o)
    return m
  }
  const ADD: THREE.MaterialParameters = { depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }
  const sq = (x: F): F => x.mul(x) as F

  // ---------------------------------------------------------------- the world rule
  // what the lit stars send to a point: x = steady light (inverse square, behind the front), y = the front itself
  const gasLight = Fn(([P]: [V3]) => {
    const acc = vec2(0).toVar()
    Loop(NS, ({ i }) => {
      const age = (uAge.element(i) as unknown as F).toVar()
      If(age.greaterThan(0), () => {
        const s = (uStar.element(i) as unknown as V4).toVar()
        const d = P.sub(s.xyz).toVar()
        const d2 = dot(d, d).toVar()
        const r = sqrt(d2).toVar()
        const front = age.mul(FRONT).toVar()
        const inside = clampN(front.sub(r).div(front.mul(0.06).add(0.05)), 0, 1)
        const rim = exp(sq(r.sub(front).div(front.mul(0.045).add(0.035)) as F).negate()).div(front.mul(front).mul(0.5).add(0.25))
        const flash = exp(age.mul(-2.6)).mul(2.2).add(1)
        acc.addAssign(vec2(inside.mul(flash).div(d2.add(R0 * R0)), rim).mul(s.w))
      })
    })
    return acc
  })
  const heat = Fn(([t_]: [F]) => {
    const t = clampN(t_, 0, 1.5).toVar()
    const t2 = t.mul(t).toVar()
    return vec3(1, t.mul(0.14).add(t2.mul(0.5)), t2.mul(0.05).add(t2.mul(t2).mul(0.25))).mul(t2)
  }).setLayout({ name: "emberHeat", type: "vec3", inputs: [{ name: "t", type: "float" }] })

  // ---------------------------------------------------------------- motes
  const MT = (() => {
    const aP = attribute("aP", "vec4")
    const aS = attribute("aS", "vec4")
    const v = aP.w
    const big = step(0.978, aS.x)
    const filF = step(aS.x, 0.5)
    const loose = aS.zw.sub(0.5).mul(U.uLoose).mul(v.oneMinus().mul(0.5).add(0.06))
    const c = vec3(aP.xy.add(loose).mul(U.uShove.add(1)), aP.z.mul(U.uDepth)).toVar()
    const vc0 = cameraViewMatrix.mul(vec4(c, 1)).toVar()
    const depth = max(vc0.z.negate(), 0.01).toVar()
    const size = mixN(aS.y.mul(aS.y).mul(mixN(0.0095, 0.006, filF)).add(0.004), aS.y.mul(0.3).add(0.16), big).toVar()
    const ppu = U.uPx.div(depth).toVar()
    const rpx = clampN(size.add(U.uAp.mul(abs(depth.sub(U.uFocus)))).mul(ppu), U.uMinPx, 34).toVar()
    const rw = rpx.div(ppu)
    const gain = min(sq(size.mul(ppu).div(rpx) as F), 1).mul(smoothstep(0.2, 0.9, depth))
    const li = gasLight(c).toVar()
    // cold white behind the front; the front itself a little violet, the way hot stars light hydrogen
    const lit = vec3(0.7, 0.83, 1.0).mul(li.x.div(li.x.mul(0.3).add(1))).mul(0.2).add(vec3(0.62, 0.48, 1.0).mul(li.y).mul(0.95))
    const amb = vec3(0.6, 0.66, 0.8).mul(U.uAmb).mul(v.mul(0.75).add(0.25)).mul(0.013)
    const emb = heat(v.mul(U.uEmberT).mul(aS.y.mul(0.16).add(0.92)) as F).mul(U.uEmber).mul(3.8)
    const col = lit.mul(mixN(v.mul(v).mul(1.0).add(0.05), float(1.25), filF)).add(amb).mul(mixN(1, 0.012, big)).add(emb.mul(mixN(1, 0.006, big))).mul(gain).mul(aS.w.mul(0.9).add(0.55)).mul(U.uGain)
    const q = positionGeometry.xy
    return { clip: cameraProjectionMatrix.mul(vec4(vc0.xy.add(q.mul(rw)), vc0.z, vc0.w)), vQ: q.toVarying("dkQ"), vC: col.toVarying("dkC") }
  })()
  const motes = new THREE.Mesh(moteGeo, mat(MT.clip, vec4(MT.vC.mul(max(exp(dot(MT.vQ, MT.vQ).mul(-3.4)).sub(0.035), 0)), 1), ADD))
  motes.frustumCulled = false
  fieldScene.add(motes)

  // ---------------------------------------------------------------- stars
  // A star is a point with a halo. Seen through the telescope it grows the telescope's own spikes:
  // three pairs across the hexagons' edges, and a short level pair from the strut that stands upright.
  const starGeo = new THREE.InstancedBufferGeometry()
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  starGeo.setIndex([0, 1, 2, 0, 2, 3])
  starGeo.instanceCount = NS
  const ST = (() => {
    const s = uStar.element(instanceIndex) as unknown as V4
    const age = uAge.element(instanceIndex) as unknown as F
    const c = vec3(s.xy.mul(U.uShove.add(1)), s.z.mul(U.uDepth))
    const vc0 = cameraViewMatrix.mul(vec4(c, 1))
    const on = step(0, age)
    // before it lights, a dull red knot of collapsing gas
    const pre = smoothstep(-0.9, 0, age).mul(on.oneMinus())
    const hs = mixN(0.22, 1.25, U.uSpike).mul(s.w.mul(0.3).add(0.7)).mul(max(on, pre.mul(0.4)))
    const I = s.w.mul(on).mul(exp(max(age, 0).mul(-3.2)).mul(7).add(1)).mul(U.uGain)
    const q = positionGeometry.xy
    return { clip: cameraProjectionMatrix.mul(vec4(vc0.xy.add(q.mul(hs)), vc0.z, vc0.w)), vQ: q.toVarying("stQ"), vI: vec3(I, pre.mul(s.w), hs).toVarying("stI"), vD: vc0.z.negate().toVarying("stD") }
  })()
  const starFrag = Fn(() => {
    const q = ST.vQ.toVar()
    const hs = ST.vI.z
    const p = q.mul(hs).toVar()
    const r2 = dot(p, p).toVar()
    const win = sq(sq(clampN(dot(q, q).oneMinus(), 0, 1)) as F).toVar()
    // never thinner than a pixel and a half
    const px = ST.vD.div(U.uPx).mul(1.5)
    const cw = max(float(0.007), px).toVar()
    const core = exp(r2.div(cw.mul(cw)).negate()).mul(16).mul(sq(float(0.007).div(cw)))
    const halo = float(0.00011).div(r2.add(0.00012))
    const col = vec3(0.72, 0.84, 1.0).mul(core.add(halo)).mul(ST.vI.x).toVar()
    col.addAssign(vec3(1.0, 0.2, 0.05).mul(exp(r2.mul(-900))).mul(ST.vI.y).mul(0.5))
    If(U.uSpike.greaterThan(0), () => {
      const sp = float(0).toVar()
      const line = (dx: number, dy: number, gain: number, len: number) => {
        const al = abs(p.x.mul(dx).add(p.y.mul(dy)))
        const ac = abs(p.x.mul(dy).sub(p.y.mul(dx)))
        const w = max(float(0.0035), px.mul(0.7)).add(al.mul(0.006))
        sp.addAssign(exp(ac.div(w).negate()).mul(gain).div(al.mul(len).add(0.03)))
      }
      line(0, 1, 1, 14) // across the level edges
      line(0.8660254, 0.5, 1, 14) // across the edges at 60 degrees
      line(-0.8660254, 0.5, 1, 14)
      line(1, 0, 0.42, 40) // the upright strut
      // a little colour along a spike: longer wavelengths spread further
      col.addAssign(mixN(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.8, 0.6), smoothstep(0.02, 0.7, sqrt(r2))).mul(sp).mul(ST.vI.x).mul(U.uSpike).mul(0.22))
    })
    return vec4(col.mul(win), 1)
  })()
  const starMesh = new THREE.Mesh(starGeo, mat(ST.clip, starFrag, ADD))
  starMesh.frustumCulled = false
  starMesh.renderOrder = 2
  fieldScene.add(starMesh)

  // the smudge: far enough away to have no parallax, so it is placed in the picture, not the world
  const smudge = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3)),
    mat(
      vec4(U.uSmAt.add(positionGeometry.xy.mul(vec2(float(0.035).div(U.uAsp), 0.035))), 0, 1),
      Fn(() => {
        const q = positionGeometry.xy.toVarying("smQ")
        const a = vec2(q.x.mul(0.88).add(q.y.mul(0.47)), q.y.mul(0.88).sub(q.x.mul(0.47))).toVar()
        const g = exp(a.x.mul(a.x).mul(9).add(a.y.mul(a.y).mul(26)).negate()).add(exp(dot(a.sub(vec2(0.2, 0.04)), a.sub(vec2(0.2, 0.04))).mul(-60)).mul(0.7))
        return vec4(vec3(1.0, 0.16, 0.06).mul(g).mul(U.uSmudge).mul(2.4), 1)
      })(),
      ADD,
    ),
  )
  smudge.frustumCulled = false
  smudge.renderOrder = 3
  fieldScene.add(smudge)

  // ================================================================ the telescope
  const T = {
    tF: uniformTexture(field.texture),
    uGold: uniform(0), // 0: the face shows the field as it is; 1: it is gold
    uMc: uniform(new THREE.Vector2(0.5, 0.5)), // the point of the screen the reflection is hung from
    uK: uniform(1), // how much of the field the mirror takes in
    uWing: uniform(0),
    uSheen: uniform(-1), // a strip of light crossing the gold as the lens crosses the plane
    uCam: uniform(new THREE.Vector3()),
    uGlow: uniform(0.5),
  }
  const tiltV = MIRROR.seg.map(() => new THREE.Vector4())
  const uTilt = uniformArray(tiltV, "vec4") // xy: tilt left to settle, z: 1 while unsettled
  const GOLD = vec3(...GOLDC)
  const KEY = normalize(vec3(-0.5, 0.55, 0.67))
  const env = (r: V3): V3 => {
    const strip = exp(sq(r.y.sub(0.35).mul(3.2) as F).negate()).mul(smoothstep(-0.9, 0.5, r.x.negate()))
    return vec3(0.34, 0.42, 0.6).mul(strip.mul(0.28).add(smoothstep(-0.3, 1, r.y).mul(0.02))) as V3
  }

  // --- segments: one geometry, 18 prisms, each vertex knowing its segment
  const segGeo = (() => {
    const pos: number[] = []
    const nor: number[] = []
    const sg: number[] = []
    const kind: number[] = []
    const Tk = 0.11
    const bev = 0.05
    const k = 1 - MIRROR.gap
    const ring = (rad: number, z: number) => Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * rad * k, Math.sin((i * Math.PI) / 3) * rad * k, z])
    const top = ring(1 - bev, Tk)
    const mid = ring(1, Tk - bev * 0.7)
    const bot = ring(1, -Tk)
    MIRROR.seg.forEach((s, id) => {
      const tri = (a: number[], b: number[], c: number[], kd: number) => {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
        const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
        const l = Math.hypot(n[0], n[1], n[2]) || 1
        for (const p of [a, b, c]) {
          pos.push(p[0], p[1], p[2])
          nor.push(n[0] / l, n[1] / l, n[2] / l)
          sg.push(s.x, s.y, id, s.wing)
          kind.push(kd)
        }
      }
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6
        tri([0, 0, Tk], top[i], top[j], 0)
        tri(top[i], mid[i], mid[j], 1)
        tri(top[i], mid[j], top[j], 1)
        tri(mid[i], bot[i], bot[j], 2)
        tri(mid[i], bot[j], mid[j], 2)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute("aSeg", new THREE.Float32BufferAttribute(sg, 4))
    g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1))
    return g
  })()
  const SG = (() => {
    const aSeg = attribute("aSeg", "vec4")
    const tl = (uTilt.element(aSeg.z.add(0.5).toInt()) as unknown as V4).toVar()
    const TA = 0.085 // radians of tilt at full error
    const tx = tl.x.mul(TA)
    const ty = tl.y.mul(TA)
    const lp = positionGeometry
    const ln = normalGeometry
    // a small rotation about the segment's own centre, and a little piston with it
    const p = vec3(lp.x.sub(tx.mul(lp.z)), lp.y.sub(ty.mul(lp.z)), lp.z.add(tx.mul(lp.x)).add(ty.mul(lp.y)).sub(tl.z.mul(0.05)))
    const n = vec3(ln.x.sub(tx.mul(ln.z)), ln.y.sub(ty.mul(ln.z)), ln.z.add(tx.mul(ln.x)).add(ty.mul(ln.y)))
    const wp = vec3(aSeg.xy, 0).add(p)
    // the wings: the outer columns swing on an upright hinge
    const h = aSeg.w
    const w = T.uWing.mul(abs(h))
    const cw = cos(w)
    const sw = sin(w)
    const u = wp.x.sub(h.mul(MIRROR.hingeX)).mul(h)
    const P = vec3(mixN(wp.x, h.mul(MIRROR.hingeX).add(h.mul(u.mul(cw).add(wp.z.mul(sw)))), abs(h)), wp.y, mixN(wp.z, wp.z.mul(cw).sub(u.mul(sw)), abs(h))).toVar()
    const nu = n.x.mul(h)
    const N = vec3(mixN(n.x, h.mul(nu.mul(cw).add(n.z.mul(sw))), abs(h)), n.y, mixN(n.z, n.z.mul(cw).sub(nu.mul(sw)), abs(h)))
    const clip = viewProj.mul(vec4(P, 1)).toVar()
    return { clip, vP: P.toVarying("sgP"), vN: N.toVarying("sgN"), vClip: clip.toVarying("sgClip"), vT: vec4(tl.xy, h, attribute("aKind", "float")).toVarying("sgT") }
  })()
  // the tripod and the secondary, as the gold sees them: how much of a reflected ray they block
  const blocked = Fn(([P, Rr]: [V3, V3]) => {
    const occ = float(0).toVar()
    const k = Rr.xy.div(max(Rr.z, 0.05)).toVar() // the ray's drift in xy per unit of height
    for (const f of STRUT_FEET) {
      const foot = vec2(f[0], f[1])
      const d0 = P.xy.sub(foot).toVar()
      const d1 = k.add(foot.div(ZS)).toVar()
      const z = clampN(dot(d0, d1).negate().div(dot(d1, d1)), 0, ZS).toVar()
      const dist = length(d0.add(d1.mul(z)))
      occ.assign(max(occ, smoothstep(STRUT_R * 0.9, STRUT_R * 2.6, dist).oneMinus()))
    }
    const ds = length(P.xy.add(k.mul(ZS)))
    return max(occ, smoothstep(SEC_R * 0.9, SEC_R * 1.25, ds).oneMinus())
  })
  const segFrag = Fn(() => {
    const uv = SG.vClip.xy.div(SG.vClip.w).mul(0.5).add(0.5).toVar()
    const N = normalize(SG.vN).toVar()
    const V = normalize(SG.vP.sub(T.uCam)).toVar()
    const kind = SG.vT.w
    const face = step(kind, 0.5)
    const side = step(1.5, kind)
    // the picture in this segment: the field, hung from uMc, displaced by what is left of the tilt
    const off = SG.vT.xy.mul(0.105).add(vec2(SG.vT.z.mul(T.uWing).mul(-0.5), 0)).add(N.xy.mul(face.oneMinus()).mul(0.2))
    const uvF = uv.sub(T.uMc).mul(T.uK).add(0.5).add(off).toVar()
    const inF = smoothstep(0, 0.03, uvF.x).mul(smoothstep(0, 0.03, uvF.y)).mul(smoothstep(0, 0.03, uvF.x.oneMinus())).mul(smoothstep(0, 0.03, uvF.y.oneMinus()))
    const Fc = sampleRT(T.tF, clampN(uvF, 0, 1) as V2).rgb.mul(mixN(1, inF, T.uGold)).toVar()
    const tint = mixN(vec3(1), GOLD.mul(1.12), T.uGold)
    const col = Fc.mul(tint).toVar()
    If(T.uGold.greaterThan(0), () => {
      const Rr = reflect(V, N).toVar()
      const fres = pow(clampN(dot(N, V).negate(), 0, 1).oneMinus(), 5)
      const sheen = exp(sq(uv.x.add(uv.y.mul(0.35)).sub(T.uSheen).div(0.11) as F).negate())
      const extra = env(Rr).mul(GOLD).mul(fres.mul(1.6).add(0.9)).add(GOLD.mul(sheen).mul(0.5)).add(GOLD.mul(T.uGlow).mul(smoothstep(-0.6, 0.6, Rr.y).oneMinus().mul(0.05).add(0.022)))
      const occ = blocked(SG.vP, Rr)
      col.assign(col.add(extra.mul(T.uGold)).mul(occ.mul(0.93).mul(T.uGold).oneMinus()))
      // the bevel catches the cold light; the sides are in shadow
      const bevel = GOLD.mul(max(dot(N, KEY), 0).mul(0.55).add(0.05)).mul(vec3(0.5, 0.58, 0.75)).add(col.mul(0.35))
      col.assign(mixN(col, mixN(bevel, vec3(0.004, 0.004, 0.006), side), face.oneMinus().mul(T.uGold)))
    })
    return vec4(col, 1)
  })()
  const segs = new THREE.Mesh(segGeo, mat(SG.clip, segFrag))
  segs.frustumCulled = false
  tele.add(segs)

  // --- everything that is not gold: one dark material, lit by the field in front and the gold behind
  const hardMat = (base: [number, number, number], gloss: number, side: THREE.Side = THREE.FrontSide) => {
    const vP = positionGeometry.toVarying("hwP")
    const vN = normalGeometry.toVarying("hwN")
    return mat(
      viewProj.mul(vec4(positionGeometry, 1)),
      Fn(() => {
        const N = normalize(vN).toVar()
        const V = normalize(vP.sub(T.uCam)).toVar()
        const b = vec3(...base)
        const key = max(dot(N, KEY), 0)
        // gold light from the mirror: on whatever faces it, falling off with distance from its centre
        const toM = vec3(0, 0, 0.5).sub(vP).toVar()
        const gold = GOLD.mul(T.uGlow).mul(max(dot(N, normalize(toM)), 0)).mul(float(9).div(dot(toM, toM).add(14))).mul(T.uGold)
        const rim = pow(clampN(dot(N, V).add(1), 0, 1), 3)
        const col = b.mul(vec3(0.5, 0.6, 0.8).mul(key.mul(0.5).add(0.04)).add(gold)).add(env(reflect(V, N) as V3).mul(gloss).mul(rim.mul(2).add(0.3)))
        return vec4(col, 1)
      })(),
      { side },
    )
  }
  const geos: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, m: THREE.Material, into: THREE.Object3D = tele) => {
    geos.push(g)
    const o = new THREE.Mesh(g, m)
    o.frustumCulled = false
    into.add(o)
    return o
  }
  const carbon = hardMat([0.05, 0.05, 0.06], 0.5)
  const black = hardMat([0.012, 0.012, 0.014], 0.9)
  // the backplane: a dark hexagon behind every segment (it shows in the gaps), the frame's edge beams, the aft-optics cone
  {
    const hexShape = new THREE.Shape(Array.from({ length: 6 }, (_, i) => new THREE.Vector2(Math.cos((i * Math.PI) / 3) * 1.06, Math.sin((i * Math.PI) / 3) * 1.06)))
    for (const s of MIRROR.seg) {
      if (s.wing) continue
      add(new THREE.ExtrudeGeometry(hexShape, { depth: 0.5, bevelEnabled: false }).translate(s.x, s.y, -0.72), carbon)
    }
    add(new THREE.ExtrudeGeometry(hexShape, { depth: 0.5, bevelEnabled: false }).translate(0, 0, -0.72), carbon)
    // the cone that stands in the missing centre, and its baffle
    add(new THREE.CylinderGeometry(0.34, 0.78, 1.7, 6, 1).rotateX(Math.PI / 2).translate(0, 0, 0.62), black)
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 24).rotateX(Math.PI / 2).translate(0, 0, 1.5), carbon)
    // truss behind, seen past the edges once the lens is off axis
    for (const y of [-3.2, 0, 3.2]) add(new THREE.BoxGeometry(6.4, 0.16, 0.16).translate(0, y, -1.4), carbon)
    for (const x of [-2.2, 0, 2.2]) add(new THREE.BoxGeometry(0.16, 8.2, 0.16).translate(x, 0, -1.4), carbon)
    for (const [x, y] of [[-2.2, -3.2], [2.2, -3.2], [-2.2, 3.2], [2.2, 3.2], [0, 0]]) add(new THREE.BoxGeometry(0.12, 0.12, 0.8).translate(x, y, -1.0), carbon)
    // the stand down to the shield
    add(new THREE.BoxGeometry(1.5, 1.3, 1.1).translate(0, SHIELD_Y + 0.62, -0.9), carbon)
    add(new THREE.CylinderGeometry(0.2, 0.26, 1.2, 10).translate(-1.2, SHIELD_Y + 0.6, -0.4), carbon)
    add(new THREE.CylinderGeometry(0.2, 0.26, 1.2, 10).translate(1.2, SHIELD_Y + 0.6, -0.4), carbon)
  }
  // the tripod and the secondary
  {
    const apex = new THREE.Vector3(0, 0, ZS)
    const up = new THREE.Vector3(0, 1, 0)
    for (const f of STRUT_FEET) {
      const a = new THREE.Vector3(f[0], f[1], 0.1)
      const len = a.distanceTo(apex)
      const g = new THREE.CylinderGeometry(STRUT_R * 0.8, STRUT_R, len, 8, 1)
      const q = new THREE.Quaternion().setFromUnitVectors(up, apex.clone().sub(a).normalize())
      g.applyQuaternion(q).translate((a.x + apex.x) / 2, (a.y + apex.y) / 2, (a.z + apex.z) / 2)
      add(g, black)
      // the foot: a pad on the backplane truss, and its hinge block
      add(new THREE.BoxGeometry(0.34, 0.34, 1.5).translate(f[0], f[1], -0.62), carbon)
      add(new THREE.BoxGeometry(0.26, 0.26, 0.3).translate(f[0], f[1], 0.18), black)
    }
    add(new THREE.CylinderGeometry(SEC_R, SEC_R * 0.86, 0.3, 28).rotateX(Math.PI / 2).translate(0, 0, ZS + 0.12), black)
    add(new THREE.CylinderGeometry(SEC_R * 1.12, SEC_R * 1.12, 0.05, 28).rotateX(Math.PI / 2).translate(0, 0, ZS - 0.04), carbon)
  }
  // the shield: five Kapton membranes on six spreader bars (the fore and aft pallets' four corners and the
  // two mid-boom tips), an elongated hexagon about one and a half times as long as it is wide. Each layer
  // is pulled out to its six corners, so its edges sag inward between them (catenary edges, hemmed and
  // doubled over); the layers lie close over the core and part toward the rim, widest at the bars. The
  // pull at each corner fans out into the sheet as a spray of tension wrinkles; stowage left straight
  // fold creases and the sheet is crinkled all over. Every face is aluminised (silver) except the
  // undersides of the two sun-side layers, which carry the doped-silicon coat (the purple): it shows on
  // their hems and wherever the film turns.
  {
    const SC: [number, number][] = [[-2.6, 15.5], [2.6, 15.5], [9.4, 1.75], [2.6, -12], [-2.6, -12], [-9.4, 1.75]]
    const OC: [number, number] = [0, 1.75]
    const SUB = 24
    const RINGS = 22
    const sepAt = (layer: number, u: number, cw: number) => SHIELD_Y - layer * (0.05 + 0.44 * u * u * u * (0.5 + 0.5 * cw))
    const cornerAt = (layer: number, k: number): [number, number] => {
      const g = 1 + layer * 0.026
      return [OC[0] + (SC[k][0] - OC[0]) * g, OC[1] + (SC[k][1] - OC[1]) * g]
    }
    const membrane = (layer: number) => {
      const C = SC.map((_, k) => cornerAt(layer, k))
      // the rim: catenary edges between the corners, and how near each rim point is to a corner
      const rim: [number, number, number][] = []
      C.forEach((a, i) => {
        const b = C[(i + 1) % C.length]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        let nx = -(b[1] - a[1]) / len
        let nz = (b[0] - a[0]) / len
        const mx = (a[0] + b[0]) / 2 - OC[0]
        const mz = (a[1] + b[1]) / 2 - OC[1]
        if (nx * mx + nz * mz > 0) {
          nx = -nx
          nz = -nz
        }
        for (let k = 0; k < SUB; k++) {
          const s = k / SUB
          const sag = 0.05 * len * 4 * s * (1 - s)
          const cw = Math.max(Math.exp((-s * len) / 2.4), Math.exp((-(1 - s) * len) / 2.4))
          rim.push([a[0] + (b[0] - a[0]) * s + nx * sag, a[1] + (b[1] - a[1]) * s + nz * sag, cw])
        }
      })
      const pos: number[] = []
      const edge: number[] = []
      const idx: number[] = []
      const NR = rim.length
      for (let i = 0; i < NR; i++)
        for (let r = 0; r <= RINGS; r++) {
          const u = 1 - Math.pow(1 - r / RINGS, 1.45)
          const [rx, rz, rcw] = rim[i]
          const x = OC[0] + (rx - OC[0]) * u
          const z = OC[1] + (rz - OC[1]) * u
          const cw = rcw * u * u
          let y = sepAt(layer, u, cw)
          // tension wrinkles: a fan from each corner, fading into the sheet
          for (let k = 0; k < C.length; k++) {
            const dx = x - C[k][0]
            const dz = z - C[k][1]
            const d = Math.hypot(dx, dz)
            if (d < 1e-4) continue
            const bx = OC[0] - C[k][0]
            const bz = OC[1] - C[k][1]
            const bl = Math.hypot(bx, bz)
            const ph = Math.atan2((bx * dz - bz * dx) / bl, (bx * dx + bz * dz) / bl)
            const fan = smooth(1.15, 0.35, Math.abs(ph))
            y += 0.085 * Math.exp(-d / 3.1) * (1 - Math.exp(-d / 0.3)) * fan * Math.sin(ph * (14 + (k % 2) * 4) + k * 2.1 + layer * 1.3 + d * 0.35)
          }
          // the slack between bars: a soft ripple along the hem
          const e = Math.max((u - 0.78) / 0.22, 0)
          y += 0.045 * e * e * (1 - rcw) * Math.sin(i * 1.35 + layer * 2.3)
          pos.push(x, y, z)
          edge.push(u, cw)
        }
      for (let i = 0; i < NR; i++) {
        const j = (i + 1) % NR
        for (let r = 0; r < RINGS; r++) {
          const a = i * (RINGS + 1) + r
          const b = j * (RINGS + 1) + r
          idx.push(a, b + 1, a + 1, a, b, b + 1)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute("aE", new THREE.Float32BufferAttribute(edge, 2))
      g.setIndex(idx)
      g.computeVertexNormals()
      return g
    }
    const vE = attribute("aE", "vec2").toVarying("shE")
    const vP = positionGeometry.toVarying("shP")
    const vN = normalGeometry.toVarying("shN")
    const shMat = (layer: number) =>
      mat(
        viewProj.mul(vec4(positionGeometry, 1)),
        Fn(() => {
          const V = normalize(vP.sub(T.uCam)).toVar()
          const back = faceDirection.lessThan(0)
          const N0 = normalize(vN).mul(faceDirection).toVar()
          // crinkle and fold creases, each only as fine as a pixel can hold
          const fp = max(fwidth(vP.x), fwidth(vP.z)).toVar()
          const fine = smoothstep(0.06, 0.015, fp)
          const cr = vec2(vnoise(vP.xz.mul(5.3).add(layer * 3.7)), vnoise(vP.xz.mul(5.3).add(vec2(17.1, 4.3 + layer)))).sub(0.5).mul(0.34).mul(fine)
          // (the folds are not a grid: each strip's crease sits where it fell, some are mountains, some
          // valleys, some pulled out, and each one runs out somewhere along its length)
          const crease = (c: F, along: F, step_: number, seed: number) => {
            const k = c.floor()
            const h = vnoise(vec2(k.mul(1.37).add(seed), seed * 3.1 + layer * 5.3)).toVar()
            const f = c.fract().sub(h.sub(0.5).mul(0.55).add(0.5))
            const runs = smoothstep(0.38, 0.55, vnoise(vec2(along.mul(0.3).add(k.mul(4.1)), seed + layer)))
            const dir = step(0.5, vnoise(vec2(k.mul(2.9).add(seed), 7.7 + layer))).mul(2).sub(1)
            return exp(abs(f).mul(step_).div(0.045).negate()).mul(f.sign()).mul(dir).mul(smoothstep(0.25, 0.6, h)).mul(runs)
          }
          const fold = smoothstep(0.09, 0.025, fp)
          const crz = crease(vP.z.div(1.75).add(layer * 0.13) as F, vP.x as F, 1.75, 1).mul(0.45).mul(fold)
          const crx = crease(vP.x.div(2.35).add(layer * 0.21) as F, vP.z as F, 2.35, 9).mul(0.3).mul(fold)
          const N = normalize(N0.add(vec3(cr.x.add(crx), 0, cr.y.add(crz)).mul(faceDirection))).toVar()
          const Rr = reflect(V, N).toVar()
          const cosT = clampN(dot(N, V).negate(), 0, 1).toVar()
          // aluminised Kapton: silver, a violet cast as the angle grazes; the sun-side undersides purple
          const film = cos(cosT.mul(8.5).add(layer * 0.7)).mul(0.5).add(0.5)
          const silver = mixN(vec3(0.86, 0.88, 0.95), vec3(0.66, 0.5, 0.92), film.mul(cosT.oneMinus()).mul(0.75))
          const tint = layer >= 3 ? mixN(silver, vec3(0.6, 0.3, 0.78), back.select(float(1), float(0))) : silver
          const fres = pow(cosT.oneMinus(), 4).mul(0.6).add(0.4)
          // what it mirrors: the gold standing on it
          const t = vP.z.negate().div(min(Rr.z, -1e-3))
          const hit = vP.add(Rr.mul(t)).toVar()
          const inM = smoothstep(3.3, 4.6, length(hit.xy.mul(vec2(1.05, 0.95)))).oneMinus().mul(step(0, t)).mul(smoothstep(SHIELD_Y, SHIELD_Y + 1.5, hit.y))
          // seams: gores welded along straight lines
          const sx = abs(vP.x.div(1.9).fract().sub(0.5))
          const seam = smoothstep(0, fp.mul(0.8).add(0.01), sx.mul(1.9)).oneMinus().mul(smoothstep(0.006, 0.02, fp).oneMinus())
          const toM = vec3(0, -1.5, 0.3).sub(vP).toVar()
          const pool = float(26).div(dot(toM, toM).add(16)).mul(smoothstep(-2.5, 3, vP.z))
          const glint = pow(max(dot(Rr, KEY), 0), 24).mul(0.5).add(pow(max(dot(Rr, KEY), 0), 4).mul(0.05))
          // an inner layer is shaded by the one above it, more so toward the middle
          const shade = layer === 0 ? float(1) : mixN(0.3, 1, smoothstep(0.55, 1, vE.x))
          // it mirrors black sky, except a low band of the web's light near its horizon: the crinkles break it into streaks
          const band = exp(sq(Rr.y.sub(0.09).mul(7.5) as F).negate()).mul(smoothstep(-0.9, 0.5, Rr.x.negate()).mul(0.7).add(0.3))
          const spec = vec3(0.42, 0.47, 0.66).mul(band).mul(0.55).add(env(Rr as V3).mul(0.35)).add(glint).add(GOLD.mul(inM).mul(T.uGlow).mul(0.6).mul(T.uGold)).mul(fres).mul(tint)
          const col = spec.add(GOLD.mul(pool).mul(T.uGlow).mul(0.06).mul(T.uGold).mul(tint)).add(tint.mul(0.012)).mul(shade).mul(seam.mul(0.4).oneMinus()).toVar()
          // the hem: doubled over, catching the light; on the sun-side layers it shows the purple coat
          const hem = smoothstep(fwidth(vE.x).mul(-2.5).add(1), 1, vE.x).mul(0.4).add(smoothstep(0.6, 1, vE.x).mul(vE.y).mul(0.06))
          const hemC = layer >= 3 ? vec3(0.72, 0.4, 0.86) : vec3(0.7, 0.74, 0.88)
          col.addAssign(hemC.mul(hem).mul(T.uGold.mul(0.3).add(0.5)))
          return vec4(col, 1)
        })(),
        { side: THREE.DoubleSide },
      )
    for (let i = 4; i >= 0; i--) add(membrane(i), shMat(i))
    // the spreader bars at the six corners, the cables that tension each layer's corner out to its bar,
    // and the two mid-booms that carry the side bars out from the core
    const bar = hardMat([0.3, 0.3, 0.33], 0.7)
    for (let k = 0; k < SC.length; k++) {
      const c4 = cornerAt(4, k)
      const ox = c4[0] - OC[0]
      const oz = c4[1] - OC[1]
      const ol = Math.hypot(ox, oz)
      const bx = c4[0] + (ox / ol) * 0.45
      const bz = c4[1] + (oz / ol) * 0.45
      const y0 = sepAt(4, 1, 1) - 0.2
      const y1 = sepAt(0, 1, 1) + 0.16
      add(new THREE.CylinderGeometry(0.07, 0.085, y1 - y0, 8).translate(bx, (y0 + y1) / 2, bz), bar)
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 8).translate(bx, y1 + 0.04, bz), bar)
      for (let l = 0; l < 5; l++) {
        const c = cornerAt(l, k)
        const y = sepAt(l, 1, 1)
        const dx = bx - c[0]
        const dz = bz - c[1]
        const L = Math.hypot(dx, dz)
        add(new THREE.BoxGeometry(L, 0.03, 0.03).rotateY(-Math.atan2(dz, dx)).translate((bx + c[0]) / 2, y, (bz + c[1]) / 2), bar)
        add(new THREE.BoxGeometry(0.2, 0.06, 0.2).translate(bx, y, bz), bar)
      }
      if (k === 2 || k === 5) {
        const sx = Math.sign(bx)
        const L = Math.abs(bx) - 1.2
        add(new THREE.CylinderGeometry(0.09, 0.13, L, 10).rotateZ(Math.PI / 2).translate(sx * (1.2 + L / 2), y0 - 0.05, bz), carbon)
      }
    }
  }

  // ---------------------------------------------------------------- this frame's numbers
  const W = {
    lit: 0, flash: 0, t0: 0, t1: -1, t2: -1, ember: 0, gold: 0,
    selX: 0, selY: 0, selOn: 0,
  }
  const tgt = new THREE.Vector3()
  const v0 = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const S0 = new THREE.Vector3(stars[0].x, stars[0].y, stars[0].z)
  const WEBC = new THREE.Vector3(0.35, 0.05, 0)
  const home = MIRROR.seg[HOME]
  const smSeg = MIRROR.seg[SMUDGE_SEG]
  const port: Portal = { c: [[-1, 1], [1, 1], [1, -1], [-1, -1]], a: 1, shade: 1 }
  const portPts = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => new THREE.Vector3(x * HEX_BOX[0], y * HEX_BOX[1], 0))

  const pullAt = (t: number) => E.io3(clamp((t - PULL[0]) / (PULL[1] - PULL[0])))
  const distAt = (t: number) => Math.exp(mix(Math.log(DIST[0]), Math.log(DIST[1]), pullAt(t)))
  // when the lens passes the secondary (for the sound)
  const PASS_T = (() => {
    let a = PULL[0]
    let b = PULL[1]
    for (let i = 0; i < 30; i++) {
      const m = (a + b) / 2
      if (distAt(m) < ZS) a = m
      else b = m
    }
    return a
  })()

  const LIFT: [number, number, number] = [0, 0, 0]
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0, bloomThresh: 0.9, bloomRadius: 0.85, halation: 0.3, vignette: 0, ca: 0, sat: 1, contrast: 1, lift: LIFT, gain: [1, 1, 1], grain: 0 }
  const TITLES: TitleOpts = { color: "#8d8d8d", delay: [0.9, 0.5, 0.9], maxLine: 40, style: "fade", heads: [undefined, undefined, ctx.def.beats[2].head.replace(" confirmed", "\nconfirmed")], subs: ctx.def.beats.map((b) => (b.sub ? wrap(b.sub, 44) : undefined)) }
  const HUD = { color: "#9a9a9a" }

  // ---------------------------------------------------------------- sound (sheet: beats/sound-dark.md)
  // Home harmonic 7. A black slide with a projector running, the reviewer's keys in the only
  // bright thing on it; then one pluck per star, at that star, a harmonic above the last.
  const scr = (px: number, py: number, z = 0): Pos => [(px / DW) * 2 - 1, 1 - (py / DH) * 2, z]
  const NOTE: [number, number] = [1150 + 26 + 24, 640 - 44]
  const typed = (text: string, t0: number): Cue[] =>
    Array.from({ length: text.length }, (_, i): Cue => ({ b: 0, at: t0 + 0.25 + i / CPS, s: "type", o: { f: H(text[i] === " " ? 35 : 42 + ((i * 5) % 7)), g: 1.3 + ((i * 37) % 10) / 25, wet: 0.6 }, pos: scr(NOTE[0] + i * 15.5, NOTE[1]) }))
  const erased = (text: string, from: number): Cue[] =>
    Array.from({ length: Math.ceil(text.length / 2) }, (_, k): Cue => ({ b: 0, at: from + (k * 2) / 68, s: "delete", o: { f: H(28 - (k % 3)), g: 1.5, wet: 0.6 }, pos: scr(NOTE[0] + (text.length - k * 2) * 15.5, NOTE[1]) }))
  const atStar = (i: number) => (): Pos => listenerPos(stars[i], fcam)
  const atSeg = (i: number) => {
    const p = { x: MIRROR.seg[i].x, y: MIRROR.seg[i].y, z: 0 }
    return (): Pos => listenerPos(p, cam)
  }
  const atSmudge = (): Pos => scr(W.selX, W.selY, 0.3)
  const cues: Cue[] = [
    { b: 0, at: RV.q1, s: "select", o: { f: H(21), g: 0.4 }, pos: scr(NOTE[0], NOTE[1]) },
    ...typed(Q1, RV.q1),
    ...erased(Q1, RV.q1out),
    { b: 0, at: RV.q2, s: "select", o: { f: H(21), g: 0.4 }, pos: scr(NOTE[0], NOTE[1]) },
    ...typed(Q2, RV.q2),
    ...erased(Q2, RV.q2out),
    // one pluck per star, a harmonic higher each time, with the glass of its light two octaves up
    ...IGN.flatMap((at, i): Cue[] => [
      { b: 1, at, s: "pluck", o: { f: H(7 + i), g: 0.5 + 0.35 * (stars[i].L - 0.5), dur: 1.4 }, pos: atStar(i) },
      { b: 1, at, s: "glass", o: { f: H(28 + i * 4), g: 0.11 }, pos: atStar(i) },
    ]),
    // the big moment: the first star, alone, after all that black
    { b: 1, at: IGN[0], s: "sub", o: { f: H(2), g: 0.55, lfe: 1 }, pos: atStar(0) },
    { b: 1, at: IGN[0] + 0.02, s: "bell", o: { f: H(14), g: 0.2 }, pos: atStar(0) },
    // the pad that grows: the home, its fifth, its octave, as the web lights
    { b: 1, at: IGN[9], s: "pad", o: { f: H(14), dur: 9, g: 0.45 } },
    { b: 1, at: IGN[24], s: "pad", o: { f: H(28), dur: 8, g: 0.3 } },
    { b: 1, at: IGN[NS - 1] + 0.1, s: "pad", o: { f: H(2), dur: 7, g: 0.6 } },
    { b: 1, at: IGN[NS - 1] + 0.1, s: "bell", o: { f: H(28), g: 0.18 } },
    // the picture was in a mirror: the lens backs out of its segment, and passes the secondary
    { b: 2, at: 0.25, s: "glass", o: { f: H(42), g: 0.7 }, pos: [0, 0, -0.3] },
    { b: 2, at: 0.3, s: "pad", o: { f: H(2), dur: 9, g: 0.7 } },
    { b: 2, at: PASS_T - 0.25, s: "whoosh", o: { f: H(7), dur: 0.9, g: 0.8 }, pos: [0, 0, -0.6] },
    // eighteen images walk into one: each segment settles with a click, where it is, a step higher
    ...SETTLE.at.flatMap((at, i): Cue[] => {
      if (at < 0) return []
      const k = Math.round((at - WALK0) / WALK_STEP)
      return [{ b: 2, at, s: "tick", o: { f: H(42 + k * 2), g: 0.5 }, pos: atSeg(i) }, { b: 2, at, s: "marimba", o: { f: H(14 + k), g: 0.16 }, pos: atSeg(i) }]
    }),
    // the wings latch
    { b: 2, at: WING_T, s: "gear", o: { f: H(28), dur: 0.14, g: 0.5 }, pos: atSeg(0) },
    { b: 2, at: WING_T + 0.02, s: "gear", o: { f: H(35), dur: 0.14, g: 0.5 }, pos: atSeg(NSEG - 1) },
    { b: 2, at: WING_T + 0.16, s: "thud", o: { f: H(2), g: 0.8 } },
    { b: 2, at: WING_T + 0.16, s: "bell", o: { f: H(7), g: 0.3 } },
    // the selection box lands on the smudge
    { b: 2, at: SEL_T, s: "select", o: { f: H(42), g: 1.1 }, pos: atSmudge },
    { b: 2, at: SEL_T + 0.05, s: "pluck", o: { f: H(21), g: 0.5, dur: 1.6 }, pos: atSmudge },
  ]

  function update(s: State) {
    const t0 = clamp(s.at(0), -10, 1e3)
    const b1 = ctx.def.beats[1]
    const t1 = s.beat >= 1 ? (s.beat > 1 ? b1.dur + b1.hold : s.t) : -1
    const t2 = s.beat >= 2 ? s.t : -1
    W.t0 = t0
    W.t1 = t1
    W.t2 = t2
    const asp = s.w / s.h
    U.uAsp.value = asp

    // ---- the stars
    let lit = 0
    let flash = 0
    for (let i = 0; i < NS; i++) {
      const a = s.beat > 1 ? s.at(1) - IGN[i] : s.beat === 1 ? s.t - IGN[i] : -9
      // (ages past a minute are all the same picture; keeping them small keeps the fronts finite)
      uAge.array[i] = stars[i].L > 0 ? Math.min(a, 60) : -9
      if (a > 0) {
        lit++
        flash += Math.exp(-a * 5) * stars[i].L
      }
    }
    W.lit = lit
    W.flash = flash

    // ---- the hand-off: the embers hang where the plate's blotches were, the web springs into its depth
    const land = Math.max(t0, 0)
    U.uDepth.value = t0 <= 0 ? 0 : 1 - Math.exp(-2.6 * land) * Math.cos(5.2 * land)
    U.uShove.value = t0 <= 0 ? 0 : 0.035 * Math.exp(-2.2 * land) * Math.sin(9 * land)
    W.ember = t0 <= 0 ? 1 : Math.exp(-land * 1.5) * (1 - smooth(1.6, 3.4, land))
    U.uEmber.value = (W.ember + (t0 > 0 ? 1.1 * Math.exp(-land * 5) : 0)) * 1.15
    U.uEmberT.value = EMBER_T * (t0 <= 0 ? 1 : 0.72 + 0.28 * Math.exp(-land * 1.1))
    // gravity: over the two dark beats the gas closes on its filaments
    U.uLoose.value = 1 - 0.75 * smooth(0, 22, s.time)
    U.uAmb.value = 1 + 0.6 * smooth(0, 9, land)

    // ---- the field camera: square-on and still when it lands, then a creep, then round the web
    const settle = smooth(0, 2.5, land)
    const orbit = s.k(1, IGN1 - 0.4, 9, E.io3)
    const az = 0.2 * s.k(1, 0, 2.2, E.io2) + 0.75 * orbit + 0.03 * Math.max(t1 - 9, 0) + (t2 > 0 ? 0.02 * t2 : 0) + settle * (0.012 * Math.sin(s.time * 0.23) + s.mouse.x * 0.03)
    const el = 0.2 * orbit + settle * (0.008 * Math.sin(s.time * 0.31 + 1) + s.mouse.y * 0.02)
    const punch = t1 > IGN[0] ? 0.12 * Math.exp(-(t1 - IGN[0]) * 2.2) : 0
    const dist = mix(mix(mix(D0, D0 - 0.5, s.k(0, 0, 9, E.out2)), 2.1, s.k(1, 0, IGN0 + 0.1, E.io3)), 5.5, s.k(1, IGN1 - 0.4, 9, E.io2)) - punch + 0.5 * s.k(2, 0.3, 8, E.out2)
    tgt.set(0, 0, 0).lerp(S0, s.k(1, 0.0, IGN0, E.io3)).lerp(WEBC, s.k(1, IGN1 - 0.4, 9, E.io3))
    // the knock of the landing: a short sway, so the new depth is seen as parallax
    const sway = t0 > 0 ? 0.3 * Math.exp(-1.3 * land) * Math.sin(2.6 * land) : 0
    fcam.position.set(tgt.x + dist * Math.sin(az) * Math.cos(el) + sway, tgt.y + dist * Math.sin(el) + sway * 0.25, tgt.z + dist * Math.cos(az) * Math.cos(el))
    fcam.aspect = asp
    // (a frame wider or narrower than 16:9 keeps the picture's height)
    fcam.updateProjectionMatrix()
    fcam.lookAt(tgt)
    fcam.rotation.z += 0.004 * Math.sin(s.time * 0.19) * settle + 0.012 * flash
    fcam.updateMatrixWorld()
    U.uPx.value = s.h / (2 * TANV)
    // focus racks onto the first star, then holds the middle of the web
    U.uFocus.value = dist
    U.uAp.value = 0.0045 * s.k(1, 0, 0.8, E.io2) * (1 - 0.65 * s.k(2, 0, 1.2, E.io2))
    U.uSpike.value = s.k(2, 0.2, 1.3, E.out3)
    U.uGain.value = 1
    U.uMinPx.value = 1.1 + 0.8 * s.k(2, 0.6, 4.6, E.io3)

    // ---- the telescope
    if (t2 >= 0) {
      const e = pullAt(t2)
      // (the hold keeps moving: a slow creep back in)
      const d = distAt(t2) * (1 - 0.07 * s.k(2, PULL[1], 13, E.io2))
      const late = s.k(2, 1.0, PULL[1] + 1.2, E.io3)
      const yaw = 0.3 * late + 0.02 * Math.sin(s.time * 0.29) * late + s.mouse.x * 0.03
      const pit = 0.17 * late + 0.012 * Math.sin(s.time * 0.37 + 2) * late + s.mouse.y * 0.02
      // the look-at slides from the home segment to a point left of the mirror, which puts the mirror right of centre
      tgt.set(home.x, home.y, 0).lerp(v1.set(-3.1, 0.3, 0), E.io2(clamp(e * 1.15)))
      cam.position.set(tgt.x + d * Math.sin(yaw) * Math.cos(pit), tgt.y + d * Math.sin(pit), d * Math.cos(yaw) * Math.cos(pit))
      cam.aspect = asp
      cam.updateProjectionMatrix()
      cam.lookAt(tgt)
      cam.rotation.z += 0.003 * Math.sin(s.time * 0.21)
      cam.updateMatrixWorld()
      cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
      T.uCam.value.copy(cam.position)
      W.gold = s.k(2, 0.05, 0.9, E.io2)
      T.uGold.value = W.gold
      T.uSheen.value = mix(-0.5, 1.9, s.k(2, 0.0, 1.5, E.io2))
      // the reflection is hung from the mirror's centre once the mirror is a thing in the frame
      const w = s.k(2, 0.6, 4.6, E.io3)
      v0.set(0, 0, 0).project(cam)
      const mx = mix(0.5, v0.x * 0.5 + 0.5, w)
      const my = mix(0.5, v0.y * 0.5 + 0.5, w)
      T.uMc.value.set(mx, my)
      const K = mix(1, 1.3, w)
      T.uK.value = K
      // phasing: each segment's tilt rings down from its own moment
      for (let i = 0; i < NSEG; i++) {
        const at = SETTLE.at[i]
        let m = at < 0 ? 0 : 1
        if (at >= 0 && t2 > at) m = Math.exp(-(t2 - at) * 6) * Math.cos((t2 - at) * 13)
        tiltV[i].set(SETTLE.tilt[i][0] * m, SETTLE.tilt[i][1] * m, Math.abs(m), 0)
      }
      const wt = Math.max(t2 - WING_T, 0)
      T.uWing.value = 0.5 * (t2 < WING_T ? 1 : Math.exp(-wt * 7) * Math.cos(wt * 15)) * (1 - 0.3 * s.k(2, 3.5, WING_T, E.in2))
      // the smudge sits in the middle of one segment, and only stands out once the images are one
      v0.set(smSeg.x + 0.12, smSeg.y - 0.05, 0).project(cam)
      const su = v0.x * 0.5 + 0.5
      const sv = v0.y * 0.5 + 0.5
      U.uSmAt.value.set(((su - mx) * K + 0.5) * 2 - 1, ((sv - my) * K + 0.5) * 2 - 1)
      U.uSmudge.value = 0.1 * s.k(2, 1.2, 2.5) + 0.9 * s.k(2, WING_T + 0.3, WING_T + 1.1, E.io2)
      W.selX = su * DW
      W.selY = (1 - sv) * DH
      W.selOn = s.k(2, SEL_T, SEL_T + 0.3, E.lin)
      T.uGlow.value = 0.5 + 0.1 * Math.sin(s.time * 0.8)
      const pp = projectPortal(portPts, cam)
      for (let i = 0; i < 4; i++) {
        port.c[i][0] = pp.c[i][0]
        port.c[i][1] = pp.c[i][1]
      }
    }

    // sound: the projector is all there is on the black slide; the web's own air grows with the stars
    if (s.live) {
      ctx.synth.bed("projector", 0.3 * smooth(0, 1.5, t0) * (1 - s.k(1, 0, 0.7)))
      ctx.synth.bed("air", clamp(0.04 + 0.012 * lit + 0.25 * s.k(2, 0, 2)))
      // (not during the hand-off out: there the hum is the mirror's actuators, and the transition drives it)
      if (s.exit <= 0) ctx.synth.bed("hum", clamp((lit / NS) * 0.5 * (1 - 0.6 * s.k(2, 0, 3))))
    }
  }

  return {
    cues,
    update,
    warm: () => [{ scene: fieldScene, camera: fcam, target: field }, { scene: tele, camera: cam, target: stage }],

    render() {
      const r = ctx.renderer
      r.setRenderTarget(field)
      r.render(fieldScene, fcam)
      const lit = W.lit / NS
      const light = clamp(lit * 3 + W.ember * 0.6)
      // the black beat has no bloom, no grain, no lift: black is black
      POST.exposure = 1 + 0.55 * W.flash * (1 - 0.7 * lit)
      POST.bloom = 0.35 * W.ember + 0.75 * smooth(0, 0.2, lit) + 0.5 * W.flash
      POST.bloomThresh = mix(0.5, 0.85, smooth(0, 0.3, lit))
      POST.grain = 0.022 * clamp(lit * 4) + 0.006 * W.gold
      POST.vignette = 0.28 * light
      POST.ca = 0.0008 * light + 0.0012 * W.flash
      POST.contrast = 1 + 0.08 * light
      POST.sat = 1.05
      if (W.t2 >= 0) {
        r.setRenderTarget(stage)
        r.render(tele, cam)
        POST.bloom = mix(POST.bloom, 0.55, W.gold)
        POST.bloomThresh = mix(POST.bloomThresh, 0.9, W.gold)
        POST.vignette = mix(POST.vignette, 0.3, W.gold)
        ctx.finish(stage.texture, POST)
      } else ctx.finish(field.texture, POST)
    },

    type(g, s) {
      // the headline arrives quietly in the dark, and takes its colour from the light there is
      const lightUp = s.beat === 0 ? 0 : s.beat === 1 ? smooth(IGN[0], IGN[6], s.t) : 1
      const c = Math.round(mix(141, 255, lightUp))
      TITLES.color = `rgb(${c},${c},${Math.round(mix(141, 250, lightUp))})`
      TITLES.style = s.beat === 0 ? "fade" : "rise"
      TITLES.subAlpha = mix(0.6, 0.85, lightUp)
      TITLES.shadow = s.beat > 0 ? "rgba(0,0,0,0.8)" : undefined
      titles(g, s, ctx.def, TITLES)
      if (s.beat === 0) {
        // the reviewer, in the only bright thing on the slide
        const t = W.t0
        const u = (o: number) => (t > o ? o + (t - o) * 2 : t)
        comment(g, Q1, 1150, 640, u(RV.q1out), { t0: RV.q1, out: RV.q1out, cps: CPS })
        comment(g, Q2, 1150, 640, u(RV.q2out), { t0: RV.q2, out: RV.q2out, cps: CPS, w: 300 })
      }
      if (s.beat === 2 && W.selOn > 0) {
        const pop = mix(1.9, 1, E.outBack(s.k(2, SEL_T, SEL_T + 0.34, E.lin)))
        const bw = 150 * pop
        const bh = 104 * pop
        g.selbox(W.selX - bw / 2, W.selY - bh / 2, bw, bh, W.selOn, SELECT)
        // the readout rides on the box (it restates the source line)
        const p = s.k(2, SEL_T + 0.25, SEL_T + 1.0, E.lin)
        g.text("MoM-z14", W.selX - 75, W.selY - bh / 2 - 46, { size: 26, font: "mono", weight: 500, color: "#ffffff", style: "type", by: "glyph", p, caret: p < 1, shadow: { color: "rgba(0,0,0,0.9)", blur: 10 } })
        g.text("z = 14.44", W.selX - 75, W.selY + bh / 2 + 38, { size: 22, font: "mono", color: "#ff8a66", style: "blur", by: "line", p: s.k(2, SEL_T + 0.9, SEL_T + 1.5, E.out3), shadow: { color: "rgba(0,0,0,0.9)", blur: 10 } })
      }
    },

    hud: (s: State) => {
      HUD.color = s.beat === 0 ? "#9a9a9a" : "#ffffff"
      return HUD
    },
    portal: (s: State) => (s.beat === 2 && s.t > 4 ? port : null),

    dispose() {
      disposeTree(fieldScene)
      disposeTree(tele)
      for (const g of geos) g.dispose()
    },
  }
}
