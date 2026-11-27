// 21 → 22. Cards. The frame is a deck of IBM punched cards, riffled and dealt.
//
// The outgoing picture (the abyssal floor, the cable, the repeater) is ruled into a 7 × 9 grid of
// 80-column cards (cell aspect 2.286 against the card's 7⅜ : 3¼ = 2.269), and each card carries
// its piece of the picture across the cut:
//
//   0.00–0.12  the seams are cut, each card's top-left corner is clipped, the picture turns to
//              print on manila stock, and the holes punch through column by column. Every card is
//              punched from one Hollerith table, the question "CAN MACHINES THINK" (two holes a
//              letter, a blank column between words; the 026 had no "?", so that column is blank).
//   0.10–0.36  the cards lift off and fly into one deck on a black desk, turning over in the air
//              to their printed faces (digits 0 to 9 in every column, column numbers), the lens
//              tilting down after them.
//   0.34–0.55  the riffle: the deck splits end to end, the inner ends overlapping, the thumbs curl
//              them up, cards spring off bottom first from the two halves alternately and land
//              interleaved in the overlap; the halves are pushed together and squared.
//   0.53–0.82  the deal: the cards shoot off the top of the deck one after another and land face
//              up, each flipping over as it lands in its own cell of the frame, now carrying the
//              incoming picture. The last one slaps down at CARDS_IN: the climax, and the incoming
//              scene's first beat.
//   0.82–1.00  the seams close and the stock, the print and the holes give way to the plain frame.
//
// Closed form in linear progress. One instanced draw for the cards (two-sided: the picture on one
// face, the IBM print on the other), one for their shadows, one for the desk. The card layout and
// its painter are exported: the scene uses the same card.

import * as THREE from "three/webgpu"
import { abs, attribute, cameraPosition, clamp as clampN, cross, Discard, dot, exp, float, floor, Fn, fract, frontFacing, instanceIndex, int, length, max, min, mix, normalize, positionGeometry, pow, select, smoothstep, step, texture, uniform, uniformArray, uniformTexture, vec2, vec3, vec4, cameraProjectionMatrix, cameraViewMatrix } from "three/tsl"

import { E, mix as mixJ, ramp, smooth } from "../engine/ease"
import { H } from "../engine/synth"
import { hash21, luma, sampleRT, toLinear, toSRGB, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

export const CARDS_DUR = 2.0
export const CARDS_IN = 0.82

// ---------------------------------------------------------------- the card (inches), and its code

/** IBM 80-column card: 7⅜ × 3¼ in, 80 columns at 0.087 in, 12 rows at 0.25 in, holes 0.055 × 0.125 in. */
export const CARD = { W: 7.375, H: 3.25, col0: 0.251, pitch: 0.087, row0: 0.25, rowP: 0.25, holeW: 0.055, holeH: 0.125, cut: 0.25 } as const
/** Rows top to bottom: 12, 11, 0, 1 … 9. A column's code is a 12-bit mask in this order (bit 0 = row 12). */
export const ROWS = ["12", "11", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const
const R = (r: string) => 1 << ROWS.indexOf(r as (typeof ROWS)[number])
/** Hollerith letters (Jones, "Punched card codes"): A-I 12 + 1-9, J-R 11 + 1-9, S-Z 0 + 2-9. */
export function hollerith(ch: string): number {
  const c = ch.toUpperCase()
  if (c === " ") return 0
  if (c >= "0" && c <= "9") return R(c)
  const i = c.charCodeAt(0) - 65
  if (i < 0 || i > 25) return 0 // the 026 has no "?": left blank
  if (i < 9) return R("12") | R(String(i + 1))
  if (i < 18) return R("11") | R(String(i - 8))
  return R("0") | R(String(i - 16))
}
/** The question as punched on the 026: one column a character, column 19 (the "?") blank. */
export const QUESTION_TEXT = "CAN MACHINES THINK"
export const QUESTION_COLS: number[] = Array.from({ length: 80 }, (_, i) => (i < QUESTION_TEXT.length ? hollerith(QUESTION_TEXT[i]) : 0))

/** Paint the printed face of an IBM general-purpose card (no holes: they are cut in the shader). */
export function paintCardFace(c: CanvasRenderingContext2D, w: number, h: number, o: { stock?: string; ink?: string; font?: string } = {}) {
  const s = w / CARD.W // px per inch
  c.fillStyle = o.stock ?? "#e2d3ab"
  c.fillRect(0, 0, w, h)
  // the stock: a faint fibre mottle (deterministic)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? "120,90,40" : "255,248,220"},${0.03 + rnd() * 0.05})`
    c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 6, 1 + rnd() * 1.5)
  }
  const ink = o.ink ?? "rgba(60,40,30,0.82)"
  const font = o.font ?? "Arial, Helvetica, sans-serif"
  c.fillStyle = ink
  c.textAlign = "center"
  c.textBaseline = "middle"
  const dg = Math.round(s * 0.085)
  c.font = `${dg}px ${font}`
  for (let col = 0; col < 80; col++) {
    const x = (CARD.col0 + col * CARD.pitch) * s
    for (let r = 2; r < 12; r++) c.fillText(ROWS[r], x, (CARD.row0 + r * CARD.rowP) * s)
  }
  // column numbers, under the 0 row and along the foot
  c.font = `${Math.round(s * 0.045)}px ${font}`
  for (let col = 0; col < 80; col++) {
    const x = (CARD.col0 + col * CARD.pitch) * s
    c.fillText(String(col + 1), x, (CARD.row0 + 2 * CARD.rowP + 0.12) * s)
    c.fillText(String(col + 1), x, (CARD.H - 0.07) * s)
  }
  // the vendor's line along the top of the 12 zone, small, and the field rules every ten columns
  c.strokeStyle = "rgba(60,40,30,0.25)"
  c.lineWidth = Math.max(1, s * 0.006)
  for (let k = 1; k < 8; k++) {
    const x = (CARD.col0 + (k * 10 - 0.5) * CARD.pitch) * s
    c.beginPath()
    c.moveTo(x, (CARD.row0 + 1.6 * CARD.rowP) * s)
    c.lineTo(x, (CARD.H - 0.16) * s)
    c.stroke()
  }
}

/**
 * The card's cut-outs in TSL: `st` is the card's uv (x 0..1 left to right, y 0..1 bottom to top),
 * `cols` a uniformArray of 80 column masks. Returns vec2(hole, corner): 1 inside a punched hole,
 * 1 inside the clipped corner (top left). `punched` (0..1) runs the punch along the columns.
 */
export function cardCuts(st: V2, cols: ReturnType<typeof uniformArray>, punched: F): V2 {
  const xi = st.x.mul(CARD.W).toVar()
  const yi = st.y.oneMinus().mul(CARD.H).toVar() // inches from the top
  const cf = xi.sub(CARD.col0).div(CARD.pitch).add(0.5).toVar()
  const col = clampN(floor(cf), 0, 79).toVar()
  const rf = yi.sub(CARD.row0).div(CARD.rowP).add(0.5).toVar()
  const row = clampN(floor(rf), 0, 11).toVar()
  const mask = (cols.element(int(col)) as unknown as F).toVar()
  const bit = fract(floor(mask.div(pow(float(2), row))).mul(0.5)).mul(2).toVar() // (mask >> row) & 1
  const dx = abs(xi.sub(float(CARD.col0).add(col.mul(CARD.pitch))))
  const dy = abs(yi.sub(float(CARD.row0).add(row.mul(CARD.rowP))))
  const inRect = step(dx, CARD.holeW / 2).mul(step(dy, CARD.holeH / 2))
  const live = step(col.add(0.5).div(80), punched.mul(1.02))
  const hole = bit.mul(inRect).mul(live).mul(step(0, cf)).mul(step(cf, 80)).mul(step(0, rf)).mul(step(rf, 12))
  const corner = step(xi.add(yi), CARD.cut).mul(step(0.001, punched))
  return vec2(hole, corner) as V2
}

// ---------------------------------------------------------------- the choreography

const NX = 7
const NY = 9
const N = NX * NY
const THICK = 0.0035 // a card's thickness in deck units (the frame is 2 tall)
const P = { cut1: 0.12, lift0: 0.1, lift1: 0.36, rif0: 0.34, rif1: 0.55, deal0: 0.53, land0: 0.63, land1: CARDS_IN, flight: 0.1, end0: 0.84 }
const DECK = new THREE.Vector3(0.12, -0.18, 0)
const DECK_SCALE = 1.55 // the cards are drawn larger in the deck than in the grid: the lens has come down to them

/** Deterministic per-card numbers. */
const h1 = (i: number, k: number) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return v - Math.floor(v)
}
/** Interleave: stack position (0 = bottom) of each card after the riffle, from the two halves. */
const HALF = Math.ceil(N / 2)
const RIFFLE_POS: number[] = (() => {
  const out: number[] = new Array(N)
  let a = 0, b = HALF, k = 0
  while (k < N) {
    // the bottom card falls from the left half first, then alternately (with the odd double drop)
    const takeA = (k % 2 === 0 || b >= N) && a < HALF
    if (takeA) out[a++] = k++
    else if (b < N) out[b++] = k++
    if (k % 11 === 5 && a < HALF) out[a++] = k++
  }
  return out
})()
/** Deal order: the top of the riffled stack is dealt first, to the cells in reading order from top left. */
const DEAL_CARD: number[] = Array.from({ length: N }, (_, j) => RIFFLE_POS.indexOf(N - 1 - j))
const CELL_OF = new Array<number>(N)
DEAL_CARD.forEach((card, j) => (CELL_OF[card] = j))

const t: TransitionDef = {
  id: "cards",
  dur: CARDS_DUR,
  inAt: CARDS_IN,
  ease: E.lin,
  snd: [
    { s: "scratch", p: 0.01, o: { g: 0.18, dur: 0.18 } },
    { s: "tick", p: 0.03, o: { g: 0.2, f: H(64) } },
    { s: "whoosh", p: P.lift0 + 0.02, o: { g: 0.22, f: 800, dur: 0.45 } },
    { s: "page", p: 0.28, o: { g: 0.25, dur: 0.22 } },
    { s: "cards", p: P.rif0 + 0.02, o: { g: 0.9, dur: 0.28, pos: [0.1, -0.1, 0.2] } },
    { s: "cards", p: P.deal0 + 0.04, o: { g: 0.55, dur: (P.land1 - P.deal0 - 0.06) * CARDS_DUR, pos: [0.0, 0, 0.1] } },
    { s: "thump", p: CARDS_IN, o: { g: 0.75 } },
    { s: "sub", p: CARDS_IN, o: { g: 0.4 } },
    { s: "teleprinter", p: CARDS_IN + 0.01, o: { g: 0.5 } },
  ],
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const rt = ctx.target({ hdr: false, depth: true, samples: 4 })
    const faceTex = new THREE.CanvasTexture(document.createElement("canvas"))
    {
      const cv = faceTex.image as HTMLCanvasElement
      cv.width = 1536
      cv.height = Math.round((1536 * CARD.H) / CARD.W)
      paintCardFace(cv.getContext("2d")!, cv.width, cv.height)
      faceTex.colorSpace = THREE.SRGBColorSpace
      faceTex.anisotropy = 8
      faceTex.needsUpdate = true
    }
    const U = {
      tA: uniformTexture(hold.texture),
      tB: uniformTexture(hold.texture),
      tM: uniformTexture(rt.texture),
      asp: uniform(16 / 9),
      stock: uniform(0), //  how much the picture has become print on manila
      seam: uniform(0), //   the cut between the cards
      punch: uniform(0),
      heal: uniform(0), //   the holes and corners closing at the end
      xf: uniform(0),
      lamp: uniform(new THREE.Vector3(-1.4, 1.6, 3.2)),
      desk: uniform(0),
    }
    const cols = uniformArray(QUESTION_COLS.map((m) => m), "float")
    const iP = Array.from({ length: N }, () => new THREE.Vector4()) // position, bend
    const iQ = Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, 1)) // rotation
    const iS = Array.from({ length: N }, () => new THREE.Vector4()) // picture B (0/1), size, height above desk, free
    const uP = uniformArray(iP, "vec4"), uQ = uniformArray(iQ, "vec4"), uS = uniformArray(iS, "vec4")

    // ---- one card, subdivided along its length so it can arch
    const SX = 28, SY = 3
    const pos: number[] = [], uvs: number[] = [], idx: number[] = []
    for (let j = 0; j <= SY; j++)
      for (let i = 0; i <= SX; i++) {
        pos.push(i / SX - 0.5, j / SY - 0.5, 0)
        uvs.push(i / SX, j / SY)
      }
    for (let j = 0; j < SY; j++)
      for (let i = 0; i < SX; i++) {
        const a = j * (SX + 1) + i
        idx.push(a, a + 1, a + SX + 2, a, a + SX + 2, a + SX + 1)
      }
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2))
    geo.setIndex(idx)
    geo.instanceCount = N
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)

    const rotq = (q: V4, v: V3): V3 => {
      const t2 = cross(q.xyz, v).mul(2)
      return v.add(t2.mul(q.w)).add(cross(q.xyz, t2)) as V3
    }
    /** Local card point (x along, y across, both -0.5..0.5) to world, and its normal. */
    const cardWorld = (shadow: boolean) => {
      const Pi = uP.element(instanceIndex) as unknown as V4
      const Qi = uQ.element(instanceIndex) as unknown as V4
      const Si = uS.element(instanceIndex) as unknown as V4
      const cw = Si.y.mul(U.asp.mul(2 / NX)) // card width in deck units
      const chh = Si.y.mul(2 / NY)
      const lx = positionGeometry.x
      const arch = Pi.w.mul(lx.mul(lx).mul(-4).add(1)).mul(cw).mul(0.22) // + bows the middle up
      // the riffle's curl (Si.w, deck units at the tip; its sign says which end): the thumb lifts one end
      const cs = select(Si.w.greaterThan(0), float(1), float(-1))
      const ce = clampN(lx.mul(cs).add(0.5), 0, 1)
      const curl = abs(Si.w).mul(ce.mul(ce))
      const local = vec3(lx.mul(cw), positionGeometry.y.mul(chh), arch.add(curl)) as V3
      // slope of the arch and the curl along x, for the normal
      const slope = Pi.w.mul(lx).mul(-8).mul(0.22).add(abs(Si.w).mul(ce).mul(2).mul(cs).div(cw))
      const nl = normalize(vec3(slope.negate(), 0, 1)) as V3
      const w = Pi.xyz.add(rotq(Qi, local)) as V3
      const n = rotq(Qi, nl)
      return { w, n, Si, shadowAt: shadow ? (vec3(w.x.add(w.z.mul(0.45)), w.y.sub(w.z.mul(0.55)), 0.0005) as V3) : w }
    }

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 50)

    // ---- the cards
    const cardMat = new THREE.NodeMaterial()
    {
      const { w, n, Si } = cardWorld(false)
      cardMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(w, 1))
      const vW = w.toVarying() as unknown as V3
      const vN = n.toVarying() as unknown as V3
      const vB = Si.x.toVarying() as unknown as F
      const vCell = vec2(float(instanceIndex).mod(NX), floor(float(instanceIndex).div(NX))).toVarying() as unknown as V2
      const vK = float(instanceIndex).toVarying() as unknown as F
      const vUv = attribute("uv", "vec2") as unknown as V2
      cardMat.fragmentNode = Fn(() => {
        const st = vUv.toVar()
        const cuts = cardCuts(vec2(st.x, st.y.oneMinus()) as V2, cols, U.punch).toVar() // punched relative to the printed face
        Discard(cuts.x.add(cuts.y).mul(U.heal.oneMinus()).greaterThan(0.5))
        // the picture face (the card's local +z) or the printed face
        const front = frontFacing.toVar()
        // where this point of the card lay in the frame: its home cell (the cards are dealt home)
        const home = vec2(vCell.x.add(st.x), float(NY - 1).sub(vCell.y).add(st.y)).div(vec2(NX, NY)).toVar()
        const A = toLinear(sampleRT(U.tA, home).rgb)
        const B = toLinear(sampleRT(U.tB, home).rgb)
        const pic = mix(A, B, vB).toVar()
        const manila = vec3(0.79, 0.67, 0.42)
        const fib = vnoise(st.mul(vec2(220, 90)).add(vK.mul(13.1))).mul(0.08).add(0.96)
        // the picture as print on the stock: the stock shows through the light, ink where it is dark
        const printed = manila.mul(fib).mul(luma(pic).mul(0.75).add(0.25)).mul(0.55).add(pic.mul(0.6))
        const faceP = mix(pic, printed, U.stock.mul(mix(float(1), float(0.4), vB))).toVar()
        // the printed IBM face: a card turned over about its long axis is seen top to bottom
        const ibm = toLinear(texture(faceTex, vec2(st.x, st.y.oneMinus())).rgb).toVar()
        const col = select(front, faceP, ibm).toVar()
        // light: the desk lamp, a sky fill; the card's own normal (it arches), dulled at the edges
        const N0 = normalize(select(front, vN, vN.negate())).toVar()
        const L = normalize(U.lamp.sub(vW))
        const V = normalize(cameraPosition.sub(vW))
        const dif = max(dot(N0, L), 0).mul(0.7).add(0.28)
        const spec = pow(max(dot(N0, normalize(L.add(V))), 0), 30).mul(0.08)
        const lit = col.mul(dif).add(spec).toVar()
        const lightAmt = U.stock.mul(U.heal.oneMinus()) // full lighting only while the card is a card
        const outc = mix(faceP, lit, lightAmt).toVar()
        // the seam: a thin dark kerf round every card, and the edge of the stock catching the lamp
        const ex = min(st.x, st.x.oneMinus()).mul(CARD.W), ey = min(st.y, st.y.oneMinus()).mul(CARD.H)
        const e = min(ex, ey)
        outc.mulAssign(float(1).sub(smoothstep(0.07, 0.0, e).mul(0.9).mul(U.seam)))
        outc.addAssign(vec3(0.9, 0.8, 0.55).mul(smoothstep(0.09, 0.03, e).mul(smoothstep(0.0, 0.03, e)).mul(0.12).mul(U.seam)))
        // holes the heal has closed leave a faint mark
        outc.mulAssign(float(1).sub(cuts.x.mul(0.25).mul(U.heal).mul(U.heal.oneMinus().mul(4).min(1))))
        return vec4(toSRGB(outc), 1)
      })()
      cardMat.side = THREE.DoubleSide
    }
    const cards = new THREE.Mesh(geo, cardMat)
    cards.frustumCulled = false
    cards.renderOrder = 2

    // ---- their shadows on the desk: the card's outline squashed onto z = 0, softened by height
    const shMat = new THREE.NodeMaterial()
    {
      const { shadowAt, Si } = cardWorld(true)
      shMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(shadowAt, 1))
      const vH = Si.z.toVarying() as unknown as F
      const vUv = attribute("uv", "vec2") as unknown as V2
      shMat.fragmentNode = Fn(() => {
        const e = min(min(vUv.x, vUv.x.oneMinus()).mul(CARD.W), min(vUv.y, vUv.y.oneMinus()).mul(CARD.H))
        const soft = smoothstep(0.0, vH.mul(9).add(0.08), e)
        return vec4(0, 0, 0, soft.mul(0.55).mul(smoothstep(0.0, 0.02, vH)).mul(exp(vH.mul(-1.2))))
      })()
      Object.assign(shMat, { transparent: true, depthWrite: false, blending: THREE.NormalBlending })
    }
    const shadows = new THREE.Mesh(geo, shMat)
    shadows.frustumCulled = false
    shadows.renderOrder = 1

    // ---- the desk: black linoleum in a pool of lamplight, a steel edge band at the far side
    const deskGeo = new THREE.PlaneGeometry(14, 10)
    const deskMat = new THREE.NodeMaterial()
    {
      const vW = positionGeometry.xy.toVarying() as unknown as V2
      deskMat.fragmentNode = Fn(() => {
        const p = vW.toVar()
        const lino = vnoise(p.mul(vec2(3.2, 3.2))).mul(0.5).add(vnoise(p.mul(18)).mul(0.3)).add(hash21(floor(p.mul(260))).mul(0.2))
        const pool = exp(length(p.sub(vec2(DECK.x - 0.3, DECK.y + 0.2))).mul(-0.9))
        const base = vec3(0.008, 0.0075, 0.007).mul(lino.mul(0.5).add(0.75)).add(vec3(0.2, 0.14, 0.07).mul(pool).mul(0.14))
        return vec4(toSRGB(base.mul(U.desk)), 1)
      })()
    }
    const desk = new THREE.Mesh(deskGeo, deskMat)
    desk.position.z = -0.002
    desk.renderOrder = 0
    scene.add(desk, shadows, cards)

    const blit = ctx.pass(({ uv }) => vec4(mix(sampleRT(U.tM, uv).rgb, sampleRT(U.tB, uv).rgb, U.xf), 1), U)

    // ---- scratch for the per-card pose
    const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler()
    const home = new THREE.Vector3(), from = new THREE.Vector3()
    const vLean = new THREE.Vector3()
    const camHome = new THREE.Vector3(), camDeck = new THREE.Vector3(), look = new THREE.Vector3(), lookDeck = new THREE.Vector3()

    /** Home of card k in the grid (deck units, the frame is [-asp, asp] × [-1, 1]). */
    const cellPos = (k: number, asp: number, out: THREE.Vector3) => {
      const cx = k % NX, cy = Math.floor(k / NX)
      return out.set(-asp + ((cx + 0.5) * 2 * asp) / NX, 1 - ((cy + 0.5) * 2) / NY, 0)
    }

    return {
      render(a) {
        const { w, h } = ctx.size()
        const asp = w / h
        const p = a.pl
        U.asp.value = asp
        U.tA.value = a.A
        U.tB.value = a.B
        U.stock.value = smooth(0.1, 0.22, p) * (1 - smooth(P.end0, 0.97, p)) // the picture stays itself until the cards lift
        U.seam.value = smooth(0.0, 0.05, p) * (1 - smooth(P.end0, 0.98, p))
        U.punch.value = ramp(p, 0.03, P.cut1)
        U.heal.value = smooth(P.end0, 0.96, p)
        U.xf.value = smooth(0.93, 1.0, p)
        U.desk.value = 1
        // ---- the lens: home frames the grid exactly; it tips down onto the deck for the riffle and comes home for the deal
        const D = 1 / Math.tan((15 * Math.PI) / 180)
        camHome.set(0, 0, D)
        look.set(0, 0, 0)
        camDeck.set(DECK.x + 0.05, DECK.y - 1.45, 1.55)
        lookDeck.set(DECK.x, DECK.y + 0.06, 0)
        const go = E.io3(ramp(p, P.lift0 + 0.04, P.rif0)) * (1 - E.io3(ramp(p, P.deal0 + 0.02, P.land0 + 0.08)))
        // during the release the lens leans in on the overlap, where the two halves zip together
        const lean = Math.sin(Math.PI * ramp(p, P.rif0 + 0.03, P.rif1 + 0.01)) ** 2
        camDeck.lerp(vLean.set(DECK.x + 0.02, DECK.y - 0.72, 0.62), 0.75 * lean)
        lookDeck.z += 0.06 * lean
        cam.position.lerpVectors(camHome, camDeck, go)
        look.lerp(lookDeck, go)
        // the slap of the last card shakes the lens
        const after = (p - CARDS_IN) * CARDS_DUR
        const jolt = p > CARDS_IN ? 0.006 * Math.exp(-after * 14) * Math.sin(after * 70) : 0
        cam.position.y += jolt
        cam.up.set(0, 1, 0)
        cam.lookAt(look.x, look.y + jolt, look.z)
        cam.aspect = asp
        cam.updateProjectionMatrix()
        U.lamp.value.set(DECK.x - 1.2, DECK.y + 1.4, 2.6)

        for (let k = 0; k < N; k++) {
          cellPos(k, asp, home)
          let x = home.x, y = home.y, z = 0, bend = 0, picB = 0, size = 1
          let flip = 0, yaw = 0, tilt = 0, curl = 0
          // ---- gather: from home to the deck, turning over; staggered by distance from the deck
          const dist = Math.hypot(home.x - DECK.x, home.y - DECK.y)
          const g0 = P.lift0 + 0.06 * (dist / 2.2) + 0.02 * h1(k, 1)
          const g = E.io3(ramp(p, g0, g0 + 0.15))
          if (p < P.rif0) {
            x = mixJ(home.x, DECK.x, g)
            y = mixJ(home.y, DECK.y, g)
            z = Math.sin(Math.PI * g) * (0.35 + 0.3 * h1(k, 2)) + (k + 1) * THICK * g
            flip = Math.PI * E.io2(ramp(g, 0.15, 0.85))
            yaw = (h1(k, 3) - 0.5) * 0.9 * Math.sin(Math.PI * g) + (h1(k, 6) - 0.5) * 0.06 * g
            tilt = (h1(k, 4) - 0.5) * 0.5 * Math.sin(Math.PI * g)
            size = mixJ(1, DECK_SCALE, g)
          } else {
            // ---- riffle: two halves end to end, their inner ends overlapping a fifth of a card and
            // angled into a shallow V; the thumbs curl the inner ends up, the cards spring off the
            // thumbs bottom first, alternately left and right, and each lands flat at its interleaved
            // height, so the overlap reads as a zipper of alternating edges; then pushed home.
            const r = ramp(p, P.rif0, P.rif1)
            const left = k < HALF
            const inHalf = left ? k : k - HALF
            const wD = DECK_SCALE * asp * (2 / NX)
            const split = E.io2(ramp(r, 0, 0.16)) * (1 - E.io3(ramp(r, 0.8, 0.97)))
            const sx = (left ? -1 : 1) * (0.5 - 0.26 / 2) * wD * split
            const curlUp = E.out2(ramp(r, 0.12, 0.26))
            const rel = 0.27 + 0.5 * (RIFFLE_POS[k] / (N - 1))
            const fallen = ramp(r, rel, rel + 0.035)
            const restack = E.io2(ramp(r, 0, 0.16))
            x = DECK.x + sx
            y = DECK.y + (left ? 0.012 : -0.012) * split
            // held: in its half, riding on the pile of cards already fallen (about half of them its own);
            // fallen: at its interleaved height. The two meet as the card leaves the thumb.
            const front = clamp01((r - 0.27) / 0.5) * (N - 1)
            const held = mixJ((k + 1) * THICK, (front + 1 + Math.max(0, inHalf - front / 2)) * THICK, restack)
            z = mixJ(held, (RIFFLE_POS[k] + 1) * THICK, E.in2(fallen))
            // the curl: more at the top of the half (the thumb bends the whole half), springing flat on release with a flutter
            const flutter = fallen > 0 && fallen < 1 ? 0.25 * Math.sin(Math.PI * fallen) : 0
            curl = (left ? 1 : -1) * wD * (0.05 + 0.07 * (inHalf / HALF)) * curlUp * split * (1 - E.out2(fallen) + flutter)
            flip = Math.PI
            yaw = (left ? -1 : 1) * 0.07 * split + (h1(k, 6) - 0.5) * 0.008 * (1 - smooth(0.8, 1, r))
            tilt = 0
            size = DECK_SCALE
            picB = 1
            // ---- deal: off the top, a flick through the air, flipping over as it lands home
            const j = CELL_OF[k]
            const land = P.land0 + ((P.land1 - P.land0) * j) / (N - 1)
            const f = ramp(p, land - P.flight, land)
            if (f > 0) {
              const fe = E.out2(f)
              from.set(x, y, z)
              x = mixJ(from.x, home.x, fe)
              y = mixJ(from.y, home.y, fe)
              z = mixJ(from.z, 0, fe) + Math.sin(Math.PI * f) * 0.22
              flip = Math.PI * (1 - E.io2(ramp(f, 0.25, 0.98)))
              yaw = (h1(k, 5) - 0.5) * 2.4 * (1 - fe)
              tilt = 0
              bend = 0.12 * Math.sin(Math.PI * f)
              curl = 0
              size = mixJ(DECK_SCALE, 1, E.io2(f))
              // a small bounce on the landing
              const after2 = (p - land) * CARDS_DUR
              if (p > land) z += 0.012 * Math.exp(-after2 * 20) * Math.abs(Math.sin(after2 * 40))
            }
          }
          e.set(tilt, 0, yaw)
          q.setFromEuler(e)
          q2.setFromAxisAngle(AX, flip)
          q.multiply(q2)
          iP[k].set(x, y, z + 0.0002 * (k % 3), bend)
          iQ[k].set(q.x, q.y, q.z, q.w)
          iS[k].set(picB, size, Math.max(0, z), curl)
        }
        const r = ctx.renderer
        r.setClearColor(0x000000, 1)
        r.setRenderTarget(rt)
        r.render(scene, cam)
        U.tM.value = rt.texture
        blit.render(a.out)
      },
      warm: () => [
        { scene, camera: cam, target: rt },
        { pass: blit, target: hold },
      ],
      dispose() {
        geo.dispose()
        deskGeo.dispose()
        cardMat.dispose()
        shMat.dispose()
        deskMat.dispose()
        faceTex.dispose()
        blit.dispose()
      },
    }
  },
}
const AX = new THREE.Vector3(1, 0, 0)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export default t
