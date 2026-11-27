// Scene 11, lastday: "From 245 to 66 million years ago: this."
//
// Idea. A long calm evening with one star that is slightly too bright. Then, with no warning, the
// star falls behind the far ridge; the sky whites out from that point; a wall crosses the plain;
// and a year on there is ash, a thin dark line in a bank of earth, and one small bird.
//
// Story parameter. `day`: one clock through three states. Evening (how bright the star is), flash
// (where the second sun is, how bright, where the front is: `uFU`), after (`uAsh`). The scene's
// motion clock `T` is the sum of the clamped beat clocks, so it stands still while the page is
// being turned and a seek gives the frame live play gives.
//
// World rule (TSL `skyAt`, `hazeAt`, `shade`; every material uses them). One sun, already set,
// left of centre, and its analytic dusk sky. One second sun (a direction and a colour: the star,
// then the bolide, then the fireball under the horizon, then nothing) that back-lights every
// silhouette, lays the long shadows toward the lens and whites out the haze from its own azimuth.
// One haze whose colour is the sky's own horizon in that direction. One `ash` scalar that greys
// sky, haze, ground and water together.
//
// Layers. The far world (sky, plain, lake, ridges, about 1,500 plant cards, the herd, the fliers,
// the wall, the ash) and the near one (the lip of the bluff, the cut bank, the branch, the bird)
// are drawn into two targets and put together with a rack focus between them. The same pass holds
// the engraving: while the page is turning, and for two seconds after it lands, the picture is a
// hatched sepia print of itself that takes colour outward from the glow where the sun went down.
//
// Units: metres. The lens is on a tripod, 1.7 above a bluff 12 above the plain, looking down -z.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, fwidth, normalGeometry, uv as uvGeo, cameraPosition, cameraProjectionMatrix, cameraProjectionMatrixInverse, cameraViewMatrix, cameraWorldMatrix, clamp as clampN, cos, Discard, dot, exp, float, floor, Fn, fract, If, length, Loop, max, min, mix as mixN, normalize, positionGeometry, positionWorld, pow, screenUV, select, sin, smoothstep, step, texture, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { clamp, E, mix, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, shake, stageTarget, typeCues } from "../engine/stage"
import { H, listenerPos } from "../engine/synth"
import { DH, DW } from "../engine/text"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash11, luma, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { comment } from "../engine/ui"
import { featherMaterial, limb as limbOf, loft, makeAim, makeHerd, makePath, MAT, muscle, skinMaterial, type CreatureSpec, type Drive, type Herd, type Lights, type LodSpec, type Look, type PartSpec, type Path, type Vec3 } from "../engine/creature"
import { PLATE } from "../transitions/pageturn"

// ---------------------------------------------------------------- the place
const EYE = 13.7
const DEG = Math.PI / 180
const dirOf = (az: number, el: number, o = new THREE.Vector3()) => o.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
const SUN_AZ = -24 * DEG
const SUN = dirOf(SUN_AZ, -2.5 * DEG)
const SUN2 = dirOf(SUN_AZ + 3 * DEG, 5.5 * DEG)
const STAR_AZ = 13 * DEG, STAR_EL = 9.5 * DEG
const HIT_AZ = 17 * DEG, HIT_EL = -1.4 * DEG
const HIT = dirOf(HIT_AZ, HIT_EL)
const FRONT_FAR = 4000
const FRONT_EXP = 2.2
// beat 2's timetable (seconds into it)
const T_FALL = 0.12, T_HIT = 0.72, T_FRONT0 = 4.2, T_FRONT1 = 6.1
const BUBBLE = "Ignore this."
const BUB_T = 6.2

/** The lake and the river that feeds it: metres to the shore, negative on the water. JS twin of `lakeD`. */
function lakeJ(x: number, z: number) {
  const qx = (x - 40) / 230, qz = (z + 185) / 62
  const d1 = (Math.hypot(qx, qz) - 1 + 0.18 * Math.sin(x * 0.021 + 1.3) + 0.1 * Math.sin(x * 0.05)) * 62
  const xm = 150 + 120 * Math.sin(z * 0.006 + 0.5) + 40 * Math.sin(z * 0.017)
  const d2 = Math.max(Math.abs(x - xm) - 20, z + 215)
  return Math.min(d1, d2)
}

// ---------------------------------------------------------------- trees, as geometry
// Each individual is grown once from a seed: a branching skeleton of tapered bark tubes with its
// foliage as cards along the twigs (a spray of leaves, a rope of scale leaves, a feather of
// needles) or as strips along an arching rachis (fronds). Bark and leaves share one buffer, bark
// first, so an individual is one draw however many places it stands in and a stripped one stops at
// the bark. The same buffers are drawn once, from the tripod's side, into the sheet the far stands
// are cut from.
const NSPRAY = 8
function drawSprays(c: CanvasRenderingContext2D) {
  const R = rng(4242)
  const S = 128
  const g = (v: number) => {
    const q = Math.round(clamp(v, 0, 255))
    return `rgb(${q},${q},${q})`
  }
  const ln = (x0: number, y0: number, x1: number, y1: number, w: number, v: number) => {
    c.strokeStyle = g(v)
    c.lineWidth = w
    c.lineCap = "round"
    c.beginPath()
    c.moveTo(x0, y0)
    c.lineTo(x1, y1)
    c.stroke()
  }
  const cell = (i: number, fn: () => void) => {
    c.save()
    c.translate(i * S, 0)
    c.beginPath()
    c.rect(2, 2, S - 4, S - 4)
    c.clip()
    fn()
    c.restore()
  }
  // 0: a spray of broad leaves, alternate on the twig
  cell(0, () => {
    ln(64, 126, 62, 26, 2.6, 70)
    for (let i = 0; i < 13; i++) {
      const y = 116 - i * 8, sd = i % 2 ? 1 : -1, a = sd * (0.75 + R() * 0.4)
      const l = 25 + R() * 9 - i * 0.6
      c.save()
      c.translate(63, y)
      c.rotate(a)
      c.fillStyle = g(120 + R() * 110)
      c.beginPath()
      c.moveTo(0, 0)
      c.bezierCurveTo(9, -l * 0.3, 8, -l * 0.8, 0, -l)
      c.bezierCurveTo(-8, -l * 0.8, -9, -l * 0.3, 0, 0)
      c.fill()
      c.strokeStyle = g(80)
      c.lineWidth = 0.8
      c.beginPath()
      c.moveTo(0, 0)
      c.lineTo(0, -l * 0.9)
      c.stroke()
      c.restore()
    }
  })
  // 1: ropes of overlapping scale leaves
  cell(1, () => {
    for (let k = 0; k < 5; k++) {
      const a = -0.75 + k * 0.375 + (R() - 0.5) * 0.15
      let x = 64, y = 126, an = a
      for (let i = 0; i < 12; i++) {
        const nx = x + Math.sin(an) * 9.5, ny = y - Math.cos(an) * 9.5
        ln(x, y, nx, ny, 10.5 - i * 0.35, 105 + R() * 80 + i * 5)
        // the scales: a dark chevron across the rope
        ln(nx - Math.cos(an) * 5, ny - Math.sin(an) * 5 + 2, nx, ny - 2, 1.4, 60)
        ln(nx + Math.cos(an) * 5, ny + Math.sin(an) * 5 + 2, nx, ny - 2, 1.4, 60)
        x = nx
        y = ny
        an -= a * 0.045
      }
    }
  })
  // 2: a flat feathered spray of needles
  cell(2, () => {
    ln(64, 126, 64, 10, 1.8, 80)
    for (let i = 0; i < 12; i++) {
      const y = 120 - i * 9, sd = i % 2 ? 1 : -1, l = 46 - i * 2.2
      const ex = 64 + sd * l * 0.85, ey = y - l * 0.5
      ln(64, y, ex, ey, 1.2, 90)
      const v = 120 + R() * 100
      for (let k = 1; k < 13; k++) {
        const px = 64 + ((ex - 64) * k) / 13, py = y + ((ey - y) * k) / 13
        ln(px - 0.5 * 5, py - 5, px + 0.5 * 5, py + 5 * 0.2, 1.5, v)
        ln(px - sd * 4.5, py + 3, px + sd * 3, py - 4.5, 1.5, v)
      }
    }
  })
  // 3: a fern frond: paired pinnae, longest below the middle, each toothed
  cell(3, () => {
    ln(64, 127, 64, 3, 2.2, 95)
    for (let i = 0; i < 26; i++) {
      const y = 122 - i * 4.6, t = i / 25
      const l = 58 * Math.sin(Math.PI * (0.12 + 0.88 * t) ** 0.75) * (1 - t * 0.25) + 3
      for (const sd of [-1, 1]) {
        c.fillStyle = g(125 + R() * 105)
        c.beginPath()
        c.moveTo(64, y + 2)
        c.lineTo(64 + sd * l, y - l * 0.28)
        c.lineTo(64, y - 2.4)
        c.fill()
      }
    }
  })
  // 4: a fan: pleated segments from the top of the stalk, their tips split
  cell(4, () => {
    ln(64, 127, 64, 84, 3, 100)
    for (let i = 0; i < 27; i++) {
      const a = -2.1 + (i / 26) * 4.2, r = 74 + R() * 8 - Math.abs(a) * 7
      c.fillStyle = g(i % 2 ? 205 - Math.abs(a) * 20 : 130)
      c.beginPath()
      c.moveTo(64, 84)
      c.lineTo(64 + Math.sin(a - 0.085) * r * 0.82, 84 - Math.cos(a - 0.085) * r * 0.82)
      c.lineTo(64 + Math.sin(a) * r, 84 - Math.cos(a) * r)
      c.lineTo(64 + Math.sin(a + 0.085) * r * 0.82, 84 - Math.cos(a + 0.085) * r * 0.82)
      c.fill()
    }
  })
  // 5: a stiff once-pinnate leaf: straight narrow leaflets of one length
  cell(5, () => {
    ln(64, 127, 64, 4, 3, 100)
    for (let i = 0; i < 30; i++) {
      const y = 121 - i * 3.9, l = 30 * Math.min(1, (i + 2) / 6, (31 - i) / 5)
      const v = 130 + R() * 100
      ln(64, y, 64 - l, y - l * 0.42, 2.3, v)
      ln(64, y, 64 + l, y - l * 0.42, 2.3, v - 25)
    }
  })
  // 6: horsetails: jointed stems with whorls of fine branches at the joints
  cell(6, () => {
    for (const x of [34, 66, 97]) {
      const h = 100 + R() * 22
      ln(x, 127, x, 127 - h, 3.4, 170)
      for (let y = 118; y > 127 - h; y -= 11) {
        ln(x - 2.5, y, x + 2.5, y, 1.5, 70)
        for (let k = -4; k <= 4; k++) if (k) ln(x, y, x + k * 3.6, y - 12 + Math.abs(k) * 1.2, 1, 140 + R() * 80)
      }
    }
  })
  // 7: last year's frond: a rachis and what is left on it
  cell(7, () => {
    ln(64, 127, 64, 6, 2, 150)
    for (let i = 0; i < 16; i++) {
      const y = 120 - i * 7, l = 10 + R() * 30
      const sd = R() < 0.5 ? -1 : 1
      ln(64, y, 64 + sd * l * 0.7, y + l * 0.55, 1.6 + R() * 2, 120 + R() * 90)
    }
  })
}

const TV = THREE.Vector3
/** Grow one tree. Species: 0 flowering tree, 1 fan palm, 2 tree fern, 3 monkey-puzzle, 4 swamp conifer, 5 cycadeoid, 6 ground fern, 7 horsetails. */
function growTree(sp: number, seed: number) {
  const R = rng(seed * 977 + sp * 131 + 5)
  const pos: number[] = [], nor: number[] = [], au: number[] = [], af: number[] = []
  const lpos: number[] = [], lnor: number[] = [], lau: number[] = [], laf: number[] = []
  const round = sp === 0 || sp === 3 || sp === 4
  const Y = new TV(0, 1, 0), X = new TV(1, 0, 0)
  const bx = new TV(), by = new TV(), n = new TV()
  let cc = new TV(0, 10, 0), cr = 8
  const ao = (p: THREE.Vector3) => 0.22 + 0.78 * clamp(p.distanceTo(cc) / cr) ** 1.6
  const vtx = (p: THREE.Vector3, nn: THREE.Vector3, u: number, v: number, cell: number, a: number, ph: number, sd: number) => {
    lpos.push(p.x, p.y, p.z)
    // a crown is lit as a volume: its leaves take most of their normal from where they are in it
    if (round) n.copy(p).sub(cc).normalize().multiplyScalar(0.8).addScaledVector(nn, nn.y < 0 ? -0.2 : 0.2).normalize()
    else n.copy(nn)
    lnor.push(n.x, n.y, n.z)
    lau.push(u, v, cell, a)
    laf.push(0, ph, sd)
  }
  const basis = (d: THREE.Vector3) => {
    bx.crossVectors(d, Math.abs(d.y) > 0.92 ? X : Y).normalize()
    by.crossVectors(d, bx).normalize()
  }
  /** A tapered bark tube from `a` along `d`, turning by `trop` a step. Returns its centre line. */
  const limb = (a: THREE.Vector3, d0: THREE.Vector3, len: number, r0: number, r1: number, trop: THREE.Vector3, segs: number, sides: number, kind: number, rf?: (y: number, ang: number) => number, tpow = 1) => {
    const pts: THREE.Vector3[] = [a.clone()], dirs: THREE.Vector3[] = [d0.clone().normalize()]
    const ring: number[][] = []
    const mk = (i: number) => {
      const p = pts[i], d = dirs[i], t = i / segs, r = mix(r0, r1, t)
      basis(d)
      const row: number[] = []
      for (let j = 0; j <= sides; j++) {
        const ang = (j / sides) * 6.2832
        n.copy(bx).multiplyScalar(Math.cos(ang)).addScaledVector(by, Math.sin(ang))
        const rr = r * (rf ? rf(p.y, ang) : 1)
        row.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr, n.x, n.y, n.z, (j / sides) * 6.2832 * r0, t * len)
      }
      ring.push(row)
    }
    mk(0)
    for (let i = 1; i <= segs; i++) {
      const step = len * ((i / segs) ** tpow - ((i - 1) / segs) ** tpow)
      const d = dirs[i - 1].clone().add(trop).normalize()
      pts.push(pts[i - 1].clone().addScaledVector(d, step))
      dirs.push(d)
      mk(i)
    }
    const a0 = ao(pts[0])
    const put = (row: number[], j: number) => {
      const o = j * 8
      pos.push(row[o], row[o + 1], row[o + 2])
      nor.push(row[o + 3], row[o + 4], row[o + 5])
      au.push(row[o + 6], row[o + 7], kind, 0.5 + 0.5 * a0)
      af.push(0, 0, 0)
    }
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < sides; j++) {
        put(ring[i], j); put(ring[i], j + 1); put(ring[i + 1], j + 1)
        put(ring[i], j); put(ring[i + 1], j + 1); put(ring[i + 1], j)
      }
    return { p: pts[segs], d: dirs[segs], pts, dirs }
  }
  /** A foliage card: from `p` along `al` for `l`, `w` wide, facing `nn`. */
  const cardAt = (p: THREE.Vector3, al: THREE.Vector3, nn: THREE.Vector3, w: number, l: number, cell: number, a = ao(p)) => {
    const ac = new TV().crossVectors(al, nn).normalize().multiplyScalar(w / 2)
    const e = al.clone().normalize().multiplyScalar(l)
    const nrm = new TV().crossVectors(ac, e).normalize()
    const ph = R(), sd = R()
    const c0 = p.clone().sub(ac), c1 = p.clone().add(ac), c2 = c1.clone().add(e), c3 = c0.clone().add(e)
    vtx(c0, nrm, 0, 0, cell, a, ph, sd); vtx(c1, nrm, 1, 0, cell, a, ph, sd); vtx(c2, nrm, 1, 1, cell, a, ph, sd)
    vtx(c0, nrm, 0, 0, cell, a, ph, sd); vtx(c2, nrm, 1, 1, cell, a, ph, sd); vtx(c3, nrm, 0, 1, cell, a, ph, sd)
  }
  /** A frond: a strip along a rachis that leaves `p` along `d` and droops. */
  const frond = (p: THREE.Vector3, d0: THREE.Vector3, len: number, w: number, droop: number, cell: number, a: number, segs = 6) => {
    const ph = R(), sd = R()
    const d = d0.clone().normalize()
    const ac = new TV().crossVectors(d, Y)
    if (ac.lengthSq() < 1e-4) ac.set(1, 0, 0)
    ac.normalize().multiplyScalar(w / 2)
    let c = p.clone()
    for (let i = 0; i < segs; i++) {
      const nd = d.clone().addScaledVector(Y, -droop / segs).normalize()
      const e = c.clone().addScaledVector(nd, len / segs)
      const nrm = new TV().crossVectors(ac, nd).normalize()
      const v0 = i / segs, v1 = (i + 1) / segs
      const c0 = c.clone().sub(ac), c1 = c.clone().add(ac), c2 = e.clone().add(ac), c3 = e.clone().sub(ac)
      vtx(c0, nrm, 0, v0, cell, a, ph, sd); vtx(c1, nrm, 1, v0, cell, a, ph, sd); vtx(c2, nrm, 1, v1, cell, a, ph, sd)
      vtx(c0, nrm, 0, v0, cell, a, ph, sd); vtx(c2, nrm, 1, v1, cell, a, ph, sd); vtx(c3, nrm, 0, v1, cell, a, ph, sd)
      c = e
      d.copy(nd)
    }
  }
  const out = (az: number, up: number) => new TV(Math.cos(az) * Math.sqrt(1 - up * up), up, Math.sin(az) * Math.sqrt(1 - up * up))
  const rv = (k = 1) => new TV((R() - 0.5) * k, (R() - 0.5) * k, (R() - 0.5) * k)
  const O = new TV(0, -0.3, 0)
  let H = 10
  if (sp === 0) {
    // a short bole that forks early and keeps forking: a broad crown, wider than deep
    H = 19
    cc = new TV(0, 12.5, 0)
    cr = 8.5
    const tr = limb(O, new TV((R() - 0.5) * 0.12, 1, (R() - 0.5) * 0.12), 5.6 + R() * 1.5, 0.5, 0.36, rv(0.03), 4, 8, -1, (y) => 1 + 0.6 * Math.exp(-(y + 0.3) / 0.6))
    const rec = (p: THREE.Vector3, d: THREE.Vector3, len: number, r: number, depth: number) => {
      const nk = depth === 0 ? 3 + (R() < 0.5 ? 1 : 0) : 2 + (R() < 0.35 ? 1 : 0)
      const a0 = R() * 6.28
      for (let k = 0; k < nk; k++) {
        const az = a0 + (k / nk) * 6.2832 + (R() - 0.5) * 0.9, tilt = depth === 0 ? 0.6 + R() * 0.35 : 0.38 + R() * 0.5
        basis(d)
        const nd = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(bx, Math.cos(az) * Math.sin(tilt)).addScaledVector(by, Math.sin(az) * Math.sin(tilt))
        nd.y += 0.1
        nd.normalize()
        const L = len * (0.66 + R() * 0.22)
        const sg = limb(p, nd, L, r, r * 0.6, new TV(0, 0.07, 0).add(rv(0.12)), depth < 2 ? 3 : 2, depth < 1 ? 6 : depth < 2 ? 4 : 3, -1)
        if (depth >= 1) {
          const m = depth >= 2 ? 9 : 4
          for (let i = 0; i < m; i++) {
            const pt = p.clone().lerp(sg.p, 0.25 + 0.75 * R()).add(rv(1.4))
            cardAt(pt, sg.d.clone().add(rv(1.5)).add(new TV(0, -0.15, 0)), Y.clone().add(rv(1.3)), 2.3, 2.6, 0)
          }
        }
        if (depth < 3) rec(sg.p, sg.d, L, r * 0.6, depth + 1)
        else for (let i = 0; i < 5; i++) cardAt(sg.p.clone().add(rv(0.8)), out(R() * 6.28, 0.1 + R() * 0.6), Y.clone().add(rv(1.2)), 2.3, 2.6, 0)
      }
    }
    rec(tr.p, tr.d, 5.4, 0.3, 0)
  } else if (sp === 1) {
    // a fan palm: a slender ringed trunk, fans on long stalks, dead fans hanging under the crown
    H = 10
    const tr = limb(O, new TV((R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3), 8.5 + R() * 2, 0.2, 0.15, new TV((R() - 0.5) * 0.05, 0.02, (R() - 0.5) * 0.05), 6, 7, -2)
    cc = tr.p.clone()
    cr = 2.6
    for (let i = 0; i < 26; i++) {
      const az = i * 2.39996, up = 0.95 - (i / 25) * 1.5
      const d = out(az, clamp(up, -0.55, 0.95))
      const st = limb(tr.p, d, 1.5 + 0.8 * R(), 0.03, 0.02, new TV(0, -0.09, 0), 3, 3, -2)
      // the blade stands across its stalk, folded a little along the midrib
      const fl = Y.clone().addScaledVector(st.d, -st.d.y).add(rv(0.5)).normalize()
      const sd = new TV().crossVectors(st.d, fl).normalize()
      const sz = 1.25 + 0.35 * R(), a = 0.5 + 0.5 * clamp(up + 0.55)
      for (const f of i < 9 ? [-0.4, 0.4] : [0.2 * (R() - 0.5)]) cardAt(st.p.clone().addScaledVector(st.d, -0.34 * sz), st.d, fl.clone().addScaledVector(sd, f), sz, sz, 4, a)
    }
    for (let i = 0; i < 7; i++) {
      const az = R() * 6.28
      cardAt(tr.p.clone().add(new TV(Math.cos(az) * 0.15, -0.1, Math.sin(az) * 0.15)), new TV(Math.cos(az) * 0.35, -1, Math.sin(az) * 0.35), new TV(-Math.sin(az), 0, Math.cos(az)), 1.3, 1.7, 7, 0.4)
    }
  } else if (sp === 2) {
    // a tree fern: a fibrous trunk, a funnel of arching fronds, a skirt of dead ones
    H = 6.5
    const tr = limb(O, new TV((R() - 0.5) * 0.25, 1, (R() - 0.5) * 0.25), 4.2 + R() * 1.6, 0.19, 0.16, rv(0.04), 5, 7, -2)
    for (let i = 0; i < 16; i++) {
      const az = i * 2.39996 + R() * 0.3
      frond(tr.p, out(az, 0.55 + R() * 0.35), 3.3 + R() * 0.6, 1.05, 1.25 + R() * 0.5, 3, 0.5 + 0.5 * R(), 7)
    }
    for (let i = 0; i < 10; i++) {
      const az = R() * 6.28
      frond(tr.p.clone().add(new TV(0, -0.15, 0)), out(az, -0.72), 1.9 + R() * 0.7, 0.6, 0.35, 7, 0.4, 3)
    }
  } else if (sp === 3) {
    // a monkey-puzzle: a tall bare bole, tiers of five upswept boughs, shortest at the top
    H = 31
    cc = new TV(0, 23, 0)
    cr = 7
    const tr = limb(O, new TV((R() - 0.5) * 0.04, 1, (R() - 0.5) * 0.04), 30, 0.62, 0.14, rv(0.01), 8, 8, -1, (y) => 1 + 0.45 * Math.exp(-(y + 0.3) / 0.8))
    for (let y = 15.5 + R(); y < 29.6; y += 1.25) {
      const t = (y - 15.5) / 14.2, a0 = R() * 6.28
      const L = 1.4 + 5.4 * (1 - t ** 1.5)
      const at = new TV(tr.pts[0].x, y, tr.pts[0].z).lerp(tr.p, 0).setY(y)
      for (let k = 0; k < 5; k++) {
        const az = a0 + (k / 5) * 6.2832 + (R() - 0.5) * 0.25
        const sg = limb(at, out(az, -0.12), L, 0.13 * (1 - t * 0.5), 0.045, new TV(0, 0.17, 0), 5, 4, -1)
        for (let i = 2; i <= 5; i++)
          for (let m = 0; m < (i === 5 ? 3 : 2); m++) cardAt(sg.pts[i].clone().add(rv(0.3)), sg.dirs[i].clone().add(rv(0.9)), Y.clone().add(rv(0.9)), 1.5, 1.75, 1)
      }
    }
    for (let i = 0; i < 4; i++) cardAt(tr.p.clone(), out(R() * 6.28, 0.7), X.clone().add(rv(1)), 1.4, 1.6, 1)
    for (let i = 0; i < 5; i++) limb(new TV(0, 6 + R() * 8, 0), out(R() * 6.28, -0.2), 0.7 + R(), 0.07, 0.03, new TV(0, -0.05, 0), 1, 3, -1)
  } else if (sp === 4) {
    // a swamp conifer: a fluted, flared foot, a straight bole, short level branches in a spire
    H = 24
    cc = new TV(0, 13, 0)
    cr = 5
    const fl = R() * 6.28
    const tr = limb(new TV(0, -1.2, 0), new TV((R() - 0.5) * 0.03, 1, (R() - 0.5) * 0.03), 24.5, 0.36, 0.05, rv(0.008), 11, 11, -1, (y, ang) => 1 + 2.7 * Math.exp(-(y + 1.2) / 1.5) * (1 + 0.34 * Math.cos(ang * 5 + fl)), 1.7)
    let k = 0
    for (let y = 4.2; y < 22.6; y += 0.48) {
      const t = (y - 4.2) / 18.4
      const L = 0.6 + 4.0 * (1 - t) ** 0.85
      const az = k++ * 2.39996
      const sg = limb(new TV(0, y, 0), out(az, -0.1), L, 0.06, 0.02, new TV(0, 0.04, 0), 3, 3, -1)
      for (let i = 1; i <= 3; i++) {
        cardAt(sg.pts[i].clone().addScaledVector(sg.dirs[i], -0.7), sg.dirs[i].clone().add(rv(0.5)), Y.clone().add(rv(0.7)), 1.5, 1.7, 2)
        if (i > 1) cardAt(sg.pts[i].clone(), new TV(sg.dirs[i].x * 0.4, -1, sg.dirs[i].z * 0.4), new TV(-sg.dirs[i].z, 0, sg.dirs[i].x).add(rv(0.4)), 1.2, 1.3, 2)
      }
    }
    cardAt(tr.p.clone().add(new TV(0, -1.4, 0)), Y, X, 1.2, 1.8, 2)
  } else if (sp === 5) {
    // a cycadeoid: a squat armoured barrel and a crown of stiff leaves
    H = 2.2
    const tr = limb(new TV(0, -0.35, 0), Y, 1.05, 0.36, 0.28, rv(0.01), 4, 9, -3, (y) => 1 + 0.2 * Math.sin(clamp(y + 0.35, 0, 1) * 3.1))
    for (let i = 0; i < 22; i++) frond(tr.p.clone().add(new TV(0, -0.08, 0)), out(i * 2.39996, 0.95 - (i / 21) * 0.85), 1.45 + R() * 0.3, 0.3, 0.25 + R() * 0.25, 5, 0.5 + 0.5 * (1 - i / 21), 3)
  } else if (sp === 6) {
    H = 1.0
    for (let i = 0; i < 10; i++) frond(new TV(0, 0, 0), out(i * 2.39996, 0.45 + R() * 0.4), 0.95 + R() * 0.4, 0.32, 1.2, 3, 0.6 + 0.4 * R(), 4)
  } else {
    H = 1.6
    // a bed of them, of every height: reeds, not posts
    for (let i = 0; i < 22; i++) {
      const az = R() * 6.28
      cardAt(new TV((R() - 0.5) * 3.4, -0.05, (R() - 0.5) * 2), new TV((R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3), new TV(Math.cos(az), 0, Math.sin(az)), 0.6, 0.6 + R() * 1.3, 6, 0.9)
    }
  }
  // how far a point gives in the wind: by its height and its reach from the trunk
  const nBark = pos.length / 3
  for (let i = 0; i < lpos.length; i++) pos.push(lpos[i])
  for (let i = 0; i < lnor.length; i++) nor.push(lnor[i])
  for (let i = 0; i < lau.length; i++) au.push(lau[i])
  for (let i = 0; i < laf.length; i++) af.push(laf[i])
  let rad = 0.2, top = 0.5
  for (let i = 0; i < pos.length / 3; i++) {
    af[i * 3] = clamp(Math.max(pos[i * 3 + 1], 0) / H) ** 1.4 + (0.3 * Math.hypot(pos[i * 3], pos[i * 3 + 2])) / H
    rad = Math.max(rad, Math.hypot(pos[i * 3], pos[i * 3 + 2]))
    top = Math.max(top, pos[i * 3 + 1])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nor), 3))
  g.setAttribute("aU", new THREE.BufferAttribute(new Float32Array(au), 4))
  g.setAttribute("aF", new THREE.BufferAttribute(new Float32Array(af), 3))
  return { g, H, cr, nAll: pos.length / 3, nBark, rad, top }
}
type Tree = ReturnType<typeof growTree>

// ---------------------------------------------------------------- the animals, as anatomy
// Specs for the engine's creature toolkit, in metres, origin on the ground under the hips, +x the
// head. Proportions are from the pages quoted in the beat sheet ("Fauna"); what could not be read
// off a page is this model's reading of published skeletals and is listed there as such.
// ---- Triceratops (Hell Creek's commonest dinosaur). 8.25 m; the skull, beak tip to frill edge, 2.6 m of that ("almost a
// third"); the back highest over the hips at 2.76 m and a sixth lower at the shoulders; the chest narrow between the
// shoulders and the barrel broadest two thirds of the way back; elbows flexed behind and a little out, hands under the
// shoulders and outside the hind prints; three hoofed fingers, four hoofed toes. Sources in the beat sheet.
/** A grown one, or (`young`) a juvenile: brow horns that are short and curve backward, a short frill with a scalloped edge. */
function triceratops(young: boolean): CreatureSpec {
  const fr = young ? 0.72 : 1 // the frill's reach
  const fw = young ? 0.8 : 1
  const T = loft([
    { x: -3.15, top: 1.03, bot: 0.99, hw: 0.02 },
    { x: -2.5, top: 1.3, bot: 1.04, hw: 0.09, ridge: [0.02, 0.03], n: 1.9 },
    { x: -1.8, top: 1.66, bot: 1.14, hw: 0.17, ridge: [0.03, 0.05], n: 1.9 },
    { x: -1.1, top: 2.05, bot: 1.25, hw: 0.28, ridge: [0.04, 0.07], n: 1.9 },
    { x: -0.55, top: 2.44, bot: 1.3, hw: 0.44, ridge: [0.045, 0.09], n: 1.9 },
    { x: -0.1, top: 2.68, bot: 1.2, hw: 0.66, mid: 0.55, ridge: [0.045, 0.1], n: 2 },
    { x: 0.25, top: 2.76, bot: 1.1, hw: 0.8, mid: 0.55, ridge: [0.04, 0.11], n: 2.1, nb: 2.4 }, // over the hips: the highest point
    { x: 0.85, top: 2.72, bot: 0.99, hw: 0.86, mid: 0.47, ridge: [0.035, 0.11], n: 2.1, nb: 2.7 }, // the barrel at its broadest, belly flat
    { x: 1.4, top: 2.6, bot: 0.97, hw: 0.84, mid: 0.45, ridge: [0.03, 0.11], n: 2.1, nb: 2.8 },
    { x: 1.95, top: 2.44, bot: 1.02, hw: 0.72, mid: 0.47, ridge: [0.025, 0.1], n: 2.1, nb: 2.5 },
    { x: 2.4, top: 2.3, bot: 1.1, hw: 0.55, ridge: [0.02, 0.09], n: 2.1, nb: 2.3 }, // narrow between the shoulders
    { x: 2.8, top: 2.18, bot: 1.22, hw: 0.42 },
    { x: 3.15, top: 2.1, bot: 1.31, hw: 0.37 }, // the neck, under the frill
    { x: 3.5, top: 2.16, bot: 1.37, hw: 0.43, n: 2.5 }, // the back of the skull, where the frill rises
    { x: 3.85, top: 2.13, bot: 1.31, hw: 0.47, n: 2.6 }, // across the orbits and cheeks: the widest of the face
    { x: 4.15, top: 1.99, bot: 1.24, hw: 0.39, n: 2.5 },
    { x: 4.45, top: 1.81, bot: 1.16, hw: 0.29, n: 2.3 },
    { x: 4.7, top: 1.6, bot: 1.1, hw: 0.2, n: 2.1 },
    { x: 4.9, top: 1.36, bot: 1.04, hw: 0.11, n: 1.9 },
    { x: 5.0, top: 1.13, bot: 1.0, hw: 0.03, n: 2 }, // the beak's tip, hooked down
  ])
  const t = T.at
  const HIND = limbOf({
    joints: [[0.05, 2.0, 0.5], [0.42, 1.02, 0.6], [0.1, 0.36, 0.6], [0.3, 0.125, 0.6], [0.52, 0.085, 0.6]],
    girth: [
      { t: 0, w: 0.42, f: 0.5, b: 0.58 }, { t: 0.35, w: 0.42, f: 0.46, b: 0.55 }, { t: 0.8, w: 0.32, f: 0.35, b: 0.36 }, { t: 1, w: 0.26, f: 0.3, b: 0.25 },
      { t: 1.35, w: 0.24, f: 0.21, b: 0.31 }, { t: 2, w: 0.19, f: 0.165, b: 0.2 }, { t: 2.6, w: 0.24, f: 0.165, b: 0.185 }, { t: 3, w: 0.28, f: 0.15, b: 0.12, nb: 3 },
      { t: 3.6, w: 0.275, f: 0.115, b: 0.1, nb: 3 }, { t: 4, w: 0.235, f: 0.085, b: 0.085, nb: 3 },
    ],
    bulges: [{ t: 0.45, len: 0.45, around: 78, arc: 70, h: 0.075 }, { t: 1, len: 0.16, around: 0, arc: 60, h: 0.055 }, { t: 1.3, len: 0.3, around: 180, arc: 65, h: 0.065 }, { t: 2, len: 0.14, around: 180, arc: 50, h: 0.045 }],
  })
  const FORE = limbOf({
    joints: [[2.38, 1.5, 0.46], [2.06, 0.86, 0.69], [2.24, 0.33, 0.72], [2.34, 0.12, 0.74], [2.5, 0.08, 0.76]],
    girth: [
      { t: 0, w: 0.33, f: 0.4, b: 0.42 }, { t: 0.5, w: 0.29, f: 0.3, b: 0.36 }, { t: 1, w: 0.235, f: 0.225, b: 0.27 }, { t: 1.3, w: 0.225, f: 0.225, b: 0.235 },
      { t: 2, w: 0.185, f: 0.165, b: 0.175 }, { t: 2.6, w: 0.225, f: 0.15, b: 0.165 }, { t: 3, w: 0.255, f: 0.13, b: 0.11, nb: 3 }, { t: 3.6, w: 0.265, f: 0.105, b: 0.09, nb: 3 }, { t: 4, w: 0.235, f: 0.075, b: 0.075, nb: 3 },
    ],
    bulges: [{ t: 0.4, len: 0.4, around: 62, arc: 70, h: 0.065 }, { t: 1, len: 0.15, around: 180, arc: 55, h: 0.075 }, { t: 1.3, len: 0.3, around: 0, arc: 70, h: 0.04 }],
  })
  /** One hoofed toe: a short stub of toe off the front of the foot and the hoof that caps it, `dz` off the foot's midline, splayed by `yaw`. */
  const toe = (leg: "hind" | "fore", tip: Vec3, i: number, dz: number, yaw: number, r: number): PartSpec[] => {
    const c = Math.cos(yaw), s = Math.sin(yaw)
    const o: Vec3 = [tip[0] - r * 2.2 - Math.abs(dz) * 0.35, tip[1] + r * 0.12, tip[2] + dz]
    return [
      { name: `${leg}Toe${i}`, on: leg, origin: o, mirror: true, path: [[r * 1.3 * c, -r * 0.02, r * 1.3 * s], [r * 2.2 * c, -r * 0.12, r * 2.2 * s]], sect: [{ at: 0, w: r * 1.05, up: r * 1.05, dn: r * 0.95 }, { at: 0.55, w: r * 1.12, up: r * 1.0, dn: r * 0.95 }, { at: 1, w: r * 0.95, up: r * 0.85, dn: r * 0.9 }], rings: 5, sides: 9, cap: "round", fillet: r * 0.5, minDetail: 0.4 },
      { name: `${leg}Hoof${i}`, on: leg, origin: [o[0] + r * 1.9 * c, o[1] - r * 0.1, o[2] + r * 1.9 * s], mirror: true, path: [[r * 0.75 * c, -r * 0.3, r * 0.75 * s], [r * 1.05 * c, -r * 0.75, r * 1.05 * s]], sect: [{ at: 0, w: r * 1.0, up: r * 1.0, dn: r * 0.85, n: 2.5 }, { at: 0.6, w: r * 1.0, up: r * 0.9, dn: r * 0.75, n: 2.6 }, { at: 1, w: r * 0.7, up: r * 0.45, dn: r * 0.4 }], rings: 5, sides: 9, cap: "round", fillet: r * 0.25, mat: MAT.shell, minDetail: 0.4 },
    ]
  }
  const UPF: Vec3 = [0.62, 0.78, 0] // the way the frill's face looks
  const epo = young ? 1.5 : 1
  const spike = (name: string, at: number, around: number): PartSpec => ({ name, on: "frill", at, around, mirror: around !== 0, sink: 0.03, frame: "surface", path: [[0, 0.085 * epo, 0]], sect: [{ at: 0, w: 0.1, up: 0.042 }, { at: 1, w: 0.02, up: 0.014 }], up: UPF, rings: 3, sides: 6, cap: "point", fillet: 0.05, minDetail: 0.4 })
  return {
    name: young ? "triceratopsYoung" : "triceratops",
    body: {
      spine: T.spine, sect: T.sect, rings: 150, sides: 40,
      // four tail frames, the hips, two in the trunk, the shoulders, the neck, the back of the skull, the face
      bones: [0, t(-2.4), t(-1.6), t(-0.8), t(0.05), t(0.9), t(1.6), t(2.35), t(2.95), t(3.5), t(4.2), 1],
      caps: ["point", "point"],
      breath: [t(0.3), t(2.2), 0.028],
      bulges: [
        muscle(t(0.1), 50, 0.075, 0.085, 46, true), // the ilium stands proud of the back
        muscle(t(2.3), 76, 0.1, 0.085, 50, true), // shoulder blade
        muscle(t(1.15), 178, 0.05, 0.11, 60, false), // the gut
        muscle(t(-0.5), 70, 0.055, 0.05, 50, true), // the muscle that pulls the thigh back, on the tail's root
        muscle(t(1.0), 92, 0.03, 0.03, 40, true), muscle(t(1.35), 92, 0.03, 0.03, 40, true), muscle(t(1.7), 92, 0.025, 0.03, 40, true), // ribs under the hide
        muscle(t(3.87), 38, 0.065, 0.02, 24, true), // the boss a brow horn stands on
        muscle(t(3.74), 118, 0.075, 0.028, 30, true), // the cheek flares
        muscle(t(4.22), 100, -0.035, 0.03, 30, true), // and is hollow in front of that
        muscle(t(4.6), 78, -0.045, 0.017, 26, true), // the nostril in its great hollow
        muscle(t(4.5), 0, 0.03, 0.03, 40, false), // the boss under the nose horn
      ],
    },
    parts: [
      // the frill: bone of the skull roof carried up and back over the neck, saddled round it, a ridge down the middle
      {
        name: "frill", origin: [3.68, 2.06, 0], path: [[-0.3 * fr, 0.2 * fr, 0], [-0.58 * fr, 0.43 * fr, 0], [-0.84 * fr, 0.63 * fr, 0], [-1.0 * fr, 0.74 * fr, 0]], up: UPF,
        sect: [{ at: 0, w: 0.5, up: 0.17, dn: 0.2, n: 2.5, bow: 0.95 }, { at: 0.3, w: 0.78 * fw, up: 0.1, dn: 0.11, n: 2.6, bow: 0.62, ridge: [0.03, 0.14] }, { at: 0.62, w: 0.95 * fw, up: 0.07, n: 2.7, bow: 0.46, ridge: [0.035, 0.12] }, { at: 0.88, w: 0.9 * fw, up: 0.055, n: 2.7, bow: 0.36, ridge: [0.02, 0.12] }, { at: 1, w: 0.66 * fw, up: 0.05, n: 2.6, bow: 0.3 }],
        rings: 24, sides: 38, fillet: 0.42, cap: "round",
        bulges: [muscle(0.5, 52, 0.022, 0.3, 22, true)], // the squamosal's swell either side of the midline
      },
      // epoccipitals: five down each side, five across the top (two, one, two)
      ...[0.3, 0.44, 0.58, 0.72, 0.86].map((at, i) => spike("epo" + i, at, 90)),
      spike("epoTop0", 0.985, 0), spike("epoTop1", 0.975, 30), spike("epoTop2", 0.955, 60),
      // brow horns: a metre, from above the eyes, forward and a little out, the tips turned up. Young: short, curving backward
      {
        name: "brow", origin: [3.86, 2.06, 0.26], mirror: true,
        path: young ? [[0.08, 0.16, 0.03], [0.1, 0.32, 0.05], [0.04, 0.46, 0.06], [-0.04, 0.54, 0.06]] : [[0.3, 0.27, 0.05], [0.62, 0.45, 0.1], [0.9, 0.52, 0.13], [1.03, 0.57, 0.13]],
        sect: [{ at: 0, w: 0.135, up: 0.155 }, { at: 0.25, w: 0.1, up: 0.11 }, { at: 0.7, w: 0.052, up: 0.057 }, { at: 1, w: 0.01, up: 0.01 }], rings: 16, sides: 12, cap: "point", fillet: 0.14, mat: MAT.horn,
      },
      { name: "nasal", origin: [4.52, 1.77, 0], path: [[0.05, 0.14, 0], [0.12, 0.27, 0]], sect: [{ at: 0, w: 0.085, up: 0.12 }, { at: 0.5, w: 0.055, up: 0.07 }, { at: 1, w: 0.012, up: 0.014 }], rings: 7, sides: 10, cap: "point", fillet: 0.08, mat: MAT.horn },
      // the cheek horn: down and out, below and behind the eye
      { name: "jugal", origin: [3.72, 1.44, 0.43], mirror: true, path: [[-0.03, -0.14, 0.07], [-0.06, -0.28, 0.1]], sect: [{ at: 0, w: 0.11, up: 0.14 }, { at: 0.6, w: 0.06, up: 0.07 }, { at: 1, w: 0.02, up: 0.02 }], rings: 6, sides: 8, cap: "point", fillet: 0.1 },
      // the lower jaw, deep at the back, ending in its own beak
      {
        name: "jaw", origin: [3.64, 1.36, 0], path: [[0.4, -0.11, 0], [0.82, -0.23, 0], [1.08, -0.3, 0], [1.22, -0.27, 0]], sect: [{ at: 0, w: 0.36, up: 0.14, dn: 0.2, n: 2.4 }, { at: 0.4, w: 0.3, up: 0.11, dn: 0.2, n: 2.4 }, { at: 0.75, w: 0.15, up: 0.08, dn: 0.14 }, { at: 1, w: 0.03, up: 0.04, dn: 0.03 }],
        rings: 12, sides: 14, cap: "point", fillet: 0.1, bones: 1, role: "jaw",
      },
      // the beak: a horn sheath, deep, narrow and hooked
      { name: "beak", origin: [4.64, 1.4, 0], path: [[0.18, -0.07, 0], [0.32, -0.24, 0], [0.35, -0.42, 0]], sect: [{ at: 0, w: 0.165, up: 0.21, dn: 0.16, n: 1.9 }, { at: 0.5, w: 0.1, up: 0.15, dn: 0.1, n: 1.9 }, { at: 1, w: 0.012, up: 0.03, dn: 0.02 }], rings: 9, sides: 12, cap: "point", fillet: 0.04, mat: MAT.horn },
      { name: "eye", origin: [3.98, 1.9, 0.41], mirror: true, path: [[0.01, 0, 0.05]], sect: [{ at: 0, w: young ? 0.05 : 0.046, up: young ? 0.05 : 0.044 }, { at: 1, w: 0.038, up: 0.036 }], rings: 3, sides: 12, cap: "round", fillet: 0.04, mat: MAT.eye, minDetail: 0.4 },
      { name: "hind", ...HIND, mirror: true, up: [1, 0, 0], rings: 40, sides: 20, cap: "round", fillet: 0.24, role: "leg", limits: [0.12, 1.6], toes: true },
      ...toe("hind", [0.52, 0.085, 0.6], 0, -0.2, -0.45, 0.058), ...toe("hind", [0.52, 0.085, 0.6], 1, -0.07, -0.13, 0.066), ...toe("hind", [0.52, 0.085, 0.6], 2, 0.07, 0.13, 0.066), ...toe("hind", [0.52, 0.085, 0.6], 3, 0.2, 0.45, 0.058),
      { name: "fore", ...FORE, mirror: true, up: [1, 0, 0], rings: 36, sides: 18, cap: "round", fillet: 0.2, role: "leg", limits: [0.14, 1.7], toes: true },
      ...toe("fore", [2.5, 0.08, 0.76], 0, -0.13, -0.15, 0.058), ...toe("fore", [2.5, 0.08, 0.76], 1, 0.02, 0.2, 0.062), ...toe("fore", [2.5, 0.08, 0.76], 2, 0.16, 0.55, 0.054),
    ],
    // a slow amble, three feet down most of the time; each girdle sinks as a foot takes the load, the gut swings late
    gait: {
      gait: "amble", stride: 1.85, duty: 0.73, lift: 0.16, bob: 0.018, shift: 0.07, roll: 0.02, girdle: 0.055, pitch: 0.05,
      tail: [0.38, 0.34], head: [0.08, 0.14], tailAt: t(0), neckAt: t(2.7), drop: 0.048, dropRoll: 0.022, belly: [0.05, 0.12], tailBob: 2.2,
    },
    motions: [{ role: "jaw", axis: "side", bias: 0.3, channel: "jaw" }],
    // head down to feed, head up to look: turns of the neck and the skull's frames (pitch positive is nose down)
    poses: {
      graze: { body: [[0], [0], [0], [0], [0], [0], [0.02], [0.07], [0.16], [0.12], [0.04]] },
      // the head comes up from the root of the neck, and the skull counter-turns so the face stays level: it rises, it does not tip
      alert: { body: [[0], [0], [0], [0], [0], [-0.02], [-0.07], [-0.2], [-0.22], [0.13], [0.08]] },
    },
  }
}
const TRIC_LOOK: Look = {
  base: 0x5d5245, back: 0x2c2823, belly: 0x9c8e76, accent: 0x40291c, horn: 0x8a7c66, hornTip: 0x211b16, shell: 0x2b241e, eye: 0x9a5a18,
  cell: 0.05, relief: 0.01, cellVary: 0.1, feature: 2.4, blotch: 0.34, blotchSize: 1.1, mottle: 0.34,
  fold: 0.4, foldSize: 0.16, foldFlex: 3, dust: 0x84725a, dustTo: 0.9, dustAmt: 0.36, occlude: 0.75, selfShadow: 0.7, rough: 0.8, spec: 0.14, wrap: 0.32, rim: 0.3,
  // the frill is for show: a rust field on each side with a dark eye in it, and a dark mask from the eye to the beak
  paints: [
    { at: [3.05, 2.52, 0.45], r: [0.34, 0.36, 0.3], color: 0x6a4630, amt: 0.4, mirror: true, edge: 0.5, rag: 0.4, ragSize: 0.12, vary: 0.3 },
    { at: [3.04, 2.54, 0.46], r: [0.13, 0.14, 0.2], color: 0x221a15, amt: 0.5, mirror: true, edge: 0.4, rag: 0.3, ragSize: 0.06 },
    { at: [4.3, 1.62, 0.3], r: [0.42, 0.13, 0.2], color: 0x2a211b, amt: 0.5, mirror: true, edge: 0.6, rag: 0.5, ragSize: 0.1 },
  ],
}
const CERATOPSIAN = triceratops(false)
const CERATOPSIAN_LOOK = TRIC_LOOK
const TRIC_YOUNG = triceratops(true)

/** Toes off the front of a foot: each a short stub with a hoof (blunt, `MAT.shell`) or a claw (hooked, `MAT.horn`) on it. `list`: [sideways offset, splay, radius, length in radii]. */
function toesOf(leg: string, tip: Vec3, list: [number, number, number, number][], claw: boolean): PartSpec[] {
  const out: PartSpec[] = []
  list.forEach(([dz, yaw, r, L], i) => {
    const c = Math.cos(yaw), s = Math.sin(yaw)
    const o: Vec3 = [tip[0] - r * L - Math.abs(dz) * 0.35, tip[1] + r * 0.15, tip[2] + dz]
    out.push({ name: `${leg}Toe${i}`, on: leg, origin: o, mirror: true, path: [[r * L * 0.55 * c, -r * 0.02, r * L * 0.55 * s], [r * L * c, -r * 0.14, r * L * s]], sect: [{ at: 0, w: r * 1.05, up: r * 1.05, dn: r * 0.95 }, { at: 0.55, w: r * 1.1, up: r, dn: r * 0.95 }, { at: 1, w: r * 0.92, up: r * 0.85, dn: r * 0.9 }], rings: 5, sides: 9, cap: "round", fillet: r * 0.5, minDetail: 0.4 })
    out.push(
      claw
        ? { name: `${leg}Claw${i}`, on: leg, origin: [o[0] + r * L * 0.85 * c, o[1], o[2] + r * L * 0.85 * s], mirror: true, path: [[r * 0.9 * c, r * 0.1, r * 0.9 * s], [r * 1.9 * c, -r * 0.5, r * 1.9 * s]], sect: [{ at: 0, w: r * 0.6, up: r * 0.8 }, { at: 0.5, w: r * 0.4, up: r * 0.55 }, { at: 1, w: r * 0.05, up: r * 0.07 }], rings: 6, sides: 8, cap: "point", fillet: r * 0.2, mat: MAT.horn, minDetail: 0.4 }
        : { name: `${leg}Hoof${i}`, on: leg, origin: [o[0] + r * L * 0.86 * c, o[1] - r * 0.1, o[2] + r * L * 0.86 * s], mirror: true, path: [[r * 0.75 * c, -r * 0.3, r * 0.75 * s], [r * 1.05 * c, -r * 0.75, r * 1.05 * s]], sect: [{ at: 0, w: r, up: r, dn: r * 0.85, n: 2.5 }, { at: 0.6, w: r, up: r * 0.9, dn: r * 0.75, n: 2.6 }, { at: 1, w: r * 0.7, up: r * 0.45, dn: r * 0.4 }], rings: 5, sides: 9, cap: "round", fillet: r * 0.25, mat: MAT.shell, minDetail: 0.4 },
    )
  })
  return out
}
const eyeOf = (origin: Vec3, r: number): PartSpec => ({ name: "eye", origin, mirror: true, path: [[0.01, 0, r * 1.3]], sect: [{ at: 0, w: r, up: r }, { at: 1, w: r * 0.82, up: r * 0.82 }], rings: 3, sides: 12, cap: "round", fillet: r, mat: MAT.eye, minDetail: 0.4 })

// ---- Edmontosaurus annectens, 11.1 m here (they reached about 12). The back highest over the hips at 3 m and sloping to
// the shoulders; a long, low, flat skull that ends in a broad bill; a deep, narrow tail held straight out; slender fore
// limbs that touch the ground only with their hooves; three hoofed hind toes; a fleshy crest over the neck and trunk and a
// row of spikes down the tail (the Wyoming mummies). `rearing`: the same animal built to stand up: its fore limbs are
// arms, not legs, so it can lift them, and it carries the pose that takes it from four legs to two.
function edmontosaurus(rearing: boolean): CreatureSpec {
  const D = loft([
    { x: -6.2, top: 1.95, bot: 1.9, hw: 0.015 },
    { x: -5.0, top: 2.22, bot: 1.86, hw: 0.045, n: 1.7 },
    { x: -3.6, top: 2.5, bot: 1.78, hw: 0.09, n: 1.7, nb: 1.8 },
    { x: -2.2, top: 2.78, bot: 1.7, hw: 0.16, n: 1.7, nb: 1.8 }, // the tail: deep and narrow
    { x: -1.0, top: 2.97, bot: 1.58, hw: 0.3, n: 1.8, nb: 1.9 },
    { x: 0, top: 3.04, bot: 1.36, hw: 0.52, mid: 0.56, ridge: [0.1, 0.05], n: 2, nb: 2.3 }, // hips
    { x: 0.8, top: 2.99, bot: 1.16, hw: 0.62, mid: 0.48, ridge: [0.12, 0.05], n: 2.1, nb: 2.6 },
    { x: 1.6, top: 2.84, bot: 1.1, hw: 0.6, mid: 0.46, ridge: [0.13, 0.05], n: 2.1, nb: 2.6 }, // the gut
    { x: 2.3, top: 2.6, bot: 1.2, hw: 0.45, ridge: [0.14, 0.05], n: 2.1, nb: 2.3 }, // shoulders
    { x: 2.9, top: 2.44, bot: 1.44, hw: 0.34, ridge: [0.15, 0.045] },
    { x: 3.4, top: 2.34, bot: 1.62, hw: 0.26, ridge: [0.13, 0.04] }, // the neck
    { x: 3.75, top: 2.22, bot: 1.68, hw: 0.22, ridge: [0.06, 0.035], n: 2.4 }, // the back of the skull
    { x: 4.1, top: 2.14, bot: 1.62, hw: 0.24, n: 2.6 }, // across the orbits
    { x: 4.45, top: 1.98, bot: 1.56, hw: 0.22, n: 2.5 },
    { x: 4.75, top: 1.8, bot: 1.5, hw: 0.25, n: 2.8 }, // the bill spreads
    { x: 4.95, top: 1.66, bot: 1.47, hw: 0.24, n: 2.8 },
    { x: 5.05, top: 1.58, bot: 1.48, hw: 0.12, n: 2.4 },
  ])
  const t = D.at
  const HIND = limbOf({
    joints: [[0, 2.3, 0.42], [0.55, 1.35, 0.5], [0.05, 0.6, 0.5], [0.3, 0.12, 0.5], [0.62, 0.07, 0.5]],
    girth: [
      { t: 0, w: 0.34, f: 0.5, b: 0.56 }, { t: 0.4, w: 0.33, f: 0.44, b: 0.5 }, { t: 0.85, w: 0.25, f: 0.3, b: 0.3 }, { t: 1, w: 0.2, f: 0.25, b: 0.2 }, { t: 1.3, w: 0.19, f: 0.18, b: 0.27 },
      { t: 2, w: 0.13, f: 0.12, b: 0.15 }, { t: 2.6, w: 0.15, f: 0.12, b: 0.13 }, { t: 3, w: 0.21, f: 0.13, b: 0.1, nb: 3 }, { t: 3.6, w: 0.22, f: 0.1, b: 0.085, nb: 3 }, { t: 4, w: 0.17, f: 0.07, b: 0.07, nb: 3 },
    ],
    bulges: [{ t: 0.45, len: 0.45, around: 78, arc: 70, h: 0.06 }, { t: 1, len: 0.15, around: 0, arc: 60, h: 0.045 }, { t: 1.3, len: 0.3, around: 180, arc: 65, h: 0.06 }, { t: 2, len: 0.12, around: 180, arc: 50, h: 0.035 }],
  })
  const FORE = limbOf({
    joints: [[2.25, 1.75, 0.36], [2.05, 1.1, 0.42], [2.25, 0.42, 0.42], [2.3, 0.1, 0.42], [2.42, 0.05, 0.42]],
    girth: [
      { t: 0, w: 0.2, f: 0.26, b: 0.3 }, { t: 0.5, w: 0.16, f: 0.17, b: 0.2 }, { t: 1, w: 0.12, f: 0.12, b: 0.15 }, { t: 1.4, w: 0.11, f: 0.11, b: 0.11 }, { t: 2, w: 0.085, f: 0.08, b: 0.085 },
      { t: 2.6, w: 0.08, f: 0.07, b: 0.075 }, { t: 3, w: 0.1, f: 0.07, b: 0.06, nb: 3 }, { t: 3.6, w: 0.1, f: 0.06, b: 0.055, nb: 3 }, { t: 4, w: 0.08, f: 0.05, b: 0.05, nb: 3 },
    ],
    bulges: [{ t: 0.4, len: 0.4, around: 62, arc: 70, h: 0.04 }, { t: 1, len: 0.14, around: 180, arc: 55, h: 0.04 }],
  })
  const NB = 13
  const bones = [0, t(-4.8), t(-3.4), t(-2.0), t(-0.9), t(0), t(0.8), t(1.6), t(2.3), t(2.9), t(3.4), t(3.8), 1]
  const zero = (): [number][] => Array.from({ length: NB - 1 }, () => [0])
  const pose = (m: Record<number, number>): [number][] => zero().map((v, i) => [m[i] ?? 0])
  return {
    name: rearing ? "edmontosaurusRearing" : "edmontosaurus",
    body: {
      spine: D.spine, sect: D.sect, rings: 150, sides: 36, bones, caps: ["point", "round"], breath: [t(0.3), t(2.1), 0.024],
      bulges: [
        muscle(t(0.05), 48, 0.06, 0.06, 46, true), // the ilium
        muscle(t(2.2), 78, 0.07, 0.06, 50, true), // shoulder blade
        muscle(t(-0.7), 72, 0.06, 0.05, 50, true), // the thigh's retractor on the tail's root
        muscle(t(1.2), 178, 0.05, 0.09, 60, false), // gut
        muscle(t(0.9), 92, 0.025, 0.02, 40, true), muscle(t(1.25), 92, 0.025, 0.02, 40, true), muscle(t(1.6), 92, 0.022, 0.02, 40, true), // ribs
        muscle(t(4.1), 55, 0.02, 0.012, 22, true), // brow
        muscle(t(4.0), 110, 0.03, 0.02, 30, true), // cheek
        muscle(t(4.55), 62, -0.03, 0.02, 30, true), // the long hollow round the nostril
      ],
    },
    parts: [
      // the spikes down the tail, behind the crest
      ...Array.from({ length: 14 }, (_, i): PartSpec => ({ name: "spike" + i, at: t(-0.6 - i * 0.38), around: 0, sink: 0.02, frame: "surface", path: [[0.02, 0.1 - i * 0.004, 0]], up: [1, 0, 0], sect: [{ at: 0, w: 0.035, up: 0.09 }, { at: 1, w: 0.012, up: 0.03 }], rings: 3, sides: 6, cap: "round", fillet: 0.03, minDetail: 0.4 })),
      // the lower jaw and the bill's lower half
      { name: "jaw", origin: [3.86, 1.72, 0], path: [[0.3, -0.07, 0], [0.62, -0.13, 0], [0.86, -0.17, 0], [1.02, -0.17, 0]], sect: [{ at: 0, w: 0.18, up: 0.09, dn: 0.13, n: 2.4 }, { at: 0.45, w: 0.17, up: 0.07, dn: 0.12, n: 2.4 }, { at: 0.8, w: 0.19, up: 0.05, dn: 0.07, n: 2.7 }, { at: 1, w: 0.15, up: 0.035, dn: 0.04, n: 2.6 }], rings: 12, sides: 14, cap: "round", fillet: 0.08, bones: 1, role: "jaw" },
      // the bill's horn rim
      { name: "bill", origin: [4.84, 1.62, 0], path: [[0.14, -0.04, 0], [0.24, -0.12, 0]], sect: [{ at: 0, w: 0.225, up: 0.1, dn: 0.07, n: 2.8 }, { at: 0.6, w: 0.21, up: 0.07, dn: 0.05, n: 2.8 }, { at: 1, w: 0.12, up: 0.03, dn: 0.03 }], rings: 6, sides: 14, cap: "round", fillet: 0.03, mat: MAT.horn },
      eyeOf([4.1, 2.02, 0.21], 0.036),
      { name: "hind", ...HIND, mirror: true, up: [1, 0, 0], rings: 40, sides: 18, cap: "round", fillet: 0.22, role: "leg", limits: [0.12, 1.7], toes: true },
      ...toesOf("hind", [0.62, 0.07, 0.5], [[-0.15, -0.4, 0.06, 2.6], [0, 0, 0.07, 3], [0.15, 0.4, 0.06, 2.6]], false),
      { name: "fore", ...FORE, mirror: true, up: [1, 0, 0], rings: 34, sides: 14, cap: "round", fillet: 0.14, ...(rearing ? { role: "arm" } : { role: "leg", limits: [0.1, 1.8] as [number, number], toes: true }) },
      ...toesOf("fore", [2.42, 0.05, 0.42], [[-0.04, -0.15, 0.032, 2], [0.04, 0.2, 0.032, 2]], false),
    ],
    gait: rearing
      ? { gait: "biped", stride: 2.6, duty: 0.7, lift: 0.2, bob: 0.02, shift: 0.05, tail: [0.3, 0.3], head: [0.05, 0.1], tailAt: t(-0.3), neckAt: t(2.6) }
      : { gait: "walk", stride: 2.5, duty: 0.7, lift: 0.2, bob: 0.02, shift: 0.06, roll: 0.018, girdle: 0.05, pitch: 0.04, tail: [0.45, 0.32], head: [0.07, 0.14], tailAt: t(-0.3), neckAt: t(2.6), drop: 0.04, dropRoll: 0.02, belly: [0.04, 0.12], tailBob: 2 },
    motions: [{ role: "jaw", axis: "side", bias: 0.28, channel: "jaw" }],
    // frames: 0-4 tail, 5 hips, 6-7 trunk, 8 shoulders, 9-10 neck, 11 skull (pitch positive is nose down)
    poses: {
      graze: { body: pose({ 8: 0.1, 9: 0.2, 10: 0.2, 11: 0.1 }) },
      alert: { body: pose({ 8: -0.06, 9: -0.2, 10: -0.22, 11: 0.12 }) },
      ...(rearing
        ? {
            // up on two legs to reach a branch: the trunk swings up about the hips, the neck carries the head on up, the arms fold
            rear: { body: pose({ 5: -0.42, 6: -0.1, 7: -0.06, 9: -0.1, 10: 0.18, 11: 0.3 }), fore: [[-0.5], [0.9], [0.5]] },
          }
        : {}),
    },
  }
}
const EDMO_LOOK: Look = {
  base: 0x5a5440, back: 0x2b2a20, belly: 0xa59a7c, accent: 0x33301f, horn: 0x3b352b, hornTip: 0x1d1a15, shell: 0x2a251f, eye: 0x7a4a12,
  cell: 0.03, relief: 0.004, cellVary: 0.15, blotch: 0.5, blotchSize: 1.3, stripes: 0.55, mottle: 0.4,
  fold: 0.3, foldSize: 0.3, foldFlex: 3, dust: 0x7d705a, dustTo: 1.0, dustAmt: 0.4, occlude: 0.75, selfShadow: 0.7, rough: 0.75, spec: 0.16, wrap: 0.34, rim: 0.3,
}

// ---- Tyrannosaurus rex, 12.2 m, the hips 3.95 m up: the back level, the tail straight out behind as the counterweight, a
// skull a metre and a half long on an S of neck, arms that hardly count, two fingers each; three toes that carry it.
function tyrannosaurus(): CreatureSpec {
  const Y = loft([
    { x: -6.45, top: 2.98, bot: 2.93, hw: 0.02 },
    { x: -5.0, top: 3.16, bot: 2.8, hw: 0.1, n: 1.9 },
    { x: -3.4, top: 3.4, bot: 2.64, hw: 0.2, n: 1.9 },
    { x: -1.8, top: 3.66, bot: 2.44, hw: 0.35, ridge: [0.03, 0.08], n: 1.9 },
    { x: -0.6, top: 3.86, bot: 2.2, hw: 0.52, ridge: [0.04, 0.1], n: 2 },
    { x: 0, top: 3.95, bot: 2.0, hw: 0.64, mid: 0.56, ridge: [0.04, 0.1], n: 2.1, nb: 2.2 }, // hips
    { x: 1.0, top: 3.9, bot: 1.9, hw: 0.74, mid: 0.48, ridge: [0.035, 0.1], n: 2.1, nb: 2.5 }, // the gut, between the knees
    { x: 2.0, top: 3.82, bot: 1.98, hw: 0.72, mid: 0.48, ridge: [0.03, 0.1], n: 2.1, nb: 2.5 }, // the chest: deep and barrelled
    { x: 2.8, top: 3.8, bot: 2.32, hw: 0.52, n: 2.1 }, // shoulders
    { x: 3.4, top: 3.94, bot: 2.9, hw: 0.37 }, // the neck's S, rising
    { x: 3.9, top: 4.17, bot: 3.3, hw: 0.34 },
    { x: 4.25, top: 4.27, bot: 3.4, hw: 0.41, n: 2.6 }, // the back of the skull: wide, for the jaw muscles
    { x: 4.6, top: 4.23, bot: 3.39, hw: 0.37, n: 2.6 }, // across the orbits
    { x: 5.0, top: 4.11, bot: 3.41, hw: 0.27, n: 2.4 },
    { x: 5.4, top: 4.0, bot: 3.44, hw: 0.22, n: 2.4 },
    { x: 5.68, top: 3.88, bot: 3.5, hw: 0.17, n: 2.3 },
    { x: 5.78, top: 3.74, bot: 3.53, hw: 0.08, n: 2 },
  ])
  const t = Y.at
  const LEG = limbOf({
    joints: [[0, 2.95, 0.5], [0.75, 1.95, 0.58], [0, 0.85, 0.56], [0.35, 0.14, 0.56], [0.95, 0.07, 0.56]],
    girth: [
      { t: 0, w: 0.42, f: 0.62, b: 0.7 }, { t: 0.4, w: 0.42, f: 0.56, b: 0.62 }, { t: 0.85, w: 0.32, f: 0.36, b: 0.38 }, { t: 1, w: 0.26, f: 0.3, b: 0.25 }, { t: 1.3, w: 0.26, f: 0.22, b: 0.38 },
      { t: 1.7, w: 0.19, f: 0.17, b: 0.24 }, { t: 2, w: 0.15, f: 0.14, b: 0.17 }, { t: 2.5, w: 0.14, f: 0.12, b: 0.13 }, { t: 3, w: 0.24, f: 0.14, b: 0.11, nb: 3 }, { t: 3.5, w: 0.25, f: 0.1, b: 0.09, nb: 3 }, { t: 4, w: 0.16, f: 0.07, b: 0.07, nb: 3 },
    ],
    bulges: [{ t: 0.45, len: 0.45, around: 78, arc: 70, h: 0.09 }, { t: 1, len: 0.15, around: 0, arc: 60, h: 0.06 }, { t: 1.3, len: 0.32, around: 180, arc: 65, h: 0.09 }, { t: 2, len: 0.12, around: 180, arc: 50, h: 0.04 }],
  })
  const finger = (i: number, dz: number): PartSpec => ({ name: "finger" + i, on: "arm", origin: [3.3, 2.2, 0.5 + dz], mirror: true, path: [[0.1, -0.08, 0], [0.16, -0.2, 0]], sect: [{ at: 0, w: 0.035, up: 0.04 }, { at: 0.6, w: 0.025, up: 0.03 }, { at: 1, w: 0.006, up: 0.008 }], rings: 5, sides: 6, cap: "point", fillet: 0.02, mat: MAT.horn, minDetail: 0.4 })
  return {
    name: "tyrannosaurus",
    body: {
      spine: Y.spine, sect: Y.sect, rings: 150, sides: 36, bones: [0, t(-4.9), t(-3.5), t(-2.2), t(-1.0), t(0), t(1.0), t(2.0), t(2.8), t(3.4), t(3.9), t(4.3), 1], caps: ["point", "round"], breath: [t(0.4), t(2.5), 0.022],
      bulges: [
        muscle(t(0.05), 46, 0.07, 0.05, 44, true), // the ilium's blade
        muscle(t(-0.9), 74, 0.09, 0.07, 52, true), // the great retractor of the thigh, filling out the tail's root
        muscle(t(2.7), 80, 0.06, 0.04, 44, true), // shoulder
        muscle(t(1.6), 178, 0.05, 0.08, 60, false), // the belly ribs
        muscle(t(4.62), 30, 0.055, 0.012, 20, true), // the horn boss over each eye
        muscle(t(4.3), 60, 0.05, 0.02, 34, true), // the jaw muscles bulge behind it
        muscle(t(5.2), 14, 0.025, 0.03, 16, true), // the rough ridge along the nose
        muscle(t(4.85), 100, -0.03, 0.02, 30, true), // the hollow in front of the eye
      ],
    },
    parts: [
      // the lower jaw: deep, and bowed out at the back
      { name: "jaw", origin: [4.3, 3.42, 0], path: [[0.4, -0.12, 0], [0.82, -0.16, 0], [1.2, -0.14, 0], [1.43, -0.08, 0]], sect: [{ at: 0, w: 0.38, up: 0.12, dn: 0.2, n: 2.4 }, { at: 0.4, w: 0.3, up: 0.1, dn: 0.17, n: 2.4 }, { at: 0.8, w: 0.2, up: 0.07, dn: 0.12 }, { at: 1, w: 0.1, up: 0.05, dn: 0.07 }], rings: 14, sides: 14, cap: "round", fillet: 0.1, bones: 1, role: "jaw" },
      eyeOf([4.6, 3.98, 0.345], 0.042),
      // the arm: short, the elbow bent, two clawed fingers
      { name: "arm", origin: [2.95, 2.7, 0.44], mirror: true, jointed: true, path: [[0.1, -0.36, 0.06], [0.36, -0.52, 0.06]], up: [1, 0, 0], sect: [{ at: 0, w: 0.11, up: 0.13 }, { at: 0.5, w: 0.075, up: 0.085 }, { at: 0.8, w: 0.06, up: 0.065 }, { at: 1, w: 0.05, up: 0.045 }], rings: 12, sides: 10, cap: "round", fillet: 0.1, bones: 0 },
      finger(0, -0.035), finger(1, 0.035),
      // the teeth: thick, banana-shaped, eleven a side along the upper jaw (only the nearer levels carry them)
      ...Array.from({ length: 11 }, (_, i): PartSpec => {
        const x = 4.62 + i * 0.1, hw = 0.33 - i * 0.017
        return { name: "tooth" + i, origin: [x, 3.43, hw - 0.04], mirror: true, path: [[0.012, -0.06 - 0.03 * Math.sin((i / 10) * 3), 0]], sect: [{ at: 0, w: 0.016, up: 0.022 }, { at: 1, w: 0.002, up: 0.003 }], rings: 3, sides: 6, cap: "point", fillet: 0, mat: MAT.shell, minDetail: 0.4 }
      }),
      { name: "leg", ...LEG, mirror: true, up: [1, 0, 0], rings: 46, sides: 20, cap: "round", fillet: 0.3, role: "leg", limits: [0.25, 1.9], toes: true },
      ...toesOf("leg", [0.95, 0.07, 0.56], [[-0.2, -0.42, 0.075, 3.4], [0, 0, 0.085, 4], [0.2, 0.42, 0.075, 3.4]], true),
    ],
    // a slow heavy walk: long steps, the hips falling onto each foot, the tail swinging against them, the head nodding
    gait: { gait: "biped", stride: 3.9, duty: 0.64, lift: 0.4, bob: 0.045, shift: 0.1, roll: 0.03, girdle: 0.08, pitch: 0.035, tail: [0.6, 0.3], head: [0.1, 0.12], tailAt: t(-0.3), neckAt: t(3.0), drop: 0.07, dropRoll: 0.03, belly: [0.03, 0.1], tailBob: 1.6 },
    motions: [{ role: "jaw", axis: "side", bias: 0.3, channel: "jaw" }],
    poses: { alert: { body: [[0], [0], [0], [0], [0], [0], [0], [0], [-0.04], [-0.1], [-0.08], [0.1]] } },
  }
}
const TYRANT_LOOK: Look = {
  base: 0x4a3f33, back: 0x221d18, belly: 0x94866c, accent: 0x271d15, horn: 0x2b2620, hornTip: 0x14110e, shell: 0xb9ab8a, eye: 0x9a6418,
  cell: 0.035, relief: 0.008, cellVary: 0.2, blotch: 0.45, blotchSize: 1.8, stripes: 0.35, mottle: 0.35,
  fold: 0.3, foldSize: 0.3, foldFlex: 3, dust: 0x70634f, dustTo: 1.2, dustAmt: 0.3, occlude: 0.75, selfShadow: 0.7, rough: 0.78, spec: 0.14, wrap: 0.3, rim: 0.3,
}

// ---- Ankylosaurus magniventris, 7 m, the hips 1.7 m: twice as wide as it is deep, flat-backed; keeled plates in rows across
// the back (their true placement is unknown: they were never found in place); two horns back from the skull and two down
// and back from the cheeks; the tail's end a stiff handle carrying a club, held clear of the ground; hind limbs the longer.
function ankylosaurus(): CreatureSpec {
  const K = loft([
    { x: -3.6, top: 0.9, bot: 0.78, hw: 0.08, n: 2.4 },
    { x: -3.46, top: 0.94, bot: 0.75, hw: 0.245, n: 2.6 }, // the club: half a metre across, a hand deep
    { x: -3.2, top: 0.93, bot: 0.76, hw: 0.22, n: 2.6 },
    { x: -3.0, top: 0.9, bot: 0.79, hw: 0.075 }, // the handle
    { x: -2.2, top: 0.99, bot: 0.74, hw: 0.1 },
    { x: -1.4, top: 1.2, bot: 0.7, hw: 0.18 },
    { x: -0.7, top: 1.5, bot: 0.64, hw: 0.44, n: 2.4 },
    { x: 0, top: 1.72, bot: 0.56, hw: 0.9, mid: 0.5, n: 2.7, nb: 2.2 }, // hips
    { x: 0.8, top: 1.75, bot: 0.46, hw: 1.05, mid: 0.45, n: 2.9, nb: 2.3 }, // the broadest: over two metres
    { x: 1.6, top: 1.62, bot: 0.46, hw: 0.95, mid: 0.45, n: 2.8, nb: 2.3 },
    { x: 2.2, top: 1.45, bot: 0.56, hw: 0.7, n: 2.6 }, // shoulders
    { x: 2.6, top: 1.3, bot: 0.7, hw: 0.42, n: 2.4 },
    { x: 2.85, top: 1.28, bot: 0.74, hw: 0.37, n: 2.8 }, // the back of the skull: wider than the skull is long
    { x: 3.1, top: 1.22, bot: 0.73, hw: 0.33, n: 2.7 },
    { x: 3.3, top: 1.1, bot: 0.75, hw: 0.25, n: 2.5 },
    { x: 3.43, top: 0.98, bot: 0.77, hw: 0.15, n: 2.3 },
  ])
  const t = K.at
  const HIND = limbOf({
    joints: [[0, 1.05, 0.55], [0.3, 0.6, 0.68], [0, 0.25, 0.68], [0.14, 0.085, 0.68], [0.32, 0.05, 0.68]],
    girth: [{ t: 0, w: 0.3, f: 0.34, b: 0.38 }, { t: 0.5, w: 0.27, f: 0.28, b: 0.32 }, { t: 1, w: 0.2, f: 0.21, b: 0.19 }, { t: 1.4, w: 0.18, f: 0.16, b: 0.21 }, { t: 2, w: 0.15, f: 0.13, b: 0.15 }, { t: 2.6, w: 0.18, f: 0.12, b: 0.13 }, { t: 3, w: 0.2, f: 0.1, b: 0.085, nb: 3 }, { t: 3.6, w: 0.2, f: 0.08, b: 0.07, nb: 3 }, { t: 4, w: 0.17, f: 0.055, b: 0.055, nb: 3 }],
    bulges: [{ t: 0.45, len: 0.4, around: 80, arc: 70, h: 0.04 }, { t: 1, len: 0.16, around: 0, arc: 60, h: 0.035 }, { t: 1.35, len: 0.3, around: 180, arc: 60, h: 0.035 }],
  })
  const FORE = limbOf({
    joints: [[2.1, 0.9, 0.5], [1.9, 0.52, 0.66], [2.05, 0.2, 0.66], [2.12, 0.075, 0.66], [2.27, 0.045, 0.66]],
    girth: [{ t: 0, w: 0.26, f: 0.3, b: 0.32 }, { t: 0.5, w: 0.23, f: 0.24, b: 0.27 }, { t: 1, w: 0.18, f: 0.18, b: 0.21 }, { t: 1.5, w: 0.16, f: 0.15, b: 0.16 }, { t: 2, w: 0.14, f: 0.12, b: 0.13 }, { t: 2.6, w: 0.17, f: 0.11, b: 0.12 }, { t: 3, w: 0.19, f: 0.09, b: 0.08, nb: 3 }, { t: 3.6, w: 0.19, f: 0.075, b: 0.065, nb: 3 }, { t: 4, w: 0.16, f: 0.05, b: 0.05, nb: 3 }],
    bulges: [{ t: 0.4, len: 0.4, around: 64, arc: 70, h: 0.04 }, { t: 1, len: 0.15, around: 180, arc: 55, h: 0.05 }],
  })
  // the armour: keeled plates in rows across the back, bigger toward the flank; two half-rings of larger ones over the neck
  const plates: PartSpec[] = []
  const rowsAt = [-1.1, -0.55, 0, 0.45, 0.9, 1.35, 1.8, 2.2]
  rowsAt.forEach((x, r) => {
    ;[13, 38, 62, 82].forEach((around, c) => {
      const s = (0.085 + 0.022 * c) * (r === 0 ? 0.6 : r === 1 ? 0.8 : 1)
      plates.push({ name: `pl${r}_${c}`, at: t(x + (c % 2) * 0.2), around, mirror: true, sink: 0.03, frame: "surface", path: [[0.02, s * 0.62, 0]], up: [1, 0, 0], sect: [{ at: 0, w: s * 0.8, up: s * 1.35, n: 2.3 }, { at: 0.55, w: s * 0.4, up: s * 0.9 }, { at: 1, w: s * 0.06, up: s * 0.3 }], rings: 4, sides: 8, cap: "round", fillet: s * 0.5, mat: MAT.horn, minDetail: c === 3 ? 0.1 : 0.4 })
    })
  })
  ;[2.5, 2.72].forEach((x, r) => [18, 52, 84].forEach((around, c) => plates.push({ name: `nk${r}_${c}`, at: t(x), around, mirror: true, sink: 0.03, frame: "surface", path: [[0.01, 0.075, 0]], up: [1, 0, 0], sect: [{ at: 0, w: 0.085, up: 0.14, n: 2.3 }, { at: 0.6, w: 0.04, up: 0.09 }, { at: 1, w: 0.008, up: 0.03 }], rings: 4, sides: 8, cap: "round", fillet: 0.05, mat: MAT.horn, minDetail: 0.4 })))
  ;[-1.7, -2.2, -2.65].forEach((x, r) => plates.push({ name: "tl" + r, at: t(x), around: 62, mirror: true, sink: 0.02, frame: "surface", path: [[0.01, 0.05, 0]], up: [1, 0, 0], sect: [{ at: 0, w: 0.05, up: 0.08 }, { at: 1, w: 0.008, up: 0.02 }], rings: 3, sides: 6, cap: "round", fillet: 0.03, mat: MAT.horn, minDetail: 0.4 }))
  const hornOf = (name: string, origin: Vec3, path: Vec3[], r: number): PartSpec => ({ name, origin, mirror: true, path, sect: [{ at: 0, w: r, up: r * 1.1 }, { at: 0.5, w: r * 0.62, up: r * 0.66 }, { at: 1, w: r * 0.1, up: r * 0.1 }], rings: 8, sides: 9, cap: "point", fillet: r, mat: MAT.horn })
  return {
    name: "ankylosaurus",
    body: {
      spine: K.spine, sect: K.sect, rings: 130, sides: 40, bones: [0, t(-3.0), t(-2.2), t(-1.4), t(-0.7), t(0), t(0.8), t(1.6), t(2.2), t(2.6), t(2.95), 1], caps: ["round", "round"], breath: [t(0.2), t(1.9), 0.02],
      bulges: [muscle(t(0.05), 60, 0.04, 0.05, 30, true), muscle(t(2.1), 70, 0.04, 0.05, 30, true), muscle(t(3.12), 40, 0.03, 0.02, 24, true), muscle(t(3.3), 80, -0.02, 0.012, 20, true)],
    },
    parts: [
      ...plates,
      hornOf("hornBack", [2.9, 1.2, 0.3], [[-0.1, 0.06, 0.06], [-0.2, 0.1, 0.12]], 0.07),
      hornOf("hornCheek", [2.95, 0.86, 0.33], [[-0.08, -0.06, 0.07], [-0.17, -0.13, 0.12]], 0.065),
      { name: "jaw", origin: [2.9, 0.78, 0], path: [[0.2, -0.04, 0], [0.4, -0.06, 0], [0.5, -0.04, 0]], sect: [{ at: 0, w: 0.3, up: 0.06, dn: 0.1, n: 2.5 }, { at: 0.6, w: 0.23, up: 0.05, dn: 0.08, n: 2.5 }, { at: 1, w: 0.12, up: 0.03, dn: 0.04 }], rings: 8, sides: 12, cap: "round", fillet: 0.06, bones: 1, role: "jaw" },
      { name: "beak", origin: [3.3, 0.9, 0], path: [[0.09, -0.03, 0], [0.15, -0.1, 0]], sect: [{ at: 0, w: 0.2, up: 0.09, dn: 0.07, n: 2.6 }, { at: 0.6, w: 0.17, up: 0.06, dn: 0.05, n: 2.6 }, { at: 1, w: 0.09, up: 0.025, dn: 0.025 }], rings: 5, sides: 12, cap: "round", fillet: 0.03, mat: MAT.horn },
      eyeOf([3.12, 1.06, 0.3], 0.026),
      { name: "hind", ...HIND, mirror: true, up: [1, 0, 0], rings: 30, sides: 16, cap: "round", fillet: 0.18, role: "leg", limits: [0.15, 1.7], toes: true },
      ...toesOf("hind", [0.32, 0.05, 0.68], [[-0.11, -0.4, 0.04, 2], [0, 0, 0.045, 2.2], [0.11, 0.4, 0.04, 2]], false),
      { name: "fore", ...FORE, mirror: true, up: [1, 0, 0], rings: 28, sides: 16, cap: "round", fillet: 0.16, role: "leg", limits: [0.15, 1.8], toes: true },
      ...toesOf("fore", [2.27, 0.045, 0.66], [[-0.12, -0.5, 0.036, 2], [-0.04, -0.15, 0.04, 2.2], [0.04, 0.15, 0.04, 2.2], [0.12, 0.5, 0.036, 2]], false),
    ],
    gait: { gait: "amble", stride: 1.2, duty: 0.76, lift: 0.08, bob: 0.01, shift: 0.05, roll: 0.02, girdle: 0.06, pitch: 0.02, tail: [0.3, 0.3], head: [0.04, 0.12], tailAt: t(-0.6), neckAt: t(2.4), drop: 0.02, dropRoll: 0.02, belly: [0.03, 0.12], tailBob: 0.6 },
    motions: [{ role: "jaw", axis: "side", bias: 0.25, channel: "jaw" }],
    poses: { graze: { body: [[0], [0], [0], [0], [0], [0], [0], [0], [0.05], [0.14], [0.1]] }, alert: { body: [[0], [0], [0], [0], [0], [0], [0], [0], [-0.06], [-0.16], [-0.1]] } },
  }
}
const ANKY_LOOK: Look = {
  base: 0x54493a, back: 0x2f2a22, belly: 0x8d7f66, accent: 0x2c241b, horn: 0x6b6050, hornTip: 0x2b251e, shell: 0x4a4234, eye: 0x6a4410,
  cell: 0.05, relief: 0.012, cellVary: 0.25, feature: 2.4, blotch: 0.35, blotchSize: 0.9, mottle: 0.35,
  fold: 0.3, foldSize: 0.14, dust: 0x7a6c56, dustTo: 0.7, dustAmt: 0.45, occlude: 0.8, selfShadow: 0.6, rough: 0.85, spec: 0.1, wrap: 0.28, rim: 0.28,
}
/** Each leg's place in the walk, read off the spec the way the rig reads it: phase offset (rig.ts GAIT_OFFSETS), foot tip x and z. */
function legsOf(spec: CreatureSpec): { off: number; x: number; z: number; fore: boolean }[] {
  const g = spec.gait
  const parts = spec.parts.filter((p) => p.role === "leg" && (p.jointed || p.bones === "joints") && p.origin)
  const pairX = [...new Set(parts.map((p) => Math.round(p.origin![0] * 1000) / 1000))].sort((a, b) => b - a)
  const out: { off: number; x: number; z: number; fore: boolean }[] = []
  for (const p of parts) {
    const tip = p.path[p.path.length - 1], o = p.origin!
    const pair = pairX.indexOf(Math.round(o[0] * 1000) / 1000), fromBack = pairX.length - 1 - pair
    for (const sd of p.mirror ? [1, -1] : [1]) {
      const z = (o[2] + tip[2]) * sd, left = z < 0
      const off = !g ? 0 : g.gait === "biped" ? (left ? 0 : 0.5) : (fromBack * (g.gait === "amble" ? 0.22 : 0.25) + (left ? 0 : 0.5)) % 1
      out.push({ off, x: o[0] + tip[0], z, fore: fromBack > 0 })
    }
  }
  return out
}
legsOf.cache = new Map<CreatureSpec, ReturnType<typeof legsOf>>()

/** A jointed leg (or wing) from absolute joint positions: origin at the first, path relative to it. */
const jl = (J: Vec3[]): { origin: Vec3; path: Vec3[] } => ({ origin: J[0], path: J.slice(1).map((p): Vec3 => [p[0] - J[0][0], p[1] - J[0][1], p[2] - J[0][2]]) })

// ---- Acheroraptor temertyorum: a dromaeosaurid of the Hell Creek known from its jaws ("approximately three metres ... about 40
// kilograms", ROM). The body is Velociraptor's (NHM: 1.8 m, "a fine feather-like covering"; hip about 0.5 m, skull up to 23 cm)
// scaled half as large again: 3 m, hips 0.74 m, a 32 cm skull. Feathered all over, folded wings on the arms, a stiff tail with a
// fan at its end, the second toe held up off the ground with its sickle claw.
function acheroraptor(): CreatureSpec {
  const A = loft([
    { x: -1.75, top: 0.69, bot: 0.66, hw: 0.012 },
    { x: -1.3, top: 0.73, bot: 0.645, hw: 0.03 },
    { x: -0.8, top: 0.765, bot: 0.635, hw: 0.05 },
    { x: -0.35, top: 0.81, bot: 0.6, hw: 0.08, n: 2.1 },
    { x: 0, top: 0.85, bot: 0.54, hw: 0.115, mid: 0.55 }, // hips
    { x: 0.25, top: 0.85, bot: 0.46, hw: 0.135, mid: 0.5, nb: 2.3 }, // the gut
    { x: 0.5, top: 0.83, bot: 0.5, hw: 0.115, mid: 0.5 }, // the chest
    { x: 0.66, top: 0.86, bot: 0.65, hw: 0.075 }, // the root of the neck
    { x: 0.78, top: 0.95, bot: 0.79, hw: 0.055 },
    { x: 0.88, top: 1.05, bot: 0.92, hw: 0.05 }, // the neck's S, rising
    { x: 0.97, top: 1.11, bot: 0.97, hw: 0.056, n: 2.4 }, // the back of the skull
    { x: 1.07, top: 1.125, bot: 0.975, hw: 0.056, n: 2.5 }, // across the orbits
    { x: 1.18, top: 1.085, bot: 0.98, hw: 0.04, n: 2.3 },
    { x: 1.29, top: 1.045, bot: 0.99, hw: 0.024, n: 2.1 }, // a long, low snout
  ])
  const t = A.at
  const HIND = limbOf({
    joints: [[0.02, 0.72, 0.1], [0.2, 0.47, 0.125], [-0.05, 0.17, 0.125], [0.02, 0.028, 0.125], [0.1, 0.012, 0.125]],
    girth: [
      { t: 0, w: 0.085, f: 0.11, b: 0.125 }, { t: 0.5, w: 0.07, f: 0.08, b: 0.095 }, { t: 1, w: 0.04, f: 0.045, b: 0.04 }, { t: 1.4, w: 0.04, f: 0.034, b: 0.052 },
      { t: 2, w: 0.022, f: 0.02, b: 0.022 }, { t: 2.6, w: 0.02, f: 0.017, b: 0.019 }, { t: 3, w: 0.03, f: 0.018, b: 0.014, nb: 3 }, { t: 4, w: 0.02, f: 0.01, b: 0.01, nb: 3 },
    ],
    bulges: [{ t: 0.45, len: 0.45, around: 78, arc: 70, h: 0.02 }, { t: 1.3, len: 0.3, around: 180, arc: 65, h: 0.016 }],
  })
  return {
    name: "acheroraptor",
    body: {
      spine: A.spine, sect: A.sect, rings: 110, sides: 24, caps: ["point", "round"],
      bones: [0, t(-1.25), t(-0.7), t(-0.3), t(0), t(0.35), t(0.62), t(0.8), t(0.95), 1],
      breath: [t(0.1), t(0.55), 0.006],
      bulges: [muscle(t(-0.3), 70, 0.02, 0.06, 50, true), muscle(t(1.05), 40, 0.008, 0.03, 30, true), muscle(t(1.17), 70, -0.006, 0.02, 26, true)],
    },
    parts: [
      { name: "jaw", origin: [0.97, 0.98, 0], path: [[0.12, -0.012, 0], [0.24, -0.01, 0], [0.31, 0.004, 0]], sect: [{ at: 0, w: 0.045, up: 0.02, dn: 0.03 }, { at: 0.6, w: 0.03, up: 0.015, dn: 0.02 }, { at: 1, w: 0.012, up: 0.006, dn: 0.006 }], rings: 8, sides: 10, cap: "round", fillet: 0.015, bones: 1, role: "jaw" },
      // the teeth: a row of small blades along the upper jaw's margin
      ...Array.from({ length: 9 }, (_, i): PartSpec => ({ name: "tooth" + i, origin: [1.0 + i * 0.031, 0.99, 0.024 - i * 0.0012], mirror: true, path: [[0.004, -0.014, 0]], sect: [{ at: 0, w: 0.004, up: 0.006 }, { at: 1, w: 0.001, up: 0.001 }], rings: 2, sides: 5, cap: "point", fillet: 0, mat: MAT.shell, minDetail: 0.9 })),
      eyeOf([1.065, 1.085, 0.05], 0.014),
      { name: "hind", ...HIND, mirror: true, up: [1, 0, 0], rings: 30, sides: 12, cap: "round", fillet: 0.05, role: "leg", limits: [0.2, 2.0], toes: true },
      ...toesOf("hind", [0.1, 0.012, 0.125], [[-0.016, -0.12, 0.011, 4.2], [0.016, 0.12, 0.011, 4]], true),
      // the second toe, held up, and its sickle claw
      { name: "sickle", on: "hind", origin: [0.035, 0.05, 0.105], mirror: true, path: [[0.03, 0.03, -0.004], [0.06, 0.03, -0.006], [0.075, 0.005, -0.007]], sect: [{ at: 0, w: 0.009, up: 0.014 }, { at: 0.5, w: 0.006, up: 0.01 }, { at: 1, w: 0.001, up: 0.001 }], rings: 8, sides: 6, cap: "point", fillet: 0.006, mat: MAT.horn, minDetail: 0.4 },
      // the arms, folded like a bird's wing, carrying the long feathers
      { name: "arm", ...jl([[0.6, 0.7, 0.09], [0.46, 0.63, 0.13], [0.6, 0.59, 0.14], [0.5, 0.56, 0.15]]), jointed: true, bones: 0, mirror: true, up: [0, 1, 0], sect: [{ at: 0, w: 0.04, up: 0.04 }, { at: 0.4, w: 0.025, up: 0.025 }, { at: 1, w: 0.012, up: 0.008 }], rings: 14, sides: 8, cap: "round", fillet: 0.03 },
      { name: "tail", origin: [-1.55, 0.68, 0], path: [[-0.14, 0.004, 0], [-0.26, 0.008, 0]], up: [0, 1, 0], sect: [{ at: 0, w: 0.03, up: 0.008 }, { at: 1, w: 0.012, up: 0.004 }], rings: 4, sides: 8, cap: "round", fillet: 0.01 },
    ],
    cards: [
      { from: 0.03, to: 0.93, arc: [0, 178], count: 1700, len: 0.07, w: 0.02, lift: 0.18, jitter: 0.4, seed: 11 },
      { on: "armR", from: 0.15, to: 1, arc: [40, 160], count: 90, rows: 5, len: 0.2, w: 0.025, lift: 0.08, jitter: 0.15, seed: 12 },
      { on: "armL", from: 0.15, to: 1, arc: [40, 160], count: 90, rows: 5, len: 0.2, w: 0.025, lift: 0.08, jitter: 0.15, seed: 13 },
      { from: 0.0, to: 0.18, arc: [60, 120], count: 60, rows: 6, len: 0.22, w: 0.025, lift: 0.05, jitter: 0.1, seed: 14 }, // the fan down the tail's sides
    ],
    gait: { gait: "biped", stride: 1.35, duty: 0.62, lift: 0.11, bob: 0.02, shift: 0.025, roll: 0.02, girdle: 0.05, pitch: 0.03, tail: [0.05, 0.25], head: [0.02, 0.1], tailAt: t(-0.3), neckAt: t(0.66), drop: 0.018, dropRoll: 0.015, tailBob: 0.8 },
    motions: [{ role: "jaw", axis: "side", bias: 0.3, channel: "jaw" }],
    poses: { alert: { body: [[0], [0], [0], [0], [0], [-0.1], [-0.18], [0.12], [0.1]] } },
  }
}
// the coat: dark above, barred, paler under; the cards read the belly colour wherever they face down, so it is kept close to the base
const RAPTOR_COAT: Look = { base: 0x2c2219, back: 0x16110c, belly: 0x463a2c, accent: 0x1f1812, stripes: 0.5, mottle: 0.4, rough: 0.6, spec: 0.05, glow: 0.15, rim: 0.3 }
const RAPTOR_LOOK: Look = {
  base: 0x4f4030, back: 0x2a2119, belly: 0x8a7a62, accent: 0x2b2118, horn: 0x2a2520, hornTip: 0x15110d, shell: 0xbcae8e, eye: 0xa86a14,
  cell: 0.01, relief: 0.002, stripes: 0.45, blotch: 0.3, blotchSize: 0.4, mottle: 0.35, fold: 0.15, foldSize: 0.06, dust: 0x7a6a52, dustTo: 0.3, dustAmt: 0.4, occlude: 0.7, selfShadow: 0.6, rough: 0.8, spec: 0.1, wrap: 0.4, rim: 0.35,
}

// ---- An azhdarchid pterosaur. Hell Creek's is Infernodrakon hastacollis, one neck vertebra, put at 3 to 4 m across the wings
// (Thomas et al. 2025, as reported); built at 3.6 m from Witton and Naish 2008: "a long and unusually inflexible neck", a long
// skull "approximately triangular in lateral profile", "straight and edentulous" jaws, "relatively short, broad wings", "static
// soarers"; the legs tucked under (UC Berkeley on Quetzalcoatlus). The origin is the middle of the body, in the air.
function azhdarchid(): CreatureSpec {
  const Z = loft([
    { x: -0.32, top: 0.02, bot: -0.02, hw: 0.015 },
    { x: -0.22, top: 0.065, bot: -0.07, hw: 0.065 }, // the pelvis
    { x: -0.05, top: 0.09, bot: -0.1, hw: 0.095 },
    { x: 0.1, top: 0.1, bot: -0.1, hw: 0.11, nb: 1.6 }, // the chest, keeled for the flight muscles
    { x: 0.21, top: 0.075, bot: -0.035, hw: 0.06 },
    { x: 0.45, top: 0.085, bot: 0.02, hw: 0.034 }, // the neck: long, straight, stiff
    { x: 0.7, top: 0.115, bot: 0.058, hw: 0.032 },
    { x: 0.93, top: 0.15, bot: 0.088, hw: 0.035 },
    { x: 1.0, top: 0.195, bot: 0.072, hw: 0.05, n: 2.3 }, // the back of the skull
    { x: 1.15, top: 0.19, bot: 0.08, hw: 0.044, n: 2.3 },
    { x: 1.35, top: 0.155, bot: 0.09, hw: 0.03 },
    { x: 1.55, top: 0.122, bot: 0.1, hw: 0.017 },
    { x: 1.71, top: 0.108, bot: 0.102, hw: 0.005 }, // a long, straight, toothless beak
  ])
  const t = Z.at
  return {
    name: "azhdarchid",
    body: { spine: Z.spine, sect: Z.sect, rings: 90, sides: 18, caps: ["point", "point"], bones: [0, t(-0.15), t(0.1), t(0.45), t(0.8), t(1.1), 1], breath: [t(-0.1), t(0.15), 0.003] },
    parts: [
      { name: "crest", origin: [1.0, 0.19, 0], path: [[0.12, 0.05, 0], [0.24, 0.02, 0]], up: [0, 0, 1], sect: [{ at: 0, w: 0.02, up: 0.006 }, { at: 0.5, w: 0.03, up: 0.004 }, { at: 1, w: 0.006, up: 0.003 }], rings: 6, sides: 8, cap: "round", fillet: 0.01 },
      { name: "jaw", origin: [1.0, 0.078, 0], path: [[0.3, 0.012, 0], [0.55, 0.02, 0], [0.68, 0.025, 0]], sect: [{ at: 0, w: 0.035, up: 0.015, dn: 0.015 }, { at: 1, w: 0.004, up: 0.004 }], rings: 10, sides: 8, cap: "point", fillet: 0.01, mat: MAT.horn },
      eyeOf([1.13, 0.155, 0.04], 0.012),
      // the wings: the arm and the one long finger as the leading edge, the membrane behind them to the leg (mid-chord on the path)
      {
        name: "wing", origin: [-0.07, 0.06, 0.07], mirror: true, path: [[0, 0.03, 0.35], [0.0, 0.05, 0.67], [-0.08, 0.04, 1.15], [-0.17, 0.0, 1.67]], up: [0, 1, 0],
        sect: [{ at: 0, w: 0.23, up: 0.03 }, { at: 0.3, w: 0.2, up: 0.022 }, { at: 0.42, w: 0.16, up: 0.022 }, { at: 0.75, w: 0.09, up: 0.012 }, { at: 1, w: 0.012, up: 0.005 }],
        rings: 26, sides: 10, cap: "round", fillet: 0.04, mat: MAT.membrane, thin: 0.65, bones: 3, role: "wing",
      },
      { name: "leg", origin: [-0.2, -0.03, 0.05], mirror: true, path: [[-0.16, -0.04, 0.03], [-0.32, -0.035, 0.02]], sect: [{ at: 0, w: 0.03, up: 0.03 }, { at: 1, w: 0.012, up: 0.012 }], rings: 6, sides: 8, cap: "round", fillet: 0.02 },
    ],
    // soaring, not walking: the body rides its path and banks into the turn; the wings give a little, and now and then beat
    swim: { wavelength: 1, stride: 20, amp: [[0, 0], [1, 0]], bank: 14 },
    motions: [
      { role: "wing", axis: "side", bias: -0.05, amp: 0.035, rate: 0.23, clock: "time", tipLag: 0.08 },
      { role: "wing", axis: "side", amp: 0.55, rate: 1.3, clock: "time", tipLag: 0.12, channel: "flap" },
    ],
  }
}
const PTERO_LOOK: Look = {
  base: 0x4c4038, back: 0x2c241f, belly: 0xb8a990, accent: 0x6b3a26, horn: 0x5c5040, hornTip: 0x2b241d, eye: 0x241a10, cell: 0.008, mottle: 0.3, fold: 0.1, occlude: 0.5, rough: 0.8, spec: 0.08, wrap: 0.45, rim: 0.4,
}

// ---- Mesodma thompsoni, a multituberculate: one of the few mammals of the Hell Creek that are found again above the boundary
// (Wilson 2013). A small, rodent-like body (about 20 cm with its tail is this model's reading), a short snout, big lower
// incisors, a long tail.
function mesodma(): CreatureSpec {
  const M = loft([
    { x: -0.105, top: 0.022, bot: 0.019, hw: 0.002 },
    { x: -0.06, top: 0.026, bot: 0.017, hw: 0.004 },
    { x: -0.028, top: 0.034, bot: 0.016, hw: 0.007 },
    { x: -0.01, top: 0.043, bot: 0.013, hw: 0.017 }, // the rump
    { x: 0.02, top: 0.047, bot: 0.011, hw: 0.021, nb: 2.4 },
    { x: 0.05, top: 0.044, bot: 0.013, hw: 0.019 },
    { x: 0.07, top: 0.041, bot: 0.018, hw: 0.014 }, // the shoulders
    { x: 0.085, top: 0.043, bot: 0.02, hw: 0.014 }, // the back of the head
    { x: 0.1, top: 0.04, bot: 0.021, hw: 0.012 },
    { x: 0.114, top: 0.033, bot: 0.022, hw: 0.007 },
    { x: 0.123, top: 0.028, bot: 0.023, hw: 0.003 }, // the nose
  ])
  const t = M.at
  const leg = (J: Vec3[], name: string): PartSpec => ({ name, ...jl(J), jointed: true, bones: "joints", mirror: true, up: [1, 0, 0], sect: [{ at: 0, w: 0.007, up: 0.008 }, { at: 0.5, w: 0.004, up: 0.004 }, { at: 1, w: 0.003, up: 0.0015 }], rings: 10, sides: 8, cap: "round", fillet: 0.004, role: "leg", limits: [0.2, 2.2] })
  return {
    name: "mesodma",
    body: {
      spine: M.spine, sect: M.sect, rings: 60, sides: 16, caps: ["point", "round"], bones: [0, t(-0.06), t(-0.01), t(0.03), t(0.07), t(0.095), 1], breath: [t(0), t(0.06), 0.0012], // (breath is in model units, not a fraction)
      bulges: [muscle(t(0.088), 50, 0.005, 0.03, 22, true)], // the ears: small and round, close to the head
    },
    parts: [
      leg([[0.0, 0.026, 0.013], [0.014, 0.014, 0.018], [-0.003, 0.006, 0.018], [0.01, 0.0008, 0.018]], "hind"),
      leg([[0.066, 0.024, 0.011], [0.058, 0.013, 0.014], [0.067, 0.005, 0.015], [0.075, 0.0008, 0.015]], "fore"),
      eyeOf([0.1, 0.035, 0.009], 0.0028),
      { name: "incisor", origin: [0.118, 0.023, 0.002], mirror: true, path: [[0.005, -0.001, 0]], sect: [{ at: 0, w: 0.0012, up: 0.002 }, { at: 1, w: 0.0006, up: 0.001 }], rings: 2, sides: 5, cap: "point", fillet: 0, mat: MAT.horn },
    ],
    gait: { gait: "walk", stride: 0.06, duty: 0.6, lift: 0.006, bob: 0.002, shift: 0.002, roll: 0.03, girdle: 0.08, pitch: 0, tail: [0.012, 0.3], head: [0.001, 0.1], tailAt: t(-0.03), neckAt: t(0.072) },
    poses: { sniff: { body: [[0], [0], [0], [0], [-0.12], [-0.15]] }, yaw: { body: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0.25], [0, 0, 0.35], [0, 0, 0.3]] } },
  }
}
const MESO_LOOK: Look = { base: 0x5d4b3a, back: 0x2e241c, belly: 0x9a8a76, horn: 0xc8a060, hornTip: 0x8a6a30, eye: 0x0a0806, mottle: 0.25, fold: 0.05, occlude: 0.6, rough: 0.95, spec: 0.04, wrap: 0.5, rim: 0.45 }

// ---- The bird: no Hell Creek bird can be placed in a line that survived (Longrich et al. 2011), and the lines that did were
// small birds that lived on the ground (Field et al. 2018; "similar to modern partridges", University of Bath). So: about 30
// cm, round-bodied, short-necked, a short toothless beak, strong legs, three toes forward and one back, short rounded wings.
function groundBird(): CreatureSpec {
  const B = loft([
    { x: -0.1, top: 0.205, bot: 0.17, hw: 0.018 },
    { x: -0.075, top: 0.225, bot: 0.14, hw: 0.04 },
    { x: -0.04, top: 0.24, bot: 0.11, hw: 0.058 },
    { x: 0.0, top: 0.25, bot: 0.098, hw: 0.065, mid: 0.5, nb: 2.2 },
    { x: 0.045, top: 0.25, bot: 0.11, hw: 0.06 }, // the breast
    { x: 0.075, top: 0.252, bot: 0.14, hw: 0.046 },
    { x: 0.098, top: 0.262, bot: 0.18, hw: 0.031 }, // the neck
    { x: 0.115, top: 0.29, bot: 0.21, hw: 0.027 },
    { x: 0.13, top: 0.31, bot: 0.245, hw: 0.028 }, // the back of the head
    { x: 0.15, top: 0.315, bot: 0.256, hw: 0.027 }, // across the eyes
    { x: 0.168, top: 0.306, bot: 0.262, hw: 0.02 },
    { x: 0.178, top: 0.296, bot: 0.266, hw: 0.011 }, // the root of the beak
  ])
  const t = B.at
  const LEG = jl([[0.0, 0.14, 0.03], [0.036, 0.1, 0.034], [-0.008, 0.058, 0.034], [0.006, 0.006, 0.034], [0.028, 0.003, 0.034]])
  return {
    name: "groundBird",
    body: {
      spine: B.spine, sect: B.sect, rings: 70, sides: 22, caps: ["round", "round"], bones: [0, t(-0.06), t(0.0), t(0.06), t(0.1), t(0.135), 1], breath: [t(-0.04), t(0.06), 0.0025],
      bulges: [muscle(t(0.15), 60, 0.003, 0.03, 30, true)],
    },
    parts: [
      { name: "beak", origin: [0.176, 0.287, 0], path: [[0.012, -0.003, 0], [0.024, -0.01, 0]], sect: [{ at: 0, w: 0.008, up: 0.008 }, { at: 1, w: 0.0015, up: 0.0015 }], rings: 5, sides: 8, cap: "point", fillet: 0.003, mat: MAT.horn },
      { name: "jaw", origin: [0.172, 0.272, 0], path: [[0.012, -0.002, 0], [0.022, -0.004, 0]], sect: [{ at: 0, w: 0.007, up: 0.003, dn: 0.004 }, { at: 1, w: 0.0012, up: 0.001 }], rings: 4, sides: 8, cap: "point", fillet: 0.002, mat: MAT.horn, bones: 1, role: "jaw" },
      eyeOf([0.151, 0.293, 0.021], 0.0055),
      { name: "leg", ...LEG, jointed: true, bones: "joints", mirror: true, up: [1, 0, 0], sect: [{ at: 0, w: 0.02, up: 0.024 }, { at: 0.3, w: 0.012, up: 0.012 }, { at: 0.45, w: 0.005, up: 0.005 }, { at: 1, w: 0.004, up: 0.003 }], rings: 22, sides: 10, cap: "round", fillet: 0.012, role: "leg", limits: [0.3, 2.2], toes: true },
      ...toesOf("leg", [0.028, 0.003, 0.034], [[-0.006, -0.35, 0.0028, 4.5], [0.006, 0.35, 0.0028, 4.5]], true),
      { name: "hallux", on: "leg", origin: [0.004, 0.006, 0.034], mirror: true, path: [[-0.012, -0.003, 0], [-0.02, -0.004, 0]], sect: [{ at: 0, w: 0.0025, up: 0.0025 }, { at: 1, w: 0.001, up: 0.001 }], rings: 3, sides: 6, cap: "point", fillet: 0.002, mat: MAT.horn },
      { name: "tail", origin: [-0.09, 0.19, 0], path: [[-0.04, 0.005, 0], [-0.07, 0.0, 0]], up: [0, 1, 0], sect: [{ at: 0, w: 0.028, up: 0.008 }, { at: 1, w: 0.03, up: 0.004 }], rings: 5, sides: 8, cap: "round", fillet: 0.01 },
      // the wings, folded along the flanks
      { name: "wing", origin: [0.055, 0.215, 0.05], mirror: true, path: [[-0.06, 0.004, 0.012], [-0.12, -0.012, 0.006]], up: [0, 0.25, 1], sect: [{ at: 0, w: 0.032, up: 0.008 }, { at: 0.5, w: 0.03, up: 0.006 }, { at: 1, w: 0.012, up: 0.003 }], rings: 8, sides: 10, cap: "round", fillet: 0.012 },
    ],
    cards: [
      { from: 0.04, to: 0.97, arc: [0, 180], count: 2600, len: 0.04, w: 0.022, lift: 0.09, jitter: 0.35, seed: 21 },
      { on: "wingR", from: 0.05, to: 1, arc: [0, 180], count: 140, rows: 5, len: 0.05, w: 0.014, lift: 0.04, jitter: 0.1, seed: 22 },
      { on: "wingL", from: 0.05, to: 1, arc: [0, 180], count: 140, rows: 5, len: 0.05, w: 0.014, lift: 0.04, jitter: 0.1, seed: 23 },
      { on: "tail", from: 0.0, to: 1, arc: [0, 180], count: 50, rows: 3, len: 0.06, w: 0.013, lift: 0.04, jitter: 0.1, seed: 24 },
    ],
    gait: { gait: "biped", stride: 0.12, duty: 0.6, lift: 0.02, bob: 0.004, tail: [0.004, 0.2], head: [0.002, 0.1], tailAt: t(-0.06), neckAt: t(0.09) },
    motions: [{ role: "jaw", axis: "side", bias: 0.45, channel: "jaw" }],
    // the head moves in snaps: turned (yaw), cocked (roll), dipped (pitch); the whole bird shakes itself out (ruf)
    poses: {
      yaw: { body: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0.35], [0, 0, 0.55], [0, 0, 0.3]] },
      cock: { body: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0.3, 0], [0, 0.35, 0]] },
      nod: { body: [[0], [0], [0], [0.15], [0.25], [0.2]] },
      ruf: { body: [[0, 0.2, 0], [0, 0.25, 0], [0, 0.3, 0], [0, 0.3, 0], [0, 0.3, 0], [0, 0.2, 0]] },
    },
  }
}
const BIRD_COAT: Look = { base: 0x6b4428, back: 0x2c1d12, belly: 0x9a8063, accent: 0x231e19, stripes: 0.55, mottle: 0.45, rough: 0.6, spec: 0.05, glow: 0.15, rim: 0.35 }
const BIRD_LOOK: Look = {
  base: 0x6a5d4c, back: 0x3a322a, belly: 0xb8ad98, accent: 0x2a231d, horn: 0x3d3730, hornTip: 0x1a1714, eye: 0xd08a20, stripes: 0.5, mottle: 0.4, blotch: 0.3, blotchSize: 0.03,
  occlude: 0.6, rough: 0.85, spec: 0.08, wrap: 0.45, rim: 0.4,
}

const EDMO = edmontosaurus(false)
const TYRANT = tyrannosaurus()
const ANKY = ankylosaurus()
const RAPTOR = acheroraptor()
const PTERO = azhdarchid()
const MESODMA = mesodma()
const BIRD = groundBird()

export function create(ctx: Ctx): SceneInstance {
  const far = stageTarget(ctx)
  const near = stageTarget(ctx)
  const out = ctx.target({})
  const world = new THREE.Scene()
  const front = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, 12000)
  PLATE.font = ctx.fonts.fell

  // ---------------------------------------------------------------- the story, as uniforms
  const U = {
    uT: uniform(0),
    uAsh: uniform(0),
    uRed: uniform(0),
    uWarm: uniform(0),
    uFlash: uniform(0),
    uFlashK: uniform(60),
    uDome: uniform(0),
    uS2: uniform(dirOf(STAR_AZ, STAR_EL)), // where the second sun is
    uS2C: uniform(new THREE.Vector3()), // and what it sends
    uSh: uniform(new THREE.Vector3(0, 0, 1)), // a unit of height thrown on the ground: xz, and z = strength
    uHaze: uniform(0.0005),
    uDust: uniform(0),
    uFU: uniform(99), // the front: 1 at the far ridge, 0 at the lens, negative once past
    uFZ: uniform(-9999),
    uStar: uniform(1),
    uBol: uniform(new THREE.Vector4(STAR_AZ, STAR_EL, 0, 0)), // head (azimuth, elevation), on, train
    uEj: uniform(0),
    uFire: uniform(0),
    uWind: uniform(1),
    uAmb: uniform(new THREE.Vector3()), // what the sky gives a surface that faces mostly up
    uShE: uniform(new THREE.Vector3()), // the evening's own soft shadow: xz, and z = strength
    uMidge: uniform(0),
    uHead: uniform(new THREE.Vector3()), // the bird's head: yaw, pitch, roll
    uBird: uniform(new THREE.Vector4()), // ruffle, beak, tail, there
    uFern: uniform(0),
  }
  const SUNV = vec3(SUN.x, SUN.y, SUN.z)
  const SUNH = vec2(Math.sin(SUN_AZ), -Math.cos(SUN_AZ))
  const HITV = vec3(HIT.x, HIT.y, HIT.z)
  const sq = (x: F): F => x.mul(x) as F
  /** 1 below `lo`, 0 above `hi` (a falling edge, spelled out: WGSL leaves smoothstep(hi, lo) undefined). */
  const fall = (hi: number | THREE.Node, lo: number | THREE.Node, x: THREE.Node): F => smoothstep(lo as number, hi as number, x as F).oneMinus() as F
  const viewProj = cameraProjectionMatrix.mul(cameraViewMatrix)
  const mat = (vertex: THREE.Node | null, fragment: THREE.Node, o: THREE.MaterialParameters = {}) => {
    const m = new THREE.NodeMaterial()
    if (vertex) m.vertexNode = vertex as THREE.Node<"vec4">
    m.fragmentNode = fragment
    m.setValues(o)
    return m
  }

  // ---------------------------------------------------------------- the world rule
  /** The sky in direction d: the set sun's dusk, the second sun's flash and dome, the red after, the grey after that. */
  const skyAt = Fn(([d]: [V3]) => {
    const el = max(d.y, 0).toVar()
    const hz = normalize(vec2(d.x, d.z).add(vec2(0, -1e-4)))
    const w = pow(dot(hz, SUNH).mul(0.5).add(0.5), 3).toVar()
    const zen = vec3(0.045, 0.085, 0.21)
    const midc = mixN(vec3(0.3, 0.23, 0.36), vec3(0.95, 0.5, 0.38), w)
    const hor = mixN(vec3(0.6, 0.36, 0.42), vec3(2.7, 1.15, 0.36), w)
    const c = zen.add(midc.sub(zen).mul(exp(el.mul(-4.4)))).add(hor.sub(midc).mul(exp(el.mul(-13)))).toVar()
    const g = max(dot(d, SUNV), 0).toVar()
    c.addAssign(vec3(2.6, 1.0, 0.3).mul(pow(g, 60).mul(0.45).add(pow(g, 700).mul(1.3))))
    // the red sky after the front, then the ash
    c.assign(mixN(c, vec3(0.75, 0.16, 0.05).mul(exp(el.mul(-2.2)).mul(0.9).add(0.12)), U.uRed))
    const grey = luma(c).mul(0.5).add(0.07).add(exp(el.mul(-5)).mul(0.1))
    c.assign(mixN(c, vec3(0.96, 0.98, 1.03).mul(grey), U.uAsh))
    // the pall: the ash cloud hangs low and dark over the plain, with a pale band of the lit air under it at the horizon
    const pall = exp(el.mul(-12)).mul(0.76).add(0.24).mul(vnoise(vec2(atan(d.x, d.z.negate()).mul(5), el.mul(14))).mul(0.14).add(0.93))
    c.mulAssign(mixN(float(1), pall, U.uAsh))
    c.addAssign(vec3(1.0, 0.62, 0.3).mul(U.uWarm).mul(pow(g, 9)).mul(exp(el.mul(-7))))
    // a year on the sun is a dim disc through the ash, low over where it set
    const sd2 = dot(d, vec3(SUN2.x, SUN2.y, SUN2.z)).oneMinus().max(0)
    c.addAssign(vec3(1.0, 0.86, 0.66).mul(fall(0.00009, 0.00006, sd2).mul(1.6).add(exp(sd2.mul(-700)).mul(0.5))).mul(U.uAsh).mul(U.uWarm.mul(1.2).add(0.7)))
    // the second sun: a white dome that opens from one azimuth, then a low orange one
    const a = dot(d, HITV).oneMinus().toVar()
    c.addAssign(vec3(7, 6.6, 6).mul(U.uFlash).mul(exp(a.mul(U.uFlashK).negate())))
    c.addAssign(vec3(3.4, 1.25, 0.3).mul(U.uDome).mul(exp(a.mul(16).negate())).mul(exp(el.mul(-5))))
    return c
  }) // (no setLayout: a laid-out function cannot see uniforms on this renderer)

  /** Air between the lens and P: the sky's own horizon colour in that direction, and the dust the front leaves. */
  const hazeAt = (col: V3, P: V3): V3 => {
    const dv = P.sub(cameraPosition).toVar()
    const dist = length(dv).toVar()
    const d = dv.div(dist)
    const hc = skyAt(normalize(vec3(d.x, abs(d.y).mul(0.4).add(0.035), d.z))).mul(0.92)
    const f = exp(dist.mul(U.uHaze).negate()).oneMinus()
    const fd = exp(dist.mul(U.uDust).negate()).oneMinus()
    return mixN(mixN(col, hc, f), hc.mul(vec3(0.62, 0.5, 0.4)), fd) as V3
  }
  /** What the sky gives a surface that faces mostly up: `skyAt(0, 0.8, 0.6)`, worked out once a frame (see `ambJ`). */
  const ambient = () => U.uAmb
  /** The same air, worked out per vertex: rgb to add, and in a how much of the surface comes through. */
  const hazeV = (P: V3): V4 => {
    const dv = P.sub(cameraPosition).toVar()
    const dist = length(dv).toVar()
    const d = dv.div(dist)
    const hc = skyAt(normalize(vec3(d.x, abs(d.y).mul(0.4).add(0.035), d.z))).mul(0.92)
    const f = exp(dist.mul(U.uHaze).negate()).oneMinus()
    const fd = exp(dist.mul(U.uDust).negate()).oneMinus()
    return vec4(hc.mul(f).mul(fd.oneMinus()).add(hc.mul(vec3(0.62, 0.5, 0.4)).mul(fd)), f.oneMinus().mul(fd.oneMinus())) as V4
  }
  /** Seconds since the front went through a thing standing at z. */
  const tauOf = (z: THREE.Node): F => clampN(pow(abs(z as F).div(FRONT_FAR), 1 / FRONT_EXP).sub(U.uFU).mul(T_FRONT1 - T_FRONT0), -3, 40) as F
  // JS twin of ambient: the terms of skyAt that survive in that one direction
  const AMB = (() => {
    const el = 0.8, w = (0.5 - 0.5 * Math.cos(SUN_AZ)) ** 3
    const zen = [0.045, 0.085, 0.21], midc = [mix(0.3, 0.95, w), mix(0.23, 0.5, w), mix(0.36, 0.38, w)], hor = [mix(0.6, 2.7, w), mix(0.36, 1.15, w), mix(0.42, 0.36, w)]
    const base = zen.map((z, i) => z + (midc[i] - z) * Math.exp(-4.4 * el) + (hor[i] - midc[i]) * Math.exp(-13 * el))
    return { base, red: [0.75, 0.16, 0.05].map((c) => c * (Math.exp(-2.2 * el) * 0.9 + 0.12)), a: 1 - (0.8 * HIT.y + 0.6 * HIT.z), g5: Math.exp(-5 * el) }
  })()
  const ambJ = () => {
    const red = U.uRed.value, ash = U.uAsh.value
    let r = mix(AMB.base[0], AMB.red[0], red), g = mix(AMB.base[1], AMB.red[1], red), b = mix(AMB.base[2], AMB.red[2], red)
    const grey = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 0.5 + 0.07 + AMB.g5 * 0.1
    r = mix(r, 0.96 * grey, ash)
    g = mix(g, 0.98 * grey, ash)
    b = mix(b, 1.03 * grey, ash)
    const fl = U.uFlash.value * Math.exp(-AMB.a * U.uFlashK.value), dm = U.uDome.value * Math.exp(-16 * AMB.a) * AMB.g5
    U.uAmb.value.set(r + 7 * fl + 3.4 * dm, g + 6.6 * fl + 1.25 * dm, b + 6 * fl + 0.3 * dm).multiplyScalar(0.55)
  }
  /** A silhouette: albedo, how much it faces the low light (0..1), where it is. */
  const shade = (alb: V3, side: F, P: V3, amb: V3): V3 => {
    const glow = vec3(1.5, 0.62, 0.26).mul(side).mul(0.1).mul(U.uAsh.oneMinus()).mul(U.uRed.oneMinus())
    const rim = U.uS2C.mul(pow(side, 1.6)).mul(0.22)
    const c = alb.mul(amb.add(glow).add(rim))
    return hazeAt(mixN(c, vec3(luma(c).mul(1.15).add(0.012)), U.uAsh.mul(0.85)) as V3, P)
  }

  // ---------------------------------------------------------------- the sky, the star, what falls
  const skyMat = (() => {
    const farp = cameraProjectionMatrixInverse.mul(vec4(positionGeometry.xy, 1, 1))
    const ray = cameraWorldMatrix.mul(vec4(farp.xyz.div(farp.w), 0)).xyz.toVarying("ldRay")
    const frag = Fn(() => {
      const d = normalize(ray).toVar()
      const c = skyAt(d).toVar()
      const p2 = vec2(atan(d.x, d.z.negate()), atan(d.y, length(d.xz))).toVar()
      // the star: one point and its glare, no twinkle
      const sd = length(p2.sub(vec2(STAR_AZ, STAR_EL))).toVar()
      const on = U.uBol.z.oneMinus()
      c.addAssign(vec3(0.86, 0.93, 1.0).mul(U.uStar).mul(on).mul(exp(sq(sd.div(0.0016) as F).negate()).mul(26).add(exp(sd.div(0.006).negate()).mul(0.5)).add(exp(sd.div(0.03).negate()).mul(0.045))))
      // the bolide: a head and a train from where the star was
      const hd = U.uBol.xy
      const ab = hd.sub(vec2(STAR_AZ, STAR_EL))
      const tt = clampN(dot(p2.sub(vec2(STAR_AZ, STAR_EL)), ab).div(max(dot(ab, ab), 1e-6)), 0, 1).toVar()
      const ds = length(p2.sub(vec2(STAR_AZ, STAR_EL)).sub(ab.mul(tt)))
      const train = exp(sq(ds.div(mixN(0.0015, 0.006, tt)) as F).negate()).mul(tt.mul(0.85).add(0.15)).mul(U.uBol.w)
      const hdD = length(p2.sub(hd))
      const head = exp(sq(hdD.div(0.004) as F).negate()).mul(60).add(exp(hdD.div(0.02).negate()).mul(3)).mul(U.uBol.z)
      c.addAssign(vec3(1.0, 0.9, 0.72).mul(train.mul(9)).add(vec3(1, 0.96, 0.9).mul(head)))
      // ejecta: fine bright threads climbing out of the place it hit
      If(U.uEj.greaterThan(0.001), () => {
        const rel = p2.sub(vec2(HIT_AZ, HIT_EL)).toVar()
        const ang = atan(rel.y, rel.x).toVar()
        const rad = length(rel).toVar()
        const id = floor(ang.mul(46))
        const fr = fract(ang.mul(46)).sub(0.5)
        const h1 = hash11(id.add(31.7))
        const reach = h1.mul(0.75).add(0.25).mul(U.uEj).mul(0.42)
        const thread = exp(sq(fr.mul(rad).div(0.0007 * 46) as F).negate()).mul(step(rad, reach)).mul(smoothstep(0.0, 0.06, rad)).mul(exp(reach.sub(rad).mul(-5)).mul(0.9).add(0.1)).mul(step(0.55, h1))
        c.addAssign(vec3(1.5, 0.8, 0.3).mul(thread).mul(vnoise(vec2(ang.mul(40), rad.mul(60))).mul(0.8).add(0.2)).mul(step(0, d.y)))
      })
      // and what comes back down: long slow fire all over the sky
      If(U.uFire.greaterThan(0.001), () => {
        Loop(2, ({ i }) => {
        const k = float(i)
        const a2 = p2.x.mul(mixN(52, 91, k)).add(p2.y.mul(mixN(13, -19, k)))
        const idc = floor(a2).add(k.mul(77))
        const f2 = fract(a2).sub(0.5)
        const hh = hash11(idc)
        const hb = hash11(idc.add(9.3))
        const top = fract(hh.mul(7.1).sub(U.uT.mul(hb.mul(0.05).add(0.035)))).mul(1.1).sub(0.05)
        const len = hb.mul(0.1).add(0.05)
        const along = p2.y.sub(top).div(len)
        const st = exp(sq(f2.div(0.045) as F).negate()).mul(step(0, along)).mul(step(along, 1)).mul(along.oneMinus().mul(along.oneMinus())).mul(step(0.45, hh))
        c.addAssign(mixN(vec3(3.2, 1.1, 0.25), vec3(4, 3, 1.8), sq(along.oneMinus() as F)).mul(st).mul(U.uFire).mul(smoothstep(0.0, 0.05, p2.y)))
        })
      })
      return vec4(c, 1)
    })()
    return mat(vec4(positionGeometry.xy, 0, 1), frag, { depthTest: false, depthWrite: false })
  })()
  const tri = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  const sky = new THREE.Mesh(tri, skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -10
  world.add(sky)

  // ---------------------------------------------------------------- the plain and the lake
  const lakeD = Fn(([p]: [V2]) => {
    const q = p.sub(vec2(40, -185)).div(vec2(230, 62))
    const d1 = length(q).sub(1).add(sin(p.x.mul(0.021).add(1.3)).mul(0.18)).add(sin(p.x.mul(0.05)).mul(0.1)).mul(62)
    const xm = sin(p.y.mul(0.006).add(0.5)).mul(120).add(150).add(sin(p.y.mul(0.017)).mul(40))
    const d2 = max(abs(p.x.sub(xm)).sub(20), p.y.add(215))
    return min(d1, d2)
  }).setLayout({ name: "ldLake", type: "float", inputs: [{ name: "p", type: "vec2" }] })

  const mask = ctx.target({ scale: 0.5, hdr: false })
  const tMask = uniformTexture(mask.texture)
  // the plain after the front: what it carried is laid down in long drifts lying across its path, and the ground between is
  // scoured into furrows. Height grows from nothing as the front passes a place (none of it is there in the evening).
  const drift = (xz: V2): F => sq(vnoise(vec2(xz.x.mul(0.0065), xz.y.mul(0.045))) as F).mul(3.2).add(vnoise(xz.mul(0.17)).sub(0.5).mul(0.35)) as F
  const driftAmt = (xz: V2): F => smoothstep(0.1, 1.8, tauOf(xz.y)).mul(smoothstep(3, 14, lakeD(xz))).mul(fall(-54, -62, xz.y)).mul(fall(2400, 1500, xz.y.negate())) as F
  const groundFragOf = (rk: F | null) => Fn(() => {
      const P = positionWorld.toVar()
      const V = normalize(P.sub(cameraPosition)).toVar()
      const d = lakeD(P.xz).toVar()
      const amb = ambient().toVar()
      const n = fbm(P.xz.mul(0.018)).toVar()
      const n2 = vnoise(P.xz.mul(vec2(0.11, 0.3)))
      // silt and leaf litter, fern cover in patches, pale wet sand by the water, bare earth on the bluff
      const land = mixN(vec3(0.36, 0.27, 0.18), vec3(0.13, 0.17, 0.08), smoothstep(0.42, 0.6, n.add(n2.mul(0.12)))).toVar()
      land.assign(mixN(land, vec3(0.5, 0.4, 0.28), fall(14, 0, d).mul(0.8)))
      // braided channels and sand bars: long thin streaks lying across the view
      land.mulAssign(vnoise(P.xz.mul(vec2(0.012, 0.09)).add(n.mul(3))).mul(0.5).add(0.75))
      land.assign(mixN(land, vec3(0.17, 0.12, 0.085).mul(n2.mul(0.5).add(0.75)), smoothstep(0.3, 2.5, P.y)))
      // close to, the ground has a surface: silt cracked into plates, leaf litter, grit, damp hollows (all gone by 70 m)
      const dcam = length(P.sub(cameraPosition))
      const nearG = fall(70, 6, dcam).toVar()
      If(nearG.greaterThan(0.01), () => {
        const g1 = vnoise(P.xz.mul(3.1)), g2 = vnoise(P.xz.mul(13)), g3 = vnoise(P.xz.mul(47))
        const near2 = fall(25, 3, dcam)
        const crack = fall(0.06, 0.012, abs(vnoise(P.xz.mul(1.9).add(g1.mul(0.8))).sub(0.5)))
        const litter = smoothstep(0.62, 0.74, vnoise(P.xz.mul(vec2(9, 6)).add(31))).mul(smoothstep(0.35, 0.6, g1))
        const dd = land.mul(g2.mul(0.5).add(0.72)).mul(g3.sub(0.5).mul(0.5).mul(near2).add(1)).toVar()
        dd.assign(mixN(dd, dd.mul(0.42), crack.mul(0.75)))
        dd.assign(mixN(dd, vec3(0.2, 0.13, 0.065).mul(g3.add(0.5)), litter.mul(0.5)))
        dd.mulAssign(mixN(1, 0.6, smoothstep(0.55, 0.8, vnoise(P.xz.mul(0.6).add(7)))))
        land.assign(mixN(land, dd, nearG))
      })
      const graze = pow(V.y.oneMinus(), 3)
      const lit = land.mul(amb.add(U.uS2C.mul(0.05)).add(vec3(1.4, 0.6, 0.25).mul(0.04).mul(U.uAsh.oneMinus()))).add(U.uS2C.mul(graze).mul(0.012)).toVar()
      // dry silt throws the low sky back at a shallow angle, which is what the pools under the trees are seen against
      lit.addAssign(land.mul(vec3(2.4, 1.1, 0.5)).mul(pow(abs(V.y).oneMinus(), 6)).mul(0.4).mul(U.uAsh.oneMinus()).mul(U.uRed.oneMinus()))
      // the drifts in a raking light (worked out per vertex of the plain's grid)
      if (rk) lit.mulAssign(rk)
      // what the trees throw: the evening's soft pools, then the long blue-grey shadows of the second sun
      const sm = tMask.sample(screenUV).level(float(0))
      lit.mulAssign(sm.g.mul(0.62).oneMinus())
      lit.assign(mixN(lit, lit.mul(vec3(0.16, 0.22, 0.4)), sm.r))
      // behind the front the ground is scoured
      const behind = step(P.z, U.uFZ)
      lit.assign(mixN(lit, lit.mul(0.55).add(vec3(0.02, 0.012, 0.008)), behind.mul(0.7)))
      lit.assign(mixN(lit, vec3(luma(lit).mul(1.5).add(0.02)).mul(n2.mul(0.25).add(0.85)), U.uAsh.mul(0.9)))
      // water: the sky, upside down, with the star in it
      const rip = vnoise(P.xz.mul(vec2(0.35, 1.6)).add(vec2(U.uT.mul(0.25), U.uT.mul(0.1)))).sub(0.5).mul(mixN(0.012, 0.06, behind)).toVar()
      const Rr = normalize(vec3(V.x.add(rip), abs(V.y).add(0.004).add(rip.mul(0.4)), V.z)).toVar()
      const refl = skyAt(Rr).toVar()
      const stv = max(dot(Rr, U.uS2), 0)
      refl.addAssign(vec3(0.86, 0.93, 1).mul(pow(stv, 9000)).mul(U.uStar).mul(3.5).mul(U.uBol.z.oneMinus()).mul(U.uAsh.oneMinus()))
      // the far shore's trees stand in it, dark
      refl.mulAssign(mixN(1, 0.32, smoothstep(-16, -1.5, d).mul(U.uAsh.mul(0.5).oneMinus())))
      const water = refl.mul(mixN(0.86, 0.5, U.uAsh)).mul(sm.r.mul(0.3).add(sm.g.mul(0.25)).oneMinus()).add(vec3(0.012, 0.016, 0.02)).toVar()
      // where the front's foot is on the water, the lake stands up white
      const foot = exp(sq(P.z.sub(U.uFZ).div(abs(P.z).mul(0.04).add(5)) as F).negate())
      water.assign(mixN(water, amb.mul(2.2).add(U.uS2C.mul(0.3)), foot.mul(0.9)))
      water.assign(mixN(water, vec3(0.11, 0.085, 0.06).mul(amb.mul(3)), behind.mul(0.55).mul(U.uAsh.oneMinus())))
      const c = mixN(water, lit, smoothstep(-0.6, 1.0, d))
      return vec4(hazeAt(c as V3, P), 1)
    })()
  const groundMat = mat(null, groundFragOf(null))
  {
    // the bluff's face, then the plain to the horizon
    const rows: [number, number][] = [[-13.5, 11.1], [-16, 10.4], [-27, 5], [-42, 0.6], [-54, 0]]
    const pos: number[] = []
    const idx: number[] = []
    rows.forEach(([z, y], i) => {
      const w = 600 + -z * 2.2
      pos.push(-w, y, z, w, y, z)
      if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3))
    g.setIndex(idx)
    const m = new THREE.Mesh(g, groundMat)
    m.frustumCulled = false
    m.renderOrder = -5
    world.add(m)
    // the plain itself: a grid fine near and coarse far (so the drifts have vertices to stand on), then one strip to the horizon
    const NXg = 200, NZg = 260
    const gp: number[] = [], gi: number[] = []
    for (let j = 0; j <= NZg + 1; j++) {
      const z = j > NZg ? -9000 : -54 - 2346 * (j / NZg) ** 2, w = 600 - z * 2.2
      for (let i = 0; i <= NXg; i++) {
        gp.push(-w + (2 * w * i) / NXg, 0, z)
        if (i && j) {
          const a = (j - 1) * (NXg + 1) + i - 1, c = j * (NXg + 1) + i - 1
          gi.push(a, a + 1, c + 1, a, c + 1, c)
        }
      }
    }
    const pg = new THREE.BufferGeometry()
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gp), 3))
    pg.setIndex(gi)
    const PG = positionGeometry
    const lift = drift(PG.xz as V2).mul(driftAmt(PG.xz as V2))
    // the drifts in a raking light: from the fire beyond the ridge, later from the first light low where the sun went; each
    // crest throws a shadow on the trough behind it, the troughs are darker, scoured
    const am = driftAmt(PG.xz as V2), e = 0.9
    const h0 = drift(PG.xz as V2)
    const Nd = normalize(vec3(h0.sub(drift(PG.xz.add(vec2(e, 0)) as V2)).div(e).mul(am), 1, h0.sub(drift(PG.xz.add(vec2(0, e)) as V2)).div(e).mul(am)))
    const Lr = normalize(mixN(vec3(HIT.x, 0.16, HIT.z), vec3(SUN.x, 0.22, SUN.z), U.uAsh))
    const hl = drift(PG.xz.add(normalize(Lr.xz).mul(10)) as V2)
    const shadowed = smoothstep(0.1, 0.7, hl.sub(h0).sub(Lr.y.mul(10))).mul(am)
    // (harder after the front: the first light is low and the plain has no other relief to show)
    const rk = max(dot(Nd, Lr).sub(Lr.y).mul(mixN(9, 20, U.uAsh)).mul(am).add(1), 0.18).mul(mixN(1, mixN(0.55, 0.36, U.uAsh), am.mul(h0.div(3.2).oneMinus()))).mul(mixN(1, mixN(0.4, 0.22, U.uAsh), shadowed)).toVarying("ldRK")
    const pm = new THREE.Mesh(pg, mat(viewProj.mul(vec4(PG.x, lift, PG.z, 1)), groundFragOf(rk as F)))
    pm.frustumCulled = false
    pm.renderOrder = -5
    world.add(pm)
  }

  // ---------------------------------------------------------------- five ridges in the haze
  const ridge0: number[] = []
  {
    const R = rng(4107)
    const pos: number[] = []
    const idx: number[] = []
    const RZ = [-760, -1150, -1750, -2700, -4200]
    RZ.forEach((z, k) => {
      const n = 220, w = -z * 2.0 + 400
      const ph = [R() * 9, R() * 9, R() * 9, R() * 9]
      const base = pos.length / 3
      for (let i = 0; i <= n; i++) {
        const x = -w + (2 * w * i) / n
        const u = x / (260 + k * 150)
        let h = 0.5 + 0.5 * Math.sin(u + ph[0]) * Math.sin(u * 0.43 + ph[1]) + 0.3 * Math.sin(u * 2.3 + ph[2]) + 0.14 * Math.sin(u * 5.1 + ph[3])
        // the nearest two carry forest: a ragged top
        // the nearest two carry forest, but for one bare stretch of the first, left of centre, where something can be seen to walk
        const rag = k < 2 ? 5 * R() + 3 * Math.sin(x * 0.13) + 3 : 0
        const bare = k ? 0 : Math.exp(-(((x + 62) / 105) ** 4))
        h = Math.max(h, 0.05) * (26 + k * 34) + rag * (1 - bare) + 16 * bare
        // a low saddle where the thing comes down, so the flash is seen through it
        h *= 1 - 0.5 * Math.exp(-(((x / -z - Math.tan(HIT_AZ)) / 0.09) ** 2))
        if (!k) ridge0.push(h)
        pos.push(x, h, z, x, 0, z)
        if (i) idx.push(base + i * 2 - 2, base + i * 2 - 1, base + i * 2, base + i * 2 - 1, base + i * 2 + 1, base + i * 2)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3))
    g.setIndex(idx)
    const frag = Fn(() => {
      const P = positionWorld.toVar()
      const amb = ambient()
      const tex = vnoise(P.xy.mul(vec2(0.02, 0.08))).mul(0.4).add(0.8)
      return vec4(shade(vec3(0.07, 0.085, 0.07).mul(tex) as V3, float(0.3), P, amb as V3), 1)
    })()
    const m = new THREE.Mesh(g, mat(null, frag, { side: THREE.DoubleSide }))
    m.frustumCulled = false
    m.renderOrder = -4
    world.add(m)
  }

  // ---------------------------------------------------------------- where the plants stand
  // x, z, species, height. Stands are mostly flowering trees, with conifers behind and palms and tree ferns at the wet edges.
  const plants: number[] = []
  {
    const R = rng(2450)
    const HGT: [number, number][] = [[13, 25], [9, 15], [4, 7.5], [27, 40], [17, 30], [1.4, 2.4], [0.7, 1.3], [1.6, 2.8]]
    const one = (x: number, z: number, type: number) => {
      // nothing tall stands between the lens of shot B and the star
      const sa = Math.atan2(x - 7.8, -(z + 90.35))
      if (type < 6 && ((sa > 3 * DEG && sa < 23 * DEG && z > -150) || (Math.abs(z + 259) < 7 && x > -170 && x < 110))) {
        R()
        R()
        R()
        return
      }
      plants.push(x, z, type, mix(HGT[type][0], HGT[type][1], R()))
      // a cycadeoid never stands alone on bare ground: ferns at its foot
      if (type === 5) plants.push(x + 0.9, z + 0.3, 6, 0.9, x - 0.7, z - 0.4, 6, 1.1)
      R()
      R()
    }
    const open = (x: number, z: number) => lakeJ(x, z) > 5 && !(z > -124 && Math.abs(x) < 46) && z < -58
    for (let s = 0; s < 34; s++) {
      const nearS = s < 8
      const NEAR: [number, number][] = [[-62, -88], [78, -92], [-125, -118], [128, -112], [-215, -265], [-70, -272], [120, -268], [262, -262]]
      const cx = nearS ? NEAR[s][0] + (R() - 0.5) * 20 : (R() - 0.5) * 1700
      const cz = nearS ? NEAR[s][1] : -290 - R() ** 1.4 * 800
      const kind = R() < 0.55 ? 0 : R() < 0.5 ? 3 : 4
      const rad = nearS ? 16 + R() * 14 : 30 + R() * 80, n = nearS ? 12 + Math.floor(R() * 8) : 26 + Math.floor(R() * 34)
      for (let i = 0; i < n; i++) {
        const a = R() * 6.2832, r = Math.sqrt(R()) * rad
        const x = cx + Math.cos(a) * r * 1.6, z = cz + Math.sin(a) * r * 0.7
        if (!open(x, z)) continue
        one(x, z, R() < 0.72 ? kind : R() < 0.6 ? 0 : R() < 0.5 ? 1 : 2)
      }
    }
    // the shore: palms, tree ferns, horsetails
    for (let i = 0; i < 1400 && plants.length / 4 < 1500; i++) {
      const x = (R() - 0.5) * 760 + 40, z = -60 - R() * 420
      const d = lakeJ(x, z)
      if (d < 1.5 || d > 26 || (z > -118 && Math.abs(x - 20) < 150)) continue
      one(x, z, d < 6 ? 7 : R() < 0.45 ? 1 : R() < 0.6 ? 2 : 6)
    }
    // ferns, horsetails and cycadeoids round where the horned ones feed, clear of the lines they walk and of the lens
    for (let i = 0; i < 150; i++) {
      const x = -44 + R() * 92, z = -80 - R() * 48
      const t = R()
      const lane = Math.min(Math.abs(z + 96.6), Math.abs(z + 105.4), Math.abs(z + 115.4))
      if (lane < 2.6 || (x > -3 && x < 11 && z > -92.5 && z < -85) || Math.abs(z + 102) < 2.4 || lakeJ(x, z) < 4) continue
      one(x, z, t < 0.12 ? 5 : t < 0.8 ? 6 : 7)
    }
    // ferns and cycadeoids on the open ground, never a blade of grass
    for (let i = 0; i < 260; i++) {
      const x = (R() - 0.5) * 520, z = -58 - R() ** 1.5 * 160
      if (lakeJ(x, z) > 4) one(x, z, R() < 0.3 ? 5 : 6)
    }
  }

  // ---------------------------------------------------------------- the trees
  const sprays = canvasTex(128 * NSPRAY, 128, (c) => drawSprays(c))
  const LEAFC = [[0.085, 0.13, 0.04], [0.07, 0.1, 0.045], [0.05, 0.085, 0.05], [0.07, 0.125, 0.04], [0.085, 0.12, 0.045], [0.06, 0.1, 0.04], [0.1, 0.12, 0.06], [0.16, 0.1, 0.05]]
  const LEAF_OF = [0, 4, 3, 1, 2, 5, 3, 6] // the spray a species' far colour is taken from
  const NIND = 3
  const grown = Array.from({ length: 8 }, (_, sp) => Array.from({ length: sp < 5 ? NIND : 2 }, (_, k) => growTree(sp, k + 1)))
  const HNOM = [19, 10, 6.5, 31, 24, 2.2, 1.0, 1.6]
  /** A tree's buffers again, without copying them. */
  const share = (t: Tree, g: THREE.BufferGeometry = new THREE.BufferGeometry()) => {
    for (const k of ["position", "normal", "aU", "aF"]) g.setAttribute(k, t.g.getAttribute(k))
    return g
  }
  /** Per-instance records of `names.length` vec4s each. */
  const inst = (g: THREE.InstancedBufferGeometry, list: number[], names: string[]) => {
    const k = names.length * 4, n = list.length / k
    names.forEach((nm, j) => {
      const a = new Float32Array(n * 4)
      for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) a[i * 4 + c] = list[i * k + j * 4 + c]
      g.setAttribute(nm, new THREE.InstancedBufferAttribute(a, 4))
    })
    g.instanceCount = n
    return g
  }

  // ---- the sheet the far stands are cut from: every grown tree drawn once, in leaf and stripped,
  // from where the tripod stands. r: its normal across the view; g: how much sky reaches it;
  // b: bark (dark half) or leaf (bright half) and how pale; a: where it is.
  const NCOL = 6, CELL = 320, GUT = 0.045, SPAN = 1 - 2 * GUT, DU = SPAN / NCOL, BASE = 0.6
  const cells: { t: Tree; col: number; row: number }[] = []
  const cellOf = grown.map((list, sp) => list.map((t, k) => (sp >= 5 && k > 0 ? cells.length - 1 : cells.push({ t, col: cells.length % NCOL, row: Math.floor(cells.length / NCOL) }) - 1)))
  const sheet = new THREE.RenderTarget(NCOL * CELL, NCOL * CELL, { depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter })
  const sheetT = texture(sheet.texture)
  const bakeScene = new THREE.Scene()
  const bakeCam = new THREE.OrthographicCamera(0, NCOL, NCOL, 0, 1, 200)
  bakeCam.position.z = 100
  bakeCam.updateMatrixWorld()
  {
    const vN = normalGeometry.toVarying("ldKN"), vU = attribute("aU", "vec4").toVarying("ldKU")
    const frag = Fn(() => {
      const isLeaf = step(-0.5, vU.z)
      const tx = texture(sprays).sample(vec2(max(vU.z, 0).add(clampN(vU.x, 0.02, 0.98)).div(NSPRAY), clampN(vU.y, 0.02, 0.98)))
      Discard(isLeaf.greaterThan(0.5).and(tx.a.lessThan(0.4)))
      const N = normalize(vN)
      const fur = vnoise(vec2(vU.x.mul(9), vU.y.mul(0.9)))
      return vec4(N.x.mul(0.5).add(0.5), vU.w.mul(mixN(N.y.mul(0.35).add(0.65), abs(N.y).mul(0.3).add(0.7), isLeaf)), mixN(fur.mul(0.42), tx.r.mul(0.5).add(0.5), isLeaf), 1)
    })()
    const bm = mat(null, frag, { side: THREE.DoubleSide })
    for (const c of cells)
      for (let bare = 0; bare < 2; bare++) {
        if (bare && !c.t.nBark) continue
        const g = share(c.t)
        if (bare) g.setDrawRange(0, c.t.nBark)
        const m = new THREE.Mesh(g, bm)
        const sx = SPAN / (2 * c.t.rad), sy = SPAN / (c.t.top + BASE)
        m.scale.set(sx, sy, sx)
        m.position.set(c.col + 0.5, c.row + bare * 3 + GUT + BASE * sy, 0)
        m.frustumCulled = false
        bakeScene.add(m)
      }
  }
  let baked = false

  /** The ground under a point of the far world: the bluff's face, then the plain. */
  const gy = (z: number) => (z > -16 ? mix(11.1, 10.4, (-13.5 - z) / 2.5) : z > -27 ? mix(10.4, 5, (-16 - z) / 11) : z > -42 ? mix(5, 0.6, (-27 - z) / 15) : z > -54 ? mix(0.6, 0, (-42 - z) / 12) : 0)
  const gyT = (z: F): F => float(11.1).sub(clampN(z.add(13.5).div(-2.5), 0, 1).mul(0.7)).sub(clampN(z.add(16).div(-11), 0, 1).mul(5.4)).sub(clampN(z.add(27).div(-15), 0, 1).mul(4.4)).sub(clampN(z.add(42).div(-12), 0, 1).mul(0.6)) as F

  // ---- who is what: geometry for the trees a viewer can walk round with the eye, the sheet for the rest
  // geometry out to 330 m (the measured frame stays well inside its budget), crossed cards to 800 m, a single card beyond
  const NEAR_Z = -330, MID_Z = -800
  const stand: number[][] = Array.from({ length: 8 * NIND }, () => [])
  const lipTrees: number[][] = Array.from({ length: 8 * NIND }, () => [])
  const imps: number[] = []
  const shad: number[] = []
  {
    const R = rng(909)
    const place = (into: number[][] | null, x: number, y: number, z: number, sp: number, h: number) => {
      const k = Math.floor(R() * grown[sp].length), t = grown[sp][k], s = h / HNOM[sp]
      const yaw = R() * 6.28, r1 = R(), r2 = R()
      const c = cells[cellOf[sp][k]]
      const rec = [x, y, z, s, yaw < 3.14 ? 1 : -1, r1, r2, sp, (c.col + GUT) / NCOL, (c.row + GUT) / NCOL, 2 * t.rad * s, (t.top + BASE) * s]
      if (into) into[sp * NIND + k].push(x, y, z, s, yaw, r1, r2, t.cr)
      else for (const v of rec) imps.push(v)
      if (sp < 5 && into !== lipTrees) for (const v of rec) shad.push(v)
    }
    // nothing is planted where the lens cannot see it
    const seen = (x: number, z: number) => x > -(1.6 * -z + 60) && x < 0.7 * -z + 30 && !(z < -270 && x / -z > -0.2 && x / -z < 0.0)
    for (let i = 0; i < plants.length; i += 4) {
      const x = plants[i], z = plants[i + 1], sp = plants[i + 2], h = plants[i + 3]
      // geometry where a lens comes near: the tripod's side of the plain, and round the place the lens stands among the animals
      if (seen(x, z)) place((sp < 6 && z > NEAR_Z) || Math.hypot(x - 4, z + 98) < 60 ? stand : null, x, 0, z, sp, h)
    }
    // swamp conifers standing in the shallows
    for (let i = 0; i < 900; i++) {
      const x = -230 + R() * 560, z = -118 - R() * 150
      const d = lakeJ(x, z)
      if (d > -8 && d < 0.5 && R() < 0.3 && !(z > -150 && Math.abs(x - 30) < 120) && seen(x, z)) place(z > NEAR_Z ? stand : null, x, 0, z, 4, 15 + R() * 10)
    }
    // a swamp conifer at the water's edge, close to where the lens stands among the animals
    place(stand, -13, 0, -118, 4, 23)
    // on the bluff's face, close: one flowering tree that frames the left edge, tree ferns, a palm
    place(stand, -21, gy(-35) - 0.5, -35, 0, 25)
    place(stand, 29, gy(-55), -55, 3, 33)
    place(stand, 5.5, gy(-18) - 0.1, -18, 5, 2.1)
    place(stand, 7.4, gy(-19.5), -19.5, 6, 1.1)
    place(stand, 3.6, gy(-17.5), -17.5, 6, 0.9)
    place(stand, -4.5, gy(-18.5), -18.5, 7, 1.7)
    place(stand, 11.5, gy(-22) - 0.3, -22, 2, 6.2)
    place(stand, -8.5, gy(-20) - 0.3, -20, 2, 5.2)
    place(stand, 24, gy(-31), -31, 1, 9.5)
    place(stand, 31, gy(-44), -44, 0, 17)
    // the lip of the bluff, by the lens: cycadeoids, ferns, horsetails
    for (let i = 0; i < 46; i++) {
      const x = (R() - 0.5) * 22, z = -11.5 - R() * 1.9
      const sp = i < 5 ? 5 : i < 42 ? 6 : 7
      if (Math.abs(x) < 5 && sp === 5) continue
      place(lipTrees, x, 11.2, z, sp, HNOM[sp] * (0.7 + 0.5 * R()))
    }
  }

  /** One grown tree in many places, as geometry. */
  const leafy: { g: THREE.BufferGeometry; t: Tree; m: THREE.Mesh }[] = []
  const treeMesh = (t: Tree, list: number[], into: THREE.Scene) => {
    const g = inst(share(t, new THREE.InstancedBufferGeometry()) as THREE.InstancedBufferGeometry, list, ["aP", "aS"])
    const aP = attribute("aP", "vec4"), aS = attribute("aS", "vec4"), aU = attribute("aU", "vec4"), aF = attribute("aF", "vec3")
    const cs = cos(aS.x), sn = sin(aS.x)
    const rotY = (v: V3): V3 => vec3(v.x.mul(cs).add(v.z.mul(sn)), v.y, v.z.mul(cs).sub(v.x.mul(sn))) as V3
    const L0 = rotY(positionGeometry as V3).mul(aP.w)
    const N0 = rotY(normalGeometry as V3)
    const leaf = step(-0.5, aU.z)
    const tau = tauOf(aP.z).toVar()
    const passed = step(0, tau)
    const flex = aF.x
    // the evening wind: the whole tree leans and comes back, each height a little later; leaves shiver
    const w1 = sin(U.uT.mul(0.9).add(aS.y.mul(40)).sub(L0.y.mul(0.14))).mul(0.6).add(sin(U.uT.mul(0.37).add(aS.y.mul(13))).mul(0.4))
    const gust = exp(sq(tau.add(0.3).div(0.25) as F).negate())
    const push = w1.mul(0.02).mul(min(U.uWind, 4)).add(gust.mul(0.09)).mul(flex).mul(aP.w).mul(14)
    const shiver = sin(U.uT.mul(3.3).add(aF.y.mul(6.28)).add(aS.y.mul(9))).mul(0.07).mul(min(U.uWind, 3)).mul(leaf)
    const L = L0.add(vec3(push.mul(0.8), 0, push.mul(0.6))).add(N0.mul(shiver))
    // the front: most trees are bent hard and come back leaning; one in four goes down
    const snap = step(aS.z, 0.25)
    const thS = passed.mul(float(1).sub(exp(tau.mul(-4)).mul(cos(tau.mul(8))))).mul(1.42)
    const thB = passed.mul(exp(tau.mul(-1.3)).mul(cos(tau.mul(4.5))).mul(0.6).add(0.2)).mul(flex.mul(0.75).add(0.25))
    const th = mixN(thB, thS, snap)
    const ct = cos(th), st = sin(th)
    const Lb0 = vec3(L.x, L.y.mul(ct).sub(L.z.mul(st)), L.y.mul(st).add(L.z.mul(ct)))
    const Nb = vec3(N0.x, N0.y.mul(ct).sub(N0.z.mul(st)), N0.y.mul(st).add(N0.z.mul(ct)))
    // and its foliage is torn off along the wind, a spray at a time
    const tear = max(tau.sub(aF.z.mul(0.55)), 0).mul(leaf)
    const Lb = Lb0.add(vec3(aF.y.sub(0.5).mul(12), tear.mul(5).sub(tear.mul(tear).mul(7)), aF.y.mul(26).add(30)).mul(tear))
    // a spray that has gone is not drawn at all
    const W = aP.xyz.add(Lb).mul(step(tear, 1.5))
    const vW = W.toVarying("ldWT")
    const vN = Nb.toVarying("ldNT")
    const vU = aU.toVarying("ldUT")
    const vX = vec3(tear, dot(L0.xz, U.uS2.xz).div(aS.w), aS.y).toVarying("ldXT")
    const vHz = hazeV(vec3(aP.x, aP.y.add(aP.w.mul(8)), aP.z) as V3).toVarying("ldHT")
    const vTau = vec2(tau, L0.y.div(aP.w.mul(14))).toVarying("ldTT")
    const frag = Fn(() => {
      const isLeaf = step(-0.5, vU.z)
      const tx = texture(sprays).sample(vec2(max(vU.z, 0).add(clampN(vU.x, 0.02, 0.98)).div(NSPRAY), clampN(vU.y, 0.02, 0.98)))
      Discard(isLeaf.greaterThan(0.5).and(tx.a.lessThan(0.4)))
      const P = vW
      const dv = P.sub(cameraPosition)
      const dist = length(dv)
      const Vd = dv.div(dist).toVar()
      const N = normalize(vN).toVar()
      const amb = ambient()
      const cell = floor(max(vU.z, 0).add(0.5))
      // bark: furrows that resolve as the footprint allows; rings on palms and ferns; a lattice of leaf bases on the cycadeoid
      const near = fall(240, 25, dist)
      const fur = vnoise(vec2(vU.x.mul(9), vU.y.mul(0.9))).toVar()
      const ringed = sin(vU.y.mul(20)).mul(0.5).add(0.5)
      const lat = sin(vU.x.mul(16).add(vU.y.mul(22))).mul(sin(vU.x.mul(16).sub(vU.y.mul(22)))).mul(0.5).add(0.5)
      const relief = select(vU.z.lessThan(-2.5), lat, select(vU.z.lessThan(-1.5), ringed.mul(0.6).add(fur.mul(0.4)), fur))
      const bark = mixN(vec3(0.085, 0.065, 0.05), vec3(0.2, 0.15, 0.11), relief.mul(near).add(near.oneMinus().mul(0.45))).toVar()
      // the cycadeoid's armour of old leaf bases is paler and rougher than bark
      bark.mulAssign(select(vU.z.lessThan(-2.5), float(1.7), float(1)))
      // ash lies on what faces up
      bark.assign(mixN(bark, vec3(0.3, 0.3, 0.31), U.uAsh.mul(smoothstep(0.05, 0.6, N.y)).mul(0.9)))
      bark.assign(mixN(bark, vec3(0.03, 0.028, 0.027), U.uAsh.mul(fall(0.05, -0.4, N.y)).mul(0.7)))
      // what stands after the front is charcoal: the sides of a trunk are black against the pale air
      bark.assign(mixN(bark, vec3(0.018, 0.016, 0.015), U.uAsh.mul(smoothstep(0.55, 0.1, N.y)).mul(0.85)))
      const lc = vec3(0.08, 0.12, 0.045).toVar()
      LEAFC.forEach((c, i) => lc.assign(select(cell.equal(i), vec3(c[0], c[1], c[2]), lc)))
      lc.mulAssign(tx.r.mul(0.9).add(0.45).mul(vX.z.mul(0.4).add(0.8)))
      const alb = mixN(bark, lc, isLeaf)
      const aoc = vU.w
      // the sky, more of it on what faces up and what is at the crown's edge
      const lit = amb.mul(aoc).mul(mixN(N.y.mul(0.35).add(0.65), abs(N.y).mul(0.3).add(0.7), isLeaf)).mul(0.62).toVar()
      // the afterglow, from where the sun went: on bark that faces it, through leaves that stand against it
      const Lh = normalize(vec3(SUNH.x, 0.1, SUNH.y))
      const nl = dot(N, Lh)
      const after = U.uAsh.oneMinus().mul(U.uRed.oneMinus())
      lit.addAssign(vec3(1.5, 0.62, 0.26).mul(mixN(max(nl, 0), abs(nl).mul(0.5).add(0.2), isLeaf)).mul(aoc).mul(0.16).mul(after))
      const through = pow(max(dot(Vd, Lh), 0), 3).mul(isLeaf).mul(aoc).mul(after)
      // the second sun: hard on the side that faces it, through the leaves from behind, nothing in the crown's own shadow
      const self = smoothstep(-1.1, 0.5, vX.y)
      const nl2 = dot(N, U.uS2)
      const through2 = pow(max(dot(Vd, U.uS2), 0), 2).mul(isLeaf).mul(aoc)
      lit.addAssign(U.uS2C.mul(mixN(max(nl2, 0).mul(1.1), max(nl2, 0).mul(0.4).add(0.03), isLeaf)).mul(self).mul(0.4))
      const glowThrough = vec3(1.7, 1.15, 0.3).mul(through.mul(0.55)).add(U.uS2C.mul(vec3(1, 0.95, 0.5)).mul(through2).mul(0.3)).mul(tx.r.mul(0.6).add(0.4)).mul(lc.mul(1.6))
      const c = alb.mul(lit).add(glowThrough).toVar()
      // what the front leaves standing burns: the falling fire takes the bark in patches, low first, crawling and flickering
      If(U.uFire.greaterThan(0.01), () => {
        const fl = vnoise(vec2(vU.x.mul(2.2).add(vX.z.mul(40)), vU.y.mul(0.7).sub(U.uT.mul(0.5)))).toVar()
        const spot = smoothstep(0.62, 0.8, fl.add(vnoise(vec2(vU.x.mul(9), vU.y.mul(3).sub(U.uT.mul(2.3)))).mul(0.25)).sub(vTau.y.mul(0.35)))
        const lick = sin(U.uT.mul(17).add(vU.y.mul(5)).add(vX.z.mul(60))).mul(0.25).add(0.75)
        c.addAssign(vec3(3.4, 1.15, 0.22).mul(spot).mul(lick).mul(isLeaf.oneMinus()).mul(U.uFire).mul(smoothstep(0.3, 1.2, vTau.x)).mul(U.uAsh.oneMinus()))
      })
      return vec4(mixN(c, vec3(luma(c).mul(1.1).add(0.01)), U.uAsh.mul(0.8)).mul(vHz.a).add(vHz.rgb), 1)
    })()
    const m = new THREE.Mesh(g, mat(viewProj.mul(vec4(W, 1)), frag, { side: THREE.DoubleSide }))
    m.frustumCulled = false
    into.add(m)
    leafy.push({ g, t, m })
    return m
  }
  stand.forEach((list, i) => {
    if (!list.length) return
    const t = grown[Math.floor(i / NIND)][i % NIND]
    treeMesh(t, list, world)
  })
  lipTrees.forEach((list, i) => {
    if (list.length) treeMesh(grown[Math.floor(i / NIND)][i % NIND], list, front)
  })

  // ---- the far stands: one card each from the sheet, nearest first so the far ones are not shaded twice
  const card = new THREE.BufferGeometry()
  card.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3))
  card.setIndex([0, 1, 2, 0, 2, 3])
  /** What a card and its shadow share: the fall, and which half of the sheet it is cut from. */
  const farTree = () => {
    const aP = attribute("aP", "vec4"), aS = attribute("aS", "vec4"), aC = attribute("aC", "vec4")
    const tau = tauOf(aP.z).toVar()
    const passed = step(0, tau)
    const down = step(aS.z, 0.25)
    const th = passed.mul(mixN(exp(tau.mul(-1.3)).mul(cos(tau.mul(4.5))).mul(0.5).add(0.16), float(1).sub(exp(tau.mul(-4)).mul(cos(tau.mul(8)))).mul(1.42), down))
    const bare = max(step(aS.y.mul(0.35).add(0.08), tau), step(0.5, U.uAsh))
    return { aP, aS, aC, tau, passed, down, th, bare }
  }
  {
    const n = imps.length / 12
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => imps[b * 12 + 2] - imps[a * 12 + 2])
    const sorted: number[] = []
    // the middle tier is three cards crossed at 60 degrees, so a crown has some depth when the lens moves; the far tier is one
    for (const i of order) for (const yaw of imps[i * 12 + 2] > MID_Z ? [0, 1.047, -1.047] : [0]) for (let c = 0; c < 16; c++) sorted.push(c < 12 ? imps[i * 12 + c] : c === 12 ? yaw : 0)
    const g = inst(new THREE.InstancedBufferGeometry(), sorted, ["aP", "aS", "aC", "aY"])
    g.setAttribute("position", card.getAttribute("position"))
    g.setIndex(card.getIndex())
    const { aP, aS, aC, tau, th, bare } = farTree()
    const q = positionGeometry
    const gust = exp(sq(tau.add(0.25).div(0.2) as F).negate()).mul(0.2)
    const sway = sin(U.uT.mul(0.8).add(aS.y.mul(40)).add(aP.x.mul(0.01))).mul(0.012).mul(min(U.uWind, 4)).add(gust).mul(q.y).mul(q.y).mul(aC.w)
    const up = q.y.mul(aC.w).sub(aP.w.mul(BASE))
    const yw = attribute("aY", "vec4").x
    // a crossed card is a little narrower and fainter in the alpha: it adds depth, not a second tree
    const wx = q.x.mul(aC.z).mul(mixN(1, 0.8, step(0.01, abs(yw))))
    const W = vec3(aP.x.add(wx.mul(cos(yw))).add(sway), aP.y.add(up.mul(cos(th))), aP.z.add(up.mul(sin(th))).add(wx.mul(sin(yw))))
    const vUV = vec2(aC.x.add(mixN(float(0.5).sub(q.x), q.x.add(0.5), step(0, aS.x)).mul(DU)), aC.y.add(q.y.mul(DU)).oneMinus()).toVarying("ldIU")
    // how much of the crown has gone: sprays are torn off one patch at a time, not the whole tree at once
    const vBare = vec2(max(clampN(tau.sub(aS.y.mul(0.35).add(0.08)).div(0.5), 0, 1), U.uAsh.mul(2).sub(0.4)), bare).toVarying("ldIB")
    const mid = vec3(aP.x, aP.y.add(aC.w.mul(0.55)), aP.z)
    const Vd = normalize(mid.sub(cameraPosition))
    const Lh = normalize(vec3(SUNH.x, 0.1, SUNH.y))
    const vT = vec4(pow(max(dot(Vd, Lh), 0), 3), pow(max(dot(Vd, U.uS2), 0), 2), aS.x, aS.y.mul(0.4).add(0.8)).toVarying("ldIT")
    let lcv: THREE.Node = vec3(0.08, 0.12, 0.045)
    LEAF_OF.forEach((c, i) => (lcv = select(aS.w.greaterThan(i - 0.5), vec3(LEAFC[c][0], LEAFC[c][1], LEAFC[c][2]), lcv as V3)))
    const vLC = (lcv as V3).toVarying("ldIC")
    const vHz = hazeV(mid as V3).toVarying("ldIH")
    const frag = Fn(() => {
      const gone = step(vnoise(vUV.mul(260)).mul(0.8).add(vnoise(vUV.mul(60)).mul(0.2)), clampN(vBare.x, 0, 1))
      const uvT = vUV.sub(vec2(0, gone.mul(0.5))).toVar()
      const tx = sheetT.sample(uvT)
      Discard(tx.a.lessThan(0.42))
      // how near the edge of the silhouette this is: the same sheet, out of focus
      const edge = sheetT.sample(uvT).level(float(3)).a.oneMinus()
      const leaf = step(0.47, tx.b)
      const pale = mixN(tx.b.div(0.42), tx.b.sub(0.5).mul(2), leaf)
      const nx = tx.r.mul(2).sub(1).mul(vT.z)
      const lc = vLC.mul(pale.mul(0.9).add(0.45)).mul(vT.w)
      // (after the front a stripped stand is charcoal: black against the pale air)
      const alb = mixN(mixN(mixN(vec3(0.085, 0.065, 0.05), vec3(0.2, 0.15, 0.11), pale.mul(0.6).add(0.2)), vec3(0.016, 0.015, 0.014), U.uAsh.mul(0.85)), lc, leaf)
      const lit = ambient().mul(tx.g).mul(0.62).toVar()
      const after = U.uAsh.oneMinus().mul(U.uRed.oneMinus())
      // the afterglow rims the side toward where the sun went and comes through the leaves at the crown's edge
      const nl = nx.mul(Math.sin(SUN_AZ) * 1.6).add(0.22)
      lit.addAssign(vec3(1.5, 0.62, 0.26).mul(mixN(max(nl, 0), abs(nl).mul(0.5).add(0.2), leaf)).mul(tx.g).mul(0.2).mul(after))
      // the second sun is behind them: a rim on the side it is on, light in the thin edge of the crown, the rest a cut-out
      const nl2 = max(nx.mul(U.uS2.x).mul(1.6).add(0.12), 0)
      lit.addAssign(U.uS2C.mul(nl2.mul(0.3).add(edge.mul(edge).mul(0.5))).mul(0.4))
      const thin = edge.mul(0.7).add(0.3).mul(leaf).mul(tx.g)
      const glowThrough = vec3(1.7, 1.15, 0.3).mul(vT.x.mul(0.55).mul(after)).add(U.uS2C.mul(vec3(1, 0.95, 0.5)).mul(vT.y).mul(0.3)).mul(thin).mul(pale.mul(0.6).add(0.4)).mul(lc.mul(1.6))
      const c = alb.mul(lit).add(glowThrough)
      return vec4(mixN(c, vec3(luma(c).mul(1.1).add(0.01)), U.uAsh.mul(0.8)).mul(vHz.a).add(vHz.rgb), 1)
    })()
    const m = new THREE.Mesh(g, mat(viewProj.mul(vec4(W, 1)), frag, { side: THREE.DoubleSide }))
    m.frustumCulled = false
    m.renderOrder = 1
    world.add(m)
  }

  // ---- what they throw on the ground: each tree's own outline from the sheet, laid along the light
  // and let go soft with its height, into a half-size mask the ground reads. r: the second sun's
  // long shadows; g: the evening's pools under the crowns.
  const shadows = new THREE.Scene()
  {
    const sg = new THREE.BufferGeometry()
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.12, 0, 0.5, -0.12, 0, 0.5, 1, 0, -0.5, 1, 0]), 3))
    sg.setIndex([0, 1, 2, 0, 2, 3])
    const MAXB: THREE.MaterialParameters = { depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }
    for (const evening of [false, true]) {
      const g = inst(new THREE.InstancedBufferGeometry(), shad, ["aP", "aS", "aC"])
      g.setAttribute("position", sg.getAttribute("position"))
      g.setIndex(sg.getIndex())
      const { aP, aS, aC, tau, passed, down, bare } = farTree()
      const q = positionGeometry
      const thr = evening ? U.uShE : U.uSh
      const len = length(thr.xy).add(1e-4)
      const dirn = thr.xy.div(len)
      const xz = aP.xz.add(vec2(dirn.y, dirn.x.negate()).mul(q.x).mul(aC.z).mul(1.1)).add(thr.xy.mul(q.y).mul(aC.w))
      const W = vec3(xz.x, gyT(xz.y as F).add(0.06), xz.y)
      // a felled tree throws none
      const up = passed.mul(down).mul(smoothstep(0, 0.4, tau)).oneMinus()
      const vQ = vec4(mixN(float(0.5).sub(q.x), q.x.add(0.5), step(0, aS.x)), q.y, bare, up).toVarying(evening ? "ldEQ" : "ldSQ")
      const vC = vec3(aC.xy, aC.w.mul(len).div(aC.z.mul(0.3))).toVarying(evening ? "ldEC" : "ldSC")
      const frag = Fn(() => {
        const v = clampN(vQ.y, 0, 1)
        const uvc = vec2(vC.x.add(clampN(vQ.x, 0.03, 0.97).mul(DU)), vC.y.add(v.mul(0.96).add(0.02).mul(DU)).add(vQ.z.mul(0.5)).oneMinus())
        const a = sheetT.sample(uvc).level(evening ? v.mul(2).add(2.1) : v.mul(3.2).add(1.2)).a
        const pool = exp(sq(vQ.x.sub(0.5).mul(2.3) as F).add(sq(vQ.y.mul(vC.z).mul(0.55) as F)).negate()).mul(0.9)
        const d = (evening ? max(a.mul(pow(v.oneMinus(), 1.3)).mul(2.2), pool) : a.mul(v.mul(0.4).oneMinus()).mul(1.25).mul(step(0, vQ.y))).mul(thr.z).mul(vQ.w)
        return evening ? vec4(0, d, 0, 1) : vec4(d, 0, 0, 1)
      })()
      const m = new THREE.Mesh(g, mat(viewProj.mul(vec4(W, 1)), frag, MAXB))
      m.frustumCulled = false
      shadows.add(m)
    }
  }

  // ---------------------------------------------------------------- the animals
  // Each kind is one herd from the creature toolkit: its own anatomy, a closed-form gait with
  // planted feet, the scene's light and air. They graze and drink; as the star brightens heads
  // come up one at a time; at the flash they stop where they are; and where the wall has passed
  // there is nobody.
  const KEY = { dir: uniform(new THREE.Vector3(0, 0.3, -1)), col: uniform(new THREE.Vector3()), sil: uniform(1), fill: uniform(2.2) }
  const LIGHTS: Lights = { key: KEY.dir as unknown as V3, keyCol: KEY.col as unknown as V3, sky: mixN(U.uAmb, vec3(luma(U.uAmb)).mul(vec3(1.12, 0.92, 0.74)), U.uAsh.oneMinus().mul(0.75)).mul(KEY.fill).mul(KEY.sil) as V3, bounce: vec3(luma(U.uAmb)).mul(mixN(vec3(1), vec3(1.25, 0.8, 0.5), U.uAsh.oneMinus())).mul(KEY.fill).mul(0.7).mul(KEY.sil) as V3 }
  const uDesat = uniform(0)
  const air = { wet: 0, absorb: (c: V3, p: V3): V3 => hazeAt(mixN(c, vec3(luma(c)), uDesat) as V3, p) }
  type Who = { p: number; d0: number; v: number; sc: number; up: number; stop: number; lane: number }
  type Actor = { name: string; herd: Herd; n: number; len: number; high: number; stride: number; who: Who[]; paths: Path[]; x: Float32Array; z: Float32Array; o: ActorOpts; fill(i: number, d: Drive): void }
  type ActorOpts = {
    ground?: ((x: number, z: number) => number) | null
    into?: THREE.Scene
    lods?: LodSpec[]
    extra?(i: number, d: Drive, up: number, w: Who): void
    /** Distance along the path from something other than the walking clock (a flier keeps flying). */
    dist?(w: Who): number
    /** Not swept away by the wall (the ones in beat 3): shown only while `when()` says so. */
    when?(): boolean
    /** No pool of shadow under it (it is in the air). */
    air?: boolean
    /** The coat of cards (feathers), when it is not the hide's look. */
    coat?: Look
  }
  /** One animal's script: which path, where on it at the start, metres a second, size, when its head comes up and when it slows to a halt (seconds of beat 1), and its lane. */
  const who = (p: number, d0: number, v: number, sc: number, up: number, stop = 99, lane = 0): Who => ({ p, d0, v, sc, up, stop, lane })
  /** Seconds of walking done by clock `t` for an animal that slows to a halt from `ts` over `R` seconds: closed form, so a seek is the same walk. */
  const halt = (t: number, ts: number, R = 1.6) => (t < ts ? t : t < ts + R ? ts + (t - ts) - (t - ts) ** 2 / (2 * R) : ts + R / 2)
  const distOf = (w: Who, walk: number) => w.d0 + w.v * halt(walk, w.stop)
  const LOOKAT: [number, number, number] = [0, 0, 0]
  const LIFE = { walk: 0, t0: 0, flash: 0 }
  const cast: Actor[] = []
  const pp = [0, 0, 0, 0, 0, 0]
  const actor = (spec: CreatureSpec, look: Look, len: number, high: number, paths: Vec3[][], list: Who[], o: ActorOpts = {}) => {
    const P = paths.map((p) => makePath(p))
    const n = list.length
    const herd = makeHerd({ spec, count: n, path: P[0], lods: o.lods, material: (nodes, _l, kind) => (kind === "cards" ? featherMaterial(nodes, LIGHTS, { ...look, ...o.coat, water: air }) : skinMaterial(nodes, LIGHTS, { ...look, water: air })) })
    const a: Actor = {
      name: spec.name, herd, n, len, high, stride: spec.gait?.stride ?? 1, who: list, paths: P, x: new Float32Array(n), z: new Float32Array(n), o,
      fill(i, d) {
        const w = list[i]
        d.time = W.T
        d.seed = i * 7.31 + len
        d.rise = 0
        d.lane = w.lane
        d.path = P[w.p]
        d.ground = o.ground ?? null
        d.scale = w.sc
        // the ground it has covered is the only clock its legs have
        d.dist = o.dist ? o.dist(w) : distOf(w, LIFE.walk)
        d.path.at(d.dist, pp)
        a.x[i] = pp[0] - pp[5] * w.lane
        a.z[i] = pp[2] + pp[3] * w.lane
        const up = Math.max(smooth(w.up, w.up + 1.3, LIFE.t0), LIFE.flash)
        d.look = LOOKAT
        d.head = up * 0.8
        d.eyes = Math.max(smooth(w.up - 0.3, w.up + 0.5, LIFE.t0), LIFE.flash)
        if (o.extra) o.extra(i, d, up, w)
        // the wall has been here (and the ones that come through it are only there after it)
        if (o.when ? !o.when() : U.uFZ.value > a.z[i] - 6) d.lane = 9e4
      },
    }
    ;(o.into ?? world).add(herd.group)
    cast.push(a)
    return a
  }

  // ---- beat 1 is three shots: down on the plain as the nearest of the horned ones walks past the lens (A), moving with them
  // toward the water as heads come up (B), and the evening from the bluff (C), which is where every later beat stands
  const SHOT_B = 4.4, SHOT_C = 9.6
  const close = new THREE.Scene() // what is by the lens while it is down on the plain: the near layer of shots A and B
  const HERD: Vec3[] = [[-52, 0, -99], [-30, 0, -97.5], [-10, 0, -96.5], [6, 0, -96.5], [20, 0, -99], [32, 0, -104], [42, 0, -112]]
  const HERO = who(0, 49.5, 1.3, 1, 6.5, 5.3)
  const HERO_LEGS = legsOf(CERATOPSIAN)
  const CAMV: [number, number, number] = [0, 0, 0]
  /** The horned ones feed as they go: the head dips to a fern and comes back, the jaw works; then it stops and the head comes up. */
  const feeding = (i: number, d: Drive, up: number, w: Who) => {
    const dip = 0.5 + 0.5 * Math.sin(W.T * 0.55 + d.seed * 1.3)
    d.ch.graze = (1 - up) * (w === HERO ? 0.2 + 0.5 * dip * smooth(3.4, 5.4, LIFE.t0) : 0.45 + 0.55 * dip)
    d.ch.alert = up
    d.ch.jaw = (1 - smooth(w.up - 0.6, w.up - 0.1, LIFE.t0)) * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(W.T * 5.2 + d.seed))) * (1 - LIFE.flash)
    d.head = up * 0.15
    if (w === HERO && W.shot < 2 && up < 0.5) {
      // by the lens its eye is on the lens
      d.look = CAMV
      d.head = 0.2 * (1 - 2 * up)
      d.eyes = 1
    }
  }
  const hero = actor(CERATOPSIAN, CERATOPSIAN_LOOK, 8.4, 3.4, [HERD], [HERO], { into: close, lods: [{ detail: 1, cover: 0 }], extra: feeding })
  // the other two, further from the lens: one grown, one young
  actor(CERATOPSIAN, CERATOPSIAN_LOOK, 8.4, 3.4, [HERD], [who(0, 48.2, 1.05, 0.96, 7.5, 6.4, -18.8)], { extra: feeding })
  actor(TRIC_YOUNG, CERATOPSIAN_LOOK, 8.4, 3.4, [HERD], [who(0, 47.6, 1.0, 0.55, 8.2, 6.9, -8.8)], { extra: feeding })
  // five duck-bills at the water's edge
  const SHORE: Vec3[] = [[60, 0, -131], [36, 0, -133], [14, 0, -131.5], [-8, 0, -128], [-30, 0, -124]]
  actor(EDMO, EDMO_LOOK, 11, 3.2, [SHORE, [[18, 0, -118], [20, 0, -127], [21, 0, -135.5]], [[-3, 0, -116], [-5, 0, -124], [-6, 0, -131]]], [who(0, 20, 0.3, 1, 8.7, 7.6), who(0, 40, 0.28, 0.9, 9.1, 8), who(0, 58, 0.3, 1.06, 9.5, 8.4), who(1, 16.6, 0.012, 0.97, 9.9), who(2, 14.4, 0.012, 0.86, 10.4)])
  // one tyrant on the open ground beyond the lake, walking left at its own pace (1.28 m/s: van Bijlert et al. 2021); it stands in the water's mirror
  const tyrant = actor(TYRANT, TYRANT_LOOK, 12.2, 4.4, [[[90, 0, -263], [40, 0, -259], [0, 0, -257], [-60, 0, -260], [-150, 0, -266]]], [who(0, 66, 1.28, 1, 10.5)])
  // two small feathered hunters, crossing behind the nearest horned one the other way, briskly
  // (they overtake it on the far side, so they come out past its head in the first shot)
  const RAP: Vec3[] = [[-40, 0, -101], [-10, 0, -101.5], [15, 0, -102.5], [40, 0, -106], [70, 0, -112]]
  actor(RAPTOR, RAPTOR_LOOK, 3, 1.2, [RAP], [who(0, 44, 2.4, 1, 6.4, 6.9), who(0, 41.6, 2.4, 0.9, 6.9, 7.2, 1.3)], { lods: [{ detail: 1, cover: 0 }], coat: RAPTOR_COAT })
  // four azhdarchids soaring in slow circles: one low over the near ground, three far out over the lake and the plain
  const ring = (cx: number, cy: number, cz: number, r: number, k = 16): Vec3[] => Array.from({ length: k }, (_, i): Vec3 => [cx + r * Math.cos((i / k) * 6.2832), cy + 1.5 * Math.sin((i / k) * 12.566), cz + r * 0.75 * Math.sin((i / k) * 6.2832)])
  const FLAPS: [number, number, number][] = [[0, 6.6, 8.1], [1, 1.0, 2.2], [2, 3.5, 4.4], [3, 10.0, 11.2]]
  const flapOf = (i: number) => {
    let f = 0
    for (const [k, a, b] of FLAPS) if (k === i) f = Math.max(f, smooth(a, a + 0.3, W.T) * (1 - smooth(b - 0.3, b, W.T)))
    return f
  }
  const fliers = actor(PTERO, PTERO_LOOK, 4.2, 0.6, [ring(-5, 18, -165, 30), ring(60, 34, -230, 45), ring(-90, 55, -280, 60), ring(150, 70, -420, 70)], [who(0, 10, 9, 1, 99), who(1, 60, 9.5, 1, 99), who(2, 30, 10, 1, 99), who(3, 200, 10, 1, 99)], {
    dist: (w) => w.d0 + w.v * W.T,
    air: true,
    extra(i, d) {
      d.look = null
      d.head = 0
      d.eyes = 0
      d.ch.flap = flapOf(i)
    },
  })
  fliers.who.forEach((w, i) => (w.p = i))
  // the armoured one, low in the ferns on the right
  actor(ANKY, ANKY_LOOK, 7, 1.8, [[[36, 0, -74], [24, 0, -70], [8, 0, -73], [-10, 0, -69]]], [who(0, 5, 0.22, 1, 8.8)])
  // what they throw: a soft pool under each, drawn out along the light, into the same mask as the trees
  const NSH = 24
  const beastSh = new Float32Array(NSH * 4)
  const beastAttr = new THREE.InstancedBufferAttribute(beastSh, 4)
  {
    const sg = new THREE.InstancedBufferGeometry()
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    sg.setIndex([0, 1, 2, 0, 2, 3])
    sg.setAttribute("aA", beastAttr)
    sg.instanceCount = NSH
    const MAXB: THREE.MaterialParameters = { depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }
    for (const evening of [false, true]) {
      const aA = attribute("aA", "vec4"), q = positionGeometry
      const thr = evening ? U.uShE : U.uSh
      const len = length(thr.xy).add(1e-4)
      const dirn = thr.xy.div(len)
      const reach = len.mul(aA.w).mul(0.5)
      const xz = aA.xy.add(dirn.mul(reach)).add(dirn.mul(q.y).mul(reach.add(aA.z))).add(vec2(dirn.y, dirn.x.negate()).mul(q.x).mul(aA.z))
      const vQ = q.xy.toVarying(evening ? "ldBE" : "ldBF")
      const frag = Fn(() => {
        const d = exp(dot(vQ, vQ).mul(-2.6)).mul(thr.z).mul(evening ? 0.95 : 1.1)
        return evening ? vec4(0, d, 0, 1) : vec4(d, 0, 0, 1)
      })()
      const m = new THREE.Mesh(sg, mat(viewProj.mul(vec4(xz.x, 0.07, xz.y, 1)), frag, MAXB))
      m.frustumCulled = false
      shadows.add(m)
    }
  }

  // ---------------------------------------------------------------- far off, on the evening air
  // four big pterosaurs, soaring in slow circles: long stiff necks, huge heads, narrow wings
  {
    const sh = new THREE.Shape()
    const half: [number, number][] = [[0.78, 0], [0.5, 0.035], [0.3, 0.022], [0.13, 0.05], [0.17, 0.45], [0.21, 0.52], [-0.02, 1], [-0.07, 0.5], [-0.13, 0.08], [-0.32, 0.02]]
    sh.moveTo(half[0][0], half[0][1])
    for (const p of half.slice(1)) sh.lineTo(p[0], p[1])
    for (const p of half.slice().reverse()) sh.lineTo(p[0], -p[1])
    const sg = new THREE.ShapeGeometry(sh)
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", sg.getAttribute("position"))
    g.setIndex(sg.getIndex())
    const R = rng(77)
    const fl = new Float32Array(4 * 4), fm = new Float32Array(4 * 4)
    for (let i = 0; i < 4; i++) {
      fl.set([-260 + i * 190 + R() * 60, 62 + R() * 55, -560 - R() * 420, 110 + R() * 90], i * 4)
      fm.set([R() * 6.28, (R() < 0.5 ? -1 : 1) * (0.07 + 0.03 * R()), R(), 5.4], i * 4)
    }
    g.setAttribute("aI", new THREE.InstancedBufferAttribute(fl, 4))
    g.setAttribute("aJ", new THREE.InstancedBufferAttribute(fm, 4))
    g.instanceCount = 4
    const q = positionGeometry, aI = attribute("aI", "vec4"), aJ = attribute("aJ", "vec4")
    const an = aJ.x.add(U.uT.mul(aJ.y)).toVar()
    const hdg = an.add(float(1.5708).mul(aJ.y.sign()))
    const flap = abs(q.y).mul(sin(U.uT.mul(0.7).add(aJ.z.mul(20))).mul(0.07).add(0.16))
    const bank = q.y.mul(0.32).mul(aJ.y.sign())
    const lx = q.x, lz = q.y
    const Wp = vec3(aI.x.add(cos(an).mul(aI.w)).add(cos(hdg).mul(lx).sub(sin(hdg).mul(lz)).mul(aJ.w)), aI.y.add(flap.add(bank).mul(aJ.w)), aI.z.add(sin(an).mul(aI.w).mul(0.6)).add(sin(hdg).mul(lx).add(cos(hdg).mul(lz)).mul(aJ.w)))
    const vW = Wp.toVarying("ldFW")
    const gone = step(0.35, U.uFU)
    const m = new THREE.Mesh(g, mat(viewProj.mul(vec4(Wp.mul(gone), 1)), Fn(() => vec4(shade(vec3(0.09, 0.075, 0.07), float(0.3), vW as V3, ambient() as V3), 1))(), { side: THREE.DoubleSide }))
    m.frustumCulled = false
    world.add(m)
  }

  // ---------------------------------------------------------------- small things in the air: midges, then ash
  const quad = new THREE.BufferGeometry()
  quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
  quad.setIndex([0, 1, 2, 0, 2, 3])
  const specks = (n: number, seed: number, fill: (R: () => number, o: number[]) => void) => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", quad.getAttribute("position"))
    g.setIndex(quad.getIndex())
    const R = rng(seed)
    const a = new Float32Array(n * 4), b = new Float32Array(n * 4)
    const o: number[] = []
    for (let i = 0; i < n; i++) {
      o.length = 0
      fill(R, o)
      a.set(o.slice(0, 4), i * 4)
      b.set(o.slice(4, 8), i * 4)
    }
    g.setAttribute("aI", new THREE.InstancedBufferAttribute(a, 4))
    g.setAttribute("aJ", new THREE.InstancedBufferAttribute(b, 4))
    g.instanceCount = n
    return g
  }
  const bill = (c: V3, size: F) => {
    const vc = cameraViewMatrix.mul(vec4(c, 1)).toVar()
    return cameraProjectionMatrix.mul(vec4(vc.xy.add(positionGeometry.xy.mul(size)), vc.z, 1))
  }
  const ADD: THREE.MaterialParameters = { depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }
  const OVER: THREE.MaterialParameters = { depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }
  {
    // midges dancing in the last light, in three loose columns near the lens
    const g = specks(340, 91, (R, o) => {
      const col = Math.floor(R() * 3)
      o.push([-3.4, 0.6, 4.2][col] + (R() - 0.5) * 2.2, 12.6 + R() * 2.6, -5 - col * 1.6 - R() * 3, 0.006 + 0.007 * R(), R() * 6.28, 1.5 + R() * 3, R() * 6.28, R())
    })
    const aI = attribute("aI", "vec4"), aJ = attribute("aJ", "vec4")
    const t = U.uT
    const c = aI.xyz.add(vec3(sin(t.mul(aJ.y).add(aJ.x)).mul(0.35).add(sin(t.mul(0.31).add(aJ.z)).mul(0.5)), sin(t.mul(aJ.y.mul(1.31)).add(aJ.z)).mul(0.3), cos(t.mul(aJ.y.mul(0.77)).add(aJ.x)).mul(0.35)))
    const vQ = positionGeometry.xy.toVarying("ldMQ")
    const m = new THREE.Mesh(g, mat(bill(c as V3, aI.w as F), Fn(() => vec4(vec3(2.6, 1.25, 0.5).mul(exp(dot(vQ, vQ).mul(-3))).mul(U.uMidge), 0))(), ADD))
    m.frustumCulled = false
    m.renderOrder = 20
    front.add(m)
  }
  const ashMesh = (n: number, seed: number, zNear: number, zFar: number, into: THREE.Scene) => {
    // flakes in a box that travels with the lens: they fall, sidle and tumble on closed forms
    const g = specks(n, seed, (R, o) => o.push((R() - 0.5) * 2, R(), R(), 0.5 + R(), R() * 6.28, 0.5 + R(), R() * 6.28, R()))
    const aI = attribute("aI", "vec4"), aJ = attribute("aJ", "vec4")
    const t = U.uT
    const zz = mixN(zNear, zFar, aI.z.mul(aI.z))
    const span = zz.abs().mul(0.75).add(2)
    const y = fract(aI.y.sub(t.mul(aJ.y).mul(0.055).div(span.mul(0.1).add(1)))).sub(0.5).mul(span).mul(1.2)
    const c = vec3(cameraPosition.x.add(aI.x.mul(span).mul(1.1)).add(sin(t.mul(0.7).mul(aJ.y).add(aJ.x)).mul(0.25)), cameraPosition.y.add(y).sub(span.mul(0.12)), cameraPosition.z.add(zz).add(cos(t.mul(0.5).add(aJ.z)).mul(0.2)))
    const size = max(aI.w.mul(0.006), zz.abs().mul(0.0011))
    const tumble = sin(t.mul(2.2).mul(aJ.y).add(aJ.z)).mul(0.35).add(0.65)
    const vQ = positionGeometry.xy.mul(vec2(1, 1)).toVarying("ldHQ" + seed)
    const vA = tumble.mul(aJ.w.mul(0.5).add(0.5)).toVarying("ldHA" + seed)
    const frag = Fn(() => {
      const a = fall(1, 0.55, length(vQ.mul(vec2(1, float(1).div(vA.mul(0.5).add(0.5)))))).mul(U.uAsh).mul(0.85)
      return vec4(ambient().mul(vA.mul(1.2).add(2.2)).mul(a), a)
    })()
    const m = new THREE.Mesh(g, mat(bill(c as V3, size as F), frag, OVER))
    m.frustumCulled = false
    m.renderOrder = 21
    into.add(m)
    return m
  }
  const ashes = [ashMesh(2600, 3, -9, -150, world), ashMesh(700, 4, -0.6, -8, front)]

  // ---- dust off the feet: a puff where each foot came down, growing and thinning over the first part of its stance
  const NDUST = 64
  const dustA = new Float32Array(NDUST * 4), dustB = new Float32Array(NDUST * 4)
  const dustAA = new THREE.InstancedBufferAttribute(dustA, 4), dustBA = new THREE.InstancedBufferAttribute(dustB, 4)
  const uDH = uniform(1) // 1 while the nearest animal is in the near layer
  const dustMesh = (into: THREE.Scene, near: boolean) => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", quad.getAttribute("position"))
    g.setIndex(quad.getIndex())
    g.setAttribute("aI", dustAA)
    g.setAttribute("aJ", dustBA)
    g.instanceCount = NDUST
    const aI = attribute("aI", "vec4"), aJ = attribute("aJ", "vec4")
    // the hero's puffs are drawn with it: in the near layer while it is there, in the world otherwise
    const show = near ? aJ.z.mul(uDH) : float(1).sub(aJ.z.mul(uDH))
    const c = vec3(aI.x, aI.y.add(aI.w.mul(0.45)), aI.z)
    const vQ = positionGeometry.xy.toVarying(near ? "ldDQn" : "ldDQ")
    const vA = vec2(aJ.x.mul(show), aJ.y).toVarying(near ? "ldDAn" : "ldDA")
    const vHz = hazeV(c as V3).toVarying(near ? "ldDHn" : "ldDH")
    const frag = Fn(() => {
      const r = length(vQ.mul(vec2(1, 1.35)))
      const wisp = vnoise(vQ.mul(2.6).add(vA.y.mul(17))).mul(0.6).add(0.55)
      const a = fall(1, 0.1, r).mul(wisp).mul(vA.x)
      const col = vec3(0.5, 0.4, 0.3).mul(ambient().mul(1.7).add(KEY.col.mul(0.25)))
      return vec4(col.mul(vHz.a).add(vHz.rgb).mul(a), a)
    })()
    const m = new THREE.Mesh(g, mat(bill(c as V3, aI.w.mul(show) as F), frag, OVER))
    m.frustumCulled = false
    m.renderOrder = 15
    into.add(m)
  }
  dustMesh(world, false)
  dustMesh(close, true)

  // ---- what came back down, in the air over the plain: glowing streaks falling at every depth (parallax when the lens drifts)
  {
    const g = specks(520, 71, (R, o) => {
      const z = -60 - R() ** 1.6 * 1500
      o.push((R() - 0.5) * (1.8 * -z + 200), z, R(), 0.6 + R(), 0.4 + R(), (R() - 0.5) * 0.5, R(), R())
    })
    const aI = attribute("aI", "vec4"), aJ = attribute("aJ", "vec4")
    const H = aJ.x.mul(380).add(120)
    const a = fract(aI.z.add(U.uT.mul(aI.w).mul(0.05)))
    const c = vec3(aI.x.add(aJ.y.mul(H).mul(a)), H.mul(a.oneMinus()), aI.y)
    const vel = cameraViewMatrix.mul(vec4(aJ.y, -1, 0, 0)).xy
    const vc = cameraViewMatrix.mul(vec4(c, 1)).toVar()
    const along = normalize(vel), across = vec2(along.y.negate(), along.x)
    const len = aI.w.mul(26).add(10), wid = max(vc.z.abs().mul(0.0016), 0.35)
    const q = positionGeometry.xy
    const pos = cameraProjectionMatrix.mul(vec4(vc.xy.add(along.mul(q.y).mul(len)).add(across.mul(q.x).mul(wid)), vc.z, 1))
    const vQ = vec3(q.xy, smoothstep(0, 25, c.y).mul(U.uFire).mul(U.uAsh.oneMinus())).toVarying("ldEjQ")
    const frag = Fn(() => {
      const head = vQ.y.mul(0.5).add(0.5).oneMinus() // the leading end, low
      const k = fall(1, 0.2, abs(vQ.x)).mul(pow(head, 2.2)).mul(vQ.z)
      return vec4(mixN(vec3(3.2, 1.0, 0.2), vec3(5, 4, 2.6), pow(head, 6)).mul(k), 0)
    })()
    const m = new THREE.Mesh(g, mat(pos, frag, ADD))
    m.frustumCulled = false
    m.renderOrder = 13
    world.add(m)
  }
  // ---- smoke: columns over what burns, puffs rising, spreading and leaning downwind; the base lit by its own fire, the
  // underside of each puff in its own shadow, the top lit by the red sky
  {
    const COLS: [number, number][] = []
    const R0 = rng(5150)
    while (COLS.length < 22) {
      const z = -70 - R0() ** 1.3 * 650, x = (R0() - 0.5) * (1.4 * -z + 60)
      if (lakeJ(x, z) > 6) COLS.push([x, z])
    }
    const g = specks(22 * 12, 72, (R, o) => {
      const ci = Math.floor(R() * 22), k = Math.floor(R() * 12)
      o.push(COLS[ci][0], COLS[ci][1], k / 12 + R() * 0.05, R(), 0.7 + 0.6 * R(), R(), R(), R())
    })
    const aI = attribute("aI", "vec4"), aJ = attribute("aJ", "vec4")
    const a = fract(aI.z.add(U.uT.mul(0.04).mul(aJ.x)).add(aI.w.mul(0.3))).toVar()
    const c = vec3(aI.x.add(a.mul(a).mul(30)), a.mul(75).add(3), aI.y.add(a.mul(6)))
    const size = a.mul(26).add(5).mul(aJ.x)
    const vQ = positionGeometry.xy.toVarying("ldSmQ")
    const vA = vec4(a, aJ.y, aJ.z, U.uFire.mul(U.uAsh.oneMinus())).toVarying("ldSmA")
    const vHz = hazeV(c as V3).toVarying("ldSmH")
    const frag = Fn(() => {
      const r = length(vQ)
      const bil = vnoise(vQ.mul(2.3).add(vA.y.mul(37)).add(vec2(0, U.uT.mul(0.08)))).mul(0.6).add(vnoise(vQ.mul(5.1).add(vA.z.mul(19))).mul(0.4))
      const al = fall(1, 0.25, r.add(bil.sub(0.5).mul(0.7))).mul(smoothstep(0, 0.12, vA.x)).mul(pow(vA.x.oneMinus(), 1.4)).mul(0.62).mul(vA.w)
      const top = smoothstep(-0.6, 0.7, vQ.y.add(bil.sub(0.5).mul(0.6)))
      const body = vec3(0.07, 0.055, 0.045).mul(ambient().mul(mixN(0.35, 1.6, top)).add(0.02))
      const glow = vec3(2.4, 0.8, 0.18).mul(fall(0.4, -0.9, vQ.y)).mul(pow(vA.x.oneMinus(), 5)).mul(U.uFire)
      const col = body.add(glow).mul(vHz.a).add(vHz.rgb.mul(0.6))
      return vec4(col.mul(al), al)
    })()
    const m = new THREE.Mesh(g, mat(bill(c as V3, size as F), frag, OVER))
    m.frustumCulled = false
    m.renderOrder = 12
    world.add(m)
  }

  // ---------------------------------------------------------------- the wall
  const wall = (() => {
    const g = new THREE.PlaneGeometry(2, 1, 1, 1)
    const q = positionGeometry
    const aK = attribute("aK", "float")
    const g2 = new THREE.InstancedBufferGeometry()
    g2.setAttribute("position", g.getAttribute("position"))
    g2.setIndex(g.getIndex())
    g2.setAttribute("aK", new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3]), 1))
    g2.instanceCount = 4
    const z = U.uFZ.sub(aK.mul(abs(U.uFZ).mul(0.05).add(8)))
    const hgt = abs(z).mul(0.05).add(40).mul(aK.mul(0.18).add(1))
    const Wp = vec3(q.x.mul(abs(z).mul(2.2).add(900)), q.y.add(0.5).mul(hgt), z)
    const vW = Wp.toVarying("ldWW")
    const vH = vec2(q.y.add(0.5), aK).toVarying("ldWH")
    const vWZ = hazeV(Wp as V3).toVarying("ldWZ")
    const frag = Fn(() => {
      const P = vW
      const roll = (p: V2): F => vnoise(p).mul(0.62).add(vnoise(p.mul(2.3).add(7.1)).mul(0.38)) as F
      const bil = roll(vec2(P.x.mul(0.012).add(vH.y.mul(3.7)), P.y.mul(0.028).sub(U.uT.mul(0.5))) as V2).toVar()
      const top = fall(1.0, 0.25, vH.x.add(bil.sub(0.5).mul(0.9)))
      const a = top.mul(mixN(0.97, 0.6, vH.y.div(3)))
      const amb = ambient()
      const bil2 = roll(vec2(P.x.mul(0.042).add(vH.y), P.y.mul(0.1).sub(U.uT.mul(0.9))) as V2)
      const dustC = mixN(vec3(0.03, 0.022, 0.018), vec3(0.3, 0.2, 0.13), smoothstep(0.3, 0.7, bil.mul(0.6).add(bil2.mul(0.4)))).mul(vH.x.mul(0.9).add(0.3)).mul(luma(amb).mul(0.5).add(0.25))
      // its crest is lit through from behind; its foot on the water is white
      const crest = smoothstep(0.35, 0.95, vH.x.add(bil.sub(0.5).mul(0.9))).mul(vec3(3, 1.3, 0.4)).mul(U.uDome.add(0.15))
      const foot = fall(0.1, 0.0, vH.x).mul(step(lakeD(P.xz), 0)).mul(1.6)
      const cw = dustC.add(crest.mul(0.3)).add(amb.mul(foot))
      const c = mixN(cw, cw.mul(vWZ.a).add(vWZ.rgb), 0.35)
      return vec4(c.mul(a), a)
    })()
    const m = new THREE.Mesh(g2, mat(viewProj.mul(vec4(Wp, 1)), frag, { ...OVER, side: THREE.DoubleSide }))
    m.frustumCulled = false
    m.renderOrder = 10
    world.add(m)
    return m
  })()


  // ---------------------------------------------------------------- by the lens: the gully, the cut bank, the branch, the bird
  const Y_K = 10.55 // the level the boundary clay lies at, everywhere along the bank
  // where the bird stands: on a burnt bough the front left lying on the bank's top, among the ash
  const PERCH = new THREE.Vector3(0.62, 11.31, -11.85)
  const EMBW = new THREE.Vector3()
  /** The top of the bank and the ground behind it (the near ground's own rows), and the gully floor in front of it. */
  const lipY = (x: number, z: number) => mix(11.22, 11.1, clamp((-11.3 - z) / 2.4)) + 0.05 * Math.sin(x * 1.3 + z)
  {
    // a strip of ground in profile, swept along x: the rise the tripod stands on, the gully, the bank's face, the lip
    const prof: [number, number, number][] = [[0.6, 12.05, 0], [-3, 12, 0], [-5.2, 11.6, 0], [-6.6, 10.3, 0], [-7.6, 9.75, 0], [-10.6, 9.7, 0], [-10.92, 9.72, 1]]
    for (let i = 1; i <= 7; i++) prof.push([-10.92 - 0.3 * (i / 7) + (i === 4 ? -0.05 : 0), 9.72 + 1.48 * (i / 7), 1])
    prof.push([-11.3, 11.22, 0], [-13.7, 11.1, 0])
    const NX = 90
    const pos: number[] = [], bk: number[] = [], idx: number[] = []
    prof.forEach(([z, y, b], j) => {
      for (let i = 0; i <= NX; i++) {
        const x = -18 + (36 * i) / NX
        // the face wanders in and out; its beds do not move up or down
        const wz = b || j >= prof.length - 2 ? 0.3 * Math.sin(x * 0.7 + 1) + 0.12 * Math.sin(x * 2.3) + 0.05 * Math.sin(x * 7.1 + j) : 0
        pos.push(x, y + (b ? 0 : 0.05 * Math.sin(x * 1.3 + z)), z + wz)
        bk.push(b)
        if (j && i) {
          const a = (j - 1) * (NX + 1) + i - 1, c = j * (NX + 1) + i - 1
          idx.push(a, a + 1, c + 1, a, c + 1, c)
        }
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3))
    g.setAttribute("aB", new THREE.BufferAttribute(new Float32Array(bk), 1))
    g.setIndex(idx)
    const vB = attribute("aB", "float").toVarying("ldGB")
    const frag = Fn(() => {
      const P = positionWorld.toVar()
      const amb = ambient().toVar()
      const y = P.y, x = P.x
      const aa = fwidth(y).mul(0.8).add(0.0015)
      const band = (lo: THREE.Node, hi: THREE.Node): F => smoothstep((lo as F).sub(aa), (lo as F).add(aa), y).mul(fall((hi as F).add(aa), (hi as F).sub(aa), y)) as F
      const lam = vnoise(vec2(x.mul(0.9), y.mul(42))).toVar()
      const crumb = vnoise(P.xy.mul(13)).toVar()
      const blotch = vnoise(vec2(x.mul(0.35), y.mul(7)))
      // below: grey-buff mudstone in fine level beds, with darker plant-rich streaks
      const face = mixN(vec3(0.36, 0.32, 0.25), vec3(0.52, 0.47, 0.38), lam).mul(blotch.mul(0.45).add(0.75)).toVar()
      // above the line: a hand of pale silt, then dark soil with roots
      const after = U.uAsh
      const tk = vnoise(vec2(x.mul(1.6), 3.3)).mul(0.008).add(0.042)
      const top = float(Y_K).add(tk)
      face.assign(mixN(face, vec3(0.66, 0.62, 0.52).mul(crumb.mul(0.2).add(0.9)), smoothstep(top, top.add(0.004), y).mul(after)))
      const soilAt = float(Y_K + 0.36).add(vnoise(vec2(x.mul(0.8), 1.7)).mul(0.1))
      const root = fall(0.06, 0.02, abs(fract(x.mul(2.6).add(vnoise(vec2(x.mul(2), y.mul(3))).mul(0.9))).sub(0.5))).mul(smoothstep(soilAt, soilAt.add(0.3), y))
      face.assign(mixN(face, vec3(0.12, 0.095, 0.075).mul(crumb.mul(0.5).add(0.7)), smoothstep(soilAt.sub(0.03), soilAt.add(0.05), y)))
      face.assign(mixN(face, vec3(0.3, 0.25, 0.19), root.mul(0.7)))
      // the boundary: a rust-red base a few millimetres thick under a dark clay, dead level
      const lit0 = face.mul(amb.mul(1.05)).mul(mixN(1, 0.55, smoothstep(10.95, 11.22, y))).toVar()
      const grey = mixN(lit0, vec3(luma(lit0)), after.mul(0.6)).toVar()
      grey.assign(mixN(grey, vec3(0.78, 0.55, 0.4).mul(amb.mul(1.5)), band(float(Y_K - 0.04), float(Y_K)).mul(after)))
      grey.assign(mixN(grey, vec3(0.03, 0.03, 0.034).mul(amb.mul(1.2)).add(amb.mul(0.012)), band(float(Y_K), top).mul(after)))
      // everything else: earth, litter, and then ash lying in drifts
      const soil = mixN(vec3(0.13, 0.1, 0.075), vec3(0.2, 0.16, 0.11), crumb).mul(vnoise(P.xz.mul(1.7)).mul(0.5).add(0.7))
      const drift = vnoise(P.xz.mul(vec2(0.9, 2.2))).toVar()
      const ashy = vec3(0.37, 0.37, 0.38).mul(drift.mul(0.42).add(0.66)).mul(vnoise(P.xz.mul(vec2(11, 23))).mul(0.14).add(0.93))
      // the gully floor is in the bank's shade; pocks where drops fell from the lip
      const pock = smoothstep(0.78, 0.9, vnoise(P.xz.mul(19))).mul(0.25).oneMinus()
      const foot = mixN(0.62, 1, smoothstep(-10.5, -9.2, P.z).add(step(P.z, -11.1)))
      const ground = mixN(soil, ashy.mul(pock), after.mul(mixN(0.55, 0.96, smoothstep(0.3, 0.55, drift)))).mul(amb.mul(mixN(1.1, 2.5, after))).mul(foot)
      const c = mixN(ground, grey, smoothstep(0.3, 0.7, vB))
      return vec4(c.add(vec3(1, 0.62, 0.3).mul(U.uWarm).mul(0.02)), 1)
    })()
    const m = new THREE.Mesh(g, mat(null, frag, { side: THREE.DoubleSide }))
    m.frustumCulled = false
    front.add(m)
  }
  // ---- the cut bank itself, as relief: beds that stand proud or weather back, rills, a foot of
  // fallen earth, an overhanging mat of soil and roots, and the one firm seam at Y_K. Top light
  // only (the sky is all there is), so every ledge has a lit top and a dark underside.
  const h2 = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return v - Math.floor(v)
  }
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
    return mix(mix(h2(xi, yi), h2(xi + 1, yi), u), mix(h2(xi, yi + 1), h2(xi + 1, yi + 1), u), v)
  }
  const relief = (x: number, y: number) => {
    const f = (y - 9.72) * 12, k = Math.max(Math.floor(f), 0)
    const hard = mix(h2(k, 7.3), h2(k + 1, 7.3), smooth(0.7, 1, f - k))
    let r = 0.03 + 0.12 * hard * hard + 0.06 * (vn(x * 1.3, y * 5) - 0.5) + 0.022 * (vn(x * 7, y * 11) - 0.5)
    r -= 0.07 * Math.max(0, 1 - Math.abs(vn(x * 0.9, 0.5) - 0.5) * 9) * smooth(11.1, 10.4, y)
    r += 0.032 * Math.exp(-(((y - (Y_K + 0.02)) / 0.024) ** 2))
    r += 0.17 * smooth(10.96, 11.12, y) * (0.5 + vn(x * 2.1, 3.3))
    r += 0.75 * Math.max(0, (10.04 - y) / 0.32) ** 1.5 * (0.7 + 0.6 * vn(x * 0.8, 9.1))
    return Math.max(r, 0.035)
  }
  const faceZ = (x: number, y: number) => -10.92 - 0.3 * clamp((y - 9.72) / 1.48) + 0.3 * Math.sin(x * 0.7 + 1) + 0.12 * Math.sin(x * 2.3) + relief(x, y)
  /** How the near ground is lit: sky from above on what faces up, less in the hollows, and the first warm light low on the left. */
  const nearLit = (alb: THREE.Node, N: V3, ao: THREE.Node): V3 => {
    const ashed = mixN(alb as V3, vec3(0.37, 0.37, 0.38), U.uAsh.mul(smoothstep(0.3, 0.72, N.y)).mul(0.93))
    const c = ashed.mul(ambient().mul(N.y.mul(0.5).add(0.72)).mul(ao as F).mul(mixN(1.2, 2.5, U.uAsh)).add(vec3(1, 0.62, 0.3).mul(U.uWarm).mul(max(dot(N, vec3(-0.5, 0.62, -0.6)), 0).mul(0.16).add(0.02))))
    return c as V3
  }
  {
    const NXF = 300, NYF = 72, X0 = -9, X1 = 9, YA = 9.7, YB = 11.25
    const zs = new Float32Array((NXF + 1) * (NYF + 1))
    const at = (i: number, j: number) => zs[clamp(j, 0, NYF) * (NXF + 1) + clamp(i, 0, NXF)]
    for (let j = 0; j <= NYF; j++) for (let i = 0; i <= NXF; i++) zs[j * (NXF + 1) + i] = faceZ(mix(X0, X1, i / NXF), mix(YA, YB, j / NYF))
    const dx = (X1 - X0) / NXF, dy = (YB - YA) / NYF
    const pos: number[] = [], nor: number[] = [], occ: number[] = [], idx: number[] = []
    for (let j = 0; j <= NYF; j++)
      for (let i = 0; i <= NXF; i++) {
        const z = at(i, j)
        pos.push(mix(X0, X1, i / NXF), mix(YA, YB, j / NYF), z)
        const nx = -(at(i + 1, j) - at(i - 1, j)) / (2 * dx), ny = -(at(i, j + 1) - at(i, j - 1)) / (2 * dy)
        const l = Math.hypot(nx, ny, 1)
        nor.push(nx / l, ny / l, 1 / l)
        // a hollow sees less sky, and so does anything under a ledge
        let over = 0
        for (let m = 1; m <= 9; m++) over = Math.max(over, (at(i, j + m) - z) / (m * dy))
        const cav = z - (at(i - 3, j) + at(i + 3, j) + at(i, j - 3) + at(i, j + 3)) / 4
        occ.push(clamp(0.85 + cav * 5, 0.45, 1.12) * (1 - 0.5 * clamp(over * 0.5)))
        if (i && j) {
          const a = (j - 1) * (NXF + 1) + i - 1, c = j * (NXF + 1) + i - 1
          idx.push(a, a + 1, c + 1, a, c + 1, c)
        }
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3))
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nor), 3))
    g.setAttribute("aO", new THREE.BufferAttribute(new Float32Array(occ), 1))
    g.setIndex(idx)
    const vN = normalGeometry.toVarying("ldFN"), vO = attribute("aO", "float").toVarying("ldFO")
    const frag = Fn(() => {
      const P = positionWorld.toVar()
      const N = normalize(vN).toVar()
      const y = P.y, x = P.x
      const aa = fwidth(y).mul(0.8).add(0.0015)
      const band = (lo: THREE.Node, hi: THREE.Node): F => smoothstep((lo as F).sub(aa), (lo as F).add(aa), y).mul(fall((hi as F).add(aa), (hi as F).sub(aa), y)) as F
      const lam = vnoise(vec2(x.mul(0.9), y.mul(46))).toVar()
      const crumb = vnoise(P.xy.mul(17)).toVar()
      const bed = vnoise(vec2(x.mul(0.12).add(4), y.mul(12)))
      // grey-buff mudstone in fine level beds; a paler sandy lens with pebbles low down; darker plant-rich streaks
      const face = mixN(vec3(0.3, 0.27, 0.22), vec3(0.5, 0.45, 0.36), lam.mul(0.6).add(bed.mul(0.4))).mul(crumb.mul(0.3).add(0.85)).toVar()
      const lens = band(float(10.02).add(vnoise(vec2(x.mul(0.5), 1.1)).mul(0.06)), float(10.2).add(vnoise(vec2(x.mul(0.7), 5.1)).mul(0.07)))
      face.assign(mixN(face, vec3(0.5, 0.42, 0.3).mul(vnoise(vec2(x.mul(9).add(y.mul(26)), y.mul(60))).mul(0.4).add(0.75)), lens.mul(0.8)))
      face.assign(mixN(face, vec3(0.1, 0.085, 0.07), smoothstep(0.62, 0.8, vnoise(vec2(x.mul(0.6), y.mul(24).add(3)))).mul(0.7)))
      // above the seam: a hand of pale silt, then dark soil bound with roots
      const after = U.uAsh
      const tk = vnoise(vec2(x.mul(1.6), 3.3)).mul(0.008).add(0.042)
      const top = float(Y_K).add(tk)
      face.assign(mixN(face, vec3(0.6, 0.57, 0.48).mul(crumb.mul(0.25).add(0.85)), smoothstep(top, top.add(0.004), y).mul(after)))
      const soilAt = float(Y_K + 0.36).add(vnoise(vec2(x.mul(0.8), 1.7)).mul(0.1))
      const hair = fall(0.07, 0.02, abs(fract(x.mul(5.2).add(vnoise(vec2(x.mul(3), y.mul(4))).mul(1.4))).sub(0.5))).mul(smoothstep(soilAt, soilAt.add(0.2), y))
      face.assign(mixN(face, vec3(0.085, 0.066, 0.052).mul(crumb.mul(0.6).add(0.6)), smoothstep(soilAt.sub(0.03), soilAt.add(0.05), y)))
      face.assign(mixN(face, vec3(0.3, 0.24, 0.17), hair.mul(0.6)))
      // damp runs down from the seam
      face.mulAssign(mixN(1, 0.72, smoothstep(0.55, 0.8, vnoise(vec2(x.mul(1.9), y.mul(0.7)))).mul(fall(float(Y_K), float(Y_K - 0.5), y)).mul(after)))
      const lit = nearLit(face, N as V3, vO).toVar()
      lit.assign(mixN(lit, vec3(luma(lit)), after.mul(0.62)))
      // the boundary, dead level: a rust-red base a finger thick under a dark clay that stands proud and holds a wet light on its upper edge
      const sky = ambient().mul(N.y.mul(0.5).add(0.72)).mul(vO).mul(mixN(1.2, 2.5, U.uAsh))
      lit.assign(mixN(lit, vec3(0.8, 0.52, 0.36).mul(sky).mul(1.55).mul(crumb.mul(0.25).add(0.88)), band(float(Y_K - 0.04), float(Y_K)).mul(after)))
      const clay = band(float(Y_K), top).mul(after)
      lit.assign(mixN(lit, vec3(0.03, 0.03, 0.036).mul(sky).add(ambient().mul(smoothstep(0.2, 0.7, N.y)).mul(0.9)), clay))
      return vec4(lit, 1)
    })()
    const m = new THREE.Mesh(g, mat(null, frag))
    m.frustumCulled = false
    front.add(m)

    // what is in it and on it: cobbles weathering out of the sandy lens and lying where they fell,
    // roots let down from the soil, burnt twigs on the gully floor
    const R = rng(6601)
    const dp: number[] = [], dn: number[] = [], dk: number[] = []
    const ico = new THREE.IcosahedronGeometry(1, 2)
    const IP = ico.getAttribute("position")
    const rot = new THREE.Matrix4(), ev = new THREE.Euler(), p3 = new THREE.Vector3(), n3 = new THREE.Vector3()
    for (let i = 0; i < 110; i++) {
      const where = i < 50 ? 0 : i < 85 ? 1 : 2
      const r = where === 0 ? 0.025 + 0.05 * R() ** 2 : 0.03 + 0.08 * R() ** 2
      const x = (R() - 0.5) * 13
      const y = where === 0 ? (R() < 0.75 ? 10.04 + 0.16 * R() : 9.9 + 0.95 * R()) : where === 1 ? 9.74 + r * 0.3 : 11.22 + r * 0.2
      const z = where === 0 ? faceZ(x, y) - r * 0.25 : where === 1 ? -10.3 + 3.2 * R() ** 2 + (R() < 0.6 ? -0.35 : 0) : -11.5 - R() * 1.4
      const yy = where === 1 ? Math.max(y, 9.72 + Math.max(0, z + 10.25) * -0.02) : y
      const sx = 0.8 + 0.5 * R(), sy = 0.5 + 0.35 * R(), sz = 0.7 + 0.5 * R(), tone = 0.55 + 0.6 * R(), sd = R() * 40
      rot.makeRotationFromEuler(ev.set(R() * 0.5, R() * 6.28, R() * 0.5))
      for (let v = 0; v < IP.count; v++) {
        p3.fromBufferAttribute(IP, v)
        const lump = 1 + 0.22 * (vn(p3.x * 1.7 + sd, p3.y * 1.7 + p3.z * 1.3) - 0.5) * 2
        n3.set(p3.x / sx, p3.y / sy, p3.z / sz).normalize().applyMatrix4(rot)
        p3.set(p3.x * sx, p3.y * sy, p3.z * sz).multiplyScalar(r * lump).applyMatrix4(rot)
        dp.push(x + p3.x, yy + p3.y, z + p3.z)
        dn.push(n3.x, n3.y, n3.z)
        dk.push(0, tone)
      }
    }
    ico.dispose()
    const tube = (pts: THREE.Vector3[], r0: number, r1: number, kind: number, tone: number) => {
      const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 1, 5).toNonIndexed()
      const TP = tg.getAttribute("position"), TN = tg.getAttribute("normal"), TU = tg.getAttribute("uv")
      for (let v = 0; v < TP.count; v++) {
        const rr = mix(r0, r1, TU.getX(v) ** 0.8)
        dp.push(TP.getX(v) - TN.getX(v) * (1 - rr), TP.getY(v) - TN.getY(v) * (1 - rr), TP.getZ(v) - TN.getZ(v) * (1 - rr))
        dn.push(TN.getX(v), TN.getY(v), TN.getZ(v))
        dk.push(kind, tone)
      }
      tg.dispose()
    }
    for (let i = 0; i < 30; i++) {
      // a root leaves the soil, hangs and wanders; the stout ones turn back into the face
      const x = (R() - 0.5) * 11, y = 10.92 + 0.2 * R(), stout = i < 7
      const L = stout ? 0.5 + 0.5 * R() : 0.18 + 0.5 * R(), outw = stout ? 0.16 + 0.12 * R() : 0.05 + 0.1 * R(), dxr = (R() - 0.5) * 0.5
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 5; k++) {
        const u = k / 5
        const yk = y - L * u ** 1.2
        const bow = Math.sin(u * Math.PI) * outw * (stout ? 1 : 1.2 - 0.4 * u) + (stout ? 0 : outw * 0.5 * u)
        pts.push(new THREE.Vector3(x + dxr * u + 0.03 * Math.sin(k * 2.1 + i), yk, faceZ(x + dxr * u, yk) - 0.02 + bow))
      }
      tube(pts, stout ? 0.016 + 0.014 * R() : 0.006 + 0.005 * R(), stout ? 0.008 : 0.0015, 1, 0.7 + 0.5 * R())
    }
    for (let i = 0; i < 12; i++) {
      const onLip = i >= 8
      const x = (R() - 0.5) * 9, z = onLip ? -11.6 - R() : -9.9 + 2.4 * R(), y = onLip ? 11.235 : 9.735, a = R() * 3.14, L = 0.3 + 0.6 * R()
      const pts = [0, 0.35, 0.7, 1].map((u) => new THREE.Vector3(x + Math.cos(a) * L * (u - 0.5) + 0.04 * Math.sin(u * 9 + i), y + 0.012 + 0.03 * Math.sin(u * 3.1), z + Math.sin(a) * L * (u - 0.5)))
      tube(pts, 0.014 + 0.01 * R(), 0.004, 2, 1)
    }
    const dg = new THREE.BufferGeometry()
    dg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dp), 3))
    dg.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(dn), 3))
    dg.setAttribute("aK", new THREE.BufferAttribute(new Float32Array(dk), 2))
    const vDN = normalGeometry.toVarying("ldDN"), vDK = attribute("aK", "vec2").toVarying("ldDK")
    const dfrag = Fn(() => {
      const P = positionWorld
      const N = normalize(vDN).toVar()
      const speck = vnoise(P.xy.mul(70).add(P.z.mul(50)))
      const stone = mixN(vec3(0.3, 0.27, 0.23), vec3(0.5, 0.47, 0.41), speck).mul(vDK.y)
      const rootC = mixN(vec3(0.2, 0.15, 0.1), vec3(0.36, 0.29, 0.2), speck).mul(vDK.y)
      const alb = select(vDK.x.lessThan(0.5), stone, select(vDK.x.lessThan(1.5), rootC, vec3(0.02, 0.019, 0.02)))
      // a root is too thin to hold ash; a stone holds a cap of it
      const lit = nearLit(alb, vec3(N.x, mixN(N.y, N.y.mul(0.4), step(0.5, vDK.x).mul(step(vDK.x, 1.5))), N.z) as V3, float(0.9))
      return vec4(mixN(lit, vec3(luma(lit)), U.uAsh.mul(0.55)), 1)
    })()
    const dm = new THREE.Mesh(dg, mat(null, dfrag))
    dm.frustumCulled = false
    front.add(dm)
  }
  // three fiddleheads on the lip: ferns are the first thing back
  const fiddles: THREE.Mesh[] = []
  {
    const fmat = mat(null, Fn(() => vec4(vec3(0.15, 0.2, 0.1).mul(ambient().mul(1.4)).mul(uvGeo().x.mul(0.5).add(0.6)), 1))())
    for (const [x, h, ro] of [[-0.95, 0.24, 0.4], [-0.7, 0.17, 2.2], [1.3, 0.21, 4.0]] as [number, number, number][]) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 26; i++) {
        const u = i / 26
        if (u < 0.55) pts.push(new THREE.Vector3(0.012 * Math.sin(u * 5), (h * u) / 0.55, 0))
        else {
          const a = ((u - 0.55) / 0.45) * 7.4, r = 0.045 * (1 - ((u - 0.55) / 0.45) * 0.8)
          pts.push(new THREE.Vector3(0.045 - Math.cos(a) * r, h + Math.sin(a) * r, 0))
        }
      }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 5), fmat)
      m.position.set(x, 11.2, -11.35 + 0.3 * Math.sin(x * 0.7 + 1))
      m.rotation.y = ro
      fiddles.push(m)
      front.add(m)
    }
  }
  // a burnt bough the wind left across the gully
  const branch = (() => {
    // it lies along the top of the bank, its thick end on the ground, the rest propped a hand's width up on its own stubs
    const BP: [number, number][] = [[3.3, -13.0], [2.6, -12.45], [1.7, -12.3], [1.1, -11.95], [PERCH.x, PERCH.z], [0.0, -11.62], [-0.55, -11.72], [-1.0, -11.58]]
    const curve = new THREE.CatmullRomCurve3(BP.map(([x, z], i) => new THREE.Vector3(x, lipY(x, z) + mix(0.06, 0.09, i / 7) + 0.02 * Math.sin(i * 2.3), z)))
    const EMB = curve.getPoint(0.73).add(new THREE.Vector3(0, 0.027, 0.012)) // where the coal is: on top, toward the lens
    EMBW.copy(EMB)
    const g = new THREE.TubeGeometry(curve, 60, 1, 9)
    // taper it, and break two twigs off it
    const P = g.getAttribute("position"), Nn = g.getAttribute("normal"), UVa = g.getAttribute("uv")
    for (let i = 0; i < P.count; i++) {
      const u = UVa.getX(i)
      const r = mix(0.075, 0.016, u ** 0.8) * (1 + 0.16 * Math.sin(u * 47) * Math.sin(UVa.getY(i) * 12.6) + 0.1 * Math.sin(u * 131))
      P.setXYZ(i, P.getX(i) - Nn.getX(i) * (1 - r), P.getY(i) - Nn.getY(i) * (1 - r), P.getZ(i) - Nn.getZ(i) * (1 - r))
    }
    const uSag = U.uBird
    const vP = positionWorld.toVarying("ldBrP")
    const vN = normalGeometry.toVarying("ldBrN")
    const vUV = uvGeo().toVarying("ldBrU")
    const sag = uvGeo().x.mul(uvGeo().x).mul(uSag.z)
    const frag = Fn(() => {
      const N = normalize(vN)
      const amb = ambient()
      // char: a net of cracks with a dull sheen between them
      const ck = vnoise(vec2(vUV.x.mul(90), vUV.y.mul(14)))
      const crack = smoothstep(0.42, 0.5, abs(ck.sub(0.5)).mul(2).oneMinus())
      const alb = mixN(vec3(0.03, 0.028, 0.03), vec3(0.008, 0.008, 0.01), crack).toVar()
      alb.assign(mixN(alb, vec3(0.34, 0.34, 0.35), U.uAsh.mul(smoothstep(0.25, 0.8, N.y)).mul(ck.mul(0.5).add(0.6))))
      const Lh = normalize(vec3(SUNH.x, 0.25, SUNH.y))
      // one coal is still alight in the char: what the next scene's ember is
      const ed = length(vP.sub(vec3(EMB.x, EMB.y, EMB.z)))
      const coal = exp(sq(ed.div(0.034) as F).negate()).mul(sin(U.uT.mul(2.1)).mul(0.25).add(sin(U.uT.mul(5.3)).mul(0.1)).add(0.85)).mul(U.uAsh)
      alb.addAssign(vec3(14, 4, 0.7).mul(coal).mul(ck.mul(0.6).add(0.6)))
      const c = alb.mul(amb.mul(N.y.mul(0.4).add(0.7)).mul(mixN(1.2, 2.5, U.uAsh))).add(vec3(1, 0.62, 0.3).mul(U.uWarm).mul(max(dot(N, Lh), 0)).mul(0.05)).add(U.uS2C.mul(0.004))
      return vec4(c.add(vP.y.mul(0)), 1)
    })()
    const m = new THREE.Mesh(g, mat(viewProj.mul(vec4(positionGeometry.sub(vec3(0, sag, 0)), 1)), frag))
    m.frustumCulled = false
    front.add(m)
    return m
  })()
  // the bird: modelled with the toolkit (groundBird). It comes along the bank's top on its own feet, hops onto the bough, shakes
  // the ash off, looks at the lens and says one thing. The mammal comes up out of the ash by the fiddleheads.
  const BW = { on: false, hop: 0, y: PERCH.y, ruf: 0, yaw: 0, cock: 0, nod: 0, jaw: 0, dist: 0, p: new THREE.Vector3(), dir: [-0.8, 0, 0.6] as number[] }
  const birdAim = makeAim([PERCH.x, PERCH.y, PERCH.z], [-0.8, 0, 0.6])
  const birdGround = (x: number, z: number) => (BW.hop > 0 ? BW.y : lipY(x, z))
  const BIRD_FACE = [-0.83, 0, 0.56]
  actor(BIRD, BIRD_LOOK, 0.6, 0.32, [[[0, 0, 0], [1, 0, 0]]], [who(0, 0, 0, 1, 99)], {
    into: front, lods: [{ detail: 1, cover: 0 }], air: true, when: () => BW.on, coat: BIRD_COAT,
    extra(_i, d) {
      d.path = birdAim
      d.dist = BW.dist
      d.ground = birdGround
      d.look = null
      d.head = 0
      d.eyes = 0
      d.scale = 1 + 0.07 * BW.ruf
      d.ch.yaw = BW.yaw
      d.ch.cock = BW.cock
      d.ch.nod = BW.nod
      d.ch.ruf = BW.ruf * Math.sin(W.T * 41)
      d.ch.jaw = BW.jaw
    },
  })
  const mesoGround = (x: number, z: number) => lipY(x, z) - 0.12 * clamp((x + 0.12) / 0.2)
  const MESO_LOOKAT: [number, number, number] = [0, 0, 0]
  actor(MESODMA, MESO_LOOK, 0.23, 0.06, [[[0.1, 0, -11.5], [-0.5, 0, -11.52], [-1.2, 0, -11.47], [-2.0, 0, -11.44]]], [who(0, 0, 0.3, 1, 99)], {
    into: front, ground: mesoGround, lods: [{ detail: 1, cover: 0 }], air: true, when: () => W.t2 > 1.6,
    dist: (w) => w.v * halt(Math.max(W.t2 - 1.8, 0), 2.6, 0.9),
    extra(_i, d) {
      const tb = W.t2
      // a stop, the nose up and working; at the bird's call the head goes round to it
      d.ch.sniff = smooth(3.3, 3.9, tb) * (0.6 + 0.4 * Math.sin(W.T * 11)) * (1 - smooth(6.7, 6.9, tb))
      d.ch.yaw = 0.6 * Math.sin(W.T * 1.7) * smooth(3.5, 4.2, tb) * (1 - smooth(6.7, 6.9, tb))
      d.look = MESO_LOOKAT
      MESO_LOOKAT[0] = BW.p.x
      MESO_LOOKAT[1] = BW.p.y + 0.25
      MESO_LOOKAT[2] = BW.p.z
      d.head = smooth(6.85, 7.0, tb)
      d.eyes = d.head
    },
  })

  // ---------------------------------------------------------------- putting it together: focus, dust, the print
  const C = {
    tFar: uniformTexture(far.texture),
    tNear: uniformTexture(near.texture),
    uBF: uniform(0),
    uBN: uniform(0),
    uBrown: uniform(0),
    uPrint: uniform(1), // 1: an engraving; 0: the place itself
    uRev: uniform(0),
    uGlow: uniform(new THREE.Vector2(0.3, 0.45)),
    uExpo: uniform(1),
    uGrit: uniform(0),
    /** Heat shimmer over what burns (beat 2, late): 0..1. */
    uHeat: uniform(0),
    uHT: uniform(0),
  }
  const comp = ctx.pass(({ uv, res }) => {
    const px = vec2(1).div(res)
    const blur = (t: THREE.TextureNode, r: F, at: V2 = uv as V2): V4 => {
      const acc = sampleRT(t, at).toVar()
      If(r.greaterThan(0.05), () => {
        Loop({ type: "int", start: 1, end: 7, condition: "<" }, ({ i }) => {
          const k = float(i)
          const a = k.mul(2.39996)
          acc.addAssign(sampleRT(t, at.add(vec2(cos(a), sin(a)).mul(k.add(0.5).div(7).sqrt()).mul(r).mul(px)) as V2))
        })
        acc.divAssign(7)
      })
      return acc as V4
    }
    // heat shimmer: the air over a fire bends what is behind it. How hot the air is here: fire a little way below this pixel
    // (screen space, y up), its rising cells drifting upward and wobbling the picture by a few pixels
    const fuv = (uv as V2).toVar()
    If(C.uHeat.greaterThan(0.001), () => {
      const hotAt = (dy: number): F => {
        const c = sampleRT(C.tFar, uv.sub(vec2(0, dy)) as V2).rgb
        return smoothstep(0.35, 1.6, c.r.sub(c.b.mul(1.6)).mul(C.uExpo)) as F
      }
      const hot = hotAt(0.012).mul(0.3).add(hotAt(0.03).mul(0.4)).add(hotAt(0.06).mul(0.3)).toVar()
      const q = uv.mul(vec2(res.x.div(res.y), 1))
      const wx = vnoise(vec2(q.x.mul(70), q.y.mul(38).sub(C.uHT.mul(4.2)))).sub(0.5)
      const wy = vnoise(vec2(q.x.mul(55).add(13), q.y.mul(30).sub(C.uHT.mul(3.4)))).sub(0.5)
      fuv.addAssign(vec2(wx, wy.mul(0.6)).mul(hot).mul(C.uHeat).mul(px).mul(9))
    })
    const fa = blur(C.tFar, C.uBF as unknown as F, fuv as V2)
    const ne = blur(C.tNear, C.uBN as unknown as F)
    const col = fa.rgb.mul(ne.a.oneMinus()).add(ne.rgb).toVar()
    If(C.uBrown.greaterThan(0.001), () => {
      // the blast's dust: dark, rolling, thick in streaks and thin between them (the picture shows through the gaps)
      const grit = fbm(vec2(uv.x.mul(2.5).sub(C.uGrit), uv.y.mul(11).add(uv.x.mul(2)))).toVar()
      const roll = fbm(vec2(uv.x.mul(1.1).sub(C.uGrit.mul(0.45)), uv.y.mul(3.2).sub(uv.x.mul(0.8))))
      const thick = smoothstep(0.25, 0.75, grit.mul(0.6).add(roll.mul(0.6)).sub(0.1))
      const dust = vec3(0.2, 0.115, 0.055).mul(grit.mul(grit).mul(2.4).add(0.08)).mul(uv.y.mul(0.6).add(0.55))
      col.assign(mixN(col.mul(mixN(1, 0.5, C.uBrown)), dust, C.uBrown.mul(thick.mul(0.5).add(0.5))))
    })
    // ---- Plate II: the same picture as a line engraving, hand-coloured from the glow outward
    If(C.uPrint.greaterThan(0.001), () => {
    const q = uv.mul(res).mul(float(720).div(res.y)).toVar()
    const tone = (c: V3): F => {
      const x = c.mul(C.uExpo).mul(1.25)
      return pow(luma(x.div(x.add(1))), 0.62) as F
    }
    const t0 = tone(col as V3).toVar()
    const e = px.mul(1.2)
    const tA = tone(sampleRT(C.tFar, uv.add(vec2(e.x, 0)) as V2).rgb as V3)
    const tB = tone(sampleRT(C.tFar, uv.sub(vec2(e.x, 0)) as V2).rgb as V3)
    const tC = tone(sampleRT(C.tFar, uv.add(vec2(0, e.y)) as V2).rgb as V3)
    const tD = tone(sampleRT(C.tFar, uv.sub(vec2(0, e.y)) as V2).rgb as V3)
    const edge = smoothstep(0.035, 0.14, abs(tA.sub(tB)).add(abs(tC.sub(tD))))
    const dk = t0.oneMinus().toVar()
    const wob = vnoise(q.mul(0.004)).mul(9)
    // an engraver's line swells with the dark: one set that leans with the land, a second across it in the shadows
    const line = (ang: number, pitch: number, lo: number, gain: number): F => {
      const d = abs(fract(q.x.mul(Math.cos(ang)).add(q.y.mul(Math.sin(ang))).add(wob).div(pitch)).sub(0.5)).mul(2)
      const wd = clampN(dk.sub(lo).mul(gain), 0, 0.78)
      return fall(wd.add(0.16), wd.sub(0.16), d).mul(step(0.02, wd)) as F
    }
    const ink = max(max(line(1.45, 5.2, 0.1, 0.95), line(0.5, 5.6, 0.56, 1.6)), edge.mul(0.9)).toVar()
    const fib = fbm(q.mul(0.02)).sub(0.5)
    const laid = sin(q.y.mul(6.2832 / 3.1)).mul(0.012).add(exp(sq(fract(q.x.div(118)).sub(0.5).div(0.02) as F).negate()).mul(-0.03))
    const paper = vec3(1.42, 1.2, 0.86).mul(fib.mul(0.1).add(1).add(laid))
    const print = mixN(paper, vec3(0.085, 0.045, 0.024), clampN(ink, 0, 1).mul(0.93)).toVar()
    // colour arrives as a wash over the print, then the print lets go
    const lum = max(luma(col), 1e-4)
    const wash = print.mul(mixN(vec3(1), clampN(col.div(lum), 0, 2.2), 0.85)).mul(mixN(1, 0.8, dk))
    const dd = length(uv.sub(C.uGlow).mul(vec2(res.x.div(res.y), 1)))
    const reach = C.uRev.mul(2.9).sub(dd).add(fib.mul(0.5))
    const real = mixN(print, mixN(wash, col, smoothstep(0.35, 1.1, reach)), smoothstep(0.0, 0.4, reach))
    col.assign(mixN(col, real, C.uPrint))
    })
    return vec4(col, 1)
  }, C)

  // ---------------------------------------------------------------- what a frame is, in numbers
  const W = { trem: 0, shot: 2, t0: 0, t1: -1, t2: -1, T: 0, print: 1, flash: 0, sx: 0, sy: 0, starOn: 0, expo: 1, shakeA: 0, ash: 0, brown: 0, dark: 0 }
  const v0 = new THREE.Vector3()
  const sdir = new THREE.Vector3()
  const b0 = ctx.def.beats[0], b1 = ctx.def.beats[1]
  const L0 = b0.dur + b0.hold, L1 = b1.dur + b1.hold

  const POST: PostOpts = { tone: "aces", exposure: 1, bloom: 0.5, bloomThresh: 1.0, bloomRadius: 0.8, halation: 0.4, vignette: 0.26, ca: 0.0006, sat: 1.06, contrast: 1.06, grain: 0.024, lift: [0, 0, 0], gain: [1, 1, 1] }
  const TITLES: TitleOpts = { color: "#fff1dc", delay: [0.9, T_HIT, 1.0], maxLine: 26, shadow: "rgba(30,14,30,0.55)" }
  const HUD = { color: "#fff1dc", hide: false }

  const lp: [number, number, number] = [0, 0, 0]
  const v1 = new THREE.Vector3()
  const a0x = (a: Actor) => a.x[0], a0z = (a: Actor) => a.z[0]
  const birdPos = (): [number, number, number] => listenerPos(BW.p, cam, 6, lp)
  const starPos = (): [number, number, number] => [clamp((W.sx / DW) * 2 - 1, -1, 1), clamp(1 - (W.sy / DH) * 2, -1, 1), 2.5]
  // ---- footfalls, from the gait itself: a foot comes down where its phase (distance over stride, plus the leg's offset in
  // the walk) crosses a whole number. Walked out once here on the same closed-form clock the animals use, so every cue is on
  // a planted foot, positioned on it, and louder the nearer the lens is at that moment.
  const STEP: Record<string, { f: number; g: number; lfe: number; s?: string }> = {
    triceratops: { f: 41, g: 0.75, lfe: 0.9 }, triceratopsYoung: { f: 55, g: 0.45, lfe: 0.5 }, edmontosaurus: { f: 47, g: 0.5, lfe: 0.7 },
    tyrannosaurus: { f: 33, g: 1, lfe: 1 }, ankylosaurus: { f: 62, g: 0.4, lfe: 0.5 }, acheroraptor: { f: 150, g: 0.22, lfe: 0 },
  }
  /** A shot's lens, roughly, at beat b and t seconds: for how loud a footfall is. */
  const lensAt = (b: number, t: number, o: THREE.Vector3) => (b === 0 && t < SHOT_B ? o.set(2.2, 2, -91) : b === 0 && t < SHOT_C ? o.set(6.7, 1.8, -89) : o.set(0, EYE, -3))
  const walkAt = (b: number, t: number) => (b === 0 ? t : L0 + Math.min(t, T_HIT) + (t > T_HIT ? (1 - Math.exp(-(t - T_HIT) * 2.2)) / 2.2 : 0))
  const steps: Cue[] = []
  {
    const lens = new THREE.Vector3(), q = [0, 0, 0, 0, 0, 0]
    for (const a of cast) {
      const st = STEP[a.name], gs = a.herd.spec.gait
      if (!st || !gs || a.o.dist) continue
      const legs = legsOf(a.herd.spec)
      a.who.forEach((w) => {
        const Ls = gs.stride * w.sc
        for (const b of [0, 1]) {
          const end = b === 0 ? L0 : T_HIT
          const last = legs.map((l) => Math.floor(distOf(w, walkAt(b, 0)) / Ls + l.off))
          for (let t = 1 / 120; t <= end; t += 1 / 120) {
            const dist = distOf(w, walkAt(b, t))
            legs.forEach((l, li) => {
              const k = Math.floor(dist / Ls + l.off)
              if (k <= last[li]) return
              last[li] = k
              // where it came down: the body's place along the path, the foot's lead and its side
              const s0 = (k + gs.duty / 2 - l.off) * Ls + l.x * w.sc
              a.paths[w.p].at(s0, q)
              const hl = Math.hypot(q[3], q[5]) || 1, side = w.lane + l.z * w.sc
              const P = new THREE.Vector3(q[0] - (q[5] / hl) * side, 0.05, q[2] + (q[3] / hl) * side)
              const g = st.g * w.sc * Math.min(1, (7 / P.distanceTo(lensAt(b, t, lens))) ** 0.85) * (l.fore ? 0.8 : 1)
              if (g < 0.018) return
              const out: [number, number, number] = [0, 0, 0]
              steps.push({ b, at: t, s: "thud", o: { f: st.f * (1 + 0.04 * Math.sin(k * 3.7 + li)), g, lfe: st.lfe * Math.min(1, g * 2), wet: 0.6 }, pos: () => listenerPos(P, cam, 10, out) })
              // the big ones' steps carry a little grit and a creak of hide with them
              if (g > 0.25) steps.push({ b, at: t + 0.03, s: "scratch", o: { g: g * 0.12 }, pos: () => listenerPos(P, cam, 10, out) })
            })
          }
        }
      })
    }
  }
  // wingbeats, on the fliers' own flapping windows (1.3 beats a second, the downstroke)
  const wings: Cue[] = FLAPS.flatMap(([i, a, b]) =>
    Array.from({ length: Math.floor((b - a - 0.3) * 1.3) + 1 }, (_, k): Cue => ({ b: 0, at: a + 0.15 + k / 1.3, s: "flap", o: { g: i === 0 ? 0.35 : 0.12, f: 180 }, pos: () => { fliers.paths[i].at(fliers.who[i].d0 + fliers.who[i].v * W.T, pp); v0.set(pp[0], pp[1], pp[2]); return listenerPos(v0, cam, 10, lp) } })).filter((c) => c.at < L0),
  )
  const cues: Cue[] = [
    ...steps,
    ...wings,
    ...typeCues(0, BUB_T + 0.25, BUB_T + 0.25 + BUBBLE.length / 17, BUBBLE.length, "type"),
    { b: 0, at: BUB_T, s: "select", o: { g: 0.6 }, pos: starPos },
    // the evening: insects either side, one bird, something large and far away, wings overhead
    ...Array.from({ length: 15 }, (_, i): Cue => ({ b: 0, at: 0.7 + i * 0.74, s: "tick", o: { f: 5200 + ((i * 677) % 1500), g: 0.1 + 0.05 * (i % 3), wet: 0.2 }, pos: [i % 2 ? 0.85 : -0.8, -0.2 + 0.1 * (i % 4), i % 3 ? 0.1 : -0.6] })),
    ...Array.from({ length: 15 }, (_, i): Cue => ({ b: 0, at: 0.74 + i * 0.74, s: "tick", o: { f: 5600 + ((i * 419) % 1300), g: 0.08, wet: 0.2 }, pos: [i % 2 ? 0.8 : -0.85, -0.25, i % 3 ? 0.1 : -0.6] })),
    { b: 0, at: 2.4, s: "chirp", o: { g: 0.5 }, pos: [-0.75, 0.25, 0.5] },
    // calls: the horned ones low and close, the duck-bills' hoot across the water, the tyrant once, far off
    { b: 0, at: 2.9, s: "pad", o: { f: H(2), dur: 1.4, g: 0.32 }, pos: () => listenerPos(v1.set(a0x(hero), 2.2, a0z(hero)), cam, 10, lp) },
    { b: 0, at: 7.9, s: "pad", o: { f: H(5), dur: 1.8, g: 0.18 }, pos: [-0.2, -0.1, 2.2] },
    { b: 0, at: 9.2, s: "pad", o: { f: H(4), dur: 2.0, g: 0.16 }, pos: [0.1, -0.1, 2.4] },
    { b: 0, at: 10.8, s: "rumble", o: { dur: 1.6, g: 0.22 }, pos: () => listenerPos(v1.set(a0x(tyrant), 4, a0z(tyrant)), cam, 10, lp) },
    // no warning: the star falls; then nothing at all
    { b: 1, at: T_FALL, s: "crack", o: { g: 0.45 }, pos: starPos },
    { b: 1, at: T_FALL, s: "whoosh", o: { f: 1400, dur: 0.6, g: 0.5 }, pos: starPos },
    { b: 1, at: T_HIT + 0.5, s: "glass", o: { f: H(96), g: 0.08, wet: 2 }, pos: [0.3, 0.1, 3] },
    // the stands go down, nearer and louder; the lake; then the wall and the sound that travelled with it
    ...Array.from({ length: 9 }, (_, i): Cue => ({ b: 1, at: 5.0 + i * 0.12, s: "crack", o: { g: 0.12 + i * 0.07 }, pos: [((i * 37) % 17) / 8.5 - 1, -0.1, 2.4 - i * 0.27] })),
    { b: 1, at: 5.72, s: "splash", o: { g: 0.6 }, pos: [0.1, -0.25, 0.9] },
    { b: 1, at: T_FRONT1 - 1.0, s: "riser", o: { dur: 1.0, g: 0.5 } },
    { b: 1, at: T_FRONT1, s: "sub", o: { g: 1, lfe: 1, dur: 3 } },
    { b: 1, at: T_FRONT1, s: "boom", o: { f: 44, dur: 3.2, g: 1 } },
    { b: 1, at: T_FRONT1 + 0.02, s: "thud", o: { f: 58, g: 1 }, pos: [0, 0, -0.5] },
    { b: 1, at: T_FRONT1 + 0.04, s: "crack", o: { g: 0.9 }, pos: [0.6, 0.1, -0.2] },
    { b: 1, at: T_FRONT1 + 0.3, s: "rumble", o: { dur: 3.5, g: 0.7 } },
    // what went up comes down
    { b: 1, at: 7.3, s: "crackle", o: { dur: 3.4, g: 0.4 }, pos: [0, 0.8, 1] },
    { b: 1, at: 7.7, s: "hiss", o: { dur: 2.5, g: 0.3 }, pos: [-0.6, 0.6, 0.8] },
    ...[7.9, 8.5, 9.0, 9.8, 10.4].map((at, i): Cue => ({ b: 1, at, s: "thud", o: { f: 70 + i * 9, g: 0.35 - i * 0.04 }, pos: [i % 2 ? 0.8 : -0.7, -0.3, i < 2 ? 1.2 : -0.7] })),
    // after: ash ticking down, wings, feathers, one chirp
    ...Array.from({ length: 10 }, (_, i): Cue => ({ b: 2, at: 0.9 + i * 1.07, s: "tick", o: { f: 2600 + ((i * 331) % 900), g: 0.045, wet: 0.5 }, pos: [((i * 53) % 19) / 9.5 - 1, -0.4, i % 2 ? 0 : -0.5] })),
    { b: 2, at: 3.32, s: "flap", o: { g: 0.3 }, pos: birdPos },
    { b: 2, at: 3.42, s: "flap", o: { g: 0.22 }, pos: birdPos },
    { b: 2, at: 4.85, s: "flap", o: { g: 0.16 }, pos: birdPos },
    { b: 2, at: 5.0, s: "scratch", o: { g: 0.12 }, pos: birdPos },
    { b: 2, at: 6.8, s: "chirp", o: { g: 0.95, wet: 1.4 }, pos: birdPos },
  ]

  function update(s: State) {
    const t0 = clamp(s.at(0), -6, L0)
    const t1 = s.beat >= 1 ? clamp(s.at(1), 0, L1) : -1
    const t2 = s.beat >= 2 ? clamp(s.at(2), 0, 60) : -1
    const T = Math.max(t0, 0) + Math.max(t1, 0) + Math.max(t2, 0)
    W.t0 = t0
    W.t1 = t1
    W.t2 = t2
    W.T = T
    const asp = s.w / s.h
    U.uT.value = T

    // ---- the print lets go after the page lands
    W.print = 1 - smooth(1.5, 2.6, t0)
    C.uPrint.value = W.print
    C.uRev.value = smooth(0.15, 2.3, t0)

    // ---- the second sun
    const ash = s.k(2, 0, 1.5, E.io2)
    W.ash = ash
    const fall = t1 < 0 ? 0 : E.in2(clamp((t1 - T_FALL) / (T_HIT - T_FALL)))
    const hit = t1 >= T_HIT
    const since = t1 - T_HIT
    const az = mix(STAR_AZ, HIT_AZ, fall), el = mix(STAR_EL, HIT_EL, fall)
    U.uBol.value.set(az, el, t1 >= T_FALL && !hit ? 1 : 0, t1 < T_FALL ? 0 : hit ? Math.exp(-since * 1.1) * (1 - ash) : 1)
    U.uStar.value = (1 + 1.3 * smooth(0, L0, t0) + (t1 >= 0 && t1 < T_FALL ? 14 * (t1 / T_FALL) ** 2 : 0)) * (hit ? 0 : 1)
    const flash = !hit ? 0 : smooth(0, 0.07, since) * (since < 0.5 ? 1 : Math.exp(-(since - 0.5) * 1.15))
    W.flash = flash
    U.uFlash.value = flash
    U.uFlashK.value = !hit ? 80 : 0.8 + 70 * Math.exp(-since * 7)
    const frontT = t1 < 0 ? -1 : t1
    const past = s.beat > 1 ? 1 : smooth(T_FRONT1 - 0.1, T_FRONT1 + 1.4, frontT)
    U.uDome.value = (hit ? smooth(0.1, 1.6, since) * (1 - 0.75 * past) : 0) * (1 - ash)
    U.uRed.value = past * (1 - ash)
    U.uAsh.value = ash
    U.uWarm.value = 0.3 * s.k(2, 2.5, 8, E.io2) + 0.45 * s.k(2, 8, 12.5, E.io2)
    U.uEj.value = hit ? smooth(0.7, 4.6, since) * (1 - smooth(T_FRONT1 - 1.2, T_FRONT1 + 0.4, t1)) * (1 - ash) : 0
    U.uFire.value = smooth(T_FRONT1 + 0.4, T_FRONT1 + 2.2, frontT) * (1 - ash)
    // what it sends, and the shadow a unit of height throws
    const elS = !hit ? Math.max(el, 1.6 * DEG) : (2.2 + 3.8 * smooth(0, 5, since)) * DEG
    dirOf(az, elS, sdir)
    U.uS2.value.copy(dirOf(az, Math.max(el, 0.2 * DEG), v0))
    const inten = t1 < 0 ? 0 : !hit ? (t1 < T_FALL ? 0 : 0.25 + 2.5 * fall) : (9 * Math.exp(-since * 0.9) + 1.3 * smooth(0.5, 2, since)) * (1 - past)
    U.uS2C.value.set(1, hit ? mix(0.95, 0.6, smooth(0.5, 3, since)) : 0.9, hit ? mix(0.88, 0.3, smooth(0.5, 3, since)) : 0.75).multiplyScalar(inten)
    const len = Math.min(1 / Math.tan(elS), 13)
    const hl = Math.hypot(sdir.x, sdir.z)
    U.uSh.value.set((-sdir.x / hl) * len, (-sdir.z / hl) * len, clamp(inten / 0.7) * (1 - past) * (hit ? (0.3 + 0.7 * Math.exp(-since * 0.55)) * (1 - smooth(T_FRONT0 - 0.6, T_FRONT0 + 0.6, t1)) : 1))
    // the evening's own shadows lie away from where the sun went, soft; the second sun drowns them
    U.uShE.value.set(-Math.sin(SUN_AZ) * 2.2, Math.cos(SUN_AZ) * 2.2, (1 - ash) * (1 - past) * (1 - clamp(inten / 0.5)))
    ambJ()
    // the animals: their walking clock runs down at the flash; heads go to the star, then to where it fell
    LIFE.walk = Math.max(t0, 0) + (t1 < 0 ? 0 : Math.min(t1, T_HIT) + (t1 > T_HIT ? (1 - Math.exp(-(t1 - T_HIT) * 2.2)) / 2.2 : 0))
    LIFE.t0 = t0
    LIFE.flash = t1 > T_HIT ? E.out3(clamp((t1 - T_HIT - 0.1) / 0.7)) : 0
    // the ground under the lens answers each of the nearest one's footfalls (down on the plain only): a ring that dies in a tenth of a second
    {
      const sp = LIFE.walk < HERO.stop ? 1 : clamp(1 - (LIFE.walk - HERO.stop) / 1.6)
      const ph = distOf(HERO, LIFE.walk) / CERATOPSIAN.gait!.stride
      let tr = 0
      for (const l of HERO_LEGS) {
        const f = ph + l.off - Math.floor(ph + l.off)
        tr += Math.exp(-f * 22) * Math.cos(f * 110) * (l.fore ? 0.75 : 1)
      }
      W.trem = s.beat === 0 && t0 < SHOT_C ? tr * sp : 0
    }
    dirOf(hit ? HIT_AZ : STAR_AZ, hit ? 3 * DEG : STAR_EL, v0)
    // (the rig turns a neck from its rest pose by a clamped angle: aim high, so a grazing head comes right up)
    LOOKAT[0] = v0.x * 3000
    LOOKAT[1] = 2600
    LOOKAT[2] = v0.z * 3000
    KEY.sil.value = 1 - 0.9 * clamp(flash * 1.6)
    // one key light: the glow where the sun went, until the second sun outshines it
    const glow = 0.5 * (1 - ash) * (1 - past), k2 = Math.min(inten, 6) * 0.6
    KEY.dir.value.set(SUN.x * glow + U.uS2.value.x * k2, 0.2 * glow + (U.uS2.value.y + 0.1) * k2 + 1e-3, SUN.z * glow + U.uS2.value.z * k2).normalize()
    KEY.col.value.set(1.5 * glow + U.uS2C.value.x * 0.6, 0.62 * glow + U.uS2C.value.y * 0.6, 0.26 * glow + U.uS2C.value.z * 0.6)
    // once every spray is gone, a tree is its bark
    const stripped = s.beat > 1 || t1 > T_FRONT1 + 2.4
    for (const l of leafy) {
      l.g.setDrawRange(0, stripped ? l.t.nBark : l.t.nAll)
      l.m.visible = !stripped || l.t.nBark > 0
    }
    U.uMidge.value = (1 - W.print) * (t1 > T_HIT ? Math.exp(-(t1 - T_HIT) * 6) : 1) * (s.beat > 1 ? 0 : 1)
    wall.visible = s.beat === 1 && t1 > T_FRONT0 - 0.1 && t1 < T_FRONT1 + 1.2
    for (const m of ashes) m.visible = ash > 0.001

    // ---- the front
    const fu = t1 < 0 ? 99 : s.beat > 1 ? -9 : (T_FRONT1 - t1) / (T_FRONT1 - T_FRONT0)
    U.uFU.value = fu
    U.uFZ.value = fu > 1 ? -99999 : fu > 0 ? -FRONT_FAR * fu ** FRONT_EXP : -fu * 600
    const after = t1 - T_FRONT1
    W.brown = s.beat === 1 && after > -0.15 ? smooth(-0.15, 0.05, after) * Math.exp(-Math.max(after, 0) * 0.9) : 0
    C.uBrown.value = W.brown * 0.93
    C.uGrit.value = T * 7
    // heat shimmer over the burning plain, once the fires have taken (late in beat 2), gone under the ash
    C.uHeat.value = s.beat === 1 ? smooth(T_FRONT1 + 1.2, T_FRONT1 + 3.2, t1) * (1 - ash) : 0
    C.uHT.value = T
    // (the air after the front is ash-laden but not milk: thin enough near to that the burnt stands read black against it)
    U.uDust.value = (s.beat === 1 && after > 0 ? 0.003 * Math.exp(-after * 1.1) + 0.00025 : 0) * (1 - ash) + 0.00035 * ash
    U.uHaze.value = mix(0.00052, 0.0007, ash)
    U.uWind.value = 1 + (s.beat === 1 && after > 0 ? 5 * Math.exp(-after * 0.7) : 0)
    W.shakeA = s.beat === 1 && after > 0 ? Math.exp(-after * 3.4) : 0

    // ---- the lens. Beat 1: down on the plain beside the horned ones (A), moving with them toward the water (B), then the
    // tripod on the bluff (C), which pushes slowly, is shaken once and tilts down. A later beat is always the tripod.
    const tc = Math.max(t0, 0)
    const shot = s.beat > 0 || tc >= SHOT_C ? 2 : tc >= SHOT_B ? 1 : 0
    W.shot = shot
    const land = Math.max(t0, 0)
    const knock = t0 > 0 ? Math.exp(-land * 4.2) * Math.sin(land * 17) : 0
    const sh = shake(T, 1, 3.1)
    const k = W.shakeA
    const live = W.print < 0.5 ? 1 : 0
    const wide = asp < 1.6 ? 1.6 / asp : 1
    const tilt = s.k(2, 0.6, 4.4, E.io3)
    cam.aspect = asp
    cam.rotation.order = "YXZ"
    if (shot === 2) {
      // beat 3: after the tilt, a slow creep toward the bird and a longer lens through the hold
      // after the front the lens drifts sideways while the fires burn (parallax); beat 3 creeps in until the bird is a quarter of the frame
      const creep = s.k(2, 2.6, 6.5, E.io2) * 0.35 + s.k(2, 6.2, 12, E.io2) * 0.65
      const xd = s.beat === 1 ? 2.2 * smooth(T_FRONT1 + 0.6, L1, t1) : s.beat > 1 ? 2.2 * (1 - tilt) : 0
      const push = 2.3 * smooth(-0.5, L0 + 1, t0) + 0.9 * clamp(t1 / L1) + 6.05 * creep
      cam.fov = (mix(mix(40, 35.5, smooth(0, L0, t0)), 33, tilt) - 1.4 * W.flash - 7 * creep) * wide
      cam.position.set(xd + 0.05 * Math.sin(T * 0.21) * live + sh[0] * 0.45 * k + s.mouse.x * 0.12 + 0.45 * creep, EYE + 0.03 * Math.sin(T * 0.27 + 1) * live + sh[1] * 0.3 * k + 0.02 * knock + s.mouse.y * 0.06 - 1.2 * creep, -push + sh[2] * 0.3 * k)
      cam.rotation.set((2.6 - 16.6 * tilt - 5.7 * creep) * DEG + 0.002 * Math.sin(T * 0.23 + 2) * live + sh[0] * 0.045 * k + 0.004 * knock, 0.003 * Math.sin(T * 0.17) * live + sh[1] * 0.035 * k - s.mouse.x * 0.006 + 0.012 * (xd / 2.2) * (s.beat === 1 ? 1 : 0), sh[2] * 0.03 * k + 0.0015 * knock)
    } else {
      // where the nearest one's head is: the lens is framed on it
      hero.paths[0].at(distOf(HERO, LIFE.walk) + 3.9, pp)
      const hz = pp[2]
      const hh = shake(T, 1, 0.55)
      if (shot === 0) {
        // the lens stands a stride off its line, a little above its back, and turns only a little: the animal walks through the
        // frame and past, low in it, under the type; every footfall reaches the tripod
        const u = tc / SHOT_B
        cam.fov = mix(40, 38, u) * wide
        cam.position.set(2.5 - 0.5 * E.io2(u) + hh[0] * 0.03 + s.mouse.x * 0.1 + W.trem * 0.004, 2.05 + hh[1] * 0.02 + 0.015 * knock + s.mouse.y * 0.05 + W.trem * 0.006, -91.2 + 0.3 * u)
        const az = Math.atan2(mix(0.6, 4.6, E.io2(u)) - cam.position.x, -(hz - cam.position.z))
        cam.rotation.set(1.6 * DEG + hh[2] * 0.004 + 0.003 * knock + W.trem * 0.0016, -az + hh[0] * 0.004 - s.mouse.x * 0.006, hh[1] * 0.003 + 0.001 * knock + W.trem * 0.001)
      } else {
        const u = (tc - SHOT_B) / (SHOT_C - SHOT_B), e = E.out3(clamp(u * 1.25))
        cam.fov = mix(37.5, 33.5, e) * wide
        cam.position.set(mix(5.6, 7.8, e) + hh[0] * 0.03 + s.mouse.x * 0.1 + W.trem * 0.003, mix(1.95, 1.66, e) + hh[1] * 0.02 + s.mouse.y * 0.05 + W.trem * 0.004, mix(-87.4, -90.35, e))
        cam.rotation.set(mix(4.5, 6.2, e) * DEG + hh[2] * 0.004, -mix(-11, -5, e) * DEG + hh[0] * 0.004 - s.mouse.x * 0.006, hh[1] * 0.003)
      }
    }
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
    KEY.col.value.multiplyScalar(shot === 2 ? 1.5 : 2.6)
    CAMV[0] = cam.position.x
    CAMV[1] = cam.position.y
    CAMV[2] = cam.position.z
    KEY.fill.value = shot === 2 ? 2.4 : 6
    uDesat.value = 0.8 * ash
    // the nearest one is by the lens in A and B, and one of the far world's animals from the bluff
    const want = shot === 2 ? world : close
    if (hero.herd.group.parent !== want) want.add(hero.herd.group)

    // ---- focus. On the plain: the animal by the lens, the world behind it soft, until the focus is pulled from its eye to
    // the star. From the bluff: the plain while there is a plain to look at, then the bank and the branch
    const px = s.h / 720
    const rack = smooth(7.5, 8.7, tc)
    C.uBF.value = (shot === 2 ? 3.6 * tilt : shot === 1 ? 3.2 * (1 - rack) : 2.6) * px
    C.uBN.value = (shot === 2 ? 6 * (1 - s.k(2, 0.8, 3.6, E.io2)) : shot === 1 ? 5.5 * rack : 0) * px
    v0.copy(SUN).setY(0.02).multiplyScalar(5000).add(cam.position).project(cam)
    C.uGlow.value.set(v0.x * 0.5 + 0.5, v0.y * 0.5 + 0.5)

    // ---- where the star is on the slide, for the reviewer
    dirOf(STAR_AZ, STAR_EL, v0).multiplyScalar(5000).add(cam.position).project(cam)
    W.sx = (v0.x * 0.5 + 0.5) * DW
    W.sy = (0.5 - v0.y * 0.5) * DH


    // ---- the branch and the bird (beat 3). It hops up at 3.4, shakes the ash off, looks at the lens, says one thing.
    branch.visible = s.beat > 1 || (s.beat === 1 && after > 0.05)
    const tb = t2
    const T_WALK = 2.1, T_LAND = 3.4, T_RUF = 4.8, T_LOOK = 5.9, T_CHIRP = 6.8
    BW.on = tb > T_WALK
    const sinceL = tb - T_LAND - 0.28, sinceR = tb - T_RUF - 0.75
    const ruf = tb > T_RUF && tb < T_RUF + 0.9 ? Math.sin(((tb - T_RUF) / 0.9) * Math.PI) ** 0.6 : 0
    const chirp = tb > T_CHIRP && tb < T_CHIRP + 0.26 ? Math.sin(((tb - T_CHIRP) / 0.26) * Math.PI) : 0
    // the bough gives under it and rings: on landing, and again when it settles its feathers
    const sag = (sinceL > 0 ? 0.012 * (1 - Math.exp(-sinceL * 5) * Math.cos(sinceL * 15)) : 0) + (sinceR > 0 ? 0.005 * Math.exp(-sinceR * 4) * Math.sin(sinceR * 17) : 0) + 0.002 * chirp
    U.uBird.value.set(ruf, chirp, sag, 1)
    // along the top of the bank on its own feet, then up onto the bough in one hop
    const WALK_L = 1.27, wx = (0.85 - 2.1) / WALK_L, wz = (-11.58 + 11.5) / WALK_L
    const walked = WALK_L * E.io2(clamp((tb - T_WALK) / 1.2))
    const hop = clamp((tb - T_LAND) / 0.28)
    const perchTop = lipY(PERCH.x, PERCH.z) + 0.112 - sag * 1.6
    if (hop <= 0) {
      BW.hop = 0
      BW.dist = walked
      birdAim.set([2.1, 0, -11.5], [wx, 0, wz])
      BW.p.set(2.1 + wx * walked, lipY(2.1 + wx * walked, -11.5 + wz * walked), -11.5 + wz * walked)
    } else {
      const e = E.io2(hop)
      const fx = mix(wx, BIRD_FACE[0], e), fz = mix(wz, BIRD_FACE[2], e), fl = Math.hypot(fx, fz)
      BW.hop = hop
      BW.dist = WALK_L
      BW.p.set(mix(0.85, PERCH.x, e), mix(lipY(0.85, -11.58), perchTop, e) + 0.13 * Math.sin(Math.PI * hop), mix(-11.58, PERCH.z, e))
      BW.y = BW.p.y + 0.006 * ruf * Math.sin(T * 60)
      birdAim.set([BW.p.x - (fx / fl) * WALK_L, BW.p.y, BW.p.z - (fz / fl) * WALK_L], [fx / fl, 0, fz / fl])
    }
    // the head goes from place to place in snaps and is still in between
    const snapTo = (at: number, v: number) => v * E.out3(clamp((tb - at) / 0.09))
    BW.yaw = snapTo(T_LAND + 0.7, -0.5) + snapTo(T_LAND + 1.05, 0.8) + snapTo(T_LOOK, 0.9) + snapTo(T_CHIRP + 1.5, -0.6) + snapTo(T_CHIRP + 3.2, -1.0) + snapTo(T_CHIRP + 4.6, 0.8)
    BW.cock = snapTo(T_LOOK + 0.5, 0.8) + snapTo(T_CHIRP - 0.1, -0.8) + snapTo(T_CHIRP + 3.2, 0.5)
    BW.nod = 0.3 * ruf + snapTo(T_WALK + 0.4, 0.6) + snapTo(T_WALK + 0.8, -0.6) + snapTo(T_CHIRP + 3.2, 0.5) - 0.6 * chirp
    BW.ruf = ruf
    BW.jaw = chirp
    if (s.beat > 1) {
      // the bird in beat 3: the coal beside it is its key, warm and low, flickering; the grey sky a cool fill; its colour kept
      const fl = 0.85 + 0.25 * Math.sin(T * 2.1) + 0.1 * Math.sin(T * 5.3)
      KEY.dir.value.copy(EMBW).sub(BW.p).setY(0.12).normalize()
      KEY.col.value.set(2.6, 0.95, 0.3).multiplyScalar(fl * smooth(1, 3, t2))
      KEY.fill.value = 1.5
      uDesat.value = 0.3
    }
    const fern = s.k(2, 1.5, 6, E.io2)
    for (const f of fiddles) {
      f.visible = fern > 0.01
      f.scale.setScalar(Math.max(fern, 0.01))
    }

    // ---- exposure: the eye stops down for the flash and opens for the ash
    // (and stops down under the blast's dust, which would otherwise lift to a flat beige)
    W.expo = (1 - 0.5 * flash) * (1 - 0.35 * W.brown) * mix(1, 1.9, ash)
    C.uExpo.value = W.expo
    W.dark = flash

    // pose the herds for this frame, and put a pool of shadow under each animal that is there
    let ns = 0
    for (const a of cast) {
      a.herd.update(cam, a.fill)
      for (let i = 0; i < a.n && ns < NSH; i++, ns++) {
        const here = !a.o.air && s.beat < 2 && U.uFZ.value <= a.z[i] - 6 && a.z[i] > -400
        beastSh[ns * 4] = a.x[i]
        beastSh[ns * 4 + 1] = a.z[i]
        beastSh[ns * 4 + 2] = here ? a.len * 0.42 : 0
        beastSh[ns * 4 + 3] = a.high * 0.8
      }
    }
    beastAttr.needsUpdate = true
    // dust where the feet came down: the stride a foot is in, where it was planted, how far into its stance it is
    {
      let nd = 0
      uDH.value = W.shot < 2 ? 1 : 0
      for (const a of cast) {
        const st = STEP[a.name], gs = a.herd.spec.gait
        if (!st || !gs || a.o.dist) continue
        const legs = legsOf.cache.get(a.herd.spec) ?? legsOf.cache.set(a.herd.spec, legsOf(a.herd.spec)).get(a.herd.spec)!
        const puff = a.name === "acheroraptor" ? 0.45 : a.name === "tyrannosaurus" ? 1.5 : a.name === "triceratopsYoung" ? 0.65 : 1
        for (let i = 0; i < a.n; i++) {
          const w = a.who[i]
          const walk = LIFE.walk
          const sp = walk < w.stop ? 1 : clamp(1 - (walk - w.stop) / 1.6)
          if (sp <= 0.02 || U.uFZ.value > a.z[i] - 6 || s.beat > 1) continue
          const Ls = gs.stride * w.sc, ph = distOf(w, walk) / Ls
          for (const l of legs) {
            if (nd >= NDUST) break
            const k = Math.floor(ph + l.off), f = ph + l.off - k
            if (f > 0.42) continue
            const s0 = (k + gs.duty / 2 - l.off) * Ls + l.x * w.sc
            a.paths[w.p].at(s0, pp)
            const hl = Math.hypot(pp[3], pp[5]) || 1, side = w.lane + l.z * w.sc
            const u = f / 0.42
            dustA.set([pp[0] - (pp[5] / hl) * side, 0.02, pp[2] + (pp[3] / hl) * side, (0.1 + 0.55 * Math.sqrt(u)) * puff * w.sc], nd * 4)
            dustB.set([(1 - u) ** 1.6 * 0.55 * sp * (1 - LIFE.flash), (k * 0.37 + i) % 1, a === hero ? 1 : 0, 0], nd * 4)
            nd++
          }
        }
      }
      for (let j = nd; j < NDUST; j++) dustB[j * 4] = dustA[j * 4 + 3] = 0
      dustAA.needsUpdate = dustBA.needsUpdate = true
    }
    if (s.live) {
      // wind in the evening; nothing at all from the flash until the wall; the roar; the fire; then a thin wind
      const hush = t1 >= T_HIT && t1 < T_FRONT0 + 0.4 ? 0 : 1
      const rise = s.beat === 1 ? smooth(T_FRONT0 + 0.4, T_FRONT1, t1) : 0
      ctx.synth.bed("wind", clamp(hush * (0.12 * (1 - W.print) * (s.beat === 0 ? 1 : 0) + 0.6 * rise * rise + 0.9 * W.brown + 0.2 * U.uRed.value + 0.09 * ash)))
      const fire = U.uFire.value
      if (fire > 0.01) {
        ctx.synth.bed("fire", 0.3 * fire)
        ctx.synth.bed("crackle", 0.3 * fire)
      }
    }
  }

  return {
    cues,
    update,
    warm: () => [
      { scene: bakeScene, camera: bakeCam, target: sheet },
      { scene: shadows, camera: cam, target: mask },
      { scene: world, camera: cam, target: far },
      { scene: front, camera: cam, target: near },
      { scene: close, camera: cam, target: near },
      { pass: comp, target: out },
    ],
    render() {
      const r = ctx.renderer
      if (!baked) {
        // the sheet, once
        baked = true
        r.setClearColor(0x808080, 0)
        r.setRenderTarget(sheet)
        r.render(bakeScene, bakeCam)
      }
      r.setClearColor(0x000000, 1)
      r.setRenderTarget(mask)
      r.render(shadows, cam)
      r.setRenderTarget(far)
      r.render(world, cam)
      r.setClearColor(0x000000, 0)
      r.setRenderTarget(near)
      r.render(W.shot === 2 ? front : close, cam)
      r.setClearColor(0x000000, 1)
      C.tFar.value = far.texture
      C.tNear.value = near.texture
      comp.render(out)
      const p = 1 - W.print
      POST.exposure = W.expo
      POST.bloom = p * (0.5 + 0.5 * W.flash)
      POST.bloomThresh = mix(1.0, 0.8, W.flash)
      POST.vignette = p * mix(0.26, 0.34, W.ash)
      POST.grain = p * 0.024
      POST.ca = p * (0.0006 + 0.003 * W.shakeA + 0.0015 * W.flash)
      POST.sat = mix(1, mix(1.06, 0.92, W.ash), p)
      POST.contrast = mix(1, 1.06, p)
      POST.halation = 0.4 * p
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      const ink = W.flash > 0.25
      TITLES.color = ink ? "#17120f" : W.ash > 0.5 ? "#f1f1ee" : "#fff1dc"
      TITLES.shadow = ink ? undefined : W.ash > 0.5 ? "rgba(20,22,26,0.6)" : "rgba(30,14,30,0.55)"
      TITLES.style = s.beat === 1 ? "slam" : "rise"
      titles(g, s, ctx.def, TITLES)
      // the reviewer, on the one thing nobody should be looking at
      const tb = W.t1 >= 0 ? L0 + W.t1 : W.t0
      if (tb < L0 + 1) comment(g, BUBBLE, W.sx + 8, W.sy - 6, tb, { t0: BUB_T, out: L0 + T_FALL, cps: 17 })
    },
    hud: (s: State) => {
      HUD.color = W.flash > 0.25 ? "#17120f" : W.ash > 0.5 ? "#f1f1ee" : "#fff1dc"
      HUD.hide = s.beat === 0 && W.t0 < 1.6
      return HUD
    },
    dispose() {
      disposeTree(world)
      disposeTree(front)
      disposeTree(close)
      for (const a of cast) a.herd.dispose()
      disposeTree(bakeScene)
      disposeTree(shadows)
      sheet.dispose()
      sprays.dispose()
      for (const sp of grown) for (const t of sp) t.g.dispose()
      quad.dispose()
      card.dispose()
    },
  }
}

