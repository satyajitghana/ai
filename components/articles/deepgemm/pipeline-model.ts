// The truth behind the DeepGEMM workshop figure (pipeline-machine.tsx), as a
// pure function of time. No DOM, no randomness: the server renders the rest
// pose from it and the client animates the same function.
//
// What it models, all from the article and the SM90 kernel it quotes:
//   - one K-block is 128 elements (BLOCK_K, asserted at sm90_fp8_gemm_1d2d.cuh:56)
//   - one WGMMA consumes 32 of K, so a block is four of them
//   - the tensor core's accumulator keeps about 14 bits; FP32 keeps 24
//   - two math warpgroups share the tensor core: while one promotes its
//     partial sum into FP32 on the CUDA cores, the other issues its WGMMAs
//   - a TMA warp keeps shared-memory stages filled ahead of the maths
//
// The dials show how many times the running sum has doubled past a single
// product, on a scale as wide as the register: for terms of one sign that is
// log2(k) after k terms, and it is how many of the register's bits now sit
// above each new term, so they never reach it. The narrow dial climbs to
// log2(128) = 7 of 14 and is reset by every promotion; the FP32 dial climbs
// against its 24 bits and is not.
//
// Timings are for watching, not measurements of a GPU.

import { mlog2 } from "@/lib/dmath"

export const BLOCK_K = 128
export const WGMMA_K = 32
export const STEPS = BLOCK_K / WGMMA_K // 4
export const ACC_BITS = 14
export const FP32_BITS = 24
export const STAGES = 3
export const MODEL_K = 7168 // DeepSeek-V3's model width: one output tile's K loop
const BLOCKS_PER_TILE = MODEL_K / BLOCK_K

export const STAMP = 0.5 // seconds per WGMMA stroke
export const SLIDE = 0.5 // press moves to the other warpgroup
export const HALF = STEPS * STAMP + SLIDE
const DRAIN_AT = 0.15
const DRAIN = 1.3
const LEG1 = 0.8 // carriage: bin -> rack
const LOAD = 0.25
const LEG2 = 0.9 // rack -> bin
const DROP = 0.35

export const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}
const pulse = (x: number) => (x <= 0 || x >= 1 ? 0 : x < 0.5 ? smooth(x * 2) : smooth((1 - x) * 2))

export interface Station {
  k: number // elements of K sitting in the narrow accumulator
  narrow: number // doublings past one product, 0..14
  wide: number // same for the FP32 running sum, 0..24
  lever: number // 0 rest, 1 pulled (promotion)
  promoting: boolean
}

export interface Pose {
  wg: number // warpgroup the press is serving or moving away from
  step: number // WGMMA 1..4, 0 while sliding
  sliding: boolean
  pressX: number // 0 at warpgroup 0, 1 at warpgroup 1
  ram: number // 0 up, 1 down on the die
  stations: [Station, Station]
  bin: number // stage the press is reading
  carriage: number // position index: -1 rack, 0..2 bins (fractional while moving)
  carrying: number // opacity of the tile on the carriage
  bins: { full: number; drop: number }[] // per stage: opacity and fall (1 = just above, 0 = seated)
  readout: string
}

const doublings = (k: number) => (k > 0 ? mlog2(k) : 0)

// When warpgroup w's promotion of block b reaches the FP32 register.
const promotedAt = (b: number, w: number) => (2 * b + w + 1) * HALF + DRAIN_AT + DRAIN / 2

function promotionsDone(t: number, w: number) {
  // largest b with promotedAt(b, w) <= t, plus one
  const b = Math.floor((t - promotedAt(0, w)) / (2 * HALF))
  return b < 0 ? 0 : b + 1
}

export function poseAt(t: number): Pose {
  const h = Math.floor(t / HALF)
  const u = t - h * HALF
  const wg = h % 2
  const other = 1 - wg
  const stamping = u < STEPS * STAMP
  const j = stamping ? Math.floor(u / STAMP) : STEPS
  const p = stamping ? (u - j * STAMP) / STAMP : 0
  const landed = stamping ? j + (p >= 0.5 ? 1 : 0) : STEPS

  const stations = [0, 1].map((w): Station => {
    let k: number
    let lever = 0
    let promoting = false
    if (w === wg) k = landed * WGMMA_K
    else if (h === 0) k = 0
    else {
      const x = (u - DRAIN_AT) / DRAIN
      lever = pulse(x)
      promoting = x > 0 && x < 1
      k = x < 0.5 ? BLOCK_K : 0
    }
    const n = promotionsDone(t, w)
    const kDone = n > 0 ? BLOCK_K * (((n - 1) % BLOCKS_PER_TILE) + 1) : 0
    return { k, narrow: doublings(k), wide: doublings(kDone), lever, promoting }
  }) as [Station, Station]

  // Shared-memory stages and the TMA carriage. Block b lives in stage b % 3;
  // the stage is freed when warpgroup 1's fourth WGMMA on it lands, and the
  // carriage brings block b + 3 from the rack.
  const freed = (b: number) => (2 * b + 1) * HALF + STEPS * STAMP
  const trip = Math.floor((t - freed(0)) / (2 * HALF))
  const bins = Array.from({ length: STAGES }, () => ({ full: 1, drop: 0 }))
  let carriage = STAGES - 1
  let carrying = 0
  if (trip >= 0) {
    const tau = t - freed(trip)
    const from = (trip + STAGES - 1) % STAGES
    const to = trip % STAGES
    if (tau < LEG1) carriage = from + (-1 - from) * smooth(tau / LEG1)
    else if (tau < LEG1 + LOAD) {
      carriage = -1
      carrying = smooth((tau - LEG1) / LOAD)
    } else if (tau < LEG1 + LOAD + LEG2) {
      carriage = -1 + (to + 1) * smooth((tau - LEG1 - LOAD) / LEG2)
      carrying = 1
    } else {
      carriage = to
      const q = smooth((tau - LEG1 - LOAD - LEG2) / DROP)
      carrying = 1 - q
      bins[to] = { full: q, drop: 1 - q }
    }
    if (tau < LEG1 + LOAD + LEG2) bins[to] = { full: 0, drop: 1 }
  }

  const otherBusy = h >= 1 && u < DRAIN_AT + DRAIN
  const readout = stamping
    ? `WG${wg} · WGMMA ${j + 1} of ${STEPS} · WG${other} ${otherBusy ? "promoting" : "ready"}`
    : `tensor core → WG${other}`

  return {
    wg,
    step: stamping ? j + 1 : 0,
    sliding: !stamping,
    pressX: stamping ? wg : wg + (other - wg) * smooth((u - STEPS * STAMP) / SLIDE),
    ram: stamping ? (p < 0.5 ? smooth(p / 0.5) : smooth((1 - p) / 0.5)) : 0,
    stations,
    bin: Math.floor(h / 2) % STAGES,
    carriage,
    carrying,
    bins,
    readout,
  }
}

// The resting pose the server renders: warpgroup 1 on its second WGMMA while
// warpgroup 0's lever is fully pulled.
export const REST_T = HALF + 0.8

// Next stroke boundary after t: lands just past the moment a WGMMA lands.
export const nextStep = (t: number) => (Math.floor(t / STAMP - 0.6) + 1 + 0.6) * STAMP
export const prevStep = (t: number) => Math.max(0.6 * STAMP, (Math.ceil(t / STAMP - 0.6) - 1 + 0.6) * STAMP)
