// Easing table and small numeric helpers. Animation in this deck is written as keyframe ranges
// against a per-beat clock, so these are the only "tween library" there is.

export type Ease = (x: number) => number

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x)
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
/** 0..1 over [from, to]. */
export const ramp = (x: number, from: number, to: number) => clamp((x - from) / (to - from || 1e-6))

export const E = {
  lin: (x: number) => x,
  in2: (x: number) => x * x,
  in3: (x: number) => x * x * x,
  in4: (x: number) => x * x * x * x,
  out2: (x: number) => 1 - (1 - x) * (1 - x),
  out3: (x: number) => 1 - (1 - x) ** 3,
  out4: (x: number) => 1 - (1 - x) ** 4,
  out5: (x: number) => 1 - (1 - x) ** 5,
  io2: (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  io3: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  io5: (x: number) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),
  outBack: (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
  outElastic: (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * 2.0943951) + 1),
  outBounce: (x: number) => {
    const n = 7.5625
    const d = 2.75
    if (x < 1 / d) return n * x * x
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375
    return n * (x -= 2.625 / d) * x + 0.984375
  },
} satisfies Record<string, Ease>

/** A seeded generator (mulberry32): every "random" thing in a scene is the same on every run. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
