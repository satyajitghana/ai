// Scene 23, board: "Chess." then "Then Go. Move 37."
//
// Staging. Beat 0: a walnut-and-maple tournament board on a charcoal cloth in studio darkness,
// boxwood and ebony Staunton pieces standing in the real position after 19.c4 of game six, Deep
// Blue v Kasparov, 11 May 1997 (the score and its final diagram: Wikipedia, citing Pandolfini 1997,
// p. 160), and a stopped two-dial chess clock beside it (illustration). The lens starts low across
// the board from White's kingside, dollies along the pawns with the focus racking to Black's king
// on c8, then cranes up to top-down. Beat 1: the pieces lift and dissolve, the board becomes a kaya
// goban (the square boundaries split into nineteen lines each way: the lines become the grid, never
// the squares), nine star points pop, and the first 37 moves of game two land in their real order
// (SGF, A. E. Brouwer's collection), faster and faster, matte slate and striated clamshell, each with
// a click and a few millimetres of slide. Move 37 at P10 stops everything dead; the selection box
// draws on it while the lens pushes down onto the stone.
//
// Story parameter. Beat 0 `look` (the camera's path), beat 1 `moves` (stones down, 0..37).
// World rule. One warm key from high behind Black's queenside, one cool sky, and one pool of light:
// `lit()` shades every surface; every piece and stone casts a soft line shadow along the key and a
// contact occlusion on the board, computed in the board's shader from the same arrays that place them.
// Beat sheet and sources: R/beats/board.md.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraPosition, clamp as clampN, cos, Discard, dot, exp, float, floor, Fn, fract, fwidth, If, int, length, Loop, max, min, mix as mixN, normalize, normalWorld, positionGeometry, positionLocal, positionView, positionWorld, pow, screenCoordinate, sin, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, shake, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { SQUARES_DUR, SQUARES_IN } from "../transitions/squares"

// ---------------------------------------------------------------- the record

/** Game six after 19.c4 (Deep Blue White): piece letter, file a..h, rank 1..8. Upper case White. */
const POSITION = "Kg1 Qd3 Ra1 Nf3 Bg3 Pb2 Pc4 Pd4 Pf2 Pg2 Ph2 kc8 ra8 rh8 nd7 nd5 bc6 be7 pa7 pb5 pf5 pg7 ph6".split(" ")
/** Game two, AlphaGo (Black) v Lee Sedol, 10 March 2016: the first 37 moves of the SGF, in order. */
const SGF37 = "pd dp cd qp op oq nq pq cn fq mp qn ic dj po qo cp cq bq co bp bo do bn dq ep dr cm jp cg ed qf qe pf nd pi oj".split(" ")
const MOVES = SGF37.map((m, i) => ({ c: m.charCodeAt(0) - 97, r: m.charCodeAt(1) - 97, black: i % 2 === 0 }))
{
  // the record must be what the sources say: 19 black and 18 white, no stone on another, move 37 at P10
  const seen = new Set(SGF37)
  const nb = MOVES.filter((m) => m.black).length
  if (seen.size !== 37 || nb !== 19 || MOVES[36].c !== 14 || MOVES[36].r !== 9 || !MOVES[36].black) throw new Error("board: game-two record is wrong")
}

// ---------------------------------------------------------------- layout (metres; y up, White at +z, the a-file at -x)

const S = 0.057 // a chess square
const CH = { hx: 4 * S + 0.024, hz: 4 * S + 0.024, th: 0.022 } // the chessboard: half extents and thickness
const GX = 0.022, GZ = 0.0237 // goban line spacing across and along (a goban is longer than wide)
const GO = { hx: 9 * GX + 0.016, hz: 9 * GZ + 0.016, th: 0.1 } // a floor goban: a thick kaya block
const LEG_H = 0.07 // on four carved legs
const SR = 0.0112, SH = 0.0046 // a black stone's radius and half-thickness (white is a shade smaller)
const sqX = (f: number) => (f - 3.5) * S
const sqZ = (r: number) => (3.5 - r) * S
const goX = (c: number) => (c - 9) * GX
const goZ = (r: number) => (r - 9) * GZ
const FOV = 30
const START = SQUARES_DUR * (1 - SQUARES_IN)
const KEY = /*@__PURE__*/ new THREE.Vector3(-0.42, 0.8, -0.44).normalize()
const RAKE = /*@__PURE__*/ new THREE.Vector3(-0.32, 0.34, -0.88).normalize() // beat 1: low, from beyond Black's side

// beat 1 times
const T_LIFT = 0.45 // the pieces are gone
const T_M0 = 0.1, T_M1 = 0.75 // the board becomes a goban
const T_S0 = 0.78, T_S36 = 2.82 // move 1 .. move 36
const GAP_END = 0.03
// geometric gaps that shrink to GAP_END: solve for the ratio that fills the window
const STONE_T: number[] = (() => {
  const n = 35, span = T_S36 - T_S0
  let lo = 0.5, hi = 0.9999
  for (let k = 0; k < 60; k++) {
    const r = (lo + hi) / 2
    let sum = 0
    for (let i = 0; i < n; i++) sum += GAP_END * r ** (i - (n - 1))
    if (sum > span) lo = r
    else hi = r
  }
  const r = (lo + hi) / 2
  const out = [T_S0]
  for (let i = 0; i < n; i++) out.push(out[i] + GAP_END * r ** (i - (n - 1)))
  out.push(out[35] + GAP_END * 1.25) // move 37: one beat of the same cadence, then nothing
  return out
})()
const T37 = STONE_T[36]

// ---------------------------------------------------------------- small TSL helpers

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sat1 = (x: F): F => clampN(x, 0, 1) as F

// ---------------------------------------------------------------- Staunton pieces, turned and carved

type Prof = [number, number][]
const base = (rb: number): Prof => [[0, 0], [rb, 0], [rb, 1.3], [rb - 0.6, 2.5], [rb - 1.7, 3.3], [rb - 1.4, 4.7], [rb - 2.7, 5.8], [rb - 3.5, 6.9]]
const PROFILES: Record<string, Prof> = {
  p: [...base(14.5), [9.5, 8.2], [7.4, 11], [6.1, 18], [5.7, 23.8], [9, 25.4], [9.2, 27], [6, 28.6], [6.6, 30.2], [8.3, 33.2], [9.1, 37], [8.9, 41], [7.7, 44.5], [5.5, 47.2], [2.8, 48.9], [0, 49.4]],
  r: [...base(17), [12.6, 9.2], [10, 13], [9.1, 20], [9.5, 32], [10.4, 40], [11.9, 43], [12.1, 44.6], [11.2, 45.6], [11.4, 48], [12.3, 48.7], [12.3, 56.4], [11.6, 57], [8.6, 57], [8.6, 54], [0.01, 54]],
  b: [...base(16), [11.8, 9], [9, 13], [7.4, 24], [6.4, 38], [10, 40], [10.2, 41.6], [6.6, 43], [7.4, 44.6], [9.6, 49], [10.2, 54], [9.2, 59.5], [6.4, 64], [3, 66.5], [3.6, 68.5], [3.3, 70.6], [1.8, 71.8], [0, 72]],
  q: [...base(18), [13, 9.6], [10, 14], [7.6, 30], [6.2, 56], [10.8, 58.5], [11, 60.2], [6.8, 61.6], [7.6, 64], [9.2, 69], [11.6, 75.4], [10.6, 76], [7.6, 73.6], [4.6, 74.4], [4.9, 77.6], [3.6, 80], [0, 80.6]],
  k: [...base(19), [13.6, 10], [10.6, 15], [8.2, 32], [6.9, 58], [11.6, 60.6], [11.8, 62.6], [7.8, 64.2], [8.6, 67], [10.6, 74], [11.6, 80], [11, 82], [7.2, 83.6], [3.8, 85], [0, 85.3]],
  n: [...base(17.5), [12.5, 9.2], [11.6, 12], [12.4, 14], [12.4, 16.4], [11, 17.4], [0.01, 17.4]],
}
const H_OF: Record<string, number> = { p: 0.049, r: 0.057, b: 0.072, q: 0.081, k: 0.096, n: 0.066 }
const KIND: Record<string, number> = { p: 1, r: 2, b: 3, q: 4, k: 5, n: 6 }

/** A non-indexed geometry from several, with a `kind` attribute (which carving rules apply). */
function merge(parts: THREE.BufferGeometry[], kind: number) {
  const flat = parts.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0
    if (!g0.userData.keepNormals) g.computeVertexNormals()
    return { g, g0 }
  })
  const n = flat.reduce((a, { g }) => a + g.getAttribute("position").array.length, 0)
  const pos = new Float32Array(n), nor = new Float32Array(n)
  let o = 0
  for (const { g, g0 } of flat) {
    const a = g.getAttribute("position").array as Float32Array
    pos.set(a, o)
    nor.set(g.getAttribute("normal").array as Float32Array, o)
    o += a.length
    if (g !== g0) g.dispose()
    g0.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
  out.setAttribute("kind", new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(kind), 1))
  out.computeBoundingSphere()
  return out
}

/** A Staunton knight's head (metres, +x the muzzle, y up, z across), sculpted from its side silhouette. */
function knightHead() {
  // the outline in mm, back of the neck up to the poll, down the face to the muzzle and back along the throat
  const O: [number, number][] = [[-11.5, 16], [-12.6, 25], [-12.4, 34], [-10.6, 42], [-8, 49.5], [-5, 56], [-2.4, 61], [-0.6, 66.2], [1.4, 63], [3.4, 60.6], [7, 58.4], [11.4, 54.2], [15, 48.2], [17.4, 43.6], [17.2, 39.4], [14.4, 37.6], [11.4, 38.4], [8.4, 39.6], [6.4, 37.4], [4.8, 33], [5.8, 27.4], [8.6, 21.6], [9.8, 16]]
  // a smooth closed outline (Catmull-Rom through the points)
  const curve = new THREE.CatmullRomCurve3(O.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal")
  const poly = curve.getSpacedPoints(220).slice(0, 220).map((v) => [v.x, v.y] as [number, number])
  const near = (x: number, y: number) => {
    // distance to the outline, the closest point on it, and whether (x, y) is inside
    let best = 1e9, cx = 0, cy = 0, inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i]
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
      const ex = bx - ax, ey = by - ay
      const tt = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)))
      const px = ax + ex * tt, py = ay + ey * tt
      const d = Math.hypot(x - px, y - py)
      if (d < best) [best, cx, cy] = [d, px, py]
    }
    return { d: best, cx, cy, inside }
  }
  const sm = (a: number, b: number, x: number) => {
    const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)
  }
  // half-width across the head (mm) by region; a jowl swelling behind the mouth
  const halfW = (x: number, y: number) => {
    const neck = 10.5 - 2.6 * sm(30, 52, y)
    const muzzle = 1 - 0.42 * sm(6, 16, x) * sm(36, 46, y)
    const jowl = 1.3 * Math.exp(-((x - 4) ** 2 + (y - 41) ** 2) / 30)
    return neck * muzzle + jowl
  }
  const RND = 5.5 // rounding radius at the silhouette (mm)
  const carve = (x: number, y: number) => {
    // grooves and pits cut into the surface (mm of depth)
    let c = 0
    // the mane: a row of carved locks along the back of the neck
    const backD = near(x, y).d
    const onMane = x < -2 && y > 18 && y < 60 ? Math.exp(-(((backD - 2.2) / 1.6) ** 2)) : 0
    c += onMane * 0.9 * (0.5 + 0.5 * Math.sin(y * 1.9 + x * 0.6))
    c += 1.2 * Math.exp(-((x - 6.2) ** 2 + (y - 52.5) ** 2) / 2.2) // the eye socket
    c -= 0.5 * Math.exp(-((x - 5.2) ** 2 + (y - 54.2) ** 2) / 3) // the brow over it
    c += 1.0 * Math.exp(-((x - 15.6) ** 2 + (y - 45.4) ** 2) / 1.4) // the nostril
    const mouth = Math.exp(-(((y - 40.6 - (x - 12) * 0.08) / 0.5) ** 2)) * sm(10, 13, x) * (1 - sm(16.4, 17.6, x))
    c += mouth * 0.7
    c += 0.6 * Math.exp(-(((y - 36) / 1.2) ** 2)) * sm(3, 6, x) * (1 - sm(9, 11, x)) // the throat latch
    return c
  }
  const STEP = 0.45
  const x0 = -14, x1 = 19, y0 = 15.6, y1 = 67.5
  const nx = Math.ceil((x1 - x0) / STEP) + 1, ny = Math.ceil((y1 - y0) / STEP) + 1
  const vx = new Float32Array(nx * ny), vy = new Float32Array(nx * ny), vz = new Float32Array(nx * ny)
  const ok = new Uint8Array(nx * ny)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      let x = x0 + i * STEP, y = y0 + j * STEP
      const n = near(x, y)
      let z = 0
      if (n.inside) {
        const r = Math.min(1, n.d / RND)
        z = Math.max(0.2, halfW(x, y) * Math.sqrt(1 - (1 - r) * (1 - r)) - carve(x, y) * r)
        ok[k] = 1
      } else if (n.d < STEP * 1.2) {
        // just outside: snapped onto the outline, on the rim
        x = n.cx
        y = n.cy
        ok[k] = 1
      }
      vx[k] = x
      vy[k] = y
      vz[k] = z
    }
  // two sheets (z and -z) over the same grid, indexed so the normals come out smooth
  const NV = nx * ny
  const pos = new Float32Array(NV * 2 * 3)
  for (let k = 0; k < NV; k++)
    for (const [o, sd] of [[0, 1], [NV, -1]] as [number, number][]) pos.set([vx[k] * 1e-3, vy[k] * 1e-3, sd * vz[k] * 1e-3], (o + k) * 3)
  const idx: number[] = []
  const tri = (a: number, b: number, c: number) => {
    if (!(ok[a] && ok[b] && ok[c]) || !(vz[a] > 0 || vz[b] > 0 || vz[c] > 0)) return
    idx.push(a, b, c, NV + a, NV + c, NV + b)
  }
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
      tri(a, b, d)
      tri(a, d, c)
    }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  merged.setIndex(idx)
  merged.computeVertexNormals()
  // the ears: two pricked cones at the poll, a little apart, tipped back
  const parts: THREE.BufferGeometry[] = [merged]
  for (const sz of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.0021, 0.0072, 12, 1)
    ear.rotateZ(0.32)
    ear.rotateX(-0.18 * sz)
    ear.translate(0.0002, 0.0668, sz * 0.0034)
    parts.push(ear)
  }
  for (const p of parts) p.userData.keepNormals = true
  return parts
}

function pieceGeometry(t: string, white: boolean) {
  const lathe = new THREE.LatheGeometry(PROFILES[t].map(([r, y]) => new THREE.Vector2(r * 1e-3, y * 1e-3)), 48)
  // a lathe's own normals are smooth across its seam; computing them again from the triangle soup would facet it
  lathe.computeVertexNormals()
  lathe.userData.keepNormals = true
  const parts: THREE.BufferGeometry[] = [lathe]
  if (t === "k") {
    const v = new THREE.BoxGeometry(0.0042, 0.0135, 0.0042)
    v.translate(0, 0.0915, 0)
    const h = new THREE.BoxGeometry(0.0118, 0.0038, 0.0042)
    h.translate(0, 0.0935, 0)
    parts.push(v, h)
  }
  if (t === "n") {
    // the head, sculpted: the side silhouette, inflated into a rounded body whose width follows the anatomy
    // (a broad neck, a narrower skull, a slim muzzle, a jowl), then carved: mane, eye, nostril, mouth, ears
    // the muzzle faces the opponent
    for (const head of knightHead()) {
      head.rotateY(white ? Math.PI / 2 : -Math.PI / 2)
      parts.push(head)
    }
  }
  return merge(parts, KIND[t])
}

// ---------------------------------------------------------------- the clock face (ticks only: no numerals to read)

function clockFace() {
  return canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = "#0b0a09"
    c.fillRect(0, 0, w, h)
    const dial = (cx: number, mins: number, flag: boolean) => {
      const r = 200
      const g = c.createRadialGradient(cx, h / 2, r * 0.2, cx, h / 2, r)
      g.addColorStop(0, "#efe7d4")
      g.addColorStop(1, "#d9cfb8")
      c.fillStyle = g
      c.beginPath()
      c.arc(cx, h / 2, r, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = "#8b8170"
      c.lineWidth = 10
      c.stroke()
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2
        const l = i % 5 === 0 ? 30 : 13
        c.strokeStyle = "#1d1a16"
        c.lineWidth = i % 5 === 0 ? 7 : 3
        c.beginPath()
        c.moveTo(cx + Math.sin(a) * (r - 14), h / 2 - Math.cos(a) * (r - 14))
        c.lineTo(cx + Math.sin(a) * (r - 14 - l), h / 2 - Math.cos(a) * (r - 14 - l))
        c.stroke()
      }
      const hand = (a: number, l: number, wd: number, col: string) => {
        c.strokeStyle = col
        c.lineWidth = wd
        c.lineCap = "round"
        c.beginPath()
        c.moveTo(cx - Math.sin(a) * 18, h / 2 + Math.cos(a) * 18)
        c.lineTo(cx + Math.sin(a) * l, h / 2 - Math.cos(a) * l)
        c.stroke()
      }
      hand((mins / 60) * Math.PI * 2, 165, 9, "#15120f")
      hand((mins / 720) * Math.PI * 2 + 0.3, 110, 13, "#15120f")
      c.fillStyle = "#15120f"
      c.beginPath()
      c.arc(cx, h / 2, 14, 0, Math.PI * 2)
      c.fill()
      // the maker's small print under the hands is left out: nothing on the dial to read
      if (flag) c.fillStyle = "#15120f"
    }
    dial(w * 0.25, 43, false)
    dial(w * 0.75, 21, true)
  })
}

// ---------------------------------------------------------------- the scene

export function create(ctx: Ctx): SceneInstance {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.005, 40)

  const U = {
    top: uniform(CH.th), // the board's top surface
    hx: uniform(CH.hx),
    hz: uniform(CH.hz),
    gW: uniform(0), // chess wood to kaya
    gL: uniform(0), // the grid lines appear (at the square boundaries)
    gS: uniform(0), // and slide to a goban's spacing
    gP: uniform(0), // star points
    t1: uniform(-99), // beat 1's clock, for the stones
    pieces: uniform(1), // 0 once the pieces have gone (skips their shadows)
    stones: uniform(0),
  }
  const KEYU = uniform(KEY.clone()), KEYCU = uniform(new THREE.Vector3(1.0, 0.84, 0.64).multiplyScalar(2.1))
  const KEYD = KEYU as unknown as V3
  const KEYC = KEYCU as unknown as V3
  const SKY = vec3(0.04, 0.046, 0.062)
  /** The pool the key throws: centred on the board, falling off over the cloth. */
  const pool = (P: V3): F => sstep(0.72, 0.2, length(P.xz.sub(vec2(-0.04, -0.02)))).mul(0.9).add(0.1) as F
  /** The world rule: one key, one sky, one pool. */
  const lit = (alb: V3, N: V3, P: V3, o: { spec: Num; shin: number; sh?: Num; ao?: Num; rim?: Num; sheen?: Num }): V3 => {
    const V = normalize(cameraPosition.sub(P))
    const pl = pool(P)
    const sh = fl(o.sh ?? 1)
    const ao = fl(o.ao ?? 1)
    const ndl = max(dot(N, KEYD), 0)
    const Hh = normalize(KEYD.add(V))
    const sp = pow(max(dot(N, Hh), 0), o.shin).mul(fl(o.spec)).mul(ndl.mul(4).min(1))
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 5)
    // a low warm fill from the lens side (the studio's spill) and bounce off the wood below
    const fill = vec3(0.16, 0.13, 0.1).mul(max(dot(N, normalize(vec3(0.55, 0.3, 0.78))), 0)).add(vec3(0.05, 0.03, 0.015).mul(max(N.y.negate(), 0)))
    const amb = SKY.mul(N.y.mul(0.35).add(0.65)).add(fill).mul(ao)
    const col = alb.mul(KEYC.mul(ndl).mul(sh).mul(pl).add(amb)).add(KEYC.mul(sp).mul(sh).mul(pl))
    // a cool rim from the sky and the studio's far side, and a broad sheen where asked
    return col.add(SKY.mul(fres).mul(fl(o.rim ?? 0.6)).mul(ao)).add(KEYC.mul(alb.add(0.03)).mul(pow(max(dot(N, Hh), 0), 6)).mul(fl(o.sheen ?? 0)).mul(sh).mul(pl).mul(ndl)) as V3
  }
  /** View depth for the focus pass, carried in alpha. */
  const depthA = (): F => positionView.z.negate() as F

  // ---- shadow casters: pieces (x, z, height, radius) and stones (x, z, landing time, radius)
  const NPIECE = POSITION.length
  const pieceArr = uniformArray(POSITION.map(() => new THREE.Vector4(0, 0, 0, 0)), "vec4")
  const stoneArr = uniformArray(
    MOVES.map((m, i) => new THREE.Vector4(goX(m.c), goZ(m.r), STONE_T[i], m.black ? SR : SR * 0.975)),
    "vec4",
  )
  /** How much of the key a point on the board top gets past the pieces and stones (1 = all of it). */
  const castOnBoard = (P: V3): V3 => {
    const sh = float(1).toVar()
    const ao = float(1).toVar()
    const dir = KEYD.xz.negate().div(KEYD.y).toVar() // where a point's shadow falls per unit of height
    If(U.pieces.greaterThan(0.001), () => {
      Loop(NPIECE, ({ i }) => {
        const pc = pieceArr.element(int(i)) as unknown as V4
        const b = pc.xy
        const rel = P.xz.sub(b).toVar()
        // the piece as a tapering column; its shadow a segment from the foot along the key
        const seg = dir.mul(pc.z)
        const t = clampN(dot(rel, seg).div(dot(seg, seg).add(1e-8)), 0, 1).toVar()
        const d = length(rel.sub(seg.mul(t)))
        const w = pc.w.mul(float(1).sub(t.mul(0.55)))
        const soft = pc.w.mul(0.35).add(t.mul(pc.z).mul(0.12))
        sh.mulAssign(float(1).sub(sstep(w.add(soft), w.sub(soft), d as F).mul(0.82).mul(U.pieces)))
        ao.mulAssign(float(1).sub(exp(dot(rel, rel).div(pc.w.mul(pc.w).mul(1.3)).negate()).mul(0.55).mul(U.pieces)))
      })
    })
    If(U.stones.greaterThan(0.5), () => {
      Loop(37, ({ i }) => {
        const st = stoneArr.element(int(i)) as unknown as V4
        const on = step(st.z, U.t1)
        const rel = P.xz.sub(st.xy).toVar()
        const d0 = length(rel)
        const d1 = length(rel.sub(dir.mul(SH * 1.6)))
        sh.mulAssign(float(1).sub(sstep(st.w.mul(1.05), st.w.mul(0.75), d1 as F).mul(0.7).mul(on)))
        ao.mulAssign(float(1).sub(sstep(st.w.mul(1.25), st.w.mul(0.85), d0 as F).mul(0.6).mul(on)))
      })
    })
    return vec3(sh, ao, 0)
  }

  // ---- the board: walnut and maple squares that become kaya with nineteen lines each way
  const boardMat = new THREE.NodeMaterial()
  boardMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld).toVar()
    const topF = step(0.5, N.y)
    const fw = max(fwidth(P.x), fwidth(P.z)).toVar()
    // chess: walnut and maple veneer, grain along the files, a figure per square
    const fi = floor(P.x.div(S).add(4)), ri = floor(float(4).sub(P.z.div(S)))
    const inSq = step(abs(P.x), 4 * S).mul(step(abs(P.z), 4 * S))
    const dark = step(fract(fi.add(ri).mul(0.5)), 0.25) // a1 dark, h1 light
    const cell = vec2(fi, ri)
    const fig = fbm(vec2(P.x.mul(30), P.z.mul(4)).add(hash21(cell).mul(37))).toVar()
    const fineA = sstep(0.0016, 0.0006, fw)
    const fine = sin(P.x.mul(2600).add(fig.mul(9))).mul(0.5).add(0.5).mul(fineA)
    const maple = vec3(0.56, 0.37, 0.18).mul(fig.mul(0.3).add(0.82)).mul(fine.mul(0.08).add(0.95))
    const walnut = vec3(0.1, 0.05, 0.026).mul(fig.mul(0.45).add(0.72)).mul(fine.mul(0.18).add(0.88))
    const frame = vec3(0.075, 0.038, 0.02).mul(fbm(vec2(P.z.mul(5), P.x.mul(40))).mul(0.4).add(0.75))
    const chess = mixN(frame, mixN(maple, walnut, dark), inSq).toVar()
    // kaya: pale gold, straight close grain (masame) along the board, a little warmer at the ends
    const kg = fbm(vec2(P.x.mul(55), P.z.mul(3))).toVar()
    const kfine = sin(P.x.mul(3800).add(kg.mul(14))).mul(0.5).add(0.5).mul(sstep(0.0011, 0.0004, fw))
    const kaya = vec3(0.68, 0.45, 0.2).mul(kg.mul(0.18).add(0.9)).mul(kfine.mul(0.07).add(0.96)).toVar()
    // the wood turns from the near corner as a wave
    const wipe = sstep(U.gW.mul(1.6).sub(0.4), U.gW.mul(1.6).sub(0.1), P.x.add(P.z).mul(-1.1).add(0.55).mul(0.5).add(0.5) as F)
    const alb = mixN(chess, kaya, float(1).sub(wipe).mul(step(0.001, U.gW)).max(step(0.999, U.gW))).toVar()
    // the lines: nineteen each way, each born on its nearest square boundary and sliding to the goban's spacing
    const dx = float(9).toVar(), dz = float(9).toVar()
    Loop(19, ({ i }) => {
      const j = float(i)
      const b = floor(j.mul(8 / 18).add(0.5))
      const st = sat1(U.gS.mul(1.25).sub(abs(j.sub(9)).mul(0.014)) as F)
      const sm = st.mul(st).mul(st.mul(-2).add(3))
      const lx = mixN(b.sub(4).mul(S), j.sub(9).mul(GX), sm)
      const lz = mixN(b.sub(4).mul(S), j.sub(9).mul(GZ), sm)
      dx.assign(min(dx, abs(P.x.sub(lx))))
      dz.assign(min(dz, abs(P.z.sub(lz))))
    })
    const extX = mixN(float(4 * S), float(9 * GX), U.gS), extZ = mixN(float(4 * S), float(9 * GZ), U.gS)
    const lw = float(0.00062)
    const aa = fw.mul(0.75).add(1e-5)
    const vL = sstep(lw.add(aa), lw.sub(aa), dx as F).mul(step(abs(P.z), extZ.add(lw)))
    const hL = sstep(lw.add(aa), lw.sub(aa), dz as F).mul(step(abs(P.x), extX.add(lw)))
    const lines = max(vL, hL).mul(U.gL).toVar()
    // star points at 4-4, 4-10 and 10-10, lacquered dots
    const sx = abs(P.x).sub(6 * GX), sz = abs(P.z).sub(6 * GZ)
    const sdx = min(abs(sx), abs(P.x)), sdz = min(abs(sz), abs(P.z))
    const star = sstep(U.gP.mul(0.0025).add(aa), U.gP.mul(0.0025).sub(aa), length(vec2(sdx, sdz)) as F).mul(step(0.01, U.gP))
    const ink = max(lines, star)
    alb.assign(mixN(alb, vec3(0.03, 0.022, 0.016), ink.mul(topF)))
    // the edges: end grain, darker; a goban's sides are planed kaya
    const side = mixN(vec3(0.1, 0.055, 0.03).mul(fbm(vec2(P.y.mul(300), P.x.add(P.z).mul(60))).mul(0.4).add(0.7)), kaya.mul(0.86), sstep(0.3, 0.9, U.gW))
    alb.assign(mixN(side, alb, topF))
    const cast = castOnBoard(P as V3)
    // the waxed top's sheen: walnut and kaya both have a soft finish; lines are lacquer
    const gloss = mixN(float(0.16), float(0.12), U.gW).add(ink.mul(0.25))
    const col = lit(alb as V3, N as V3, P as V3, { spec: gloss, shin: 40, sh: cast.x, ao: cast.y.mul(topF).add(topF.oneMinus().mul(0.8)), rim: 0.2, sheen: 0.05 })
    return vec4(col, depthA())
  })()
  const board = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), boardMat)
  scene.add(board)

  // ---- the cloth: charcoal felt under a pool of light; the board and the clock shade it
  const clothMat = new THREE.NodeMaterial()
  // the clock: beside the board on the queenside flank, far enough off that both faces are in the low pass; half-sizes
  const CLK = { x: -0.37, z: -0.12, w: 0.046, d: 0.105, h: 0.098, rot: -0.53 }
  // the go-ke: two bowls on the floor by the goban, each lid upturned beside it (to hold prisoners: none yet by move 37)
  const BOWLS: { x: number; z: number; black: boolean }[] = [{ x: -0.38, z: 0.15, black: true }, { x: 0.385, z: 0.22, black: false }]
  const LIDS: [number, number][] = [[-0.44, -0.02], [0.4, 0.06]]
  const props = uniform(0) // 0: the clock stands; 1: the bowls (the clock has gone)
  clothMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const fw = fwidth(P.x).toVar()
    const fib = vnoise(P.xz.mul(1400)).mul(sstep(0.0012, 0.0004, fw)).toVar()
    const mott = fbm(P.xz.mul(9)).toVar()
    const alb = vec3(0.018, 0.02, 0.023).mul(mott.mul(0.3).add(0.85)).mul(fib.mul(0.22).add(0.9))
    // the board's shadow: follow the key up to the board's top and see if it lands on the board
    const hit = P.xz.add(KEYD.xz.div(KEYD.y).mul(U.top))
    const qx = abs(hit.x).sub(U.hx), qz = abs(hit.y).sub(U.hz)
    const bsh = sstep(0.02, -0.01, max(qx, qz) as F)
    const ox = abs(P.x).sub(U.hx), oz = abs(P.z).sub(U.hz)
    const bao = sstep(0.05, 0.0, max(ox, oz) as F).mul(0.55)
    // the clock's shadow and its contact
    const cc = Math.cos(CLK.rot), cs = Math.sin(CLK.rot)
    const toClk = (q: V2): F => {
      const rx = q.x.sub(CLK.x), rz = q.y.sub(CLK.z)
      const lx = rx.mul(cc).sub(rz.mul(cs)), lz = rx.mul(cs).add(rz.mul(cc))
      return max(abs(lx).sub(CLK.w), abs(lz).sub(CLK.d)) as F
    }
    const csh = sstep(0.03, -0.01, toClk(P.xz.add(KEYD.xz.div(KEYD.y).mul(CLK.h * 0.8)) as V2)).mul(0.85)
    const cao = sstep(0.04, 0.0, toClk(P.xz as V2)).mul(0.5)
    // the bowls and lids: contact shade, and their shadows thrown along the key
    const bw = float(0).toVar()
    for (const b of [...BOWLS.map((o) => [o.x, o.z, 0.068, 0.085] as const), ...LIDS.map(([x, z]) => [x, z, 0.066, 0.02] as const)]) {
      const q = P.xz.sub(vec2(b[0], b[1]))
      const shq = q.add(KEYD.xz.div(KEYD.y).mul(b[3] * 0.7))
      bw.assign(max(bw, sstep(b[2] * 1.25, b[2] * 0.9, length(q) as F).mul(0.6).max(sstep(b[2] * 1.15, b[2] * 0.85, length(shq) as F).mul(0.85))))
    }
    const sh = float(1).sub(max(max(bsh, csh.mul(props.oneMinus())), bw.mul(props)).mul(0.85))
    const ao = float(1).sub(max(bao, cao.mul(props.oneMinus())))
    const col = lit(alb as V3, vec3(0, 1, 0) as V3, P as V3, { spec: 0.0, shin: 2, sh, ao, rim: 0, sheen: 0.12 })
    return vec4(col, depthA())
  })()
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), clothMat)
  scene.add(cloth)

  // ---- studio darkness behind: a faint warm haze high up, nothing to look at
  const backMat = new THREE.NodeMaterial()
  backMat.side = THREE.BackSide
  backMat.fragmentNode = Fn(() => {
    const d = normalize(positionWorld.sub(cameraPosition))
    const glow = exp(length(d.xz.sub(vec2(-0.35, -0.6))).mul(-2.2)).mul(sstep(-0.05, 0.25, d.y as F))
    return vec4(vec3(0.006, 0.0055, 0.0055).add(vec3(0.03, 0.022, 0.016).mul(glow)), 30)
  })()
  const back = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 12), backMat)
  scene.add(back)

  // ---- the pieces: boxwood and ebony, one material each, carving rules by kind
  const pieceMat = (white: boolean) => {
    const m = new THREE.NodeMaterial()
    m.side = THREE.DoubleSide
    const kind = attribute("kind", "float")
    m.fragmentNode = Fn(() => {
      const L = positionLocal.toVar()
      const P = positionWorld.toVar()
      const origin = P.y.sub(L.y)
      // the lift: dissolve as the piece rises off the board
      const fade = sstep(0.004, 0.09, origin.sub(U.top) as F)
      Discard(hash21(floor(screenCoordinate.xy)).lessThan(fade))
      const ang = atan(L.z, L.x)
      const isK = (k: number) => step(abs(kind.sub(k)), 0.1)
      // the rook's crenellations: six slots cut down from the top of the tower
      Discard(isK(2).mul(step(0.0505, L.y)).mul(step(fract(ang.mul(6 / (2 * Math.PI)).add(0.08)), 0.24)).greaterThan(0.5))
      // the queen's coronet: eight points cut round the rim of the cup
      const crown = float(0.0727).add(cos(ang.mul(8)).mul(0.5).add(0.5).mul(0.0026))
      Discard(isK(4).mul(step(crown, L.y)).mul(step(0.0052, length(L.xz))).greaterThan(0.5))
      const N = normalize(normalWorld)
      // the bishop's mitre: a slanted cut on the side facing the opponent
      const mitreCut = isK(3).mul(sstep(0.0011, 0.0004, abs(L.y.sub(0.0565).add(L.x.mul(0.7))) as F)).mul(step(0.05, L.y)).mul(step(0.064, L.y).oneMinus()).mul(step(0, L.z.mul(white ? -1 : 1)))
      const g = vnoise(vec2(ang.mul(3), L.y.mul(500))).mul(0.6).add(vnoise(vec2(ang.mul(14), L.y.mul(2200))).mul(0.4)).toVar()
      const alb = (white ? vec3(0.72, 0.53, 0.31).mul(g.mul(0.18).add(0.88)) : vec3(0.022, 0.017, 0.014).mul(g.mul(0.5).add(0.75))).mul(float(1).sub(mitreCut.mul(0.8)))
      // the felt pad and the shade at the foot
      const ao = sstep(0.0, 0.012, L.y).mul(0.45).add(0.55)
      // the other pieces' shadows on this one: walk the key back from the point, past each column
      const shP = float(1).toVar()
      If(U.pieces.greaterThan(0.001), () => {
        const kh = length(KEYD.xz).toVar()
        const dirH = KEYD.xz.div(kh).toVar()
        const slope = KEYD.y.div(kh).toVar()
        Loop(NPIECE, ({ i }) => {
          const pc = pieceArr.element(int(i)) as unknown as V4
          const rel = pc.xy.sub(P.xz).toVar()
          const tq = dot(rel, dirH)
          const perp = length(rel.sub(dirH.mul(tq)))
          const own = step(length(rel), 0.024) // this piece's own column
          const rayY = P.y.add(tq.mul(slope))
          const topY = U.top.add(pc.z)
          // a column that narrows toward its head; the shadow's edge softens with the distance it travels
          const w = pc.w.mul(float(1).sub(sat1(rayY.sub(U.top).div(max(pc.z, 0.001)) as F).mul(0.45)))
          const soft = tq.mul(0.08).add(0.0015)
          const occ = sstep(w.add(soft), w.sub(soft), perp as F).mul(step(0, tq)).mul(sstep(topY.add(0.003), topY.sub(0.006), rayY as F)).mul(own.oneMinus())
          shP.mulAssign(float(1).sub(occ.mul(0.85)))
        })
      })
      const col = lit(alb as V3, N as V3, P as V3, white ? { spec: 0.22, shin: 36, ao, rim: 0.7, sheen: 0.04, sh: shP } : { spec: 0.55, shin: 90, ao, rim: 1.6, sheen: 0.03, sh: shP })
      return vec4(col, depthA())
    })()
    return m
  }
  const matW = pieceMat(true), matB = pieceMat(false)
  const geoCache = new Map<string, THREE.BufferGeometry>()
  const pieces: { mesh: THREE.Mesh; x: number; z: number; t: string; rank: number; white: boolean }[] = []
  for (const code of POSITION) {
    const white = code[0] === code[0].toUpperCase()
    const t = code[0].toLowerCase()
    const f = code.charCodeAt(1) - 97, r = +code[2] - 1
    const key = t + (t === "n" ? (white ? "W" : "B") : "")
    let g = geoCache.get(key)
    if (!g) {
      g = pieceGeometry(t, white)
      geoCache.set(key, g)
    }
    const mesh = new THREE.Mesh(g, white ? matW : matB)
    mesh.position.set(sqX(f), CH.th, sqZ(r))
    // turned pieces are never set quite square: a few degrees of turn each (the knights face the other side)
    if (t !== "n") mesh.rotation.y = (((f * 7 + r * 13) % 11) / 11) * 1.2
    else mesh.rotation.y = (((f * 5 + r * 3) % 7) / 7 - 0.5) * 0.35
    scene.add(mesh)
    pieces.push({ mesh, x: sqX(f), z: sqZ(r), t, rank: r, white })
  }

  // ---- the stones: biconvex, slate and clamshell, dropped in the record's order
  const sph = new THREE.SphereGeometry(1, 40, 20)
  const stoneGeo = new THREE.InstancedBufferGeometry()
  stoneGeo.index = sph.index
  stoneGeo.setAttribute("position", sph.getAttribute("position"))
  stoneGeo.setAttribute("normal", sph.getAttribute("normal"))
  {
    const R = rng(37)
    const a = new Float32Array(37 * 4), b = new Float32Array(37 * 4)
    MOVES.forEach((m, i) => {
      const gap = i === 0 ? 0.2 : STONE_T[i] - STONE_T[i - 1]
      a.set([goX(m.c), goZ(m.r), STONE_T[i], m.black ? 1 : 0], i * 4)
      const th = R() * Math.PI * 2
      // slide: a few millimetres, longer for the hard last one; fall time follows the cadence
      b.set([Math.cos(th), Math.sin(th), Math.min(0.11, Math.max(0.045, gap * 0.8)), R()], i * 4)
    })
    stoneGeo.setAttribute("aS", new THREE.InstancedBufferAttribute(a, 4))
    stoneGeo.setAttribute("aR", new THREE.InstancedBufferAttribute(b, 4))
  }
  stoneGeo.instanceCount = 37
  stoneGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)
  const stoneMat = new THREE.NodeMaterial()
  {
    const aS = attribute("aS", "vec4"), aR = attribute("aR", "vec4")
    const black = aS.w
    const r = mixN(float(SR * 0.975), float(SR), black), hh = mixN(float(SH * 0.93), float(SH), black)
    const u = U.t1.sub(aS.z) // seconds since contact
    const fall = aR.z
    const shown = step(fall.negate(), u)
    const q = clampN(u.div(fall).negate(), 0, 1) // 1 at the top of the fall, 0 at contact
    const drop = q.mul(q).mul(0.045)
    const k = clampN(u.div(0.13), 0, 1)
    const slide = float(1).sub(k).mul(float(1).sub(k)).mul(float(1).sub(k)).mul(0.0032).mul(step(0, u)).add(q.mul(0.0032))
    const bounce = exp(max(u, 0).mul(-38)).mul(abs(sin(max(u, 0).mul(60)))).mul(0.0007).mul(step(0, u))
    const ctr = vec3(aS.x.add(aR.x.mul(slide)), U.top.add(hh).add(drop).add(bounce), aS.y.add(aR.y.mul(slide)))
    stoneMat.positionNode = ctr.add(positionGeometry.mul(vec3(r, hh, r)).mul(shown)).add(vec3(0, shown.oneMinus().mul(-5), 0))
    const vN = normalize(positionGeometry.div(vec3(r, hh, r))).toVarying()
    const vL = positionGeometry.toVarying()
    const vB = black.toVarying()
    const vSeed = aR.w.toVarying()
    stoneMat.fragmentNode = Fn(() => {
      const N = normalize(vN).toVar()
      const P = positionWorld.toVar()
      const Lc = vL.toVar()
      // clamshell: growth lines curving across the face, close and fine, a slightly warm white
      const a = vSeed.mul(6.28)
      const dir = vec2(cos(a), sin(a))
      const sx = dot(Lc.xz, dir).add(dot(Lc.xz, Lc.xz).mul(0.35))
      const stri = sin(sx.mul(70).add(vnoise(Lc.xz.mul(6).add(vSeed.mul(9))).mul(3))).mul(0.5).add(0.5)
      const striA = sstep(0.06, 0.02, fwidth(sx) as F)
      const shell = vec3(0.86, 0.84, 0.79).mul(float(1).sub(stri.mul(0.07).mul(striA))).mul(vnoise(Lc.xz.mul(3)).mul(0.04).add(0.97))
      // slate: near-black, faintly blue-grey, with a fine matte tooth
      const slate = vec3(0.014, 0.015, 0.018).mul(vnoise(Lc.xz.mul(40)).mul(0.25).add(0.9))
      const isB = step(0.5, vB)
      const alb = mixN(shell, slate, isB)
      const col = lit(alb as V3, N as V3, P as V3, {
        spec: mixN(float(0.45), float(0.07), isB),
        shin: 70,
        ao: sstep(-0.9, 0.2, Lc.y as F).mul(0.5).add(0.5),
        rim: mixN(float(0.5), float(1.4), isB),
        sheen: mixN(float(0.03), float(0.12), isB),
      })
      return vec4(col, depthA())
    })()
  }
  const stones = new THREE.Mesh(stoneGeo, stoneMat)
  stones.frustumCulled = false
  scene.add(stones)

  // ---- the chess clock (illustration): a mechanical tournament clock. A walnut case with a raked front, two round
  // dials each behind its own glass in a brass bezel, a plunger over each (the one on the running side up), and a
  // red flag on a pin at each dial's twelve: lifted by the minute hand as the hour comes up, dropped when it passes.
  const faceTex = clockFace()
  const clock = new THREE.Group()
  clock.position.set(CLK.x, 0, CLK.z)
  clock.rotation.y = CLK.rot
  scene.add(clock)
  /** Dissolves with the props uniform: the clock goes as the goban comes, the bowls arrive. */
  const dissolve = (inv: boolean) => {
    const k = inv ? props.oneMinus() : props
    Discard(hash21(floor(screenCoordinate.xy).add(inv ? 3.7 : 0)).lessThan(k))
  }
  const woodMat = new THREE.NodeMaterial()
  woodMat.fragmentNode = Fn(() => {
    dissolve(false)
    const P = positionWorld
    const L = positionLocal
    const N = normalize(normalWorld)
    // walnut, grain running along the case, a satin finish; the edges a touch darker where hands have worn them
    const fig = fbm(vec2(L.z.mul(18), L.y.mul(140).add(L.x.mul(90)))).toVar()
    const alb = vec3(0.12, 0.062, 0.032).mul(fig.mul(0.5).add(0.72)).mul(sin(L.y.mul(900).add(fig.mul(12))).mul(0.06).add(1))
    return vec4(lit(alb as V3, N as V3, P as V3, { spec: 0.28, shin: 34, rim: 0.7, sheen: 0.05 }), depthA())
  })()
  const metalMat = (c: [number, number, number], spec: number, shin: number) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      dissolve(false)
      const P = positionWorld
      const N = normalize(normalWorld)
      return vec4(lit(vec3(c[0], c[1], c[2]) as V3, N as V3, P as V3, { spec, shin, rim: 1.0, sheen: 0.1 }), depthA())
    })()
    return m
  }
  const brass = metalMat([0.42, 0.3, 0.12], 1.4, 50), chrome = metalMat([0.32, 0.32, 0.33], 2.0, 90), redM = metalMat([0.5, 0.05, 0.03], 0.4, 40)
  // the case: a raked front (the dials lean back toward the players), a flat top for the plungers
  const FR = { y: 0.09, inset: 0.017 }
  {
    const sh = new THREE.Shape([new THREE.Vector2(-CLK.w, 0), new THREE.Vector2(CLK.w, 0), new THREE.Vector2(CLK.w - FR.inset, FR.y), new THREE.Vector2(-CLK.w + 0.006, CLK.h)])
    const g = new THREE.ExtrudeGeometry(sh, { depth: CLK.d * 2, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 })
    g.translate(0, 0, -CLK.d)
    // its feet: four little brass buttons (it stands on them, a hair off the cloth)
    clock.add(new THREE.Mesh(g, woodMat).translateY(0.003))
    for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.004, 14), brass)
      ft.position.set(fx * (CLK.w - 0.008), 0.002, fz * (CLK.d - 0.012))
      clock.add(ft)
    }
  }
  // the front face's frame: its outward normal and a point at the dials' height
  const fn = new THREE.Vector3(FR.y, FR.inset, 0).normalize()
  const DIAL_R = 0.034, DIAL_Y = 0.05
  const dialAt = (z: number, out: THREE.Vector3) => out.set(CLK.w + 0.002 - (FR.inset * (DIAL_Y + 0.003)) / FR.y, DIAL_Y + 0.003, z)
  const faceMat = (cx: number) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      dissolve(false)
      const st = uvAttr()
      const c = texture(faceTex, vec2(st.x.sub(0.5).mul(0.43).add(cx), st.y.sub(0.5).mul(0.86).add(0.5))).rgb
      const P = positionWorld
      const N = normalize(normalWorld)
      // a domed glass over the dial: the key's glint, and a faint reflection of the room's dark at its rim
      const V = normalize(cameraPosition.sub(P))
      const r = length(st.sub(0.5)).mul(2)
      const Ng = normalize(N.add(vec3(0, 0, 0)).mul(1)).toVar()
      const gl = pow(max(dot(Ng, normalize(KEYD.add(V))), 0), 160).mul(2.2).add(pow(r, 6).mul(0.08))
      const col = lit(c.mul(0.85) as V3, N as V3, P as V3, { spec: 0.0, shin: 2, rim: 0.3 }).mul(float(1).sub(pow(r, 4).mul(0.35))).add(c.mul(vec3(0.1, 0.09, 0.08))).add(KEYC.mul(gl).mul(0.25))
      return vec4(col, depthA())
    })()
    return m
  }
  const dialGeo = new THREE.CircleGeometry(DIAL_R, 48)
  const bezelGeo = new THREE.TorusGeometry(DIAL_R + 0.002, 0.0028, 10, 48)
  const vD = new THREE.Vector3(), vZ = new THREE.Vector3(0, 0, 1)
  ;[[-0.052, 0.25], [0.052, 0.75]].forEach(([z, cx], k) => {
    dialAt(z, vD)
    for (const [geo, mat, off] of [[dialGeo, faceMat(cx), 0.0032], [bezelGeo, brass, 0.0042]] as const) {
      const m = new THREE.Mesh(geo, mat)
      m.position.copy(vD).addScaledVector(fn, off)
      m.quaternion.setFromUnitVectors(vZ, fn) // the disc's +z out along the raked face
      clock.add(m)
    }
    // the flag: a red blade on a pin at twelve, lifted on the running dial (k = 1), hanging on the other
    const pin = vD.clone().addScaledVector(fn, 0.0065)
    pin.y += DIAL_R * 0.74
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 0.0095, 0.0042), redM)
    flag.geometry.translate(0, 0.0042, 0)
    flag.position.copy(pin)
    flag.rotation.set(k === 1 ? -0.35 : -2.6, 0, 0)
    clock.add(flag)
    // the plunger over it: a chrome stem and a black cap; the waiting side's is pressed down
    const down = k === 0
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.016, 14), chrome)
    stem.position.set(-0.006, CLK.h - 0.004 + (down ? 0.002 : 0.009), z)
    clock.add(stem)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0115, 0.0065, 24), metalMat([0.02, 0.018, 0.016], 0.9, 70))
    cap.position.set(-0.006, CLK.h + (down ? 0.009 : 0.016), z)
    clock.add(cap)
  })
  // the winding keys, folded flat on the back
  for (const z of [-0.052, 0.052]) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012, 0.009), brass)
    key.position.set(-CLK.w - 0.002, 0.05, z)
    clock.add(key)
  }

  // ---- the goban's legs: kuchinashi, the gardenia fruit, turned and carved (they grow as the board rises)
  const legMat = new THREE.NodeMaterial()
  legMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const L = positionLocal
    const N = normalize(normalWorld)
    const ribs = cos(atan(L.z, L.x).mul(6)).mul(0.5).add(0.5)
    const alb = vec3(0.6, 0.38, 0.16).mul(fbm(vec2(L.y.mul(400), atan(L.z, L.x).mul(3))).mul(0.25).add(0.82)).mul(ribs.mul(0.12).add(0.9))
    return vec4(lit(alb as V3, N as V3, P as V3, { spec: 0.15, shin: 30, rim: 0.4, ao: sstep(0.0, 0.02, L.y as F).mul(0.4).add(0.6) }), depthA())
  })()
  const legProf: [number, number][] = [[0, 0], [0.016, 0], [0.024, 0.01], [0.031, 0.03], [0.03, 0.05], [0.022, 0.066], [0.014, 0.072], [0.016, 0.08], [0.02, 0.085], [0, 0.085]]
  const legGeo = new THREE.LatheGeometry(legProf.map(([r, y]) => new THREE.Vector2(r, y)), 36)
  const legs: THREE.Mesh[] = []
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const m = new THREE.Mesh(legGeo, legMat)
    m.position.set(lx * (GO.hx - 0.032), 0, lz * (GO.hz - 0.032))
    m.visible = false
    scene.add(m)
    legs.push(m)
  }

  // ---- the go-ke: turned mulberry bowls, open, a heap of stones in each; the lids upturned beside them
  const bowlMat = (lid: boolean) => {
    const m = new THREE.NodeMaterial()
    m.side = THREE.DoubleSide
    m.fragmentNode = Fn(() => {
      dissolve(true)
      const P = positionWorld
      const L = positionLocal
      const N = normalize(normalWorld)
      // mulberry: golden brown, its rings showing as broad bands across the turned form, a lacquered sheen
      const rr = length(L.xz)
      const ring = sin(rr.mul(260).add(L.y.mul(120)).add(fbm(L.xz.mul(40)).mul(4))).mul(0.5).add(0.5)
      const alb = vec3(0.34, 0.18, 0.07).mul(ring.mul(0.28).add(0.78)).mul(fbm(L.xz.mul(25).add(L.y.mul(30))).mul(0.25).add(0.85))
      const inside = lid ? float(0) : step(dot(N, normalize(L.mul(vec3(1, 0, 1)))), -0.1)
      return vec4(lit(alb.mul(float(1).sub(inside.mul(0.45))) as V3, N as V3, P as V3, { spec: 0.6, shin: 60, rim: 0.6, sheen: 0.08 }), depthA())
    })()
    return m
  }
  // the bowl: a flattened, wide body with a foot, its mouth turned in; and the shallow domed lid, upturned
  const bowlProf: [number, number][] = [[0, 0], [0.045, 0], [0.047, 0.004], [0.06, 0.012], [0.068, 0.03], [0.067, 0.05], [0.06, 0.066], [0.05, 0.074], [0.048, 0.072], [0.056, 0.064], [0.062, 0.05], [0.062, 0.03], [0.054, 0.016], [0.0, 0.012]]
  const lidProf: [number, number][] = [[0, 0], [0.03, 0.001], [0.055, 0.008], [0.066, 0.018], [0.064, 0.021], [0.052, 0.013], [0.028, 0.007], [0, 0.006]]
  const bowlG = new THREE.LatheGeometry(bowlProf.map(([r, y]) => new THREE.Vector2(r, y)), 48)
  const lidG = new THREE.LatheGeometry(lidProf.map(([r, y]) => new THREE.Vector2(r, y)), 48)
  const bowlM = bowlMat(false), lidM = bowlMat(true)
  const bowls = new THREE.Group()
  scene.add(bowls)
  BOWLS.forEach((b) => {
    const m = new THREE.Mesh(bowlG, bowlM)
    m.position.set(b.x, 0, b.z)
    bowls.add(m)
  })
  LIDS.forEach(([x, z]) => {
    const m = new THREE.Mesh(lidG, lidM)
    m.position.set(x, 0, z)
    bowls.add(m)
  })
  // the stones in the bowls: a heap, each one flattened and turned
  {
    const N_IN = 46
    const g = new THREE.SphereGeometry(1, 18, 10)
    const inMat = new THREE.NodeMaterial()
    const blk = attribute("blk", "float")
    const vB = blk.toVarying()
    inMat.fragmentNode = Fn(() => {
      dissolve(true)
      const P = positionWorld
      const N = normalize(normalWorld)
      const isB = step(0.5, vB)
      const alb = mixN(vec3(0.84, 0.82, 0.77), vec3(0.014, 0.015, 0.018), isB)
      return vec4(lit(alb as V3, N as V3, P as V3, { spec: mixN(float(0.45), float(0.08), isB), shin: 70, rim: mixN(float(0.5), float(1.4), isB), sheen: mixN(float(0.03), float(0.12), isB), ao: 0.75 }), depthA())
    })()
    const im = new THREE.InstancedMesh(g, inMat, N_IN * 2)
    const bl = new Float32Array(N_IN * 2)
    const R = rng(91), o = new THREE.Object3D()
    BOWLS.forEach((b, bi) => {
      for (let i = 0; i < N_IN; i++) {
        const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.05
        const dome = 0.058 - (r / 0.05) ** 2 * 0.012 + R() * 0.004
        o.position.set(b.x + Math.cos(a) * r, dome, b.z + Math.sin(a) * r)
        o.rotation.set((R() - 0.5) * 0.9, R() * 6, (R() - 0.5) * 0.9)
        o.scale.set(SR, SH, SR)
        o.updateMatrix()
        im.setMatrixAt(bi * N_IN + i, o.matrix)
        bl[bi * N_IN + i] = b.black ? 1 : 0
      }
    })
    g.setAttribute("blk", new THREE.InstancedBufferAttribute(bl, 1))
    im.frustumCulled = false
    bowls.add(im)
  }

  // ---- the rule of ages: chrome, catching the same warm key
  const rface = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "steel", debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(rface.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const br = vnoise(vec2(st.x.mul(60), st.y.mul(240))).mul(0.6).add(vnoise(vec2(st.x.mul(260), st.y.mul(800))).mul(0.4)).toVar()
    const metal = vec3(0.6, 0.585, 0.56).mul(br.mul(0.3).add(0.82))
    const col = mixN(metal, cut.rgb, on).toVar()
    const N = normalize(normalWorld)
    const lt = col.mul(vec3(1.0, 0.86, 0.68).mul(max(dot(N, KEYD), 0).mul(0.4).add(0.5)).add(SKY.mul(2))).add(vec3(1.0, 0.86, 0.68).mul(pow(br, 3)).mul(0.05).mul(on.oneMinus()))
    return vec4(ctx.debugLabels ? mixN(lt, cut.rgb, step(0.02, on)) : lt, -1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 10
  rule.frustumCulled = false
  scene.add(rule)

  // ---------------------------------------------------------------- targets, focus

  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), blur: uniform(0), focus: uniform(1), asp: uniform(16 / 9), shade: uniform(1) }
  // depth of field from the depth in alpha; a sample may only spread onto what is no sharper than itself
  const dof = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const coc = (d: F): F => sat1(abs(d.sub(D.focus)).div(max(d, 0.001)).mul(step(0, d)) as F)
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    If(r0.greaterThan(0.0005), () => {
      Loop(20, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(20))
        const a = fi.mul(2.39996)
        const o = vec2(cos(a), sin(a)).mul(rr).mul(r0).div(vec2(D.asp, 1))
        const t = sampleRT(D.tT, uv.add(o) as V2).toVar()
        const w = sat1(coc(t.a as F).mul(D.blur).div(rr.mul(r0).add(1e-5)).mul(1.3).add(step(c0.a, t.a)) as F).mul(step(0, t.a))
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    const col = acc.rgb.div(acc.a).toVar()
    // a soft shade behind the headline so it reads over the lit board
    col.mulAssign(float(1).sub(D.shade.mul(sstep(0.6, 0.0, length(uv.sub(vec2(0.2, 0.8)).mul(vec2(1.0, 1.9))) as F)).mul(0.45)))
    return vec4(col, 1)
  }, D)

  // ---------------------------------------------------------------- the camera and the story clock

  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), up = new THREE.Vector3()
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3()
  const s37 = new THREE.Vector3(goX(14), 0, goZ(9))
  // the low pass: from White's kingside corner across the pawns, toward Black's king on c8
  const LOW0 = { p: [0.47, 0.068, 0.37], t: [0.02, 0.035, -0.08] }
  const LOW1 = { p: [0.3, 0.078, 0.44], t: [-0.1, 0.04, -0.16] }
  // top-down, the board right of centre (screen up is Black's side, -z)
  const TOPH = 1.3
  const TOP = { p: [-0.45, TOPH, 0.06], t: [-0.17, 0.1, 0.06] }
  const st = { look: 0, moves: 0, crane: 0, push: 0, dist: 0.5 }
  const POST: PostOpts = { tone: "agx", exposure: 0.95, bloom: 0.25, bloomThresh: 1.2, bloomRadius: 0.7, vignette: 0.28, grain: 0.024, contrast: 1.07, sat: 1.0, lift: [0.004, 0.0045, 0.008], gain: [1.03, 1, 0.95], halation: 0.15, ca: 0.0005 }
  const TITLES: TitleOpts = {
    color: "#f6efe2",
    shadow: "rgba(4,3,2,0.75)",
    delay: [START + 0.05, 0.25],
    subs: ctx.def.beats.map((b) => b.sub?.replace(" (IBM;", "\n(IBM;").replace("2016. Game", "2016.\nGame")),
  }
  const HUD = { color: "#efe6d6", shadow: "rgba(0,0,0,0.6)" }
  const sel = { x: 0, y: 0, r: 0, on: 0 }

  const set3 = (o: THREE.Vector3, a: number[]) => o.set(a[0], a[1], a[2])

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1)
    U.t1.value = t1
    // ---- beat 0: the look along the board, then the crane
    const look = E.io2(clamp((t0 - START) / (2.3 - START)))
    const crane = E.io3(clamp((t0 - 2.25) / 1.35))
    st.look = look
    st.crane = crane
    camPos.lerpVectors(set3(v1, LOW0.p), set3(v2, LOW1.p), look)
    camTgt.lerpVectors(set3(v1, LOW0.t), set3(v2, LOW1.t), look)
    if (crane > 0) {
      // up and over: along an arc that rises before it swings
      const a = crane
      v1.set(mix(camPos.x, TOP.p[0], E.io2(a)), mix(camPos.y, TOP.p[1], 1 - (1 - a) * (1 - a)), mix(camPos.z, TOP.p[2], E.io2(a)) + 0.25 * Math.sin(Math.PI * a))
      camPos.copy(v1)
      camTgt.lerp(set3(v2, TOP.t), E.io2(a))
    }
    // ---- beat 1: the push to move 37, in log distance, tilting a little to the south so the sheens show
    const push = E.out3(clamp((t1 - T37 + 0.02) / 0.85))
    st.push = push
    s37.y = LEG_H + GO.th + SH
    if (push > 0) {
      const d = Math.exp(mix(Math.log(TOPH), Math.log(0.3), push))
      const tilt = 0.5 * push
      v1.set(s37.x, s37.y + d * Math.cos(tilt), s37.z + d * Math.sin(tilt))
      camPos.lerp(v1, Math.min(1, push * 1.6))
      camTgt.lerp(s37, Math.min(1, push * 1.6))
    }
    // the slam of the transition: the lens shudders as the squares land
    const slam = t0 >= 0 ? Math.exp(-t0 * 9) * (s.enter < 1 ? 1 : 1) : 0
    const [hx, hy, hz] = shake(s.time, 0.0015 * (1 - push * 0.8), 0.35)
    const [sx, sy] = shake(t0 * 3, 0.006 * slam, 4)
    camTgt.x += hx + sx
    camTgt.y += hy + sy
    camTgt.z += hz
    camTgt.x += s.mouse.x * 0.004
    camTgt.z -= s.mouse.y * 0.004
    cam.position.copy(camPos)
    // up turns from the world's up to Black's side as the lens comes over the top
    up.set(0, 1, 0).lerp(v3.set(0, 0, -1), clamp(crane * 1.4 - 0.2) * (1 - push) + push * 0.5 * (1 - push)).normalize()
    if (push > 0) up.set(0, 1 - push, -1).normalize()
    cam.up.copy(up)
    cam.lookAt(camTgt)
    cam.aspect = s.w / s.h
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    st.dist = camPos.distanceTo(camTgt)

    // ---- beat 1: the pieces go, the board turns into a goban
    const kM = E.io3(clamp((t1 - T_M0) / (T_M1 - T_M0)))
    U.gW.value = clamp((t1 - T_M0) / (T_M1 - T_M0 - 0.15))
    U.gL.value = smooth(T_M0 + 0.05, T_M0 + 0.3, t1)
    U.gS.value = E.io2(clamp((t1 - (T_M0 + 0.2)) / (T_M1 - T_M0 - 0.15)))
    U.gP.value = E.outBack(clamp((t1 - (T_M1 - 0.05)) / 0.2))
    const th = mix(CH.th, GO.th, kM)
    const lift0 = LEG_H * kM // the block rises onto its legs as it thickens
    U.top.value = lift0 + th
    U.hx.value = mix(CH.hx, GO.hx, kM)
    U.hz.value = mix(CH.hz, GO.hz, kM)
    board.scale.set(2 * U.hx.value, th, 2 * U.hz.value)
    board.position.set(0, lift0 + th / 2, 0)
    for (const l of legs) {
      l.visible = kM > 0.01
      l.scale.set(1, Math.max(kM, 0.01), 1)
    }
    // the clock goes with the pieces; the bowls come with the goban
    props.value = s.beat === 0 ? 0 : smooth(0.15, T_M1, t1)
    clock.visible = props.value < 0.999
    bowls.visible = props.value > 0.001
    // the light: a high studio key for chess; for go, a low warm raking light across the grain
    const rk = s.beat === 0 ? 0 : E.io2(clamp((t1 - 0.1) / 0.8))
    KEYU.value.copy(KEY).lerp(RAKE, rk).normalize()
    KEYCU.value.set(mix(1.0, 1.0, rk), mix(0.84, 0.74, rk), mix(0.64, 0.46, rk)).multiplyScalar(mix(2.1, 2.5, rk))
    // pieces: a hop when the squares slam (beat 0's start), and in beat 1 they rise and dissolve, rank by rank from White's side
    let anyPiece = 0
    pieces.forEach((pc, i) => {
      const th = U.top.value
      const hop = t0 >= 0 && t0 < 0.6 ? Math.abs(Math.sin(t0 * 26 + i)) * Math.exp(-t0 * 11) * 0.0045 : 0
      const k0 = 0.03 * (pc.white ? pc.rank : 7 - pc.rank) + ((i * 37) % 7) * 0.012
      const lift = E.in2(clamp((t1 - k0) / (T_LIFT - 0.1)))
      pc.mesh.position.set(pc.x, th + hop + lift * 0.12, pc.z)
      pc.mesh.visible = lift < 0.999
      if (pc.mesh.visible) anyPiece = 1
      ;(pieceArr.array[i] as THREE.Vector4).set(pc.x, pc.z, H_OF[pc.t] * (1 - lift), (pc.t === "p" ? 0.009 : 0.0115) * (1 - lift * 0.9))
    })
    U.pieces.value = anyPiece
    U.stones.value = t1 > T_S0 - 0.2 ? 1 : 0
    stones.visible = t1 > T_S0 - 0.2
    // moves made so far
    let n = 0
    for (let i = 0; i < 37; i++) if (t1 >= STONE_T[i]) n = i + 1
    st.moves = n
    // ---- focus: from the near pawns to Black's king, then the board; and the selection box
    D.asp.value = cam.aspect
    const nearF = Math.hypot(LOW0.p[0] - sqX(6), LOW0.p[1] - 0.04, LOW0.p[2] - sqZ(1)), kingF = Math.hypot(LOW1.p[0] - sqX(2), LOW1.p[1] - 0.06, LOW1.p[2] - sqZ(7))
    const rack = smooth(START + 0.4, 2.0, t0)
    D.focus.value = crane > 0.05 || s.beat > 0 ? st.dist : mix(nearF, kingF, rack)
    D.blur.value = mix(0.014, 0.002, crane) * (s.beat > 0 ? 0 : 1) + (s.beat > 0 ? 0.002 + 0.03 * push : 0)
    D.shade.value = ctx.debugLabels ? 0 : 1 - 0.5 * push
    placeRule(rule, cam, { dist: 0.06 })
    rface.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    // the selection box on move 37, in design pixels
    v1.copy(s37).project(cam)
    v2.copy(s37).add(v3.set(SR * 1.4, 0, 0)).project(cam)
    sel.x = (v1.x * 0.5 + 0.5) * DW
    sel.y = (0.5 - v1.y * 0.5) * DH
    sel.r = Math.max(26, Math.hypot(((v2.x - v1.x) * DW) / 2, ((v2.y - v1.y) * DH) / 2))
    sel.on = s.beat === 1 ? smooth(T37 + 0.06, T37 + 0.22, t1) : 0
    if (s.live) {
      const rate = s.beat === 1 && t1 > T_S0 && t1 < T37 ? smooth(T_S0, T37, t1) : 0
      ctx.synth.bed("hum", s.beat === 0 ? 0.12 : t1 < T37 ? 0.1 + 0.25 * rate : 0)
      ctx.synth.bed("air", rate * 0.35)
    }
  }

  // ---------------------------------------------------------------- sound

  const lp: [number, number, number] = [0, 0, 0]
  const sp = new THREE.Vector3()
  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    // the pieces come down after the squares slam: a rattle of felt on wood
    { b: 0, at: 0.04, s: "thud", o: { f: H(5), g: 0.5 }, pos: [0.1, -0.2, 0.2] },
    { b: 0, at: 0.09, s: "thud", o: { f: H(6), g: 0.35 }, pos: [-0.3, -0.1, 0.3] },
    { b: 0, at: 0.15, s: "thud", o: { f: H(7), g: 0.25 }, pos: [0.3, -0.1, 0.3] },
    { b: 0, at: 2.3, s: "whoosh", o: { g: 0.2, f: 140, dur: 1.2 } },
    // beat 1: the pieces lift away, the lines split
    { b: 1, at: 0.05, s: "whoosh", o: { g: 0.3, f: 220, dur: 0.45 } },
    { b: 1, at: T_M0 + 0.25, s: "scratch", o: { f: 900, g: 0.18, dur: 0.4 }, pos: [0.3, 0, 0.2] },
    { b: 1, at: T_M1 - 0.05, s: "tick", o: { f: H(48), g: 0.4 }, pos: [0.3, 0, 0.1] },
    // move 37: the hard stop
    { b: 1, at: T37, s: "thump", o: { g: 0.9 }, pos: () => listenerPos(sp.set(goX(14), LEG_H + GO.th, goZ(9)), cam, st.dist, lp) },
    { b: 1, at: T37, s: "sub", o: { g: 0.9 } },
    { b: 1, at: T37 + 0.08, s: "select", o: { g: 0.6 } },
  ]
  MOVES.forEach((m, i) => {
    // every stone where it lands; the cadence is the record's order, sped up
    const last = i === 36
    cues.push({ b: 1, at: STONE_T[i], s: "stone", o: { g: last ? 1 : 0.45 + 0.35 * (i / 36), f: m.black ? H(6) : H(7), vary: 1 }, pos: () => listenerPos(sp.set(goX(m.c), LEG_H + GO.th, goZ(m.r)), cam, st.dist, lp) })
  })

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: dof, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x050404, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      D.tT.value = stage.texture
      dof.render(out)
      if (ctx.debugLabels) Object.assign(POST, { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, halation: 0, ca: 0, vignette: 0, lift: [0, 0, 0], gain: [1, 1, 1] })
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      titles(g, s, ctx.def, TITLES)
      if (s.beat === 1 && sel.on > 0) {
        const r = sel.r * 1.25
        g.selbox(sel.x - r, sel.y - r, 2 * r, 2 * r, sel.on)
        const a = sel.on * (1 - (1 - s.exit * 1.5 < 0 ? 1 : s.exit * 1.5))
        g.text("move 37 · P10", sel.x + r + 22, sel.y + 10, { size: 34, font: "mono", color: "#1b120a", alpha: a, style: "type", by: "glyph", p: clamp((s.at(1) - T37 - 0.1) / 0.35), shadow: { color: "rgba(255,236,205,0.9)", blur: 12 } })
      }
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(rface)],
    dispose() {
      rface.dispose()
      faceTex.dispose()
      legGeo.dispose()
      sph.dispose()
      for (const g of geoCache.values()) g.dispose()
      disposeTree(scene)
    },
  }
}
