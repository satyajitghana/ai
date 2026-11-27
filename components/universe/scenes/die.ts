// Scene 21, die: "Silicon and glass". The Information Age.
//
// Staging. Beat 0: a 300 mm wafer on black velvet under one big soft panel, its oxide throwing
// thin-film colour that slides as the lens moves, the notch at the rim, dies stepped across it in a
// grid with partial dies cut off by the edge-exclusion ring. Then a log-space dive in five stops,
// framed on feature size: the die (seal ring, a ring of bond pads, SRAM, cores, a sea of logic),
// a logic block, down through the copper stack (each layer at right angles to the one below,
// finer and thinner as we go, vias landing on the lines, each layer resolving as the lens nears it
// and passing overhead), the standard-cell rows (alternate rows mirrored to share their rails), and
// one transistor: fins standing out of the trench oxide, gates wrapped over them, spacers,
// diamond-faceted source and drain, contacts. Its gate charges and the channel conducts: a switch
// with no moving parts. Beat 1: the current is a packet of light. Inside a single-mode fibre the
// bit train runs down the core, reflecting at a grazing angle off the cladding; the lens backs out
// through the coloured coating, the gel-filled steel tube with its seven sister fibres, two
// opposite-lay layers of steel strength wires, the copper sheath and the polyethylene (each shell
// cut away on the lens side while the lens is inside it, healing as it leaves), and out onto the
// abyssal plain in the pool of one lamp, where the cable, bare as the ICPC says deep-water cable
// is, runs into the dark past a repeater housing.
//
// Story parameter. Beat 0 `zoom`: log10 of the camera's height above the transistors in nm.
// Beat 1 `packets`: how far the bit train has run, then the log distance from the fibre's axis.
// World rule. Beat 0: one overhead panel and one thin-film term; every position is real / h
// (h = the camera's height), so seven decades share float32. Beat 1: one lamp at the lens and one
// blue-green absorption with distance, shared by sediment, cable, housing and snow.
// Beat sheet, conflicts with the brief (no feature sizes on screen, the notch, no armour), and
// references: R/beats/die.md.

import * as THREE from "three/webgpu"
import { abs, atan, attribute, cameraPosition, clamp as clampN, cos, Discard, dot, exp, float, floor, Fn, fract, fwidth, length, max, mix as mixN, mod, normalize, normalWorld, positionGeometry, positionLocal, positionWorld, pow, select, sin, sqrt, step, texture, uniform, uniformArray, vec2, vec3, vec4, uniformTexture, faceDirection } from "three/tsl"

import { ageCard, ageCardClear, placeRule, ruleArrival, ruleCues, ruleFace, ruleGeometry, ruleLabels, type RuleStyle } from "../engine/ages"
import { makeAim, makeHerd, skinMaterial, type CreatureSpec, type Drive, type Lights, type Look, type SkinNodes } from "../engine/creature"
import { clamp, E, mix, ramp, rng, smooth } from "../engine/ease"
import { canvasTex, disposeTree, stageTarget } from "../engine/stage"
import { H } from "../engine/synth"
import { titles, type TitleOpts } from "../engine/titles"
import { fbm, hash21, sampleRT, vnoise, type F, type V2, type V3, type V4 } from "../engine/tsl"
import type { Ctx, Cue, PostOpts, SceneInstance, State } from "../engine/types"
import { SCANLINE_DUR, SCANLINE_IN } from "../transitions/scanline"

const START = SCANLINE_DUR * (1 - SCANLINE_IN)
const FOV = 34

// ---------------------------------------------------------------- small TSL helpers

type Num = F | number
const fl = (x: Num): F => (typeof x === "number" ? float(x) : x)
/** smoothstep that also takes a falling edge (WGSL's is undefined for e0 > e1). */
const ss = (e0: Num, e1: Num, x: F): F => {
  const t = clampN(x.sub(fl(e0)).div(fl(e1).sub(fl(e0))), 0, 1)
  return t.mul(t).mul(t.mul(-2).add(3)) as F
}
/** The layout hash: exact on small integers in float32 and in JavaScript, so the 3D transistors land where the flat pattern put them. */
const sqF = (x: F): F => x.mul(x) as F
const hhN = (i: F, j: F): F => fract(mod(i.mul(37).add(j.mul(101)).add(11), 97).mul(0.61803398).add(0.137)) as F
const hhJ = (i: number, j: number) => {
  const n = (((i * 37 + j * 101 + 11) % 97) + 97) % 97
  const v = n * 0.61803398 + 0.137
  return v - Math.floor(v)
}

// ---------------------------------------------------------------- the chip, in nanometres

const NM = 1
const CH = 156 * NM // cell row: six fin pitches
const CPP = 48 * NM // contacted gate pitch
const FPITCH = 26 * NM
const G0 = 4000, R0 = 2000 // the gate and row of the transistor we land on
const TX = (G0 + 0.5) * CPP // layout x of the target
const TY = R0 * CH + 2 * FPITCH // layout y: between its two n fins
const DIE: [number, number] = [14e6, 11e6] // staging: a large die
const DIE_UV: [number, number] = [0.38, 0.56] // where the target sits in its die
const DIE_LL: [number, number] = [-6e6, -1e6] // the target die's lower-left corner, from the wafer's centre
const TW: [number, number] = [DIE_LL[0] + DIE_UV[0] * DIE[0], DIE_LL[1] + DIE_UV[1] * DIE[1]] // target, from the wafer's centre
const WC: [number, number] = [-TW[0], -TW[1]] // wafer centre, from the target
const DO: [number, number] = [DIE_LL[0] - TW[0], DIE_LL[1] - TW[1]] // die grid origin, from the target
const R_WAF = 150e6, R_EXCL = 147e6
const SCRIBE = 0.06e6
const BLOCK = { u0: 0.3, u1: 0.47, v0: 0.48, v1: 0.66 } // the logic block, in die uv
// the copper stack, top first: pitch, bottom, thickness, direction (0 lines along x), line fraction, upper pitch for vias
const METAL: { P: number; z: number; T: number; d: number; wf: number; seg: number }[] = [
  { P: 30000, z: 16000, T: 4800, d: 0, wf: 0.55, seg: 0 },
  { P: 6200, z: 8400, T: 2300, d: 1, wf: 0.42, seg: 14 },
  { P: 1260, z: 3300, T: 880, d: 0, wf: 0.46, seg: 12 },
  { P: 320, z: 1150, T: 260, d: 1, wf: 0.5, seg: 11 },
  { P: 100, z: 430, T: 88, d: 0, wf: 0.5, seg: 10 },
  { P: 48, z: 220, T: 44, d: 1, wf: 0.5, seg: 9 },
  { P: 30, z: 150, T: 32, d: 0, wf: 0.5, seg: 8 },
]
const FIN_H = 50, GATE_H = 76, GATE_L = 16, SPACER = 6

// beat 0: the stops of the dive (log10 of height in nm, tilt from vertical, azimuth)
const STOPS = [
  { lh: 8.32, tilt: 0.98, az: -1.95 }, // the wafer
  { lh: 7.32, tilt: 0.62, az: -1.75 }, // the die
  { lh: 5.95, tilt: 0.36, az: -1.6 }, // a logic block
  { lh: 4.3, tilt: 0.34, az: -1.42 }, // the copper stack
  { lh: 3.28, tilt: 0.5, az: -1.3 }, // standard cells
  { lh: 2.62, tilt: 0.38, az: -1.45 }, // one transistor
]
const MOVES: [number, number][] = [
  [1.55, 2.1],
  [2.18, 2.72],
  [2.8, 3.55],
  [3.63, 4.2],
  [4.28, 4.95],
]
const NAMES0 = ["wafer", "die", "logic block", "copper layers", "standard cells", "one transistor"]
const T_ON = 5.2 // the gate charges

// ---------------------------------------------------------------- the cable, in metres

const R_CORE = 4.5e-6, R_CLAD = 62.5e-6, R_COAT = 125e-6
const FIB_RING = 0.5e-3 // fibres round the cable's axis
const CABLE_C: [number, number] = [0, -FIB_RING] // the cable's axis from the target fibre's (y, z)
const TUBE = [1.0e-3, 1.3e-3]
const WIRES = [
  { n: 10, R: 1.76e-3, r: 0.44e-3, lay: 0.12 },
  { n: 16, R: 2.68e-3, r: 0.47e-3, lay: -0.16 },
]
const COPPER = [3.15e-3, 3.5e-3]
const JACKET = [3.5e-3, 8.5e-3]
const SED_Z = CABLE_C[1] - JACKET[1] + 2.6e-3 // the cable lies a little sunk
const BOUNCE = (2 * R_CORE) / Math.tan((8 * Math.PI) / 180) // the grazing reflection's period along the axis
const LBIT = 2.6e-6, VBIT = 62e-6 // staging: a bit's length and the train's speed (slowed beyond any meaning)
const VCAM = 44e-6
const REP_X = 0.78 // the repeater housing
const FIB_COL = [0x2f6bd8, 0xe8862a, 0x2fa457, 0x7a4a22, 0x8a9096, 0xe9e6dc, 0xc8302b, 0x1b1b1d] // TIA-598 order
const NAMES1 = ["core", "cladding", "coating", "steel tube", "strength wires", "copper", "polyethylene", "the deep sea floor"]
const NAME1_S = [0, 3.4e-5, 1.0e-4, 6.0e-4, 2.0e-3, 3.4e-3, 6.0e-3, 0.06]

// ---------------------------------------------------------------- geometry helpers

/** Coordinates 0, ±s0·k^i up to ±ext: dense near the origin (the target), sparse far away, so float32 holds near the lens. */
function logAxis(s0: number, ext: number, k = 1.32) {
  const xs = [0]
  for (let x = s0; x < ext; x *= k) xs.push(x, -x)
  xs.push(ext, -ext)
  return xs.sort((a, b) => a - b)
}
/** A flat grid at z = 0 on those coordinates (positions in real units). */
function logPlane(s0: number, ext: number, k?: number) {
  const xs = logAxis(s0, ext, k)
  const n = xs.length
  const pos = new Float32Array(n * n * 3)
  const nor = new Float32Array(n * n * 3)
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const o = (j * n + i) * 3
      pos[o] = xs[i]
      pos[o + 1] = xs[j]
      nor[o + 2] = 1
    }
  const idx: number[] = []
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i
      idx.push(a, a + 1, a + n, a + 1, a + n + 1, a + n)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
  g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e12)
  return g
}
/**
 * A shell along x, as an annular sector whose angles are set in the vertex stage: attribute
 * `aS` = (u along the arc 0..1, which radius 0 inner / 1 outer, face kind 0 arc / -1 / +1 the cut faces).
 */
function shellGeo(xs: number[], seg: number) {
  const ring: [number, number, number][] = []
  for (let i = 0; i <= seg; i++) ring.push([i / seg, 1, 0])
  for (let i = seg; i >= 0; i--) ring.push([i / seg, 0, 0])
  ring.push([0, 0, -1], [0, 1, -1], [1, 1, 1], [1, 0, 1])
  const m = ring.length
  const pos: number[] = []
  const aS: number[] = []
  for (const x of xs)
    for (const r of ring) {
      pos.push(x, 0, 0)
      aS.push(r[0], r[1], r[2])
    }
  const idx: number[] = []
  const quad = (a: number, b: number) => {
    for (let k = 0; k < xs.length - 1; k++) {
      const o = k * m
      idx.push(o + a, o + m + a, o + b, o + b, o + m + a, o + m + b)
    }
  }
  for (let i = 0; i < seg; i++) quad(i, i + 1) // outer arc
  for (let i = 0; i < seg; i++) quad(seg + 1 + i, seg + 2 + i) // inner arc
  quad(2 * seg + 2, 2 * seg + 3)
  quad(2 * seg + 4, 2 * seg + 5)
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("aS", new THREE.Float32BufferAttribute(aS, 3))
  g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
  return g
}
/** Tube rings for a thin rod along x: attribute aT = (angle 0..1). */
function rodGeo(xs: number[], seg: number) {
  const pos: number[] = []
  const aT: number[] = []
  for (const x of xs)
    for (let i = 0; i <= seg; i++) {
      pos.push(x, 0, 0)
      aT.push(i / seg)
    }
  const idx: number[] = []
  const m = seg + 1
  for (let k = 0; k < xs.length - 1; k++)
    for (let i = 0; i < seg; i++) {
      const o = k * m + i
      idx.push(o, o + 1, o + m, o + 1, o + m + 1, o + m)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("aT", new THREE.Float32BufferAttribute(aT, 1))
  g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
  return g
}
/** Positions along x for the cable: log-spaced about the chase, uniform enough for a helix's lay. */
function cableXs(ext: number, maxStep: number) {
  const xs = new Set<number>([0])
  for (let x = 2e-6; x < ext; x = Math.min(x * 1.28, x + maxStep)) {
    xs.add(x)
    xs.add(-x)
  }
  xs.add(ext)
  xs.add(-ext)
  return [...xs].sort((a, b) => a - b)
}

export function create(ctx: Ctx): SceneInstance {
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 400)
  cam.up.set(0, 0, 1)
  const chip = new THREE.Scene()
  const sea = new THREE.Scene()
  const chipG = new THREE.Group()
  chip.add(chipG)
  const seaG = new THREE.Group()
  sea.add(seaG)
  const U = {
    h: uniform(1e8), //        camera height, nm
    camR: uniform(new THREE.Vector3()), // camera in real nm, from the target
    panel: uniform(new THREE.Vector3(0.3, 0.74, 0.6).normalize()),
    lampDir: uniform(new THREE.Vector3(0.5, 0.7, -0.5).normalize()),
    boxOn: uniform(0),
    on: uniform(0), //         the gate's charge
    flow: uniform(0), //       seconds of current
    time: uniform(0),
    // cable world
    S: uniform(1e-5),
    camS: uniform(new THREE.Vector3()), // camera, real metres from the target fibre
    lamp: uniform(new THREE.Vector3()),
    bits: uniform(0), //       how far the train has run, m
    leak: uniform(1),
    sea: uniform(0), //        how much of the sea floor's light there is
    inner: uniform(1), //      the lamp's reach inside the glass (little: it is lit by its own light)
  }

  // ---------------------------------------------------------------- the die's floor plan, painted once

  const dieTex = canvasTex(2048, 1609, (c, w, h) => {
    const R = rng(21)
    c.fillStyle = "#3a3040"
    c.fillRect(0, 0, w, h)
    const block = (x: number, y: number, bw: number, bh: number, base: string, kind: number) => {
      c.fillStyle = base
      c.fillRect(x * w, y * h, bw * w, bh * h)
      if (kind === 1) {
        // SRAM: a fine regular weave of bit-cell arrays with their decoders
        const nx = 8, ny = 6
        for (let i = 0; i < nx; i++)
          for (let j = 0; j < ny; j++) {
            const ax = x + (bw * (i + 0.06)) / nx, ay = y + (bh * (j + 0.08)) / ny
            c.fillStyle = (i + j) % 2 ? "rgba(120,170,190,0.55)" : "rgba(100,150,175,0.55)"
            c.fillRect(ax * w, ay * h, (bw / nx) * 0.88 * w, (bh / ny) * 0.8 * h)
            c.fillStyle = "rgba(30,30,40,0.5)"
            c.fillRect((ax + (bw / nx) * 0.42) * w, ay * h, (bw / nx) * 0.04 * w, (bh / ny) * 0.8 * h)
          }
      } else if (kind === 2) {
        // a core: register files, caches and its own logic, mirrored
        for (let k = 0; k < 40; k++) {
          c.fillStyle = `rgba(${150 + R() * 80},${110 + R() * 60},${120 + R() * 70},${0.25 + R() * 0.3})`
          c.fillRect((x + R() * bw * 0.85) * w, (y + R() * bh * 0.85) * h, R() * bw * 0.3 * w, R() * bh * 0.25 * h)
        }
        c.fillStyle = "rgba(110,160,185,0.6)"
        c.fillRect((x + bw * 0.05) * w, (y + bh * 0.68) * h, bw * 0.9 * w, bh * 0.26 * h)
      } else if (kind === 3) {
        // a GPU: identical tiles
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 4; j++) {
            c.fillStyle = "rgba(160,120,150,0.5)"
            c.fillRect((x + (bw * (i + 0.08)) / 6) * w, (y + (bh * (j + 0.1)) / 4) * h, (bw / 6) * 0.84 * w, (bh / 4) * 0.8 * h)
            c.fillStyle = "rgba(90,140,160,0.5)"
            c.fillRect((x + (bw * (i + 0.08)) / 6) * w, (y + (bh * (j + 0.62)) / 4) * h, (bw / 6) * 0.84 * w, (bh / 4) * 0.25 * h)
          }
      } else if (kind === 4) {
        // the sea of standard-cell logic: a fine grain
        // (read back through a scratch canvas made for it: willReadFrequently keeps the readback on the CPU)
        const X0 = Math.floor(x * w), Y0 = Math.floor(y * h), BW = Math.ceil(bw * w), BH = Math.ceil(bh * h)
        const sc = document.createElement("canvas")
        sc.width = BW
        sc.height = BH
        const sx = sc.getContext("2d", { willReadFrequently: true })!
        sx.drawImage(c.canvas, X0, Y0, BW, BH, 0, 0, BW, BH)
        const img = sx.getImageData(0, 0, BW, BH)
        for (let i = 0; i < img.data.length; i += 4) {
          const v = R() * 26 - 13
          img.data[i] += v
          img.data[i + 1] += v * 0.8
          img.data[i + 2] += v
        }
        c.putImageData(img, X0, Y0)
      } else {
        for (let k = 0; k < 18; k++) {
          c.fillStyle = `rgba(${170 + R() * 60},${150 + R() * 60},${110 + R() * 50},0.35)`
          c.fillRect((x + R() * bw * 0.8) * w, (y + R() * bh * 0.8) * h, R() * bw * 0.35 * w, R() * bh * 0.3 * h)
        }
      }
      c.strokeStyle = "rgba(20,16,24,0.85)"
      c.lineWidth = 3
      c.strokeRect(x * w, y * h, bw * w, bh * h)
    }
    // y down on the canvas; the texture is sampled y up, so the block's v is flipped here
    const B = (u0: number, v0: number, u1: number, v1: number, base: string, kind: number) => block(u0, 1 - v1, u1 - u0, v1 - v0, base, kind)
    B(BLOCK.u0, BLOCK.v0, BLOCK.u1, BLOCK.v1, "#6c5466", 4)
    B(0.07, 0.07, 0.28, 0.46, "#5b6f80", 1)
    B(0.07, 0.5, 0.28, 0.93, "#4f6576", 1)
    for (let i = 0; i < 4; i++) B(0.49 + (i % 2) * 0.12, 0.52 + Math.floor(i / 2) * 0.21, 0.6 + (i % 2) * 0.12, 0.72 + Math.floor(i / 2) * 0.21, "#7a5a62", 2)
    B(0.74, 0.5, 0.93, 0.93, "#5f4a5c", 3)
    B(0.3, 0.07, 0.62, 0.45, "#634a5c", 3)
    B(0.64, 0.07, 0.93, 0.46, "#6f6052", 5)
    B(0.3, 0.68, 0.47, 0.93, "#6a5868", 4)
    // power straps of the top metal, faint across everything
    c.fillStyle = "rgba(220,170,120,0.08)"
    for (let i = 0; i < 90; i++) c.fillRect(0, (i / 90) * h, w, h * 0.004)
    // seal ring, then a ring of bond pads, each with its trace inward
    const inset = 0.012
    c.strokeStyle = "#c9b8a4"
    c.lineWidth = 5
    c.strokeRect(inset * 0.4 * w, inset * 0.4 * h, w * (1 - inset * 0.8), h * (1 - inset * 0.8))
    c.lineWidth = 2
    c.strokeRect(inset * 0.7 * w, inset * 0.7 * h, w * (1 - inset * 1.4), h * (1 - inset * 1.4))
    const pad = 0.018
    const ringPads = (n: number, horiz: boolean, at: number) => {
      for (let i = 0; i < n; i++) {
        const f = 0.06 + (0.88 * (i + 0.5)) / n
        const px = horiz ? f * w : at * w
        const py = horiz ? at * h : f * h
        const s = pad * w
        c.fillStyle = "#d8d2c6"
        c.fillRect(px - s / 2, py - s / 2, s, s)
        c.fillStyle = "rgba(60,50,60,0.9)"
        c.fillRect(px - s * 0.32, py - s * 0.32, s * 0.64, s * 0.64)
        c.fillStyle = "#b9b1a5"
        c.fillRect(px - s * 0.24, py - s * 0.24, s * 0.48, s * 0.48)
      }
    }
    ringPads(46, true, 0.035)
    ringPads(46, true, 0.965)
    ringPads(36, false, 0.03)
    ringPads(36, false, 0.97)
  })
  dieTex.wrapS = dieTex.wrapT = THREE.ClampToEdgeWrapping

  // ---------------------------------------------------------------- the world rule of beat 0

  /** The panel's light on a surface: soft diffuse, and a mirror image of the panel (a rectangle in the sky) for glossy things. */
  const panelLit = (N: V3, V: V3, base: V3, gloss: Num, rough: Num): V3 => {
    const L = U.panel as unknown as V3
    const dif = max(dot(N, L), 0).mul(0.9).add(0.12)
    const R = V.negate().sub(N.mul(dot(V.negate(), N).mul(2))) as V3
    // the panel: a soft-edged rectangle round its direction, wider as the surface gets rougher
    const ax = vec3(L.z, 0, L.x.negate()).normalize()
    const ay = L.cross(ax)
    const a = dot(R, ax).div(max(dot(R, L), 0.05))
    const b = dot(R, ay).div(max(dot(R, L), 0.05))
    const wid = fl(rough).mul(0.3).add(0.09)
    const box = ss(wid, wid.mul(0.45), abs(a) as F).mul(ss(0.75, 0.5, abs(b) as F)).mul(step(0, dot(R, L)))
    const fres = pow(float(1).sub(max(dot(N, V), 0)), 5).mul(0.6).add(0.4)
    return base.mul(dif).add(vec3(1.0, 1.0, 1.02).mul(box).mul(fl(gloss)).mul(fres).mul(1.7)).add(vec3(0.02, 0.022, 0.03).mul(fl(gloss))) as V3
  }
  /** Interference colour of a transparent film of thickness d (nm) seen at cos theta = c. */
  const film = (d: F, c: F): V3 => {
    const ct = sqrt(float(1).sub(float(1).sub(c.mul(c)).div(2.13))) // in oxide, n = 1.46
    const ph = d.mul(ct).mul(2 * 1.46 * 2 * Math.PI)
    return vec3(cos(ph.div(640)), cos(ph.div(540)), cos(ph.div(455))).mul(0.5).add(0.5) as V3
  }

  // ---------------------------------------------------------------- the ground: wafer, die, cells, the transistors' plan

  const groundMat = new THREE.NodeMaterial()
  groundMat.fragmentNode = Fn(() => {
    const q = positionLocal.xy.toVar() // real nm, from the target
    const fp = max(length(fwidth(q)), 1e-4).toVar() // nm per pixel here
    const V = normalize(cameraPosition.sub(positionWorld)).toVar()
    const N = vec3(0, 0, 1)
    const wp = q.sub(vec2(WC[0], WC[1])).toVar()
    const r = length(wp).toVar()
    const notch = abs(wp.x).lessThan(wp.y.negate().sub(R_WAF - 1.1e6))
    const onW = ss(fp.mul(1.5).add(R_WAF), fp.mul(-1.5).add(R_WAF), r).mul(select(notch, float(0), float(1))).toVar()
    // velvet under it
    const velvet = vec3(0.006, 0.006, 0.008).mul(vnoise(q.div(2.5e5)).mul(0.4).add(0.8))
    // the dies: a stepped grid, scribe lanes between, nothing printed past the exclusion ring
    const g = q.sub(vec2(DO[0], DO[1])).div(vec2(DIE[0], DIE[1])).toVar()
    const gi = floor(g).toVar()
    const gu = fract(g).toVar()
    const su = float(SCRIBE / DIE[0]), sv = float(SCRIBE / DIE[1])
    const inDie = ss(su, su.add(fp.div(DIE[0])), gu.x).mul(ss(su, su.add(fp.div(DIE[0])), gu.x.oneMinus())).mul(ss(sv, sv.add(fp.div(DIE[1])), gu.y)).mul(ss(sv, sv.add(fp.div(DIE[1])), gu.y.oneMinus())).toVar()
    const printed = ss(R_EXCL, fp.mul(2).max(2e5).negate().add(R_EXCL), r).toVar()
    const duv = gu.sub(vec2(su, sv)).div(vec2(su, sv).mul(-2).add(1)).toVar()
    const die0 = texture(dieTex, duv).rgb
    const die = mixN(vec3(dot(die0, vec3(0.3, 0.5, 0.2))), die0, 0.55).toVar()
    // the logic block, at the cells' scale: rows, rails, cell edges, then the transistors' plan
    const X = q.x.add(TX).toVar()
    const Y = q.y.add(TY).toVar()
    const inBlock = gi.x.equal(0).and(gi.y.equal(0)).and(duv.x.greaterThan(BLOCK.u0)).and(duv.x.lessThan(BLOCK.u1)).and(duv.y.greaterThan(BLOCK.v0)).and(duv.y.lessThan(BLOCK.v1))
    const cellsK = ss(5, 12, float(CH).div(fp)).mul(select(inBlock, float(1), float(0))).toVar()
    const ri = floor(Y.div(CH)).toVar()
    const ly = fract(Y.div(CH)).mul(6).toVar() // in fin slots
    const flip = mod(ri, 2)
    const sl = mixN(ly, float(6).sub(ly), flip).toVar() // slot coordinate, 0 at the VSS rail
    const gx = X.div(CPP).toVar()
    const gI = floor(gx).toVar()
    const segI = floor(gI.div(6))
    const kB = floor(hhN(ri, segI).mul(4)).add(1)
    const gm = mod(gI, 6)
    const bound = gm.equal(0).or(gm.equal(kB)).toVar()
    const gf = fract(gx).sub(0.5).mul(CPP).toVar() // nm from this gate's centre
    const nBand = ss(0.9, 1.0, sl).mul(ss(3.1, 3.0, sl)).toVar()
    const pBand = ss(3.0, 3.1, sl).mul(ss(5.1, 5.0, sl)).toVar()
    // cells: n and p active areas, rails, cell boundaries, a tint per cell
    const cellTint = hhN(ri.add(3), segI.mul(2).add(select(gm.greaterThanEqual(kB), float(1), float(0))))
    const cellCol = vec3(0.16, 0.12, 0.17).mul(cellTint.mul(0.4).add(0.8)).toVar()
    cellCol.addAssign(vec3(0.06, 0.08, 0.1).mul(nBand).add(vec3(0.1, 0.06, 0.08).mul(pBand)))
    const rail = ss(0.45, 0.25, abs(ly.sub(0.0)) as F).max(ss(5.55, 5.75, ly)).mul(ss(2, 6, float(20).div(fp)))
    cellCol.assign(mixN(cellCol, vec3(0.62, 0.42, 0.3), rail.mul(0.8)))
    const edge = select(bound, float(1), float(0)).mul(ss(GATE_L * 0.9, GATE_L * 0.5, abs(gf) as F)).mul(ss(1, 4, float(CPP).div(fp)))
    cellCol.mulAssign(float(1).sub(edge.mul(0.55)))
    // the transistors' plan: fins along x, gates across them
    const planK = ss(3.5, 9, float(CPP).div(fp)).toVar()
    const flatK = float(1).sub(U.boxOn.mul(ss(1700, 1300, length(q)))).toVar()
    const slotF = fract(sl).sub(0.5).mul(FPITCH)
    const finOn = ss(3, 2, abs(slotF) as F).mul(nBand.add(pBand)).mul(select(bound, ss(14, 18, abs(gf) as F), float(1)))
    const gateOn = ss(GATE_L / 2 + 1, GATE_L / 2 - 1, abs(gf) as F).mul(ss(0.3, 0.6, sl).mul(ss(5.7, 5.4, sl)))
    const plan = vec3(0.03, 0.035, 0.05).toVar()
    plan.assign(mixN(plan, vec3(0.32, 0.33, 0.38), finOn.mul(ss(1, 2.5, float(6).div(fp))).mul(flatK)))
    plan.assign(mixN(plan, vec3(0.5, 0.38, 0.2), gateOn.mul(flatK)))
    const local = mixN(cellCol, plan, planK).toVar()
    const dieC = mixN(die, local, cellsK).toVar()
    // wafer surface: the printed die or bare oxide, with its film colour, and the mirror of the panel
    const th = float(560).add(r.div(R_WAF).pow(2).mul(160)).add(vnoise(wp.div(9e6)).mul(60)).toVar()
    const tint = film(th, max(dot(N, V), 0.05) as F).toVar()
    const bare = vec3(0.16, 0.17, 0.2).mul(tint.mul(0.9).add(0.25))
    const surf = mixN(bare, dieC.mul(tint.mul(0.25).add(0.8)), inDie.mul(printed)).toVar()
    const gloss = float(1).sub(cellsK.mul(0.85)).mul(0.62)
    const lit = panelLit(N as unknown as V3, V as V3, surf as V3, gloss, float(0.08)).toVar()
    lit.mulAssign(mixN(vec3(1), tint.mul(0.55).add(0.6), gloss.mul(0.6)))
    // the bevelled edge of the wafer catches the panel
    const bevel = ss(fp.mul(-2).add(R_WAF - 3e5), fp.negate().add(R_WAF), r).mul(onW)
    lit.addAssign(vec3(0.7, 0.72, 0.8).mul(bevel).mul(0.6))
    const col = mixN(velvet, lit, onW).toVar()
    // far away it all goes to the dark
    const far = exp(length(positionWorld.xy).mul(-0.06))
    return vec4(col.mul(far), 1)
  })()
  const ground = new THREE.Mesh(logPlane(200, 1.2e9, 1.3), groundMat)
  ground.frustumCulled = false
  ground.renderOrder = 0
  chipG.add(ground)

  // ---------------------------------------------------------------- the copper stack

  const layerGeo = logPlane(10, 2.4e7, 1.3)
  const layers = METAL.map((L, k) => {
    const up = k > 0 ? METAL[k - 1].P : L.P * 5
    const u = { fade: uniform(0) }
    const m = new THREE.NodeMaterial()
    m.transparent = true
    m.depthWrite = true
    m.fragmentNode = Fn(() => {
      const q = positionLocal.xy.toVar()
      const fp = max(length(fwidth(q)), 1e-4).toVar()
      // only over the target die
      const gd = q.sub(vec2(DO[0], DO[1])).div(vec2(DIE[0], DIE[1]))
      Discard(gd.x.lessThan(0).or(gd.x.greaterThan(1)).or(gd.y.lessThan(0)).or(gd.y.greaterThan(1)))
      const off = k * 1777.7
      const ac0 = (L.d === 0 ? q.y.add(TY) : q.x.add(TX)).add(off).toVar() // across the lines
      const al0 = (L.d === 0 ? q.x.add(TX) : q.y.add(TY)).toVar() // along them
      const P = float(L.P), hw = float((L.P * L.wf) / 2)
      const present = (n: F, al: F): F => {
        if (!L.seg) return float(1) as F
        const Lc = float(L.P * L.seg)
        const a = al.add(n.mul(L.P * 3.7)).div(Lc)
        const m2 = floor(a)
        const uu = fract(a)
        const gapA = hhN(m2, n.add(7)).mul(0.08).add(0.03)
        const gapB = hhN(n, m2.add(3)).mul(0.08).add(0.03)
        return step(0.2, hhN(n, m2)).mul(step(gapA, uu)).mul(step(uu, gapB.oneMinus())) as F
      }
      const nT = floor(ac0.div(P)).toVar()
      const dc = ac0.sub(nT.add(0.5).mul(P)).toVar()
      const onTop = step(abs(dc), hw).mul(present(nT, al0)).toVar()
      // side walls: follow the ray down through the layer's thickness to the next line it meets
      const rd = normalize(positionWorld.sub(cameraPosition)).toVar()
      const ra = (L.d === 0 ? rd.y : rd.x).toVar()
      const rl = (L.d === 0 ? rd.x : rd.y).toVar()
      const tB = float(L.T).div(max(rd.z.negate(), 0.02)).toVar()
      const c1 = ac0.add(ra.mul(tB)).toVar()
      const dir = select(ra.greaterThan(0), float(1), float(-1)).toVar()
      const n1 = select(ra.greaterThan(0), floor(ac0.sub(P.mul(0.5)).add(hw).div(P)).add(1), floor(ac0.sub(P.mul(0.5)).sub(hw).div(P))).toVar()
      const e = n1.mul(P).add(P.mul(0.5)).sub(hw.mul(dir)).toVar()
      const f = e.sub(ac0).div(c1.sub(ac0)).toVar()
      const wallHit = step(0, f).mul(step(f, 1)).mul(present(n1, al0.add(rl.mul(tB).mul(f)))).mul(onTop.oneMinus()).toVar()
      const vis = ss(2.2, 6, P.div(fp)).mul(u.fade).toVar()
      Discard(onTop.add(wallHit).lessThan(0.5).or(vis.lessThan(0.004)))
      const V = rd.negate()
      // copper: warm, a little rough, the bevel of each line catching the light
      const grain = vnoise(vec2(al0.div(P.mul(0.6)), ac0.div(P.mul(0.12)))).toVar()
      const cu = vec3(0.86, 0.44, 0.26).mul(grain.mul(0.25).add(0.8)).toVar()
      const bev = ss(0.72, 0.98, abs(dc).div(hw)).mul(onTop)
      const nTop = normalize(vec3(L.d === 0 ? float(0) : dc.div(hw).mul(bev).mul(0.8), L.d === 0 ? dc.div(hw).mul(bev).mul(0.8) : float(0), 1))
      const nWall = vec3(L.d === 0 ? float(0) : dir.negate(), L.d === 0 ? dir.negate() : float(0), 0)
      const Nn = select(onTop.greaterThan(0.5), nTop, nWall).toVar()
      // vias: where the layer above comes down onto this one
      const vi = floor(al0.div(up)).toVar()
      const vl = fract(al0.div(up)).sub(0.5).mul(up)
      const via = step(hhN(nT.add(5), vi), 0.16).mul(step(abs(vl), hw.mul(0.9))).mul(onTop).mul(ss(2, 4, hw.mul(2).div(fp)))
      cu.assign(mixN(cu, vec3(0.62, 0.6, 0.62), via.mul(0.7)))
      const lit = panelLit(Nn as V3, V as V3, cu as V3, float(0.85).sub(via.mul(0.3)), float(0.25)).toVar()
      const shade = select(onTop.greaterThan(0.5), float(1), f.mul(0.7).add(0.3).mul(0.55))
      return vec4(lit.mul(shade).mul(cu.mul(0.9).add(0.25)), vis)
    })()
    const mesh = new THREE.Mesh(layerGeo, m)
    mesh.position.z = L.z + L.T
    mesh.frustumCulled = false
    mesh.renderOrder = 10 - k
    chipG.add(mesh)
    return { mesh, u, L }
  })

  // ---------------------------------------------------------------- one transistor and its neighbours, in 3D

  type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; hot: number }
  const parts: Record<"fin" | "gate" | "oxide" | "spacer" | "epiN" | "epiP" | "contact", Box[]> = { fin: [], gate: [], oxide: [], spacer: [], epiN: [], epiP: [], contact: [] }
  {
    const RR = 1700
    const gA = G0 - Math.ceil(RR / CPP), gB = G0 + Math.ceil(RR / CPP)
    const rA = R0 - Math.ceil(RR / CH), rB = R0 + Math.ceil(RR / CH)
    const isBound = (r: number, g: number) => {
      const gm = ((g % 6) + 6) % 6
      return gm === 0 || gm === 1 + Math.floor(hhJ(r, Math.floor(g / 6)) * 4)
    }
    const gxC = (g: number) => (g + 0.5) * CPP - TX
    for (let r = rA; r <= rB; r++) {
      const flip = r % 2
      const slotY = (sl: number) => r * CH + (flip ? 6 - sl : sl) * FPITCH - TY // sl = slot centre in slot units
      // fins: between boundary gates
      for (const sl of [1.5, 2.5, 3.5, 4.5]) {
        let start = gA
        for (let g = gA + 1; g <= gB; g++)
          if (isBound(r, g) || g === gB) {
            const x0 = gxC(start) + (isBound(r, start) ? 15 : 0), x1 = gxC(g) - (isBound(r, g) ? 15 : 0)
            if (x1 > x0) parts.fin.push({ x: (x0 + x1) / 2, y: slotY(sl), z: FIN_H / 2 - 4, sx: x1 - x0, sy: 6, sz: FIN_H + 8, hot: r === R0 && sl < 3 ? 1 : 0 })
            start = g
          }
      }
      for (let g = gA; g <= gB; g++) {
        const x = gxC(g)
        const hot = r === R0 && g === G0 ? 1 : 0
        // a cutaway: the rows on the lens's side of ours keep only their fins, standing bare out of the trench oxide
        if (r < R0) continue
        // the high-k gate dielectric, a skin between the gate and the fins it wraps
        parts.oxide.push({ x, y: r * CH + CH / 2 - TY, z: (FIN_H + 3) / 2, sx: GATE_L + 2.2, sy: CH - 21, sz: FIN_H + 3, hot: 0 })
        parts.gate.push({ x, y: r * CH + CH / 2 - TY, z: GATE_H / 2, sx: GATE_L, sy: CH - 22, sz: GATE_H, hot })
        for (const s of [-1, 1]) parts.spacer.push({ x: x + s * (GATE_L / 2 + SPACER / 2), y: r * CH + CH / 2 - TY, z: GATE_H / 2 - 2, sx: SPACER, sy: CH - 22, sz: GATE_H - 4, hot: 0 })
        if (g < gB) {
          const xm = x + CPP / 2
          // source, drain and contacts only in the cell we land on: elsewhere the fins stand bare (a cutaway)
          if (r === R0 && Math.abs(g - G0) <= 3) for (const band of [0, 1]) {
            const yc = slotY(band ? 4 : 2)
            const sd = r === R0 && band === 0 && (g === G0 || g === G0 - 1) ? 1 : 0
            ;(band ? parts.epiP : parts.epiN).push({ x: xm, y: yc, z: 34, sx: CPP - GATE_L - 2 * SPACER - 3, sy: 42, sz: 44, hot: sd })
            if (hhJ(r * 3 + band, g + 17) < 0.22 || sd) parts.contact.push({ x: xm, y: yc + (band ? -4 : 4), z: 66, sx: 12, sy: 36, sz: 36, hot: 0 })
          }
        }
        if (hot) parts.contact.push({ x, y: r * CH + CH / 2 - TY, z: GATE_H + 14, sx: 13, sy: 13, sz: 28, hot: 0 })
      }
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  // the epitaxial source/drain: a diamond in section, faceted along the fin
  const diaGeo = (() => {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 4, 1)
    g.rotateZ(Math.PI / 2) // axis along x, a square section turned 45 degrees: a diamond
    return g
  })()
  const boxMat = (base: [number, number, number], o: { metal?: number; hot?: [number, number, number]; flow?: boolean; film?: number } = {}) => {
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const N = normalize(normalWorld).toVar()
      const V = normalize(cameraPosition.sub(positionWorld)).toVar()
      const hot = attribute("aHot", "float").toVar()
      const P = positionWorld.mul(U.h).toVar() // real nm, from the target
      const grain = vnoise(P.xy.mul(0.35).add(P.z.mul(0.2))).toVar()
      const base3 = vec3(base[0], base[1], base[2]).mul(grain.mul(0.18).add(0.88)).toVar()
      if (o.film) base3.mulAssign(film(float(o.film).add(grain.mul(30)), max(dot(N, V), 0.1) as F).mul(0.5).add(0.6))
      const lit = panelLit(N as V3, V as V3, base3 as V3, float(o.metal ?? 0.2), float(0.35)).toVar()
      // a little ambient occlusion toward the trench floor
      lit.mulAssign(ss(-5, 45, P.z).mul(0.55).add(0.45))
      if (o.hot) {
        const hc = vec3(o.hot[0], o.hot[1], o.hot[2])
        lit.addAssign(hc.mul(hot).mul(U.on).mul(0.7))
        if (o.flow) {
          // electrons drifting source to drain: dots moving along the fin, in the channel only once the gate is on
          const s = P.x.div(9).sub(U.flow.mul(5.5)).toVar()
          const lane = floor(P.z.div(9)).add(floor(P.y))
          const dotv = ss(0.36, 0.0, abs(fract(s.add(hash21(vec2(floor(s), lane)).mul(0.6))).sub(0.5)) as F)
          lit.addAssign(vec3(0.55, 1.0, 0.7).mul(dotv).mul(hot).mul(U.on).mul(1.6))
        }
      }
      return vec4(lit, 1)
    })()
    return m
  }
  const inst = (list: Box[], geo: THREE.BufferGeometry, mat: THREE.NodeMaterial) => {
    const g = geo.clone()
    const hot = new Float32Array(list.length)
    list.forEach((b, i) => (hot[i] = b.hot))
    g.setAttribute("aHot", new THREE.InstancedBufferAttribute(hot, 1))
    const im = new THREE.InstancedMesh(g, mat, list.length)
    const o = new THREE.Object3D()
    list.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z)
      o.scale.set(b.sx, b.sy, b.sz)
      o.updateMatrix()
      im.setMatrixAt(i, o.matrix)
    })
    im.frustumCulled = false
    chipG.add(im)
    return im
  }
  const boxes = [
    inst(parts.fin, boxGeo, boxMat([0.62, 0.68, 0.82], { metal: 0.9, hot: [0.05, 0.18, 0.1], flow: true })),
    inst(parts.gate, boxGeo, boxMat([0.62, 0.42, 0.14], { metal: 0.8, hot: [0.35, 1.0, 0.55] })),
    inst(parts.spacer, boxGeo, boxMat([0.36, 0.38, 0.42], { metal: 0.1 })),
    inst(parts.oxide, boxGeo, boxMat([0.12, 0.55, 0.62], { metal: 0.5 })),
    inst(parts.epiN, diaGeo, boxMat([0.36, 0.4, 0.46], { metal: 0.45, hot: [0.06, 0.2, 0.12] })),
    inst(parts.epiP, diaGeo, boxMat([0.46, 0.36, 0.44], { metal: 0.45 })),
    inst(parts.contact, boxGeo, boxMat([0.6, 0.6, 0.64], { metal: 0.8 })),
  ]

  // ---------------------------------------------------------------- beat 1: the fibre and the cable

  /**
   * Beat 1's world rule: the one lamp (its cone, inverse-square falloff and the sea's blue-green
   * absorption out and back) on the floor; inside the glass (sea = 0) a weak flat key and a depth
   * falloff to a cool dark instead. `along` gives a brushed, anisotropic highlight running that way.
   */
  const seaLight = (Wp: V3, N: V3, base: V3, spec: Num, shin: number, along?: V3): V3 => {
    const V = normalize(cameraPosition.sub(Wp))
    const L = normalize(U.lamp.sub(Wp))
    const dCam = length(Wp.sub(cameraPosition))
    const dReal = dCam.mul(U.S)
    const dL = length(Wp.sub(U.lamp)).mul(U.S)
    const cone = ss(0.8, 0.975, dot(L.negate(), U.lampDir) as F).mul(0.97).add(0.03)
    const fall = exp(dReal.add(dL).mul(-0.42)).mul(float(2.3).div(dL.mul(dL).mul(4).add(1))).mul(cone)
    const k = mixN(U.inner, fall, U.sea)
    const ndl = max(dot(N, L), 0)
    const Hh = normalize(L.add(V))
    let sp: F
    if (along) {
      const th = dot(along, Hh)
      sp = pow(max(float(1).sub(th.mul(th)), 0), shin).mul(ndl) as F
    } else sp = pow(max(dot(N, Hh), 0), shin).mul(ndl) as F
    const c = base.mul(ndl.mul(0.92).add(0.05)).add(vec3(1, 0.98, 0.95).mul(sp).mul(fl(spec))).mul(k).mul(mixN(vec3(1, 1, 1), vec3(0.6, 0.86, 0.92), U.sea))
    const fog = exp(dCam.mul(-0.2))
    return mixN(mixN(vec3(0.003, 0.01, 0.018), c, fog), c, U.sea) as V3
  }

  /** The bit train at real x (m): 1 where a lit bit is, shaped; packets of eight with a gap. */
  const train = (x: F): F => {
    const s = x.sub(U.bits).div(LBIT).toVar()
    const n = floor(s)
    const inPkt = step(mod(n, 11), 7.5)
    const v = step(0.38, hash21(vec2(n, 3.1)))
    const sh = ss(0.0, 0.25, fract(s)).mul(ss(1.0, 0.72, fract(s)))
    return v.mul(inPkt).mul(sh) as F
  }
  /** The same, smeared: the evanescent glow round a packet. */
  const trainSoft = (x: F): F => {
    const s = x.sub(U.bits).div(LBIT * 11).toVar()
    return ss(0.0, 0.1, fract(s)).mul(ss(0.78, 0.62, fract(s))) as F
  }
  const shellMat = (col: [number, number, number], o: { metal?: number; glass?: boolean; aniso?: boolean; gel?: boolean; bands?: number; shin?: number; scuff?: number } = {}) => {
    const u = { R0: uniform(1), R1: uniform(2), a0: uniform(0), a1: uniform(Math.PI * 2), cy: uniform(0), cz: uniform(0) }
    const m = new THREE.NodeMaterial()
    m.side = THREE.DoubleSide
    const aS = attribute("aS", "vec3")
    const ang = mixN(u.a0, u.a1, aS.x).toVar()
    const rad = mixN(u.R0, u.R1, aS.y)
    m.positionNode = vec3(positionLocal.x, cos(ang).mul(rad).add(u.cy), sin(ang).mul(rad).add(u.cz))
    // normals by hand: radial on the arcs, tangential on the cut faces
    const nArc = vec3(0, cos(ang), sin(ang)).mul(aS.y.mul(2).sub(1))
    const nCut = vec3(0, sin(ang), cos(ang).negate()).mul(aS.z)
    const nL = select(abs(aS.z).greaterThan(0.5), nCut, nArc)
    m.normalNode = nL
    const vN = nL.toVarying()
    const vA = ang.toVarying()
    const vCut = abs(aS.z).toVarying()
    if (o.glass) {
      // the cladding: clear silica, seen only at its boundaries
      m.transparent = true
      m.depthWrite = false
      m.blending = THREE.AdditiveBlending
      m.fragmentNode = Fn(() => {
        const N = normalize(vN).mul(faceDirection)
        const V = normalize(cameraPosition.sub(positionWorld))
        const rim = pow(float(1).sub(abs(dot(N, V))), 4)
        return vec4(vec3(0.3, 0.55, 0.6).mul(rim).mul(0.25).add(vec3(0.6, 0.9, 1.0).mul(vCut).mul(0.04)).mul(U.leak.mul(0.7).add(0.3)), 1)
      })()
      return { m, u }
    }
    m.fragmentNode = Fn(() => {
      const N = normalize(vN).mul(faceDirection).toVar()
      const P = positionWorld.mul(U.S).add(vec3(U.camS.x, 0, 0)).toVar() // real m
      const Wp = positionWorld.toVar()
      const grain = vnoise(vec2(P.x.div(u.R1.mul(60)), vA.mul(6))).toVar()
      const base = vec3(col[0], col[1], col[2]).mul(grain.mul(0.16).add(0.9)).toVar()
      if (o.bands) base.mulAssign(ss(0.4, 0.6, fract(P.x.div(o.bands)) as F).mul(0.06).add(0.97))
      if (o.scuff) base.mulAssign(vnoise(vec2(P.x.mul(400), vA.mul(90))).mul(o.scuff).add(1 - o.scuff * 0.5))
      // the inside of a shell: the steel tube is full of a clear, slightly amber gel that wets it
      const inside = faceDirection.lessThan(0)
      if (o.gel) base.assign(select(inside, vec3(0.42, 0.33, 0.16), base))
      const along = o.aniso ? (vec3(1, 0, 0) as V3) : undefined
      const lit = seaLight(Wp as V3, N as V3, base as V3, o.metal ?? 0.15, o.shin ?? 40, along).toVar()
      if (o.gel) lit.addAssign(select(inside, seaLight(Wp as V3, N as V3, vec3(0, 0, 0) as V3, 1.4, 120), vec3(0)))
      // the cut faces read as the material's thickness: a touch darker and matte
      lit.mulAssign(float(1).sub(vCut.mul(0.25)))
      // the light inside leaks green onto the inner walls, strongest beside a passing packet
      const near = trainSoft(P.x).mul(3.2).add(0.2)
      const leak = vec3(0.25, 0.7, 0.45).mul(U.leak).mul(exp(length(Wp.yz).mul(-0.25))).mul(0.3).mul(near)
      // inside the glass: draw striations round the wall, and the bore falls off into the dark both ways
      const insideK = U.sea.oneMinus()
      const stri = sin(vA.mul(380).add(vnoise(vec2(P.x.div(u.R1.mul(40)), vA.mul(20))).mul(6))).mul(0.12).add(1)
      const deep = exp(length(Wp.sub(cameraPosition)).mul(U.S).div(u.R1).mul(-0.09))
      const shade = mixN(float(1), stri.mul(deep.mul(0.85).add(0.15)), insideK)
      lit.mulAssign(mixN(float(1), float(0.55), insideK)) // inside, the packets' own light carries the walls
      return vec4(lit.add(leak.mul(base)).mul(shade), 1)
    })()
    return { m, u }
  }
  const xsFine = cableXs(6, 0.004)
  const shellG = shellGeo(xsFine, 48)
  type Shell = { mesh: THREE.Mesh; u: ReturnType<typeof shellMat>["u"]; r: [number, number]; c: [number, number]; cut: number }
  const shells: Shell[] = []
  const addShell = (r: [number, number], c: [number, number], col: [number, number, number], o: Parameters<typeof shellMat>[1], cut: number) => {
    const { m, u } = shellMat(col, o)
    u.R0.value = r[0]
    u.R1.value = r[1]
    u.cy.value = c[0]
    u.cz.value = c[1]
    const mesh = new THREE.Mesh(shellG, m)
    mesh.frustumCulled = false
    seaG.add(mesh)
    shells.push({ mesh, u, r, c, cut })
  }
  // the target fibre: cladding glass, its blue acrylate coating
  addShell([R_CORE, R_CLAD], [0, 0], [0, 0, 0], { glass: true }, 0.66)
  addShell([R_CLAD, R_COAT], [0, 0], [0.1, 0.24, 0.7], { metal: 0.35, shin: 24 }, 0.6)
  // stainless tube (gel inside), copper sheath, black polyethylene
  addShell([TUBE[0], TUBE[1]], CABLE_C, [0.55, 0.56, 0.6], { metal: 1.6, aniso: true, gel: true, shin: 60, scuff: 0.2 }, 0.62)
  addShell([COPPER[0], COPPER[1]], CABLE_C, [0.85, 0.44, 0.24], { metal: 1.3, aniso: true, shin: 30, scuff: 0.15 }, 0.5)
  addShell([JACKET[0], JACKET[1]], CABLE_C, [0.035, 0.036, 0.04], { metal: 0.45, shin: 14, bands: 0.5, scuff: 0.3 }, 0.38)
  // the core: a glass rod; its boundary with the cladding is a faint index step
  const rodG = rodGeo(cableXs(6, 0.01), 32)
  const rodPos = (R: number, cy: F | number, cz: F | number) => {
    const a = attribute("aT", "float").mul(Math.PI * 2)
    return vec3(positionLocal.x, cos(a).mul(R).add(fl(cy)), sin(a).mul(R).add(fl(cz)))
  }
  const glowMat = (R: number, k: number, edge: number) => {
    const m = new THREE.NodeMaterial()
    m.transparent = true
    m.depthWrite = false
    m.blending = THREE.AdditiveBlending
    m.positionNode = rodPos(R, 0, 0)
    m.fragmentNode = Fn(() => {
      const x = positionWorld.x.mul(U.S).add(U.camS.x).toVar()
      const V = normalize(cameraPosition.sub(positionWorld))
      const N = normalize(vec3(0, positionWorld.y, positionWorld.z))
      const f = abs(dot(N, V))
      const rim = pow(float(1).sub(f), 3)
      // edge: the index step itself (a thin bright line at the silhouette); k: the glow through the body
      const c = vec3(0.55, 0.95, 1.0).mul(rim).mul(edge).add(vec3(0.45, 1.0, 0.7).mul(pow(f, 2)).mul(trainSoft(x).mul(k)).add(vec3(0.5, 1.0, 0.75).mul(train(x)).mul(pow(f, 3)).mul(k * 0.6)))
      return vec4(c.mul(U.leak), 1)
    })()
    return m
  }
  const core = new THREE.Mesh(rodG, glowMat(R_CORE, 0.18, 0.35))
  core.frustumCulled = false
  seaG.add(core)
  const halo = new THREE.Mesh(rodG, glowMat(R_CORE * 2.6, 0.08, 0.0))
  halo.frustumCulled = false
  seaG.add(halo)
  // the guided light: a ribbon along the zigzag of total internal reflection, in the plane square to the lens
  const zig = (() => {
    const pts: number[] = []
    const side: number[] = []
    const x0 = -2e-3, x1 = 4e-3
    let k = Math.floor(x0 / BOUNCE)
    const idx: number[] = []
    let n = 0
    for (let x = k * BOUNCE; x <= x1; k++, x = k * BOUNCE) {
      const z = (k % 2 === 0 ? 1 : -1) * R_CORE * 0.96
      for (const s of [-1, 1]) {
        pts.push(x, 0, z)
        side.push(s)
      }
      if (n > 0) {
        const o = (n - 1) * 2
        idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3)
      }
      n++
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1))
    g.setIndex(idx)
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  })()
  const zigMat = new THREE.NodeMaterial()
  zigMat.transparent = true
  zigMat.depthWrite = false
  zigMat.blending = THREE.AdditiveBlending
  zigMat.side = THREE.DoubleSide
  const ZW = 0.32e-6
  zigMat.positionNode = positionLocal.add(vec3(0, 0, attribute("aSide", "float").mul(ZW)))
  const vSide = attribute("aSide", "float").toVarying()
  zigMat.fragmentNode = Fn(() => {
    const x = positionWorld.x.mul(U.S).add(U.camS.x).toVar()
    // a hot core with a soft skirt: the guided mode
    const prof = exp(vSide.mul(vSide).mul(-9)).add(exp(vSide.mul(vSide).mul(-1.6)).mul(0.25))
    const tr = train(x)
    const b = fract(x.div(BOUNCE).add(0.5)).sub(0.5).abs()
    const glint = exp(b.mul(b).mul(-9000)).mul(tr).mul(3)
    const c = vec3(0.7, 1.0, 0.85).mul(prof).mul(tr.mul(3.2).add(0.04).add(glint))
    return vec4(c.mul(U.leak), 1)
  })()
  const zigM = new THREE.Mesh(zig, zigMat)
  zigM.frustumCulled = false
  seaG.add(zigM)

  // billboard axes for sprites, from the camera, in world units
  const camRight = uniform(new THREE.Vector3(1, 0, 0)), camUp = uniform(new THREE.Vector3(0, 0, 1))
  const spriteGeo = (n: number, seed: number) => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const R = rng(seed)
    const a = new Float32Array(n * 4)
    for (let i = 0; i < n * 4; i++) a[i] = R()
    g.setAttribute("aR", new THREE.InstancedBufferAttribute(a, 4))
    g.instanceCount = n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    return g
  }
  // seeds and micro-bubbles in the cladding: fixed in the glass, so they stream past the chase
  const bubbleMat = new THREE.NodeMaterial()
  bubbleMat.transparent = true
  bubbleMat.depthWrite = false
  bubbleMat.blending = THREE.AdditiveBlending
  {
    const aR = attribute("aR", "vec4")
    const W = 360e-6
    const rel = mod(aR.x.mul(W).sub(U.camS.x), W).sub(W / 2)
    const r = mixN(float(R_CORE * 2.2), float(R_CLAD * 0.95), aR.y)
    const a = aR.z.mul(Math.PI * 2)
    const centre = vec3(rel, cos(a).mul(r), sin(a).mul(r)).div(U.S)
    const sz = aR.w.mul(aR.w).mul(0.9e-6).add(0.25e-6).div(U.S)
    bubbleMat.positionNode = centre.add(camRight.mul(positionLocal.x.mul(sz))).add(camUp.mul(positionLocal.y.mul(sz)))
    const vUv = positionGeometry.xy.toVarying()
    bubbleMat.fragmentNode = Fn(() => {
      const d = length(vUv)
      // a bubble is a bright ring with a dark heart and a pinpoint highlight
      const ring = ss(0.62, 0.82, d).mul(ss(1.0, 0.86, d))
      const hl = exp(length(vUv.sub(vec2(-0.3, 0.3))).mul(-14)).mul(0.8)
      const depth = exp(length(positionWorld.sub(cameraPosition)).mul(-0.25))
      return vec4(vec3(0.55, 0.85, 0.9).mul(ring.mul(0.5).add(hl)).mul(depth).mul(U.leak).mul(0.6), 1)
    })()
  }
  const bubbles = new THREE.Mesh(spriteGeo(260, 91), bubbleMat)
  bubbles.frustumCulled = false
  seaG.add(bubbles)

  // the other seven fibres; the strand wires
  const rodMat = (col: number, o: { metal?: number; shin?: number; spangle?: boolean; helix?: { R: number; lay: number; phase: number; r: number } } = {}) => {
    const m = new THREE.NodeMaterial()
    const c = new THREE.Color(col)
    const a = attribute("aT", "float").mul(Math.PI * 2)
    const u = { cut: uniform(-1), psi: uniform(0) }
    if (o.helix) {
      const hx = o.helix
      const th = positionLocal.x.mul((Math.PI * 2) / hx.lay).add(hx.phase).toVar()
      const cy = cos(th).mul(hx.R).add(CABLE_C[0]), cz = sin(th).mul(hx.R).add(CABLE_C[1])
      m.positionNode = vec3(positionLocal.x, cos(a).mul(hx.r).add(cy), sin(a).mul(hx.r).add(cz))
    }
    const vN = vec3(0, cos(a), sin(a)).toVarying()
    const vA = attribute("aT", "float").toVarying()
    m.fragmentNode = Fn(() => {
      const P = positionWorld.mul(U.S).add(vec3(U.camS.x, 0, 0))
      if (o.helix) {
        // the strand is cut away with the shells round it: only the wires on the far side remain
        const th = P.x.mul((Math.PI * 2) / o.helix.lay).add(o.helix.phase)
        Discard(cos(th.sub(u.psi)).greaterThan(u.cut))
      }
      const N = normalize(vN).toVar()
      const base = vec3(c.r, c.g, c.b).toVar()
      if (o.spangle) {
        // hot-dip galvanising: zinc spangle, flat crystals of slightly different sheen
        const cell = vnoise(vec2(P.x.mul(5200), vA.mul(26)))
        base.mulAssign(ss(0.3, 0.7, cell as F).mul(0.35).add(0.75))
      }
      // the lay angle tilts the highlight off the axis a little; close enough to run along x
      const lit = seaLight(positionWorld as V3, N as V3, base as V3, o.metal ?? 0.3, o.shin ?? 30, o.helix ? (vec3(1, 0, 0) as V3) : undefined)
      return vec4(lit, 1)
    })()
    return { m, u }
  }
  const fibreRods: THREE.Mesh[] = []
  for (let i = 1; i < 8; i++) {
    const a = Math.PI / 2 + (i / 8) * Math.PI * 2
    const { m } = rodMat(FIB_COL[i], { metal: 0.45, shin: 30 })
    m.positionNode = rodPos(R_COAT, CABLE_C[0] + Math.cos(a) * FIB_RING, CABLE_C[1] + Math.sin(a) * FIB_RING)
    const mesh = new THREE.Mesh(rodG, m)
    mesh.frustumCulled = false
    seaG.add(mesh)
    fibreRods.push(mesh)
  }
  const wireG = rodGeo(cableXs(6, 0.006), 14)
  const wireU: { cut: { value: number }; psi: { value: number } }[] = []
  WIRES.forEach((W, li) => {
    for (let i = 0; i < W.n; i++) {
      const { m, u } = rodMat(0xa3a6ab, { metal: 1.5, shin: 26, spangle: true, helix: { R: W.R, lay: W.lay, phase: (i / W.n) * Math.PI * 2 + li * 0.3, r: W.r } })
      const mesh = new THREE.Mesh(wireG, m)
      mesh.frustumCulled = false
      seaG.add(mesh)
      wireU.push(u)
    }
  })

  // ---------------------------------------------------------------- the abyssal plain

  // what lives here (placed in real metres on the floor): brittle stars, arms out; and the trail a
  // holothurian left, which has moved on out of the light
  const STARS: [number, number, number][] = [[0.24, -0.27, 0.4], [0.78, -0.5, 2.1], [1.08, 0.2, 4.0], [0.36, 0.74, 1.1], [1.34, -0.16, 5.3], [0.64, -0.14, 3.2]]
  const blobs = uniformArray(STARS.map(([x, y]) => new THREE.Vector4(x, y, 0.035, 0)), "vec4")
  /** The floor's height (m) at a real point: hummocks, current ripples, the holothurian's trail, a spiral feeding trace, burrows. */
  const floorH = (p: V2): F => {
    const hum = fbm(p.mul(3.1)).mul(0.006)
    const rip = sin(p.x.mul(0.45).add(p.y.mul(0.89)).mul(46).add(fbm(p.mul(2.2)).mul(5))).mul(0.0011)
    // the trail: two furrows where the tube feet pressed, a low ridge between, only behind the animal
    const ty = p.y.sub(sin(p.x.mul(2.4)).mul(0.12).add(sin(p.x.mul(6.1)).mul(0.05)).add(0.2))
    const behind = ss(-0.6, -0.3, p.x)
    const fur = exp(sqF(ty.sub(0.022).div(0.009) as F).negate()).add(exp(sqF(ty.add(0.022).div(0.009) as F).negate())).mul(-0.0022).add(exp(sqF(ty.div(0.011) as F).negate()).mul(0.0008)).mul(behind)
    // a spiral grazing trace
    const sp = p.sub(vec2(1.0, -0.38))
    const r = length(sp)
    const spiral = ss(0.75, 1.0, cos(r.mul(470).sub(atan(sp.y, sp.x))) as F).mul(ss(0.075, 0.05, r)).mul(-0.0009)
    // burrow openings with a little spoil heap round each
    const bv = vnoise(p.mul(9))
    const burrow = ss(0.86, 0.9, bv).mul(0.0018).sub(ss(0.93, 0.97, bv).mul(0.006))
    // a low berm where the cable settled in
    const cd = abs(p.y.sub(CABLE_C[0]))
    const berm = exp(sqF(cd.sub(0.012).div(0.008) as F).negate()).mul(0.0016)
    return hum.add(rip).add(fur).add(spiral).add(burrow).add(berm) as F
  }
  /** Soft shadow of a horizontal cylinder (axis along x at (cy, cz), radius R) between a floor point and the lamp: 0 lit, 1 in shadow. */
  const cylShadow = (P: V3, Lr: V3, cy: number, cz: number, R: number): F => {
    const a = vec2(P.y.sub(cy), P.z.sub(cz))
    const b = vec2(Lr.y.sub(cy), Lr.z.sub(cz))
    const ab = b.sub(a)
    const t = clampN(dot(a.negate(), ab).div(max(dot(ab, ab), 1e-9)), 0, 1)
    const d = length(a.add(ab.mul(t)))
    return ss(R * 1.6, R * 0.8, d as F)
  }
  const sedMat = new THREE.NodeMaterial()
  sedMat.fragmentNode = Fn(() => {
    const p = positionLocal.xy.toVar() // real m (seaG holds real metres; its offset is the chase)
    const h0 = floorH(p as V2).toVar()
    const e = 0.0025
    const hx = floorH(p.add(vec2(e, 0)) as V2)
    const hy = floorH(p.add(vec2(0, e)) as V2)
    const N = normalize(vec3(h0.sub(hx).div(e), h0.sub(hy).div(e), 1)).toVar()
    // pale calcareous ooze, grey-buff, a little darker in the hollows; phytodetritus in fluffy patches
    const tone = fbm(p.mul(13).add(4.4)).toVar()
    const base = vec3(0.6, 0.56, 0.48).mul(tone.mul(0.25).add(0.82)).mul(h0.mul(60).add(1)).toVar()
    const detritus = ss(0.62, 0.75, fbm(p.mul(5).add(1.7)) as F).mul(0.35)
    base.assign(mixN(base, vec3(0.46, 0.4, 0.3), detritus))
    // the ooze up close: broad mottling from bioturbation, foraminiferal sand in a fine speckle, and faecal
    // pellets (small dark ovoids) scattered over it
    base.mulAssign(fbm(p.mul(1.7).add(9.3)).sub(0.5).mul(0.3).add(1))
    base.mulAssign(vnoise(p.mul(900)).sub(0.5).mul(0.14).add(vnoise(p.mul(330).add(2.2)).sub(0.5).mul(0.1)).add(1))
    const pc = floor(p.div(0.006)).toVar()
    const ph = hash21(pc.add(31.7))
    const pq = fract(p.div(0.006)).sub(0.5).sub(vec2(hash21(pc.add(2.3)), hash21(pc.add(5.9))).sub(0.5).mul(0.5))
    const pa = ph.mul(6.28)
    const pr = vec2(pq.x.mul(cos(pa)).sub(pq.y.mul(sin(pa))), pq.x.mul(sin(pa)).add(pq.y.mul(cos(pa)))).mul(vec2(1, 2.4))
    const pellet = ss(0.2, 0.13, length(pr) as F).mul(step(0.86, ph))
    base.assign(mixN(base, vec3(0.3, 0.27, 0.22), pellet.mul(0.7)))
    // contact shadows under the animals
    const occ = float(0).toVar()
    for (let i = 0; i < STARS.length; i++) {
      const b = blobs.element(i) as unknown as V4
      occ.addAssign(ss(b.z.mul(1.1), b.z.mul(0.35), length(p.sub(b.xy)) as F).mul(0.55))
    }
    base.mulAssign(float(1).sub(clampN(occ, 0, 0.7)))
    // the real shadows of the cable and the housing in the lamp's light
    const Wp = positionWorld
    const P = vec3(p.x, p.y, float(SED_Z).add(h0))
    const Lr = U.lamp.mul(U.S).add(vec3(U.camS.x, 0, 0))
    const shCable = cylShadow(P as V3, Lr as V3, CABLE_C[0], CABLE_C[1], JACKET[1])
    const inRep = ss(REP_X + 0.4, REP_X + 0.6, p.x).mul(ss(REP_X + 2.1, REP_X + 1.9, p.x))
    const shRep = cylShadow(P as V3, Lr as V3, CABLE_C[0], CABLE_C[1], 0.16).mul(inRep)
    // the lamp's pool: a hot centre, the beam's soft edge, then the dark (on top of seaLight's inverse square)
    const Lf = normalize(U.lamp.sub(Wp))
    const pool = ss(0.88, 0.995, dot(Lf.negate(), U.lampDir) as F).mul(1.5).add(0.16).mul(mixN(float(1), float(0.85), vnoise(p.mul(0.9)) as F))
    const lit = seaLight(Wp as V3, N as V3, base as V3, 0.06, 12).mul(float(1).sub(max(shCable, shRep).mul(0.85))).mul(mixN(float(1), pool, U.sea))
    return vec4(lit, 1)
  })()
  const sed = new THREE.Mesh(logPlane(1e-3, 60, 1.3), sedMat)
  sed.frustumCulled = false
  sed.position.z = SED_Z
  seaG.add(sed)

  // manganese nodules, half sunk in the ooze
  const NOD = 70
  const nodGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 5)
    const pos = g.getAttribute("position")
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n = 0.12 * Math.sin(v.x * 5.1 + 1.3) * Math.sin(v.y * 4.3 + 0.2) + 0.08 * Math.sin(v.z * 9.7 + v.x * 3.1) + 0.05 * Math.sin(v.y * 17 + v.z * 13)
      v.multiplyScalar(1 + n)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  })()
  const nodMat = new THREE.NodeMaterial()
  nodMat.fragmentNode = Fn(() => {
    const N = normalize(normalWorld).toVar()
    const P = positionLocal
    // botryoidal: a crust of small knobs, dark brown-black, a dusting of ooze on top
    const knob = vnoise(P.xy.mul(9).add(P.z.mul(7))).toVar()
    const base = vec3(0.07, 0.05, 0.04).mul(knob.mul(0.5).add(0.75)).toVar()
    base.assign(mixN(base, vec3(0.45, 0.42, 0.36), ss(0.55, 0.9, N.z as F).mul(0.45)))
    return vec4(seaLight(positionWorld as V3, N as V3, base as V3, 0.4, 20), 1)
  })()
  const nodules = new THREE.InstancedMesh(nodGeo, nodMat, NOD)
  {
    const R = rng(55), o = new THREE.Object3D()
    let i = 0
    while (i < NOD) {
      const x = -0.4 + R() * 2.4, y = -0.95 + R() * 2.1
      if (Math.abs(y - CABLE_C[0]) < 0.06 || (x > REP_X - 0.1 && x < REP_X + 2.7 && Math.abs(y) < 0.25)) continue
      const s = 0.005 + R() ** 3 * 0.016
      o.position.set(x, y, SED_Z + s * 0.12)
      o.rotation.set(R() * 6, R() * 6, R() * 6)
      o.scale.set(s * (0.9 + R() * 0.4), s * (0.8 + R() * 0.4), s * 0.62)
      o.updateMatrix()
      nodules.setMatrixAt(i++, o.matrix)
    }
  }
  nodules.frustumCulled = false
  seaG.add(nodules)

  // the repeater: a pressure housing with a tapered coupling and a stack of bend restrictors each end,
  // furred with silt on top and colonised: sponges and hydroids, rust where a bolt weeps
  const repG = new THREE.Group()
  {
    const prof: [number, number][] = [[0, 0], [0.012, 0], [0.012, 0.18], [0.03, 0.2], [0.03, 0.24], [0.012, 0.26], [0.012, 0.42], [0.06, 0.48], [0.13, 0.62], [0.16, 0.64], [0.16, 1.92], [0.13, 1.94], [0.06, 2.08], [0.012, 2.14], [0.012, 2.3], [0.03, 2.32], [0.03, 2.36], [0.012, 2.38], [0.012, 2.56], [0, 2.56]]
    const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48)
    lg.rotateZ(-Math.PI / 2)
    const m = new THREE.NodeMaterial()
    m.fragmentNode = Fn(() => {
      const N = normalize(normalWorld).toVar()
      const P = positionLocal
      const silt = ss(0.15, 0.75, N.z as F).mul(fbm(P.xy.mul(30)).mul(0.6).add(0.4)).mul(1.15).toVar()
      const paint = vec3(0.06, 0.065, 0.075).mul(fbm(P.xz.mul(40)).mul(0.3).add(0.8))
      const base = mixN(paint, vec3(0.5, 0.47, 0.4), silt.mul(0.85)).toVar()
      // the surface as a sheet: along the axis (m) and round it (m of arc), and how high on the housing we are
      const th = atan(P.z, P.y)
      const rr = max(length(P.yz), 0.012)
      const uvS = vec2(P.x, th.mul(rr)).toVar()
      const up = P.z.div(rr) // 1 on top, -1 underneath
      // encrusting sponges: lobed crusts with irregular, digitate margins (a warped field, thresholded), a raised
      // rim that catches the lamp, oscula as dark pits, on the upper flanks where the silt is thin
      const wq = uvS.mul(5).add(vec2(fbm(uvS.mul(23).add(3.1)), fbm(uvS.mul(23).add(8.7))).sub(0.5).mul(0.9))
      const fS = fbm(wq).add(fbm(uvS.mul(70)).sub(0.5).mul(0.18)).toVar()
      const spongeK = ss(0.6, 0.63, fS as F).mul(ss(-0.5, 0.1, up as F)).mul(ss(1.0, 0.75, up as F)).toVar()
      const rim = ss(0.6, 0.625, fS as F).mul(ss(0.66, 0.63, fS as F))
      const pores = ss(0.82, 0.9, vnoise(uvS.mul(260)) as F).mul(0.5)
      const osc = ss(0.05, 0.0, length(fract(wq.mul(3.2)).sub(0.5)) as F).mul(ss(0.66, 0.7, fS as F))
      const spongeC = mixN(vec3(0.74, 0.66, 0.5), vec3(0.85, 0.62, 0.42), fbm(uvS.mul(4).add(2.2))).mul(float(1).sub(pores).sub(osc.mul(0.8))).add(rim.mul(0.12))
      // the crust's edge throws a thin shadow on the paint beside it
      base.mulAssign(float(1).sub(ss(0.52, 0.6, fS as F).mul(spongeK.oneMinus()).mul(0.45)))
      base.assign(mixN(base, spongeC, spongeK))
      // hydroids: feathery tufts in clusters on the top and the couplings, each a fan of fine stems off a stolon
      // (seen from a metre or two they are a fur: fine stems leaning one way with the current, in clumps that thin at their edges)
      const lean = vec2(P.x.add(th.mul(rr).mul(0.35)), th.mul(rr).sub(P.x.mul(0.2)))
      const fur = vnoise(lean.mul(vec2(520, 70))).mul(0.6).add(vnoise(lean.mul(vec2(1300, 140)).add(3.3)).mul(0.4))
      const clump = ss(0.55, 0.72, fbm(uvS.mul(7).add(9.1)) as F).mul(ss(0.0, 0.5, up as F)).mul(spongeK.oneMinus())
      const hyd = ss(0.45, 0.75, fur as F).mul(clump)
      base.assign(mixN(base, vec3(0.8, 0.79, 0.72), hyd.mul(0.6)))
      // rust: weeping from the bolts at the couplings and from a few pin holes, running down the flanks in streaks
      // that narrow and break as they go; a dark bloom at each source
      const cellX = floor(P.x.div(0.07)).toVar()
      const rh = hash21(vec2(cellX, 7.3)).toVar()
      const xc = cellX.add(hash21(vec2(cellX, 1.9)).mul(0.6).add(0.2)).mul(0.07)
      const flange = ss(0.12, 0.0, abs(P.x.sub(0.6)) as F).add(ss(0.12, 0.0, abs(P.x.sub(1.96)) as F))
      const live = step(float(0.55).sub(flange.mul(0.4)), rh)
      const hs = hash21(vec2(cellX, 5.5)).mul(0.5).add(0.2) // where it weeps from, as a height on the housing
      const below = hs.sub(up).toVar()
      const wid = float(0.004).add(below.mul(0.004))
      const wob = fbm(vec2(below.mul(6), cellX)).sub(0.5).mul(0.012)
      const runK = exp(sqF(P.x.sub(xc).add(wob).div(wid) as F).negate()).mul(step(0, below)).mul(exp(below.mul(-1.4))).mul(ss(0.3, 0.6, vnoise(vec2(below.mul(30), cellX.mul(3))) as F).mul(0.6).add(0.4))
      const bloom = exp(sqF(length(vec2(P.x.sub(xc), below.mul(rr))).div(0.012) as F).negate())
      const rust = clampN(runK.add(bloom).mul(live), 0, 1)
      base.assign(mixN(base, mixN(vec3(0.42, 0.2, 0.07), vec3(0.16, 0.07, 0.03), bloom.mul(live)), rust.mul(0.85)))
      const rings = ss(0.42, 0.5, abs(fract(P.x.mul(9)).sub(0.5)) as F).mul(0.3)
      // the crusts stand proud: lit on the lamp side of their margins, shadowed on the other (a bent normal)
      const Nb = normalize(N.add(vec3(0, 0, 1).mul(rim.mul(0.35))).add(vec3(0))).toVar()
      return vec4(seaLight(positionWorld as V3, Nb as V3, base.mul(float(1).sub(rings.mul(spongeK.oneMinus()))) as V3, float(0.5).mul(silt.oneMinus()).mul(spongeK.oneMinus()), 30), 1)
    })()
    const mesh = new THREE.Mesh(lg, m)
    mesh.frustumCulled = false
    repG.add(mesh)
    seaG.add(repG)
  }
  // marine snow: lit only in the lamp's cone, and brightest between the lens and the subject (backscatter)
  const SNOW = 1600
  const snowMat = new THREE.NodeMaterial()
  snowMat.transparent = true
  snowMat.depthWrite = false
  snowMat.blending = THREE.AdditiveBlending
  const uSnowO = uniform(new THREE.Vector3())
  {
    const aR = attribute("aR", "vec4")
    // a 2.4 m box round the lens, wrapped, sinking slowly and drifting: a pure function of time
    const box = vec3(2.4, 2.4, 1.2)
    const p0 = vec3(fract(aR.x.add(U.time.mul(0.006))), aR.y, fract(aR.z.sub(U.time.mul(0.01).mul(aR.w.add(0.5))))).mul(box)
    const rel = mod(p0.sub(uSnowO), box).sub(box.mul(0.5)).add(uSnowO)
    const centre = vec3(rel.x.sub(U.camS.x), rel.y, rel.z).div(U.S)
    const sz = aR.w.mul(aR.w).mul(0.003).add(0.0008).div(U.S)
    snowMat.positionNode = centre.add(camRight.mul(positionLocal.x.mul(sz))).add(camUp.mul(positionLocal.y.mul(sz)))
    const vUv = positionGeometry.xy.toVarying()
    snowMat.fragmentNode = Fn(() => {
      const d = length(vUv)
      const Wp = positionWorld
      const L = normalize(U.lamp.sub(Wp))
      const cone = ss(0.84, 0.985, dot(L.negate(), U.lampDir) as F)
      const dL = length(Wp.sub(U.lamp)).mul(U.S)
      const dC = length(Wp.sub(cameraPosition)).mul(U.S)
      const b = ss(1, 0.15, d as F).mul(cone).mul(float(1).div(dL.mul(dL).mul(6).add(1))).mul(exp(dC.mul(-0.8))).mul(0.6).mul(U.sea)
      return vec4(vec3(0.8, 0.95, 1.0).mul(b), 1)
    })()
  }
  const snow = new THREE.Mesh(spriteGeo(SNOW, 77), snowMat)
  snow.frustumCulled = false
  sea.add(snow)

  // ---- the animals, with the creature toolkit (its world is y up: drawn in their own scene through a turned lens)
  const fauna = new THREE.Scene()
  const camF = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 400)
  const qR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
  const lampF = uniform(new THREE.Vector3()), lampDirF = uniform(new THREE.Vector3(0, -1, 0))
  const faunaLights = (n: SkinNodes): Lights => {
    const Wp = n.vW
    const dL = length(Wp.sub(lampF)).mul(U.S)
    const dC = length(Wp.sub(cameraPosition)).mul(U.S)
    const L = normalize(lampF.sub(Wp))
    const cone = ss(0.8, 0.975, dot(L.negate(), lampDirF) as F).mul(0.97).add(0.03)
    const fall = exp(dC.add(dL).mul(-0.42)).mul(float(2.3).div(dL.mul(dL).mul(4).add(1))).mul(cone)
    const col = vec3(0.6, 0.86, 0.92).mul(fall)
    return { key: L as V3, keyCol: col as V3, sky: col.mul(0.04) as V3, bounce: vec3(0.55, 0.5, 0.42).mul(fall).mul(0.12) as V3 }
  }
  // a brittle star: a small disc, five long jointed arms with their vertebral segments, waving slowly
  const starSpec: CreatureSpec = {
    name: "brittle star",
    body: { spine: [[-0.008, 0.004, 0], [0.008, 0.004, 0]], sect: [{ at: 0, w: 0.005, up: 0.002 }, { at: 0.5, w: 0.009, up: 0.0035, dn: 0.003 }, { at: 1, w: 0.005, up: 0.002 }], rings: 16, sides: 24, bones: 2, caps: ["round", "round"] },
    parts: Array.from({ length: 5 }, (_, i): CreatureSpec["parts"][number] => {
      const a = (i / 5) * Math.PI * 2 + 0.3
      const c = Math.cos(a), sn = Math.sin(a)
      const wig = [0.004, -0.007, 0.006]
      const pts: [number, number, number][] = [0.022, 0.045, 0.07].map((d, k) => [c * d - sn * wig[k], -0.003, sn * d + c * wig[k]])
      return { name: "arm" + i, origin: [c * 0.007, 0.003, sn * 0.007], path: pts, sect: [{ at: 0, w: 0.0021, up: 0.0017 }, { at: 1, w: 0.0004, up: 0.0004 }], cap: "point", bones: 5, role: "arm", row: i, segments: { count: 30, depth: 0.14 }, rings: 60, sides: 8 }
    }),
    motions: [{ role: "arm", axis: "up", amp: 0.1, ampK: 0.04, rate: 0.3, clock: "time", lag: 0.21, tipLag: 0.17 }],
  }
  const starLook: Look = { base: 0xb6a089, belly: 0xd2c2ae, back: 0x9c8470, rough: 0.7, spec: 0.2, wrap: 0.3, mottle: 0.4, blotchSize: 0.01, occlude: 0.5 }
  const starAims = STARS.map(() => makeAim())
  const stars = makeHerd({ spec: starSpec, count: STARS.length, path: starAims[0], material: (n) => skinMaterial(n, faunaLights(n), starLook) })
  fauna.add(stars.group)
  const fauna0 = { S: 1, xc: 0, t: 0 }
  const fillStar = (i: number, d: Drive) => {
    d.path = starAims[i]
    d.dist = 0
    d.lane = 0
    d.rise = 0
    d.scale = (1 / fauna0.S) * (0.85 + 0.1 * (i % 3))
    d.time = fauna0.t
    d.seed = 11 + i
  }
  /** Sea world (z up) to the animals' world (y up). */
  const toF = (x: number, y: number, z: number, out: number[]) => {
    out[0] = x
    out[1] = z
    out[2] = -y
    return out
  }
  const fo: number[] = [0, 0, 0], fd: number[] = [0, 0, 0]
  const placeFauna = () => {
    const S = fauna0.S, xc = fauna0.xc
    STARS.forEach(([x, y, h], i) => starAims[i].set(toF((x - xc) / S, y / S, (SED_Z + 0.0005) / S, fo), toF(Math.cos(h), Math.sin(h), 0, fd)))
    stars.update(camF, fillStar)
  }
  placeFauna()

  // ---------------------------------------------------------------- the rule of ages: phosphor on dark glass

  const face = ruleFace()
  const ruleStyle: RuleStyle = { treatment: "phosphor", debug: ctx.debugLabels, fonts: { name: ctx.fonts.serif, mono: ctx.fonts.mono } }
  const ruleMat = new THREE.NodeMaterial()
  ruleMat.fragmentNode = Fn(() => {
    const st = (attribute("uv", "vec2") as unknown as V2).toVar()
    const cut = texture(face.tex, st).toVar()
    const on = cut.a.mul(attribute("face", "float")).toVar()
    const N = normalize(normalWorld)
    // smoked glass over a black ground: a faint reflection of the panel, the cuts glowing through
    const glass = vec3(0.012, 0.016, 0.015).add(vec3(0.05, 0.06, 0.06).mul(pow(max(N.z, 0), 3)))
    const scan = fract(st.y.mul(171 / 3)).sub(0.5).abs().mul(0.3).oneMinus()
    const lit = glass.add(cut.rgb.mul(on).mul(0.95).mul(scan))
    return vec4(ctx.debugLabels ? mixN(lit, cut.rgb, step(0.02, on)) : lit, 1)
  })()
  ruleMat.depthTest = false
  ruleMat.depthWrite = false
  const rule = new THREE.Mesh(ruleGeometry(), ruleMat)
  rule.renderOrder = 100
  rule.frustumCulled = false
  const ruleScene = new THREE.Scene()
  const ruleCam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 400)
  ruleScene.add(rule)

  // ---------------------------------------------------------------- targets and the finishing pass

  const stage = stageTarget(ctx)
  const out = ctx.target({})
  const D = { tT: uniformTexture(stage.texture), tilt: uniform(0), focus: uniform(0.45), whip: uniform(0), asp: uniform(16 / 9), shade: uniform(1) }
  // a tilt-shift blur (the macro's thin focal plane), a whip along x between the beats
  const fin = ctx.pass(({ uv }) => {
    const c0 = sampleRT(D.tT, uv).toVar()
    const r = D.tilt.mul(ss(0.12, 0.55, abs(uv.y.sub(D.focus)) as F)).add(D.whip).toVar()
    const acc = vec4(c0.rgb, 1).toVar()
    const n = 16
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 2.39996
      const rr = Math.sqrt((i + 0.5) / n)
      const o = vec2(float(Math.cos(a) * rr).mul(r.sub(D.whip).div(D.asp)).add(float((i / n - 0.5) * 2).mul(D.whip)), float(Math.sin(a) * rr).mul(r.sub(D.whip)))
      const t = sampleRT(D.tT, uv.add(o) as V2)
      acc.addAssign(vec4(t.rgb, 1).mul(select(r.greaterThan(0.0005), float(1), float(0))))
    }
    const col = acc.rgb.div(acc.a).toVar()
    // a soft shade behind the headline
    col.mulAssign(float(1).sub(D.shade.mul(ss(0.6, 0.0, length(uv.sub(vec2(0.2, 0.82)).mul(vec2(1.0, 2.0))) as F)).mul(0.55)))
    return vec4(col, 1)
  }, D)

  // ---------------------------------------------------------------- the story clock

  const lhAt = (t: number) => {
    let v = STOPS[0].lh, ti = STOPS[0].tilt, az = STOPS[0].az
    MOVES.forEach(([a, b], i) => {
      const k = E.io3(ramp(t, a, b))
      v += (STOPS[i + 1].lh - STOPS[i].lh) * k
      ti += (STOPS[i + 1].tilt - STOPS[i].tilt) * k
      az += (STOPS[i + 1].az - STOPS[i].az) * k
    })
    return [v, ti, az]
  }
  const st = { beat1: false, fauna: false, tilt: 0, focus: 0.45, whip: 0, station: 0 }
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3()
  const selBox = { x: 0, y: 0, w: 0, h: 0, ok: false }
  const corners = [new THREE.Vector3(), new THREE.Vector3()]

  function update(s: State) {
    const t0 = s.at(0), t1 = s.at(1)
    U.time.value = s.time
    st.beat1 = s.beat >= 1 && t1 > 0.16
    const asp = s.w / Math.max(1, s.h)
    cam.aspect = asp
    D.asp.value = asp
    if (!st.beat1) {
      // ---- the dive
      const tc = Math.max(t0, -1.4)
      const [lh0, tilt0, az0] = lhAt(tc)
      const drift = 0.03 * Math.sin(s.time * 0.37) + 0.02 * Math.sin(s.time * 0.71 + 1)
      let az = az0 + 0.035 * tc + drift
      let tilt = tilt0 + 0.02 * Math.sin(s.time * 0.53)
      // the last stop: an orbit round the gate as it switches, and on through the hold and the whip
      const tE = Math.max(0, tc - MOVES[4][1])
      az += 0.16 * tE
      tilt -= 0.04 * Math.min(1, tE)
      const lh = lh0 - 0.04 * Math.min(1.5, tE)
      const h = 10 ** lh
      const zl = 45 * smooth(4.4, 5.0, tc)
      U.h.value = h
      const hz = h
      const r = hz * Math.tan(tilt)
      U.camR.value.set(r * Math.cos(az), r * Math.sin(az), hz + zl * 0.2)
      chipG.scale.setScalar(1 / h)
      cam.position.copy(U.camR.value).divideScalar(h)
      cam.near = 0.02
      cam.far = 400
      cam.lookAt(0, 0, zl / h)
      // the subject sits right of centre: off the title column
      cam.filmOffset = mix(-5.5, -3.2, smooth(1.5, 3.5, tc))
      cam.updateProjectionMatrix()
      // the layers resolve and pass
      for (const Lr of layers) {
        const top = Lr.L.z + Lr.L.T
        const px = (Lr.L.P / (2 * h * Math.tan((FOV * Math.PI) / 360))) * 720
        Lr.u.fade.value = smooth(1.9, 3.4, h / top) * smooth(1.2, 3, px)
        Lr.mesh.visible = Lr.u.fade.value > 0.002
      }
      U.boxOn.value = smooth(4200, 1600, h)
      for (const b of boxes) b.visible = U.boxOn.value > 0.001
      // the switch
      U.on.value = smooth(T_ON, T_ON + 0.18, tc) * (0.85 + 0.15 * Math.sin(s.time * 13))
      U.flow.value = Math.max(0, tc - T_ON - 0.1)
      // tilt-shift: thin focus at the macro end of the dive, wide on the wafer
      st.tilt = 0.012 * smooth(6.8, 3.2, lh) + 0.004 + 0.008 * smooth(4.6, 5.0, tc)
      // rack focus: from the bare fins in the foreground to the gate as it switches
      st.focus = mix(0.42, 0.2, smooth(4.7, 4.95, tc)) + (0.5 - 0.2) * E.io3(ramp(tc, T_ON - 0.45, T_ON - 0.05)) * smooth(4.7, 4.95, tc)
      // the selection box round the switching transistor
      selBox.ok = false
      if (tc > T_ON - 0.1) {
        corners[0].set(-CPP * 1.05, -40, 0)
        corners[1].set(CPP * 1.05, 40, GATE_H + 30)
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        for (let i = 0; i < 8; i++) {
          vA.set(i & 1 ? corners[1].x : corners[0].x, i & 2 ? corners[1].y : corners[0].y, i & 4 ? corners[1].z : corners[0].z).divideScalar(h)
          vA.project(cam)
          const x = (vA.x * 0.5 + 0.5) * 1920, y = (0.5 - vA.y * 0.5) * 1080
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          y0 = Math.min(y0, y)
          y1 = Math.max(y1, y)
        }
        Object.assign(selBox, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, ok: true })
      }
      // the station we are at, for the name on the type layer
      st.station = MOVES.filter(([, b]) => tc >= b - 0.25).length
      if (s.live) {
        ctx.synth.bed("hum", 0.1 + 0.25 * smooth(8.6, 2.5, lh))
      }
      st.whip = s.beat >= 1 ? smooth(0, 0.16, t1) * 0.08 : 0
    } else {
      // ---- the fibre, then the cable, then the floor
      const tc = t1
      const chase = Math.min(tc, 2.2)
      const xc = VCAM * (chase - 0.2) + 0.0006 * smooth(1.8, 4.0, tc) + 0.42 * E.io2(ramp(tc, 3.6, 5.8))
      U.bits.value = VBIT * (tc - 0.2) - 30e-6 + (tc > 2.2 ? (VBIT - VCAM) * 0 : 0)
      const kS = E.io3(ramp(tc, 1.75, 4.0))
      const lS = mix(Math.log10(3.0e-5), Math.log10(0.62), kS) + 0.05 * smooth(4, 5.8, tc)
      const S = 10 ** lS
      U.S.value = S
      // the camera's direction: side-on in the glass, rising to look down along the cable on the floor
      const e = smooth(1.9, 4.2, tc)
      // mid pull-back the lens swings to look along the cable, so two cut shells recede together
      const along = smooth(2.0, 2.6, tc) * (1 - smooth(3.3, 4.0, tc))
      const dir = vA.set(mix(-0.18, -0.62, e) - 0.9 * along, mix(-1, -0.55, e), mix(0.12, 0.52, e) + 0.15 * along).normalize()
      // where we look: the target fibre, easing to the cable's axis and then ahead to the housing
      const look = vB.set(mix(0, 0.62, smooth(3.6, 5.8, tc)), CABLE_C[0] * smooth(2.6, 3.6, tc), CABLE_C[1] * smooth(2.6, 3.6, tc) + mix(0, 0.05, smooth(3.6, 5.8, tc)))
      U.camS.value.set(xc, 0, 0)
      // world = (real - (xc, 0, 0)) / S
      cam.position.set(dir.x * S, look.y + dir.y * S, look.z + dir.z * S).divideScalar(S)
      cam.position.x += look.x / S
      cam.near = 0.02
      cam.far = 4000
      cam.lookAt(look.x / S, look.y / S, look.z / S)
      cam.filmOffset = -2.5
      cam.updateProjectionMatrix()
      seaG.scale.setScalar(1 / S)
      seaG.position.set(-xc / S, 0, 0)
      sed.visible = S > 6e-4
      repG.visible = S > 0.01
      repG.position.set(REP_X, CABLE_C[0], CABLE_C[1])
      snow.visible = S > 0.02
      uSnowO.value.set(cam.position.x * S + xc, cam.position.y * S, cam.position.z * S)
      camRight.value.set(1, 0, 0).applyQuaternion(cam.quaternion)
      camUp.value.set(0, 1, 0).applyQuaternion(cam.quaternion)
      bubbles.visible = halo.visible = S < 5e-4
      nodules.visible = S > 0.015
      // the lamp rides above and left of the lens, in world units of the moment
      U.lamp.value.copy(cam.position).add(vC.set(-0.5, 0.3, 0.9))
      U.lampDir.value.set(look.x / S, look.y / S, look.z / S).sub(U.lamp.value).normalize()
      // the animals' lens and lamp: the same, turned into their y-up world
      st.fauna = S > 0.04
      if (st.fauna) {
        camF.position.copy(cam.position).applyQuaternion(qR)
        camF.quaternion.copy(qR).multiply(cam.quaternion)
        camF.fov = cam.fov
        camF.aspect = cam.aspect
        camF.near = cam.near
        camF.far = cam.far
        camF.filmOffset = cam.filmOffset
        camF.updateProjectionMatrix()
        camF.updateMatrixWorld()
        lampF.value.copy(U.lamp.value).applyQuaternion(qR)
        lampDirF.value.copy(U.lampDir.value).applyQuaternion(qR)
        fauna0.S = S
        fauna0.xc = xc
        fauna0.t = s.time
        placeFauna()
      }
      U.sea.value = smooth(-2.8, -1.2, lS)
      U.inner.value = 0.12 + 0.88 * smooth(-4.2, -3.2, lS)
      U.leak.value = 1 - 0.85 * smooth(-3.6, -2.6, lS)
      // cut each shell away on the lens's side while the lens is inside or near it
      const cyCam = cam.position.y * S, czCam = cam.position.z * S
      for (const sh of shells) {
        const dy = cyCam - sh.c[0], dz = czCam - sh.c[1]
        const dist = Math.hypot(dy, dz)
        const psi = Math.atan2(dz, dy)
        const k = (1 - smooth(sh.r[1] * 0.9, sh.r[1] * 3.2, dist)) * sh.cut * Math.PI
        sh.u.a0.value = psi + k
        sh.u.a1.value = psi + Math.PI * 2 - k
        sh.mesh.visible = sh.r[1] / S > 0.0015
      }
      {
        const dy = cyCam - CABLE_C[0], dz = czCam - CABLE_C[1]
        const psi = Math.atan2(dz, dy)
        const k = (1 - smooth(WIRES[1].R * 1.1, WIRES[1].R * 3.4, Math.hypot(dy, dz))) * 0.55 * Math.PI
        for (const u of wireU) {
          u.psi.value = psi
          u.cut.value = k > 0.001 ? Math.cos(k) : 2
        }
      }
      core.visible = zigM.visible = S < 3e-3
      for (const f of fibreRods) f.visible = S < 0.06 && S > 2e-5
      st.tilt = 0.009 * smooth(-1.5, -4.5, lS) + 0.002
      st.focus = 0.5
      st.whip = 0.08 * (1 - smooth(0.16, 0.42, tc))
      st.station = NAME1_S.filter((v) => S > v * 1.5).length - 1
      if (s.live) ctx.synth.bed("water", 0.45 * smooth(-2.6, -0.8, lS))
    }
    D.tilt.value = ctx.debugLabels ? 0 : st.tilt
    D.focus.value = st.focus
    D.whip.value = ctx.debugLabels ? 0 : st.whip
    D.shade.value = ctx.debugLabels ? 0 : 1
    face.update(ctx.def.id, ruleArrival(ctx.def.id, t0, START), ruleStyle)
  }

  // ---------------------------------------------------------------- sound

  const cues: Cue[] = [
    ...ruleCues(ctx.def.id, { start: START }),
    ...MOVES.map(([a]): Cue => ({ b: 0, at: a, s: "whoosh", o: { g: 0.16, f: 700, dur: 0.45 } })),
    ...MOVES.map(([, b], i): Cue => ({ b: 0, at: b - 0.05, s: "tick", o: { f: H(48 + i * 4), g: 0.5 }, pos: [0.3, 0, 0.2] })),
    ...MOVES.map(([, b], i): Cue => ({ b: 0, at: b - 0.05, s: "marimba", o: { f: H(12 + i * 2), g: 0.28 }, pos: [0.3, 0, 0.2] })),
    { b: 0, at: T_ON, s: "pluck", o: { f: H(24), g: 0.6 }, pos: [0.25, -0.1, 0] },
    { b: 0, at: T_ON + 0.02, s: "select", o: { g: 0.9 }, pos: [0.25, -0.1, 0] },
    { b: 0, at: T_ON + 0.1, s: "pad", o: { f: H(12), g: 0.25, dur: 1.2 } },
    { b: 1, at: 0.02, s: "whoosh", o: { g: 0.35, f: 1200, dur: 0.4 } },
    { b: 1, at: 1.8, s: "riser", o: { g: 0.2, dur: 1.4 } },
    { b: 1, at: 3.4, s: "rumble", o: { g: 0.35 } },
    { b: 1, at: 4.6, s: "thud", o: { f: H(3), g: 0.4 }, pos: [0.5, -0.3, 0.6] },
  ]
  // a glass ping each time the lead bit reflects off the cladding
  for (let k = 0; k < 40; k++) {
    const x = k * BOUNCE
    const t = (x + 30e-6) / VBIT + 0.2
    if (t > 0.3 && t < 2.0) cues.push({ b: 1, at: t, s: "glass", o: { f: H(40 + (k % 5) * 3), g: 0.3 }, pos: [0.1, 0, 0.2] })
  }

  // ---------------------------------------------------------------- type

  const TITLES: TitleOpts = { color: "#eef6f0", shadow: "rgba(0,0,0,0.75)", subs: [undefined, ctx.def.beats[1].sub?.replace("circuits. Cables", "circuits.\nCables")], delay: [ageCardClear(ctx.def.id, START) + 0.1, 0.45] }
  const HUD = { color: "#d8eee0", shadow: "rgba(0,0,0,0.7)" }
  const name = (g: Parameters<NonNullable<SceneInstance["type"]>>[0], names: string[], i: number, t: number, tIn: number, tOut: number) => {
    const typed = clamp((t - tIn) / 0.28)
    const del = clamp((t - tOut) / 0.16)
    const p = typed * (1 - del)
    if (p <= 0) return
    g.text(names[i], 1790, 420, { size: 30, font: "mono", align: "right", color: "#bff5cf", style: "type", by: "glyph", p, caret: p < 1, shadow: { color: "rgba(0,0,0,0.85)", blur: 18 } })
  }

  return {
    cues,
    update,
    warm: () => [
      { scene: chip, camera: cam, target: stage },
      { scene: ruleScene, camera: ruleCam, target: out },
      { scene: sea, camera: cam, target: stage },
      { scene: fauna, camera: camF, target: stage },
      { pass: fin, target: out },
    ],
    render() {
      const r = ctx.renderer
      r.setClearColor(st.beat1 ? 0x010407 : 0x000000, 1)
      r.setRenderTarget(stage)
      r.render(st.beat1 ? sea : chip, cam)
      if (st.beat1 && st.fauna) {
        r.autoClear = false
        r.render(fauna, camF)
        r.autoClear = true
      }
      D.tT.value = stage.texture
      fin.render(out)
      // the rule, rigid to the lens, over the finished set: never blurred by the macro's focus or the whip
      // (its own lens without the film offset, so it sits on RULE_RECT like everyone else's)
      ruleCam.position.copy(cam.position)
      ruleCam.quaternion.copy(cam.quaternion)
      ruleCam.aspect = cam.aspect
      ruleCam.near = cam.near
      ruleCam.far = cam.far
      ruleCam.updateProjectionMatrix()
      ruleCam.updateMatrixWorld()
      placeRule(rule, ruleCam, { dist: cam.near * 5 })
      r.setRenderTarget(out)
      r.autoClear = false
      r.render(ruleScene, ruleCam)
      r.autoClear = true
      const post: PostOpts = ctx.debugLabels
        ? { tone: "none", bloom: 0, grain: 0, exposure: 1, contrast: 1, sat: 1, vignette: 0 }
        : { tone: "agx", exposure: st.beat1 ? 1.15 : 1.05, bloom: 0.42, bloomThresh: 1.05, bloomRadius: 0.75, vignette: 0.28, grain: 0.022, contrast: 1.08, sat: 1.05, lift: [0.004, 0.006, 0.006], gain: [1, 1.01, 1], halation: 0.12, ca: 0.0007 }
      ctx.finish(out.texture, post)
    },
    type(g, s) {
      ageCard(g, s, ctx.def, { start: START, shadow: "rgba(0,0,0,0.7)", color: "#eef6f0" })
      titles(g, s, ctx.def, TITLES)
      if (s.beat === 0) {
        const t = s.at(0)
        const starts = [START + 1.0, ...MOVES.map(([, b]) => b - 0.25)]
        const ends = [...MOVES.map(([a]) => a + 0.05), 99]
        for (let i = 0; i < NAMES0.length; i++) name(g, NAMES0, i, t, starts[i], ends[i])
        if (selBox.ok) {
          const k = E.outBack(clamp((t - T_ON) / 0.3))
          const cx = selBox.x + selBox.w / 2, cy = selBox.y + selBox.h / 2
          const w = selBox.w * k, h = selBox.h * k
          g.selbox(cx - w / 2, cy - h / 2, w, h, clamp((t - T_ON) / 0.15) * (1 - s.exit * 2))
        }
      } else {
        const t = s.at(1)
        if (st.beat1) {
          const i = Math.max(0, st.station)
          // the names follow the camera's distance; each is typed when its layer is reached
          g.text(NAMES1[i], 1790, 420, { size: 30, font: "mono", align: "right", color: "#bff5cf", style: "type", by: "glyph", p: 1, shadow: { color: "rgba(0,0,0,0.85)", blur: 18 }, alpha: clamp((t - 0.4) / 0.2) * (1 - s.exit * 2) })
        }
      }
    },
    hud: () => HUD,
    labels: () => [...ruleLabels(face)],
    dispose() {
      face.dispose()
      dieTex.dispose()
      disposeTree(chip)
      disposeTree(sea)
      stars.dispose()
      disposeTree(fauna)
      disposeTree(ruleScene)
    },
  }
}
