// Data loading for the fly-connectome neuron explorer.
//
// Everything here fetches static files committed under
// `public/articles/fly-connectome-computing/data/` -- there is no runtime
// call to neuprint from the shipped page. See `manifest.json` (fetched
// alongside) for dataset provenance, counts and license.

export const DATA_BASE = "/articles/fly-connectome-computing/data"

export type RegionId = 0 | 1 | 2 | 3
export const REGION_NAMES = ["central_brain", "optic_lobe", "vnc", "other"] as const
export const REGION_LABELS: Record<number, string> = {
  0: "central brain",
  1: "optic lobe",
  2: "ventral nerve cord",
  3: "other / connecting",
}
// Okabe-Ito colourblind-safe categorical set -- identical to the values baked
// into public/articles/fly-connectome-computing/poster.png so the static
// fallback and the live WebGL view read as the same picture.
export const REGION_COLORS: Record<number, [number, number, number]> = {
  0: [230 / 255, 159 / 255, 0 / 255],
  1: [86 / 255, 180 / 255, 233 / 255],
  2: [204 / 255, 121 / 255, 167 / 255],
  3: [140 / 255, 140 / 255, 140 / 255],
}

export interface SomaData {
  count: number
  /** world-space, centered + scaled so the longest axis spans roughly [-1, 1] */
  positions: Float32Array
  typeIndex: Uint16Array
  region: Uint8Array
  status: Uint8Array
  pre: Uint16Array
  post: Uint16Array
  bodyIds: Uint32Array
  /** true nanometer bounding box, for the "position" readout on a single neuron */
  nm: { min: [number, number, number]; scale: number }
  center: [number, number, number]
  halfExtent: number
}

export interface TypesTable {
  regionNames: string[]
  names: string[]
  counts: number[]
  region: number[]
  /** normalized("hdeltah") -> type index, built once for exact-match lookup */
  byNormalized: Map<string, number>
  /** names[i], pre-normalized, index-aligned -- avoids re-normalizing ~11.4k strings per keystroke in the search box */
  normalizedNames: string[]
}

export interface EdgeSet {
  count: number
  src: Uint32Array
  dst: Uint32Array
  weight: Uint16Array
}

export interface Manifest {
  dataset: Record<string, unknown>
  counts: Record<string, unknown>
  notableTypes: Record<string, { memberCount: number; edgeCount: number }>
  committedByteSizes: Record<string, number>
  [k: string]: unknown
}

async function fetchBuf(path: string): Promise<ArrayBuffer> {
  const res = await fetch(`${DATA_BASE}/${path}`)
  if (!res.ok) throw new Error(`fetch ${path} failed: ${res.status}`)
  return res.arrayBuffer()
}

export async function loadManifest(): Promise<Manifest> {
  const res = await fetch(`${DATA_BASE}/manifest.json`)
  if (!res.ok) throw new Error(`fetch manifest.json failed: ${res.status}`)
  return res.json()
}

export async function loadSomaData(): Promise<SomaData> {
  const [posBuf, typeBuf, flagsBuf, preBuf, postBuf, idBuf, manifest] = await Promise.all([
    fetchBuf("positions.u16.bin"),
    fetchBuf("type-index.u16.bin"),
    fetchBuf("flags.u8.bin"),
    fetchBuf("pre.u16.bin"),
    fetchBuf("post.u16.bin"),
    fetchBuf("body-ids.u32.bin"),
    loadManifest(),
  ])

  const rawPos = new Uint16Array(posBuf)
  const n = rawPos.length / 3
  const flags = new Uint8Array(flagsBuf)
  const region = new Uint8Array(n)
  const status = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    region[i] = flags[i] & 0x3
    status[i] = (flags[i] >> 2) & 0x3
  }

  const q = manifest.quantization as { min: [number, number, number]; scale: number }
  const minAxis = q.min
  const scale = q.scale

  // dequantize to real nanometers, then find the true bbox in one pass
  const nmPos = new Float32Array(rawPos.length)
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  for (let i = 0; i < n; i++) {
    const x = minAxis[0] + rawPos[i * 3] / scale
    const y = minAxis[1] + rawPos[i * 3 + 1] / scale
    const z = minAxis[2] + rawPos[i * 3 + 2] / scale
    nmPos[i * 3] = x
    nmPos[i * 3 + 1] = y
    nmPos[i * 3 + 2] = z
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
  const halfExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2

  // World axes: x stays left-right; the anatomical AP axis (z: low = brain,
  // high = VNC) is flipped into +Y so the brain sits "up" and the cord hangs
  // down, matching the poster; the DV-ish axis (y) becomes the view's depth.
  const positions = new Float32Array(rawPos.length)
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (nmPos[i * 3] - center[0]) / halfExtent
    positions[i * 3 + 1] = -(nmPos[i * 3 + 2] - center[2]) / halfExtent
    positions[i * 3 + 2] = (nmPos[i * 3 + 1] - center[1]) / halfExtent
  }

  return {
    count: n,
    positions,
    typeIndex: new Uint16Array(typeBuf),
    region,
    status,
    pre: new Uint16Array(preBuf),
    post: new Uint16Array(postBuf),
    bodyIds: new Uint32Array(idBuf),
    nm: { min: minAxis, scale },
    center,
    halfExtent,
  }
}

function normalizeTypeQuery(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[δΔ]/g, "delta")
    .replace(/[^a-z0-9]/g, "")
}

export async function loadTypesTable(): Promise<TypesTable> {
  const res = await fetch(`${DATA_BASE}/types.json`)
  if (!res.ok) throw new Error(`fetch types.json failed: ${res.status}`)
  const raw = (await res.json()) as { regionNames: string[]; names: string[]; counts: number[]; region: number[] }
  const byNormalized = new Map<string, number>()
  const normalizedNames = new Array<string>(raw.names.length)
  raw.names.forEach((name, i) => {
    const key = normalizeTypeQuery(name)
    normalizedNames[i] = key
    if (i === 0) return // 0 = "(unlabeled)"
    if (!byNormalized.has(key)) byNormalized.set(key, i)
  })
  return { ...raw, byNormalized, normalizedNames }
}

export { normalizeTypeQuery }

export async function loadBackbone(): Promise<EdgeSet> {
  const [srcBuf, dstBuf, wBuf] = await Promise.all([
    fetchBuf("backbone.src.u32.bin"),
    fetchBuf("backbone.dst.u32.bin"),
    fetchBuf("backbone.w.u16.bin"),
  ])
  const src = new Uint32Array(srcBuf)
  return { count: src.length, src, dst: new Uint32Array(dstBuf), weight: new Uint16Array(wBuf) }
}

export interface TypeConnectivity {
  members: Uint32Array
  edges: EdgeSet
}

const typeEdgeCache = new Map<string, Promise<TypeConnectivity | null>>()

/** Precomputed neuron-level connectivity, on demand, for the curated "notable" type set (see manifest.notableTypes). Returns null for any other type -- the caller still has colour highlight + counts from the always-loaded soma layer. */
export function loadTypeConnectivity(typeName: string): Promise<TypeConnectivity | null> {
  let p = typeEdgeCache.get(typeName)
  if (p) return p
  p = (async () => {
    try {
      const [srcBuf, dstBuf, wBuf, memBuf] = await Promise.all([
        fetchBuf(`edges-by-type/${typeName}.src.u32.bin`),
        fetchBuf(`edges-by-type/${typeName}.dst.u32.bin`),
        fetchBuf(`edges-by-type/${typeName}.w.u16.bin`),
        fetchBuf(`edges-by-type/${typeName}.members.u32.bin`),
      ])
      const src = new Uint32Array(srcBuf)
      return {
        members: new Uint32Array(memBuf),
        edges: { count: src.length, src, dst: new Uint32Array(dstBuf), weight: new Uint16Array(wBuf) },
      }
    } catch {
      return null
    }
  })()
  typeEdgeCache.set(typeName, p)
  return p
}
