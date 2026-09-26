// Two-bone inverse kinematics in 2-D, written three ways for the
// pmndrs-math-typegpu article. None of this is pmndrs/math's code; it is plain
// TypeScript written in the two styles the article compares.
//
//   solveOut     the closed form, written the way math's API is shaped: the
//                caller owns `elbow` and `hand`, the function writes into them
//                and creates no vectors at all.
//   solveAlloc   the same closed form written the way it reads when every
//                vector op returns a fresh array. It counts the arrays it asks
//                for, which is what the widget's counter shows.
//   fabrikSolve  FABRIK on the same two bones, with the defaults math/ik ships
//                (20 iterations, stop at 0.01, stall below a 1e-4 change), so the
//                widget can show how many passes an iterative solver needs for a
//                limb the closed form places in one step.
//
// Everything here is + - * / and Math.sqrt, which IEEE-754 makes identical on
// every engine, so positions computed during SSR match the browser exactly.
// Angles go through lib/dmath in the component.

export type V2 = [number, number]

export type Arm = {
  /** upper bone length */
  l1: number
  /** lower bone length */
  l2: number
  /** which side the elbow bends to: +1 or -1 */
  bend: 1 | -1
}

/** Clamp the target distance into the ring the arm can reach. */
function reachable(d: number, arm: Arm): number {
  const lo = Math.abs(arm.l1 - arm.l2) + 1e-6
  const hi = arm.l1 + arm.l2 - 1e-6
  return d < lo ? lo : d > hi ? hi : d
}

/**
 * Closed-form two-bone solve, out-parameter style. The shoulder is at the
 * origin. The elbow is where the circle of radius l1 about the shoulder meets
 * the circle of radius l2 about the (clamped) target: a distance `a` along the
 * shoulder-to-target line and `h` off it. Only square roots, no trig.
 *
 * Returns the clamped target distance.
 */
export function solveOut(elbow: V2, hand: V2, target: V2, arm: Arm): number {
  const tx = target[0]
  const ty = target[1]
  const d0 = Math.sqrt(tx * tx + ty * ty)
  const d = reachable(d0, arm)

  let ux = 1
  let uy = 0
  if (d0 > 1e-9) {
    const inv = 1 / d0
    ux = tx * inv
    uy = ty * inv
  }

  const a = (arm.l1 * arm.l1 - arm.l2 * arm.l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, arm.l1 * arm.l1 - a * a)) * arm.bend

  elbow[0] = a * ux - h * uy
  elbow[1] = a * uy + h * ux
  hand[0] = ux * d
  hand[1] = uy * d
  return d
}

type Counter = { n: number }

function v(c: Counter, x: number, y: number): V2 {
  c.n++
  return [x, y]
}
const sub = (c: Counter, a: V2, b: V2): V2 => v(c, a[0] - b[0], a[1] - b[1])
const add = (c: Counter, a: V2, b: V2): V2 => v(c, a[0] + b[0], a[1] + b[1])
const scale = (c: Counter, a: V2, s: number): V2 => v(c, a[0] * s, a[1] * s)
const perp = (c: Counter, a: V2): V2 => v(c, -a[1], a[0])
const len = (a: V2): number => Math.sqrt(a[0] * a[0] + a[1] * a[1])

/**
 * The same closed form, written with vector ops that each return a new array.
 * Nine arrays per solve: the offset to the target, its direction, the
 * perpendicular, two scaled copies, two sums for the elbow, and a scale and a
 * sum for the hand.
 */
export function solveAlloc(base: V2, target: V2, arm: Arm): { elbow: V2; hand: V2; allocs: number } {
  const c: Counter = { n: 0 }
  const toTarget = sub(c, target, base)
  const d0 = len(toTarget)
  const d = reachable(d0, arm)
  const dir = d0 > 1e-9 ? scale(c, toTarget, 1 / d0) : v(c, 1, 0)
  const a = (arm.l1 * arm.l1 - arm.l2 * arm.l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, arm.l1 * arm.l1 - a * a)) * arm.bend
  const elbow = add(c, base, add(c, scale(c, dir, a), scale(c, perp(c, dir), h)))
  const hand = add(c, base, scale(c, dir, d))
  return { elbow, hand, allocs: c.n }
}

// FABRIK scratch, allocated once at module load and named the way math's
// SKILL.md asks for module-level scratch: _owner_purpose.
const _fabrik_elbow: V2 = [0, 0]
const _fabrik_hand: V2 = [0, 0]
const _fabrik_bestElbow: V2 = [0, 0]
const _fabrik_bestHand: V2 = [0, 0]

export type FabrikResult = { iterations: number; residual: number }

/**
 * FABRIK on two bones, from a cold start: the upper bone straight up and the
 * lower bone a hair off straight, the start math's own fabrik2 bench uses.
 * Writes the best pose it saw into `elbow` and `hand`.
 */
export function fabrikSolve(
  elbow: V2,
  hand: V2,
  target: V2,
  arm: Arm,
  maxIterations = 20,
  threshold = 0.01,
  minChange = 1e-4
): FabrikResult {
  const e = _fabrik_elbow
  const t = _fabrik_hand
  e[0] = 0
  e[1] = arm.l1
  t[0] = 0.035 * arm.l2
  t[1] = arm.l1 + 0.999 * arm.l2

  let best = Number.POSITIVE_INFINITY
  let previous = Number.POSITIVE_INFINITY
  let iterations = 0

  for (let i = 0; i < maxIterations; i++) {
    iterations++

    // forward: snap the hand onto the target, drag the elbow after it
    t[0] = target[0]
    t[1] = target[1]
    let dx = e[0] - t[0]
    let dy = e[1] - t[1]
    let l = Math.sqrt(dx * dx + dy * dy) || 1
    e[0] = t[0] + (dx / l) * arm.l2
    e[1] = t[1] + (dy / l) * arm.l2

    // backward: pin the shoulder at the origin, pull the chain back to it
    l = Math.sqrt(e[0] * e[0] + e[1] * e[1]) || 1
    e[0] = (e[0] / l) * arm.l1
    e[1] = (e[1] / l) * arm.l1
    dx = t[0] - e[0]
    dy = t[1] - e[1]
    l = Math.sqrt(dx * dx + dy * dy) || 1
    t[0] = e[0] + (dx / l) * arm.l2
    t[1] = e[1] + (dy / l) * arm.l2

    const rx = t[0] - target[0]
    const ry = t[1] - target[1]
    const distance = Math.sqrt(rx * rx + ry * ry)

    if (distance < best) {
      best = distance
      _fabrik_bestElbow[0] = e[0]
      _fabrik_bestElbow[1] = e[1]
      _fabrik_bestHand[0] = t[0]
      _fabrik_bestHand[1] = t[1]
      if (distance <= threshold) break
    } else if (Math.abs(distance - previous) < minChange) {
      break
    }
    previous = distance
  }

  elbow[0] = _fabrik_bestElbow[0]
  elbow[1] = _fabrik_bestElbow[1]
  hand[0] = _fabrik_bestHand[0]
  hand[1] = _fabrik_bestHand[1]
  return { iterations, residual: best }
}
