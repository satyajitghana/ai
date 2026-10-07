// A toy latent bridge, small enough to train in the browser and exact enough
// to render the same on server and client (only + - * / and sqrt, which IEEE
// 754 fixes bit for bit; no Math.exp/log/sin).
//
// It mirrors Squeeze3D's training setup at miniature scale:
//   x  (encoder latent, d_E = 12)  --W-->  z (compressed code, d_C = 10)
//   z                              --V-->  y_hat (generator latent, d_G = 12)
// The "generator latent" y = A x is a fixed linear function of x whose
// singular values fall off fast, the way real latents carry most of their
// energy in a few directions. Both maps are trained by plain gradient descent
// on the latent-space MSE, with or without the Gram term exactly as
// squeeze3d/launch_training.py:81-100 computes it: rows of z L2-normalised,
// G = Zn Zn^T (batch x batch), loss = mean((G - I)^2), added with a weight.
// One full batch of B = 8 samples, as in the repo's batch size of 8-16.

export const B = 8
export const DE = 12
export const DC = 10
export const DG = 12
export const STEPS = 1200
export const SNAPSHOTS = [0, 50, 150, 300, 600, 1200] as const

type Mat = number[][]

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

// Irwin-Hall approximation to a standard normal: sum of 6 uniforms, centred.
function gauss(rand: () => number) {
  let s = 0
  for (let i = 0; i < 6; i++) s += rand()
  return (s - 3) / 0.7071067811865476
}

function zeros(r: number, c: number): Mat {
  return Array.from({ length: r }, () => new Array<number>(c).fill(0))
}

function randMat(r: number, c: number, scale: number, rand: () => number): Mat {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => gauss(rand) * scale))
}

function matVec(M: Mat, v: number[]) {
  return M.map((row) => {
    let s = 0
    for (let j = 0; j < v.length; j++) s += row[j] * v[j]
    return s
  })
}

function norm(v: number[]) {
  let s = 0
  for (const x of v) s += x * x
  return Math.sqrt(s)
}

// Symmetric eigenvalues by cyclic Jacobi (uses sqrt only).
export function symEigen(Min: Mat): number[] {
  const n = Min.length
  const M = Min.map((r) => r.slice())
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += M[p][q] * M[p][q]
    if (off < 1e-22) break
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(M[p][q]) < 1e-30) continue
        const theta = (M[q][q] - M[p][p]) / (2 * M[p][q])
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const mkp = M[k][p]
          const mkq = M[k][q]
          M[k][p] = c * mkp - s * mkq
          M[k][q] = s * mkp + c * mkq
        }
        for (let k = 0; k < n; k++) {
          const mpk = M[p][k]
          const mqk = M[q][k]
          M[p][k] = c * mpk - s * mqk
          M[q][k] = s * mpk + c * mqk
        }
      }
    }
  }
  return M.map((r, i) => r[i]).sort((a, b) => b - a)
}

export type Snapshot = {
  step: number
  mse: number
  gram: Mat // B x B, rows of z normalised: the matrix the code penalises
  dimCorr: Mat // DC x DC, the same normalised rows: Zn^T Zn
  sampleLoss: number // || Zn Zn^T - I_B ||_F^2
  dimLoss: number // || Zn^T Zn - I_DC ||_F^2
  eig: number[] // eigenvalues of Zn^T Zn, descending
  deff: number // participation ratio (sum l)^2 / sum l^2, the paper's Eq. 5
  quantMse: number[] // latent MSE after rounding z to 8, 6, 4 bits
}

export const QUANT_BITS = [8, 6, 4] as const

function snapshot(step: number, W: Mat, V: Mat, X: Mat, Y: Mat): Snapshot {
  const Z = X.map((x) => matVec(W, x))
  const Zn = Z.map((z) => {
    const n = norm(z) + 1e-8
    return z.map((v) => v / n)
  })
  const gram = zeros(B, B)
  for (let i = 0; i < B; i++)
    for (let j = 0; j < B; j++) {
      let s = 0
      for (let k = 0; k < DC; k++) s += Zn[i][k] * Zn[j][k]
      gram[i][j] = s
    }
  const dimCorr = zeros(DC, DC)
  for (let a = 0; a < DC; a++)
    for (let b = 0; b < DC; b++) {
      let s = 0
      for (let i = 0; i < B; i++) s += Zn[i][a] * Zn[i][b]
      dimCorr[a][b] = s
    }
  let sampleLoss = 0
  for (let i = 0; i < B; i++)
    for (let j = 0; j < B; j++) {
      const d = gram[i][j] - (i === j ? 1 : 0)
      sampleLoss += d * d
    }
  let dimLoss = 0
  for (let a = 0; a < DC; a++)
    for (let b = 0; b < DC; b++) {
      const d = dimCorr[a][b] - (a === b ? 1 : 0)
      dimLoss += d * d
    }
  const eig = symEigen(dimCorr).map((v) => (v < 0 ? 0 : v))
  let s1 = 0
  let s2 = 0
  for (const l of eig) {
    s1 += l
    s2 += l * l
  }
  const deff = s2 > 0 ? (s1 * s1) / s2 : 0

  const mseOf = (Zq: Mat) => {
    let e = 0
    for (let i = 0; i < B; i++) {
      const yh = matVec(V, Zq[i])
      for (let k = 0; k < DG; k++) {
        const d = yh[k] - Y[i][k]
        e += d * d
      }
    }
    return e / (B * DG)
  }
  const mse = mseOf(Z)
  const quantMse = QUANT_BITS.map((bits) => {
    // One shared uniform quantiser per code: step = max|z| / 2^(bits-1).
    const Zq = Z.map((z) => {
      let mx = 0
      for (const v of z) mx = Math.max(mx, Math.abs(v))
      const stepq = mx / (1 << (bits - 1))
      return z.map((v) => (stepq > 0 ? Math.round(v / stepq) * stepq : 0))
    })
    return mseOf(Zq)
  })
  return { step, mse, gram, dimCorr, sampleLoss, dimLoss, eig, deff, quantMse }
}

export function trainToy(lambda: number): Snapshot[] {
  const rand = mulberry32(20260607)
  const X = randMat(B, DE, 1, rand)
  // Generator latent: y = M diag(s) x, energy concentrated in a few directions.
  const sv = [3, 1.6, 0.8, 0.4, 0.2, 0.1, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01]
  const M = randMat(DG, DE, 0.35, rand)
  const A = M.map((row) => row.map((v, j) => v * sv[j]))
  const Y = X.map((x) => matVec(A, x))
  // Same initial weights for both runs.
  const W = randMat(DC, DE, 0.1, rand)
  const V = randMat(DG, DC, 0.1, rand)
  const lr = 0.03
  const out: Snapshot[] = []
  if ((SNAPSHOTS as readonly number[]).includes(0)) out.push(snapshot(0, W, V, X, Y))
  for (let step = 1; step <= STEPS; step++) {
    const Z = X.map((x) => matVec(W, x))
    const dZ = zeros(B, DC)
    const dV = zeros(DG, DC)
    // Latent-space MSE: mean over B * DG entries.
    for (let i = 0; i < B; i++) {
      const yh = matVec(V, Z[i])
      for (let k = 0; k < DG; k++) {
        const g = (2 * (yh[k] - Y[i][k])) / (B * DG)
        for (let c = 0; c < DC; c++) {
          dV[k][c] += g * Z[i][c]
          dZ[i][c] += g * V[k][c]
        }
      }
    }
    if (lambda > 0) {
      const ns = Z.map((z) => norm(z) + 1e-8)
      const Zn = Z.map((z, i) => z.map((v) => v / ns[i]))
      // d/dn_i of mean((G - I)^2) with G = Zn Zn^T  ->  (4 / B^2) sum_j (G_ij - d_ij) n_j
      for (let i = 0; i < B; i++) {
        const gn = new Array<number>(DC).fill(0)
        for (let j = 0; j < B; j++) {
          let gij = 0
          for (let c = 0; c < DC; c++) gij += Zn[i][c] * Zn[j][c]
          const r = gij - (i === j ? 1 : 0)
          for (let c = 0; c < DC; c++) gn[c] += ((4 * r) / (B * B)) * Zn[j][c]
        }
        // Back through the normalisation: (I - n n^T) gn / ||z||
        let dot = 0
        for (let c = 0; c < DC; c++) dot += Zn[i][c] * gn[c]
        for (let c = 0; c < DC; c++) dZ[i][c] += (lambda * (gn[c] - dot * Zn[i][c])) / ns[i]
      }
    }
    for (let k = 0; k < DG; k++) for (let c = 0; c < DC; c++) V[k][c] -= lr * dV[k][c]
    for (let c = 0; c < DC; c++)
      for (let e = 0; e < DE; e++) {
        let g = 0
        for (let i = 0; i < B; i++) g += dZ[i][c] * X[i][e]
        W[c][e] -= lr * g
      }
    if ((SNAPSHOTS as readonly number[]).includes(step)) out.push(snapshot(step, W, V, X, Y))
  }
  return out
}
