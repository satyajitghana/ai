// The shared post chain, in TSL. Same maths as the GLSL engine it replaces, pass for pass:
//
//   bright   13-tap downsample of the scene with a soft threshold and firefly suppression
//   down     13-tap downsample, level to level
//   up       3×3 tent upsample added to the level above
//   comp     aberration, bloom with halation, exposure, tone map, sRGB, saturation, contrast,
//            lift/gain, vignette, fade, and the premultiplied type layer on top (8-bit sRGB out)
//   present  midtone grain and a triangular dither; exact white stays exact
//
// Three's own display nodes are not used: its AgX has a different contrast curve from the one the
// scenes were graded against, and its BloomNode is a different (gaussian mip) bloom.
//
// Each bloom level has its own material, bound once to its own targets, so a frame swaps no
// texture bindings inside the chain; the targets are resized in place when the frame is.

import * as THREE from "three/webgpu"
import { clamp, dot, float, floor, fract, If, length, max, min, mix, select, smoothstep, uniformTexture, uniform, vec2, vec3, vec4 } from "three/tsl"

import { aces, agx, hash21, L0, luma, rtUV, toSRGB, type V2, type V3 } from "./tsl"
import type { Pass, PassBuild, PostOpts, Uniforms, WarmItem } from "./types"

type MakePass = <U extends Uniforms>(build: PassBuild, uniforms?: U) => Pass<U>
type Tex = THREE.TextureNode

const LEVELS = 6
const TONE = { none: 0, aces: 1, agx: 2 } as const

/** The 13-tap downsample: a 4×4 box in five overlapping 2×2 groups, which does not ring on highlights. */
const down13 = (t: Tex, uv: V2, px: V2): V3 => {
  const s = (x: number, y: number) => t.sample(rtUV(uv.add(px.mul(vec2(x, y))))).rgb
  const a = s(-2, -2),
    b = s(0, -2),
    c = s(2, -2)
  const d = s(-2, 0),
    e = s(0, 0),
    f = s(2, 0)
  const g = s(-2, 2),
    h = s(0, 2),
    i = s(2, 2)
  const j = s(-1, -1),
    k = s(1, -1),
    l = s(-1, 1),
    m = s(1, 1)
  return e.mul(0.125).add(j.add(k).add(l).add(m).mul(0.125)).add(b.add(d).add(f).add(h).mul(0.0625)).add(a.add(c).add(g).add(i).mul(0.03125)) as V3
}

export class Post {
  private black: THREE.DataTexture
  private B: THREE.RenderTarget[] = []
  private U: THREE.RenderTarget[] = []
  private pBright: Pass<{ tA: Tex; uThresh: THREE.UniformNode<"float", number> }>
  private pDown: Pass<{ tA: Tex }>[] = []
  private pUp: Pass<{ tA: Tex; tB: Tex; uRad: THREE.UniformNode<"float", number> }>[] = []
  private levels = 0
  readonly comp
  readonly present
  readonly copy

  constructor(pass: MakePass) {
    // The placeholder every texture input starts on. Linear filtering matters: on WebGPU the WGSL
    // for a lookup is chosen from the texture the node holds when the material is built, and a
    // nearest-filtered one (a DataTexture's default) compiles to textureLoad with no sampler,
    // which then misreads the real texture swapped in later.
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    this.black.minFilter = THREE.LinearFilter
    this.black.magFilter = THREE.LinearFilter
    this.black.needsUpdate = true
    const black = this.black
    const mk = () => new THREE.RenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
    for (let i = 0; i < LEVELS; i++) {
      this.B.push(mk())
      this.U.push(mk())
    }

    // Bloom: soft threshold with firefly suppression, 13-tap downsample, 3×3 tent upsample.
    {
      const tA = uniformTexture(black)
      const uThresh = uniform(1)
      this.pBright = pass(
        ({ uv, res }) => {
          const c = min(down13(tA, uv, float(0.5).div(res) as V2), vec3(400)).toVar()
          const l = max(c.r, max(c.g, c.b))
          c.mulAssign(max(0, l.sub(uThresh)).div(max(l, 1e-4)))
          c.divAssign(luma(c).mul(0.12).add(1))
          return vec4(c, 1)
        },
        { tA, uThresh }
      )
    }
    for (let i = 1; i < LEVELS; i++) {
      const tA = uniformTexture(this.B[i - 1].texture)
      this.pDown[i] = pass(({ uv, res }) => vec4(down13(tA, uv, float(0.5).div(res) as V2), 1), { tA })
    }
    for (let i = 0; i < LEVELS - 1; i++) {
      const tA = uniformTexture(this.U[i + 1].texture)
      const tB = uniformTexture(this.B[i].texture)
      const uRad = uniform(0.85)
      this.pUp[i] = pass(
        ({ uv, res }) => {
          const px = float(0.5).div(res)
          const s = (x: number, y: number) => tA.sample(rtUV(uv.add(px.mul(vec2(x, y))))).rgb
          const c = s(0, 0)
            .mul(4)
            .add(s(-1, 0).add(s(1, 0)).add(s(0, -1)).add(s(0, 1)).mul(2))
            .add(s(-1, -1))
            .add(s(1, -1))
            .add(s(-1, 1))
            .add(s(1, 1))
          return vec4(
            c
              .div(16)
              .mul(uRad)
              .add(tB.sample(rtUV(uv)).rgb),
            1
          )
        },
        { tA, tB, uRad }
      )
    }

    {
      const u = {
        tA: uniformTexture(black),
        tBloom: uniformTexture(black),
        tText: uniformTexture(black),
        uExp: uniform(1),
        uBloom: uniform(0),
        uVig: uniform(0),
        uCA: uniform(0),
        uSat: uniform(1),
        uCon: uniform(1),
        uHal: uniform(0),
        uText: uniform(0),
        uTone: uniform(0),
        uLift: uniform(new THREE.Vector3()),
        uGain: uniform(new THREE.Vector3(1, 1, 1)),
        uFade: uniform(0),
        uFadeCol: uniform(new THREE.Vector3()),
      }
      this.comp = pass(({ uv, res }) => {
        const d = uv.sub(0.5).toVar()
        const c = vec3(0).toVar()
        If(u.uCA.greaterThan(0), () => {
          const k = d.mul(dot(d, d)).mul(u.uCA).mul(4).toVar()
          c.assign(vec3(u.tA.sample(rtUV(uv.sub(k))).level(L0).r, u.tA.sample(rtUV(uv)).level(L0).g, u.tA.sample(rtUV(uv.add(k))).level(L0).b))
        }).Else(() => {
          c.assign(u.tA.sample(rtUV(uv)).level(L0).rgb)
        })
        const hal = u.uHal.mul(0.35)
        c.addAssign(
          u.tBloom
            .sample(rtUV(uv))
            .level(L0)
            .rgb.mul(u.uBloom)
            .mul(vec3(hal.add(1), 1, hal.oneMinus()))
        )
        c.mulAssign(u.uExp)
        If(u.uTone.equal(1), () => {
          c.assign(aces(c))
        })
          .ElseIf(u.uTone.equal(2), () => {
            c.assign(agx(c))
          })
          .Else(() => {
            c.assign(clamp(c, 0, 1))
          })
        c.assign(toSRGB(c))
        c.assign(mix(vec3(luma(c)), c, u.uSat))
        c.assign(c.sub(0.5).mul(u.uCon).add(0.5))
        c.assign(c.mul(u.uGain).add(u.uLift.mul(c.oneMinus())))
        c.mulAssign(u.uVig.mul(smoothstep(0.25, 1.05, length(d.mul(vec2(res.x.div(res.y), 1))).mul(1.1))).oneMinus())
        c.assign(mix(clamp(c, 0, 1), u.uFadeCol, u.uFade))
        // the type layer is a premultiplied Canvas 2D texture: sampled y up, as it is
        If(u.uText.greaterThan(0), () => {
          const t = u.tText.sample(uv).level(L0)
          c.assign(c.mul(t.a.oneMinus()).add(t.rgb))
        })
        return vec4(c, 1)
      }, u)
    }

    {
      const tA = uniformTexture(black)
      this.copy = pass(({ uv }) => tA.sample(rtUV(uv)), { tA })
    }

    // Present: midtone-weighted grain, a triangular dither against banding, and exact white kept exact.
    {
      const tA = uniformTexture(black)
      const uGrain = uniform(0)
      this.present = pass(
        ({ uv, res, time }) => {
          const c = tA.sample(rtUV(uv)).level(L0).rgb.toVar()
          // .toVar() pins the test to this point: a bare node is an expression that would be
          // evaluated where it is used, after the grain and dither below have changed `c`
          const white = min(c.r, min(c.g, c.b)).greaterThan(0.9985).toVar()
          const fc = floor(uv.mul(res)).toVar()
          const f = floor(fract(time.mul(7.3)).mul(97))
          const n = hash21(fc.add(f.mul(13))).sub(0.5)
          c.addAssign(n.mul(uGrain).mul(2).mul(luma(c).sub(0.5).abs().oneMinus()))
          c.addAssign(
            hash21(fc.add(3.7))
              .add(hash21(fc.add(91.3)))
              .sub(1)
              .div(255)
          )
          return vec4(select(white, vec3(1), c), 1)
        },
        { tA, uGrain }
      )
    }
  }

  /** Size the bloom pyramid for a frame of w×h. */
  resize(w: number, h: number) {
    let bw = w >> 1
    let bh = h >> 1
    let n = 0
    for (let i = 0; i < LEVELS && bw > 6 && bh > 6; i++) {
      this.B[i].setSize(bw, bh)
      this.U[i].setSize(bw, bh)
      n++
      bw >>= 1
      bh >>= 1
    }
    for (let i = n; i < LEVELS; i++) {
      this.B[i].setSize(2, 2)
      this.U[i].setSize(2, 2)
    }
    this.levels = n
    // the lowest level in use has nothing below it: its upsample reads the downsample itself
    for (let i = 0; i < n - 1; i++) this.pUp[i].u.tA.value = i === n - 2 ? this.B[n - 1].texture : this.U[i + 1].texture
  }

  /** Bloom + grade `src` (linear HDR) into `out` (8-bit sRGB), with `text` composited on top. */
  finish(src: THREE.Texture, post: PostOpts, text: THREE.Texture | null, out: THREE.RenderTarget) {
    const u = this.comp.u
    const n = this.levels
    const bloom = post.bloom ?? 0
    let bloomTex: THREE.Texture = this.black
    if (bloom > 0 && n > 0) {
      this.pBright.u.tA.value = src
      this.pBright.u.uThresh.value = post.bloomThresh ?? 1
      this.pBright.render(this.B[0])
      for (let i = 1; i < n; i++) this.pDown[i].render(this.B[i])
      const rad = post.bloomRadius ?? 0.85
      for (let i = n - 2; i >= 0; i--) {
        this.pUp[i].u.uRad.value = rad
        this.pUp[i].render(this.U[i])
      }
      bloomTex = n > 1 ? this.U[0].texture : this.B[0].texture
    }
    u.tA.value = src
    u.tBloom.value = bloomTex
    u.uBloom.value = (bloom / Math.max(1, n)) * 1.6
    u.uHal.value = post.halation ?? 0
    u.uExp.value = post.exposure ?? 1
    u.uTone.value = TONE[post.tone ?? "aces"]
    u.uVig.value = post.vignette ?? 0
    u.uCA.value = post.ca ?? 0
    u.uSat.value = post.sat ?? 1
    u.uCon.value = post.contrast ?? 1
    const lift = post.lift
    const gain = post.gain
    const fc = post.fadeColor
    if (lift) u.uLift.value.set(lift[0], lift[1], lift[2])
    else u.uLift.value.set(0, 0, 0)
    if (gain) u.uGain.value.set(gain[0], gain[1], gain[2])
    else u.uGain.value.set(1, 1, 1)
    u.uFade.value = post.fade ?? 0
    if (fc) u.uFadeCol.value.set(fc[0], fc[1], fc[2])
    else u.uFadeCol.value.set(0, 0, 0)
    u.tText.value = text ?? this.black
    u.uText.value = text ? 1 : 0
    this.comp.render(out)
  }

  /** Everything here with the target it draws into, for `compileAsync`. `out8` is any 8-bit target. */
  warm(out8: THREE.RenderTarget): WarmItem[] {
    const items: WarmItem[] = [
      { pass: this.pBright, target: this.B[0] },
      { pass: this.comp, target: out8 },
      { pass: this.copy, target: out8 },
    ]
    for (let i = 1; i < LEVELS; i++) items.push({ pass: this.pDown[i], target: this.B[i] })
    for (let i = 0; i < LEVELS - 1; i++) items.push({ pass: this.pUp[i], target: this.U[i] })
    return items
  }

  dispose() {
    for (const rt of [...this.B, ...this.U]) rt.dispose()
    for (const p of [this.pBright, ...this.pDown, ...this.pUp, this.comp, this.copy, this.present]) p?.dispose()
    this.black.dispose()
  }
}
