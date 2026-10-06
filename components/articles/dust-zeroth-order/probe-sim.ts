// A toy of Dust's estimator on one linear layer, y_t = W x_t, with d inputs and
// d outputs, over T tokens. The per-token loss is quadratic, so its output error
// at token t is a fixed vector e_t, and the true weight gradient is
//
//   G = sum_t e_t x_t^T.
//
// Three zeroth-order estimators get the same number of forward passes K:
//
//   weight  weight-space ES, antithetic pairs: perturb W by sigma*E, read the
//           summed loss at W + sigma*E and W - sigma*E. K/2 pairs. For a
//           quadratic loss the pair difference is exactly 2*sigma*<G, E>, so
//           this is the most generous version of weight ES there is.
//   scalar  activation noise at every token, one scalar reward per pass (the
//           summed loss change), credited to every token's noise. One-sided.
//   token   activation noise at every token, each token's noise rewarded by
//           its own loss change (Dust's direct draws, gamma = 0). One-sided.
//
// Both activation estimators recover the weight gradient the way Dust does:
// the estimated output error g_t, outer product with the cached input x_t,
// summed over tokens.
//
// Everything is deterministic: a seeded mulberry32 stream, and Gaussians made
// from four uniforms (Irwin-Hall, rescaled to unit variance) so that no
// transcendental function is involved and the server and the browser compute
// the same digits.

export const T = 32
export const SIGMA = 0.05
export const WIDTHS = [4, 8, 16, 32, 64] as const
export const K_POINTS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]

export type MethodId = "weight" | "scalar" | "token"
export type Curves = Record<MethodId, number[]>

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SQRT3 = Math.sqrt(3)

function gaussian(rand: () => number) {
  return (rand() + rand() + rand() + rand() - 2) * SQRT3
}

function cosine(a: Float64Array, b: Float64Array) {
  let ab = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  if (aa === 0 || bb === 0) return 0
  return ab / Math.sqrt(aa * bb)
}

// G_hat = sum_t g_t x_t^T, flattened row-major (d_out x d_in)
function reassemble(g: Float64Array, x: Float64Array, d: number, scale: number) {
  const out = new Float64Array(d * d)
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < d; i++) {
      const gi = g[t * d + i] * scale
      if (gi === 0) continue
      for (let j = 0; j < d; j++) out[i * d + j] += gi * x[t * d + j]
    }
  }
  return out
}

export function simulate(d: number, seed = 7): Curves {
  const rand = mulberry32(seed * 1000 + d)
  const x = new Float64Array(T * d)
  const e = new Float64Array(T * d)
  for (let i = 0; i < T * d; i++) x[i] = gaussian(rand)
  for (let i = 0; i < T * d; i++) e[i] = gaussian(rand)
  const G = reassemble(e, x, d, 1)
  const D = d * d
  const kMax = K_POINTS[K_POINTS.length - 1]

  // weight-space ES, antithetic: K forward passes are K/2 pairs
  const weight: number[] = []
  {
    const acc = new Float64Array(D)
    const E = new Float64Array(D)
    let k = 0
    let next = 0
    for (let pair = 1; pair <= kMax / 2; pair++) {
      let dot = 0
      for (let i = 0; i < D; i++) {
        E[i] = gaussian(rand)
        dot += G[i] * E[i]
      }
      // (L(W + sE) - L(W - sE)) / 2s = <G, E> exactly for a quadratic loss
      for (let i = 0; i < D; i++) acc[i] += dot * E[i]
      k = pair * 2
      if (k === K_POINTS[next]) {
        weight.push(cosine(acc, G))
        next++
      }
    }
  }

  // activation noise: one pass jitters every token's output
  const scalar: number[] = []
  const token: number[] = []
  {
    const gScalar = new Float64Array(T * d)
    const gToken = new Float64Array(T * d)
    const a = new Float64Array(T * d)
    const dl = new Float64Array(T)
    let next = 0
    for (let k = 1; k <= kMax; k++) {
      let total = 0
      for (let t = 0; t < T; t++) {
        let lin = 0
        let sq = 0
        for (let i = 0; i < d; i++) {
          const v = gaussian(rand)
          a[t * d + i] = v
          lin += e[t * d + i] * v
          sq += v * v
        }
        // loss change at token t when y_t moves by sigma * a_t:
        // l(y + s a) - l(y) = s <e_t, a_t> + s^2 |a_t|^2 / 2
        dl[t] = SIGMA * lin + 0.5 * SIGMA * SIGMA * sq
        total += dl[t]
      }
      for (let t = 0; t < T; t++) {
        for (let i = 0; i < d; i++) {
          gScalar[t * d + i] += total * a[t * d + i]
          gToken[t * d + i] += dl[t] * a[t * d + i]
        }
      }
      if (k === K_POINTS[next]) {
        scalar.push(cosine(reassemble(gScalar, x, d, 1), G))
        token.push(cosine(reassemble(gToken, x, d, 1), G))
        next++
      }
    }
  }

  return { weight, scalar, token }
}
