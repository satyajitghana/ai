// 10 → 11. The plate is turned like the leaf of a large book.
//
// The outgoing picture is a sheet of laid paper on a desk. From a gutter a third of the way in, the
// sheet's right part becomes a real leaf: a 72 × 44 mesh laid exactly over the picture (through the
// outgoing scene's portal quad, so the first frame is the still). Its lower right corner lifts and
// the leaf curls round a cylinder whose axis sweeps from that corner to the gutter, turning from
// diagonal to upright while its radius swells and shrinks. The front of the leaf carries the old
// plate; its back is blank laid paper with the ink showing through; the bend takes a sheen from the
// lamp, and the leaf's shadow (drawn into its own small target and blurred by its height) slides
// over the page beneath: wide and soft while the leaf is high, tight as it lands.
//
// The page beneath is Plate II: the incoming scene, which draws itself as an engraving until the
// leaf has landed, inside a plate mark, with its caption. The leaf falls the last of the way and
// slaps flat at `LAND`, where the next scene's clock starts; the desk takes the knock, a breath of
// dust runs out from under the leaf, and the lens goes down into the plate until it is the frame.
//
// Everything is closed-form in the linear progress.

import * as THREE from "three/webgpu"
import { abs, clamp, cos, dot, exp, float, Fn, fract, Loop, max, mix, positionGeometry, screenUV, select, sin, smoothstep, step, texture, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { H } from "../engine/synth"
import { luma, sampleRT, type F, type V2, type V3 } from "../engine/tsl"
import type { Portal, TransitionDef } from "../engine/types"

/** Set by the incoming scene: the face the plate's caption is lettered in. */
export const PLATE = { font: "serif" }

const DUR = 3.2
const LAND = 0.7
const LIFT0 = 0.03
const FLAT = 0.62 // the axis has reached the gutter; the leaf hangs over the far page, then drops
const PHI0 = 0.72
/** Where the sheet is taken to be if the outgoing scene reports no portal (clip space: TL, TR, BR, BL). */
const FALLBACK: Portal["c"] = [[-1.3, 0.72], [0.36, 0.78], [0.4, -0.82], [-1.3, -0.85]]
const sm = (a: number, b: number, v: number) => {
  const q = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return q * q * (3 - 2 * q)
}

const t: TransitionDef = {
  id: "pageturn",
  dur: DUR,
  inAt: LAND,
  ease: (x) => x,
  snd: [
    { s: "scratch", p: LIFT0, o: { g: 0.5, pos: [0.6, -0.7, 0] } },
    { s: "page", p: 0.06, o: { g: 0.9, pos: [0.5, -0.5, 0] } },
    { s: "whoosh", p: 0.2, o: { f: 420, dur: 1.2, g: 0.35, pos: [0.2, 0, 0] } },
    { s: "flap", p: 0.5, o: { g: 0.6, pos: [-0.2, 0.1, 0] } },
    { s: "thump", p: LAND, o: { g: 1, pos: [-0.6, -0.1, 0] } },
    { s: "thud", p: LAND, o: { f: 70, g: 0.8, pos: [-0.6, -0.1, 0] } },
    { s: "sub", p: LAND, o: { g: 0.45 } },
    { s: "whoosh", p: LAND + 0.01, o: { f: 180, dur: 0.9, g: 0.4, pos: [0.3, 0, 0.2] } },
    { s: "pad", p: LAND + 0.04, o: { f: H(6), dur: 3, g: 0.25 } },
  ],
  sound(pl, _prev, synth) {
    // the air the leaf moves
    synth.bed("air", 0.5 * Math.sin(Math.PI * Math.min(1, pl / LAND)) ** 2)
  },
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const shRT = ctx.target({ hdr: false, scale: 0.25 })
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tS: uniformTexture(shRT.texture),
      tM: uniformTexture(rt.texture),
      uAsp: uniform(16 / 9),
      uG: uniform(new THREE.Vector2()), // the gutter's foot
      uEx: uniform(new THREE.Vector2(1, 0)), // unit vectors along and up the sheet
      uEy: uniform(new THREE.Vector2(0, 1)),
      uWH: uniform(new THREE.Vector2(1, 1)), // the leaf's size
      uCurl: uniform(new THREE.Vector4(PHI0, 9, 0.05, 0)), // axis angle, axis offset, radius
      uM: uniform(new THREE.Matrix3()), // the lens going down into the plate
      uPl: uniform(new THREE.Vector4()), // the plate: centre (leaf coords), half width, half height
      uSh: uniform(new THREE.Vector3()), // shadow: strength, blur (uv), plate tone
      uDust: uniform(new THREE.Vector2(-1, 0)), // seconds since the slap, strength
    }
    const asp2 = vec2(U.uAsp, 1)
    /** A point in the frame's own units (x in half-heights) through the lens, to clip space. */
    const toClip = (iso: V2, depth: F | number) => {
      const q = U.uM.mul(vec3(iso, 1))
      return vec4(q.xy.div(asp2), depth, 1)
    }
    const isoOf = (P: V2): V2 => U.uG.add(U.uEx.mul(P.x)).add(U.uEy.mul(P.y)) as V2
    const uvOf = (iso: V2): V2 => iso.div(asp2).mul(0.5).add(0.5) as V2
    const PAPER = vec3(0.905, 0.868, 0.772)

    // ---- the leaf
    const leafGeo = new THREE.PlaneGeometry(1, 1, 72, 44).translate(0.5, 0.5, 0)
    const curl = () => {
      const P = positionGeometry.xy.mul(U.uWH) as V2
      const n = vec2(cos(U.uCurl.x), sin(U.uCurl.x).negate()) as V2
      const s = dot(P, n).sub(U.uCurl.y)
      const r = U.uCurl.z
      const th = clamp(s.div(r), 0, Math.PI)
      const on = step(0, s)
      const round = s.lessThan(r.mul(Math.PI))
      const dn = select(round, r.mul(sin(th)).sub(s), r.mul(Math.PI).sub(s.mul(2))).mul(on)
      const z = select(round, r.mul(cos(th).oneMinus()), r.mul(2)).mul(on)
      return { P, Pc: P.add(n.mul(dn)), z, th: th.mul(on) }
    }
    const leafMat = (shadow: boolean) => {
      const c = curl()
      const lift = shadow ? vec2(0.3, -0.2) : vec2(-0.07, 0.13)
      const iso = isoOf(c.Pc as V2).add(lift.mul(c.z))
      const m = new THREE.NodeMaterial()
      m.vertexNode = toClip(iso as V2, shadow ? 0.5 : (float(0.5).sub(c.z.mul(0.35)) as F))
      const vRest = uvOf(isoOf(c.P as V2)).toVarying(shadow ? "ptSR" : "ptR")
      const vT = vec2(c.th, c.z).toVarying(shadow ? "ptST" : "ptT")
      const vQ = positionGeometry.xy.mul(U.uWH).toVarying(shadow ? "ptSQ" : "ptQ")
      m.fragmentNode = Fn(() => {
        if (shadow) return vec4(vec3(smoothstep(0.0, 0.03, vT.y.div(U.uWH.x))), 1)
        const th = vT.x
        const a = sampleRT(U.tA, clamp(vRest, 0.001, 0.999) as V2).rgb.toVar()
        const front = cos(th)
        // the face: the old plate, darkening as it turns from the lamp
        const face = a.mul(mix(float(1), front.mul(0.5).add(0.5), smoothstep(0.0, 0.5, th)))
        // the back: blank laid paper, the ink ghosting through, a sheen where the bend meets the lamp
        const ghost = smoothstep(0.1, 0.5, float(0.82).sub(luma(a)))
        const laid = sin(vQ.x.mul(260)).mul(0.012).add(exp(fract(vQ.y.mul(7)).sub(0.5).div(0.03).pow(2).negate()).mul(-0.025))
        const lit = front.negate().mul(0.3).add(0.7).add(exp(th.sub(2.25).div(0.22).pow(2).negate()).mul(0.14))
        const back = PAPER.mul(float(1).add(laid)).mul(mix(vec3(1), vec3(0.8, 0.72, 0.62), ghost.mul(0.3))).mul(lit)
        return vec4(select(front.greaterThan(0), face, back), 1)
      })()
      Object.assign(m, { side: THREE.DoubleSide, transparent: !shadow, depthTest: !shadow, depthWrite: !shadow })
      return m
    }
    const leaf = new THREE.Mesh(leafGeo, leafMat(false))
    leaf.frustumCulled = false
    leaf.renderOrder = 3
    const leafShadow = new THREE.Mesh(leafGeo, leafMat(true))
    leafShadow.frustumCulled = false

    // ---- what the leaf's shadow and the dust do to whatever lies under it
    const under = (c: V3, P: V2): V3 => {
      const acc = float(0).toVar()
      Loop(9, ({ i }) => {
        const k = float(i)
        const an = k.mul(2.39996)
        acc.addAssign(U.tS.sample(screenUV.add(vec2(cos(an), sin(an)).mul(k.add(0.5).div(9).sqrt()).mul(U.uSh.y).mul(vec2(float(1).div(U.uAsp), 1)))).level(float(0)).r)
      })
      const sh = acc.div(9).mul(U.uSh.x)
      // dust: a pale ring running out from the gutter side of the fallen leaf
      const d = max(abs(P.x.add(U.uWH.x.mul(0.5))).sub(U.uWH.x.mul(0.5)), abs(P.y.sub(U.uWH.y.mul(0.5))).sub(U.uWH.y.mul(0.5)))
      const ring = exp(d.sub(U.uDust.x.mul(0.5).mul(U.uWH.x)).div(U.uWH.x.mul(0.05)).pow(2).negate()).mul(U.uDust.y).mul(step(0, U.uDust.x))
      return mix(c.mul(mix(vec3(1), vec3(0.42, 0.47, 0.6), sh)), vec3(0.93, 0.9, 0.84), ring.mul(0.3)) as V3
    }
    const quadGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0)

    // ---- the desk and the facing page: the old frame
    const bgMat = new THREE.NodeMaterial()
    {
      const iso = positionGeometry.xy.mul(2).sub(1).mul(asp2).mul(1.0)
      bgMat.vertexNode = toClip(iso as V2, 0.9)
      const vUV = positionGeometry.xy.toVarying("ptBU")
      const vP = vec2(dot(iso.sub(U.uG), U.uEx), dot(iso.sub(U.uG), U.uEy)).toVarying("ptBP")
      bgMat.fragmentNode = Fn(() => vec4(under(sampleRT(U.tA, vUV as V2).rgb as V3, vP as V2), 1))()
      Object.assign(bgMat, { depthTest: false, depthWrite: false })
    }
    const bg = new THREE.Mesh(quadGeo, bgMat)
    bg.frustumCulled = false
    bg.renderOrder = 0

    // ---- the page beneath: Plate II
    let capTex: THREE.CanvasTexture | null = null
    const capCv = document.createElement("canvas")
    capCv.width = 512
    capCv.height = 96
    const cap = new THREE.CanvasTexture(capCv)
    cap.colorSpace = THREE.NoColorSpace
    const pageMat = new THREE.NodeMaterial()
    {
      const P = positionGeometry.xy.mul(U.uWH)
      pageMat.vertexNode = toClip(isoOf(P as V2), 0.8)
      const vP = P.toVarying("ptPP")
      pageMat.fragmentNode = Fn(() => {
        const q = vP.sub(U.uPl.xy).div(U.uPl.zw).toVar() // -1..1 across the plate
        const inside = max(abs(q.x), abs(q.y))
        const puv = q.mul(0.5).add(0.5)
        const b = sampleRT(U.tB, clamp(puv, 0.001, 0.999) as V2).rgb
        const laid = sin(vP.x.mul(260)).mul(0.012).add(exp(fract(vP.y.mul(7)).sub(0.5).div(0.03).pow(2).negate()).mul(-0.025))
        const paper = PAPER.mul(float(1).add(laid)).toVar()
        // the plate mark: the sheet is pressed down inside it, with a lit lip below and a shaded one above
        const mark = exp(inside.sub(1.035).div(0.008).pow(2).negate())
        paper.mulAssign(float(1).sub(mark.mul(0.16).mul(select(q.y.greaterThan(abs(q.x).mul(0.98)), 1.6, select(q.y.lessThan(abs(q.x).mul(-0.98)), -0.7, 0.5)))))
        paper.mulAssign(mix(0.972, 1, smoothstep(1.03, 1.04, inside)))
        // the caption, lettered under the plate
        const cu = vec2(q.x.mul(U.uPl.z).div(U.uPl.w.mul(1.07)).mul(0.5).add(0.5), q.y.add(1.27).div(0.2).add(0.5))
        const ink = texture(cap).sample(clamp(cu, 0, 1)).r.mul(step(abs(cu.x.sub(0.5)), 0.5)).mul(step(abs(cu.y.sub(0.5)), 0.5))
        paper.assign(mix(paper, vec3(0.2, 0.12, 0.07), ink.mul(0.85)))
        const c = mix(b.mul(U.uSh.z), paper, smoothstep(0.994, 1.0, inside))
        return vec4(under(c as V3, vP as V2), 1)
      })()
      Object.assign(pageMat, { depthTest: false, depthWrite: false })
    }
    const page = new THREE.Mesh(quadGeo, pageMat)
    page.frustumCulled = false
    page.renderOrder = 1

    const scene = new THREE.Scene()
    scene.add(bg, page, leaf)
    const shScene = new THREE.Scene()
    shScene.add(leafShadow)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const blit = ctx.pass(({ uv }) => vec4(sampleRT(U.tM, uv).rgb, 1), U)

    const drawCaption = () => {
      const c = capCv.getContext("2d")!
      c.clearRect(0, 0, 512, 96)
      c.fillStyle = "#000"
      c.fillRect(0, 0, 512, 96)
      c.fillStyle = "#fff"
      c.font = `italic 400 58px ${PLATE.font}, Georgia, serif`
      c.textAlign = "center"
      c.textBaseline = "middle"
      c.fillText("Plate II.", 256, 50)
      cap.needsUpdate = true
      capTex = cap
    }
    let capFont = PLATE.font
    drawCaption()

    return {
      render(a) {
        if (!capTex || capFont !== PLATE.font) {
          capFont = PLATE.font
          drawCaption()
        }
        const { w, h } = ctx.size()
        const asp = w / h
        const c = a.pa?.c ?? FALLBACK
        // the sheet, as a parallelogram on its lower left corner (frame units: x in half-heights)
        const ox = c[3][0] * asp, oy = c[3][1]
        let exx = c[2][0] * asp - ox, exy = c[2][1] - oy
        let eyx = c[0][0] * asp - ox, eyy = c[0][1] - oy
        const sw = Math.hypot(exx, exy) || 1, shh = Math.hypot(eyx, eyy) || 1
        exx /= sw; exy /= sw; eyx /= shh; eyy /= shh
        // the gutter: where the sheet crosses a line left of centre (or its own left edge, if that is in frame)
        const ag = Math.min(0.62, Math.max(0, (-0.42 * asp - ox) / (exx * sw || 1) / 1))
        const lw = sw * (1 - ag)
        U.uAsp.value = asp
        U.uG.value.set(ox + exx * sw * ag, oy + exy * sw * ag)
        U.uEx.value.set(exx, exy)
        U.uEy.value.set(eyx, eyy)
        U.uWH.value.set(lw, shh)
        // the plate on the page beneath: as large as the visible leaf allows
        const visW = Math.min(lw, (asp - U.uG.value.x) / Math.max(exx, 0.2))
        const pw = Math.min(visW * 0.8, shh * 0.74 * (16 / 9))
        const ph = (pw * 9) / 16
        const pcx = visW * 0.5, pcy = shh * 0.53
        U.uPl.value.set(pcx, pcy, pw / 2, ph / 2)

        const pl = a.pl
        // ---- the turn
        const e = sm(LIFT0, FLAT, pl)
        const e2 = e * e * (3 - 2 * e) * 0.35 + e * 0.65
        const phi = PHI0 * (1 - e2) ** 1.3
        const c0 = lw * Math.cos(PHI0) + 0.002
        const drop = pl < FLAT ? 0 : Math.min(1, (pl - FLAT) / (LAND - FLAT)) ** 2.2
        const r = pl < LIFT0 ? 0.02 * lw : lw * (0.02 + 0.2 * Math.sin(Math.PI * Math.min(e2, 1) * 0.86) ** 0.9) * (1 - drop) + 1e-4
        U.uCurl.value.set(phi, c0 * (1 - e2), r, 0)
        // ---- its shadow, and the knock when it lands
        const since = (pl - LAND) * DUR
        const high = Math.min(1, (2 * r) / (0.4 * lw))
        U.uSh.value.set(pl < LIFT0 || pl >= LAND ? 0 : 0.85 * sm(LIFT0, LIFT0 + 0.08, pl), 0.006 + 0.05 * high, 1)
        U.uDust.value.set(since, since > 0 ? Math.exp(-since * 2.2) : 0)
        // ---- the lens goes down into the plate
        const g = sm(LAND + 0.03, 1, pl)
        const go = g * g * (3 - 2 * g)
        const jolt = since > 0 ? 0.014 * Math.exp(-since * 8) * Math.sin(since * 42) : 0
        const creep = 1 + 0.03 * sm(0, LAND, pl)
        // identity (with a slow creep in) → the map that takes the plate's rectangle to the frame
        const wx = U.uG.value.x + exx * pcx + eyx * pcy, wy = U.uG.value.y + exy * pcx + eyy * pcy
        const fx = asp / (pw / 2), fy = 1 / (ph / 2)
        const m00 = mixn(creep, exx * fx, go), m01 = mixn(0, exy * fx, go), m02 = mixn(0, -(wx * exx + wy * exy) * fx, go)
        const m10 = mixn(0, eyx * fy, go), m11 = mixn(creep, eyy * fy, go), m12 = mixn(jolt, -(wx * eyx + wy * eyy) * fy, go)
        U.uM.value.set(m00, m01, m02, m10, m11, m12, 0, 0, 1)
        U.uSh.value.z = mixn(0.965, 1, go)

        U.tA.value = a.A
        U.tB.value = a.B
        const rr = ctx.renderer
        rr.setClearColor(0x000000, 1)
        rr.setRenderTarget(shRT)
        rr.render(shScene, cam)
        U.tS.value = shRT.texture
        rr.setRenderTarget(rt)
        rr.render(scene, cam)
        U.tM.value = rt.texture
        blit.render(a.out)
      },
      warm: () => [
        { scene: shScene, camera: cam, target: shRT },
        { scene, camera: cam, target: rt },
        { pass: blit, target: hold },
      ],
      dispose() {
        leafGeo.dispose()
        quadGeo.dispose()
        leaf.material.dispose()
        leafShadow.material.dispose()
        bgMat.dispose()
        pageMat.dispose()
        cap.dispose()
        blit.dispose()
      },
    }
  },
}
const mixn = (a: number, b: number, k: number) => a + (b - a) * k
export default t
