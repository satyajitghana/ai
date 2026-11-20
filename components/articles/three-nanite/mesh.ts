// A dense, closed, welded test mesh made on the spot, so the demo ships no asset:
// an icosphere subdivided `subdiv` times (20 * 4^subdiv triangles) and pushed in
// and out by seeded value noise until it reads as a rock. Every vertex is shared
// by its neighbours (midpoints are cached per edge), so the mesh has no seams and
// "this vertex sits on a group border" is a plain vertex-id test in the DAG build.
//
// Pure functions, no three.js, no DOM: the article's build test runs it in Node.

export type RawMesh = {
  positions: Float32Array // xyz per vertex
  normals: Float32Array // xyz per vertex, area-weighted
  indices: Uint32Array // three per triangle, counter-clockwise from outside
}

// integer hash -> [0, 1); deterministic everywhere (no Math.random, no trig)
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi)
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed)
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * xf
  const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * xf
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * xf
  const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * xf
  const y0 = x00 + (x10 - x00) * yf
  const y1 = x01 + (x11 - x01) * yf
  return (y0 + (y1 - y0) * zf) * 2 - 1
}

// fractal noise with a ridged top octave, so the rock has ledges and pits
function rockHeight(x: number, y: number, z: number, seed: number): number {
  let amp = 0.5, freq = 1.3, sum = 0
  for (let o = 0; o < 6; o++) {
    const n = valueNoise(x * freq, y * freq, z * freq, seed + o * 31)
    sum += (o >= 3 ? 1 - Math.abs(n) * 2 : n) * amp
    amp *= 0.5
    freq *= 2.1
  }
  return sum
}

export function makeRock(subdiv: number, seed = 7): RawMesh {
  // icosahedron
  const t = (1 + Math.sqrt(5)) / 2
  const pos: number[] = [
    -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0,
    0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t,
    t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1,
  ]
  let tri: number[] = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ]
  for (let s = 0; s < subdiv; s++) {
    const mid = new Map<number, number>()
    const midpoint = (a: number, b: number) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a
      const hit = mid.get(key)
      if (hit !== undefined) return hit
      const id = pos.length / 3
      pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2)
      mid.set(key, id)
      return id
    }
    const next: number[] = []
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], c = tri[i + 2]
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a)
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca)
    }
    tri = next
  }
  const V = pos.length / 3
  const positions = new Float32Array(V * 3)
  for (let v = 0; v < V; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2]
    const l = Math.sqrt(x * x + y * y + z * z)
    const nx = x / l, ny = y / l, nz = z / l
    const r = 1 + 0.32 * rockHeight(nx, ny, nz, seed)
    // squash a little so the rocks are not all spheres
    positions[v * 3] = nx * r * 1.15
    positions[v * 3 + 1] = ny * r * 0.8
    positions[v * 3 + 2] = nz * r
  }
  const indices = Uint32Array.from(tri)
  return { positions, normals: vertexNormals(positions, indices), indices }
}

export function vertexNormals(p: Float32Array, idx: Uint32Array): Float32Array {
  const n = new Float32Array(p.length)
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx
    n[a] += x; n[a + 1] += y; n[a + 2] += z
    n[b] += x; n[b + 1] += y; n[b + 2] += z
    n[c] += x; n[c + 1] += y; n[c + 2] += z
  }
  for (let v = 0; v < n.length; v += 3) {
    const l = Math.sqrt(n[v] * n[v] + n[v + 1] * n[v + 1] + n[v + 2] * n[v + 2]) || 1
    n[v] /= l; n[v + 1] /= l; n[v + 2] /= l
  }
  return n
}
