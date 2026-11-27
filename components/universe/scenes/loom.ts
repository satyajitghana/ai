// Scene 25, loom: "Attention Is All You Need." then "Then it answers."
//
// Staging. A floor loom in a dark weaving room, one window up left. Undyed linen warp under tension
// runs from the back beam through two shafts of wire heddles (plain weave: odd ends on one shaft,
// even on the other) and a steel reed in its beater, to the fell, where the cloth begins and comes
// toward the lens over the breast beam. A boat shuttle throws dyed weft through the shed. Each
// throw is one token: a band of picks with the word woven into it as an inlay (a supplementary
// weft floating over the ground where the letters are), the bands set flush left like the column
// of tokens in an attention diagram. The beater thuds, the cloth steps toward the lens, and dyed
// threads tie the new token back to earlier ones, knotted in the margin: madder to the previous
// token, logwood to a delimiter, weld spread broadly (Clark et al. 2019 found all three kinds of
// head in BERT; colours as heads is Vaswani et al. 2017, Figure 3). Every thread runs from the new
// token back to an earlier one, never ahead (the paper's causal mask). Beat 1: the question from
// scene 22 is woven above the sentence, a key per letter, and the cloth answers in tokens that
// carry no words (nothing is put in a machine's mouth): indigo stripes, as on a linen towel, each
// tied to its previous token and to the question mark, faster and faster.
//
// Story parameter. `picks`: how much cloth has been woven (bands beaten in, continuous). It moves
// the cloth, the beater, the shed, the arcs' anchors, the camera's follow and the bed.
// World rule. One window key (cool daylight, up left behind the loom) and one warm lamp fill from
// the weaver's side: `lit()` shades every surface. One weave function: `weave()` is the cloth.
// Beat sheet and sources: R/beats/loom.md.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraPosition, clamp as clampN, cross, Discard, dot, exp, float, floor, Fn, fract, fwidth, instanceIndex, int, length, max, min, mix as mixN, mod, normalize, normalWorld, positionGeometry, positionView, positionWorld, pow, select, sin, step, texture, uniform, uniformArray, uniformTexture, uv as uvAttr, vec2, vec3, vec4 } from "three/tsl"

import { placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { clamp, E, mix, smooth } from "../engine/ease"
import { canvasTex, disposeTree, shake, stageTarget } from "../engine/stage"
import { H } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { hash21, L0, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, LabelInfo, PostOpts, SceneInstance, State } from "../engine/types"
import { UNRAVEL_DUR, UNRAVEL_IN } from "../transitions/unravel"

// ---------------------------------------------------------------- the loom (metres; y up, warp along z, the weaver at +z)

const PITCH = 0.0016 // ends per metre and picks per metre are the same: 6.25 per cm, a coarse linen
const HALF = 0.28 // half the cloth's width at the reed
const ENDS = Math.round((2 * HALF) / PITCH) // 350
const BAND = 18 // picks per token
const ROW0 = 2, ROW1 = 15 // the letter rows inside a band (14 picks; the capitals stand about 9 picks, 14 mm)
const Q0 = 300 // picks of plain heading woven before the scene opens
const ZH = -0.22 // the heddles
const ZB = -0.95 // the back beam
const ZBR = 0.5 // the breast beam
const SHED = 0.042 // how far a shaft lifts its ends at the heddles
const REED0 = -0.125, REED1 = -0.003 // the reed at rest and beaten up to the fell
const SH_Z = -0.05 // the shuttle's lane on the race
const XL = -0.15 // the column's left edge; the margin to its left carries the threads
const CELLPX = 8 // atlas pixels per weave cell
const ATW = 2048, ATROW = 112
const START = UNRAVEL_DUR * (1 - UNRAVEL_IN)

// ---------------------------------------------------------------- the tokens (all from the script: the title of Vaswani et al., and Turing's question from scene 22)

type Tok = { s: string; beat: number; T: number; gap: number; kind: 0 | 1 | 2; line: number; dye: number }
// kind: 0 a word, 1 punctuation, 2 a token with no word (the answer). dye: 0 iron black, 1 indigo.
const SENT = ['"', "Attention", "Is", "All", "You", "Need", "."]
const QUES = ["Can", "machines", "think", "?"]
const ANSW = [3, 2, 4, 2, 3, 2, 4] // the answer's stripes: half-heights in picks, no words
const PUNCT = new Set(['"', ".", "?"])

const TOKS: Tok[] = (() => {
  const out: Tok[] = []
  // beat 0: seven throws, each gap shorter than the last
  let T = 0.5
  let g = 0.38
  SENT.forEach((s) => {
    out.push({ s, beat: 0, T, gap: g, kind: PUNCT.has(s) ? 1 : 0, line: 0, dye: 0 })
    T += g
    g *= 0.86
  })
  // beat 1: the question, a key per letter, then the answer racing
  T = 0.1
  g = 0.27
  QUES.forEach((s) => {
    out.push({ s, beat: 1, T, gap: g, kind: PUNCT.has(s) ? 1 : 0, line: 1, dye: 0 })
    T += g
    g *= 0.9
  })
  T += 0.08
  g = 0.21
  ANSW.forEach(() => {
    out.push({ s: "", beat: 1, T, gap: g, kind: 2, line: 1, dye: 1 })
    T += g
    g *= 0.86
  })
  return out
})()
const NT = TOKS.length
const ATH = NT * ATROW
const THROW = (k: Tok) => Math.min(0.26, k.gap * 0.62) // the shuttle's crossing
const TBEAT = (k: Tok) => k.T + THROW(k) // the beater lands
const BEATD = 0.07

/** Heads: 0 madder (to the previous token), 1 logwood (to a delimiter), 2 weld (broad). */
type Arc = { i: number; j: number; h: number; w: number }
const ARCS: Arc[] = (() => {
  const a: Arc[] = []
  const iDot = SENT.length - 1, iQ = SENT.length + QUES.length - 1
  for (let i = 1; i < NT; i++) {
    a.push({ i, j: i - 1, h: 0, w: 0.9 })
    if (i < SENT.length) {
      if (i >= 2) a.push({ i, j: 0, h: 1, w: 0.7 })
      for (let j = 1; j < i - 1; j++) a.push({ i, j, h: 2, w: 1 / i })
    } else if (i <= iQ) {
      if (i > SENT.length) a.push({ i, j: iDot, h: 1, w: 0.75 })
      for (let j = SENT.length; j < i - 1; j++) a.push({ i, j, h: 2, w: 0.45 })
    } else {
      // the answer: to its previous token and to the question mark
      if (i > iQ + 1) a.push({ i, j: iQ, h: 1, w: 0.75 })
    }
  }
  // causal, always: every thread runs from the newer token back to an earlier one
  for (const x of a) if (x.j >= x.i) throw new Error("loom: a thread looks ahead")
  return a
})()

const DYES: [number, number, number][] = [
  [0.03, 0.024, 0.02], // iron black
  [0.012, 0.02, 0.07], // indigo
]
const HEADS: [number, number, number][] = [
  [0.52, 0.05, 0.035], // madder
  [0.2, 0.045, 0.25], // logwood
  [0.64, 0.45, 0.04], // weld
]

// ---------------------------------------------------------------- small helpers

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
const sstep = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(e0).div(fl(e1).sub(e0)), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
const v3 = (c: [number, number, number]) => vec3(c[0], c[1], c[2])

/** The word atlas: each token's word on its own row, drawn once, read cell by cell by the weave. */
function wordAtlas(cells: number[]) {
  return canvasTex(ATW, ATH, (c) => {
    c.fillStyle = "#000"
    c.fillRect(0, 0, ATW, ATH)
    c.fillStyle = "#fff"
    c.font = "bold 96px Arial, Helvetica, sans-serif"
    c.textBaseline = "alphabetic"
    TOKS.forEach((k, i) => {
      if (k.kind === 2) return
      // the baseline three cells up from the row's foot so descenders fit (rows ROW0..ROW1 = 112 px)
      c.fillText(k.s, CELLPX * 0.5, i * ATROW + ATROW - 22)
      cells[i] = Math.max(2, Math.ceil((c.measureText(k.s).width + CELLPX) / CELLPX))
    })
  })
}

// ---------------------------------------------------------------- the scene

export function create(ctx: Ctx): SceneInstance {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.01, 30)

  // ---- layout of the words along the cloth
  const cells = new Array<number>(NT).fill(0)
  const atlas = wordAtlas(cells)
  atlas.generateMipmaps = false
  atlas.minFilter = THREE.LinearFilter
  ANSW.forEach((_, k) => (cells[SENT.length + QUES.length + k] = 16))
  // every token on its own band, set flush left like a column of tokens in an attention diagram;
  // the threads loop through the margin to the left of the column
  const X0 = TOKS.map(() => XL)
  const X1 = TOKS.map((_, i) => XL + cells[i] * PITCH)

  // ---- uniforms
  const U = {
    W: uniform(Q0), //       picks beaten into the cloth (continuous)
    Qend: uniform(Q0), //    end of the last band that exists (woven or being woven)
    cur: uniform(-1), //     the token being thrown
    front: uniform(0), //    the weft's frontier behind the shuttle (x)
    dir: uniform(1),
    shed: uniform(1), //     which shaft is up (-1..1)
    ring: uniform(0), //     the warp's vibration after a beat or the snap
    ringT: uniform(0),
    T0: uniform(0),
    T1: uniform(-9),
    dbg: uniform(ctx.debugLabels ? 1 : 0),
    lab0: uniform(0), //     first and last token whose word is a label right now
    lab1: uniform(-1),
    pxK: uniform(600), //    pixels per metre at one metre from the lens (for footprint filtering)
  }
  const tokA = uniformArray(TOKS.map((k, i) => new THREE.Vector4(X0[i], X1[i], k.kind === 2 ? ANSW[i - SENT.length - QUES.length] : i, k.kind)), "vec4")
  const tokB = uniformArray(TOKS.map((k) => new THREE.Vector4(k.dye, 0, 0, 0)), "vec4")

  // ---- the world rule: one window, one lamp
  const KEY = new THREE.Vector3(-0.55, 0.75, -0.45).normalize()
  const KEYD = vec3(KEY.x, KEY.y, KEY.z)
  const KEYC = vec3(0.95, 0.93, 0.88).mul(2.3)
  const LAMP = vec3(0.35, 0.55, 0.9) // the weaver's lamp, low and to the right
  const LAMPC = vec3(1.0, 0.68, 0.38).mul(0.3)
  const SKY = vec3(0.05, 0.055, 0.07)
  const lit = (alb: V3, N: V3, P: V3, o: { spec?: Num; shin?: number; ao?: Num; sh?: Num; sheen?: Num } = {}): V3 => {
    const V = normalize(cameraPosition.sub(P))
    const ndl = max(dot(N, KEYD), 0)
    const Ld = normalize(LAMP.sub(P))
    const dl = length(LAMP.sub(P))
    const lamp = LAMPC.mul(max(dot(N, Ld), 0)).div(dl.mul(dl).add(0.25))
    const Hh = normalize(KEYD.add(V))
    const sp = pow(max(dot(N, Hh), 0), o.shin ?? 30).mul(fl(o.spec ?? 0.05)).mul(ndl.mul(4).min(1))
    const sh = fl(o.sh ?? 1), ao = fl(o.ao ?? 1)
    // linen's sheen: a soft lobe toward grazing, which is what makes cloth read as cloth
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 3)
    const sheen = KEYC.mul(fres).mul(fl(o.sheen ?? 0)).mul(ndl.mul(2).min(1))
    const amb = SKY.mul(N.y.mul(0.4).add(0.6)).mul(ao)
    return alb.mul(KEYC.mul(ndl).mul(sh).add(lamp.mul(ao)).add(amb)).add(KEYC.mul(sp).mul(sh)).add(sheen.mul(alb.add(0.1)).mul(sh)) as V3
  }
  const depthA = (): F => positionView.z.negate() as F

  // ---- the cloth: one weave function for every pick
  const clothMat = new THREE.NodeMaterial()
  clothMat.side = THREE.DoubleSide
  clothMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    // draw-in: the cloth narrows a little once it leaves the reed, as woven cloth does
    const dIn = float(1).sub(sstep(0, 0.06, P.z as F).mul(0.014))
    const x = P.x.div(dIn).toVar()
    // the beat-up is never perfectly straight: picks wander a fraction of a pick across the width
    const q = U.W.sub(P.z.div(PITCH)).add(vnoise(vec2(x.mul(9), floor(U.W.sub(P.z.div(PITCH))).mul(0.37))).sub(0.5).mul(0.35)).toVar()
    const qi = floor(q).toVar()
    const fy = fract(q).toVar()
    const ci = floor(x.add(HALF).div(PITCH)).toVar()
    const fx = fract(x.add(HALF).div(PITCH)).toVar()
    const inShed = step(U.W, q) // in front of the fell: the new pick lies in the open shed
    Discard(q.greaterThanEqual(U.Qend))
    // the selvedge: on alternate picks the weft turns round the outermost end, a small loop
    const over = abs(x).sub(HALF)
    const loopW = select(mod(qi, 2).lessThan(0.5), float(PITCH * 0.9), float(PITCH * 0.35))
    Discard(over.greaterThan(loopW))
    const tok = floor(qi.sub(Q0).div(BAND)).toVar()
    const k = qi.sub(Q0).sub(tok.mul(BAND)).toVar()
    const hasTok = step(0, tok).mul(step(tok, float(NT - 1)))
    const ti = int(clampN(tok, 0, NT - 1))
    const A = tokA.element(ti) as unknown as V4
    const B = tokB.element(ti) as unknown as V4
    // the token being thrown is only there behind the shuttle
    const isCur = hasTok.mul(step(abs(tok.sub(U.cur)), 0.1))
    const behind = step(0, x.sub(U.front).mul(U.dir).negate())
    Discard(isCur.mul(behind.oneMinus()).greaterThan(0.5))
    // where the band's word is: the atlas read at this cell's centre
    const inX = max(step(A.x, x).mul(step(x, A.y)), step(1.5, A.w))
    const cw = floor(x.sub(A.x).div(PITCH))
    const rowY = A.z.mul(ATROW).add(float(ROW1).sub(k).mul(CELLPX)).add(CELLPX * 0.5)
    const auv = vec2(cw.add(0.5).mul(CELLPX).div(ATW), float(1).sub(rowY.div(ATH)))
    const glyph = texture(atlas).sample(auv).level(L0).r
    const inRows = step(ROW0, k).mul(step(k, float(ROW1)))
    const isBar = step(1.5, A.w)
    const barRows = step(abs(k.sub((ROW0 + ROW1) / 2)), A.z)
    const inlay = hasTok.mul(inX).mul(mixN(step(0.45, glyph).mul(inRows), barRows, isBar)).mul(inShed.oneMinus()).toVar()
    // in the open shed only the newest pick lies, the dyed weft the shuttle trails; the rest of
    // the band is beaten in from under the reed
    Discard(inShed.mul(step(0.5, k)).greaterThan(0.5))
    // plain weave: warp over on alternate cells, the next pick the other way; an inlay floats over
    const warpUp = step(0.5, mod(ci.add(qi), 2)).mul(inShed.oneMinus()).mul(inlay.oneMinus())
    // per-end and per-pick colour: linen varies, and a slub every so often thickens a thread
    const eV = hash21(vec2(ci, 3.1)).toVar()
    const pV = hash21(vec2(qi, 7.7)).toVar()
    const slubW = step(0.93, hash21(vec2(ci, floor(qi.div(9)))))
    const slubP = step(0.95, hash21(vec2(floor(x.add(HALF).div(PITCH * 7)), qi)))
    const warpC = vec3(0.6, 0.53, 0.41).mul(eV.mul(0.14).add(0.88)).mul(slubW.mul(-0.12).add(1))
    const weftC = vec3(0.66, 0.57, 0.42).mul(pV.mul(0.12).add(0.9)).mul(slubP.mul(-0.1).add(1))
    const dye = mixN(v3(DYES[0]), v3(DYES[1]), B.x)
    const weftCol = mixN(weftC, dye, max(inlay, inShed))
    // the thread under the eye: round across, crimped along, with gaps between ends and picks
    const a = select(warpUp.greaterThan(0.5), fx, fy).sub(0.5).toVar() // across the visible thread
    const along = select(warpUp.greaterThan(0.5), fy, fx).sub(0.5).toVar()
    const thick = mixN(float(0.4), float(0.47), max(slubW.mul(warpUp), slubP.mul(warpUp.oneMinus())))
    const body = sstep(thick.add(0.06), thick.sub(0.04), abs(a) as F).toVar()
    // the twist: S-twist stripes across the thread, a fibre pitch of a third of a cell
    const twistC = select(warpUp.greaterThan(0.5), q, x.div(PITCH)).mul(3.0).add(a.mul(1.3))
    const twist = abs(fract(twistC).sub(0.5)).mul(2)
    // fuzz: stray fibres breaking the outline, finer than a thread
    const fz = vnoise(vec2(x.mul(2600), q.mul(1.9)))
    // pixel-aware: fade weave and fibre detail as a cell gets small on screen
    const fw = max(fwidth(q), fwidth(x.div(PITCH))).toVar()
    const det = sstep(0.75, 0.3, fw).toVar()
    const fib = sstep(0.25, 0.1, fw)
    const col = select(warpUp.greaterThan(0.5), warpC, weftCol).toVar()
    col.mulAssign(float(1).sub(twist.mul(0.14).mul(fib)))
    col.mulAssign(fz.mul(0.16).mul(fib).add(0.92))
    // the shape: tilt the normal across the thread, and along it where it dives under its neighbour
    const nA = a.mul(1.7).mul(det)
    const nL = sin(along.mul(3.14159)).mul(0.55).mul(det)
    const tx = select(warpUp.greaterThan(0.5), nA, nL)
    const tz = select(warpUp.greaterThan(0.5), nL, nA)
    const N = normalize(vec3(tx.negate(), 1, tz)).toVar()
    // the gap between threads: darker, the light passing through to the floor below
    const gapAo = mixN(float(1), body.mul(0.75).add(0.25), det)
    const crimpAo = float(1).sub(abs(along).mul(0.5).mul(det))
    // in the shed only the new weft lies here, with daylight between picks
    const shedA = step(abs(fy.sub(0.5)), 0.38)
    Discard(inShed.mul(shedA.oneMinus()).greaterThan(0.5))
    const avg = mixN(mixN(warpC, weftCol, 0.5), weftCol, inlay)
    const alb = mixN(avg, col, det)
    const lc = lit(alb as V3, N as V3, P as V3, { spec: mixN(float(0.03), float(0.12), inlay), shin: 18, ao: gapAo.mul(crimpAo), sheen: 0.35 })
    // the cloth over the breast beam turns away and darkens; and a little shade under the reed
    const reedSh = float(1).sub(sstep(0.0, -0.02, P.z as F).mul(0.35))
    const out = lc.mul(reedSh).toVar()
    // label plates: each word that is meant to be read, flat magenta
    const isLab = inX.mul(inRows).mul(hasTok).mul(step(U.lab0, tok)).mul(step(tok, U.lab1)).mul(step(A.w, 0.5))
    out.assign(mixN(out, vec3(1, 0, 1), isLab.mul(U.dbg)))
    return vec4(out, depthA())
  })()
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF + 0.01, ZBR + 0.03 + 0.03, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, (ZBR + 0.03 - 0.03) / 2), clothMat)
  scene.add(cloth)

  // ---- the warp: one thread per end, back beam to fell, through its heddle
  const shedY = (z: F, shaft: F): F => {
    // the shaft's lift falls off linearly to the fell and to the back beam (a straight thread under tension)
    const toFell = clampN(z.div(ZH), 0, 1)
    const toBack = clampN(z.sub(ZB).div(ZH - ZB), 0, 1)
    const tri = select(z.greaterThan(ZH), toFell, toBack)
    return tri.mul(SHED).mul(U.shed).mul(shaft.mul(2).sub(1)) as F
  }
  const warpGeo = new THREE.InstancedBufferGeometry()
  {
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 48, true).rotateX(Math.PI / 2).translate(0, 0, 0.5) // z 0..1
    warpGeo.index = g.index
    warpGeo.setAttribute("position", g.getAttribute("position"))
    warpGeo.setAttribute("normal", g.getAttribute("normal"))
    const a = new Float32Array(ENDS * 4)
    for (let i = 0; i < ENDS; i++) a.set([-HALF + (i + 0.5) * PITCH, i % 2, ((i * 7919) % 1000) / 1000, i], i * 4)
    warpGeo.setAttribute("aE", new THREE.InstancedBufferAttribute(a, 4))
    warpGeo.instanceCount = ENDS
    warpGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)
  }
  const warpMat = new THREE.NodeMaterial()
  {
    const aE = attribute("aE", "vec4") as unknown as V4
    const t = positionGeometry.z
    const z = mixN(float(ZB), float(0), t)
    const y = shedY(z as F, aE.y).toVar()
    // the warp rings after every beat: a standing wave between fell and back beam
    const ring = sin(t.mul(3.14159)).mul(sin(U.ringT.mul(aE.z.mul(40).add(60)).add(aE.z.mul(6)))).mul(U.ring).mul(0.0018)
    const ctr = vec3(aE.x, y.add(ring).add(0.0004), z)
    // Filtered by footprint: a thread keeps its own 0.65 mm where it covers a pixel or more and is
    // drawn at least 0.6 px wide below that, carrying only its share of coverage; where the ends
    // fall under about two pixels apart they merge into a sheet of the threads' average (their
    // colour by coverage over the dark floor beneath), so the far warp neither moirés nor greys out.
    const dist = length(ctr.sub(cameraPosition))
    const ppm = U.pxK.div(dist)
    const R0 = 0.000325
    const rMin = max(float(R0), float(0.6).div(ppm))
    const sheet = sstep(3.2, 1.7, ppm.mul(PITCH) as F)
    const r = mixN(rMin, float(PITCH * 0.56), sheet)
    warpMat.positionNode = ctr.add(vec3(positionGeometry.x, positionGeometry.y, 0).mul(r))
    const vCov = clampN(float(R0).div(r), 0, 1).toVarying("wC")
    const vT = t.toVarying("wT")
    const vSeed = aE.z.toVarying("wS")
    const vUp = aE.y.toVarying("wU")
    warpMat.fragmentNode = Fn(() => {
      const P = positionWorld
      const N = normalize(normalWorld)
      const lin = vec3(0.6, 0.53, 0.41).mul(vSeed.mul(0.14).add(0.88))
      const tw = abs(fract(vT.mul(900).add(atanish(N))).sub(0.5)).mul(2)
      const fw = fwidth(vT.mul(900))
      const col = lin.mul(float(1).sub(tw.mul(0.16).mul(sstep(0.4, 0.1, fw as F))))
      // the lower layer of the shed sits in the upper layer's shadow
      const low = float(1).sub(vUp).mul(U.shed).add(vUp.mul(U.shed.negate())).max(0)
      const sh = float(1).sub(low.mul(sstep(-0.004, -0.2, P.z as F)).mul(0.35))
      const c = lit(col as V3, N as V3, P as V3, { spec: 0.05, shin: 12, sh, sheen: 0.4 })
      return vec4(mixN(vec3(0.012, 0.009, 0.007), c, vCov), depthA())
    })()
  }
  const warp = new THREE.Mesh(warpGeo, warpMat)
  warp.frustumCulled = false
  scene.add(warp)
  /** A cheap angle round the thread from its normal, for the twist's helix. */
  function atanish(N: V3): F {
    return N.y.mul(0.25).add(N.x.mul(0.25)) as F
  }

  // ---- wood: one material for the frame, beams, shafts, beater and shuttle (with a tint per part)
  const woodMat = (base: [number, number, number], o: { gloss?: number; grain?: number } = {}) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const P = positionWorld.toVar()
      const N = normalize(normalWorld)
      const g = vnoise(vec2(P.x.mul(6).add(P.z.mul(4)), P.y.mul(160).add(P.z.mul(120)))).mul(0.6).add(vnoise(vec2(P.x.add(P.z).mul(30), P.y.mul(500))).mul(0.4))
      const alb = v3(base).mul(g.mul(o.grain ?? 0.35).add(0.82))
      return vec4(lit(alb as V3, N as V3, P as V3, { spec: o.gloss ?? 0.18, shin: 26 }), depthA())
    })()
    return m
  }
  const oak = woodMat([0.2, 0.12, 0.06])
  const maple = woodMat([0.42, 0.28, 0.14], { gloss: 0.35 })
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    b.position.set(x, y, z)
    parent.add(b)
    return b
  }
  // breast beam (the cloth runs over it), back beam, the frame's posts and rails, the castle
  const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 24).rotateZ(Math.PI / 2), oak)
  bb.position.set(0, -0.03, ZBR)
  scene.add(bb)
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 24).rotateZ(Math.PI / 2), oak)
  back.position.set(0, -0.035, ZB)
  scene.add(back)
  for (const sx of [-1, 1]) {
    box(0.06, 1.3, 0.06, oak, sx * 0.62, -0.35, ZBR - 0.02)
    box(0.06, 1.6, 0.06, oak, sx * 0.62, -0.2, ZH - 0.05)
    box(0.06, 1.3, 0.06, oak, sx * 0.62, -0.35, ZB)
    box(0.05, 0.05, ZBR - ZB, oak, sx * 0.62, -0.1, (ZBR + ZB) / 2)
  }
  box(1.3, 0.06, 0.07, oak, 0, 0.58, ZH - 0.05)
  const rodM = woodMat([0.2, 0.2, 0.21], { gloss: 0.9, grain: 0.05 })
  // the shafts: a wooden slat top and bottom per shaft, the cords up to the castle
  const shafts = [new THREE.Group(), new THREE.Group()]
  shafts.forEach((g, i) => {
    const z = ZH + (i === 0 ? -0.007 : 0.007)
    box(0.74, 0.022, 0.009, maple, 0, 0.128, z, g)
    box(0.74, 0.022, 0.009, maple, 0, -0.128, z, g)
    // the end staves that make each shaft a frame, and the steel heddle rods the wires hang on
    for (const sx of [-1, 1]) box(0.016, 0.278, 0.011, maple, sx * 0.362, 0, z, g)
    box(0.7, 0.0035, 0.0035, rodM, 0, 0.113, z, g)
    box(0.7, 0.0035, 0.0035, rodM, 0, -0.113, z, g)
    box(0.003, 0.46, 0.003, oak, -0.3, 0.36, z, g)
    box(0.003, 0.46, 0.003, oak, 0.3, 0.36, z, g)
    scene.add(g)
  })
  // the heddles: a steel wire per end, its eye where the end passes
  const hedGeo = new THREE.InstancedBufferGeometry()
  {
    const g = new THREE.BoxGeometry(1, 1, 1)
    hedGeo.index = g.index
    hedGeo.setAttribute("position", g.getAttribute("position"))
    hedGeo.setAttribute("normal", g.getAttribute("normal"))
    const a = new Float32Array(ENDS * 2)
    for (let i = 0; i < ENDS; i++) a.set([-HALF + (i + 0.5) * PITCH, i % 2], i * 2)
    hedGeo.setAttribute("aH", new THREE.InstancedBufferAttribute(a, 2))
    hedGeo.instanceCount = ENDS
    hedGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)
  }
  const steel = (glint = 1) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const P = positionWorld
      const N = normalize(normalWorld)
      return vec4(lit(vec3(0.24, 0.24, 0.25) as V3, N as V3, P as V3, { spec: 0.9 * glint, shin: 60 }), depthA())
    })()
    return m
  }
  // flat steel wire, 0.4 mm, with an eye at its middle: the wire opens into a loop about 2 mm wide and
  // 6 mm tall and the end runs through the hole. Filtered by footprint like the warp.
  const hedMat = new THREE.NodeMaterial()
  {
    const aH = attribute("aH", "vec2") as unknown as V2
    const z = mixN(float(ZH - 0.007), float(ZH + 0.007), aH.y)
    const lift = float(SHED).mul(U.shed).mul(aH.y.mul(2).sub(1))
    const yl = positionGeometry.y.mul(0.24)
    const eye = sstep(0.0062, 0.0042, abs(yl) as F)
    const ctr = vec3(aH.x, lift.add(yl), z)
    const ppm = U.pxK.div(length(ctr.sub(cameraPosition)))
    const W0 = 0.0004
    const wMin = max(float(W0), float(1.2).div(ppm))
    const sheet = sstep(3.2, 1.7, ppm.mul(PITCH) as F)
    const w = mixN(wMin, float(PITCH * 1.1), sheet)
    const wid = mixN(w, max(w, float(0.0021)), eye)
    hedMat.positionNode = ctr.add(vec3(positionGeometry.x.mul(wid), 0, positionGeometry.z.mul(0.0005)))
    const vX = positionGeometry.x.toVarying("hX")
    const vEye = eye.toVarying("hE")
    const vHole = float(1).sub(float(W0 * 2).div(wid)).mul(sheet.oneMinus()).toVarying("hO")
    const vCov = clampN(float(W0).div(w), 0, 1).toVarying("hC")
    hedMat.fragmentNode = Fn(() => {
      // the eye's hole: both wires of the loop stay, the middle is open
      Discard(vEye.greaterThan(0.5).and(abs(vX).lessThan(vHole.mul(0.5))))
      const P = positionWorld
      const N = normalize(normalWorld)
      const c = lit(vec3(0.24, 0.24, 0.25) as V3, N as V3, P as V3, { spec: 0.75, shin: 60 })
      return vec4(mixN(vec3(0.01, 0.008, 0.006), c, clampN(vCov, 0, 1)), depthA())
    })()
  }
  const heddles = new THREE.Mesh(hedGeo, hedMat)
  heddles.frustumCulled = false
  scene.add(heddles)

  // ---- the beater: a reed of steel dents in a wooden frame, the shuttle race below
  const beater = new THREE.Group()
  const beaterWorld = uniform(new THREE.Vector3())
  scene.add(beater)
  box(1.2, 0.03, 0.03, oak, 0, 0.065, 0, beater) // the top bar (the hand-tree)
  box(1.2, 0.022, 0.11, maple, 0, -0.024, 0.045, beater) // the race board, out toward the fell
  const DENTS = Math.ceil(ENDS / 2) + 6
  const dentGeo = new THREE.InstancedBufferGeometry()
  {
    const g = new THREE.BoxGeometry(1, 1, 1)
    dentGeo.index = g.index
    dentGeo.setAttribute("position", g.getAttribute("position"))
    dentGeo.setAttribute("normal", g.getAttribute("normal"))
    const a = new Float32Array(DENTS)
    for (let i = 0; i < DENTS; i++) a[i] = -HALF - 3 * 2 * PITCH + i * 2 * PITCH
    dentGeo.setAttribute("aD", new THREE.InstancedBufferAttribute(a, 1))
    dentGeo.instanceCount = DENTS
    dentGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)
  }
  // steel dents 0.35 mm thick: sub-pixel from most poses, so each is drawn at least a pixel wide and
  // carries only its share of the dark, the rest the linen seen between them (no beating arcs)
  const dentMat = new THREE.NodeMaterial()
  {
    const ctrD = vec3(attribute("aD", "float"), positionGeometry.y.mul(0.075).add(0.0145), positionGeometry.z.mul(0.004))
    const ppm = U.pxK.div(length(beaterWorld.add(ctrD).sub(cameraPosition)))
    const T0 = 0.00035
    const wd = max(float(T0), float(1.1).div(ppm))
    dentMat.positionNode = ctrD.add(vec3(positionGeometry.x.mul(wd), 0, 0))
    const vCov = clampN(float(T0).div(wd), 0, 1).mul(0.7).add(0.3).toVarying("dC")
    dentMat.fragmentNode = Fn(() => {
      const P = positionWorld
      const N = normalize(normalWorld)
      const c = lit(vec3(0.24, 0.24, 0.25) as V3, N as V3, P as V3, { spec: 1.1, shin: 60 })
      const lin = lit(vec3(0.6, 0.53, 0.41) as V3, vec3(0, 1, 0) as unknown as V3, P as V3, { spec: 0.05 })
      return vec4(mixN(lin, c, vCov), depthA())
    })()
  }
  const dents = new THREE.Mesh(dentGeo, dentMat)
  dents.frustumCulled = false
  beater.add(dents)

  // ---- the shuttle: a boat of polished hornbeam with steel tips, a bobbin of the dyed weft in its well
  const shuttle = new THREE.Group()
  scene.add(shuttle)
  {
    const prof: THREE.Vector2[] = []
    for (let i = 0; i <= 24; i++) {
      const u = i / 24
      prof.push(new THREE.Vector2(Math.pow(Math.sin(Math.PI * u), 0.55) * 0.016 + 0.0005, (u - 0.5) * 0.3))
    }
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 28).rotateZ(Math.PI / 2), woodMat([0.36, 0.2, 0.09], { gloss: 0.6, grain: 0.25 }))
    hull.scale.set(1, 0.75, 1)
    shuttle.add(hull)
    const tipM = steel(1.4)
    for (const sx of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.03, 12).rotateZ(-sx * Math.PI / 2), tipM)
      tip.position.set(sx * 0.158, 0, 0)
      shuttle.add(tip)
    }
  }
  const bobU = { dye: uniform(new THREE.Color(...DYES[0])) }
  const bobMat = new THREE.NodeMaterial()
  bobMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    const wrap = sin(P.x.mul(4000)).mul(0.5).add(0.5)
    return vec4(lit(bobU.dye.mul(wrap.mul(0.25).add(0.8)) as V3, N as V3, P as V3, { spec: 0.1, shin: 20, sheen: 0.3 }), depthA())
  })()
  const bobbin = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.11, 18).rotateZ(Math.PI / 2), bobMat)
  bobbin.position.set(0, 0.006, 0)
  shuttle.add(bobbin)

  // ---- the attention threads: a dyed thread per (token, head, earlier token), tied back
  const NA = ARCS.length
  const anc = uniformArray(TOKS.map((_, i) => new THREE.Vector4(X0[i] - 0.011, Q0 + i * BAND + (ROW0 + ROW1 + 1) / 2, 0, 0)), "vec4")
  const arcGeo = new THREE.InstancedBufferGeometry()
  {
    const g = new THREE.CylinderGeometry(1, 1, 1, 10, 72, true).rotateX(Math.PI / 2).translate(0, 0, 0.5)
    arcGeo.index = g.index
    arcGeo.setAttribute("position", g.getAttribute("position"))
    const a = new Float32Array(NA * 4), b = new Float32Array(NA * 4)
    ARCS.forEach((x, n) => {
      const k = TOKS[x.i]
      a.set([x.i, x.j, x.h, x.w], n * 4)
      b.set([k.beat, TBEAT(k) + BEATD * 0.6 + x.h * 0.025, ((n * 37) % 11) / 11, 0], n * 4)
    })
    arcGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4))
    arcGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4))
    arcGeo.instanceCount = NA
    arcGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)
  }
  // A dyed yarn, not a tube: two plies twisted about one turn every 3 mm (the silhouette is beaded
  // with them), and a shell of loose fibres standing out of it, caught by the light at the edges.
  const arcMaterial = (fuzz: boolean) => {
  const arcMat = new THREE.NodeMaterial()
  arcMat.side = THREE.DoubleSide
  {
    const aA = attribute("aA", "vec4") as unknown as V4
    const aB = attribute("aB", "vec4") as unknown as V4
    const t = positionGeometry.z
    const age = select(aB.x.lessThan(0.5), U.T0, U.T1).sub(aB.y).toVar()
    const ai = anc.element(int(aA.x)) as unknown as V4
    const aj = anc.element(int(aA.y)) as unknown as V4
    // knotted in the margin at the middle of each word's band; the column keeps every word to the right
    const P0 = vec3(ai.x, 0.0012, U.W.sub(ai.y).mul(PITCH))
    const P1 = vec3(aj.x, 0.0012, U.W.sub(aj.y).mul(PITCH))
    const d = P1.sub(P0)
    const span = length(d)
    // each head arcs at its own height, so three colours from one token stay apart
    const hk = aA.z.mul(0.3).add(1).mul(aB.z.mul(0.15).add(0.92))
    const lift = min(span.mul(0.06).add(0.003), float(0.014)).mul(hk)
    // and bowed a little to the left, away from the words (each word runs rightward from its knot), through the margin; kept low, under the headline
    const bow = min(span.mul(0.45).add(0.012), float(0.1)).mul(hk)
    const s4 = t.mul(float(1).sub(t)).mul(4)
    // the pluck when it is tied: the thread rings across its arc, decaying
    const pl = exp(max(age, 0).mul(-9)).mul(sin(max(age, 0).mul(55))).mul(0.004).mul(sin(t.mul(3.14159)))
    const C = P0.add(d.mul(t)).add(vec3(bow.mul(s4).negate(), lift.mul(s4).add(pl), 0))
    const T = normalize(d.add(vec3(bow.negate(), lift, 0).mul(float(4).sub(t.mul(8)))))
    const B1 = normalize(cross(T, vec3(0, 1, 0)).add(vec3(0, 0, 0.0001)))
    const B2 = cross(B1, T)
    const dist = length(C.sub(cameraPosition))
    // thicker for a stronger weight; newer threads taut and full, older ones settle thinner
    const settle = mixN(float(1), float(0.62), sstep(0.35, 0.9, age))
    const r = max(aA.w.sqrt().mul(0.0011).add(0.0003), dist.mul(0.0006)).mul(settle).mul(step(0, age))
    const phi = atan(positionGeometry.y, positionGeometry.x)
    const twist = phi.mul(2).add(t.mul(span).mul(2094))
    const ply = fuzz ? float(2.3) : sin(twist).abs().mul(0.3).add(0.82)
    arcMat.positionNode = C.add(B1.mul(positionGeometry.x).add(B2.mul(positionGeometry.y)).mul(r.mul(ply)))
    const vTw = twist.toVarying("aTw")
    const vSpan = span.toVarying("aSp")
    const vT = t.toVarying("aT")
    const vAge = age.toVarying("aAge")
    const vH = aA.z.toVarying("aH")
    arcMat.fragmentNode = Fn(() => {
      // drawn back from the new token to the old one over a fifth of a second
      const reveal = sstep(0, 0.2, vAge)
      Discard(vT.greaterThan(reveal))
      const P = positionWorld
      const N = normalize(normalWorld)
      const c0 = mixN(v3(HEADS[0]), v3(HEADS[1]), step(0.5, vH))
      const c = mixN(c0, v3(HEADS[2]), step(1.5, vH))
      // the groove between the plies runs dark; the crowns catch the light
      const tw = sin(vTw).abs()
      const col = c.mul(tw.mul(0.45).add(0.6))
      if (fuzz) {
        // stray fibres: short hairs at random along the yarn and round it, nothing between them
        const hu = vT.mul(vSpan).mul(2600)
        const hv = vTw.mul(0.8)
        const cell = vec2(floor(hu), floor(hv))
        const h = hash21(cell)
        const fx = fract(hu).sub(0.5).sub(hash21(cell.add(3.1)).sub(0.5).mul(0.6))
        Discard(h.lessThan(0.55).or(abs(fx).greaterThan(0.09)))
        return vec4(lit(col.mul(1.15) as V3, N as V3, P as V3, { spec: 0.0, sheen: 1.2 }), depthA())
      }
      return vec4(lit(col as V3, N as V3, P as V3, { spec: 0.14, shin: 18, sheen: 0.55 }), depthA())
    })()
  }
  return arcMat
  }
  const arcMat = arcMaterial(false)

  const arcs = new THREE.Mesh(arcGeo, arcMat)
  arcs.frustumCulled = false
  scene.add(arcs)
  const fuzz = new THREE.Mesh(arcGeo, arcMaterial(true))
  fuzz.frustumCulled = false
  scene.add(fuzz)

  // ---- the room: a floor of boards far below and a wall with the window's light on it
  const roomMat = new THREE.NodeMaterial()
  roomMat.side = THREE.BackSide
  roomMat.fragmentNode = Fn(() => {
    const d = normalize(positionWorld.sub(cameraPosition))
    const win = exp(length(d.xy.sub(vec2(-0.55, 0.42)).mul(vec2(1.1, 1.6))).mul(-3.2)).mul(0.22)
    const floorK = sstep(-0.1, -0.5, d.y as F)
    const boards = fract(positionWorld.x.mul(0.9)).sub(0.5).abs().mul(2)
    const fl0 = vec3(0.03, 0.02, 0.013).mul(sstep(0.02, 0.12, boards as F).mul(0.3).add(0.7))
    const wall = vec3(0.035, 0.03, 0.026).add(vec3(0.8, 0.82, 0.85).mul(win))
    return vec4(mixN(wall, fl0, floorK), 20)
  })()
  const room = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 12), roomMat)
  scene.add(room)

  // The weaving room behind the loom, all of it beyond the lens's focus: a boarded floor with the
  // window's light lying across it (the same window as the key: a patch where a ray toward the key
  // passes the glazing), the back wall with that window in it, a creel of yarn cones standing on the
  // floor behind the back beam, and a bench with skeins and a basket.
  const FLOOR = -0.92, ZWALL = -3.3
  const WIN = { x: -3.5, y: 1.9, hw: 0.75, hh: 0.85 }
  /** How much of the window a ray from P toward the key finds: the opening, its glazing bars. */
  const winPass = (P: V3, d: V3): F => {
    const t = float(ZWALL).sub(P.z).div(min(d.z, -0.05))
    const h = P.add(d.mul(t))
    const open = sstep(WIN.hw, WIN.hw - 0.03, abs(h.x.sub(WIN.x)) as F).mul(sstep(WIN.hh, WIN.hh - 0.03, abs(h.y.sub(WIN.y)) as F))
    const bx = sstep(0.012, 0.03, abs(fract(h.x.sub(WIN.x).div(0.41).add(0.5)).sub(0.5)).mul(0.41) as F)
    const by = sstep(0.012, 0.03, abs(fract(h.y.sub(WIN.y).div(0.34).add(0.5)).sub(0.5)).mul(0.34) as F)
    return open.mul(bx).mul(by) as F
  }
  const roomG = new THREE.Group()
  scene.add(roomG)
  const floorMat = new THREE.NodeMaterial()
  floorMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const bw = 0.14
    const row = floor(P.x.div(bw))
    const seam = sstep(0.0, 0.006, abs(fract(P.x.div(bw)).sub(0.5)).mul(bw).sub(bw / 2).abs() as F)
    const end = sstep(0.0, 0.005, abs(fract(P.z.div(1.8).add(hash21(vec2(row, 2.0)))).sub(0.5)).mul(1.8).sub(0.9).abs() as F)
    const grain = vnoise(vec2(P.x.mul(30), P.z.mul(3))).mul(0.3).add(vnoise(vec2(P.x.mul(120), P.z.mul(9))).mul(0.15))
    const alb = vec3(0.16, 0.1, 0.055).mul(hash21(vec2(row, 7.0)).mul(0.35).add(0.7)).mul(grain.add(0.7)).mul(seam.mul(0.6).add(0.4)).mul(end.mul(0.5).add(0.5))
    const sun = winPass(P as V3, KEYD as V3)
    const N = vec3(0, 1, 0)
    const c = lit(alb as V3, N as V3, P as V3, { spec: 0.05, shin: 18, sh: sun.mul(0.9).add(0.1) })
    // a little of the window's light scattered back off the boards, and dust in it
    return vec4(c.add(vec3(0.9, 0.88, 0.82).mul(sun).mul(alb).mul(0.6)), depthA())
  })()
  const floorM = new THREE.Mesh(new THREE.PlaneGeometry(9, 7).rotateX(-Math.PI / 2), floorMat)
  floorM.position.set(0, FLOOR, -1.4)
  roomG.add(floorM)
  const wallMat = new THREE.NodeMaterial()
  wallMat.fragmentNode = Fn(() => {
    const P = positionWorld.toVar()
    const dx = abs(P.x.sub(WIN.x)), dy = abs(P.y.sub(WIN.y))
    const open = sstep(WIN.hw, WIN.hw - 0.02, dx as F).mul(sstep(WIN.hh, WIN.hh - 0.02, dy as F))
    const bars = sstep(0.012, 0.022, abs(fract(P.x.sub(WIN.x).div(0.41).add(0.5)).sub(0.5)).mul(0.41) as F).mul(sstep(0.012, 0.022, abs(fract(P.y.sub(WIN.y).div(0.34).add(0.5)).sub(0.5)).mul(0.34) as F))
    const sky = mixN(vec3(0.9, 0.95, 1.05), vec3(1.6, 1.65, 1.75), sstep(0.0, 1.6, P.y.sub(WIN.y - WIN.hh) as F))
    const lime = vec3(0.3, 0.27, 0.22).mul(vnoise(P.xy.mul(3)).mul(0.25).add(0.8))
    const reveal = exp(length(max(vec2(dx, dy).sub(vec2(WIN.hw, WIN.hh)), vec2(0))).mul(-5))
    const c = lit(lime as V3, vec3(0, 0, 1) as unknown as V3, P as V3, { spec: 0 }).add(lime.mul(reveal).mul(0.35))
    return vec4(mixN(c, sky, open.mul(bars)), depthA())
  })()
  const wallM = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.2), wallMat)
  wallM.position.set(-1, FLOOR + 2.1, ZWALL)
  roomG.add(wallM)
  // the creel: two posts, rails and rows of pegs, a cone of yarn on each peg
  const CR = { x: -1.12, z: -1.0, w: 0.9 }
  for (const sx of [-1, 1]) box(0.05, 1.5, 0.05, oak, CR.x + (sx * CR.w) / 2, FLOOR + 0.75, CR.z, roomG)
  const CONES_X = 7, CONES_Y = 5
  for (let r = 0; r < CONES_Y; r++) box(CR.w, 0.03, 0.04, oak, CR.x, FLOOR + 0.25 + r * 0.26, CR.z, roomG)
  const yarnMat = new THREE.NodeMaterial()
  yarnMat.fragmentNode = Fn(() => {
    const P = positionWorld
    const N = normalize(normalWorld)
    const k = hash21(vec2(float(instanceIndex), 5.0))
    // madder, indigo, weld, undyed linen, logwood
    const c0 = mixN(v3([0.5, 0.06, 0.04]), v3([0.03, 0.05, 0.16]), step(0.25, k))
    const c1 = mixN(c0, v3([0.6, 0.45, 0.06]), step(0.45, k))
    const c2 = mixN(c1, v3([0.55, 0.48, 0.36]), step(0.65, k))
    const col = mixN(c2, v3([0.2, 0.05, 0.22]), step(0.88, k))
    const wind = abs(fract(P.y.mul(900).add(P.x.mul(300))).sub(0.5)).mul(0.3).add(0.85)
    return vec4(lit(col.mul(wind) as V3, N as V3, P as V3, { spec: 0.04, shin: 10, sheen: 0.6 }), depthA())
  })()
  const coneG = new THREE.CylinderGeometry(0.035, 0.075, 0.17, 18)
  const cones = new THREE.InstancedMesh(coneG, yarnMat, CONES_X * CONES_Y)
  {
    const m4 = new THREE.Matrix4()
    let n = 0
    for (let r = 0; r < CONES_Y; r++)
      for (let c = 0; c < CONES_X; c++) {
        const tilt = 0.12 + 0.05 * Math.sin(n * 3.1)
        m4.makeRotationX(-tilt).setPosition(CR.x - CR.w / 2 + (c + 0.5) * (CR.w / CONES_X), FLOOR + 0.35 + r * 0.26, CR.z + 0.06)
        cones.setMatrixAt(n++, m4)
      }
  }
  roomG.add(cones)
  // the bench, with skeins laid on it and a basket at its foot
  const BE = { x: 1.1, z: -1.2 }
  box(1.2, 0.05, 0.36, oak, BE.x, FLOOR + 0.45, BE.z, roomG)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 0.43, 0.05, oak, BE.x + sx * 0.52, FLOOR + 0.215, BE.z + sz * 0.13, roomG)
  const skeinG = new THREE.TorusGeometry(0.11, 0.035, 10, 28).rotateX(Math.PI / 2).scale(1, 0.45, 0.55)
  const skeins = new THREE.InstancedMesh(skeinG, yarnMat, 6)
  {
    const m4 = new THREE.Matrix4()
    for (let i = 0; i < 6; i++) {
      m4.makeRotationY(0.4 * Math.sin(i * 2.3)).setPosition(BE.x - 0.42 + i * 0.17, FLOOR + 0.49 + (i % 2) * 0.02, BE.z + 0.03 * Math.cos(i * 1.7))
      skeins.setMatrixAt(i, m4)
    }
  }
  roomG.add(skeins)
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.24, 24, 1, true), woodMat([0.32, 0.22, 0.1], { grain: 0.6 }))
  basket.material.side = THREE.DoubleSide
  basket.position.set(BE.x + 0.75, FLOOR + 0.12, BE.z + 0.25)
  roomG.add(basket)

  // ---- the rule of ages: a weaver's boxwood rule, inked, in the window's light
  const rface = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "inked", debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = uvAttr().toVar()
    const cut = texture(rface.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const gr = vnoise(vec2(st.x.mul(90), st.y.mul(6))).mul(0.6).add(vnoise(vec2(st.x.mul(400), st.y.mul(20))).mul(0.4))
    const wood = vec3(0.62, 0.45, 0.22).mul(gr.mul(0.18).add(0.86))
    const col = mixN(wood, cut.rgb, on)
    const N = normalize(normalWorld)
    const lt = col.mul(vec3(1.0, 0.95, 0.86).mul(max(dot(N, KEYD), 0).mul(0.35).add(0.55)))
    return vec4(ctx.debugLabels ? mixN(lt, cut.rgb, step(0.02, on)) : lt, -1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 10
  rule.frustumCulled = false
  scene.add(rule)

  // ---------------------------------------------------------------- targets: depth of field, a shade for the headline
  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), blur: uniform(0.006), focus: uniform(0.5), asp: uniform(16 / 9), shade: uniform(1) }
  const dof = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const coc = (dd: F): F => clampN(abs(dd.sub(D.focus)).div(max(dd, 0.001)), 0, 1).mul(step(0, dd)) as F
    const r0 = coc(c0.a as F).mul(D.blur).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    Loop16(r0, (o, fi) => {
      const t = sampleRT(D.tT, uv.add(o) as V2).toVar()
      const w = clampN(coc(t.a as F).mul(D.blur).div(fi.mul(r0).add(1e-5)).mul(1.3).add(step(c0.a, t.a)), 0, 1)
      acc.addAssign(vec4(t.rgb.mul(w), w))
    })
    const col = acc.rgb.div(acc.a).toVar()
    col.mulAssign(float(1).sub(D.shade.mul(sstep(0.62, 0.0, length(uv.sub(vec2(0.2, 0.82)).mul(vec2(1.0, 1.9))) as F)).mul(0.5)))
    return vec4(col, 1)
  }, D)
  function Loop16(r0: F, body: (o: V2, rr: F) => void) {
    // sixteen taps on a golden-angle spiral, skipped where everything is sharp
    for (let i = 0; i < 16; i++) {
      const rr = Math.sqrt((i + 0.5) / 16)
      const a = (i + 0.5) * 2.39996
      const o = vec2(Math.cos(a) * rr, Math.sin(a) * rr).mul(r0).div(vec2(D.asp, 1)) as V2
      body(o, float(rr))
    }
  }

  // ---------------------------------------------------------------- the story clock
  const st = { picks: 0, shX: -0.46, dist: 0.5, rate: 0 }
  const tokState = TOKS.map(() => ({ on: 0, reveal: 0, beaten: 0 }))
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), w1 = new THREE.Vector3(), w2 = new THREE.Vector3()
  const POST: PostOpts = { tone: "agx", exposure: 1.0, bloom: 0.18, bloomThresh: 1.3, bloomRadius: 0.7, vignette: 0.26, grain: 0.022, contrast: 1.06, sat: 1.02, lift: [0.006, 0.006, 0.009], gain: [1.02, 1.0, 0.97], halation: 0.08, ca: 0.0004 }
  const TITLES: TitleOpts = { color: "#f4efe6", shadow: "rgba(6,5,4,0.8)", delay: [START + 0.03, 0.12] }
  const HUD = { color: "#efe8dc", shadow: "rgba(0,0,0,0.6)" }

  // camera keys: [pos, target]
  const K = {
    low: [[-0.04, 0.15, 0.24], [-0.07, -0.02, -0.07]],
    weave: [[-0.07, 0.3, 0.42], [-0.08, -0.02, 0.07]],
    up: [[-0.07, 0.42, 0.62], [-0.09, 0.0, 0.17]],
    fell: [[0.045, 0.105, 0.17], [0.01, -0.004, -0.05]],
    wide: [[-0.08, 0.6, 0.6], [-0.08, 0.0, 0.25]],
  } as const
  const setK = (o: THREE.Vector3, a: readonly number[]) => o.set(a[0], a[1], a[2])

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1)
    U.T0.value = t0
    U.T1.value = t1
    // ---- the weave: every token's throw and beat, closed-form
    let W = Q0, qEnd = Q0, cur = -1, curDir = 1, shed = 1, beatPulse = 0, lastBeat = -99
    let shX = -0.46
    TOKS.forEach((k, i) => {
      const tl = k.beat === 0 ? t0 : t1
      const ts = tokState[i]
      const thr = THROW(k)
      ts.on = tl >= k.T ? 1 : 0
      ts.reveal = clamp((tl - k.T) / thr)
      ts.beaten = E.out3(clamp((tl - TBEAT(k)) / BEATD))
      const dir = i % 2 === 0 ? 1 : -1
      if (ts.on) {
        qEnd = Q0 + (i + 1) * BAND
        cur = ts.reveal < 1 ? i : cur
        if (ts.reveal < 1) curDir = dir
        // the shed: this token's shaft up for its throw, crossing over as the beater lands
        shed = dir * (1 - 2 * smooth(TBEAT(k), TBEAT(k) + 0.08, tl))
        shX = dir * mix(-0.47, 0.47, E.io2(ts.reveal))
        const bp = tl - TBEAT(k)
        beatPulse = Math.max(beatPulse, bp > -0.05 && bp < 0.16 ? (bp < 0 ? E.in2((bp + 0.05) / 0.05) : 1 - E.out2(clamp(bp / 0.16))) : 0)
        if (bp >= 0) lastBeat = Math.max(lastBeat, k.beat === s.beat ? bp : 99)
      }
      W += BAND * ts.beaten
    })
    U.W.value = W
    U.Qend.value = qEnd
    U.cur.value = cur
    U.dir.value = curDir
    U.front.value = shX - curDir * 0.13
    U.shed.value = shed
    st.picks = W - Q0
    st.shX = shX
    // the warp rings after each beat, and hardest after the snap that brought the scene in
    const snapAge = t0 >= 0 && s.beat === 0 ? t0 : 99
    const age = Math.min(lastBeat >= 0 ? lastBeat : 99, snapAge)
    U.ringT.value = age
    U.ring.value = age < 2 ? Math.exp(-age * (age === snapAge ? 5 : 11)) * (age === snapAge ? 1.6 : 0.6) : 0
    // labels: the words of the current beat, once beaten in
    if (s.beat === 0) {
      U.lab0.value = 1
      U.lab1.value = lastWord(0)
    } else {
      // while the lens is down at the fell chasing the answer, the question is off frame on purpose
      const away = t1 > 1.0 && t1 < 2.15
      U.lab0.value = SENT.length
      U.lab1.value = away ? -1 : lastWord(1)
    }
    for (let i = 0; i < NT; i++) (tokB.array[i] as THREE.Vector4).set(TOKS[i].dye, tokState[i].reveal, tokState[i].beaten, tokState[i].on)
    bobU.dye.value.setRGB(...DYES[TOKS[Math.max(0, cur >= 0 ? cur : 0)].dye])

    // ---- the moving parts
    beater.position.set(0, 0, mix(REED0, REED1, beatPulse))
    beater.rotation.x = -0.08 * beatPulse
    beaterWorld.value.copy(beater.position)
    shafts[0].position.y = -SHED * shed
    shafts[1].position.y = SHED * shed
    shuttle.position.set(shX, -0.004, SH_Z + (REED0 - beater.position.z) * 0)
    shuttle.rotation.set(0, 0, 0)

    // ---- the camera: along the warp, then up over the cloth; following the shuttle
    const rise = E.io3(clamp((t0 - 0.45) / 1.9))
    setK(camPos, K.low[0]).lerp(setK(w1, K.weave[0]), rise)
    setK(camTgt, K.low[1]).lerp(setK(w1, K.weave[1]), rise)
    // the hold: a slow push along the warp
    const push0 = clamp((t0 - 2.3) / 0.9)
    camPos.addScaledVector(w2.set(0, 0.02, 0.012), push0)
    const up = E.io3(clamp(t1 / 0.75))
    let diveK = 0
    if (s.beat > 0) {
      camPos.lerp(setK(w1, K.up[0]), up)
      camTgt.lerp(setK(w1, K.up[1]), up)
      // the answer: down to the fell, chasing the shuttle
      const dive = E.io3(clamp((t1 - 0.95) / 0.55))
      camPos.lerp(setK(w1, K.fell[0]), dive)
      camTgt.lerp(setK(w1, K.fell[1]), dive)
      // and out again as it races, to see the question and its answer together
      const back2 = E.io3(clamp((t1 - 1.6) / 0.9))
      camPos.lerp(setK(w1, K.wide[0]), back2)
      camTgt.lerp(setK(w1, K.wide[1]), back2)
      diveK = dive * (1 - back2)
    }
    // shuttle follow, hand-held, the landing's jolt
    camTgt.x += shX * 0.05
    camPos.x += shX * 0.015
    const jolt = t0 >= 0 && t0 < 0.5 ? Math.exp(-t0 * 10) : 0
    const [hx, hy, hz] = shake(s.time, 0.0016, 0.4)
    const [jx, jy] = shake(t0 * 4, 0.006 * jolt, 5)
    const [bx, by] = shake(s.time * 3, 0.0012 * beatPulse, 6)
    camTgt.x += hx + jx + bx + s.mouse.x * 0.004
    camTgt.y += hy + jy + by - s.mouse.y * 0.003
    camTgt.z += hz
    cam.position.copy(camPos)
    cam.up.set(0, 1, 0)
    cam.lookAt(camTgt)
    cam.aspect = s.w / s.h
    cam.updateProjectionMatrix()
    U.pxK.value = (s.h / 2) * cam.projectionMatrix.elements[5]
    cam.updateMatrixWorld()
    st.dist = camPos.distanceTo(w1.set(0, 0, 0))
    D.asp.value = cam.aspect
    D.focus.value = camPos.distanceTo(w1.set(shX * 0.3, 0, -0.01))
    // at the fell the lens is close and fast: only the shuttle, the reed and the newest picks stay sharp
    D.blur.value = ctx.debugLabels ? 0 : mix(0.012, 0.006, rise) + (s.beat > 0 ? 0.002 : 0) + 0.012 * diveK
    D.shade.value = ctx.debugLabels ? 0 : 1
    placeRule(rule, cam, { dist: 0.08 })
    rface.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
    st.rate = s.beat === 0 ? smooth(0.4, 2.2, t0) : t1 < 2.2 ? 0.6 + 0.4 * smooth(0.9, 2.1, t1) : 0.2
    if (s.live) {
      ctx.synth.bed("air", 0.15 + 0.3 * st.rate)
      ctx.synth.bed("hum", 0.06 + 0.08 * st.rate)
    }
  }
  function lastWord(beat: number) {
    let n = -1
    TOKS.forEach((k, i) => {
      if (k.beat === beat && k.kind === 0 && tokState[i].beaten >= 1) n = i
    })
    return n
  }

  // ---------------------------------------------------------------- sound: a throw, a thud, keys for the question
  const cues: Cue[] = [...ruleCues(ctx.def.id, { start: START })]
  TOKS.forEach((k, i) => {
    const dir = i % 2 === 0 ? 1 : -1
    const late = k.beat === 1 ? i / NT : i / SENT.length
    cues.push({ b: k.beat, at: k.T, s: "whoosh", o: { g: 0.16 + 0.14 * late, f: 900 + 500 * late, dur: Math.max(0.12, THROW(k)) }, pos: [dir * 0.35, -0.25, 0.3] })
    cues.push({ b: k.beat, at: TBEAT(k), s: "thud", o: { g: 0.5 + 0.25 * late, f: H(3 + (i % 3)) }, pos: [0, -0.3, 0.25] })
    if (k.beat === 1 && k.kind !== 2) {
      const n = k.s.length
      for (let c = 0; c < n; c++) cues.push({ b: 1, at: k.T + (THROW(k) * c) / Math.max(1, n), s: "type", o: { g: 0.55 + ((c * 37) % 10) / 40 } })
    }
  })
  // the last answer token: the beater's hardest
  const lastK = TOKS[NT - 1]
  cues.push({ b: 1, at: TBEAT(lastK) + 0.005, s: "thump", o: { g: 0.6 }, pos: [0, -0.3, 0.2] })

  return {
    cues,
    update,
    warm: () => [
      { scene, camera: cam, target: stage },
      { pass: dof, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(0x050403, 1)
      r.setRenderTarget(stage)
      r.render(scene, cam)
      D.tT.value = stage.texture
      dof.render(out)
      if (ctx.debugLabels) Object.assign(POST, { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, halation: 0, ca: 0, vignette: 0, lift: [0, 0, 0], gain: [1, 1, 1] })
      ctx.finish(out.texture, POST)
    },
    type(g, s) {
      titles(g, s, ctx.def, TITLES)
    },
    hud: () => HUD,
    labels: (): LabelInfo[] => {
      const outL: LabelInfo[] = [...ruleLabels(rface)]
      const W = U.W.value
      for (let i = U.lab0.value; i <= U.lab1.value; i++) {
        if (TOKS[i].kind !== 0) continue
        const zA = (W - (Q0 + i * BAND + ROW1 + 1)) * PITCH, zB = (W - (Q0 + i * BAND + ROW0)) * PITCH
        const cs: [number, number][] = []
        for (const [x, z] of [[X0[i], zA], [X1[i], zA], [X1[i], zB], [X0[i], zB]] as [number, number][]) {
          // the cloth's draw-in, as the weave applies it
          const dIn = 1 - 0.014 * smooth(0, 0.06, z)
          w1.set(x * dIn, 0, z).project(cam)
          cs.push([w1.x, w1.y])
        }
        outL.push({ id: "word " + TOKS[i].s, corners: cs as LabelInfo["corners"] })
      }
      return outL
    },
    dispose() {
      rface.dispose()
      atlas.dispose()
      disposeTree(scene)
    },
  }
}
