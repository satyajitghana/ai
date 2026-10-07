// Scene C000 from coolbeam/DistScene-preview-assets (original_output/C000.glb,
// 984,594,760 bytes, Hugging Face revision dd2b867). Read with HTTP range
// requests: only the GLB's JSON chunk, never the 940 MB of geometry and PNGs.
//
// Every object node carries the same matrix shape, column-major:
//   [s,0,0,0,  0,0,-s,0,  0,s,0,0,  tx,ty,tz,1]
// a uniform scale s and a translation wrapped around a fixed Z-up to Y-up axis
// swap, with no per-object rotation. Each object's own mesh sits in a unit
// cube (extent 0.986 to 1.004 on its longest side), so s is the object's
// longest side as a fraction of the scene cube. The environment node has s = 1.
//
// x0..x1 and z0..z1 are each object's footprint on the floor plane in scene
// units (the accessor min/max pushed through the node matrix); h is its height.
// tris is the triangle count of the object's mesh. Labels ending in "?" are my
// reading of the input photo, not something the file says.

export type SceneObject = {
  id: string
  label: string
  s: number
  x0: number
  x1: number
  z0: number
  z1: number
  h: number
  tx: number
  tz: number
  tris: number
}

export const C000: SceneObject[] = [
  { id: "obj001", label: "cabinet?", s: 0.2607, x0: -0.4274, x1: -0.3493, z0: -0.4023, z1: -0.2735, h: 0.2611, tx: -0.2968, tz: -0.4041, tris: 1923369 },
  { id: "obj002", label: "sideboard?", s: 0.291, x0: -0.4248, x1: -0.3481, z0: -0.1528, z1: 0.1381, h: 0.2142, tx: -0.2799, tz: -0.0077, tris: 1984262 },
  { id: "obj003", label: "sofa", s: 0.6049, x0: -0.2494, x1: -0.0126, z0: -0.2895, z1: 0.3159, h: 0.1308, tx: 0.0521, tz: 0.0132, tris: 1930629 },
  { id: "obj004", label: "coffee table", s: 0.2242, x0: -0.023, x1: 0.0976, z0: -0.0832, z1: 0.1411, h: 0.134, tx: 0.0892, tz: 0.029, tris: 1858526 },
  { id: "obj005", label: "lamp?", s: 0.2285, x0: -0.1926, x1: -0.1078, z0: -0.3722, z1: -0.2794, h: 0.2289, tx: -0.0786, tz: -0.393, tris: 1998587 },
  { id: "obj006", label: "pedestal?", s: 0.228, x0: 0.1417, x1: 0.1963, z0: -0.4034, z1: -0.3434, h: 0.2284, tx: 0.2546, tz: -0.4575, tris: 1904339 },
  { id: "obj007", label: "armchair", s: 0.1376, x0: 0.1645, x1: 0.2973, z0: 0.0713, z1: 0.2091, h: 0.1233, tx: 0.2332, tz: 0.1402, tris: 1964991 },
  { id: "obj008", label: "armchair", s: 0.1397, x0: 0.1645, x1: 0.3045, z0: -0.179, z1: -0.0416, h: 0.1169, tx: 0.2345, tz: -0.1114, tris: 1950382 },
]

// The environment's footprint in the same file (node "env", s = 1).
export const C000_ENV = { x0: -0.501, x1: 0.501, z0: -0.5, z1: 0.5, tris: 1919356 }

// Table 5 of the paper (arXiv 2610.06960): seconds for scene-frame generation,
// seconds per refined object, peak GB, and scene F-score on the two benchmarks.
// The GPU is not named in the paper.
export const TABLE5 = [
  { id: "SF-512", scene: 5.7, perObj: 0, mem: 17.9, fMidi: 61.77, fGen: 71.96 },
  { id: "SF-1024", scene: 36.4, perObj: 0, mem: 21.4, fMidi: 68.86, fGen: 73.21 },
  { id: "SF-512 + Ref-512", scene: 5.7, perObj: 3.3, mem: 18.0, fMidi: 68.35, fGen: 78.35 },
  { id: "SF-1024 + Ref-1024", scene: 36.4, perObj: 38.5, mem: 21.8, fMidi: 71.59, fGen: 79.68 },
] as const
