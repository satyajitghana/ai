// Scene 18, lens: "Glass". The scientific revolution.
//
// Idea. Looking, with an instrument, and finding the world is not what was assumed. Twice, in one
// dark room: a tube with two lenses shows four points going round Jupiter; a wedge of glass shows
// that white is not simple.
//
// Staging. Beat 0, night: the eye at the eyepiece of a wood-and-leather refractor (Museo Galileo,
// inv. 2428: 927 mm long, a 37 mm objective stopped to 15 mm, magnification 21, a 15' field), drawn
// at its true apparent size, 5.25 degrees: a keyhole of sky in a black tube with a pale disc and
// points on one line. Pull back and rack to a notebook in candlelight, and read up it row by row
// (focus racking from one to the next): six nights written as Sidereus Nuncius describes them (7, 8, 10, 11, 12, 13 January: counts and sides are his
// words; east is left, as in his diagrams and in an erect Galilean image), the sixth still wet, the
// quill back in the pot (no hand in frame, so nothing moves by itself). Then down the tube again.
// Beat 1, day: the shutters close; sunlight comes through a quarter-inch hole (Newton 1672: "a small
// hole in my window-shuts"), a white pencil in the dust to a prism of 63.2 degrees, and after it one
// thin cone per wavelength across 22 feet to the far wall. The hole is a pinhole camera, so each
// wavelength throws a disc the size of the sun's image and the patch is their sum: straight sides,
// round ends, about five times longer than broad, violet at the top.
//
// Story parameter. `spread`: which night's row is being read, then how far the light has got from
// the hole (to the prism, to the wall).
//
// World rule. `roomLit`: one motivated source at a time. The candle (inverse square, shaded from
// the observer), a trace of sky through the window, and `beamLight`: the sun's pencil and the fan
// of wavelengths. Plaster, oak, brass, leather, glass, paper, the dust in the air and the
// rule of ages all take their light from it.
//
// Assumption: the glass's index (Cauchy, 1.513 at 700 nm to 1.537 at 400 nm) is chosen so that the
// computed patch has Newton's measured proportion. Illustration: the brass, the stand, the candle,
// the notebook, the two rooms being one. Cut for time: the card and the second prism.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraPosition, clamp as clampN, cos, dot, exp, float, floor, Fn, fract, If, length, Loop, max, min, mix as mixN, normalize, reflect, refract, normalWorld, positionLocal, positionWorld, pow, sin, sqrt, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { disposeTree, stageTarget } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { TYPE, titles, type TitleOpts } from "../engine/titles"
import { fbm, fbm3, hash21, hash33, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { APERTURE_AT, APERTURE_DUR, APERTURE_IN } from "../transitions/aperture"

// ---------------------------------------------------------------- the optics (metres, degrees where said)

const DEG = Math.PI / 180
const APEX = 63.2 * DEG // "63 degr. 12 min."
const nOf = (um: number) => 1.50136 + 0.0057017 / (um * um) // the assumed glass (see the header)
const N_MID = nOf(0.55)
const INC = Math.asin(N_MID * Math.sin(APEX / 2)) // the prism is set at minimum deviation for the middle of the spectrum
const devOf = (n: number) => INC + Math.asin(n * Math.sin(APEX - Math.asin(Math.sin(INC) / n))) - APEX
const TH_IN = -(devOf(N_MID) - 3.3 * DEG) // the sun's pencil comes down; the middle of the fan leaves 3.3 degrees above level
const PR: [number, number, number] = [-3.0, 1.74, 0] // the prism
const THROW = 6.7056 // "22 foot"
const WALL_X = PR[0] + THROW
const L0 = 0.5 // hole to prism
const HOLE: [number, number, number] = [PR[0] - Math.cos(TH_IN) * L0, PR[1] - Math.sin(TH_IN) * L0, 0]
const SHUT_X = HOLE[0]
const R_HOLE = 0.003175 // a quarter of an inch across
const TAN_SUN = Math.tan(0.2665 * DEG) // the sun's half-angle: every pencil is a cone this wide
const K = 14
/** A wavelength's colour (after Bruton's piecewise fit), linear-ish, for a sum over the visible range. */
const waveRGB = (nm: number): [number, number, number] => {
  let r = 0, g = 0, b = 0
  if (nm < 440) {
    r = (440 - nm) / 60
    b = 1
  }
  else if (nm < 490) {
    g = (nm - 440) / 50
    b = 1
  }
  else if (nm < 510) {
    g = 1
    b = (510 - nm) / 20
  }
  else if (nm < 580) {
    r = (nm - 510) / 70
    g = 1
  }
  else if (nm < 645) {
    r = 1
    g = (645 - nm) / 65
  }
  else r = 1
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 680 ? 0.3 + (0.7 * (750 - nm)) / 70 : 1
  return [(r * f) ** 1.6, (g * f) ** 1.6, (b * f) ** 1.6]
}
/** `n` wavelengths from red to violet, their colours scaled so that together they add up to the sun's white. */
const spectrum = (n: number) => {
  const w = Array.from({ length: n }, (_, i) => {
    const nm = 700 - (300 * i) / (n - 1)
    const th = TH_IN + devOf(nOf(nm / 1000))
    return { nm, th, dir: new THREE.Vector3(Math.cos(th), Math.sin(th), 0), col: waveRGB(nm) }
  })
  const sum = [0, 1, 2].map((c) => w.reduce((a, x) => a + x.col[c], 0))
  const SUN = [1.0, 0.96, 0.88]
  for (const x of w) x.col = [0, 1, 2].map((c) => (x.col[c] * SUN[c]) / sum[c]) as [number, number, number]
  return w
}
const WAVES = spectrum(K) // the dust's fan
const KS = 40
const WAVES_S = spectrum(KS) // the light on surfaces, finer so the patch's sides come out straight
const TH_MID = TH_IN + devOf(N_MID)
const R_WALL = R_HOLE + (THROW / Math.cos(3.3 * DEG) + L0) * TAN_SUN
const PATCH_Y = (i: number) => PR[1] + Math.tan(WAVES[i].th) * THROW
const PATCH_MID = (PATCH_Y(0) + PATCH_Y(K - 1)) / 2

// The prism: a 63.2 degree triangle in x-y, edge down, its length across the beam (z), set so the
// middle of the spectrum passes at minimum deviation (the ray inside runs parallel to the base).
const P_THM = (TH_IN + TH_MID) / 2
const P_U: [number, number] = [Math.cos(P_THM), Math.sin(P_THM)], P_A: [number, number] = [Math.sin(P_THM), -Math.cos(P_THM)]
const P_HW = 0.03, P_HH = P_HW / Math.tan(APEX / 2), P_HZ = 0.075
const TRI: [number, number][] = [
  [PR[0] + P_A[0] * P_HH * 0.5, PR[1] + P_A[1] * P_HH * 0.5],
  [PR[0] + P_U[0] * P_HW - P_A[0] * P_HH * 0.5, PR[1] + P_U[1] * P_HW - P_A[1] * P_HH * 0.5],
  [PR[0] - P_U[0] * P_HW - P_A[0] * P_HH * 0.5, PR[1] - P_U[1] * P_HW - P_A[1] * P_HH * 0.5],
]
/** The prism's five faces as planes: outward normal and offset (n . p = d on the face). */
const P_PLANES: { n: [number, number, number]; d: number }[] = [
  ...[0, 1, 2].map((i) => {
    const p0 = TRI[i], p1 = TRI[(i + 1) % 3]
    let nx = p1[1] - p0[1], ny = -(p1[0] - p0[0])
    const l = Math.hypot(nx, ny)
    nx /= l
    ny /= l
    if (nx * (PR[0] - p0[0]) + ny * (PR[1] - p0[1]) > 0) {
      nx = -nx
      ny = -ny
    }
    return { n: [nx, ny, 0] as [number, number, number], d: nx * p0[0] + ny * p0[1] }
  }),
  { n: [0, 0, 1], d: P_HZ },
  { n: [0, 0, -1], d: P_HZ },
]

// ---------------------------------------------------------------- the room and what stands in it

const TABLE_Y = 0.78
const TABLE: [number, number, number, number] = [-2.2, 0.1, 0.95, 0.75] // centre x, z, half x, half z
const WIN = { y0: 1.05, y1: 2.65, hz: 0.62 }
// the telescope: eyepiece, and the direction it points (out of the window, up)
const EYE = new THREE.Vector3(-1.72, 1.2, 0.3)
const AXIS = new THREE.Vector3(-0.84, 0.5, -0.2).normalize()
const TUBE = 0.927
const FIELD = Math.sin(((15 / 60) * 21 * DEG) / 2) // sine of half the apparent field: 15' at 21 times
const BOOK = new THREE.Vector3(-1.5, 1.0, -0.14)
const SLOPE = 0.5
const CANDLE = new THREE.Vector3(-1.34, 1.1, -0.47) // the flame: on the page's open side, beyond the slope
const SHADE_DIR = new THREE.Vector3().subVectors(EYE, CANDLE).normalize()
const PAGE_W = 0.17, PAGE_H = 0.23
const START = APERTURE_DUR * (1 - APERTURE_IN)

// Six nights (Sidereus Nuncius, tr. Van Helden). Offsets in his minutes of arc, west positive
// (right); [offset, size, north]. Where he gives no distance the spacing is illustration.
const NIGHTS: [number, number, number][][] = [
  [[-2.7, 1.15, 0], [-1.4, 0.85, 0], [2.2, 1.15, 0]], //        7th: two east, one west
  [[1.1, 1, 0], [2.2, 1, 0], [3.3, 1, 0]], //                    8th: all three west, equal intervals, closer
  [[-1.5, 1, 0], [-3.0, 1, 0]], //                               10th: two, both east
  [[-2.4, 0.8, 0], [-3.2, 1.5, 0]], //                           11th: the nearer three times as far from Jupiter as from the eastern, which is twice as large
  [[-2, 1.2, 0], [2, 0.95, 0], [-0.55, 0.55, 0]], //             12th: east and west at two minutes; later a very small one almost touching on the east
  [[-2, 1, 0], [1, 1, 0], [2, 1, 0.22], [3, 1, 0]], //           13th: one east at 2', three west at 1' intervals, the middle one a little north
]
const ROW_T0 = 2.95, ROW_DT = 0.64 // seconds of beat 0
const ROW_AT = (k: number) => ROW_T0 + k * ROW_DT
const PUSH_T = ROW_AT(6) + 0.15 // back down the tube
const ARC = 0.0105 // metres of page per minute of arc
const ROW_Y = (k: number) => 0.066 - k * 0.027
type Mark = { x: number; y: number; kind: 0 | 1; size: number; t0: number }
const MARKS: Mark[] = []
NIGHTS.forEach((n, k) => {
  const R = rng(1610 + k)
  const y = ROW_Y(k) + (R() - 0.5) * 0.002
  // all six are written; the sixth is still wet (its ink shines in the candle)
  const t0 = k < 5 ? -60 : -1.0
  MARKS.push({ x: (R() - 0.5) * 0.003, y, kind: 0, size: 0.0046, t0 })
  n.forEach((m, j) => MARKS.push({ x: m[0] * ARC + (R() - 0.5) * 0.0012, y: y + m[2] * ARC + (R() - 0.5) * 0.001, kind: 1, size: 0.0027 * (0.55 + 0.45 * m[1]), t0: t0 + 0.2 + j * 0.105 }))
})

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const sq = (x: F): F => x.mul(x) as F
const sat1 = (x: F): F => clampN(x, 0, 1) as F
const v3 = (a: THREE.Vector3 | [number, number, number]) => (Array.isArray(a) ? vec3(a[0], a[1], a[2]) : vec3(a.x, a.y, a.z))

export function create(ctx: Ctx): SceneInstance {
  // ---------------------------------------------------------------- uniforms

  const U = {
    candleI: uniform(0), //  the candle (with its flicker)
    night: uniform(0), //    sky through the open window
    day: uniform(0), //      daylight through it, before the shutters close
    glaze: uniform(0), //    the casement shut (by day)
    reach1: uniform(0), //   how far the white pencil has got from the hole (0..L0)
    reach2: uniform(0), //   how far the fan has got from the prism
    patch: uniform(0), //    the patch's bounce into the room
    time: uniform(0),
    mt: uniform(-1), //      seconds of beat 0, for the ink
    trem: uniform(new THREE.Vector2()), // the eyepiece picture's tremor, in fields
    moons: uniformArray([0, 1, 2, 3].map(() => new THREE.Vector4()), "vec4"), // x, y, size, on
    dirs: uniformArray(WAVES.map((w) => w.dir), "vec3"),
    cols: uniformArray(WAVES.map((w) => new THREE.Vector3(...w.col)), "vec3"),
    dirsS: uniformArray(WAVES_S.map((w) => w.dir), "vec3"),
    colsS: uniformArray(WAVES_S.map((w) => new THREE.Vector3(...w.col)), "vec3"),
    ends: uniformArray(WAVES.map((w) => (WALL_X - PR[0]) / w.dir.x), "float"), // where each pencil meets the wall
    marks: uniformArray(MARKS.map((m) => new THREE.Vector4(m.x, m.y, m.kind ? -m.size : m.size, m.t0)), "vec4"),
    ruleC: uniform(new THREE.Vector3(1, 1, 1)),
    ruleBand: uniform(0),
  }
  const PRn = v3(PR), HOLEn = v3(HOLE)
  const D0 = vec3(Math.cos(TH_IN), Math.sin(TH_IN), 0)
  const DMID = vec3(Math.cos(TH_MID), Math.sin(TH_MID), 0)
  const CANDLE_C = vec3(1.0, 0.56, 0.2)
  const SKY_C = vec3(0.2, 0.3, 0.55)
  const SUN_C = vec3(1.0, 0.96, 0.88)
  const DAY_C = vec3(0.85, 0.9, 1.0)
  const CANn = v3(CANDLE)
  // The sun's irradiance in units of the light a disc of it would put on the far wall (the pencil
  // is the same energy in a smaller disc, so it is brighter by the square of the ratio of radii).
  const BEAM_P = 2.6

  // ---------------------------------------------------------------- the world rule

  /** Sunlight arriving at a point: the white pencil, then one cone per wavelength. Energy is conserved: the colours add up to the white. */
  const beamLight = (p: V3): V3 => {
    const c = vec3(0).toVar()
    If(abs(p.z).lessThan(0.4).and(U.reach1.greaterThan(0)), () => {
      const w = p.sub(HOLEn).toVar()
      const s0 = dot(w, D0).toVar()
      const r0 = s0.mul(TAN_SUN).add(R_HOLE)
      const in0 = sstep(r0.add(0.0012), r0.sub(0.0012), length(w.sub(D0.mul(s0))) as F).mul(step(0, s0)).mul(step(s0, U.reach1))
      c.addAssign(SUN_C.mul(in0).mul(sq(float(R_WALL).div(r0) as F)).mul(BEAM_P))
      const v = p.sub(PRn).toVar()
      If(v.x.greaterThan(0.005).and(U.reach2.greaterThan(0)), () => {
        Loop(KS, ({ i }) => {
          const d = U.dirsS.element(i) as unknown as V3
          const s = dot(v, d).toVar()
          const r = s.add(L0).mul(TAN_SUN).add(R_HOLE).toVar()
          const e = r.mul(0.1).add(0.0006)
          const on = sstep(r.add(e), r.sub(e), length(v.sub(d.mul(s))) as F).mul(step(s, U.reach2))
          // and a faint aureole round it (the sun's own, and what the glass and the dust scatter), which shows the plaster
          const dd = length(v.sub(d.mul(s))).div(r)
          const halo = exp(sq(dd.div(3.2) as F).negate()).mul(0.035).add(exp(dd.mul(-0.55)).mul(0.006)).mul(step(s, U.reach2))
          c.addAssign((U.colsS.element(i) as unknown as V3).mul(on.add(halo)).mul(sq(float(R_WALL).div(r) as F)).mul(BEAM_P))
        })
      })
    })
    return c as V3
  }
  /** How much of a flame of radius `fr` at `L` a capsule (`A` to `B`, radius `r`) leaves visible from `P`: a soft analytic shadow. */
  const capShadow = (P: V3, L: V3, A: V3, B: V3, r: number, fr: number): F => {
    const d1 = L.sub(P).toVar(), d2 = B.sub(A).toVar(), w = P.sub(A).toVar()
    const a = dot(d1, d1), b = dot(d1, d2), c = dot(d1, w), e = dot(d2, d2), f = dot(d2, w)
    const sP = clampN(b.mul(f).sub(c.mul(e)).div(max(a.mul(e).sub(b.mul(b)), 1e-7)), 0, 1).toVar()
    const tA = clampN(b.mul(sP).add(f).div(e), 0, 1).toVar()
    const sQ = clampN(tA.mul(b).sub(c).div(a), 0, 0.999).toVar()
    const dist = length(P.add(d1.mul(sQ)).sub(A.add(d2.mul(tA))))
    const pen = sQ.div(sQ.oneMinus()).mul(fr).add(0.0015)
    return sstep(float(r).sub(pen), float(r).add(pen), dist as F)
  }
  // what stands between the candle and the room: the telescope's tube and the post of its stand
  const TUBE_A = v3(EYE.clone().addScaledVector(AXIS, 0.05)), TUBE_B = v3(EYE.clone().addScaledVector(AXIS, TUBE - 0.02))
  const STAND_TOP = EYE.clone().addScaledVector(AXIS, 0.4)
  const POST_A = vec3(STAND_TOP.x, TABLE_Y, STAND_TOP.z), POST_B = vec3(STAND_TOP.x, STAND_TOP.y - 0.05, STAND_TOP.z)
  // the ink pot stands on the writing slope's pen block, just past the head of the page and to its right,
  // so it is in the reading shots (out of focus beyond the rows), the quill leaning out of it toward the lens
  const POT = new THREE.Vector3(BOOK.x - 0.2, 1.06, BOOK.z - 0.065)
  const FEET: [number, number, number][] = [[PR[0] + 0.02, -0.16, 0.07], [STAND_TOP.x, STAND_TOP.z, 0.075], [CANDLE.x, CANDLE.z, 0.05]]
  const PATCHn = vec3(WALL_X - 0.05, PATCH_MID, 0)
  const WINn = vec3(SHUT_X - 0.1, 1.9, 0)
  /** Everything's light. `spec` and `gloss` are the highlight's strength and tightness. */
  const roomLit = (P: V3, N: V3, alb: V3, spec: Num, gloss: number, metal = 0): V3 => {
    const V = normalize(cameraPosition.sub(P)).toVar()
    const col = vec3(0).toVar()
    const diffK = 1 - metal * 0.75
    // the candle: inverse square, cut off toward the observer by its tin shade, and by the table
    If(U.candleI.greaterThan(0.001), () => {
      const lc = CANn.sub(P).toVar()
      const d2 = dot(lc, lc).toVar()
      const L = lc.div(sqrt(d2)).toVar()
      const shade = sstep(0.99, 0.955, dot(L.negate(), v3(SHADE_DIR)) as F)
      const tt = float(TABLE_Y).sub(P.y).div(max(lc.y, 1e-3))
      const hit = P.xz.add(lc.xz.mul(tt))
      const under = step(P.y, TABLE_Y - 0.03).mul(step(abs(hit.x.sub(TABLE[0])), TABLE[2])).mul(step(abs(hit.y.sub(TABLE[1])), TABLE[3])).oneMinus()
      const occ = capShadow(P, CANn as V3, TUBE_A as V3, TUBE_B as V3, 0.023, 0.009).mul(capShadow(P, CANn as V3, POST_A as V3, POST_B as V3, 0.016, 0.009))
      const I = U.candleI.mul(shade).mul(under).mul(occ).div(d2.add(0.02)).toVar()
      const Hh = normalize(L.add(V))
      col.addAssign(CANDLE_C.mul(I).mul(alb.mul(max(dot(N, L), 0)).mul(diffK).add(mixN(vec3(1, 1, 1), alb, metal).mul(pow(max(dot(N, Hh), 0), gloss)).mul(spec))))
    })
    // the night sky, through the window
    If(U.night.add(U.day).greaterThan(0.001), () => {
      const lw = WINn.sub(P).toVar()
      const d2 = dot(lw, lw).toVar()
      const L = lw.div(sqrt(d2)).toVar()
      const I = max(L.x.negate(), 0).div(d2.add(1.2))
      const Hh = normalize(L.add(V))
      col.addAssign(SKY_C.mul(U.night).add(DAY_C.mul(U.day)).mul(I).mul(alb.mul(dot(N, L).mul(0.5).add(0.5)).mul(diffK).add(pow(max(dot(N, Hh), 0), gloss * 0.5).mul(spec).mul(0.6))))
    })
    // the sun: its pencils where they fall, and what the patch and the lit shutter give back to the room
    If(U.reach1.greaterThan(0), () => {
      col.addAssign(alb.mul(beamLight(P)).mul(abs(dot(N, DMID)).mul(0.8).add(0.2)))
      const lp = PATCHn.sub(P).toVar()
      const d2 = dot(lp, lp).toVar()
      const L = lp.div(sqrt(d2)).toVar()
      const I = U.patch.mul(max(L.x, 0).mul(0.8).add(0.2)).div(d2.add(0.35))
      const Hh = normalize(L.add(V))
      col.addAssign(vec3(1.0, 0.95, 0.86).mul(I).mul(alb.mul(max(dot(N, L), 0).mul(0.8).add(0.2)).mul(diffK).add(mixN(vec3(1, 1, 1), alb, metal).mul(pow(max(dot(N, Hh), 0), gloss)).mul(spec))))
      // the hole's glare and the prism's scatter: a little white light near the window
      const lh = PRn.sub(P).toVar()
      const dh = dot(lh, lh)
      col.addAssign(SUN_C.mul(alb).mul(U.reach1.mul(0.11)).mul(dot(N, normalize(lh)).mul(0.5).add(0.5)).div(dh.add(0.08)))
    })
    col.addAssign(alb.mul(vec3(0.0016, 0.002, 0.0032)))
    // contact shadows where things stand on the table: the prism's stand, the telescope's, the candlestick, the pot
    const onTop = sstep(0.02, 0.0, abs(P.y.sub(TABLE_Y)) as F)
    const ao = float(1).toVar()
    for (const [fx, fz, fr] of FEET) ao.mulAssign(sstep(0.0, 0.05, length(P.xz.sub(vec2(fx, fz))).sub(fr) as F).mul(0.6).add(0.4).mul(onTop).add(onTop.oneMinus()))
    col.mulAssign(ao)
    // the prism's caustic: where its stand and shoes sit under the glass, a scatter of the colours
    If(U.reach2.greaterThan(0), () => {
      const cq = P.sub(vec3(TRI[0][0], TRI[0][1] - 0.01, 0)).toVar()
      const cz = abs(cq.z).sub(P_HZ * 0.5).max(0)
      const ca = exp(length(vec2(length(cq.xy), cz)).div(-0.012)).mul(vnoise(vec2(cq.z.mul(500), cq.x.mul(300))).mul(0.8).add(0.4))
      const hue = fract(cq.z.mul(18).add(cq.x.mul(40)))
      const rgb = clampN(abs(fract(vec3(hue).add(vec3(0, 0.6667, 0.3333))).mul(6).sub(3)).sub(1), 0, 1)
      col.addAssign(alb.mul(rgb).mul(ca).mul(sat1(U.reach2.mul(3) as F)).mul(3))
    })
    return col as V3
  }
  const depthOf = (P: V3): F => length(P.sub(cameraPosition)) as F

  type Surf = { alb: (lp: V3, wp: V3) => V3; spec?: number; gloss?: number; metal?: number; side?: THREE.Side }
  const lit = (o: Surf) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const N = normalize(normalWorld).toVar()
      const a = o.alb(positionLocal as V3, positionWorld as V3)
      return vec4(roomLit(positionWorld as V3, N as V3, a, o.spec ?? 0.05, o.gloss ?? 20, o.metal ?? 0), depthOf(positionWorld as V3))
    })()
    if (o.side !== undefined) m.side = o.side
    return m
  }
  const grainOf = (p: V3, along: "x" | "y" | "z"): F => {
    const q = along === "x" ? vec2(p.x.mul(3), p.z.mul(46).add(p.y.mul(46))) : along === "y" ? vec2(p.y.mul(3), p.x.mul(46).add(p.z.mul(46))) : vec2(p.z.mul(3), p.x.mul(46).add(p.y.mul(46)))
    return vnoise(q.add(vnoise(q.mul(0.3)).mul(3))).mul(0.6).add(vnoise(q.mul(vec2(1, 4.3))).mul(0.4)) as F
  }
  const OAK = (along: "x" | "y" | "z", tone = 1) => lit({ alb: (lp) => mixN(vec3(0.12, 0.062, 0.028), vec3(0.34, 0.2, 0.09), grainOf(lp, along)).mul(tone) as V3, spec: 0.12, gloss: 24 })
  const BRASS = lit({ alb: (lp) => vec3(0.86, 0.6, 0.24).mul(vnoise(vec2(lp.y.mul(900), atan(lp.z, lp.x).mul(3))).mul(0.3).add(0.75)) as V3, spec: 1.5, gloss: 46, metal: 1 })

  const scene = new THREE.Scene()
  const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = scene): T => {
    parent.add(o)
    return o
  }
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = scene) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    b.position.set(x, y, z)
    return add(b, parent)
  }
  const Y = new THREE.Vector3(0, 1, 0)
  /** A cylinder from `a` toward `dir`, `len` long. */
  const rod = (r0: number, r1: number, len: number, a: THREE.Vector3, dir: THREE.Vector3, m: THREE.Material, parent: THREE.Object3D = scene, seg = 28, open = false) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg, 1, open), m)
    c.quaternion.setFromUnitVectors(Y, dir)
    c.position.copy(a).addScaledVector(dir, len / 2)
    return add(c, parent)
  }

  // ---------------------------------------------------------------- the shell: plaster, boards, beams, and the night outside

  const shellMat = new THREE.NodeMaterial()
  shellMat.side = THREE.BackSide
  shellMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const N = normalize(normalWorld).negate().toVar()
    const out = vec4(0, 0, 0, 1).toVar()
    If(P.x.lessThan(SHUT_X - 0.5), () => {
      // outside: a town's roofs against the sky, and the one bright thing the tube is pointed at
      const d = normalize(P.sub(v3(EYE))).toVar()
      const az = d.z.div(d.x.negate().max(0.05)).toVar() // across the window
      const el = d.y.div(length(d.xz)).toVar() //          up it
      /** A row of houses: gables, ridges and chimney stacks, as a height over `az`; `k` picks the street. */
      const roofline = (k: number, w: number, base: number): F => {
        const q = az.mul(w).add(k * 7.3)
        const id = floor(q)
        const f = fract(q)
        const h1 = hash21(vec2(id, k)), h2 = hash21(vec2(id, k + 3.7)), h3 = hash21(vec2(id, k + 9.1))
        const gable = float(0.5).sub(abs(f.sub(0.5))).mul(h2.mul(0.16).add(0.06)).mul(step(0.45, h2))
        const ridge = h1.mul(0.05).add(base)
        const chim = step(0.62, h3).mul(sstep(0.05, 0.035, abs(f.sub(h3.mul(0.5).add(0.25))) as F)).mul(0.05)
        return ridge.add(gable).add(chim) as F
      }
      const far = step(el, roofline(2, 5, 0.06)).toVar()
      const near = step(el, roofline(1, 3, -0.04)).toVar()
      const roofs = max(far, near).toVar()
      // night: a deep sky, black roofs, one or two late windows
      const sky = mixN(vec3(0.012, 0.016, 0.034), vec3(0.002, 0.003, 0.01), sstep(0, 0.5, el)).toVar()
      const lamp = step(0.93, hash21(floor(vec2(az.mul(60), el.mul(90))))).mul(near).mul(step(el, roofline(1, 3, -0.04).sub(0.03)))
      sky.assign(mixN(sky, mixN(vec3(0.004, 0.004, 0.006), vec3(0.002, 0.002, 0.003), near), roofs).add(vec3(1.0, 0.55, 0.2).mul(lamp).mul(0.25)))
      const dj = length(d.sub(v3(AXIS)))
      sky.addAssign(vec3(1.0, 0.95, 0.82).mul(exp(sq(dj.div(0.004) as F).negate()).mul(3).add(exp(dj.mul(-60)).mul(0.06))).mul(roofs.oneMinus()))
      const cell = floor(d.zy.mul(46)).toVar()
      const hh = hash21(cell)
      const sp = length(fract(d.zy.mul(46)).sub(0.5).sub(vec2(hash21(cell.add(3.1)), hash21(cell.add(7.7))).sub(0.5).mul(0.6)))
      sky.addAssign(vec3(0.7, 0.8, 1).mul(step(0.92, hh)).mul(exp(sq(sp.div(0.07) as F).negate())).mul(hh.sub(0.91).mul(2.5)).mul(roofs.oneMinus()))
      // day: a pale sky over warm tiles in courses, the far street hazed, chimneys dark
      const daySky = mixN(vec3(0.95, 0.93, 0.88), vec3(0.42, 0.56, 0.82), sstep(0.0, 0.5, el)).mul(0.9)
      const course = sstep(0.3, 0.5, abs(fract(el.mul(160)).sub(0.5)) as F).mul(0.25).add(0.75)
      const tiles = vec3(0.5, 0.26, 0.14).mul(course).mul(vnoise(vec2(az.mul(90), el.mul(40))).mul(0.4).add(0.7)).mul(0.55)
      const dayC = mixN(mixN(daySky, mixN(tiles, daySky, 0.45), far), tiles, near)
      out.assign(vec4(sky.mul(U.night).add(dayC.mul(U.day)), 60))
      // by day the casement is shut: leaded diamond quarries in an oak frame, between the shutters and the sky
      If(U.glaze.greaterThan(0), () => {
        const xg = float(SHUT_X - 0.2)
        const rd = P.sub(cameraPosition)
        const G = cameraPosition.add(rd.mul(xg.sub(cameraPosition.x).div(rd.x))).toVar()
        const qa = G.z.div(0.085).add(G.y.div(0.12)), qb = G.z.div(0.085).sub(G.y.div(0.12))
        const came = max(sstep(0.06, 0.03, abs(fract(qa).sub(0.5)).oneMinus().sub(0.5).abs() as F), sstep(0.06, 0.03, abs(fract(qb).sub(0.5)).oneMinus().sub(0.5).abs() as F))
        const frame = max(sstep(0.03, 0.022, abs(G.z) as F), sstep(0.025, 0.018, abs(G.y.sub(1.95)) as F))
        const ripple = vnoise(G.zy.mul(60)).mul(0.25).add(0.8) // crown glass: each quarry a little uneven
        const lit = out.rgb.mul(ripple).mul(came.oneMinus()).mul(frame.oneMinus()).add(vec3(0.05, 0.045, 0.04).mul(max(came, frame)).mul(U.day))
        out.assign(vec4(mixN(out.rgb, lit, U.glaze), 60))
      })
    }).Else(() => {
      const alb = vec3(0).toVar()
      const sp = float(0.03).toVar()
      If(N.y.greaterThan(0.5), () => {
        // wide oak boards, with gaps and nail heads
        const bz = P.z.div(0.23)
        const id = floor(bz)
        const g = grainOf(vec3(P.x.add(id.mul(1.7)), 0, P.z) as V3, "x")
        const gap = sstep(0.03, 0.0, abs(fract(bz).sub(0.5)).oneMinus().sub(0.5).abs() as F)
        alb.assign(mixN(vec3(0.07, 0.04, 0.02), vec3(0.21, 0.13, 0.065), g).mul(hash21(vec2(id, 4.4)).mul(0.3).add(0.8)).mul(gap.mul(0.85).oneMinus()))
        sp.assign(0.14)
      })
        .ElseIf(N.y.lessThan(-0.5), () => {
          // the ceiling: joists across it
          const j = sstep(0.42, 0.4, abs(fract(P.x.div(0.7)).sub(0.5)) as F)
          alb.assign(mixN(vec3(0.3, 0.27, 0.22), vec3(0.09, 0.05, 0.025), j.oneMinus()))
        })
        .Else(() => {
          // limewashed plaster: trowel marks, damp, a dado of dark panelling
          const q = vec2(P.x.add(P.z), P.y)
          const st = fbm(q.mul(1.3)).mul(0.5).add(vnoise(q.mul(9)).mul(0.16)).add(vnoise(q.mul(vec2(60, 14))).mul(0.06))
          alb.assign(vec3(0.5, 0.46, 0.38).mul(st.mul(0.6).add(0.5)))
          const pan = step(P.y, 0.95)
          const stile = sstep(0.03, 0.045, abs(fract(q.x.div(0.62)).sub(0.5)) as F)
          alb.assign(mixN(alb, mixN(vec3(0.05, 0.028, 0.014), vec3(0.16, 0.09, 0.04), grainOf(P as V3, "y")).mul(stile.mul(0.35).add(0.65)), pan))
          sp.assign(mixN(float(0.02), float(0.1), pan))
        })
      out.assign(vec4(roomLit(P as V3, N as V3, alb as V3, sp as F, 16), depthOf(P as V3)))
    })
    return out
  })()
  {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(WALL_X + 9, 3.1, 6.4), shellMat)
    shell.position.set((WALL_X - 9) / 2, 1.55, 0.2)
    add(shell)
  }
  // the window wall, round the opening, with a stone sill
  const PLASTER = lit({ alb: (_l, wp) => vec3(0.5, 0.46, 0.38).mul(fbm(vec2(wp.z, wp.y).mul(1.4)).mul(0.6).add(0.5)) as V3, spec: 0.02, gloss: 8 })
  const WT = 0.34
  box(WT, WIN.y0, 6.4, SHUT_X - WT / 2 - 0.03, WIN.y0 / 2, 0.2, PLASTER)
  box(WT, 3.1 - WIN.y1, 6.4, SHUT_X - WT / 2 - 0.03, (3.1 + WIN.y1) / 2, 0.2, PLASTER)
  box(WT, WIN.y1 - WIN.y0, 3.2 - WIN.hz, SHUT_X - WT / 2 - 0.03, (WIN.y0 + WIN.y1) / 2, (3.4 + WIN.hz) / 2, PLASTER)
  box(WT, WIN.y1 - WIN.y0, 3.0 - WIN.hz, SHUT_X - WT / 2 - 0.03, (WIN.y0 + WIN.y1) / 2, -(3.0 + WIN.hz) / 2, PLASTER)
  box(WT + 0.1, 0.05, WIN.hz * 2 + 0.1, SHUT_X - WT / 2, WIN.y0 - 0.02, 0, lit({ alb: (lp) => vec3(0.3, 0.29, 0.27).mul(vnoise(lp.xz.mul(40)).mul(0.4).add(0.7)) as V3 }))
  // the shutters: two boards on iron straps, hinged at the jambs; the hole is in the near one's edge of the far leaf
  const SHUT = lit({
    alb: (lp) => {
      const plank = fract(lp.x.div(0.155))
      const g = grainOf(vec3(lp.y, lp.x.mul(1.3), 0) as V3, "x")
      const strap = sstep(0.03, 0.025, abs(abs(lp.y).sub(0.55)) as F)
      return mixN(mixN(vec3(0.085, 0.048, 0.022), vec3(0.25, 0.15, 0.07), g).mul(sstep(0, 0.03, plank).mul(0.5).add(0.5)), vec3(0.03, 0.03, 0.03), strap) as V3
    },
    spec: 0.08,
    gloss: 18,
  })
  const leaves = [-1, 1].map((sd) => {
    const hinge = add(new THREE.Group())
    hinge.position.set(SHUT_X - 0.005, (WIN.y0 + WIN.y1) / 2, sd * WIN.hz)
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(WIN.hz, WIN.y1 - WIN.y0, 0.03), SHUT)
    leaf.rotation.y = Math.PI / 2
    leaf.position.set(0, 0, (-sd * WIN.hz) / 2)
    hinge.add(leaf)
    return { hinge, sd }
  })
  // the hole, with the sun in it
  const holeMat = new THREE.NodeMaterial()
  holeMat.fragmentNode = Fn(() => {
    const d = length(positionLocal.xy)
    const on = sstep(R_HOLE * 1.15, R_HOLE * 0.8, d as F)
    return vec4(SUN_C.mul(on.mul(90).add(exp(d.mul(-90)).mul(1.2))).mul(step(0.001, U.reach1)), depthOf(positionWorld as V3))
  })()
  holeMat.transparent = true
  holeMat.blending = THREE.CustomBlending
  holeMat.blendSrc = THREE.OneFactor
  holeMat.blendDst = THREE.OneFactor
  holeMat.depthWrite = false
  holeMat.blendSrcAlpha = THREE.ZeroFactor // keep the depth in alpha
  holeMat.blendDstAlpha = THREE.OneFactor
  const hole = add(new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), holeMat))
  hole.rotation.y = Math.PI / 2
  hole.position.set(SHUT_X + 0.022, HOLE[1], 0)

  // ---------------------------------------------------------------- the table

  const OAK_X = OAK("x"), OAK_Y = OAK("y", 0.8)
  box(TABLE[2] * 2, 0.045, TABLE[3] * 2, TABLE[0], TABLE_Y - 0.0225, TABLE[1], OAK_X)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, TABLE_Y - 0.045, 0.07, TABLE[0] + sx * (TABLE[2] - 0.08), (TABLE_Y - 0.045) / 2, TABLE[1] + sz * (TABLE[3] - 0.08), OAK_Y)
  box(TABLE[2] * 2 - 0.2, 0.09, 0.03, TABLE[0], TABLE_Y - 0.09, TABLE[1] + TABLE[3] - 0.08, OAK_X)

  // ---------------------------------------------------------------- the telescope (Museo Galileo, inv. 2428)

  const scope = add(new THREE.Group())
  const RB = new THREE.Vector3().crossVectors(AXIS, Y).normalize() // the picture's right (west)
  const UB = new THREE.Vector3().crossVectors(RB, AXIS).normalize()
  {
    // strips of wood under leather that was red and has gone brown, tooled in gold
    const leather = lit({
      alb: (lp) => {
        const a = atan(lp.z, lp.x)
        const t = lp.y.div(TUBE).add(0.5) // 0 at the eyepiece
        const hide = mixN(vec3(0.115, 0.045, 0.026), vec3(0.3, 0.12, 0.055), vnoise(vec2(a.mul(9), lp.y.mul(260))).mul(0.5).add(fbm(vec2(a.mul(2), lp.y.mul(14))).mul(0.6)))
        // the staves show through as faint flats; scuffs toward the ends where hands go
        const stave = cos(a.mul(10)).mul(0.5).add(0.5).mul(0.12).add(0.9)
        const scuff = sstep(0.55, 0.8, vnoise(vec2(a.mul(5), lp.y.mul(40))).add(sstep(0.25, 0.0, t).mul(0.25))).mul(0.3)
        // bands of tooling: a pair of fillets and a run of small lozenges between them
        const u = abs(fract(t.mul(5.5).add(0.5)).sub(0.5)).div(5.5).mul(TUBE)
        const fillet = sstep(0.0012, 0.0006, abs(u.sub(0.012)) as F).add(sstep(0.0012, 0.0006, abs(u.sub(0.004)) as F))
        const loz = sstep(0.0026, 0.0016, abs(fract(a.mul(7.0)).sub(0.5)).mul(0.012).add(abs(u.sub(0.008))) as F)
        const gold = sat1(fillet.add(loz) as F).mul(vnoise(vec2(a.mul(40), lp.y.mul(900))).mul(0.5).add(0.5))
        return mixN(hide.mul(stave).mul(scuff.oneMinus()), vec3(0.95, 0.66, 0.2), gold.mul(0.85)) as V3
      },
      spec: 0.35,
      gloss: 22,
    })
    rod(0.0205, 0.023, TUBE - 0.09, EYE.clone().addScaledVector(AXIS, 0.05), AXIS, leather, scope, 40)
    // the objective's cell, wider, and inside it the ring that stops 37 mm of glass down to 15
    const oEnd = EYE.clone().addScaledVector(AXIS, TUBE - 0.045)
    rod(0.027, 0.027, 0.045, oEnd, AXIS, leather, scope, 40)
    rod(0.0275, 0.0275, 0.006, oEnd.clone().addScaledVector(AXIS, 0.041), AXIS, BRASS, scope, 40)
    const stop = new THREE.Mesh(new THREE.RingGeometry(0.0075, 0.0265, 40), BRASS)
    stop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), AXIS)
    stop.position.copy(oEnd).addScaledVector(AXIS, 0.0455)
    scope.add(stop)
    // the eyepiece's cell and draw
    rod(0.017, 0.017, 0.05, EYE, AXIS, leather, scope, 36, true)
    rod(0.0178, 0.0178, 0.005, EYE.clone().addScaledVector(AXIS, 0.047), AXIS, BRASS, scope, 36)
    rod(0.0182, 0.0182, 0.007, EYE.clone().addScaledVector(AXIS, -0.001), AXIS, BRASS, scope, 36, true)
    // the stand (illustration): a turned post on the table, a brass yoke, a wing nut
    const mid = EYE.clone().addScaledVector(AXIS, 0.4)
    const foot = new THREE.Vector3(mid.x, TABLE_Y, mid.z)
    const post = OAK("y", 1.1)
    rod(0.075, 0.06, 0.02, foot, Y, post, scope, 30)
    rod(0.018, 0.013, mid.y - 0.07 - TABLE_Y, foot, Y, post, scope, 20)
    rod(0.022, 0.022, 0.014, new THREE.Vector3(mid.x, TABLE_Y + (mid.y - TABLE_Y) * 0.45, mid.z), Y, post, scope, 20)
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0045, 10, 28, Math.PI), BRASS)
    yoke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), AXIS)
    yoke.rotateZ(Math.PI)
    yoke.position.copy(mid)
    scope.add(yoke)
    rod(0.006, 0.006, 0.04, new THREE.Vector3(mid.x, mid.y - 0.075, mid.z), Y, BRASS, scope, 12)
  }
  // the eye lens, and in it what the instrument shows: a function of the direction you look along, as an image at infinity is
  const eyeMat = new THREE.NodeMaterial()
  eyeMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const v = normalize(P.sub(cameraPosition)).toVar()
    const AX = v3(AXIS)
    const e = v.sub(AX.mul(dot(v, AX))).toVar()
    const f = vec2(dot(e, v3(RB)), dot(e, v3(UB))).div(FIELD).toVar()
    const rr = length(f).toVar()
    const col = vec3(0).toVar()
    If(rr.lessThan(3.4), () => {
      const inF = sstep(1.012, 0.988, rr).toVar()
      // the sky in the field: not black, the glass scatters
      col.assign(vec3(0.011, 0.016, 0.034).mul(sq(rr).mul(-0.45).add(1)).mul(inF))
      const jp = f.sub(U.trem).toVar()
      const dj = length(jp).toVar()
      const RJ = 0.047
      // the planet: a pale disc, soft at the limb, in the violet halo a simple objective gives anything bright
      const disc = sstep(RJ + 0.007, RJ - 0.007, dj)
      const limb = sqrt(sat1(sq(dj.div(RJ) as F).oneMinus() as F)).mul(0.5).add(0.5)
      col.addAssign(vec3(1.0, 0.93, 0.76).mul(disc).mul(limb).mul(5.5).mul(inF))
      col.addAssign(vec3(0.3, 0.22, 1.0).mul(exp(dj.div(RJ * 1.5).negate())).mul(0.7).add(vec3(1.0, 0.35, 0.1).mul(sstep(RJ * 1.5, RJ, dj)).mul(disc.oneMinus()).mul(0.5)).mul(inF))
      Loop(4, ({ i }) => {
        const m = U.moons.element(i) as unknown as V4
        const dm = length(jp.sub(m.xy)).toVar()
        const tw = sin(U.time.mul(float(i).mul(2.3).add(9.1)).add(float(i).mul(1.7))).mul(0.14).add(1)
        const pt = exp(sq(dm.div(m.z.mul(0.0105)) as F).negate()).mul(9).add(exp(dm.mul(-42)).mul(0.22))
        // red focuses a little wide of blue: each point has a coloured edge
        const fr = exp(sq(dm.sub(0.008).div(0.008) as F).negate()).mul(0.5)
        col.addAssign(vec3(0.92, 0.95, 1.0).mul(pt).add(vec3(0.5, 0.2, 1.0).mul(fr)).mul(m.w).mul(tw).mul(inF))
      })
      // the edge of the field: blue inside, orange outside
      col.addAssign(vec3(0.15, 0.3, 1.0).mul(sstep(0.9, 1.0, rr)).mul(inF).mul(0.035))
      col.addAssign(vec3(1.0, 0.45, 0.1).mul(sstep(1.07, 1.0, rr)).mul(inF.oneMinus()).mul(0.03))
      // the inside of the tube: its stops, as faint rings where they catch stray light
      const a = atan(f.y, f.x)
      const ring = (r: number, w: number, g: number) => exp(sq(rr.sub(r).div(w) as F).negate()).mul(g).mul(cos(a.sub(0.9)).mul(0.5).add(0.6))
      col.addAssign(vec3(0.5, 0.36, 0.2).mul(ring(1.42, 0.03, 0.008).add(ring(2.05, 0.05, 0.006)).add(ring(2.9, 0.09, 0.004))).mul(inF.oneMinus()))
    })
    // a bubble near the rim and the faint cords of hand-made glass, seen when the candle is in them (illustration)
    const N = normalize(normalWorld)
    const Hh = normalize(normalize(CANn.sub(P)).sub(v))
    const lp = positionLocal.xy.div(0.011)
    const stria = sin(lp.x.mul(9).add(sin(lp.y.mul(5)).mul(1.5))).mul(0.5).add(0.5)
    col.addAssign(CANDLE_C.mul(U.candleI).mul(pow(max(dot(N, Hh), 0), 30).mul(stria.mul(0.5).add(0.3)).mul(0.5).add(exp(sq(length(lp.sub(vec2(0.55, -0.42))).sub(0.06).div(0.018) as F).negate()).mul(0.12))))
    // the glass's own surface: a faint warm reflection of the room and the candle's highlight drawn out along a curve
    const gq = positionLocal.xy.div(0.0172).toVar()
    const refl = CANDLE_C.mul(U.candleI).mul(sstep(1.0, 0.2, length(gq.sub(vec2(0.35, -0.3))) as F).mul(0.05).add(exp(sq(length(gq.sub(vec2(-0.1, 0.55))).sub(0.42).div(0.05) as F).negate()).mul(sstep(0.2, -0.4, gq.x)).mul(0.35)))
    col.addAssign(refl.mul(sstep(0.9, 1.4, rr)))
    return vec4(col, depthOf(P as V3))
  })()
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0172, 48), eyeMat)
  lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), AXIS.clone().negate())
  lens.position.copy(EYE).addScaledVector(AXIS, 0.004)
  scope.add(lens)

  // ---------------------------------------------------------------- the notebook on its slope, the candle, the ink

  const desk = add(new THREE.Group())
  const pageBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-Math.cos(SLOPE), Math.sin(SLOPE), 0), new THREE.Vector3(Math.sin(SLOPE), Math.cos(SLOPE), 0))
  const pageN = new THREE.Vector3(Math.sin(SLOPE), Math.cos(SLOPE), 0)
  const pageX = new THREE.Vector3(0, 0, -1), pageY = new THREE.Vector3(-Math.cos(SLOPE), Math.sin(SLOPE), 0)
  const pageMat = new THREE.NodeMaterial()
  pageMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const q = positionLocal.xy.toVar() // metres on the page, origin its middle
    const N = normalize(normalWorld).toVar()
    // laid paper gone cream: chain lines, fibre, foxing toward the fore-edge, a shadow in the gutter
    const fib = vnoise(q.mul(vec2(900, 260))).mul(0.5).add(vnoise(q.mul(120)).mul(0.5))
    const paper = vec3(0.74, 0.66, 0.5).mul(fib.mul(0.24).add(0.84)).toVar()
    // chain lines every 24 mm (the mould's wires, thinner paper beside them) and the close laid lines across them
    paper.mulAssign(sstep(0.0, 0.0007, abs(fract(q.x.div(0.024)).sub(0.5)).sub(0.47).abs() as F).mul(0.11).add(0.89))
    paper.mulAssign(sin(q.y.mul(6283)).mul(0.025).add(0.975))
    paper.assign(mixN(paper, vec3(0.5, 0.36, 0.2), sstep(0.5, 0.9, fbm(q.mul(26)).add(sstep(0.05, 0.085, q.x).mul(0.3))).mul(0.35)))
    paper.mulAssign(sstep(-PAGE_W / 2, -PAGE_W / 2 + 0.03, q.x).mul(0.5).add(0.5))
    // a line of his hand above the rows: strokes, not letters (nothing is printed that the script does not have)
    const wl = q.y.sub(0.094)
    const word = step(0.35, vnoise(vec2(q.x.mul(55), 2.2)))
    const scrib = sstep(0.0011, 0.0004, abs(wl.sub(vnoise(vec2(q.x.mul(520), 1.3)).sub(0.5).mul(0.006))) as F).mul(word).mul(step(abs(q.x), 0.066))
    const ink = float(0).toVar()
    const wetI = float(0).toVar()
    ink.assign(scrib.mul(0.75))
    // a few strokes of his hand in the margin of each row (no letters: the script has no words for them)
    for (let k = 0; k < NIGHTS.length; k++) {
      const wk = step(0.3, vnoise(vec2(q.x.mul(70), k * 5.1))).mul(step(-0.079, q.x)).mul(step(q.x, -0.05 - (k % 3) * 0.004))
      ink.assign(max(ink, sstep(0.0011, 0.0004, abs(q.y.sub(ROW_Y(k) - 0.001).sub(vnoise(vec2(q.x.mul(600), k * 2.3)).sub(0.5).mul(0.005))) as F).mul(wk).mul(0.8)))
    }
    const bleed = float(0).toVar()
    Loop(MARKS.length, ({ i }) => {
      const m = (U.marks.element(i) as unknown as V4).toVar()
      const age = U.mt.sub(m.w).toVar()
      If(age.greaterThan(0), () => {
        const d = q.sub(m.xy).toVar()
        const sz = abs(m.z)
        const lw = float(0.00042).add(vnoise(q.mul(700)).mul(0.00022)) // the quill's line swells and thins
        const a = float(0).toVar()
        If(m.z.greaterThan(0), () => {
          // an open circle, drawn round from the top; the ends do not quite meet
          const ang = fract(atan(d.x, d.y).div(6.2832).add(1))
          const done = sat1(age.div(0.2) as F)
          a.assign(sstep(lw, lw.mul(0.45), abs(length(d.mul(vec2(1, 0.93))).sub(sz)) as F).mul(step(ang, done.mul(0.97))))
        }).Else(() => {
          // a little star: three strokes through one point, one after another
          Loop(3, ({ i: j }) => {
            const an = float(j).mul(1.0472).add(m.w.mul(3.7))
            const dirv = vec2(cos(an), sin(an))
            const al = dot(d, dirv)
            const done = sat1(age.sub(float(j).mul(0.03)).div(0.035) as F)
            a.assign(max(a, sstep(lw.mul(0.9), lw.mul(0.4), abs(dot(d, vec2(dirv.y.negate(), dirv.x))) as F).mul(step(al, sz.mul(done.mul(2).sub(1)))).mul(step(sz.negate(), al))))
          })
          a.assign(max(a, sstep(sz.mul(0.4), sz.mul(0.15), length(d) as F).mul(sat1(age.div(0.1) as F)).mul(0.8))) // ink pools at the crossing
        })
        ink.assign(max(ink, a))
        // iron-gall ink feathers into the fibres: a brown halo a little wider than the stroke
        bleed.assign(max(bleed, sstep(0.0, 0.0016, length(d).sub(sz.mul(m.z.greaterThan(0).select(1.0, 0.95))).abs().sub(lw) as F).oneMinus().mul(step(length(d), sz.mul(1.5)))))
        wetI.assign(max(wetI, a.mul(exp(age.mul(-0.55)))))
      })
    })
    // iron-gall ink: black-brown, feathering a little into the fibres
    const alb = mixN(mixN(paper, vec3(0.36, 0.23, 0.12), bleed.mul(0.3).mul(fib.mul(0.6).add(0.4))), vec3(0.03, 0.02, 0.012), ink.mul(fib.mul(0.25).add(0.75))).toVar()
    const c = roomLit(P as V3, N as V3, alb as V3, wetI.mul(2.2).add(ink.mul(0.35)).add(0.02) as F, 70)
    return vec4(c, depthOf(P as V3))
  })()
  {
    const page = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), pageMat)
    page.applyMatrix4(pageBasis)
    page.position.copy(BOOK)
    desk.add(page)
    // the facing page, the book block and its boards, the slope under it
    const blank = lit({ alb: (lp) => vec3(0.7, 0.62, 0.47).mul(vnoise(lp.xy.mul(vec2(900, 260))).mul(0.12).add(0.9)).mul(sstep(PAGE_W / 2, PAGE_W / 2 - 0.03, lp.x).mul(0.5).add(0.5)).mul(sstep(0.0013, 0.0004, abs(fract(lp.y.div(0.011)).sub(0.5).mul(0.011).sub(vnoise(vec2(lp.x.mul(480), floor(lp.y.div(0.011)))).sub(0.5).mul(0.005))) as F).mul(step(0.3, vnoise(vec2(lp.x.mul(50), floor(lp.y.div(0.011)).mul(3.1))))).mul(step(abs(lp.x), 0.068)).mul(0.6).oneMinus()) as V3 })
    const left = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), blank)
    left.applyMatrix4(pageBasis)
    left.position.copy(BOOK).addScaledVector(pageX, -PAGE_W - 0.004)
    desk.add(left)
    const cover = lit({ alb: (lp) => vec3(0.1, 0.07, 0.045).mul(vnoise(lp.xy.mul(300)).mul(0.4).add(0.7)) as V3, spec: 0.2, gloss: 18 })
    const block = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W * 2 + 0.024, PAGE_H + 0.016, 0.022), cover)
    block.applyMatrix4(pageBasis)
    block.position.copy(BOOK).addScaledVector(pageX, -PAGE_W / 2 - 0.002).addScaledVector(pageN, -0.0125)
    desk.add(block)
    const edges = lit({ alb: (lp) => vec3(0.6, 0.53, 0.4).mul(sin(lp.z.mul(4200)).mul(0.12).add(0.85)) as V3 })
    const leavesB = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W * 2 + 0.008, PAGE_H, 0.016), edges)
    leavesB.applyMatrix4(pageBasis)
    leavesB.position.copy(BOOK).addScaledVector(pageX, -PAGE_W / 2 - 0.002).addScaledVector(pageN, -0.0085)
    desk.add(leavesB)
    const slope = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.02), OAK("x", 1.15))
    slope.applyMatrix4(pageBasis)
    slope.position.copy(BOOK).addScaledVector(pageX, -PAGE_W / 2).addScaledVector(pageN, -0.034)
    desk.add(slope)
    box(0.2, BOOK.y - TABLE_Y - 0.06, 0.42, BOOK.x - 0.1, (BOOK.y - 0.06 + TABLE_Y) / 2, BOOK.z + PAGE_W / 2, OAK("z", 0.9), desk)
    // the candle: a brass stick with a drip pan, tallow, a flame, and a tin shade on the telescope's side
    const base = new THREE.Vector3(CANDLE.x, TABLE_Y, CANDLE.z)
    rod(0.05, 0.045, 0.012, base, Y, BRASS, desk, 30)
    rod(0.012, 0.016, 0.1, base, Y, BRASS, desk, 20)
    rod(0.034, 0.03, 0.008, base.clone().setY(TABLE_Y + 0.1), Y, BRASS, desk, 30)
    const wax = lit({ alb: (lp) => vec3(0.78, 0.7, 0.5).mul(sstep(0.11, 0.02, lp.y).mul(1.6).add(0.5)) as V3, spec: 0.3, gloss: 30 })
    rod(0.011, 0.0105, CANDLE.y - 0.018 - TABLE_Y - 0.108, base.clone().setY(TABLE_Y + 0.108), Y, wax, desk, 16)
    const flameMat = new THREE.NodeMaterial()
    flameMat.fragmentNode = Fn(() => {
      const t = positionLocal.y.div(0.016).mul(0.5).add(0.5) // 0 base, 1 tip
      const core = mixN(vec3(0.25, 0.4, 1.6), vec3(1.0, 0.62, 0.2).mul(26), sstep(0.02, 0.3, t)).mul(sstep(1.0, 0.75, t).mul(0.8).add(0.2))
      return vec4(core.mul(U.candleI.mul(18)), depthOf(positionWorld as V3))
    })()
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 12), flameMat)
    flame.scale.set(0.42, 1, 0.42)
    flame.position.copy(CANDLE)
    flame.name = "flame"
    desk.add(flame)
    const tin = lit({ alb: (lp) => vec3(0.36, 0.36, 0.36).mul(vnoise(vec2(atan(lp.z, lp.x).mul(30), lp.y.mul(300))).mul(0.4).add(0.6)) as V3, spec: 0.9, gloss: 26, metal: 0.8, side: THREE.DoubleSide })
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 24, 1, true, 0, Math.PI * 0.9), tin)
    shade.position.set(CANDLE.x, CANDLE.y + 0.005, CANDLE.z)
    shade.rotation.y = Math.atan2(SHADE_DIR.x, SHADE_DIR.z) - Math.PI * 0.45
    desk.add(shade)
    // an ink pot
    const pot = lit({ alb: () => vec3(0.02, 0.025, 0.03) as V3, spec: 1.2, gloss: 60 })
    // the pen block: an oak stand rising from the table behind the slope, its top a tray for pot and sand
    box(0.11, POT.y - TABLE_Y, 0.15, POT.x - 0.01, (POT.y + TABLE_Y) / 2, POT.z, OAK("z", 0.9), desk)
    rod(0.024, 0.018, 0.04, POT, Y, pot, desk, 24)
    rod(0.012, 0.016, 0.006, POT.clone().setY(POT.y + 0.04), Y, pot, desk, 16) // the neck
    rod(0.016, 0.016, 0.03, new THREE.Vector3(POT.x + 0.005, POT.y, POT.z + 0.05), Y, BRASS, desk, 20) // the pounce pot
  }
  // the quill: a goose flight feather, stripped part of the way up, cut to a point
  const quill = add(new THREE.Group())
  {
    const shaft = lit({ alb: (lp) => mixN(vec3(0.75, 0.68, 0.5), vec3(0.05, 0.03, 0.02), sstep(-0.085, -0.1, lp.y)) as V3, spec: 0.5, gloss: 40 })
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0005, 0.2, 8), shaft)
    sh.position.y = 0.1
    quill.add(sh)
    const vane = lit({ alb: (lp) => vec3(0.6, 0.57, 0.5).mul(sin(lp.y.mul(900).add(abs(lp.x).mul(700))).mul(0.12).add(0.8)).mul(sstep(0.0, 0.004, abs(lp.x)).mul(0.4).add(0.6)) as V3, side: THREE.DoubleSide })
    const g = new THREE.PlaneGeometry(0.03, 0.13, 6, 10)
    const pos = g.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 0.13 + 0.5
      const w = Math.sin(Math.PI * Math.min(1, y * 1.15) ** 0.6) * (pos.getX(i) > 0 ? 1 : 0.45)
      pos.setXYZ(i, pos.getX(i) * w, pos.getY(i), 0.004 * Math.sin(y * 3) + Math.abs(pos.getX(i)) * 0.12)
    }
    g.computeVertexNormals()
    const vn = new THREE.Mesh(g, vane)
    vn.position.y = 0.145
    quill.add(vn)
  }

  // ---------------------------------------------------------------- the prism on its stand, and the card

  const lab = add(new THREE.Group())
  {
    const hz = P_HZ, tri = TRI
    // the stand (illustration): a post from the table, an arm, a brass clip on each end of the glass
    const post = OAK("y", 1.0)
    const px = PR[0] + 0.02, pz = -0.16
    rod(0.07, 0.055, 0.022, new THREE.Vector3(px, TABLE_Y, pz), Y, post, lab, 28)
    rod(0.016, 0.011, PR[1] - TABLE_Y - 0.09, new THREE.Vector3(px, TABLE_Y, pz), Y, post, lab, 18)
    rod(0.006, 0.006, 0.31, new THREE.Vector3(px, PR[1] - 0.085, pz - 0.02), new THREE.Vector3(0, 0, 1), BRASS, lab, 10)
    for (const z of [-hz - 0.003, hz + 0.003]) {
      rod(0.004, 0.004, 0.075, new THREE.Vector3(px, PR[1] - 0.085, z), new THREE.Vector3(-0.25, 1, 0).normalize(), BRASS, lab, 8)
      // a small brass shoe under the edge at each end
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.005), BRASS)
      clip.position.set(tri[0][0], tri[0][1] - 0.002, z)
      lab.add(clip)
    }
  }

  // ---------------------------------------------------------------- the rule of ages: lacquered brass

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "inked", debug: ctx.debugLabels, fonts: { name: ctx.fonts.fell, mono: ctx.fonts.mono }, ink: "#140b04" }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const brush = vnoise(vec2(st.x.mul(70), st.y.mul(240))).mul(0.6).add(vnoise(vec2(st.x.mul(260), st.y.mul(700))).mul(0.4)).toVar()
    // drawn brass: bright along the grain, tarnish creeping in from the ends and the lower edge, a thumb print
    const tarn = sstep(0.4, 0.85, fbm(st.mul(vec2(38, 4))).add(abs(st.x.sub(0.5)).mul(0.35)).add(st.y.oneMinus().mul(0.15))).toVar()
    const metal = mixN(vec3(0.95, 0.7, 0.3), vec3(0.42, 0.3, 0.14), tarn.mul(0.6)).mul(brush.mul(0.28).add(0.8)).toVar()
    // the spectrum in it: the wall's patch reflected, long, along the grain
    const h = sat1(st.x.sub(U.ruleBand).div(0.5).add(0.5) as F)
    const rain = clampN(abs(fract(vec3(h.mul(0.78).oneMinus().mul(0.85)).add(vec3(0, 0.6667, 0.3333))).mul(6).sub(3)).sub(1), 0, 1)
    const band = sstep(0.0, 0.12, h).mul(sstep(1.0, 0.88, h)).mul(pow(brush, 2).mul(1.1).add(0.25))
    const lit2 = metal.mul(U.ruleC).add(metal.mul(rain).mul(band).mul(U.patch).mul(1.3)).toVar()
    lit2.addAssign(U.ruleC.mul(pow(brush, 4)).mul(0.1).mul(sstep(0.75, 1.0, st.y)))
    const col = mixN(lit2, cut.rgb.mul(0.5), on)
    return vec4(ctx.debugLabels ? mixN(col, cut.rgb.mul(4), on) : col, -1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  // drawn with the transparent pass (after the prism and the hole's glow) but writing straight through
  ruleMat.transparent = true
  ruleMat.blending = THREE.CustomBlending
  ruleMat.blendSrc = THREE.OneFactor
  ruleMat.blendDst = THREE.ZeroFactor
  const rule = add(new THREE.Mesh(ruleGeometry(), ruleMat))
  rule.renderOrder = 10
  rule.frustumCulled = false

  // ---------------------------------------------------------------- targets: the stage, the dust in the beam, focus

  const stage = stageTarget(ctx)
  const volT = ctx.target({ scale: 0.5 })
  const out = ctx.target({})
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.004, 40)
  const VU = {
    tS: uniformTexture(stage.texture),
    cp: uniform(new THREE.Vector3()),
    cr: uniform(new THREE.Vector3()), // right, scaled by tan(fov/2) * aspect
    cu: uniform(new THREE.Vector3()), // up, scaled by tan(fov/2)
    cf: uniform(new THREE.Vector3()),
    pxa: uniform(0.001), // a pixel's angle
  }
  /** In-scatter from one thin cone of light, in closed form: (brightness, where along the cone). */
  /** (brightness, where along the cone, how far along the view ray) */
  const pencil = (o: V3, v: V3, b: V3, d: V3, len: F, sOff: number, depth: F): V3 => {
    const w = o.sub(b).toVar()
    const a = dot(v, d).toVar()
    const den = max(a.mul(a).oneMinus(), 0.004).toVar()
    const dw = dot(d, w).toVar()
    const vw = dot(v, w).toVar()
    const sRaw = dw.sub(a.mul(vw)).div(den).toVar()
    const s = clampN(sRaw, 0, len).toVar()
    const q = b.add(d.mul(s)).toVar()
    const t = dot(q.sub(o), v).toVar()
    const dist = length(o.add(v.mul(t)).sub(q))
    const r = s.add(sOff).mul(TAN_SUN).add(R_HOLE)
    const reff = sqrt(r.mul(r).add(sq(t.mul(VU.pxa).mul(0.9) as F))).toVar()
    const I = exp(sq(dist.div(reff) as F).negate()).div(reff.mul(sqrt(den))).mul(step(0.01, t)).mul(sstep(t.sub(reff.mul(2)), t.add(reff), depth)).mul(step(0.0005, len))
      // no glowing end caps: the cone simply stops where it meets a surface
      .mul(sstep(len.add(reff.mul(2)), len, sRaw)).mul(sstep(reff.mul(-2), 0, sRaw))
    return vec3(I, s, t) as V3
  }
  const DUST = 0.0032 // in-scatter per unit of the sun's light: one gain for the white and the colours
  const vol = ctx.pass(({ uv }) => {
    const c = vec3(0).toVar()
    If(U.reach1.greaterThan(0), () => {
      const v = normalize(VU.cf.add(VU.cr.mul(uv.x.mul(2).sub(1))).add(VU.cu.mul(uv.y.mul(2).sub(1)))).toVar()
      const depth = sampleRT(VU.tS, uv).a.toVar()
      const o = VU.cp
      // dust: slow curls, and motes that flash as they turn
      const dustAt = (q: V3): F => {
        const n = fbm3(q.mul(vec3(3.2, 5.5, 5.5)).add(vec3(U.time.mul(0.05), U.time.mul(-0.03), U.time.mul(0.02))))
        const g = q.mul(170).add(vec3(0, U.time.mul(-1.3), U.time.mul(0.4)))
        const cell = floor(g)
        const hh = hash33(cell)
        const mote = step(0.972, hh.x).mul(exp(sq(length(fract(g).sub(0.5).sub(hh.yzx.sub(0.5).mul(0.5))).div(0.2) as F).negate())).mul(sin(U.time.mul(hh.y.mul(6).add(2)).add(hh.z.mul(40))).mul(0.5).add(0.5))
        return sq(n.mul(1.5) as F).mul(0.9).add(0.25).add(mote.mul(7)) as F
      }
      const w = pencil(o as unknown as V3, v as V3, HOLEn as V3, D0 as V3, U.reach1 as unknown as F, 0, depth as F).toVar()
      const ph0 = pow(max(dot(v, D0).negate(), 0), 3).mul(1.5).add(0.7)
      // the dust is sampled where the view ray passes the beam, so the motes are points, not bands
      c.addAssign(SUN_C.mul(w.x).mul(dustAt(o.add(v.mul(w.z)) as V3)).mul(ph0).mul(DUST))
      If(U.reach2.greaterThan(0), () => {
        const acc = vec3(0).toVar()
        const sMid = float(0).toVar()
        Loop(K, ({ i }) => {
          const d = U.dirs.element(i) as unknown as V3
          const len = min(U.reach2, U.ends.element(i) as unknown as F)
          const pz = pencil(o as unknown as V3, v as V3, PRn as V3, d, len as F, L0, depth as F)
          acc.addAssign((U.cols.element(i) as unknown as V3).mul(pz.x))
          sMid.addAssign(pz.z.div(K))
        })
        const ph = pow(max(dot(v, DMID).negate(), 0), 3).mul(1.5).add(0.7)
        c.addAssign(acc.mul(dustAt(o.add(v.mul(sMid)) as V3)).mul(ph).mul(DUST))
      })
    })
    return vec4(c, 1)
  }, { ...VU, ...U })
  const D = { tS: uniformTexture(stage.texture), tV: uniformTexture(volT.texture), blur: uniform(0), focus: uniform(1), asp: uniform(16 / 9), beam: uniform(0), prism: uniform(0) }
  const comp = ctx.pass(({ uv, res }) => {
    const c0 = sampleRT(D.tS, uv).toVar()
    const coc = (d: F): F => sat1(abs(d.sub(D.focus)).div(max(d, 0.01)).mul(step(0, d)) as F)
    const r0 = min(coc(c0.a as F).mul(D.blur), 0.022).toVar() // capped: 20 taps cannot fill a wider disc
    const acc = vec4(c0.rgb, 1).toVar()
    If(r0.greaterThan(0.0007), () => {
      const jit = hash21(floor(uv.mul(res))).mul(6.2832).toVar()
      Loop(20, ({ i }) => {
        const fi = float(i).add(0.5)
        const rr = sqrt(fi.div(20))
        const a = fi.mul(2.39996).add(jit) // the spiral turned per pixel: a point of light opens into a disc, not a flower
        const o = vec2(cos(a), sin(a)).mul(rr).mul(r0).div(vec2(D.asp, 1))
        const t = sampleRT(D.tS, uv.add(o) as V2).toVar()
        // a tap may not smear what is sharper than itself; highlights keep their weight, so points open into discs
        const w = sat1(coc(t.a as F).mul(D.blur).div(rr.mul(r0).add(1e-5)).mul(1.4).add(step(c0.a, t.a)) as F).mul(max(t.r, max(t.g, t.b)).mul(0.6).add(1))
        acc.addAssign(vec4(t.rgb.mul(w), w))
      })
    })
    const col = acc.rgb.div(acc.a).toVar()
    If(D.beam.greaterThan(0), () => {
      col.addAssign(sampleRT(D.tV, uv).rgb)
    })
    // ---- the prism, traced: clear hand-made glass between the camera and the room
    If(D.prism.greaterThan(0).and(c0.a.greaterThanEqual(0)), () => { // never over the rule (alpha -1)
      const v = normalize(VU.cf.add(VU.cr.mul(uv.x.mul(2).sub(1))).add(VU.cu.mul(uv.y.mul(2).sub(1)))).toVar()
      const o = VU.cp
      const tIn = float(-1e9).toVar(), tOut = float(1e9).toVar(), nIn = vec3(0, 0, 1).toVar()
      for (const pl of P_PLANES) {
        const n = vec3(pl.n[0], pl.n[1], pl.n[2])
        const den = dot(n, v).toVar()
        const t = float(pl.d).sub(dot(n, o)).div(den.add(1e-7)).toVar()
        If(den.lessThan(0), () => {
          If(t.greaterThan(tIn), () => {
            tIn.assign(t)
            nIn.assign(n)
          })
        }).Else(() => {
          tOut.assign(min(tOut, t))
        })
      }
      If(tIn.lessThan(tOut).and(tIn.greaterThan(0)), () => {
        const E = o.add(v.mul(tIn)).toVar()
        /** Refract into the glass at index `ior`, out of the far face; where the light comes from behind it, on screen. */
        const through = (ior: number) => {
          const d1 = refract(v, nIn, 1 / ior).toVar()
          const tx = float(1e9).toVar(), nOut = vec3(0, 0, 1).toVar()
          for (const pl of P_PLANES) {
            const n = vec3(pl.n[0], pl.n[1], pl.n[2])
            const den = dot(n, d1).toVar()
            If(den.greaterThan(1e-4), () => {
              const t = float(pl.d).sub(dot(n, E)).div(den).toVar()
              If(t.lessThan(tx), () => {
                tx.assign(t)
                nOut.assign(n)
              })
            })
          }
          const X = E.add(d1.mul(tx))
          const d2 = refract(d1, nOut.negate(), ior).toVar()
          // total internal reflection: the far face is a mirror and the light comes round from another side, dimmer
          const tir = step(length(d2), 0.5)
          const dd = mixN(d2, reflect(d1, nOut.negate()), tir)
          const S = X.add(dd.mul(0.7)).sub(o).toVar()
          const z = max(dot(S, VU.cf), 0.01)
          const su = vec2(dot(S, VU.cr).div(dot(VU.cr, VU.cr)), dot(S, VU.cu).div(dot(VU.cu, VU.cu))).div(z).mul(0.5).add(0.5)
          return { su: clampN(su, 0.001, 0.999) as V2, L: tx, tir, X, dd }
        }
        const R = through(nOf(0.64)), G = through(nOf(0.54)), B = through(nOf(0.45))
        const sunOn = U.reach1.div(L0)
        /** What a ray leaving the glass meets that is lit, traced rather than read off the screen: the pencil from
         *  the hole (a bright line, refracted), the hole itself and the glare round it on the shutter, and the
         *  bench under the prism, lit by the scatter of the beam. Clear glass reads by what it bends. */
        const litBehind = (X: V3, dd: V3): V3 => {
          const lc = vec3(0).toVar()
          // the pencil: nearest approach of the ray to the segment hole -> prism
          const u = PRn.sub(HOLEn).toVar(), w0 = X.sub(HOLEn).toVar()
          const b = dot(dd, u), c = dot(u, u), d0 = dot(dd, w0), e0 = dot(u, w0)
          const den = max(c.sub(b.mul(b)), 1e-6)
          const sP = max(b.mul(e0).sub(c.mul(d0)).div(den), 0)
          const tQ = clampN(e0.sub(b.mul(d0)).div(den), 0, 1)
          const dist = length(X.add(dd.mul(sP)).sub(HOLEn.add(u.mul(tQ))))
          lc.addAssign(SUN_C.mul(exp(sq(dist.div(0.0045) as F).negate()).mul(9).add(exp(dist.div(0.012).negate()).mul(0.6))).mul(sunOn))
          // the hole and its glare on the inside of the shutters
          const hc = dot(dd, normalize(HOLEn.sub(X)))
          lc.addAssign(SUN_C.mul(exp(hc.sub(1).mul(2500)).mul(40).add(exp(hc.sub(1).mul(40)).mul(0.1))).mul(sunOn))
          // the bench: the oak top under the prism, warm in the beam's scatter, brightest under the glass
          const tB = float(TABLE_Y).sub(X.y).div(min(dd.y, -1e-3))
          const H = X.add(dd.mul(tB)).toVar()
          const onB = step(0, tB).mul(step(abs(H.x.sub(TABLE[0])), TABLE[2])).mul(step(abs(H.z.sub(TABLE[1])), TABLE[3]))
          const grain = sin(H.x.mul(160).add(vnoise(H.xz.mul(vec2(8, 60))).mul(6))).mul(0.15).add(0.85)
          const pool = exp(length(H.xz.sub(vec2(PR[0], 0))).div(-0.12)).mul(0.5).add(0.04)
          lc.addAssign(vec3(0.55, 0.36, 0.2).mul(0.4).mul(grain).mul(pool).mul(onB).mul(sunOn.mul(0.5).add(U.day.mul(0.3))))
          return lc as V3
        }
        const bg = (q: typeof R) => sampleRT(D.tS, q.su).rgb.add(sampleRT(D.tV, q.su).rgb.mul(D.beam)).mul(q.tir.mul(-0.45).add(1))
        const trans = vec3(bg(R).r.add(litBehind(R.X as V3, R.dd as V3).x), bg(G).g.add(litBehind(G.X as V3, G.dd as V3).y), bg(B).b.add(litBehind(B.X as V3, B.dd as V3).z)).toVar()
        // the green of old glass shows only where the path is long: toward the edges and ends
        trans.mulAssign(exp(vec3(3.5, 1.1, 2.4).mul(G.L).negate()))
        // a reflection of the room in each face: dark, with the window's glare and the hole's spark in it
        const cosI = dot(v, nIn).negate()
        const F = float(0.045).add(pow(float(1).sub(cosI), 5).mul(0.955)).toVar()
        const r = reflect(v, nIn)
        const toHole = normalize(HOLEn.sub(E))
        const env = vec3(0.03, 0.028, 0.026).add(vec3(0.5, 0.55, 0.6).mul(U.day).mul(sstep(0.2, 0.9, r.x.negate()) as F)).add(SUN_C.mul(exp(dot(r, toHole).sub(1).mul(900)).mul(40).add(exp(dot(r, toHole).sub(1).mul(25)).mul(0.2))).mul(sunOn)).add(litBehind(E as V3, r as V3).mul(0.8)).add(CANDLE_C.mul(U.candleI).mul(exp(dot(r, normalize(CANn.sub(E))).sub(1).mul(300))).mul(20))
        // the edges: the distance from the entry point to the nearest other face
        const edgeD = float(1).toVar()
        for (const pl of P_PLANES) {
          const n = vec3(pl.n[0], pl.n[1], pl.n[2])
          const dj = float(pl.d).sub(dot(n, E)).add(step(0.99, dot(n, nIn)))
          edgeD.assign(min(edgeD, dj))
        }
        const px = tIn.mul(VU.pxa)
        const edge = exp(edgeD.div(px.mul(1.3).add(0.0002)).negate()).toVar()
        const lightAt = U.reach1.div(L0).mul(0.9).add(U.candleI.mul(3)).add(U.day.mul(0.3)).add(0.05)
        // the light inside: the pencil crossing the glass, lit up where striae and seed bubbles scatter it
        const RIN = vec3(PR[0] - P_U[0] * P_HW * 0.5, PR[1] - P_U[1] * P_HW * 0.5, 0), SD = vec3(P_U[0], P_U[1], 0)
        const ww = o.sub(RIN)
        const aa = dot(v, SD).toVar()
        const sAt = clampN(dot(SD, ww).sub(aa.mul(dot(v, ww))).div(max(aa.mul(aa).oneMinus(), 0.01)), 0, P_HW).toVar()
        const qq = RIN.add(SD.mul(sAt))
        const tq = dot(qq.sub(o), v)
        const dRay = length(o.add(v.mul(tq)).sub(qq))
        const cords = sin(qq.x.mul(2300).add(sin(E.z.mul(90)).mul(4))).mul(0.5).add(0.5).mul(vnoise(vec2(sAt.mul(400), E.z.mul(150))))
        const inner = exp(sq(dRay.div(0.0058) as F).negate()).mul(cords.mul(1.6).add(0.6))
        const bub = exp(sq(length(vec2(sAt.sub(P_HW * 0.63), E.z.sub(0.018))).div(0.0011) as F).negate()).mul(5)
        // the colours as they leave by the second face
        const hue = sat1(sAt.div(P_HW) as F)
        const spec = clampN(abs(fract(vec3(dRay.div(0.004).mul(0.5).add(0.5).mul(0.78).oneMinus().mul(0.85)).add(vec3(0, 0.6667, 0.3333))).mul(6).sub(3)).sub(1), 0, 1)
        const glow = SUN_C.mul(inner.add(bub)).mul(mixN(vec3(1, 1, 1), spec, sq(hue as F).mul(0.8))).mul(U.reach1.div(L0)).mul(1.6)
        // seeds and cords in the body scatter a little of the pencil all through it: the glass glows faintly green-white
        const body = vec3(0.75, 0.95, 0.85).mul(G.L.div(0.03)).mul(U.reach1.div(L0)).mul(0.012).add(vec3(0.6, 0.75, 0.7).mul(U.day).mul(G.L).mul(0.8))
        const glassC = trans.mul(F.oneMinus()).add(body).add(env.mul(F)).add(vec3(0.85, 0.95, 1.0).mul(edge).mul(lightAt).mul(0.9)).add(glow)
        col.assign(glassC)
      })
    })
    return vec4(col, 1)
  }, { ...D, ...VU })

  // ---------------------------------------------------------------- the camera: shots, and the cuts between them

  type Shot = { p: THREE.Vector3; t: THREE.Vector3; fov: number; focus: number; blur: number }
  const shot = (p: [number, number, number], t: [number, number, number], fov: number, blur = 0.012, focus = -1): Shot => {
    const P = new THREE.Vector3(...p), T = new THREE.Vector3(...t)
    return { p: P, t: T, fov, focus: focus < 0 ? P.distanceTo(T) : focus, blur }
  }
  // At the eyepiece: first a step back, so the brass cell, the glass and the night window behind it
  // are in the frame and the field is a small disc in the lens; at the end, down the tube, the lens
  // fills the frame and the field is most of it.
  const eyeAt = (back: number, fov: number, blur: number): Shot => {
    const p = EYE.clone().addScaledVector(AXIS, -back)
    return { p, t: p.clone().add(AXIS), fov, focus: back, blur }
  }
  const SH = {
    eye: eyeAt(0.14, 24, 0.022),
    eyeEnd: eyeAt(0.026, 7.2, 0.0),
    two: shot([-1.06, 1.32, 0.02], [-1.62, 1.06, -0.03], 33, 0.03),
    shut: shot([-1.95, 1.88, 0.32], [-3.39, 1.85, -0.06], 34, 0.012),
    shutW: shot([-1.95, 1.9, 0.4], [-3.2, 1.95, -0.85], 36, 0.012), // where the whip comes in from
    holeS: shot([-2.62, 2.04, 0.62], [-3.24, 1.93, 0.0], 24, 0.02),
    prism: shot([-2.74, 1.725, 0.36], [-2.985, 1.745, 0.0], 21, 0.026),
    fan: shot([-1.2, 1.5, 0.85], [1.2, 2.0, 0.0], 36, 0.012),
    wall: shot([WALL_X - 1.75, PATCH_MID - 0.08, 0.8], [WALL_X, PATCH_MID, -0.05], 22, 0.03),
    // the drift back: from beside the patch, looking back up the fan to the prism and the hole it came through
    hold: shot([WALL_X - 0.7, PATCH_MID - 0.2, 0.62], [PR[0] + 1.2, PR[1] + 0.32, -0.55], 34, 0.02),
  }
  // the rows, read in turn: the camera low over the page, looking up it, focus on one row at a time
  const rowPos = (k: number, o: THREE.Vector3) => o.copy(BOOK).addScaledVector(pageY, ROW_Y(k))
  const PAGE_OFF = new THREE.Vector3().addScaledVector(pageN, 0.13).addScaledVector(pageY, -0.2).addScaledVector(pageX, 0.015)
  const pageShot: Shot = { p: new THREE.Vector3(), t: new THREE.Vector3(), fov: 25, focus: 0.24, blur: 0.16 }
  const cs = { p: new THREE.Vector3(), t: new THREE.Vector3(), fov: 30, focus: 1, blur: 0, eye: 1 }
  const to = (sh: Shot, k: number) => {
    if (k <= 0) return
    cs.p.lerp(sh.p, k)
    cs.t.lerp(sh.t, k)
    cs.fov = Math.exp(mix(Math.log(cs.fov), Math.log(sh.fov), k))
    cs.focus = mix(cs.focus, sh.focus, k)
    cs.blur = mix(cs.blur, sh.blur, k)
  }
  const back = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2 // a gentle outBack
  const vR = new THREE.Vector3(), vU = new THREE.Vector3(), vF = new THREE.Vector3(), vT = new THREE.Vector3(), vRow = new THREE.Vector3()
  const lp: [number, number, number] = [0, 0, 0]
  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.55, bloomThresh: 1.1, bloomRadius: 0.75, halation: 0.45, contrast: 1.08, sat: 1.06, vignette: 0.3, grain: 0.03, ca: 0.0012, lift: [0.002, 0.003, 0.007], gain: [1.02, 1.0, 0.96] }
  const CLEAR = ageCardClear(ctx.def.id, START)
  const HEAD_AT = [Math.max(CLEAR + 0.1, ROW_AT(5) - 0.5), 4.2]
  const TITLES: TitleOpts = { color: "#fff6e6", delay: HEAD_AT, shadow: "rgba(0,0,0,0.7)", maxLine: 26 }
  const HUD = { color: "#fff6e6", shadow: "rgba(0,0,0,0.7)" }
  const T_PLUG = 0.85, T_PRISM = 1.9, T_FAN = 3.1, T_WHIP = 4.5, T_LAND = 5.3
  /** Which row the camera reads at `t` seconds of beat 0 (continuous, 0 to 5). */
  const rowOf = (t: number) => {
    let k = 0
    for (let j = 1; j < NIGHTS.length; j++) k += smooth(ROW_AT(j) - 0.3, ROW_AT(j) + 0.12, t)
    return k
  }

  // the quill is back in the pot: the sixth row is still wet
  {
    quill.position.copy(POT).setY(POT.y + 0.01)
    quill.quaternion.setFromUnitVectors(Y, new THREE.Vector3(0.55, 1, -0.22).normalize()) // leaning toward the page, into the reading shots
  }

  let pushLift = 0
  function update(s: State) {
    const t0 = s.at(0)
    const t1 = s.at(1)
    const b1 = s.beat >= 1
    U.time.value = s.time
    U.mt.value = 0

    // ---- the light
    const dusk = b1 ? 0 : 1
    const flick = 1 + 0.06 * Math.sin(s.time * 11.3) * Math.sin(s.time * 3.1) + 0.04 * Math.sin(s.time * 23.7 + 1) + 0.03 * Math.sin(s.time * 1.9)
    U.candleI.value = 0.14 * flick * dusk
    U.night.value = 1.6 * dusk
    // by day the shutters stand open on a bright sky; they swing to and the room goes black
    // the leaves are already swinging to at the cut (thrown from the left of frame), slam at 0.28 and rebound once
    const shut = !b1 ? 0 : t1 < 0.7 ? 0.08 + 0.92 * (t1 / 0.7) ** 2.5 : 1 - 0.06 * Math.exp(-(t1 - 0.7) * 7) * Math.abs(Math.sin((t1 - 0.7) * 14))
    U.glaze.value = b1 ? 1 : 0
    U.day.value = b1 ? 1.6 * (1 - shut) : 0
    const spread = !b1 ? 0 : t1 < T_PRISM ? smooth(T_PLUG, T_PLUG + 0.5, t1) : 1 + smooth(T_PRISM + 0.3, T_LAND - 0.25, t1)
    U.reach1.value = b1 ? L0 * clamp(spread) * (t1 > T_PLUG ? 1 : 0) : 0
    U.reach2.value = b1 ? Math.max(0, spread - 1) * (THROW / Math.cos(TH_MID) + 0.2) : 0
    U.patch.value = b1 ? 1.1 * smooth(1.9, 2, spread) : 0
    for (const l of leaves) l.hinge.rotation.y = -l.sd * 1.85 * (b1 ? 1 - shut : 1)
    scope.visible = desk.visible = quill.visible = !b1 || t1 < 2.4
    lab.visible = b1

    // ---- the eyepiece: which night, the tremor, the creep
    const late = t0 > ROW_AT(5) + 0.3
    const night = NIGHTS[late ? 5 : 0]
    const creep = late ? Math.max(0, t0 - PUSH_T - 1.2) : 0
    const SC = (1.75 / 7.5) // his minutes to fields, opened up a little
    for (let i = 0; i < 4; i++) {
      const m = night[i]
      const v = U.moons.array[i] as THREE.Vector4
      if (!m) v.set(0, 0, 1, 0)
      else {
        // (illustration) in the hold the points move as they do over hours: each on its own period about the disc
        const ph = creep * [0.11, 0.05, -0.085, 0.03][i]
        v.set(m[0] * SC * Math.cos(ph) - Math.sin(ph) * 0.35 * Math.sign(m[0]), m[2] * SC, m[1], 1)
      }
    }
    const breath = smooth(0.35, 1.2, t0) * (0.02 + 0.3 * Math.exp(-Math.max(0, t0 - 0.5) * 1.7)) + (late ? 0.02 + 0.06 * Math.exp(-Math.max(0, t0 - PUSH_T) * 1.3) * smooth(PUSH_T - 0.4, PUSH_T + 0.5, t0) : 0)
    ;(U.trem.value as THREE.Vector2).set(breath * (Math.sin(s.time * 5.1) * 0.6 + Math.sin(s.time * 12.7 + 1) * 0.3 + Math.sin(s.time * 1.3) * 0.5), breath * (Math.sin(s.time * 4.3 + 2) * 0.6 + Math.sin(s.time * 14.9) * 0.3 + Math.sin(s.time * 7.0) * 0.18))

    // ---- the camera
    const from = b1 ? SH.shutW : SH.eye // beat 1 arrives on a whip, settling on the window
    cs.p.copy(from.p)
    cs.t.copy(from.t)
    cs.fov = from.fov
    cs.focus = from.focus
    cs.blur = from.blur
    to(SH.two, back(s.k(0, 1.3, 2.5, E.io3)))
    // down the page, one row at a time; focus lands on each row as it comes up
    const kf = rowOf(t0)
    rowPos(kf, pageShot.p).add(PAGE_OFF)
    rowPos(kf, pageShot.t).addScaledVector(pageY, 0.045) // aim a little up the page: the pot and quill stand at the head of the frame
    pageShot.focus = PAGE_OFF.length()
    to(pageShot, s.k(0, 2.5, ROW_T0 - 0.05, E.io3))
    // back down the tube: lift off the page to the telescope beside it, then dolly in along the axis
    to(SH.two, s.k(0, PUSH_T, PUSH_T + 0.5, E.io2))
    const push = s.k(0, PUSH_T + 0.35, PUSH_T + 1.4, E.io5)
    to(SH.eyeEnd, push)
    // on the way in the lens keeps the eyepiece's brass cell in frame (it holds the candle), instead of swinging
    // across the dark room between the page and the axis
    if (s.beat === 0 && push > 0 && push < 1) {
      const kk = 0.7 * Math.sin(Math.PI * Math.min(1, push * 1.15)) ** 0.7
      cs.t.lerp(vT.copy(EYE).addScaledVector(AXIS, 0.12), kk)
      cs.focus = mix(cs.focus, cs.p.distanceTo(vT), kk)
      cs.blur *= 1 - 0.85 * kk / 0.7 // the gilt tooling sharp, not a field of bokeh in the dark
    }
    pushLift = s.beat === 0 ? Math.sin(Math.PI * clamp(push * 1.1)) : 0
    // in beat 1 the field's offset eases out instead of jumping at the cut
    cs.eye = s.beat === 0 ? Math.max(1 - s.k(0, 1.3, 1.8, E.lin), push) : 0
    if (s.beat === 0 && t0 > 1.3 && t0 < PUSH_T + 0.3) {
      // the rack: focus leaves the cell late and reaches the page before the camera does; it comes back to the cell first
      const toPage = s.k(0, 1.6, 2.4, E.io2) * (1 - s.k(0, PUSH_T - 0.3, PUSH_T + 0.1, E.io2))
      cs.focus = mix(cs.focus, cs.p.distanceTo(rowPos(kf, vRow)), toPage)
    }
    if (b1) {
      to(SH.shut, back(s.k(1, 0, 0.7, E.out3)))
      to(SH.holeS, s.k(1, 0.85, 1.6, E.io3))
      to(SH.prism, s.k(1, 1.5, 2.9, E.io3))
      to(SH.fan, s.k(1, T_FAN, T_WHIP + 0.1, E.in2))
      to(SH.wall, back(s.k(1, T_WHIP, T_LAND + 0.2, E.out4)))
      // a slow push on the patch, then the drift back along the beam
      cs.fov *= 1 - 0.12 * s.k(1, T_LAND + 0.2, 8.5, E.io2)
      to(SH.hold, back(s.k(1, 8.6, 9.5, E.io3)))
    }
    const hh = cs.eye > 0.98 ? 0 : 1
    cam.fov = cs.fov
    cam.aspect = s.w / s.h
    const drift = 0.006 * hh * Math.min(1, cs.p.distanceTo(cs.t) / 0.6)
    cam.position.set(cs.p.x + drift * Math.sin(s.time * 0.31), cs.p.y + drift * Math.sin(s.time * 0.43 + 1) + 0.004 * hh * Math.sin(s.time * 0.9), cs.p.z + drift * Math.sin(s.time * 0.27 + 2) + s.mouse.x * 0.01 * hh)
    cam.up.set(0, 1, 0)
    cam.lookAt(cs.t)
    cam.updateMatrixWorld()
    if (cs.eye > 0) {
      // at the eyepiece the axis is put on the point the iris closed on
      const th = Math.tan((cam.fov * DEG) / 2)
      const e = cam.matrixWorld.elements
      vR.set(e[0], e[1], e[2])
      vU.set(e[4], e[5], e[6])
      const dd = cs.p.distanceTo(cs.t)
      vT.copy(cs.t).addScaledVector(vR, -(APERTURE_AT[0] * 2 - 1) * th * cam.aspect * cs.eye * dd).addScaledVector(vU, -(APERTURE_AT[1] * 2 - 1) * th * cs.eye * dd)
      cam.lookAt(vT)
    }
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    const e = cam.matrixWorld.elements
    const th = Math.tan((cam.fov * DEG) / 2)
    vR.set(e[0], e[1], e[2])
    vU.set(e[4], e[5], e[6])
    vF.set(-e[8], -e[9], -e[10])
    VU.cp.value.copy(cam.position)
    VU.cr.value.copy(vR).multiplyScalar(th * cam.aspect)
    VU.cu.value.copy(vU).multiplyScalar(th)
    VU.cf.value.copy(vF)
    VU.pxa.value = (2 * th) / Math.max(1, s.h)
    D.asp.value = cam.aspect
    D.focus.value = cs.focus
    D.blur.value = cs.blur
    D.beam.value = U.reach1.value > 0 ? 1 : 0
    D.prism.value = b1 ? 1 : 0

    // ---- the rule: in the candle, then in the colours
    placeRule(rule, cam, { dist: 0.5, lean: 0.16 })
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    const warm = 0.5 * flick * dusk
    const day = b1 ? 0.16 + 0.3 * smooth(0, 2, spread) + 0.5 * (1 - shut) : 0
    ;(U.ruleC.value as THREE.Vector3).set(warm * 1.0 + day * 0.9, warm * 0.72 + day * 0.86, warm * 0.4 + day * 0.8)
    U.ruleBand.value = 0.62 + 0.1 * Math.sin(s.time * 0.23) - 0.25 * s.k(1, 8.5, 13, E.io2)

    POST.exposure = 1.05 + 0.25 * (b1 ? 0 : cs.eye) + 0.9 * pushLift - 0.1 * (b1 ? smooth(1, 2, spread) : 0)
    POST.bloom = b1 ? 0.6 : 0.5
    POST.vignette = 0.3 - 0.1 * cs.eye
    if (s.live) {
      ctx.synth.bed("wind", 0.1 * dusk * (t0 < 0 ? s.enter : 1))
      ctx.synth.bed("air", b1 ? 0.1 + 0.16 * clamp(spread / 2) : 0)
    }
  }

  // ---------------------------------------------------------------- sound

  const atRow = (k: number) => () => listenerPos(rowPos(k, vT), cam, 0.3, lp)
  const alongFan = (f: number) => () => listenerPos(vT.set(PR[0] + f * THROW, PR[1] + 0.2 * f, 0), cam, 3, lp)
  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    // night: the stand takes the weight of a hand, the tube steadies
    { b: 0, at: 0.75, s: "gear", o: { f: H(3), g: 0.14, dur: 0.28 }, pos: [-0.2, -0.5, -0.2] },
    { b: 0, at: 1.3, s: "whoosh", o: { f: 240, g: 0.14, dur: 0.9 } },
    { b: 0, at: 1.45, s: "gear", o: { f: H(2), g: 0.1, dur: 0.2 }, pos: [-0.7, 0.1, 0] },
    // each night's row: the quill, a step up the harmonic series; the sixth has four
    ...NIGHTS.flatMap((n, k): Cue[] => [
      { b: 0, at: ROW_AT(k) - 0.05, s: "pluck", o: { f: H(8 + k), g: 0.14 }, pos: atRow(k) },
      ...n.map((_, j): Cue => ({ b: 0, at: ROW_AT(k) + 0.08 + j * 0.07, s: "tick", o: { f: H(16 + 2 * k + j), g: 0.05 }, pos: atRow(k) })),
    ]),
    { b: 0, at: ROW_AT(5) + 0.55, s: "bell", o: { f: H(16), g: 0.2 }, pos: [0.3, 0, 0.4] },
    { b: 0, at: PUSH_T, s: "whoosh", o: { f: 200, g: 0.16, dur: 1.3 } },
    { b: 0, at: PUSH_T + 1.3, s: "glass", o: { f: H(32), g: 0.22 }, pos: [0.12, 0, 0.9] },
    { b: 0, at: PUSH_T + 1.35, s: "shimmer", o: { f: H(16), g: 0.14 } },
    // day: the shutters, the plug, the pencil, then a harmonic for each colour as the fan opens
    { b: 1, at: 0.0, s: "whoosh", o: { f: 340, g: 0.25, dur: 0.45 } },
    { b: 1, at: 0.7, s: "thud", o: { f: H(2), g: 0.6 }, pos: [-0.6, 0.2, 0.2] },
    { b: 1, at: 0.92, s: "thud", o: { f: H(3), g: 0.3 }, pos: [-0.5, 0.2, 0.2] },
    { b: 1, at: T_PLUG, s: "crack", o: { f: 1800, g: 0.14 }, pos: [-0.3, 0.4, 0.1] },
    { b: 1, at: T_PLUG + 0.05, s: "shimmer", o: { f: H(6), g: 0.1 } },
    { b: 1, at: T_PRISM + 0.25, s: "glass", o: { f: H(24), g: 0.4 }, pos: () => listenerPos(vT.set(PR[0], PR[1], PR[2]), cam, 0.5, lp) },
    ...Array.from({ length: 7 }, (_, i): Cue => ({ b: 1, at: T_FAN - 0.5 + i * 0.26, s: "shimmer", o: { f: H(8 + i), g: 0.1 + 0.02 * i, dur: 2.4 }, pos: alongFan(0.1 + i * 0.13) })),
    { b: 1, at: T_WHIP, s: "whoosh", o: { f: 520, g: 0.3, dur: 0.7 } },
    { b: 1, at: T_LAND - 0.1, s: "bell", o: { f: H(12), g: 0.34 }, pos: [0.35, 0.1, 0.3] },
    { b: 1, at: T_LAND - 0.08, s: "sub", o: { g: 0.35 } },
    ...Array.from({ length: 7 }, (_, i): Cue => ({ b: 1, at: T_LAND + 0.5 + i * 0.22, s: "marimba", o: { f: H(8 + i), g: 0.1 }, pos: [0.25, -0.3 + i * 0.1, 0.4] })),
  ]

  // the spectrum across the headline: the same line set five times, displaced like the colours, closing up as it settles
  const FRINGE: [string, number][] = [["#ff3b2a", 1], ["#ffb02a", 0.5], ["#3dff7a", 0], ["#2aa8ff", -0.5], ["#7a3bff", -1]]

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: vol, target: volT },
      { pass: comp, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      if (U.reach1.value > 0) {
        VU.tS.value = stage.texture
        vol.render(volT)
      }
      D.tS.value = stage.texture
      D.tV.value = volT.texture
      comp.render(out)
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(0,0,0,0.7)", color: "#fff6e6" })
      if (s.beat === 1 && s.exit < 0.6) {
        const pIn = clamp((s.t - HEAD_AT[1]) / 1.5)
        // the colours close up onto the white line and are gone once it has settled
        const settle = E.out3(clamp((s.t - HEAD_AT[1]) / 2.2))
        const spreadPx = 26 * (1 - settle)
        if (pIn > 0 && settle < 0.99)
          for (const [color, k] of FRINGE)
            g.text(ctx.def.beats[1].head, TYPE.x + k * spreadPx * 0.35, TYPE.y + k * spreadPx, { size: TYPE.head, font: "serif", color, by: "word", style: "rise", p: pIn, alpha: 0.55 * (1 - settle) ** 0.7, lh: 1.02, track: -0.01 })
      }
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face)],
    dispose() {
      face.dispose()
      disposeTree(scene)
    },
  }
}
