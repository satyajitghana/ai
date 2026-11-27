// Every sound in the deck is synthesized here from oscillators, noise, filters and envelopes.
// There is no audio file. The context is created on a user gesture (`M`, the sound button, or the
// first key or pointer press when the stored preference is "on"), so a silent visit never touches
// Web Audio.
//
// The graph, in the order a sound travels:
//   voice (partials, noise) -> hit bus -> placement -> speaker buses -> compressors -> soft clip -> out
//                                      -> room / hall sends (two synthesized impulse responses)
// Placement depends on the mode (`info().mode`):
//   "binaural"  the default on two channels: an HRTF `PannerNode` per hit, for headphones
//   "stereo"    `?surround=stereo`: an equal-power pan from x, nothing else
//   "5.1"       six discrete channels when the output has them (or `?surround=5.1`): hits are
//               amplitude-panned over L, R, Ls, Rs; interface clicks go to the centre; lows also
//               feed the LFE through a 100 Hz low-pass; beds and washes sit in the surrounds.

export type Snd =
  | "tick" //    a dry click (ruler notches, clock, keys)
  | "key" //     a softer typed key
  | "pluck" //   a plucked string
  | "marimba" // a wooden bar
  | "bell" //    a struck bell
  | "glass" //   a high glassy ping
  | "thud" //    a low drum with a falling pitch
  | "boom" //    a long sub drop with noise
  | "whoosh" //  filtered noise sweep
  | "rumble" //  low noise bed
  | "pad" //     a slow chord tone
  | "flap" //    a card or page flap
  | "scratch" // a pen on paper
  | "hiss" //    steam
  | "crack" //   ice or rock cracking
  | "chirp" //   one small bird
  | "knap" //    stone on stone: a sharp click with a short ring
  | "crackle" // a burst of fire crackle (`dur` sets its length)
  | "squelch" // wet clay pressed
  | "anvil" //   hammer on bronze or iron: an inharmonic ring
  | "gear" //    a ratchet meshing (`dur` sets how many teeth)
  | "thump" //   a press platen: low and wooden
  | "governor" // a rising whirr
  | "telegraph" // a sounder: a click pair (`dur` is the gap, a dot or a dash)
  | "crt" //     power-on: thunk, hum and a rising whine
  | "cards" //   a riffle
  | "stone" //   a Go stone on a wooden board
  | "teleprinter" // a key, the type bar and the carriage step
  | "shutter" // a camera shutter
  | "page" //    a paper leaf turning
  | "sub" //     a deep drop for impacts (the LFE's own sound)
  | "riser" //   a swell that ends on the cut
  | "shimmer" // a cloud of high partials
  | "splash" //  water breaking
  | "sizzle" //  hot metal quenched
  | "select" //  the selection box pop
  | "type" //    a typed character, softer than `key`
  | "delete" //  a removed character, softer and lower

/** Ambient beds a scene drives every frame from its own motion; each falls silent unless re-sent. */
export type Bed = "wind" | "water" | "hum" | "fire" | "air" | "crackle" | "projector"

/** Every musical pitch in the deck is a whole-number harmonic of one root (D1), so nothing clashes. */
export const H = (n: number) => 36.708 * n

/**
 * Where a sound is, in listener space: x right, y up (both about -1..1 across the frame), z into
 * the screen (0 on the picture plane, 1 and beyond far away and so quieter and wetter, -1 beside
 * or behind the listener). `listenerPos` makes one from a world point and a camera.
 */
export type Pos = readonly [number, number, number]

export type SndOpts = {
  /** Pitch in Hz (use `H(n)`). Given, the per-hit pitch variation shrinks to a couple of cents. */
  f?: number
  g?: number
  dur?: number
  /** Left to right, -1..1. Shorthand for `pos: [pan, 0, 0]`. */
  pan?: number
  /** Seconds from now. */
  at?: number
  /** Where the sound is. A function is called when the sound fires, for sources that move. */
  pos?: Pos | (() => Pos)
  /** Scales both reverb sends (1 = the sound's own amount, 0 = dry). */
  wet?: number
  /** Send to the LFE in 5.1 (0..1), overriding the sound's own. */
  lfe?: number
  /** Scales the seeded per-hit variation in pitch and level (1 by default, 0 for none). */
  vary?: number
}

export type Mode = "stereo" | "binaural" | "5.1"

export type SynthInfo = {
  /** The mode in use, or null before the audio graph exists. */
  mode: Mode | null
  /** `?surround=` if it named a mode. */
  forced: Mode | null
  /** Channels the graph writes and channels the output device takes. */
  channels: number
  maxChannels: number
  /** True when 5.1 was forced on an output with fewer channels and is folded down to stereo. */
  downmix: boolean
  panning: "HRTF" | "equalpower" | "amplitude" | null
  state: string
  sampleRate: number
  on: boolean
  /** One-shots played and one-shots refused by the rate limits. */
  played: number
  dropped: number
}

/** How a sound is placed when the caller gives no position. */
type Route = "pos" | "centre" | "wide"
type Meta = { r: Route; room: number; hall: number; jit: number; lfe: number; gap: number }
const meta = (r: Route, room: number, hall: number, jit: number, lfe = 0, gap = 0.018): Meta => ({ r, room, hall, jit, lfe, gap })

/** Per sound: its 5.1 class, the short and long reverb sends, pitch jitter, LFE send, minimum gap. */
const BANK: Record<Snd, Meta> = {
  tick: meta("centre", 0.1, 0, 0.02),
  key: meta("centre", 0.08, 0, 0.03),
  pluck: meta("pos", 0.1, 0.3, 0.002),
  marimba: meta("pos", 0.15, 0.25, 0.002),
  bell: meta("pos", 0, 0.4, 0.001),
  glass: meta("pos", 0, 0.4, 0.001),
  thud: meta("pos", 0.25, 0.1, 0.03, 0.5),
  boom: meta("wide", 0, 0.35, 0.03, 1),
  whoosh: meta("wide", 0, 0.3, 0.04),
  rumble: meta("wide", 0, 0.25, 0.04, 0.7),
  pad: meta("wide", 0, 0.35, 0),
  flap: meta("pos", 0.2, 0, 0.05),
  scratch: meta("pos", 0.15, 0, 0.05),
  hiss: meta("wide", 0.1, 0.2, 0.03),
  crack: meta("pos", 0.15, 0.25, 0.05),
  chirp: meta("pos", 0.1, 0.3, 0.03),
  knap: meta("pos", 0.22, 0.1, 0.03),
  crackle: meta("pos", 0.15, 0.05, 0.05),
  squelch: meta("pos", 0.2, 0, 0.06),
  anvil: meta("pos", 0.1, 0.35, 0.004),
  gear: meta("pos", 0.2, 0, 0.03),
  thump: meta("pos", 0.3, 0.05, 0.03, 0.6),
  governor: meta("pos", 0.15, 0.15, 0.02),
  telegraph: meta("centre", 0.15, 0, 0.02),
  crt: meta("pos", 0.15, 0.1, 0.01, 0.3),
  cards: meta("pos", 0.2, 0, 0.04),
  stone: meta("pos", 0.3, 0.08, 0.02),
  teleprinter: meta("centre", 0.15, 0, 0.02),
  shutter: meta("centre", 0.15, 0, 0.02),
  page: meta("pos", 0.2, 0, 0.05),
  sub: meta("pos", 0, 0.1, 0.01, 1),
  riser: meta("wide", 0, 0.3, 0.01),
  shimmer: meta("wide", 0, 0.5, 0.001),
  splash: meta("pos", 0.15, 0.3, 0.04),
  sizzle: meta("pos", 0.15, 0.05, 0.04),
  select: meta("centre", 0.08, 0, 0.01),
  type: meta("centre", 0.06, 0, 0.04),
  delete: meta("centre", 0.06, 0, 0.04),
}

export const SOUNDS = Object.keys(BANK) as Snd[]
export const BEDS: Bed[] = ["wind", "water", "hum", "fire", "air", "crackle", "projector"]

const BED_LEVEL: Record<Bed, number> = { wind: 0.22, water: 0.3, hum: 0.05, fire: 0.6, air: 0.05, crackle: 0.5, projector: 0.3 }

/** At most this many one-shots may start inside any 120 ms. */
const MAX_HITS = 26
const WINDOW = 0.12
const MASTER = 0.9
const PREF_KEY = "universe:sound"

/** The stored choice: true once the visitor has turned sound on and not off again. */
export function soundPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === "1"
  } catch {
    return false
  }
}

export function storeSoundPref(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "1" : "0")
  } catch {
    // private mode or blocked storage: the choice lasts for this visit only
  }
}

/** A small seeded generator (mulberry32): the same deck makes the same variations every run. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)

type Mat = { elements: ArrayLike<number> }

/**
 * A world-space point as the listener hears it: where it is on screen (x right, y up, -1..1 at the
 * frame's edges) and how deep (z = 0 at `focus`, the distance of the scene's subject from the
 * camera, by default the camera's distance from the world origin; 1 at twice that; -1 at the
 * camera). Call `camera.updateMatrixWorld()` first if you moved the camera this frame. Pass `out`
 * to reuse a tuple instead of allocating one.
 */
export function listenerPos(
  p: { x: number; y: number; z: number },
  camera: { matrixWorldInverse: Mat; projectionMatrix: Mat },
  focus?: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const v = camera.matrixWorldInverse.elements
  const P = camera.projectionMatrix.elements
  const vx = v[0] * p.x + v[4] * p.y + v[8] * p.z + v[12]
  const vy = v[1] * p.x + v[5] * p.y + v[9] * p.z + v[13]
  const vz = v[2] * p.x + v[6] * p.y + v[10] * p.z + v[14]
  const f = focus ?? (Math.sqrt(v[12] * v[12] + v[13] * v[13] + v[14] * v[14]) || 1)
  // behind a perspective camera the projection flips: divide by a small positive depth instead
  const w0 = P[3] * vx + P[7] * vy + P[11] * vz + P[15]
  const w = P[11] !== 0 ? Math.max(w0, f * 0.05) : w0 || 1
  out[0] = clamp((P[0] * vx + P[4] * vy + P[8] * vz + P[12]) / w, -1.5, 1.5)
  out[1] = clamp((P[1] * vx + P[5] * vy + P[9] * vz + P[13]) / w, -1.5, 1.5)
  out[2] = clamp((-vz - f) / f, -1, 4)
  return out
}

type BedState = { g: GainNode[]; want: number; age: number }

export class Synth {
  on = false
  private ac: BaseAudioContext | null = null
  private mode: Mode = "binaural"
  private forced: Mode | null = null
  private downmix = false
  private master: GainNode | null = null
  /** Stereo input of the front pair. */
  private front: GainNode | null = null
  /** In 5.1, one mono input per speaker: L, R, C, LFE, Ls, Rs. */
  private spk: GainNode[] | null = null
  private roomIn: GainNode | null = null
  private hallIn: GainNode | null = null
  private noise: AudioBuffer | null = null
  private beds = new Map<Bed, BedState>()
  /** The bus the voice being built connects to. */
  private hb: GainNode | null = null
  private rnd = rng(0x5eed)
  private recent: number[] = []
  private last = new Map<string, number[]>()
  private played = 0
  private dropped = 0

  /** Each sound's 5.1 class (`r`), reverb sends, pitch jitter, LFE send and minimum gap. */
  static readonly bank: Readonly<Record<Snd, Readonly<Meta>>> = BANK

  /** `ctx` and `mode` are for rendering offline (see `Synth.render`); the deck passes nothing. */
  constructor(private readonly opt: { ctx?: BaseAudioContext; mode?: Mode } = {}) {}

  enable(on: boolean) {
    this.on = on
    if (on && !this.ac) {
      try {
        this.build()
      } catch (e) {
        console.warn("[universe] no audio:", e)
        this.ac = null
        this.on = false
        return
      }
    } else if (this.ac && this.master) this.master.gain.setTargetAtTime(on ? MASTER : 0, this.ac.currentTime, 0.05)
    if (on) this.resume()
  }

  /** Browsers start a context suspended unless a gesture made it: call this from any later gesture. */
  resume() {
    const ac = this.ac
    if (!this.on || !ac || this.opt.ctx || ac.state !== "suspended") return
    void (ac as AudioContext).resume().catch(() => {})
  }

  info(): SynthInfo {
    const ac = this.ac
    return {
      mode: ac ? this.mode : null,
      forced: this.forced,
      channels: ac ? (this.mode === "5.1" ? 6 : 2) : 0,
      maxChannels: ac ? ac.destination.maxChannelCount : 0,
      downmix: this.downmix,
      panning: !ac ? null : this.mode === "binaural" ? "HRTF" : this.mode === "5.1" ? "amplitude" : "equalpower",
      state: ac ? ac.state : "none",
      sampleRate: ac ? ac.sampleRate : 0,
      on: this.on,
      played: this.played,
      dropped: this.dropped,
    }
  }

  // ------------------------------------------------------------------ the graph

  private build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = this.opt.ctx ?? new AC()
    this.ac = ac
    const dest = ac.destination
    let q: string | null = null
    try {
      q = new URLSearchParams(window.location.search).get("surround")
    } catch {
      // no location (a worker, a test): no flag
    }
    this.forced = q === "5.1" || q === "stereo" || q === "binaural" ? q : null
    const mode: Mode = this.opt.mode ?? this.forced ?? (dest.maxChannelCount >= 6 ? "5.1" : "binaural")
    this.mode = mode

    // master: everything -> soft clip -> out. The clip's curve spans inputs of ±2 (hence the half
    // gain before it), is linear near zero and levels off at 0.9, so nothing leaves above that.
    const master = ac.createGain()
    master.gain.value = MASTER
    const clipIn = ac.createGain()
    clipIn.gain.value = 0.5
    const clip = ac.createWaveShaper()
    const curve = new Float32Array(2049)
    for (let i = 0; i < curve.length; i++) curve[i] = 0.9 * Math.tanh(((i / (curve.length - 1)) * 4 - 2) / 0.9)
    clip.curve = curve
    clipIn.connect(clip)
    clip.connect(master)
    master.connect(dest)
    this.master = master
    const comp = (threshold = -14) => {
      const c = ac.createDynamicsCompressor()
      c.threshold.value = threshold
      c.ratio.value = 5
      c.knee.value = 10
      c.attack.value = 0.004
      c.release.value = 0.22
      return c
    }
    const mono = () => {
      const g = ac.createGain()
      g.channelCount = 1
      g.channelCountMode = "explicit"
      return g
    }
    const front = ac.createGain()
    this.front = front
    let rear: GainNode | null = null
    if (mode === "5.1") {
      // Six discrete channels. A compressor carries two channels at most, so each speaker group
      // has its own: the front pair (linked), the centre, the LFE and the surround pair.
      const set = (f: () => void) => {
        try {
          f()
        } catch {
          // an output with fewer channels, or an offline destination whose layout is fixed
        }
      }
      set(() => {
        if (dest.channelCount !== 6) dest.channelCount = 6
      })
      set(() => {
        dest.channelCountMode = "explicit"
      })
      const six = dest.channelCount >= 6
      if (six)
        set(() => {
          dest.channelInterpretation = "discrete"
        })
      this.downmix = !six
      const out6 = ac.createChannelMerger(6)
      const spk = [0, 1, 2, 3, 4, 5].map(mono)
      this.spk = spk
      rear = ac.createGain()
      const pair = (bus: GainNode, l: GainNode, r: GainNode, a: number, b: number) => {
        const m = ac.createChannelMerger(2)
        l.connect(m, 0, 0)
        r.connect(m, 0, 1)
        m.connect(bus)
        const c = comp()
        bus.connect(c)
        const sp = ac.createChannelSplitter(2)
        c.connect(sp)
        sp.connect(out6, 0, a)
        sp.connect(out6, 1, b)
      }
      pair(front, spk[0], spk[1], 0, 1)
      pair(rear, spk[4], spk[5], 4, 5)
      const cc = comp()
      spk[2].connect(cc)
      cc.connect(out6, 0, 2)
      // The LFE only ever carries what is under about 100 Hz (two biquads: 24 dB an octave). The
      // filter comes after its compressor, which is slow, so neither puts harmonics back.
      const lp1 = ac.createBiquadFilter()
      lp1.type = "lowpass"
      lp1.frequency.value = 100
      lp1.Q.value = 0.54
      const lp2 = ac.createBiquadFilter()
      lp2.type = "lowpass"
      lp2.frequency.value = 100
      lp2.Q.value = 1.31
      const lc = comp(-12)
      lc.attack.value = 0.03
      spk[3].connect(lc)
      lc.connect(lp1)
      lp1.connect(lp2)
      const lg = ac.createGain()
      lg.gain.value = 0.8
      lp2.connect(lg)
      lg.connect(out6, 0, 3)
      if (six) out6.connect(clipIn)
      else {
        // forced on a stereo output: fold down by the standard matrix, then clip
        const fold = ac.createGain()
        fold.channelCount = 2
        fold.channelCountMode = "explicit"
        fold.channelInterpretation = "speakers"
        out6.connect(fold)
        fold.connect(clipIn)
      }
    } else {
      const c = comp()
      front.connect(c)
      c.connect(clipIn)
    }

    // The rooms are synthesized too: impulse responses of decaying noise that darkens as it dies,
    // behind a few early reflections. A short one for things in a room, a long one for space.
    const verb = (secs: number, decay: number, dark: number, wet: number, seed: number) => {
      const input = mono()
      const run = (to: AudioNode, sd: number, level: number) => {
        const cv = ac.createConvolver()
        cv.buffer = this.ir(secs, decay, dark, sd)
        const g = ac.createGain()
        g.gain.value = level
        input.connect(cv)
        cv.connect(g)
        g.connect(to)
      }
      run(front, seed, wet)
      if (rear) run(rear, seed + 4242, wet * 0.85)
      return input
    }
    this.roomIn = verb(0.45, 5.5, 0.3, 0.9, 1234)
    this.hallIn = verb(2.6, 5.4, 0.6, 1, 9876)

    const len = Math.floor(ac.sampleRate * 2)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d = buf.getChannelData(0)
    let s = 22222
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647
      d[i] = (s / 2147483647) * 2 - 1
    }
    this.noise = buf
  }

  private ir(secs: number, decay: number, dark: number, seed: number) {
    const ac = this.ac!
    const n = Math.floor(ac.sampleRate * secs)
    const ir = ac.createBuffer(2, n, ac.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      const r = rng(seed + ch * 7919)
      let lp = 0
      for (let i = 0; i < n; i++) {
        const x = i / n
        lp += (r() * 2 - 1 - lp) * (0.78 - dark * x)
        d[i] = lp * Math.exp(-decay * x) * (i < 300 ? i / 300 : 1)
      }
      for (let k = 0; k < 6; k++) {
        const i = Math.floor((0.004 + r() * 0.045) * ac.sampleRate)
        if (i < n) d[i] += (r() > 0.5 ? 0.7 : -0.7) * (1 - k / 8)
      }
    }
    return ir
  }

  /** `lvl(0.5, dest)` is an input to a node (or a parameter) that arrives at half level. */
  private lvl(v: number, dest: AudioNode | AudioParam) {
    const g = this.ac!.createGain()
    g.gain.value = v
    g.connect(dest as AudioNode)
    return g
  }

  /** Connect a hit bus to the speakers and the reverbs, by mode, class and position. */
  private place(out: GainNode, m: Meta, o: SndOpts) {
    const ac = this.ac!
    const p = typeof o.pos === "function" ? o.pos() : o.pos
    const has = !!p || o.pan !== undefined
    const x = clamp(p ? p[0] : (o.pan ?? 0), -1.5, 1.5)
    const y = p ? p[1] : 0
    const z = clamp(p ? p[2] : 0, -1, 4)
    const far = Math.max(0, z)
    // farther is quieter and wetter, the same in every mode
    out.gain.value = 1 / (1 + 0.7 * far)
    const wet = (o.wet ?? 1) * (1 + 0.6 * far)
    if (m.room * wet > 0) out.connect(this.lvl(m.room * wet, this.roomIn!))
    if (m.hall * wet > 0) out.connect(this.lvl(m.hall * wet, this.hallIn!))
    const cls: Route = has ? "pos" : m.r
    const spk = this.spk
    if (spk) {
      if (cls === "centre") out.connect(spk[2])
      else if (cls === "wide") {
        const f = this.lvl(0.6, spk[0])
        f.connect(spk[1])
        const r = this.lvl(0.45, spk[4])
        r.connect(spk[5])
        out.connect(f)
        out.connect(r)
      } else {
        // equal power, left to right and front to back
        const a = ((clamp(x, -1, 1) + 1) / 2) * (Math.PI / 2)
        const b = clamp(-z, 0, 1) * (Math.PI / 2)
        const gains = [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), 0, 0, Math.cos(a) * Math.sin(b), Math.sin(a) * Math.sin(b)]
        for (let i = 0; i < 6; i++) if (gains[i] > 0.001) out.connect(this.lvl(gains[i], spk[i]))
      }
      const lfe = o.lfe ?? m.lfe
      if (lfe > 0) out.connect(this.lvl(lfe, spk[3]))
      return
    }
    const front = this.front!
    if (cls !== "pos") {
      out.connect(this.lvl(Math.SQRT1_2, front))
      return
    }
    if (this.mode === "binaural") {
      // the screen is one unit in front; z < 0 comes round beside and behind the head
      const pn = ac.createPanner()
      pn.panningModel = "HRTF"
      pn.distanceModel = "inverse"
      pn.rolloffFactor = 0
      pn.positionX.value = x * 1.7
      pn.positionY.value = y * 0.8
      pn.positionZ.value = z >= 0 ? -(1 + 1.5 * z) : -(1 + 2 * z)
      // an HRTF hands both ears the whole signal and lifts the lows: trimmed to sit where the pan does
      out.connect(pn)
      pn.connect(this.lvl(0.75, front))
    } else {
      const sp = ac.createStereoPanner()
      sp.pan.value = clamp(x, -1, 1)
      out.connect(sp)
      sp.connect(front)
    }
  }

  /** Rate limits (a gap per sound and pitch, a cap per 120 ms), on the time a sound is scheduled for (cues queue dozens with `at` in one call). */
  private admit(name: string, t: number, gap: number) {
    const now = this.ac!.currentTime
    if (this.recent.length > 96) this.recent = this.recent.filter((x) => x > now - 0.2)
    let n = 0
    for (const x of this.recent) if (x > t - WINDOW / 2 && x < t + WINDOW / 2) n++
    if (n >= MAX_HITS) return false
    let mine = this.last.get(name)
    if (!mine) this.last.set(name, (mine = []))
    else if (mine.length > 48) this.last.set(name, (mine = mine.filter((x) => x > now - 0.2)))
    for (const x of mine) if (Math.abs(x - t) < gap) return false
    mine.push(t)
    this.recent.push(t)
    return true
  }

  // ------------------------------------------------------------------ the kit

  /** An attack-decay envelope into the current hit bus. */
  private env(g: number, t: number, a: number, d: number) {
    const v = this.ac!.createGain()
    v.gain.setValueAtTime(0.0001, t)
    v.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t + a)
    v.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
    v.connect(this.hb!)
    return v
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode, f2?: number) {
    const o = this.ac!.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur)
    o.connect(dest)
    o.start(t)
    o.stop(t + dur + 0.05)
    return o
  }

  /** Looped noise through one filter; returns the filter so a caller can schedule more of a sweep. */
  private nz(t: number, dur: number, dest: AudioNode, type: BiquadFilterType, f: number, q = 1, f2?: number) {
    const ac = this.ac!
    const src = ac.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const bq = ac.createBiquadFilter()
    bq.type = type
    bq.Q.value = q
    bq.frequency.setValueAtTime(f, t)
    if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t + dur)
    src.connect(bq)
    bq.connect(dest)
    src.start(t, (t * 7.13) % 1.5)
    src.stop(t + dur + 0.05)
    return bq
  }

  /** One decaying sine partial: the unit of everything struck. */
  private part(f: number, g: number, t: number, d: number, a = 0.001, f2?: number) {
    if (f < 18000) this.osc("sine", f, t, a + d, this.env(g, t, a, d), f2)
  }

  /** A struck body: partials as [ratio, level, decay] over one base pitch. */
  private modes(base: number, g: number, t: number, list: readonly (readonly [number, number, number])[]) {
    for (const [m, a, d] of list) this.part(base * m, a * g, t, d)
  }

  /** A short burst of filtered noise: the contact in every click. */
  private click(t: number, g: number, d: number, type: BiquadFilterType, f: number, q = 1, f2?: number) {
    return this.nz(t, d, this.env(g, t, 0.001, d), type, f, q, f2)
  }

  /** An oscillator wobbling a parameter around its value. */
  private lfo(param: AudioParam, hz: number, depth: number, t: number, dur: number, type: OscillatorType = "sine", hz2?: number) {
    this.osc(type, hz, t, dur, this.lvl(depth, param), hz2)
  }

  // ------------------------------------------------------------------ the instruments

  play(name: Snd, o: SndOpts = {}) {
    if (!this.on || !this.ac) return
    const m = BANK[name]
    if (!m) return
    const ac = this.ac
    const t = ac.currentTime + 0.01 + Math.max(0, o.at ?? 0)
    // the gap is per sound and pitch: two notes of a chord are two sounds, the same note twice is a flam
    if (!this.admit(o.f === undefined ? name : name + o.f, t, m.gap)) {
      this.dropped++
      return
    }
    this.played++
    // small seeded differences so a repeated sound is never the same sound twice; a caller's own
    // pitch is held to a couple of cents so the tuning stays on the root
    const r = this.rnd
    const vary = o.vary ?? 1
    const pm = 1 + (r() * 2 - 1) * (o.f !== undefined ? Math.min(m.jit, 0.0012) : m.jit) * vary
    const g = (o.g ?? 1) * (1 + (r() * 2 - 1) * 0.07 * vary)
    const f = o.f !== undefined ? o.f * pm : undefined
    const hb = ac.createGain()
    this.hb = hb
    this.place(hb, m, o)
    switch (name) {
      case "tick":
        this.click(t, 0.5 * g, 0.03, "bandpass", f ?? 3200 * pm, 3)
        break
      case "key":
        this.click(t, 0.22 * g, 0.04, "bandpass", f ?? 1900 * pm, 2)
        this.part(180, 0.12 * g, t, 0.03)
        break
      case "pluck": {
        const b = f ?? 220 * pm
        const lp = ac.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.setValueAtTime(5200, t)
        lp.frequency.exponentialRampToValueAtTime(500, t + 0.5)
        lp.connect(this.env(0.34 * g, t, 0.003, o.dur ?? 0.9))
        this.osc("sawtooth", b, t, 1, lp)
        this.osc("triangle", b * 2.003, t, 1, lp)
        break
      }
      case "marimba": {
        const b = f ?? 330 * pm
        this.part(b, 0.5 * g, t, 0.42, 0.002)
        this.part(b * 3.93, 0.14 * g, t, 0.09)
        break
      }
      case "bell":
        this.modes(f ?? 660 * pm, g, t, [[1, 0.3, 2.6], [2.76, 0.16, 1.5], [5.4, 0.09, 0.8], [8.93, 0.05, 0.4]])
        break
      case "glass":
        this.modes(f ?? 1760 * pm, g, t, [[1, 0.2, 1.4], [2.41, 0.1, 0.9], [4.2, 0.05, 0.5]])
        break
      case "thud":
        this.part(f ?? 120 * pm, 0.9 * g, t, 0.28, 0.002, 38)
        this.click(t, 0.2 * g, 0.05, "lowpass", 900)
        break
      case "boom": {
        const d = o.dur ?? 3.2
        this.part(f ?? 70 * pm, 1.0 * g, t, d, 0.01, 24)
        this.nz(t, d, this.env(0.55 * g, t, 0.005, d * 0.8), "lowpass", 1800, 0.7, 60)
        break
      }
      case "whoosh": {
        const d = o.dur ?? 1.1
        const b = f ?? 300 * pm
        this.nz(t, d, this.env(0.3 * g, t, d * 0.45, d * 0.55), "bandpass", b, 0.9, b * 7)
        break
      }
      case "rumble": {
        const d = o.dur ?? 4
        this.nz(t, d, this.env(0.5 * g, t, d * 0.3, d * 0.7), "lowpass", f ?? 110 * pm, 0.8)
        break
      }
      case "pad": {
        const d = o.dur ?? 5
        const b = f ?? 110
        const lp = ac.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.value = 900
        lp.connect(this.env(0.1 * g, t, d * 0.4, d * 0.6))
        for (const k of [1, 1.004, 1.498, 2.003]) this.osc("sawtooth", b * k, t, d, lp)
        break
      }
      case "flap":
        this.click(t, 0.4 * g, 0.09, "bandpass", f ?? 700 * pm, 0.8, 240)
        break
      case "scratch": {
        const d = o.dur ?? 0.22
        const b = f ?? 4200 * pm
        this.nz(t, d, this.env(0.1 * g, t, 0.02, d), "bandpass", b, 2.5, b * 0.7)
        break
      }
      case "hiss": {
        const d = o.dur ?? 1.6
        this.nz(t, d, this.env(0.14 * g, t, d * 0.2, d * 0.8), "highpass", 4500 * pm, 0.6)
        break
      }
      case "crack":
        this.click(t, 0.6 * g, 0.12, "bandpass", f ?? 1400 * pm, 0.7, 300)
        this.click(t + 0.03, 0.5 * g, 0.02, "highpass", 5000)
        break
      case "chirp": {
        const b = f ?? 3200 * pm
        this.part(b, 0.12 * g, t, 0.07, 0.005, b * 1.5)
        this.part(b * 1.3, 0.1 * g, t + 0.11, 0.06, 0.005, b * 0.9)
        break
      }
      case "knap": {
        // flint on flint: the contact, a short bright ring from the flake, the weight of the core
        const b = f ?? H(64) * pm
        this.click(t, 0.7 * g, 0.004, "highpass", 2600)
        this.modes(b, g, t, [[1, 0.26, 0.07], [1.62, 0.16, 0.045], [2.45, 0.09, 0.03]])
        this.part(430 * pm, 0.3 * g, t, 0.022, 0.001, 300)
        break
      }
      case "crackle": {
        // a handful of pops: each a few milliseconds of noise at its own brightness
        const d = o.dur ?? 0.6
        const n = Math.max(3, Math.round(d * 24))
        for (let i = 0; i < n; i++) {
          const ti = t + r() * d
          const a = r()
          this.click(ti, (0.12 + 0.5 * a * a) * g, 0.002 + r() * 0.006, "bandpass", (1300 + r() * 4700) * pm, 0.8 + r() * 2)
        }
        for (let i = 0; i < Math.ceil(n / 7); i++) this.part(170 + r() * 60, 0.3 * g, t + r() * d, 0.02, 0.001, 90)
        break
      }
      case "squelch": {
        // wet clay: a resonant band that opens and closes like a mouth, over a soft low press
        const b = f ?? 320 * pm
        const bq = this.nz(t, 0.24, this.env(0.55 * g, t, 0.03, 0.2), "bandpass", b, 6, b * 3)
        bq.frequency.exponentialRampToValueAtTime(b * 0.8, t + 0.34)
        this.click(t + 0.1, 0.22 * g, 0.07, "bandpass", 1300 * pm, 9, 480)
        this.part(140 * pm, 0.4 * g, t, 0.12, 0.012, 70)
        break
      }
      case "anvil": {
        // a bar of metal has no harmonic series: these ratios are what makes it iron and not a bell
        const b = f ?? H(22) * pm
        this.click(t, 0.5 * g, 0.005, "highpass", 3200)
        this.modes(b, g, t, [[1, 0.26, 1.5], [1.48, 0.2, 1.1], [2.37, 0.17, 0.85], [3.12, 0.11, 0.6], [4.63, 0.08, 0.4], [5.91, 0.05, 0.25], [7.77, 0.03, 0.14]])
        this.part(190, 0.35 * g, t, 0.05, 0.001, 110)
        break
      }
      case "gear": {
        // a pawl dropping into teeth, then the wheel seating
        const d = o.dur ?? 0.16
        const n = Math.max(2, Math.round(d / 0.03))
        const b = f ?? H(40) * pm
        for (let i = 0; i < n; i++) {
          const ti = t + (i + (r() - 0.5) * 0.25) * (d / n)
          this.click(ti, (0.26 + 0.08 * r()) * g, 0.008, "bandpass", 2400 * pm, 4)
          this.part(b * (1 + 0.012 * i), 0.07 * g, ti, 0.016)
        }
        this.part(220, 0.3 * g, t + d, 0.05, 0.001, 140)
        this.click(t + d, 0.2 * g, 0.012, "bandpass", 1500, 2)
        break
      }
      case "thump": {
        // a wooden platen coming down: the low body, two bar modes of the frame, the slap of contact
        const b = f ?? H(2) * pm
        this.part(b, 0.95 * g, t, 0.22, 0.003, b * 0.62)
        this.modes(b, g, t, [[2.7, 0.2, 0.09], [4.3, 0.1, 0.06]])
        this.click(t, 0.3 * g, 0.03, "lowpass", 520)
        break
      }
      case "governor": {
        // a spinning thing winding up: pitch, brightness and flutter all rise together
        const d = o.dur ?? 1.8
        const b = f ?? H(3) * pm
        const trem = this.lvl(0.6, this.env(0.2 * g, t, d * 0.7, d * 0.3))
        this.lfo(trem.gain, 5, 0.35, t, d, "sine", 24)
        const bp = ac.createBiquadFilter()
        bp.type = "bandpass"
        bp.Q.value = 2.5
        bp.frequency.setValueAtTime(b * 3, t)
        bp.frequency.exponentialRampToValueAtTime(b * 9, t + d)
        bp.connect(trem)
        this.osc("sawtooth", b, t, d, bp, b * 3)
        this.osc("sawtooth", b * 1.006, t, d, bp, b * 3.01)
        this.nz(t, d, this.lvl(0.5, trem), "bandpass", 500, 2, 2400)
        break
      }
      case "telegraph": {
        // a sounder speaks twice: the armature down on the anvil, then up against the stop
        const gap = o.dur ?? 0.075
        const b = f ?? H(48) * pm
        this.click(t, 0.4 * g, 0.006, "bandpass", 1900 * pm, 3)
        this.part(320, 0.2 * g, t, 0.02)
        this.part(b, 0.07 * g, t, 0.035)
        this.click(t + gap, 0.3 * g, 0.005, "bandpass", 2700 * pm, 3)
        this.part(480, 0.12 * g, t + gap, 0.015)
        this.part(b * 1.33, 0.04 * g, t + gap, 0.025)
        break
      }
      case "crt": {
        // the relay thunk, the degauss buzz dying away, the flyback whine climbing out of hearing
        const d = o.dur ?? 1.4
        this.part(110 * pm, 0.7 * g, t, 0.13, 0.002, 45)
        this.click(t, 0.25 * g, 0.03, "lowpass", 320)
        const lp = ac.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.value = 420
        const buzz = this.lvl(0.7, this.env(0.22 * g, t + 0.02, 0.01, d * 0.45))
        this.lfo(buzz.gain, 50, 0.3, t, d * 0.5)
        lp.connect(buzz)
        this.osc("sawtooth", H(3), t + 0.02, d * 0.5, lp)
        this.part(f ?? 4800 * pm, 0.05 * g, t + 0.05, d, 0.12, 12500)
        this.nz(t + 0.04, 0.3, this.env(0.05 * g, t + 0.04, 0.03, 0.27), "highpass", 6500, 0.6)
        break
      }
      case "cards": {
        // a riffle: flaps that come faster and louder, then the deck squared with a tap
        const d = o.dur ?? 0.45
        const n = Math.max(6, Math.round(d * 32))
        for (let i = 0; i < n; i++) {
          const u = i / n
          this.click(t + d * Math.pow(u, 0.8), (0.1 + 0.16 * u) * g, 0.007, "bandpass", (1500 + 1100 * r()) * pm, 1.2)
        }
        this.part(200, 0.12 * g, t + d + 0.01, 0.03)
        this.click(t + d + 0.01, 0.14 * g, 0.012, "bandpass", 900, 1)
        break
      }
      case "stone": {
        // slate on kaya: the click of the stone, then the hollow board answering
        const b = f ?? H(6) * pm
        this.click(t, 0.55 * g, 0.004, "bandpass", 3300 * pm, 2)
        this.modes(1850 * pm, g, t, [[1, 0.16, 0.028], [1.57, 0.09, 0.02]])
        this.part(b, 0.5 * g, t, 0.09, 0.001, b * 0.92)
        this.part(b * 1.72, 0.2 * g, t, 0.05)
        break
      }
      case "teleprinter": {
        // the key, the type bar on the platen, the carriage stepping on
        const b = f ?? H(52) * pm
        this.click(t, 0.2 * g, 0.008, "bandpass", 1500 * pm, 2)
        this.part(240, 0.16 * g, t, 0.025)
        this.click(t + 0.035, 0.2 * g, 0.005, "highpass", 2500)
        this.part(b, 0.07 * g, t + 0.035, 0.028)
        this.part(150, 0.22 * g, t + 0.035, 0.03)
        this.click(t + 0.072, 0.14 * g, 0.004, "bandpass", 3200 * pm, 4)
        this.click(t + 0.09, 0.1 * g, 0.004, "bandpass", 3500 * pm, 4)
        break
      }
      case "shutter": {
        // curtain open, curtain shut, and the spring singing between them
        const gap = o.dur ?? 0.045
        for (const [dt, a] of [[0, 0.4], [gap, 0.32]]) {
          this.click(t + dt, a * g, 0.006, "bandpass", 3800 * pm, 1.5)
          this.part(260, a * 0.5 * g, t + dt, 0.03, 0.001, 180)
        }
        this.part(f ?? H(120) * pm, 0.03 * g, t, 0.06)
        break
      }
      case "page": {
        // a leaf of paper turning: a brightening rustle that flutters and falls
        const d = o.dur ?? 0.28
        const b = f ?? 900 * pm
        const flut = this.lvl(0.65, this.env(0.32 * g, t, d * 0.3, d * 0.7))
        this.lfo(flut.gain, 28, 0.35, t, d, "triangle")
        const bq = this.nz(t, d * 0.45, flut, "bandpass", b, 0.9, b * 2.7)
        bq.frequency.exponentialRampToValueAtTime(b * 0.55, t + d)
        this.click(t + d * 0.92, 0.12 * g, 0.03, "bandpass", 600, 0.8, 300)
        break
      }
      case "sub": {
        // felt more than heard: a sine dropping an octave, with one overtone so small speakers find it
        const d = o.dur ?? 1.8
        const b = f ?? H(1.5) * pm
        this.part(b, 1.0 * g, t, d, 0.008, b / 2)
        this.part(b * 2, 0.16 * g, t, d * 0.4, 0.008, b)
        this.click(t, 0.15 * g, 0.04, "lowpass", 200)
        break
      }
      case "riser": {
        // noise and a tone climbing into the cut, released the moment it lands
        const d = o.dur ?? 2.2
        const b = f ?? H(4)
        this.nz(t, d, this.env(0.3 * g, t, d * 0.95, d * 0.05), "bandpass", 250, 1.5, 5200)
        const lp = ac.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.setValueAtTime(400, t)
        lp.frequency.exponentialRampToValueAtTime(5000, t + d)
        lp.connect(this.env(0.09 * g, t, d * 0.95, d * 0.05))
        this.osc("sawtooth", b, t, d, lp, b * 4)
        this.osc("sawtooth", b * 1.5, t, d, lp, b * 6.02)
        break
      }
      case "shimmer": {
        // harmonics of the root arriving one after another, each with a twin a hair sharp so they beat
        const d = o.dur ?? 2.2
        const k = (f ?? H(48)) / 48
        for (const n of [48, 54, 64, 72, 81, 96, 108]) {
          const ti = t + r() * 0.3
          const di = d * (0.7 + 0.5 * r())
          this.part(k * n, 0.045 * g, ti, di, 0.05)
          this.part(k * n * 1.003, 0.03 * g, ti + 0.02, di * 0.8, 0.05)
        }
        this.nz(t, d * 0.5, this.env(0.02 * g, t, 0.1, d * 0.4), "highpass", 8000, 0.5)
        break
      }
      case "splash": {
        // the body of water, the spray above it, the plop, and a few drops coming back down
        const d = o.dur ?? 0.6
        this.nz(t, d, this.env(0.45 * g, t, 0.006, d), "lowpass", 2600 * pm, 0.6, 380)
        this.nz(t, d * 0.7, this.env(0.2 * g, t, 0.03, d * 0.65), "highpass", 3500, 0.6)
        this.part(f ?? 320 * pm, 0.4 * g, t, 0.1, 0.003, 110)
        for (let i = 0; i < 5; i++) {
          const b = 800 + r() * 900
          this.part(b, 0.07 * g, t + 0.1 + r() * d * 0.8, 0.035, 0.003, b * 1.7)
        }
        break
      }
      case "sizzle": {
        // hot metal in water: bright noise that spits, quick to arrive and slow to settle
        const d = o.dur ?? 1.2
        const spit = this.lvl(0.6, this.env(0.2 * g, t, 0.03, d))
        this.lfo(spit.gain, 31, 0.3, t, d, "sawtooth", 19)
        this.nz(t, d, spit, "highpass", 5200 * pm, 0.7)
        this.nz(t, d, this.lvl(0.6, spit), "bandpass", 7600, 2.5, 3800)
        for (let i = 0; i < 8; i++) this.click(t + r() * d * 0.7, (0.06 + 0.1 * r()) * g, 0.004, "bandpass", 3000 + r() * 4000, 2)
        break
      }
      case "select": {
        // the selection box landing: a small rising blip on two harmonics of the root
        const b = f ?? H(24)
        this.part(b, 0.24 * g, t, 0.05, 0.002, b * 1.5)
        this.click(t, 0.12 * g, 0.004, "bandpass", 4000 * pm, 2)
        break
      }
      case "type":
        this.click(t, 0.12 * g, 0.025, "bandpass", f ?? 1700 * pm, 1.5)
        this.part(160, 0.06 * g, t, 0.02)
        break
      case "delete":
        this.click(t, 0.1 * g, 0.03, "bandpass", f ?? 1100 * pm, 1.5, 700)
        this.part(130, 0.06 * g, t, 0.025)
        break
    }
    this.hb = null
  }

  // ------------------------------------------------------------------ the beds

  /** Four seconds of fire crackle: pops of every size at seeded moments, and now and then a snap. */
  private crackleBuf(seed: number) {
    const ac = this.ac!
    const sr = ac.sampleRate
    const n = Math.floor(sr * 4)
    const buf = ac.createBuffer(1, n, sr)
    const d = buf.getChannelData(0)
    const r = rng(seed)
    for (let k = 0; k < 64; k++) {
      const i0 = Math.floor(r() * (n - sr * 0.05))
      const a = r()
      const amp = 0.05 + 0.9 * a * a * a
      const len = Math.floor(sr * (0.001 + r() * 0.007))
      const c = 0.3 + r() * 0.65
      let lp = 0
      for (let j = 0; j < len; j++) {
        lp += (r() * 2 - 1 - lp) * c
        d[i0 + j] += lp * amp * Math.exp((-5 * j) / len)
      }
      if (k % 16 === 0) {
        const m = Math.floor(sr * 0.03)
        const hz = 120 + r() * 80
        for (let j = 0; j < m; j++) d[i0 + j] += 0.35 * Math.sin((2 * Math.PI * hz * j) / sr) * Math.exp((-6 * j) / m)
      }
    }
    return buf
  }

  /** One second of film transport at 24 frames: the claw, the softer return, the shutter's flutter. */
  private projectorBuf(seed: number) {
    const ac = this.ac!
    const sr = ac.sampleRate
    const frame = Math.round(sr / 24)
    const buf = ac.createBuffer(1, frame * 24, sr)
    const d = buf.getChannelData(0)
    const r = rng(seed)
    const burst = (i0: number, secs: number, amp: number, c: number) => {
      const len = Math.floor(sr * secs)
      let lp = 0
      for (let j = 0; j < len && i0 + j < d.length; j++) {
        lp += (r() * 2 - 1 - lp) * c
        d[i0 + j] += lp * amp * Math.exp((-5 * j) / len)
      }
    }
    for (let k = 0; k < 24; k++) {
      const i0 = k * frame
      burst(i0, 0.0028, 0.8 * (0.85 + 0.3 * r()), 0.9)
      burst(i0 + Math.floor(frame * 0.42), 0.004, 0.42 * (0.85 + 0.3 * r()), 0.5)
      for (let j = 0; j < frame; j++) d[i0 + j] += (r() * 2 - 1) * 0.03 * (0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * j) / frame))
    }
    return buf
  }

  /**
   * Set an ambient bed's level (0..1). Call it every frame while it should sound. A bed is not a
   * point: it is two unlike voices spread left and right that drift slowly (and, in 5.1, sit in
   * the surrounds and breathe toward the fronts).
   */
  bed(name: Bed, v: number) {
    if (!this.on || !this.ac) return
    let b = this.beds.get(name)
    if (!b) {
      const ac = this.ac
      const spk = this.spk
      const voices = [0, 1].map((i) => {
        const g = ac.createGain()
        g.gain.value = 0
        const slow = 0.05 + 0.021 * i + 0.004 * this.beds.size
        if (spk) {
          const f = this.lvl(0.5, spk[i])
          const s = this.lvl(0.7, spk[4 + i])
          g.connect(f)
          g.connect(s)
          const l = ac.createOscillator()
          l.frequency.value = slow
          l.connect(this.lvl(0.2, f.gain))
          l.connect(this.lvl(-0.2, s.gain))
          l.start()
        } else {
          const p = ac.createStereoPanner()
          p.pan.value = i ? 0.55 : -0.55
          const l = ac.createOscillator()
          l.frequency.value = slow
          l.connect(this.lvl(0.3, p.pan))
          l.start()
          g.connect(p)
          p.connect(this.front!)
        }
        return g
      })
      const noise = (i: number, type: BiquadFilterType, f: number, q: number, lfo = 0) => {
        const src = ac.createBufferSource()
        src.buffer = this.noise
        src.loop = true
        const bq = ac.createBiquadFilter()
        bq.type = type
        bq.frequency.value = f
        bq.Q.value = q
        if (lfo) {
          const l = ac.createOscillator()
          l.frequency.value = lfo * (i ? 1.17 : 1)
          l.connect(this.lvl(f * 0.45, bq.frequency))
          l.start()
        }
        src.connect(bq)
        bq.connect(voices[i])
        src.start(0, i * 0.83)
      }
      const loop = (i: number, buf: AudioBuffer, dest: AudioNode, offset = 0) => {
        const src = ac.createBufferSource()
        src.buffer = buf
        src.loop = true
        src.connect(dest)
        src.start(0, offset)
      }
      for (const i of [0, 1]) {
        if (name === "wind") noise(i, "bandpass", 420, 0.6, 0.13)
        else if (name === "water") noise(i, "lowpass", 700, 0.4, 0.21)
        else if (name === "fire") noise(i, "lowpass", 95, 0.9, 0.31)
        else if (name === "air") noise(i, "highpass", 5200, 0.5)
        else if (name === "crackle") {
          const hp = ac.createBiquadFilter()
          hp.type = "highpass"
          hp.frequency.value = 500
          hp.connect(voices[i])
          loop(i, this.crackleBuf(311 + i * 97), hp)
          voices[i].connect(this.lvl(0.12, this.roomIn!))
        } else if (name === "projector") {
          const bp = ac.createBiquadFilter()
          bp.type = "bandpass"
          bp.frequency.value = i ? 2100 : 1700
          bp.Q.value = 0.5
          bp.connect(voices[i])
          loop(i, this.projectorBuf(808), bp, i * 0.0131)
          // the motor under the clatter, on the root
          const lp = ac.createBiquadFilter()
          lp.type = "lowpass"
          lp.frequency.value = 300
          lp.connect(this.lvl(0.06, voices[i]))
          const o = ac.createOscillator()
          o.type = "sawtooth"
          o.frequency.value = H(3) * (i ? 1.003 : 1)
          o.connect(lp)
          o.start()
          voices[i].connect(this.lvl(0.15, this.roomIn!))
        } else {
          const lp = ac.createBiquadFilter()
          lp.type = "lowpass"
          lp.frequency.value = 320
          lp.connect(voices[i])
          for (const m of i ? [2.004, 3, 4.01] : [2, 3.003, 4.006]) {
            const o = ac.createOscillator()
            o.type = "sawtooth"
            o.frequency.value = H(m)
            o.connect(lp)
            o.start()
          }
        }
      }
      b = { g: voices, want: 0, age: 0 }
      this.beds.set(name, b)
    }
    b.want = Math.max(0, Math.min(1, v))
    b.age = 0
  }

  /** Called once a frame: beds that nobody re-sent in the last half second fade out. */
  update(dt: number) {
    if (!this.ac || !this.beds.size) return
    for (const [name, b] of this.beds) {
      b.age += dt
      if (b.age > 0.5) b.want = 0
      // each voice is one side: the legacy single-voice level, shared between the two
      for (const g of b.g) g.gain.setTargetAtTime(this.on ? b.want * BED_LEVEL[name] : 0, this.ac.currentTime, 0.25)
    }
  }

  /**
   * Render sounds through the whole graph (placement, reverbs, master chain) without playing them:
   * for measuring. Two channels, or six in "5.1" (L, R, C, LFE, Ls, Rs).
   */
  static async render(spec: { play?: { s: Snd; o?: SndOpts }[]; bed?: Bed; mode?: Mode; secs?: number }): Promise<AudioBuffer> {
    const mode = spec.mode ?? "stereo"
    const sr = 48000
    const ctx = new OfflineAudioContext(mode === "5.1" ? 6 : 2, Math.ceil(sr * (spec.secs ?? 4)), sr)
    const s = new Synth({ ctx, mode })
    s.enable(true)
    for (const p of spec.play ?? []) s.play(p.s, p.o)
    if (spec.bed) {
      s.bed(spec.bed, 1)
      s.update(0)
    }
    return ctx.startRendering()
  }

  dispose() {
    if (!this.opt.ctx) void (this.ac as AudioContext | null)?.close()
    this.ac = null
    this.beds.clear()
  }
}
