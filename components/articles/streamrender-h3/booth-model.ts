import { msin } from "@/lib/dmath"

// The projection booth's model: the same schedule ChunkClock simulates, read
// as positions of physical frames instead of as a timeline. Nothing here
// touches the DOM; the drawing and the readout both read from it.
//
// The rules are the runtime's own (see chunk-clock.tsx for the file:line of
// each): 17 RGB frames per 5 latents (1, 4, 4, 4, 4), scheduling units of
// (2, 1, 1, 1) latents, a 7-unit bootstrap then 2-unit chunks, a chunk starts
// only once every engine frame in it has arrived, the decoder releases latents
// in pairs (2k, 2k+1), and the server plays at 24 fps from the first frame and
// never skips ahead. 273 ms per chunk is the project's end-to-end p50, and the
// bootstrap is assumed to cost the same (the article's assumption).

export const FPS = 24
export const RENDER_S = 0.273
const BOOT_UNITS = 7
const CHUNK_UNITS = 2
const N_CHUNKS = 24 // ChunkClock draws 16; more chunks change no lag, they only lengthen the loop
const SPANS = [2, 1, 1, 1]

const latentFrames = (j: number) => (j % 5 === 0 ? 1 : 4)
function unitBoundary(q: number): number {
  let b = Math.floor(q / 4) * 5
  for (let i = 0; i < q % 4; i++) b += SPANS[i]!
  return b
}

export interface Chunk {
  f0: number
  f1: number
  start: number
  end: number
}

// Three servers. 0: as shipped. 1: re-syncs once after the bootstrap, then
// holds the tightest fixed lag that never runs dry. 2: the same, with a
// decoder that releases each latent as soon as its chunk is done.
export type Mode = 0 | 1 | 2

export interface Schedule {
  chunks: Chunk[]
  frames: number
  // when frame n leaves the decoder, and when it is on the screen (Infinity:
  // cut out of the pack at the re-sync and never shown)
  ready: number[]
  shown: number[]
  lag: number
  resyncAt: number
}

function base() {
  const stops: number[] = [unitBoundary(BOOT_UNITS)]
  for (let c = 1; c < N_CHUNKS; c++) stops.push(unitBoundary(BOOT_UNITS + CHUNK_UNITS * c))
  const nLat = stops[stops.length - 1]!
  const startFrame: number[] = []
  let f = 0
  for (let j = 0; j < nLat; j++) {
    startFrame.push(f)
    f += latentFrames(j)
  }
  const chunks: Chunk[] = []
  const chunkOf: number[] = []
  let prev = 0
  let busy = 0
  stops.forEach((stop, c) => {
    const f0 = startFrame[prev]!
    const f1 = startFrame[stop - 1]! + latentFrames(stop - 1)
    const start = Math.max((f1 - 1) / FPS, busy)
    const end = start + RENDER_S
    busy = end
    chunks.push({ f0, f1, start, end })
    for (let j = prev; j < stop; j++) chunkOf.push(c)
    prev = stop
  })
  const lastPaired = nLat % 2 === 0 ? nLat : nLat - 1
  const frames = startFrame[lastPaired - 1]! + latentFrames(lastPaired - 1)
  const paired: number[] = []
  const unpaired: number[] = []
  for (let j = 0; j < lastPaired; j++) {
    const partner = j % 2 === 0 ? j + 1 : j - 1
    for (let i = 0; i < latentFrames(j); i++) {
      paired.push(chunks[chunkOf[Math.max(j, partner)]!]!.end)
      unpaired.push(chunks[chunkOf[j]!]!.end)
    }
  }
  return { chunks, frames, paired, unpaired }
}

const B = base()

function paced(ready: number[]) {
  const out: number[] = []
  ready.forEach((r, n) => out.push(n === 0 ? r : Math.max(r, out[n - 1]! + 1 / FPS)))
  return out
}

function schedule(mode: Mode): Schedule {
  const ready = mode === 2 ? B.unpaired : B.paired
  const shipped = paced(ready)
  if (mode === 0) {
    let lag = 0
    for (let n = B.frames - 17; n < B.frames; n++) lag = Math.max(lag, shipped[n]! - n / FPS)
    return { chunks: B.chunks, frames: B.frames, ready, shown: shipped, lag, resyncAt: Infinity }
  }
  // ChunkClock's "re-synced once": the tightest fixed lag from chunk 2 on.
  const from = B.chunks[2]!.f0
  let lag = 0
  for (let n = from; n < B.frames; n++) lag = Math.max(lag, ready[n]! - n / FPS)
  const resyncAt = from / FPS + lag
  const shown = shipped.map((s, n) => (n >= from ? n / FPS + lag : s < resyncAt ? s : Infinity))
  return { chunks: B.chunks, frames: B.frames, ready, shown, lag, resyncAt }
}

export const SCHEDULES: Schedule[] = [schedule(0), schedule(1), schedule(2)]
export const BOOT_FRAMES = B.chunks[0]!.f1
// The engine draws frames only as far as the schedule goes; the loop must restart before.
export const LAST_T = (B.frames - 1) / FPS

// Lag as the article rounds it: 1.48 s, 0.77 s, 0.61 s.
export const lagText = (mode: Mode) => `${SCHEDULES[mode]!.lag.toFixed(2)} s`

export type Where = "hopper" | "press" | "hold" | "pack" | "screen" | "cut" | "none"

const CHUNK_OF: number[] = []
B.chunks.forEach((c, i) => {
  for (let n = c.f0; n < c.f1; n++) CHUNK_OF[n] = i
})

// The first quarter of a chunk's render is drawn as the stack moving from the
// magazine into the press; the platen's two strokes share the rest.
export const TRANSFER = 0.25

export interface Booth {
  t: number
  drawn: number // engine frames drawn so far
  hopper: number // frames in the magazine, waiting for their chunk to fill
  press: number // frames in the press
  pressFrom: number // first frame index in the press
  transfer: number // 0..1 while the stack moves from magazine to press, else 1
  stroke: number // platen travel 0..1
  strokeNo: number // 0 idle, 1 or 2
  chunkNo: number // chunk being painted (0 = the bootstrap), -1 idle
  hold: number // frames the decoder holds for their pair
  pack: number // frames on the platter: painted, not yet projected
  onScreen: number // frame on the screen, -1 before the first
  screenOn: boolean
  mark: Where
  markIndex: number // the marked frame's place in its stack or pack, from the bottom or hub
  markLag: number // stopwatch: engine draw to screen for the marked frame, s
  markDone: boolean
}

const onPack = (S: Schedule, n: number, t: number) => {
  const shown = S.shown[n]!
  return S.ready[n]! <= t && shown > t && !(shown === Infinity && t >= S.resyncAt)
}

export function boothAt(t: number, mode: Mode, mark: number): Booth {
  const S = SCHEDULES[mode]!
  const drawn = Math.min(S.frames, Math.floor(t * FPS + 1e-9) + 1)
  let started = 0
  let current = -1
  S.chunks.forEach((c, i) => {
    if (c.start <= t) started = c.f1
    if (c.start <= t && t < c.end) current = i
  })
  const hopper = Math.max(0, drawn - started)
  const cc = current >= 0 ? S.chunks[current]! : null
  const p = cc ? (t - cc.start) / (cc.end - cc.start) : 1
  const transfer = Math.min(1, p / TRANSFER)
  const q = Math.max(0, (p - TRANSFER) / (1 - TRANSFER))
  const stroke = cc && p > TRANSFER ? msin(Math.PI * ((q * 2) % 1)) : 0
  let hold = 0
  let holdFrom = -1
  let pack = 0
  let onScreen = -1
  for (let n = 0; n < S.frames; n++) {
    if (S.chunks[CHUNK_OF[n]!]!.end <= t && S.ready[n]! > t) {
      if (holdFrom < 0) holdFrom = n
      hold++
    }
    if (onPack(S, n, t)) pack++
    if (S.shown[n]! <= t) onScreen = n
  }

  let where: Where = "none"
  let index = 0
  let markLag = 0
  let markDone = false
  if (mark >= 0 && mark < S.frames && mark / FPS <= t + 1e-9) {
    const chunk = S.chunks[CHUNK_OF[mark]!]!
    const shown = S.shown[mark]!
    markLag = Math.min(t, shown === Infinity ? S.resyncAt : shown) - mark / FPS
    if (shown <= t) {
      where = mark === onScreen ? "screen" : "none"
      markDone = true
    } else if (shown === Infinity && t >= S.resyncAt) {
      where = "cut"
      markDone = true
    } else if (S.ready[mark]! <= t) {
      where = "pack"
      for (let n = 0; n < mark; n++) if (onPack(S, n, t)) index++
    } else if (chunk.end <= t) {
      where = "hold"
      index = mark - holdFrom
    } else if (chunk.start <= t) {
      where = "press"
      index = mark - chunk.f0
    } else {
      where = "hopper"
      index = mark - started
    }
  }
  return {
    t,
    drawn,
    hopper,
    press: cc ? cc.f1 - cc.f0 : 0,
    pressFrom: cc ? cc.f0 : 0,
    transfer: cc ? transfer : 1,
    stroke,
    strokeNo: cc && p > TRANSFER ? (q < 0.5 ? 1 : 2) : 0,
    chunkNo: current,
    hold,
    pack,
    onScreen,
    screenOn: onScreen >= 0,
    mark: where,
    markIndex: index,
    markLag,
    markDone,
  }
}
