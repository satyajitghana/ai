// 8 → 9. The sea floor is buried.
//
// Silt rains down through the water of the outgoing frame: 36,000 grains, each on a closed-form
// path. A grain falls at its own terminal speed, which goes as the square of its size (Stokes), so
// of the grains that leave together the coarse ones arrive first and the fines last: every bed is
// graded, coarse at its base and fine at its top. Seven beds fill from the bottom of the frame up
// while the water goes murky. A bed that is full compacts: it loses a third of its thickness in a
// tenth of a second, rings down, a line of dust jumps along the bedding plane, and it is rock,
// which is to say the incoming frame shows through it. When the last bed locks (the climax, and
// the next scene's clock zero) the whole picture is a wall of rock. Meanwhile the old picture has
// been sliding up out of the frame as the lens tips, and the cliff's own camera tips to meet it.
//
// Everything is a function of the transition's linear progress: bed k fills over [F0[k], L[k]] and
// locks at L[k]; a grain lands when the rising surface of its bed passes its own resting height.

import * as THREE from "three/webgpu"
import { attribute, clamp, cos, exp, float, floor, Fn, max, mix, positionGeometry, select, sin, smoothstep, uniform, uniformTexture, vec2, vec3, vec4 } from "three/tsl"

import { rng } from "../engine/ease"
import { H } from "../engine/synth"
import { hash21, sampleRT, sat, vnoise, type F, type V2, type V3 } from "../engine/tsl"
import type { TransitionDef } from "../engine/types"

const DUR = 3.3
const LOCK = 0.76 // the last bed locks; strata's clock starts
const NB = 7
const PUFF = 1.5 // a bed of loose silt is this many times its compacted thickness
const GRAINS = 36000
const LEAD = 0.1 // of the transition: how long before a bed starts to fill its grains are let go

// the beds: where each sits in the frame once it is rock, when it starts to fill, when it locks
const BED = (() => {
  const r = rng(2460)
  const th = Array.from({ length: NB }, (_, k) => 0.7 + r() * 0.9 + (k === 0 ? 0.3 : 0))
  const sum = th.reduce((a, b) => a + b, 0)
  let y = -0.01
  return th.map((t, k) => {
    const y0 = y
    y += (t / sum) * 1.05
    const L = 0.17 + (LOCK - 0.17) * (k / (NB - 1)) ** 0.92
    return { y0, th: y - y0, L, F0: 0, seed: r() }
  })
})()
BED.forEach((b, k) => (b.F0 = k === 0 ? 0.03 : BED[k - 1].L - 0.025))

const snd: NonNullable<TransitionDef["snd"]> = [
  { s: "rumble", o: { f: 140, dur: DUR * LOCK, g: 0.7 } },
  { s: "hiss", o: { dur: DUR * LOCK, g: 0.5 } },
  { s: "whoosh", o: { f: 90, dur: DUR * LOCK * 0.9, g: 0.4, at: 0.1 } },
]
BED.forEach((b, k) => {
  const pan = k % 2 ? 0.35 : -0.35
  snd.push({ s: "thump", p: b.L, o: { f: H(2) + k * 6, g: 0.6 + k * 0.06, pos: [pan, -0.8 + k * 0.27, 0] } }, { s: "squelch", p: b.L, o: { g: 0.3, pos: [-pan, -0.8 + k * 0.27, 0.2] } })
})
snd.push({ s: "riser", o: { at: DUR * LOCK - 1.1, dur: 1.1, g: 0.4 } }, { s: "boom", p: LOCK, o: { f: H(1.5), dur: 2.4, g: 0.7 } }, { s: "sub", p: LOCK, o: { g: 0.9 } }, { s: "crack", p: LOCK, o: { f: 700, g: 0.8 } }, { s: "knap", p: LOCK, o: { f: H(24), g: 0.6 } })

const t: TransitionDef = {
  id: "settle",
  dur: DUR,
  inAt: LOCK,
  ease: (x) => x,
  snd,
  // the water thins out as the wind comes up
  sound: (pl, _prev, synth) => {
    synth.bed("water", Math.max(0, 0.7 - pl))
    synth.bed("wind", Math.max(0, pl - 0.5) * 0.5)
  },
  create(ctx) {
    const hold = ctx.target({ hdr: false, fixed: [2, 2] })
    const U = { tA: uniformTexture(hold.texture), tB: uniformTexture(hold.texture), p: uniform(0), uRes: uniform(new THREE.Vector2(1280, 720)) }
    const p = U.p
    const endK = smoothstep(0.93, 1, p).oneMinus()

    /** The surface of a bed is not level: silt drapes. Same on the CPU-free vertex side and in the picture. */
    const drape = (x: F, y0: F): F => sin(x.mul(17).add(y0.mul(37))).mul(0.06).add(sin(x.mul(43).add(y0.mul(91))).mul(0.035)).add(1) as F
    /** How much thicker than rock a bed is: PUFF while it is loose, then a hard squeeze that rings down. */
    const loose = (L: F): F => {
      const v = max(p.sub(L), 0).mul(DUR)
      return select(p.lessThan(L), float(PUFF - 1), exp(v.mul(-11)).mul(cos(v.mul(24))).mul(PUFF - 1).mul(endK)) as F
    }
    // the knocks: each lock shakes the frame a little, the last one more
    const shake = Fn(() => {
      const s = float(0).toVar()
      BED.forEach((b, k) => {
        const v = max(p.sub(b.L), 0).mul(DUR)
        s.addAssign(exp(v.mul(-9)).mul(sin(v.mul(46))).mul(p.greaterThan(b.L).select(k === NB - 1 ? 0.011 : 0.0035, 0)))
      })
      return s.mul(endK)
    })

    // ---- the picture: water above, loose silt, rock
    const bgMat = new THREE.NodeMaterial()
    bgMat.vertexNode = vec4(positionGeometry.xy.mul(2), 0, 1)
    bgMat.fragmentNode = Fn(() => {
      const uv0 = positionGeometry.xy.add(0.5).toVarying("stUV")
      const uv = vec2(uv0.x, uv0.y.add(shake())).toVar()
      // which bed this pixel is in (the lowest whose surface is above it), or none
      const y0 = float(0).toVar(), th = float(1).toVar(), L = float(9).toVar(), F0 = float(9).toVar(), sd = float(0).toVar(), inBed = float(0).toVar()
      for (let k = NB - 1; k >= 0; k--) {
        const b = BED[k]
        const fill = clamp(p.sub(b.F0).div(b.L - b.F0), 0, 1)
        const top = float(b.y0).add(fill.mul(float(b.th).mul(loose(float(b.L)).add(1))).mul(drape(uv.x as F, float(b.y0)).mul(p.lessThan(b.L).select(1, 0)).add(p.lessThan(b.L).select(0, 1))))
        const c = uv.y.lessThan(top).and(p.greaterThan(b.F0))
        y0.assign(select(c, b.y0, y0))
        th.assign(select(c, b.th, th))
        L.assign(select(c, b.L, L))
        F0.assign(select(c, b.F0, F0))
        sd.assign(select(c, b.seed, sd))
        inBed.assign(select(c, 1, inBed))
      }
      // the old picture slides up as the lens tips, and silts up
      const tip = smoothstep(0, LOCK, p)
      const uvA = clamp(uv.sub(vec2(0.5, 0.35)).mul(tip.mul(-0.1).add(1)).add(vec2(0.5, 0.35)).sub(vec2(0, tip.mul(tip).mul(0.16))), 0.001, 0.999)
      const A = sampleRT(U.tA, uvA as V2).rgb
      const cloud = vnoise(uv.mul(vec2(3, 5)).add(vec2(0, p.mul(4)))).mul(0.6).add(vnoise(uv.mul(vec2(9, 14)).add(vec2(0, p.mul(9)))).mul(0.4))
      const murk = smoothstep(0, 0.6, p).mul(cloud.mul(0.5).add(0.5)).mul(0.82)
      const water = mix(A, vec3(0.36, 0.37, 0.31).mul(cloud.mul(0.35).add(0.8)), murk).toVar()
      // loose silt: coarse and speckled at the base of the bed, fine mud at its top
      const sq = loose(L).add(1)
      const dr = select(p.lessThan(L), drape(uv.x as F, y0), 1)
      const v = clamp(uv.y.sub(y0).div(th.mul(sq).mul(dr)).mul(sq.div(PUFF)), 0, 1).toVar()
      const px = uv.mul(U.uRes)
      const coarse = hash21(floor(px.div(4.5)).add(sd.mul(100))).mul(0.6).add(hash21(floor(px.div(2)).add(7)).mul(0.4))
      const fine = vnoise(px.div(1.6))
      const speck = mix(coarse, fine.mul(0.3).add(0.4), smoothstep(0.05, 0.7, v))
      const tone = mix(vec3(0.4, 0.37, 0.3), vec3(0.3, 0.33, 0.31), sd)
      const silt = tone.mul(mix(0.62, 1.12, speck)).mul(mix(0.82, 1.08, v)).toVar()
      // the bedding plane under it
      silt.mulAssign(smoothstep(0, 0.012, uv.y.sub(y0)).mul(0.45).add(0.55))
      // rock: the incoming frame, squeezed with the bed
      const uvB = vec2(uv0.x, y0.add(uv.y.sub(y0).div(sq))).toVar()
      const B = sampleRT(U.tB, clamp(mix(uvB, uv0, smoothstep(0.93, 1, p)), 0.001, 0.999) as V2).rgb
      const lith = smoothstep(0, 0.085, p.sub(L))
      const bed = mix(silt, B, lith).toVar()
      // dust jumping along the plane the bed has just closed on
      const vL = max(p.sub(L), 0).mul(DUR)
      const top = y0.add(th.mul(sq))
      const dust = exp(top.sub(uv.y).div(-0.02).abs().negate()).mul(exp(vL.mul(-5))).mul(p.greaterThan(L).select(1, 0)).mul(vnoise(vec2(uv.x.mul(40), vL.mul(6))).mul(0.8).add(0.3))
      bed.addAssign(vec3(0.75, 0.7, 0.6).mul(dust).mul(0.6).mul(endK))
      // the last lock: the wall flashes with its own dust
      const fin = max(p.sub(LOCK), 0).mul(DUR)
      const flash = exp(fin.mul(-6)).mul(p.greaterThan(LOCK).select(1, 0)).mul(0.22).mul(endK)
      const c = mix(water, bed, inBed).toVar()
      c.addAssign(vec3(0.9, 0.82, 0.7).mul(flash).mul(vnoise(uv.mul(vec2(6, 30)).add(fin.mul(3)))))
      return vec4(c, 1)
    })()
    Object.assign(bgMat, { depthTest: false, depthWrite: false })
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat)
    bg.frustumCulled = false
    bg.renderOrder = 0

    // ---- the grains
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    {
      const r = rng(720)
      const a = new Float32Array(GRAINS * 4), b = new Float32Array(GRAINS * 4)
      const total = BED.reduce((s, q) => s + q.th, 0)
      let i = 0
      BED.forEach((bed, k) => {
        const n = k === NB - 1 ? GRAINS - i : Math.round((GRAINS * bed.th) / total)
        for (let j = 0; j < n && i < GRAINS; j++, i++) {
          // many fines, few coarse; the coarse rest low in the bed
          const sz = r() ** 2.2
          const vr = Math.min(1, Math.max(0.01, (1 - sz) ** 0.7 * (0.75 + 0.3 * r()) + (r() - 0.5) * 0.08))
          a.set([-0.02 + r() * 1.04, sz, vr, r()], i * 4)
          b.set([bed.y0, bed.th, bed.F0, bed.L], i * 4)
        }
      })
      geo.setAttribute("aG", new THREE.InstancedBufferAttribute(a, 4))
      geo.setAttribute("aH", new THREE.InstancedBufferAttribute(b, 4))
      geo.instanceCount = GRAINS
    }
    const aG = attribute("aG", "vec4"), aH = attribute("aH", "vec4")
    const G = (() => {
      const sz = aG.y, vr = aG.z, ph = aG.w
      const y0 = aH.x, th = aH.y, F0 = aH.z, L = aH.w
      const pland = F0.add(vr.mul(L.sub(F0)))
      const prel = F0.sub(LEAD).sub(ph.mul(0.02))
      const f = p.sub(prel).div(pland.sub(prel)).toVar()
      const dr = drape(aG.x as F, y0 as F)
      const landY = y0.add(th.mul(PUFF).mul(vr).mul(dr))
      const restY = y0.add(th.mul(loose(L as F).add(1)).mul(vr).mul(select(p.lessThan(L), dr, 1)))
      const falling = f.lessThan(1)
      // a fine grain flutters on the way down; a coarse one drops straight
      const sway = sin(f.mul(sz.oneMinus().mul(26).add(6)).add(ph.mul(40))).mul(sz.oneMinus()).mul(0.012).mul(clamp(f.oneMinus(), 0, 1))
      const y = select(falling, mix(ph.mul(0.12).add(1.05), landY, f), restY).add(shake())
      const x = aG.x.add(select(falling, sway, 0))
      const rpx = mix(0.9, 4.0, sz.mul(sz)).mul(U.uRes.y.div(720))
      // streaked along its fall while it moves
      const str = select(falling, sz.mul(0.5).add(1.15), 1)
      const on = p.greaterThan(prel).select(1, 0)
      const fade = smoothstep(0, 0.05, p).mul(smoothstep(0, 0.085, p.sub(L)).oneMinus()).mul(on)
      const q = positionGeometry.xy
      const c = vec2(x, y).add(q.mul(vec2(rpx.div(U.uRes.x), rpx.mul(str).div(U.uRes.y))))
      return { clip: vec4(c.mul(2).sub(1).mul(on), 0, 1), vQ: q.toVarying("grQ"), vK: vec4(sz, ph, fade, select(falling, 1, 0)).toVarying("grK") }
    })()
    const grainMat = new THREE.NodeMaterial()
    grainMat.vertexNode = G.clip
    grainMat.fragmentNode = Fn(() => {
      const q = G.vQ, sz = G.vK.x, ph = G.vK.y
      const d = q.dot(q)
      const disc = smoothstep(1, 0.55, d)
      // quartz pale, feldspar pink, dark lithic, olive mud
      const col = select(ph.lessThan(0.4), vec3(0.62, 0.58, 0.5), select(ph.lessThan(0.6), vec3(0.5, 0.36, 0.3), select(ph.lessThan(0.82), vec3(0.16, 0.17, 0.18), vec3(0.36, 0.39, 0.3)))).toVar()
      // a landed grain is lit from the upper left; a falling one is a soft mote in murky water
      const lit = sat(q.dot(vec2(-0.5, 0.6)).mul(0.6).add(0.75) as F)
      const body = mix(col.mul(lit), col.mul(0.8).add(0.08), G.vK.w)
      const a = disc.mul(G.vK.z).mul(mix(mix(0.5, 1, sz), mix(0.35, 0.8, sz), G.vK.w))
      return vec4(body.mul(a) as V3, a)
    })()
    Object.assign(grainMat, { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })
    const grains = new THREE.Mesh(geo, grainMat)
    grains.frustumCulled = false
    grains.renderOrder = 1

    const scene = new THREE.Scene()
    scene.add(bg, grains)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    return {
      render(a) {
        const { w, h } = ctx.size()
        U.uRes.value.set(w, h)
        U.tA.value = a.A
        U.tB.value = a.B
        U.p.value = a.pl
        const r = ctx.renderer
        r.setRenderTarget(a.out)
        r.render(scene, cam)
      },
      warm: () => [{ scene, camera: cam, target: hold }],
      dispose() {
        geo.dispose()
        bg.geometry.dispose()
        bgMat.dispose()
        grainMat.dispose()
      },
    }
  },
}
export default t
