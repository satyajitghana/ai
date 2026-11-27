// Scene 22, question: "The question". The AI age opens.
//
// Staging. Beat 0: over the platen of a 1950 British page teleprinter (after the Creed 7 in the
// Centre for Computing History's photographs: grey-green hammer-finish castings, a semicircular
// basket of chrome typebars in front of a black rubber platen, a two-colour ribbon, manila roll
// paper carried on the carriage). It types "CAN MACHINES THINK?" at 50 baud, about 6.7 characters
// a second: each typebar swings up out of the fan, the ribbon guide lifts the ribbon to the line,
// the slug strikes and the carriage steps the paper one character left. Capitals only (ITA2 has no
// lower case); before the "?" the machine shifts to figures (the platen drops a slug's height, the
// "?" shares the B typebar) and the line ends. The lens tracks the print point, pushing in, then
// cranes up and back over the fan.
// Beat 1: a whip pan right and down off the machine onto the desk beside it: the Dartmouth
// proposal, its second page (the heading and the paragraph that begins "We propose that a 2
// month, 10 man study", set as in the scan: a proportional serif typewriter face, double spaced),
// with the punched card that carried the cut lying on it. The selection box takes the phrase.
// Then the winter, once: rime creeps over the machine's metal from its left end and its edges,
// hoarfrost feathers on the enamel and the chrome, the lamp cooling; the reviewer: "Not yet.";
// then the thaw: the rime goes to beads of water and the beads dry as the lamp warms.
//
// Story parameter. Beat 0 `typed` (strokes made, 0..20). Beat 1 `reach` (the frost's front), then
// `melt` and `dry`.
// World rule. One desk lamp (warm, cooling with the frost) and one window fill; every metal
// surface takes the same frost function of world position, edge and the frost's reach.
// Beat sheet, sources and what could not be verified: R/beats/question.md.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraPosition, clamp as clampN, dot, exp, float, floor, Fn, fract, instanceIndex, length, Loop, max, min, mix as mixN, normalize, normalWorld, positionWorld, pow, select, sin, smoothstep, step, texture, uniform, uniformArray, uniformTexture, uv as uvA, vec2, vec3, vec4 } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, ramp, smooth } from "../engine/ease"
import { canvasTex, disposeTree, stageTarget } from "../engine/stage"
import { H } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm3, hash21, hash22, sampleRT, toLinear, vnoise, voronoi, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, PostOpts, SceneInstance, State } from "../engine/types"
import { comment } from "../engine/ui"
import { CARDS_DUR, CARDS_IN } from "../transitions/cards"

const START = CARDS_DUR * (1 - CARDS_IN)
const FOV = 35

// ---------------------------------------------------------------- the machine, in centimetres

const R_PL = 1.6 // platen radius
const PL_LEN = 26
const PAPER_W = 21.6 // 8½ in
const PITCH = 0.254 // ten characters to the inch
const MARGIN = 2.0
const LINE_A = (30 * Math.PI) / 180 // the print line's angle round the platen, up from the front
const CAP = 0.26 // cap height of the teleprinter's type
const PP = new THREE.Vector3(0, R_PL * Math.sin(LINE_A), R_PL * Math.cos(LINE_A)) // print point (fixed)
const NRM = new THREE.Vector3(0, Math.sin(LINE_A), Math.cos(LINE_A))
const DESK_Y = -14
/** The slug on the end of each typebar, in the bar's frame (cm): the print point meets it at x = BL. */
const SLUG = { x0: 4.47, h: 0.7, y0: -0.07, d: 0.16, w: 0.28, fig: 0.36 }

// the strokes: 18 characters, the figures shift, the "?"
const TEXT = "CAN MACHINES THINK?"
type Stroke = { ch: string; cell: number; bar: number }
const BARS = 26 // one typebar per ITA2 letter combination; the six function codes print nothing
const barOf = (ch: string) => (ch === "?" ? "B" : ch).charCodeAt(0) - 65 // the "?" is the figures half of the B slug
/** ITA2's figures case, the lower character on each slug (ITU-T S.1; F, G, H unassigned, D who-are-you, J the bell). */
const FIGS: Record<string, string> = { A: "-", B: "?", C: ":", E: "3", I: "8", K: "(", L: ")", M: ".", N: ",", O: "9", P: "0", Q: "1", R: "4", S: "'", T: "5", U: "7", V: "=", W: "2", X: "/", Y: "6", Z: "+" }
const STROKES: Stroke[] = (() => {
  const out: Stroke[] = []
  let cell = 0
  for (const ch of TEXT) {
    if (ch === "?") out.push({ ch: "FIGS", cell: -1, bar: -1 })
    out.push({ ch, cell, bar: ch === " " ? -1 : barOf(ch) })
    cell++
  }
  return out
})()
const RATE = 50 / 7.5 // 50 baud, 7.5 units a character: 6.67 a second
const T_TYPE0 = 0.48
const strikeAt = (i: number) => T_TYPE0 + i / RATE
const T_TYPED = strikeAt(STROKES.length - 1)

// beat 1
// the frost starts once the lens has come back to the machine, so the creep is seen, not arrived at
const T_FROST0 = 1.42, T_FROST1 = 2.5, T_MELT0 = 2.6, T_MELT1 = 3.12, T_DRY1 = 3.9
const T_NOTYET = 1.75

// the desk, the page
const PAGE = { w: 21.59, h: 27.94, x: 19.6 + 27.94 / 2, z: 1.0, rot: Math.PI / 2 - 0.035 }
const PAGE_TEX = { w: 1700, h: 2200 } // 200 per inch

export function create(ctx: Ctx): SceneInstance {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 400)

  // ---------------------------------------------------------------- uniforms: the world rule

  const U = {
    lamp: uniform(new THREE.Vector3(-22, 38, 30)),
    lampCol: uniform(new THREE.Vector3(1, 0.8, 0.55)),
    win: uniform(new THREE.Vector3(0.6, 0.55, -0.6).normalize()),
    reach: uniform(0),
    melt: uniform(0),
    dry: uniform(0),
    typed: uniform(0), //   glyph cells printed
    fresh: uniform(0), //   seconds since the last strike, for the wet ink
    carX: uniform(0),
    shiftY: uniform(0),
    lift: uniform(0), //    the ribbon guide
    debug: uniform(ctx.debugLabels ? 1 : 0),
    time: uniform(0),
  }
  // Where rime nucleates first besides edges: bolt heads, hubs, the knobs (world cm; w = how far it runs from there)
  const NUC: THREE.Vector4[] = []
  for (const sx of [-1, 1]) {
    for (const z of [-11, -6, 0, 6]) NUC.push(new THREE.Vector4(sx * 19.3, -12.3, z, 5))
    NUC.push(new THREE.Vector4(sx * 19.35, 0, 0, 7))
  }
  const NUC_SPOOL = NUC.length
  NUC.push(new THREE.Vector4(-10.1, 0, 0, 6), new THREE.Vector4(10.1, 0, 0, 6)) // the ribbon spools (set below)
  const NUC_KNOB = NUC.length
  NUC.push(new THREE.Vector4(0, 0, 0, 6), new THREE.Vector4(0, 0, 0, 6)) // the platen knobs (follow the carriage)
  const NUC_GUIDE = NUC.length
  NUC.push(new THREE.Vector4(0, 0, 0, 4)) // the typebar guide (set below)
  const uNuc = uniformArray(NUC, "vec4")

  /** What metal sees of the room. */
  const env = (R: V3): V3 => {
    const L = normalize(U.lamp)
    const room = mixN(vec3(0.012, 0.012, 0.011), vec3(0.09, 0.085, 0.075), clampN(R.y.mul(0.5).add(0.5), 0, 1))
    const lobe = pow(max(dot(R, L), 0), 60).mul(9).add(pow(max(dot(R, L), 0), 6).mul(0.35))
    const winS = smoothstep(0.55, 0.75, dot(R, U.win)).mul(smoothstep(-0.1, 0.25, R.y)).mul(0.9)
    return room.add(U.lampCol.mul(lobe)).add(vec3(0.5, 0.62, 0.8).mul(winS)) as V3
  }
  /** One lamp and one window. */
  const light = (P: V3, N: V3) => {
    const Ld = U.lamp.sub(P)
    const L = normalize(Ld)
    const fall = float(2600).div(dot(Ld, Ld).add(900))
    const key = U.lampCol.mul(fall)
    const diff = key.mul(max(dot(N, L), 0)).add(vec3(0.16, 0.19, 0.24).mul(max(dot(N, U.win), 0).mul(0.7).add(0.15))).add(vec3(0.035, 0.03, 0.025))
    return { L, key, diff }
  }

  /**
   * The frost, the world rule's second half. Rime starts at the machine's left end and on edges
   * (where metal sheds heat first) and runs right; `reach` is its front. Returns vec3(frost, wet, needle).
   */
  const frost = (P: V3, N: V3, bias: number) => {
    const g = fbm3(P.mul(0.22)).toVar()
    // How far this point is from where the cold gets in. Each part carries its own box (fq: the point
    // from the box's centre, fh: its half extents, both cm): the distance to the nearest edge of the
    // face it is on is the middle of the three clearances; scaled by the face's own half size, the
    // centre of every face is reached last. Bolt heads, hubs and knobs seed it too.
    const fq = attribute("fq", "vec3") as unknown as V3, fh = attribute("fh", "vec3") as unknown as V3
    const clr = max(fh.sub(abs(fq)), vec3(0)).toVar()
    const mid3 = (v: V3) => v.x.add(v.y).add(v.z).sub(min(v.x, min(v.y, v.z))).sub(max(v.x, max(v.y, v.z)))
    const e2 = mid3(clr as V3).toVar()
    const hm = mid3(fh).toVar()
    // along the part's longest axis too, so a bar or a rod is reached from its ends and its middle last
    const lx = fh.x.greaterThan(max(fh.y, fh.z)), ly = fh.y.greaterThan(fh.z)
    const aL = select(lx, clr.x, select(ly, clr.y, clr.z)), hL = select(lx, fh.x, select(ly, fh.y, fh.z))
    const fromEdge = max(min(e2.div(max(hm, 0.05)), e2.div(4.5)), aL.div(max(hL, 0.05)).mul(0.75)).toVar()
    const fromBolt = float(9).toVar()
    Loop(NUC.length, ({ i }) => {
      const n = uNuc.element(i) as unknown as V4
      fromBolt.assign(min(fromBolt, length(P.sub(n.xyz)).div(n.w)))
    })
    const run = clampN(P.x.add(26).div(52), 0, 1)
    const seed = min(fromEdge, fromBolt).mul(0.62).add(g.mul(0.18)).add(run.mul(0.22)).sub(bias.valueOf() * 0.5).toVar()
    // rime: a granular white coat, and feather crystals radiating from nucleation points
    const a = abs(N)
    const q = select(a.x.greaterThan(max(a.y, a.z)), P.yz, select(a.y.greaterThan(a.z), P.xz, P.xy)).toVar()
    const qs = q.mul(0.75).toVar()
    const v = voronoi(qs).toVar()
    const off = qs.sub(v.yz.add(hash22(v.yz))).toVar()
    // hoarfrost grows as feathers that all lean the same way off the metal: a spine, barbs at 45 degrees
    const h = hash21(v.yz)
    const ang = h.sub(0.5).mul(0.9).add(0.5)
    const d = vec2(sin(ang.add(1.5708)), sin(ang))
    const along = dot(off, d).add(0.35).toVar()
    const across = dot(off, vec2(d.y.negate(), d.x)).toVar()
    const len = smoothstep(0.0, 0.05, along).mul(smoothstep(0.85, 0.3, along))
    const spine = smoothstep(0.035, 0.0, abs(across))
    const barbs = pow(abs(sin(along.sub(abs(across)).mul(46))), 10).mul(smoothstep(0.3, 0.0, abs(across)).mul(along.mul(-1.1).add(1)))
    const fern = spine.add(barbs).mul(len)
    const grain = vnoise(q.mul(14)).mul(0.5).add(vnoise(q.mul(40)).mul(0.5))
    const fern2 = fern.mul(0.9).add(grain.mul(0.45)).toVar()
    const fernOut = fern2
    // the front: ragged, the feathers running a little ahead of the coat
    const grow = smoothstep(seed.sub(0.06), seed, U.reach.mul(1.2).sub(0.12).add(fernOut.mul(0.06))).mul(smoothstep(0, 0.03, U.reach)).toVar()
    const fr = grow.mul(U.melt.oneMinus()).mul(smoothstep(0.08, 0.45, fernOut.add(grow.mul(0.35))))
    const wet = grow.mul(U.melt).mul(U.dry.oneMinus())
    return vec3(fr, wet, fernOut) as V3
  }
  /** Lay frost and beads over a lit metal colour. */
  const winter = (col: V3, P: V3, N: V3, V: V3, keyL: V3, key: V3, bias: number): V3 => {
    const f = frost(P, N, bias).toVar()
    // rime: white, rough, catching the lamp in sparks
    const lit = light(P, N)
    const rime = vec3(0.7, 0.76, 0.84).mul(lit.diff.mul(0.85).add(0.2)).mul(f.z.mul(0.5).add(0.6))
    // every crystal a tiny mirror with its own facet: glitter where a facet throws the lamp or the window at the lens
    const cell = floor(P.mul(38)).toVar()
    const hh = vec3(hash21(cell.xy.add(cell.z.mul(1.7))), hash21(cell.yz.add(3.3)), hash21(cell.zx.add(7.1))).sub(0.5)
    const fn = normalize(N.add(hh.mul(1.4)))
    const spark = pow(max(dot(fn, normalize(keyL.add(V))), 0), 260).mul(28).mul(step(0.55, f.z))
    const winS = pow(max(dot(fn, normalize(U.win.add(V))), 0), 200).mul(10)
    // rim: the crystals stand proud of the metal, so they catch light along every silhouette
    const rim = pow(float(1).sub(max(dot(N, V), 0)), 2.2).mul(0.9)
    const frostCol = rime.add(key.mul(spark)).add(vec3(0.55, 0.7, 1.0).mul(winS.add(rim)).mul(0.6))
    const c = mixN(col, frostCol, clampN(f.x.mul(1.25), 0, 1)).toVar()
    // beads: the rime gone to water, standing in drops that throw the lamp back
    const a = abs(N)
    const q = select(a.x.greaterThan(max(a.y, a.z)), P.yz, select(a.y.greaterThan(a.z), P.xz, P.xy))
    const b = voronoi(q.mul(5.5)).toVar()
    const bead = smoothstep(0.34, 0.16, b.x).mul(step(hash21(b.yz), 0.55)).mul(f.y)
    const bn = normalize(N.add(vec3(fract(q.x.mul(5.5)).sub(0.5), 0.2, fract(q.y.mul(5.5)).sub(0.5)).mul(bead.mul(1.6))))
    const glint = pow(max(dot(normalize(keyL.add(V)), bn), 0), 90).mul(key).mul(bead).mul(5)
    c.assign(c.mul(float(1).sub(f.y.mul(0.25))).add(glint).add(env(bn).mul(bead).mul(0.25)))
    return c as V3
  }

  // ---------------------------------------------------------------- materials

  type MatOpts = { kind: "enamel" | "chrome" | "rubber" | "bakelite" | "lino" | "roll"; tone?: [number, number, number]; frost?: boolean; first?: number; slug?: THREE.Texture }
  const mats: THREE.NodeMaterial[] = []
  const surf = (o: MatOpts) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const P = positionWorld.toVar()
      const N = normalize(normalWorld).toVar()
      const V = normalize(cameraPosition.sub(P)).toVar()
      const lt = light(P, N)
      const H2 = normalize(lt.L.add(V))
      const tone = vec3(...(o.tone ?? [0.05, 0.05, 0.05]))
      const col = vec3(0).toVar()
      if (o.kind === "enamel") {
        // hammer finish: shallow dimples in cells, the clear coat catching each one's rim
        const a = abs(N)
        const q = select(a.x.greaterThan(max(a.y, a.z)), P.yz, select(a.y.greaterThan(a.z), P.xz, P.xy))
        const c = voronoi(q.mul(2.1)).toVar()
        const dimple = smoothstep(0.1, 0.65, c.x)
        const Nb = normalize(N.add(vec3(hash21(c.yz).sub(0.5), hash21(c.yz.add(3.1)).sub(0.5), hash21(c.yz.add(7.7)).sub(0.5)).mul(0.35).mul(dimple)))
        const H3 = normalize(lt.L.add(V))
        const sp = pow(max(dot(Nb, H3), 0), 70).mul(lt.key).mul(0.9)
        const fres = pow(float(1).sub(max(dot(N, V), 0)), 4).mul(0.25)
        const wear = smoothstep(0.82, 1.0, vnoise(q.mul(1.3))).mul(0.4)
        col.assign(tone.mul(dimple.mul(0.25).add(0.85)).mul(lt.diff).add(sp).add(env(Nb as V3).mul(fres)).add(vec3(0.18, 0.17, 0.15).mul(wear).mul(lt.diff)))
      } else if (o.kind === "chrome") {
        const R = normalize(V.negate().reflect(N))
        const brush = vnoise(vec2(P.x.mul(0.3), P.y.add(P.z).mul(60))).mul(0.25).add(0.8)
        col.assign(env(R as V3).mul(vec3(0.78, 0.8, 0.82)).mul(brush).add(lt.diff.mul(0.04)))
        if (o.slug) {
          // the type face: the two characters stand in relief, mirrored, their counters clogged with old ink
          const pg = attribute("position", "vec3") as unknown as V3
          const k = float(instanceIndex).toVarying() as unknown as F
          const onFace = step(pg.y, SLUG.y0 + 0.004)
          const su = pg.z.sub(-SLUG.w / 2).div(SLUG.w), sv = pg.x.sub(SLUG.x0).div(SLUG.h)
          const at = (du: number, dv: number) => texture(o.slug!, vec2(k.add(clampN(su.add(du), 0.002, 0.998)).div(BARS), sv.add(dv))).a
          const gl = at(0, 0).toVar()
          const grad = abs(at(0.03, 0).sub(at(-0.03, 0))).add(abs(at(0, 0.012).sub(at(0, -0.012)))).toVar()
          const top = mixN(vec3(0.012, 0.011, 0.014).add(env(R as V3).mul(0.05)), col, smoothstep(0.35, 0.7, gl))
          const rim = clampN(grad.mul(2.2), 0, 1).mul(lt.key.add(0.25)).mul(0.6)
          col.assign(mixN(col, top.add(rim), onFace))
        }
      } else if (o.kind === "rubber") {
        const grain = vnoise(vec2(P.x.mul(40), P.y.add(P.z).mul(40))).mul(0.2).add(0.9)
        const sh = pow(max(dot(N, H2), 0), 18).mul(lt.key).mul(0.07)
        col.assign(tone.mul(grain).mul(lt.diff).add(sh))
      } else if (o.kind === "bakelite") {
        const sh = pow(max(dot(N, H2), 0), 50).mul(lt.key).mul(0.5)
        const knurl = step(0.5, fract(P.y.add(P.z).mul(6))).mul(0.15).add(0.9)
        col.assign(tone.mul(knurl).mul(lt.diff).add(sh))
      } else if (o.kind === "lino") {
        const mott = vnoise(P.xz.mul(0.35)).mul(0.5).add(vnoise(P.xz.mul(2.5)).mul(0.3)).add(0.6)
        const sh = pow(max(dot(N, H2), 0), 24).mul(lt.key).mul(0.06)
        col.assign(tone.mul(mott).mul(lt.diff).add(sh))
      } else {
        // the paper roll: manila wound on itself, rings on its end
        const rr = length(P.yz.sub(vec2(-1.5, -8)))
        const ring = select(abs(N.x).greaterThan(0.6), sin(rr.mul(90)).mul(0.08).add(0.92), float(1))
        col.assign(vec3(0.6, 0.47, 0.27).mul(ring).mul(lt.diff))
      }
      if (o.frost) col.assign(winter(col, P, N, V, lt.L, lt.key, o.first ?? 0))
      return vec4(col, 1)
    })()
    mats.push(m)
    return m
  }
  const ENAMEL = surf({ kind: "enamel", tone: [0.075, 0.09, 0.08], frost: true })
  const ENAMEL_DARK = surf({ kind: "enamel", tone: [0.04, 0.05, 0.045], frost: true })
  const CHROME = surf({ kind: "chrome", frost: true, first: 0.18 }) // bright metal and bolt heads shed heat first
  const RUBBER = surf({ kind: "rubber", tone: [0.018, 0.018, 0.02] })
  const KNOB = surf({ kind: "bakelite", tone: [0.012, 0.016, 0.03], frost: true, first: 0.1 })
  const LINO = surf({ kind: "lino", tone: [0.03, 0.03, 0.028] })
  const ROLL = surf({ kind: "roll" })

  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(g, m)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  const rodX = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 20).rotateZ(Math.PI / 2)

  // ---------------------------------------------------------------- the fixed frame

  const frame = new THREE.Group()
  scene.add(frame)
  // side frames, a cross casting under the basket, the carriage rails
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(2.2, 17, 22), ENAMEL, frame, s * 18, -5.5, -2)
  add(new THREE.BoxGeometry(34, 4.5, 9), ENAMEL, frame, 0, -11.5, 8)
  for (const s of [-1, 1]) {
    // cast ribs and the bolts that hold the side frame to the bed
    for (const y of [-10.5, -3.5]) add(new THREE.BoxGeometry(0.7, 0.9, 20), ENAMEL, frame, s * 19.4, y, -2)
    for (const z of [-11, -6, 0, 6]) add(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 6).rotateZ(Math.PI / 2), CHROME, frame, s * 19.3, -12.3, z)
    add(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 24).rotateZ(Math.PI / 2), CHROME, frame, s * 19.35, 0, 0)
  }
  add(new THREE.BoxGeometry(38, 2.5, 18), ENAMEL_DARK, frame, 0, -13, 0)
  add(rodX(0.45, 40), CHROME, frame, 0, -2.6, -2.8)
  add(rodX(0.38, 40), CHROME, frame, 0, 1.2, -4.1)
  add(rodX(0.3, 36), CHROME, frame, 0, -6.2, 6.4) // the bail of the basket
  // the motor behind on the left
  const motor = add(new THREE.CylinderGeometry(5.2, 5.2, 13, 40).rotateZ(Math.PI / 2), ENAMEL, frame, -27, -4, -9)
  add(new THREE.CylinderGeometry(4.2, 4.2, 2.2, 40).rotateZ(Math.PI / 2), CHROME, motor, -7.4, 0, 0)

  // the type basket: a half-ring segment, the bars as one instanced draw
  const BR = 4.0, BL = 5.0, BH = 3.0 // pivot radius, bar length, the basket's height off the line: BR² + BH² = BL²
  const PHI = (k: number) => Math.PI * (1.09 + (0.82 * k) / (BARS - 1)) // the lower half of the fan
  const B0 = PP.clone().addScaledVector(NRM, BH)
  const E1 = new THREE.Vector3(1, 0, 0)
  const E2 = new THREE.Vector3().crossVectors(NRM, E1) // up and back
  const seg = new THREE.Mesh(new THREE.TorusGeometry(BR, 0.3, 12, 60, Math.PI * 0.95), ENAMEL_DARK)
  {
    const basis = new THREE.Matrix4().makeBasis(E1, E2, NRM)
    seg.quaternion.setFromRotationMatrix(basis)
    seg.rotateZ(Math.PI * 1.025)
    seg.position.copy(B0)
    frame.add(seg)
  }
  const barGeo = new THREE.BoxGeometry(BL, 0.09, 0.2).translate(BL / 2, 0, 0)
  // the slug: a block carrying two characters one above the other on its face (local -y, which meets
  // the paper), letters above, figures below; its back is bevelled to the bar
  const slugGeo = new THREE.BoxGeometry(SLUG.h, SLUG.d, SLUG.w, 1, 1, 1).translate(SLUG.x0 + SLUG.h / 2, SLUG.y0 + SLUG.d / 2, 0)
  {
    const p = slugGeo.attributes.position
    for (let i = 0; i < p.count; i++) if (p.getY(i) > SLUG.y0 + 0.01) p.setZ(i, p.getZ(i) * 0.62)
    slugGeo.computeVertexNormals()
  }
  // The face atlas: one cell a bar, each pair drawn as it must print and turned so it lands upright
  // at the print point. Drawn the right way round in the slug's own face coordinates, it reads
  // mirrored from outside, as type does.
  const slugTex = canvasTex(BARS * 96, 240, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    const cw = w / BARS
    c.textAlign = "center"
    c.textBaseline = "middle"
    c.fillStyle = "#fff"
    for (let k = 0; k < BARS; k++) {
      const phi = PHI(k)
      const d = new THREE.Vector3().copy(E1).multiplyScalar(Math.cos(phi)).addScaledVector(E2, Math.sin(phi))
      const tang = new THREE.Vector3().crossVectors(NRM, d).normalize()
      const th = Math.atan2(BH, -BR)
      const xA = d.clone().multiplyScalar(Math.cos(th)).addScaledVector(NRM, -Math.sin(th))
      const al = Math.atan2(E1.dot(xA), E1.dot(tang))
      const L = String.fromCharCode(65 + k)
      for (const [ch, v] of [[L, (BL - SLUG.x0) / SLUG.h], [FIGS[L] ?? "", (BL - SLUG.fig - SLUG.x0) / SLUG.h]] as const) {
        if (!ch) continue
        c.save()
        c.translate((k + 0.5) * cw, (1 - v) * h)
        c.rotate(-al)
        c.font = `700 ${Math.round(((CAP / SLUG.h) * h) / 0.72)}px ${ctx.fonts.mono}`
        c.shadowColor = "#fff"
        c.shadowBlur = 4
        c.fillText(ch, 0, 4)
        c.restore()
      }
    }
  })
  const SLUGM = surf({ kind: "chrome", frost: true, first: 0.18, slug: slugTex })
  const bars = new THREE.InstancedMesh(barGeo, CHROME, BARS)
  const slugs = new THREE.InstancedMesh(slugGeo, SLUGM, BARS)
  bars.frustumCulled = slugs.frustumCulled = false
  frame.add(bars, slugs)
  // the typebar guide: a forked block just in front of the line
  // the typebar guide: a fork the bar drops into just before the slug lands, so every letter sits on the line
  for (const sx of [-0.2, 0.2]) add(new THREE.BoxGeometry(0.12, 0.5, 0.16), CHROME, frame, sx, PP.y - 0.95, PP.z + 0.8)
  add(new THREE.BoxGeometry(0.56, 0.12, 0.2), CHROME, frame, 0, PP.y - 1.2, PP.z + 0.8)

  // the ribbon: a strip across the front of the platen, black over red, lifted at the print point by its guide
  const RIB_W = 1.27, RIB_L = 17
  const ribGeo = new THREE.PlaneGeometry(RIB_L, RIB_W, 120, 2)
  const ribMat = new THREE.NodeMaterial()
  {
    const p = ribGeo.attributes.position
    // the strip in the yz-plane: y across, laid on a tangent plane in front of the line
    const a0 = LINE_A - 0.72
    const base = new THREE.Vector3(0, (R_PL + 0.32) * Math.sin(a0), (R_PL + 0.32) * Math.cos(a0))
    const across = new THREE.Vector3(0, Math.cos(a0), -Math.sin(a0))
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i)
      p.setXYZ(i, x, base.y + across.y * y, base.z + across.z * y)
    }
    ribGeo.computeVertexNormals()
    const vUv = uvA()
    ribMat.fragmentNode = Fn(() => {
      const P = positionWorld.toVar()
      const N = normalize(normalWorld).toVar()
      const lt = light(P, N)
      const st = vUv.toVar()
      const weave = sin(st.x.mul(RIB_L * 120)).mul(sin(st.y.mul(RIB_W * 120))).mul(0.5).add(0.5)
      const twoTone = select(st.y.greaterThan(0.5), vec3(0.02, 0.018, 0.02), vec3(0.1, 0.014, 0.012))
      const worn = smoothstep(0.6, 0.0, abs(st.y.sub(0.75))).mul(0.4)
      const c = twoTone.mul(weave.mul(0.5).add(0.7)).mul(worn.oneMinus().mul(0.3).add(0.7)).mul(lt.diff).add(pow(max(dot(N, normalize(lt.L.add(normalize(cameraPosition.sub(P))))), 0), 12).mul(lt.key).mul(0.04))
      return vec4(c, 1)
    })()
    ribMat.side = THREE.DoubleSide
    mats.push(ribMat)
  }
  const ribbon = new THREE.Mesh(ribGeo, ribMat)
  frame.add(ribbon)
  // its spools, either side
  for (const s of [-1, 1]) {
    const cup = add(new THREE.CylinderGeometry(2.4, 2.4, 1.3, 40), CHROME, frame, s * (RIB_L / 2 + 1.6), PP.y - 1.6, PP.z - 0.6)
    add(new THREE.CylinderGeometry(1.9 + s * 0.2, 1.9 + s * 0.2, 1.32, 40), RUBBER, cup, 0, 0.02, 0)
  }

  // ---------------------------------------------------------------- the carriage: platen, knobs, paper, roll

  const carriage = new THREE.Group()
  scene.add(carriage)
  add(rodX(R_PL, PL_LEN).toNonIndexed(), RUBBER, carriage)
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.8, 8, 9), ENAMEL, carriage, s * (PL_LEN / 2 + 0.6), -1.5, -2.5)
    add(rodX(1.4, 1.4), KNOB, carriage, s * (PL_LEN / 2 + 1.9), 0, 0)
    add(rodX(0.35, 3), CHROME, carriage, s * (PL_LEN / 2 + 0.8), 0, 0)
  }
  add(rodX(4.4, PAPER_W), ROLL, carriage, 0, -1.5, -8)
  add(rodX(0.4, PAPER_W + 2), CHROME, carriage, 0, -1.5, -8)
  // the paper bail: a rod with two rollers, above the line
  const bailA = (78 * Math.PI) / 180
  const bail = add(rodX(0.14, PAPER_W + 1), CHROME, carriage, 0, (R_PL + 0.22) * Math.sin(bailA), (R_PL + 0.22) * Math.cos(bailA))
  for (const s of [-1, 1]) add(rodX(0.24, 1.0), RUBBER, bail, s * 6.5, 0, 0)

  // the paper: from the roll, under the platen, round the front and up off the back
  const typeTex = canvasTex(2048, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    const n = TEXT.length
    const cw = w / n
    c.textAlign = "center"
    c.textBaseline = "alphabetic"
    c.font = `600 ${Math.round(h * 0.78)}px ${ctx.fonts.mono}`
    let sd = 11
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) {
      const ch = TEXT[i]
      if (ch === " ") continue
      // the uneven strike: each slug lands with its own weight and tilt, one side heavier
      const x = (i + 0.5) * cw + (rnd() - 0.5) * cw * 0.05
      const y = h * 0.8 + (rnd() - 0.5) * h * 0.06 + (ch === "?" ? -h * 0.02 : 0)
      const g = c.createLinearGradient(x - cw * 0.4, 0, x + cw * 0.4, 0)
      const heavy = 0.7 + rnd() * 0.3
      const light2 = 0.35 + rnd() * 0.35
      const left = rnd() < 0.5
      g.addColorStop(0, `rgba(255,255,255,${left ? heavy : light2})`)
      g.addColorStop(1, `rgba(255,255,255,${left ? light2 : heavy})`)
      c.save()
      c.translate(x, y)
      c.rotate((rnd() - 0.5) * 0.03)
      c.shadowColor = "rgba(255,255,255,0.5)"
      c.shadowBlur = 3
      c.fillStyle = g
      c.fillText(ch, 0, 0)
      c.restore()
    }
  })
  // path round the platen: angle from the front, upward positive
  const A0 = -2.4, A1 = 2.0
  const PATH_N = 90
  const pathPt = (s: number, out: THREE.Vector3, nrm?: THREE.Vector3) => {
    // s in 0..1: a straight run from the roll, the wrap, a straight run up and back
    const r = R_PL + 0.015
    const aLen = (A1 - A0) * r
    const L0 = 5, L1 = 9
    const d = s * (L0 + aLen + L1)
    if (d < L0) {
      const t = L0 - d
      const tang = new THREE.Vector3(0, Math.cos(A0), -Math.sin(A0))
      out.set(0, r * Math.sin(A0), r * Math.cos(A0)).addScaledVector(tang, -t)
      nrm?.set(0, Math.sin(A0), Math.cos(A0))
    } else if (d < L0 + aLen) {
      const a = A0 + (d - L0) / r
      out.set(0, r * Math.sin(a), r * Math.cos(a))
      nrm?.set(0, Math.sin(a), Math.cos(a))
    } else {
      const t = d - L0 - aLen
      out.set(0, r * Math.sin(A1), r * Math.cos(A1)).add(new THREE.Vector3(0, Math.cos(A1), -Math.sin(A1)).multiplyScalar(t))
      nrm?.set(0, Math.sin(A1), Math.cos(A1))
    }
    return d
  }
  const paperGeo = new THREE.BufferGeometry()
  let V_LINE = 0
  {
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = []
    const NX = 24
    const pt = new THREE.Vector3(), nn = new THREE.Vector3()
    for (let j = 0; j <= PATH_N; j++) {
      const d = pathPt(j / PATH_N, pt, nn)
      for (let i = 0; i <= NX; i++) {
        pos.push(-PAPER_W / 2 + (i / NX) * PAPER_W, pt.y, pt.z)
        nrm.push(0, nn.y, nn.z)
        uv.push(i / NX, d)
      }
    }
    for (let j = 0; j < PATH_N; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i
        idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2)
      }
    paperGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    paperGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3))
    paperGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
    paperGeo.setIndex(idx)
    V_LINE = 5 + (LINE_A - A0) * (R_PL + 0.015)
  }
  const paperMat = new THREE.NodeMaterial()
  {
    const vUv = uvA()
    paperMat.fragmentNode = Fn(() => {
      const P = positionWorld.toVar()
      const N = normalize(normalWorld).toVar()
      const lt = light(P, N)
      const px = vUv.x.mul(PAPER_W).toVar() // cm from the paper's left edge
      const pv = vUv.y.toVar() //               cm along the path
      const fib = vnoise(vec2(px, pv).mul(vec2(30, 30))).mul(0.06).add(vnoise(vec2(px, pv).mul(vec2(4, 90))).mul(0.04)).add(0.92)
      const manila = vec3(0.66, 0.53, 0.32).mul(fib).toVar()
      // light through the sheet where it stands free above the platen
      const col = manila.mul(lt.diff).add(manila.mul(vec3(1, 0.85, 0.6)).mul(0.08)).toVar()
      // the line: glyph cells revealed as they are struck
      const cellF = px.sub(MARGIN).div(PITCH).toVar()
      const tu = cellF.div(TEXT.length)
      const tv = pv.sub(V_LINE).div(CAP * 1.6).add(0.5)
      const inBand = step(0, tu).mul(step(tu, 1)).mul(step(0, tv)).mul(step(tv, 1))
      const shown = step(floor(cellF).add(0.5), U.typed)
      const g = texture(typeTex, vec2(tu, tv)).a.mul(inBand).mul(shown).toVar()
      // the ribbon's weave printed into the ink
      const weave = sin(px.mul(380)).mul(sin(pv.mul(380))).mul(0.18).add(0.82)
      const wetk = exp(U.fresh.mul(-6)).mul(step(floor(cellF).add(1.5), U.typed).oneMinus()).mul(step(floor(cellF).add(0.5), U.typed))
      const ink = vec3(0.012, 0.01, 0.016)
      col.assign(mixN(col, ink.add(vec3(0.05).mul(wetk)), clampN(g.mul(weave).mul(1.1), 0, 1)))
      // an impression: the slug bit the paper a little; a faint emboss shadow on the line
      col.mulAssign(float(1).sub(g.mul(0.05)))
      // debug: the struck line as a flat magenta plate
      const plate = step(-0.01, tu).mul(step(tu, U.typed.div(TEXT.length).add(0.01))).mul(step(-0.03, tv)).mul(step(tv, 1.03)).mul(U.debug)
      return vec4(mixN(col, vec3(1, 0, 1), plate), 1)
    })()
    paperMat.side = THREE.DoubleSide
    mats.push(paperMat)
  }
  const paper = new THREE.Mesh(paperGeo, paperMat)
  carriage.add(paper)

  // every frosted part carries its own box for the frost's front (see frost()); run again once the desk is built
  const tagFrost = () => {
    const FROSTED = new Set<THREE.Material>([ENAMEL, ENAMEL_DARK, CHROME, KNOB, SLUGM])
    const bb = new THREE.Box3(), c = new THREE.Vector3(), hh = new THREE.Vector3()
    const tag = (o: THREE.Object3D) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !FROSTED.has(m.material as THREE.Material) || m.geometry.getAttribute("fq")) return
      const g = m.geometry
      g.computeBoundingBox()
      bb.copy(g.boundingBox!)
      bb.getCenter(c)
      bb.getSize(hh).multiplyScalar(0.5)
      const p = g.attributes.position
      const fq = new Float32Array(p.count * 3), fh = new Float32Array(p.count * 3)
      for (let i = 0; i < p.count; i++) {
        fq.set([p.getX(i) - c.x, p.getY(i) - c.y, p.getZ(i) - c.z], i * 3)
        fh.set([hh.x, hh.y, hh.z], i * 3)
      }
      g.setAttribute("fq", new THREE.BufferAttribute(fq, 3))
      g.setAttribute("fh", new THREE.BufferAttribute(fh, 3))
    }
    scene.traverse(tag)
  }
  tagFrost()
  NUC[NUC_GUIDE].set(0, PP.y - 1.1, PP.z + 0.8, 4)
  for (const s of [0, 1]) NUC[NUC_SPOOL + s].set((s ? 1 : -1) * (RIB_L / 2 + 1.6), PP.y - 1.6, PP.z - 0.6, 6)

  // ---------------------------------------------------------------- the desk, the proposal, the card

  const desk = add(new THREE.PlaneGeometry(220, 140).rotateX(-Math.PI / 2), LINO, scene, 20, DESK_Y, 0)
  add(new THREE.BoxGeometry(220, 1.4, 1.4), CHROME, scene, 20, DESK_Y - 0.7, 40)
  void desk

  let phraseBox: [number, number, number, number] = [0, 0, 0, 0] // inches: x0, y0 (from top), x1, y1
  const pageTex = canvasTex(PAGE_TEX.w, PAGE_TEX.h, (c, w, h) => {
    c.fillStyle = "#e9e4d6"
    c.fillRect(0, 0, w, h)
    let sd = 5
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = `rgba(${rnd() < 0.5 ? "150,130,90" : "255,255,245"},${0.03 + rnd() * 0.04})`
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 5, 1 + rnd() * 1.4)
    }
    const dpi = w / 8.5
    const face = "'Times New Roman', Times, 'Liberation Serif', serif"
    // a typewriter's strike: every character its own weight
    const typeLine = (str: string, x: number, y: number, size: number, center = false, track = 0) => {
      c.font = `${size}px ${face}`
      let tw = 0
      for (const ch of str) tw += c.measureText(ch).width + track
      let xx = center ? x - tw / 2 : x
      const x0 = xx
      for (const ch of str) {
        const a = 0.7 + rnd() * 0.3
        c.fillStyle = `rgba(22,20,24,${a})`
        c.fillText(ch, xx + (rnd() - 0.5) * 0.8, y + (rnd() - 0.5) * 1.2)
        xx += c.measureText(ch).width + track
      }
      return [x0, xx]
    }
    c.textBaseline = "alphabetic"
    const S = Math.round(0.142 * dpi) // body size, as the scan
    typeLine("A Proposal for the", w / 2, 0.88 * dpi, S, true, 1.5)
    typeLine("DARTMOUTH SUMMER RESEARCH PROJECT ON ARTIFICIAL INTELLIGENCE", w / 2, 1.24 * dpi, S, true, 1)
    const lines = [
      "We propose that a 2 month,  10 man study of artificial intelligence be",
      "carried out during the summer of 1956 at Dartmouth College in Hanover,  New",
      "Hampshire.  The study is to proceed on the basis of the conjecture that every",
      "aspect of learning or any other feature of intelligence can in principle be so pre-",
      "cisely described that a machine can be made to simulate it.   An attempt will be",
      "made to find how to make machines use language,  form abstractions and concepts,",
      "solve kinds of problems now reserved for humans,  and improve themselves.   We",
      "think that a significant advance can be made in one or more of these problems if",
      "a carefully selected group of scientists work on it together for a summer.",
    ]
    const left = 0.62 * dpi
    const lh = 0.375 * dpi
    const y0 = 1.85 * dpi
    lines.forEach((ln, i) => {
      const [a] = typeLine(ln, i === 0 ? left + 0.62 * dpi : left, y0 + i * lh, S, false, 1.6)
      if (i === 0) {
        c.font = `${S}px ${face}`
        let pre = 0, ph = 0
        for (const ch of "We propose that a ") pre += c.measureText(ch).width + 1.6
        for (const ch of "2 month,  10 man study") ph += c.measureText(ch).width + 1.6
        phraseBox = [(a + pre + 10) / dpi, (y0 - S * 0.8) / dpi, (a + pre + ph + 4) / dpi, (y0 + S * 0.25) / dpi]
      }
    })
    typeLine("The following are some aspects of the artificial intelligence problem:", left + 0.75 * dpi, y0 + 9 * lh, S, false, 1.6)
    typeLine("1)  Automatic Computers", left + 0.75 * dpi, y0 + 10 * lh, S, false, 1.6)
  })
  const uPhrase = uniform(new THREE.Vector4(0, 0, 0, 0))
  const pageMat = new THREE.NodeMaterial()
  {
    const vUv = uvA()
    pageMat.fragmentNode = Fn(() => {
      const P = positionWorld.toVar()
      const N = normalize(normalWorld).toVar()
      const lt = light(P, N)
      const st = vUv.toVar()
      const t = texture(pageTex, st).rgb
      const col = t.mul(lt.diff).toVar()
      // the selection plate for the label tool
      const xi = st.x.mul(8.5), yi = st.y.oneMinus().mul(11)
      const plate = step(uPhrase.x.sub(0.03), xi).mul(step(xi, uPhrase.z.add(0.03))).mul(step(uPhrase.y.sub(0.02), yi)).mul(step(yi, uPhrase.w.add(0.02))).mul(U.debug)
      return vec4(mixN(col, vec3(1, 0, 1), plate), 1)
    })()
    mats.push(pageMat)
  }
  const pageG = new THREE.Group()
  pageG.position.set(PAGE.x, DESK_Y + 0.02, PAGE.z)
  pageG.rotation.y = PAGE.rot
  scene.add(pageG)
  const page = add(new THREE.PlaneGeometry(PAGE.w, PAGE.h).rotateX(-Math.PI / 2), pageMat, pageG)
  void page

  tagFrost()

  // ---------------------------------------------------------------- the rule: hammer-finish enamel, cream cuts

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "blackened", debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvA().toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const N = normalize(normalWorld)
    const q = st.mul(vec2(140, 9))
    const c = voronoi(q).toVar()
    const dimple = smoothstep(0.1, 0.65, c.x)
    const ground = vec3(0.03, 0.038, 0.034).mul(dimple.mul(0.3).add(0.8)).add(vec3(0.05, 0.05, 0.045).mul(pow(max(N.y, 0), 4)))
    const lit = mixN(ground, toLinear(cut.rgb).mul(0.95), on)
    return vec4(ctx.debugLabels ? mixN(lit, toLinear(cut.rgb), step(0.02, on)) : lit, 1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 100
  rule.frustumCulled = false
  const ruleScene = new THREE.Scene()
  const ruleCam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 400)
  ruleScene.add(rule)

  // ---------------------------------------------------------------- targets and the finishing pass

  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), focus: uniform(new THREE.Vector4(0.6, 0.5, 0.5, 0.4)), blur: uniform(0), whip: uniform(0), asp: uniform(16 / 9), shade: uniform(0) }
  // depth of field as a focus ellipse (the macro's thin plane), and the whip pan's streak
  const fin = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const dd = uv.sub(D.focus.xy).div(D.focus.zw)
    const r = D.blur.mul(smoothstep(0.6, 1.4, length(dd))).add(D.whip).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    const n = 14
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 2.39996
      const rr = Math.sqrt((i + 0.5) / n)
      const o = vec2(float(Math.cos(a) * rr).mul(r.sub(D.whip)).div(D.asp).add(float((i / n - 0.5) * 2).mul(D.whip)), float(Math.sin(a) * rr).mul(r.sub(D.whip)).add(float((i / n - 0.5) * 0.6).mul(D.whip)))
      const s = sampleRT(D.tT, uv.add(o) as V2)
      acc.addAssign(vec4(s.rgb, 1).mul(select(r.greaterThan(0.0004), float(1), float(0))))
    }
    const col = acc.rgb.div(acc.a).toVar()
    // a soft shade under the headline where the frame behind it is paper
    col.mulAssign(float(1).sub(D.shade.mul(smoothstep(0.62, 0.0, length(uv.sub(vec2(0.2, 0.86)).mul(vec2(0.9, 2.2)))))))
    return vec4(col, 1)
  }, D)

  // ---------------------------------------------------------------- the story clock

  const st = { back: 0, typedCells: 0, lastStrike: -1, beat1: false, sel: { ok: false, x: 0, y: 0, w: 0, h: 0 }, note: { x: 0, y: 0 } }
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), vX = new THREE.Vector3(), vY = new THREE.Vector3(), vZ = new THREE.Vector3(), vP = new THREE.Vector3()
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3()
  const camA = new THREE.Vector3(), camB = new THREE.Vector3(), lookA = new THREE.Vector3(), lookB = new THREE.Vector3()
  const phraseW: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const lineW: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const LBL: LabelInfo[] = [
    { id: "typed line", corners: [[0, 0], [0, 0], [0, 0], [0, 0]] },
    { id: "proposal phrase", corners: [[0, 0], [0, 0], [0, 0], [0, 0]] },
  ]
  const LOUT: LabelInfo[] = []

  /** Where the carriage is at time t of beat 0: one step left after each strike. */
  const carriageAt = (t: number) => {
    let x = MARGIN + 0.5 * PITCH - PAPER_W / 2 // cell 0 under the print point
    let cells = 0
    let shift = 0
    let last = -1
    for (let i = 0; i < STROKES.length; i++) {
      const k = STROKES[i]
      const ts = strikeAt(i)
      if (k.ch === "FIGS") {
        shift = E.io2(ramp(t, ts, ts + 0.06))
        continue
      }
      if (t >= ts) {
        cells = k.cell + 1
        last = ts
      }
      // the step: the escapement lets the carriage on, quick, with a little overshoot
      const sk = ramp(t, ts + 0.035, ts + 0.075)
      x += PITCH * (sk > 0 ? E.outBack(sk) : 0)
    }
    return { x: -x, cells, shift, last }
  }

  /** A typebar's swing: 0 at rest, 1 on the platen. */
  const swingOf = (bar: number, t: number) => {
    let v = 0
    for (let i = 0; i < STROKES.length; i++) {
      if (STROKES[i].bar !== bar) continue
      const ts = strikeAt(i)
      const up = ramp(t, ts - 0.05, ts)
      const dn = ramp(t, ts + 0.005, ts + 0.09)
      v = Math.max(v, E.in2(up) * (1 - E.out2(dn)))
    }
    return v
  }

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1)
    U.time.value = s.time
    const asp = s.w / Math.max(1, s.h)
    cam.aspect = asp
    D.asp.value = asp
    st.beat1 = s.beat >= 1
    // ---- beat 0: the typing
    const tc = st.beat1 ? 99 : t0
    const C = carriageAt(Math.max(tc, -1))
    carriage.position.x = C.x
    NUC[NUC_KNOB].set(C.x - (PL_LEN / 2 + 1.9), 0, 0, 6)
    NUC[NUC_KNOB + 1].set(C.x + (PL_LEN / 2 + 1.9), 0, 0, 6)
    // every strike shakes the carriage a little; the "?" hits hardest
    const since = C.last >= 0 ? tc - C.last : 9
    const knock = since < 0.25 ? Math.exp(-since * 30) * Math.sin(since * 160) : 0
    carriage.position.y = -0.34 * C.shift + 0.012 * knock
    U.typed.value = C.cells
    U.fresh.value = C.last >= 0 ? Math.max(0, tc - C.last) : 9
    st.typedCells = C.cells
    // the bars
    let lifting = 0
    for (let k = 0; k < BARS; k++) {
      const sw = st.beat1 ? 0 : swingOf(k, tc)
      lifting = Math.max(lifting, sw)
      const phi = PHI(k)
      const d = vA.copy(E1).multiplyScalar(Math.cos(phi)).addScaledVector(E2, Math.sin(phi))
      const tang = vB.crossVectors(NRM, d).normalize()
      const th = mix(-0.12, Math.atan2(BH, -BR), sw)
      vX.copy(d).multiplyScalar(Math.cos(th)).addScaledVector(NRM, -Math.sin(th))
      vZ.copy(tang)
      vY.crossVectors(vZ, vX).normalize()
      m4.makeBasis(vX, vY, vZ)
      vP.copy(B0).addScaledVector(d, BR)
      m4.setPosition(vP)
      bars.setMatrixAt(k, m4)
      slugs.setMatrixAt(k, m4)
    }
    bars.instanceMatrix.needsUpdate = true
    slugs.instanceMatrix.needsUpdate = true
    void qq
    // the ribbon guide lifts with the bar
    ribbon.position.set(0, 1.05 * lifting * Math.cos(LINE_A - 0.72), -1.05 * lifting * Math.sin(LINE_A - 0.72))
    // ---- beat 1: winter, once
    const reach = ramp(t1, T_FROST0, T_FROST1) // a steady creep: edges and bolt heads first, the middles of the faces last
    U.reach.value = st.beat1 ? reach : 0
    U.melt.value = st.beat1 ? smooth(T_MELT0, T_MELT1, t1) : 0
    U.dry.value = st.beat1 ? smooth(T_MELT1, T_DRY1, t1) : 0
    const cold = U.reach.value * (1 - U.melt.value)
    U.lampCol.value.set(mix(1.0, 0.62, cold), mix(0.8, 0.72, cold), mix(0.55, 0.86, cold)).multiplyScalar(mix(1, 0.85, cold))

    // ---- the lens
    const enterT = s.beat === 0 ? t0 : 9
    const jolt = enterT > -0.05 && enterT < 0.6 ? 0.09 * Math.exp(-Math.max(0, enterT) * 9) * Math.sin(Math.max(0, enterT) * 55) : 0
    const hand = (k: number) => k * (0.06 * Math.sin(s.time * 0.53) + 0.04 * Math.sin(s.time * 0.91 + 1.3))
    if (!st.beat1) {
      // over the platen, the print point on the right, pushing in as the line grows; then the crane
      const tt = st.beat1 ? 5 : t0
      const push = E.io2(ramp(tt, 0, 2.6))
      const lineMid = -0.5 * PITCH * C.cells
      camA.set(2.2 - 0.8 * push, PP.y + 3.2 - 0.5 * push, PP.z + 6.6 - 1.3 * push)
      lookA.set(lineMid * 0.6 - 1.0, PP.y - 0.45, PP.z - 0.3)
      const cr = E.io3(ramp(tt, 2.75, 3.9))
      camB.set(-1.2, PP.y + 10.5, PP.z + 13)
      lookB.set(-2.4, PP.y - 2.6, PP.z - 0.5)
      cam.position.lerpVectors(camA, camB, cr)
      vC.lerpVectors(lookA, lookB, cr)
      const qk = tt - T_TYPED
      const kick = qk > 0 && qk < 0.5 ? 0.06 * Math.exp(-qk * 10) * Math.sin(qk * 70) : 0
      cam.position.x += hand(0.25 + cr) + jolt
      cam.position.z += kick
      cam.position.y += hand(0.2) * 0.7 + 0.03 * Math.sin(s.time * 1.7)
      cam.lookAt(vC)
      D.focus.value.set(0.56, 0.5, mix(0.32, 0.6, cr), mix(0.22, 0.45, cr))
      D.blur.value = mix(0.012, 0.006, cr)
      D.whip.value = st.beat1 ? 0.06 * smooth(0, 0.3, t1) : 0
    } else {
      // whip pan right and down to the desk: the page, the machine's right end in the left of the frame
      const wp = E.io3(ramp(t1, 0.0, 0.62))
      const push = E.io2(ramp(t1, 0.62, 4.0))
      // the phrase's middle, from the page
      const [qx0, qy0, qx1, qy1] = phraseBox
      pageG.updateMatrixWorld()
      const ph = vA.set(((qx0 + qx1) / 2) * 2.54 - PAGE.w / 2, 0, ((qy0 + qy1) / 2) * 2.54 - PAGE.h / 2)
      pageG.localToWorld(ph)
      camA.set(-1.2, PP.y + 10.5, PP.z + 13)
      // then the lens pulls back off the page to the machine, which freezes and thaws in front of it
      const back = E.io3(ramp(t1, 1.05, 1.55))
      st.back = back
      camB.set(ph.x + 5.0 - 0.5 * push, ph.y + 5.3 - 0.45 * push, ph.z - 0.4 + 0.4 * push)
      const drift = smooth(1.55, 4.0, t1)
      camB.lerp(vB.set(9.5 - 1.2 * drift, PP.y + 7.6 - 0.6 * drift, PP.z + 14.5 - 1.5 * drift), back)
      cam.position.lerpVectors(camA, camB, wp)
      lookA.set(-2.4, PP.y - 2.6, PP.z - 0.5)
      lookB.set(ph.x - 1.1, ph.y + 0.2, ph.z - 0.2).lerp(vB.set(-0.6, PP.y - 2.4, PP.z - 0.8), back)
      vC.lerpVectors(lookA, lookB, wp)
      cam.position.x += hand(0.3)
      cam.position.y += hand(0.2) * 0.6
      cam.lookAt(vC)
      D.whip.value = 0.06 * Math.sin(Math.PI * clamp(t1 / 0.62)) ** 2 + 0.035 * Math.sin(Math.PI * ramp(t1, 1.05, 1.55)) ** 2
      D.focus.value.set(mix(0.62, 0.55, back), mix(0.48, 0.5, back), mix(0.48, 0.62, back), mix(0.36, 0.5, back))
      D.blur.value = 0.008 * smooth(0.4, 0.9, t1)
    }
    D.shade.value = st.beat1 && t1 > 0.4 ? 0.25 : 0.55
    if (ctx.debugLabels) {
      D.shade.value = 0
      D.blur.value = 0
      D.whip.value = 0
    }
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()

    // ---- labels and the selection box: the struck line (once complete), the phrase on the page
    const r = R_PL + 0.015
    const aHalf = (CAP * 0.8) / r
    const xs = carriage.position.x - PAPER_W / 2 + MARGIN
    const xe = xs + PITCH * C.cells
    const ys = carriage.position.y
    lineW[0].set(xs, ys + r * Math.sin(LINE_A + aHalf), r * Math.cos(LINE_A + aHalf))
    lineW[1].set(xe, ys + r * Math.sin(LINE_A + aHalf), r * Math.cos(LINE_A + aHalf))
    lineW[2].set(xe, ys + r * Math.sin(LINE_A - aHalf), r * Math.cos(LINE_A - aHalf))
    lineW[3].set(xs, ys + r * Math.sin(LINE_A - aHalf), r * Math.cos(LINE_A - aHalf))
    const [px0, py0, px1, py1] = phraseBox
    uPhrase.value.set(px0, py0, px1, py1)
    const toPage = (xin: number, yin: number, o: THREE.Vector3) => {
      // inches on the page (from its top-left) to world
      o.set(xin * 2.54 - PAGE.w / 2, 0.03, yin * 2.54 - PAGE.h / 2)
      return pageG.localToWorld(o)
    }
    pageG.updateMatrixWorld()
    toPage(px0, py0, phraseW[0])
    toPage(px1, py0, phraseW[1])
    toPage(px1, py1, phraseW[2])
    toPage(px0, py1, phraseW[3])
    st.sel.ok = false
    if (st.beat1 && t1 > 0.62 && st.back < 0.15) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
      for (const w of phraseW) {
        vB.copy(w).project(cam)
        const x = (vB.x * 0.5 + 0.5) * 1920, y = (0.5 - vB.y * 0.5) * 1080
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
      Object.assign(st.sel, { ok: true, x: x0 - 10, y: y0 - 8, w: x1 - x0 + 20, h: y1 - y0 + 16 })
    }
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    if (s.live) ctx.synth.bed("hum", st.beat1 ? 0.12 * (1 - U.reach.value * 0.7) : 0.22)
    if (s.live && st.beat1 && U.melt.value > 0.05) ctx.synth.bed("water", 0.25 * U.melt.value * (1 - U.dry.value))
  }

  const corners = (pts: THREE.Vector3[], L: LabelInfo) => {
    for (let i = 0; i < 4; i++) {
      vB.copy(pts[i]).project(cam)
      L.corners[i][0] = vB.x
      L.corners[i][1] = vB.y
    }
    return L
  }

  // ---------------------------------------------------------------- sound

  const cues: Cue[] = [...ruleCues(ctx.def.id, { start: START })]
  STROKES.forEach((k, i) => {
    const at = strikeAt(i)
    if (k.ch === "FIGS") cues.push({ b: 0, at, s: "gear", o: { g: 0.35, dur: 0.06 }, pos: [0.3, -0.1, 0.1] })
    else if (k.ch === " ") cues.push({ b: 0, at, s: "tick", o: { g: 0.3, f: H(40) }, pos: [0.3, -0.1, 0.1] })
    else cues.push({ b: 0, at: at - 0.035, s: "teleprinter", o: { g: k.ch === "?" ? 1 : 0.75, f: H(48 + (k.bar % 7)) }, pos: [0.25 - (k.bar / BARS - 0.5) * 0.3, -0.15, 0.1] })
  })
  cues.push(
    { b: 0, at: T_TYPED + 0.02, s: "thud", o: { g: 0.35, f: H(4) }, pos: [0.2, -0.2, 0.2] },
    { b: 0, at: 2.8, s: "whoosh", o: { g: 0.14, f: 500, dur: 0.9 } },
    { b: 1, at: 0.0, s: "whoosh", o: { g: 0.32, f: 1300, dur: 0.5 } },
    { b: 1, at: 0.58, s: "page", o: { g: 0.35, dur: 0.25 }, pos: [0.3, -0.3, 0.2] },
    { b: 1, at: 0.82, s: "select", o: { g: 0.8 }, pos: [0.2, 0, 0] },
    { b: 1, at: T_FROST0, s: "hiss", o: { g: 0.22, dur: T_FROST1 - T_FROST0 } },
    { b: 1, at: T_FROST0 + 0.2, s: "glass", o: { g: 0.25, f: H(64) }, pos: [-0.7, 0, 0.3] },
    { b: 1, at: T_FROST0 + 0.55, s: "glass", o: { g: 0.22, f: H(72) }, pos: [-0.5, 0.2, 0.3] },
    { b: 1, at: T_FROST0 + 0.85, s: "glass", o: { g: 0.2, f: H(80) }, pos: [-0.3, -0.1, 0.3] },
    { b: 1, at: T_FROST1 - 0.1, s: "shimmer", o: { g: 0.3, f: H(32) } },
    { b: 1, at: T_MELT0 + 0.2, s: "pluck", o: { g: 0.25, f: H(36) }, pos: [-0.6, -0.4, 0.2] },
    { b: 1, at: T_MELT0 + 0.5, s: "pluck", o: { g: 0.2, f: H(40) }, pos: [-0.4, -0.5, 0.2] },
    { b: 1, at: T_MELT1, s: "pluck", o: { g: 0.18, f: H(45) }, pos: [-0.7, -0.3, 0.2] },
  )
  for (let i = 0; i < "Not yet.".length; i++) cues.push({ b: 1, at: T_NOTYET + 0.25 + i / 19, s: "type", o: { g: 0.5 } })

  // ---------------------------------------------------------------- type

  const TITLES: TitleOpts = { color: "#f4eee2", shadow: "rgba(0,0,0,0.7)", delay: [ageCardClear(ctx.def.id, START) + 0.08, 0.25] }
  const HUD = { color: "#efe6d2", shadow: "rgba(0,0,0,0.7)" }

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { scene: ruleScene, camera: ruleCam, target: out },
      { pass: fin, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x060605, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      D.tT.value = stage.texture
      fin.render(out)
      ruleCam.position.copy(cam.position)
      ruleCam.quaternion.copy(cam.quaternion)
      ruleCam.aspect = cam.aspect
      ruleCam.updateProjectionMatrix()
      ruleCam.updateMatrixWorld()
      placeRule(rule, ruleCam, { dist: 3 })
      r.setRenderTarget(out)
      r.autoClear = false
      r.render(ruleScene, ruleCam)
      r.autoClear = true
      const cold = U.reach.value * (1 - U.melt.value)
      const post: PostOpts = ctx.debugLabels
        ? { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, vignette: 0 }
        : { tone: "agx", exposure: st.beat1 ? 1.15 : 1.36, bloom: 0.25 + 0.2 * cold, bloomThresh: 1.1 - 0.25 * cold, bloomRadius: 0.6, vignette: 0.3, grain: 0.026, contrast: 1.08, sat: 0.95 - 0.2 * cold, lift: [0.006 - 0.004 * cold, 0.005, 0.004 + 0.008 * cold], gain: [1.02 - 0.12 * cold, 1.0 - 0.02 * cold, 0.96 + 0.14 * cold], halation: 0.06 }
      ctx.finish(out.texture, post)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(0,0,0,0.7)", color: "#f4eee2" })
      titles(g, s, ctx.def, TITLES)
      if (s.beat === 1) {
        const t = s.at(1)
        if (st.sel.ok) {
          const k = E.outBack(clamp((t - 0.8) / 0.25))
          const cx = st.sel.x + st.sel.w / 2, cy = st.sel.y + st.sel.h / 2
          g.selbox(cx - (st.sel.w * k) / 2, cy - (st.sel.h * k) / 2, st.sel.w * k, st.sel.h * k, clamp((t - 0.8) / 0.12) * (1 - s.exit * 2))
        }
        comment(g, "Not yet.", 1500, 330, t, { t0: T_NOTYET, out: 3.45, w: 230 })
      }
    },
    hud: () => HUD,
    labels: (s) => {
      LOUT.length = 0
      LOUT.push(...ruleLabels(face))
      if (s.beat === 0 && s.at(0) > T_TYPED + 0.05) LOUT.push(corners(lineW, LBL[0]))
      if (s.beat === 1 && s.at(1) > 0.7 && st.back < 0.02) LOUT.push(corners(phraseW, LBL[1]))
      return LOUT
    },
    dispose() {
      face.dispose()
      typeTex.dispose()
      slugTex.dispose()
      pageTex.dispose()
      disposeTree(scene)
      disposeTree(ruleScene)
      for (const m of mats) m.dispose()
    },
  }
}

