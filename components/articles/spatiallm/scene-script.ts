// The scene-script format SpatialLM reads and writes, ported from
// spatiallm/layout/layout.py and spatiallm/layout/entity.py in
// manycore-research/SpatialLM (commit 8913c44). Parsing is as lenient as the
// Python: a line that does not parse is skipped, a wall with fewer than eight
// numbers is skipped, and a door or window whose wall has not been seen yet is
// dropped. No exceptions reach the caller.

// Ground-truth layout of scene0001_01 from the SpatialLM-Testset on Hugging
// Face (manycore-research/SpatialLM-Testset, layout/scene0001_01.txt,
// CC-BY-NC-4.0), verbatim: a bedroom reconstructed from a room-tour video.
export const BEDROOM = `wall_0=Wall(-5.747,-2.369,0.0,-2.843602544888373,-2.369,0.0,2.8,0.0)
wall_1=Wall(-5.747,-2.369,0.0,-5.747,1.856,0.0,2.8,0.0)
wall_2=Wall(-2.843602544888373,-2.369,0.0,-2.843602544888373,-1.6865547618435812,0.0,2.8,0.0)
wall_3=Wall(-2.843602544888373,-1.6865547618435812,0.0,-2.542,-1.6865547618435812,0.0,2.8,0.0)
wall_4=Wall(-2.542,-1.6865547618435812,0.0,-2.542,1.856,0.0,2.8,0.0)
wall_5=Wall(-5.747,1.856,0.0,-2.542,1.856,0.0,2.8,0.0)
door_0=Door(wall_4,-2.542,1.2765450439453128,1.2,0.9,2.400000094950199)
window_0=Window(wall_0,-4.29445166015625,-2.369,1.35,2.890114963302612,1.7000001540994645)
bbox_0=Bbox(curtain,-3.269912841796875,-2.2801669921875,1.964449951171875,-3.141592502593994,0.8526206651937962,0.177665852170825,2.5289)
bbox_1=Bbox(curtain,-5.30268994140625,-2.2801669921875,1.964449951171875,-3.141592502593994,0.8526206651937962,0.177665852170825,2.5289)
bbox_2=Bbox(tv,-2.57033984375,-0.32599783325195314,1.2847403564453126,-1.5707963705062866,1.4629400000000001,0.056679600000000004,0.837784)
bbox_3=Bbox(painting,-5.72892333984375,-0.055979476928710935,1.7498533935546876,1.5707963705062866,1.526000045347214,0.02601920902085304,0.9530339376568794)
bbox_4=Bbox(bed,-4.6372998046875,-0.02916869354248047,0.5004450073242187,1.5707963705062866,2.0322371588659283,2.2194000000000003,1.00089)
bbox_5=Bbox(carpet,-3.784336669921875,-0.23374969482421876,0.004338782787322998,0.0,1.9204674590206146,2.90561011824131,0.008677565725479126)
bbox_6=Bbox(tv_cabinet,-2.744951904296875,-0.24927247619628906,0.23881300354003906,-1.5707963705062866,2.0,0.39,0.477626)`

// NORMALIZATION_PRESET in entity.py, and num_bins from the 1.1 configs.
export const NUM_BINS = 1280
export const PRESET = {
  world: [0, 32],
  height: [0, 25.6],
  width: [0, 25.6],
  scale: [0, 20],
  angle: [-6.2832, 6.2832],
} as const
type Range = keyof typeof PRESET

export type Wall = { id: number; ax: number; ay: number; az: number; bx: number; by: number; bz: number; height: number; thickness: number }
export type Opening = { kind: "door" | "window"; id: number; wall: number; x: number; y: number; z: number; width: number; height: number }
export type Box = { id: number; cls: string; x: number; y: number; z: number; angle: number; sx: number; sy: number; sz: number }
export type Layout = { walls: Wall[]; openings: Opening[]; boxes: Box[]; skipped: { line: string; why: string }[] }

const WALL_RANGES: Range[] = ["world", "world", "world", "world", "world", "world", "height", "height"]
const OPEN_RANGES: Range[] = ["world", "world", "world", "width", "height"]
const BOX_RANGES: Range[] = ["world", "world", "world", "angle", "scale", "scale", "scale"]

// int(x) in Python truncates toward zero; np.clip then bounds it.
const toBin = (v: number, r: Range) => {
  const [lo, hi] = PRESET[r]
  const b = Math.trunc(((v - lo) / (hi - lo)) * NUM_BINS)
  return Math.min(NUM_BINS - 1, Math.max(0, b))
}
const fromBin = (b: number, r: Range) => {
  const [lo, hi] = PRESET[r]
  return (b / NUM_BINS) * (hi - lo) + lo
}

export type Shift = { x: number; y: number; z: number }

// Which of a record's numbers are positions (shifted before binning) per axis.
const WALL_AXES = ["x", "y", "z", "x", "y", "z", null, null] as const
const OPEN_AXES = ["x", "y", "z", null, null] as const
const BOX_AXES = ["x", "y", "z", null, null, null, null] as const

function nums(parts: string[], n: number): number[] | null {
  if (parts.length < n) return null
  const out = parts.slice(0, n).map((p) => Number(p.trim()))
  return out.every((v) => Number.isFinite(v)) && parts.slice(0, n).every((p) => p.trim() !== "") ? out : null
}

// Parse a scene script. `bins` reads integer bins and decodes them the way
// Layout.undiscretize_and_unnormalize() followed by translate(min_extent) does.
export function parse(text: string, bins: boolean, shift: Shift): Layout {
  const L: Layout = { walls: [], openings: [], boxes: [], skipped: [] }
  const seen = new Set<number>()
  const dec = (vals: number[], ranges: Range[], axes: readonly ("x" | "y" | "z" | null)[]) =>
    vals.map((v, i) => {
      const a = axes[i]
      const m = bins ? fromBin(v, ranges[i]) : v
      return bins && a ? m + shift[a] : m
    })
  for (const raw of text.replace(/^\n+/, "").split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const eq = line.indexOf("=")
    const label = eq >= 0 ? line.slice(0, eq) : line
    const [kind, idStr] = label.split("_")
    const id = Number(idStr)
    const open = line.indexOf("(")
    const close = line.indexOf(")")
    if (!Number.isInteger(id) || open < 0 || close < open) {
      L.skipped.push({ line, why: "not a record" })
      continue
    }
    const params = line.slice(open + 1, close).split(",")
    if (kind === "wall") {
      const v = nums(params, 8)
      if (!v) {
        L.skipped.push({ line, why: "a wall needs 8 numbers" })
        continue
      }
      const [ax, ay, az, bx, by, bz, height, thickness] = dec(v, WALL_RANGES, WALL_AXES)
      L.walls.push({ id, ax, ay, az, bx, by, bz, height, thickness })
      seen.add(id)
    } else if (kind === "door" || kind === "window") {
      const wid = Number((params[0] ?? "").trim().split("_")[1])
      const v = nums(params.slice(1), 5)
      if (!Number.isInteger(wid) || !v) {
        L.skipped.push({ line, why: `a ${kind} needs wall_N and 5 numbers` })
        continue
      }
      if (!seen.has(wid)) {
        L.skipped.push({ line, why: `wall_${wid} not seen yet, dropped` })
        continue
      }
      const [x, y, z, width, height] = dec(v, OPEN_RANGES, OPEN_AXES)
      L.openings.push({ kind, id, wall: wid, x, y, z, width, height })
    } else if (kind === "bbox") {
      const cls = (params[0] ?? "").trim()
      const v = nums(params.slice(1), 7)
      if (!cls || !v) {
        L.skipped.push({ line, why: "a bbox needs a class and 7 numbers" })
        continue
      }
      const [x, y, z, angle, sx, sy, sz] = dec(v, BOX_RANGES, BOX_AXES)
      L.boxes.push({ id, cls, x, y, z, angle, sx: Math.abs(sx), sy: Math.abs(sy), sz: Math.abs(sz) })
    } else {
      L.skipped.push({ line, why: `unknown entity "${kind}"` })
    }
  }
  return L
}

const r3 = (v: number) => String(Math.round(v * 1000) / 1000)

// Write a layout back out, in metres (what inference.py saves) or in bins
// (what the language model actually generates, after the positive shift).
export function serialize(L: Layout, bins: boolean, shift: Shift): string {
  const enc = (vals: number[], ranges: Range[], axes: readonly ("x" | "y" | "z" | null)[]) =>
    vals.map((v, i) => {
      if (!bins) return r3(v)
      const a = axes[i]
      return String(toBin(a ? v - shift[a] : v, ranges[i]))
    })
  const out: string[] = []
  for (const w of L.walls)
    out.push(`wall_${w.id}=Wall(${enc([w.ax, w.ay, w.az, w.bx, w.by, w.bz, w.height, w.thickness], WALL_RANGES, WALL_AXES).join(",")})`)
  for (const o of L.openings) {
    const cap = o.kind === "door" ? "Door" : "Window"
    out.push(`${o.kind}_${o.id}=${cap}(wall_${o.wall},${enc([o.x, o.y, o.z, o.width, o.height], OPEN_RANGES, OPEN_AXES).join(",")})`)
  }
  for (const b of L.boxes)
    out.push(`bbox_${b.id}=Bbox(${b.cls},${enc([b.x, b.y, b.z, b.angle, b.sx, b.sy, b.sz], BOX_RANGES, BOX_AXES).join(",")})`)
  return out.join("\n")
}

// The positive shift: inference.py subtracts the point cloud's min corner
// before binning. Without the cloud, the layout's own min corner stands in.
export function minCorner(L: Layout): Shift {
  let x = Infinity
  let y = Infinity
  for (const w of L.walls) {
    x = Math.min(x, w.ax, w.bx)
    y = Math.min(y, w.ay, w.by)
  }
  for (const b of L.boxes) {
    x = Math.min(x, b.x - Math.max(b.sx, b.sy) / 2)
    y = Math.min(y, b.y - Math.max(b.sx, b.sy) / 2)
  }
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, z: 0 }
}
