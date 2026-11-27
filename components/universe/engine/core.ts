// The /universe deck engine, on three's WebGPURenderer and TSL.
//
//  - One renderer, two backends. WebGPU where the browser has an adapter; otherwise (or with
//    `forceWebGL`, the page's `?gl` flag) three's WebGL 2 backend. Everything drawn is TSL, so both
//    backends compile the same node graphs; see `tsl.ts` for the shared library.
//  - A scene is a lazily imported module. Only the current scene and its neighbours exist on the
//    GPU: one step away is warmed (created, compiled with `renderer.compileAsync` where the scene
//    lists what it draws, then every beat rendered once), two steps away has its render targets
//    parked at 2×2, further than that is disposed.
//  - Every scene has its own beat clock. Animation is written as keyframe ranges against it
//    (`s.k(beat, from, to, ease)`), so any moment can be rendered on demand: `seek(scene, beat, t)`.
//    Going back runs the clock backwards, fast, so "back" is an animated reversal and not a cut.
//  - A scene draws linear HDR into its own targets, then `ctx.finish` runs the shared post chain
//    (`post.ts`: bloom with halation, tone map, grade, vignette, aberration) and lays its Canvas 2D
//    type on top.
//  - A transition works on two finished scenes. Both keep animating while it runs (`s.exit` and
//    `s.enter`), and either can expose a portal quad for the transition to open out of.
//  - The last pass adds grain and a dither, and leaves exact white exact. The renderer's own output
//    transform is off (linear output, no tone mapping), so what that pass writes is what is shown.
//  - The render scale steps down a ladder when frames run slow, and back up when they recover.
//  - A scene is not shown (or seeked to) until its `compileAsync` has resolved. Drawing it earlier
//    would still work (a render builds any pipeline that is missing, synchronously), but that is
//    the stall the warm-up exists to avoid.
//  - Loading is counted, never guessed: a `progress` event carries how many stages have finished out
//    of how many there are, and the name of the one in flight. The listener is `opts.onEvent`,
//    handed to the constructor, so it is in place before anything can emit.
//  - Nothing waits without a limit (`boot.ts`). The order is fixed: `renderer.init()` resolves (the
//    adapter and the device exist) before a pass, a target or a compile is made; then the scene
//    chunk, then `compileAsync`, then the first frame. A stage that fails twice rejects with a
//    `StepError` naming it. Pre-compilation is the one stage the deck can do without: if
//    `compileAsync` does not answer, pre-warming is switched off for the session and scenes compile
//    on their first render.

import * as THREE from "three/webgpu"
import { mix, uniform, uniformTexture, vec2, vec4 } from "three/tsl"

import { SCENES, type SceneDef, type TransitionId } from "../script"
import { LOADERS } from "../scenes"
import { TRANSITIONS } from "../transitions"
import { attempt, reasonOf, StepError, within } from "./boot"
import { clamp, E, type Ease } from "./ease"
import { createPass, PASS_CAMERA, type PassEnv } from "./pass"
import { Post } from "./post"
import { FULL, portalMatrix } from "./quad"
import { soundPref, storeSoundPref, Synth } from "./synth"
import { DH, DW, Type2D, type FontMap } from "./text"
import { L0, rtUV, sampleRT, type F, type V2, type V3 } from "./tsl"
import type { Ctx, Pass, PassBuild, Portal, PostOpts, SceneInstance, State, TargetOpts, Temporal, TransArgs, TransitionDef, Uniforms, WarmItem } from "./types"

const LADDER = [1, 0.84, 0.7, 0.58]
const MAX_W = 1920
/** Device pixels per CSS pixel the deck will render at most (before MAX_W and the ladder). */
const DPR_CAP = 2
const REVERSE = 0.55 // a transition played backwards takes this fraction of its length
const HURRY = 3.5 // pressing next during a transition speeds it up rather than cutting it
const RING = 600 // frames of timing history kept for info()
// Time limits, each sized for a dev server compiling the chunk on first request on a busy machine.
const INIT_MS = 8_000 // adapter, device and context
const CHUNK_MS = 25_000 // one scene chunk
const COMPILE_MS = 10_000 // one compileAsync call

export type DeckEvent =
  | { type: "pos"; scene: number; beat: number }
  | { type: "status"; loading: boolean }
  /**
   * `done` of `total` stages have finished and `label` names the one now in flight. `scope` says
   * whether the deck is opening (the engine's own stages: scene chunk, pipelines, each beat, first
   * frame) or a next scene is being readied.
   */
  | { type: "progress"; done: number; total: number; label: string; scope: "open" | "next" }
  /** A stage failed for good after the deck opened. `step` and `reason` are fit to show. */
  | { type: "error"; step: string; reason: string }
  | { type: "auto"; on: boolean }
  | { type: "sound"; on: boolean }

export type DeckOpts = {
  canvas: HTMLCanvasElement
  fonts: FontMap
  reducedMotion: boolean
  /** Use three's WebGL 2 backend even where WebGPU is available. */
  forceWebGL?: boolean
  /** Measure GPU time per frame with timestamp queries (the page's `?prof` flag). Costs a little; off by default. */
  profile?: boolean
  onEvent(e: DeckEvent): void
}

type OwnedTarget = { rt: THREE.RenderTarget; o: TargetOpts }
type Pooled = { rt: THREE.RenderTarget; key: string; busy: boolean }

type Slot = {
  i: number
  def: SceneDef
  inst: SceneInstance | null
  loading: Promise<void> | null
  /** Resolves when the scene's pipelines are compiled; the scene is not drawn before that. */
  compiling: Promise<void> | null
  compiled: boolean
  targets: OwnedTarget[]
  passes: Pass[]
  out: THREE.RenderTarget
  type: Type2D
  state: State
  parked: boolean
  grain: number
  beat: number
  t: number
  time: number
  warmed: boolean
  /** True while "back" is running this scene's clock in reverse. */
  rewind: boolean
}

type Active = { from: number; to: number; def: TransitionDef; el: number; dur: number; reverse: boolean; speed: number; queued: boolean }
type TransInst = { render(a: TransArgs): void; warm?(): WarmItem[]; dispose?(): void }

const pct = (sorted: Float32Array, n: number, q: number) => (n ? Math.round(sorted[Math.min(n - 1, Math.floor(n * q))] * 10) / 10 : 0)

// ---------------------------------------------------------------- GPU time (`?prof` only)
//
// Four numbers, all in ms per frame. What each one is, and which the budget means:
//
//   gpuMs         SPAN: from the earliest pass begin to the latest pass end of one frame, render
//                 and compute passes together, read from the raw begin/end timestamp of every pass.
//                 THIS IS THE NUMBER THE "8 ms OF GPU TIME AT 1280×720" BUDGET REFERS TO. The budget
//                 exists so the deck holds 60 fps on a laptop at 1080p, and what decides that is how
//                 long the GPU is occupied by one frame from its first pass to its last, not a total
//                 of pass durations. Take it from `prof()`, which draws each frame alone and waits
//                 for the GPU before the next. Measured that way a frame reads about 1 ms longer
//                 than the same frame under sustained load (live with vsync off, where span comes
//                 out near the frame interval); the cause was not established, and the longer
//                 reading is the one to hold to the budget. Frames submitted with no wait between
//                 them (the burst below) queue behind one another and their spans stretch to about
//                 twice the true figure, so a span is only good for a frame that had the GPU to
//                 itself.
//   gpuBusyMs     UNION of the same intervals: span minus the gaps in which no pass of ours was
//                 open. Equal to span when the frame's passes run back to back; lower when the GPU
//                 idled or served another page in between. Span well above busy means the reading
//                 was disturbed (another tab or agent on the GPU): take it again.
//   gpuPassSumMs  SUM of every render pass's (end - begin). This is what three reports as
//                 `renderer.info.render.timestamp` and what `gpuMs` used to be. It is not frame time:
//                 on this backend every pass of a frame begins within the first half millisecond and
//                 ends near the frame's end, so the 15 or so intervals overlap almost entirely and
//                 the sum is roughly passes × span (a 2.4 ms frame reads 26 ms). Kept for comparison
//                 with older notes only.
//   gpuWallMs     WALL, no timestamps at all, an independent check. `prof()` draws the same frozen
//                 frame N times back to back in one task, waits once for the GPU to finish them all,
//                 and divides. It is throughput with the GPU kept busy (no wake from idle), and it
//                 includes the main thread's encode time (`cpuMs`), so it is an upper bound on GPU
//                 time per frame, and it sees what no pass timestamp does: uploads, copies, the
//                 present. Only `prof()` sets it; run it with vsync uncapped. (`wallEachMs` in the
//                 `prof()` result is the other way round: one frame, one wait, so it holds cpu, the
//                 wake and a round trip to the GPU process, `floorMs`.)
//
// The rule: judge a scene by the median `gpuMs` over several `prof()` runs, and expect `gpuWallMs`
// within about 0.5 ms of it. Wall more than about 2 ms above span means work outside the passes, or a frame
// bound by the main thread (compare `cpuMs`): then wall is the figure to explain. Span far above
// busy means the machine was shared and the sample is void.
// On WebGL 2 there are no begin/end stamps (EXT_disjoint_timer_query gives one duration per
// pass, and three never nests them), so span and busy are null there and wall is the measure.
// All of this reads three's private timestamp pool; every access is checked, and anything
// unexpected gives null, never a throw.

type GpuFrame = { frame: number; span: number | null; busy: number | null; sum: number; passes: number; ivs?: Iv[] }
type Iv = { frame: number; compute: boolean; b: number; e: number }
type GpuBuf = { mapState: string; mapAsync(mode: number, offset: number, size: number): Promise<void>; getMappedRange(offset: number, size: number): ArrayBuffer; unmap(): void; destroy(): void }
type GpuDev = {
  createBuffer(d: { label?: string; size: number; usage: number }): GpuBuf
  createCommandEncoder(): { resolveQuerySet(set: unknown, first: number, count: number, dst: GpuBuf, offset: number): void; copyBufferToBuffer(src: GpuBuf, so: number, dst: GpuBuf, d: number, size: number): void; finish(): unknown }
  queue: { submit(list: unknown[]): void; onSubmittedWorkDone(): Promise<void> }
}
type StampPool = { querySet?: unknown; queryOffsets?: unknown; currentQueryIndex?: unknown; maxQueries?: unknown; pendingResolve?: unknown; timestamps?: unknown }
const FRAME_OF = /:f(\d+)$/ // three's query uid ends in the frame it belongs to (Backend.js, `timestampUID`)
const median = (v: number[]) => {
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100)

export class Deck {
  readonly synth = new Synth()
  /** The stored sound preference is "on" and no gesture has started the audio yet. */
  private armed = soundPref()
  scene = 0
  auto = false
  ready = false
  renderScale = 1
  frameMs = 16
  readonly backend: "webgpu" | "webgl2"
  private gpu = "unknown"
  private slots: Slot[]
  private w = 16
  private h = 9
  private fsCam = PASS_CAMERA
  private uTime = uniform(0)
  private env: PassEnv
  private post: Post
  private mixRT: THREE.RenderTarget
  private snaps = new Map<string, THREE.RenderTarget>()
  private trans = new Map<TransitionId, TransInst>()
  private transTargets: OwnedTarget[] = []
  private pool: Pooled[] = []
  private borrowed: Pooled[] = []
  private upPass: Pass<{ tA: THREE.TextureNode; uPx: THREE.UniformNode<"vec2", THREE.Vector2> }> | null = null
  private active: Active | null = null
  private targs: TransArgs
  private pendingNext = false
  private raf = 0
  private lastNow = 0
  private ladder = 0
  private lastStep = 0
  private fastFor = 0
  private fails = [0, 0, 0, 0]
  private disposed = false
  private frozen = false
  private clock = 0
  private frameNo = 0
  private ro: ResizeObserver
  private mouseRaw = { x: 0, y: 0 }
  private mouse = { x: 0, y: 0 }
  private warmQueue: (() => void)[] = []
  private warmTimer = 0
  private compiles = 0
  private compileChain: Promise<void> = Promise.resolve()
  private resizeHeld = false
  /** Slots whose park or drop waited for the compile queue to empty (see `holdSlot`). */
  private slotsHeld = new Map<Slot, "park" | "drop">()
  /** False once a compileAsync has failed to answer: from then on scenes compile on their first render. */
  private prewarm = true
  private said = new Set<string>()
  // profiling: preallocated rings, sorted only inside info()
  private ringGap = new Float32Array(RING)
  private ringCpu = new Float32Array(RING)
  private ringN = 0
  private scratchSort = new Float32Array(RING)
  private stat = { drawCalls: 0, triangles: 0, renderCalls: 0, computeCalls: 0 }
  private gpuMs: number | null = null
  private gpuBusyMs: number | null = null
  private gpuPassSumMs: number | null = null
  private gpuPasses: number | null = null
  private gpuWallMs: number | null = null
  private gpuFrames = 0
  private gpuBusy = false
  private gpuBufs: Partial<Record<"render" | "compute", { resolve: GpuBuf; read: GpuBuf }>> = {}
  private gpuBase: bigint | null = null
  private profHook: { prof: (frames?: number) => Promise<unknown>; nan: (to?: number | string, p?: number) => Promise<unknown> } | null = null
  /** Set only inside `nanProbe`: `finish` copies each scene's HDR source here before tone mapping. */
  private nanTaps: Map<Slot, THREE.RenderTarget> | null = null
  private timing: { init: number; firstFrame: number; nav: number; t0: number; compile: Record<string, number>; warm: Record<string, number>; boot: Record<string, number> }

  /**
   * Create the renderer, wait for its backend, then build the deck. Nothing that touches the GPU
   * (a pass, a target, a compile) exists before `renderer.init()` has resolved, which is when the
   * adapter and device (or the WebGL 2 context) do. Rejects if the backend does not start, or does
   * not answer in time; the caller tries again on a new canvas, since a canvas keeps the first
   * kind of context it was given.
   */
  static async create(o: DeckOpts): Promise<Deck> {
    const t0 = performance.now()
    const renderer = new THREE.WebGPURenderer({ canvas: o.canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance", forceWebGL: !!o.forceWebGL, trackTimestamp: !!o.profile })
    // No output transform: the present pass writes the final sRGB values itself.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    const free = () => {
      try {
        void Promise.resolve(renderer.dispose()).catch(() => {})
      } catch {
        // a renderer that never started has nothing to free
      }
    }
    try {
      // a device that turns up after the limit belongs to a deck nobody is waiting for
      await within(renderer.init(), INIT_MS, free)
    } catch (e) {
      free()
      throw e
    }
    const b = renderer.backend as unknown as { isWebGPUBackend?: boolean; device?: unknown }
    if (b.isWebGPUBackend && !o.forceWebGL && !b.device) {
      free()
      throw new Error("WebGPU started without a device")
    }
    const deck = new Deck(o, renderer, t0)
    if (o.profile) {
      // the measuring harness reaches `prof()` here; the page's own harness object is not the engine's to extend
      deck.profHook = { prof: (frames?: number) => deck.prof(frames), nan: (to?: number | string, p?: number) => deck.nanProbe(to, p) }
      ;(globalThis as { __deckProf?: unknown }).__deckProf = deck.profHook
    }
    await deck.describeGPU()
    deck.timing.init = performance.now() - t0
    return deck
  }

  private constructor(private o: DeckOpts, readonly renderer: THREE.WebGPURenderer, t0: number) {
    this.backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "webgpu" : "webgl2"
    this.timing = { init: 0, firstFrame: 0, nav: 0, t0, compile: {}, warm: {}, boot: {} }
    renderer.setPixelRatio(1)
    renderer.autoClear = true
    renderer.info.autoReset = false // we run our own loop, so the per-frame counters are reset by frame()
    this.env = { renderer, time: this.uTime, size: () => ({ w: this.w, h: this.h }) }
    this.mixRT = new THREE.RenderTarget(2, 2, { depthBuffer: false })
    this.post = new Post((b, u) => this.pass(b, u))
    this.targs = { A: this.mixRT.texture, B: this.mixRT.texture, p: 0, pl: 0, time: 0, pa: null, pb: null, out: this.mixRT }

    this.slots = SCENES.map((def, i) => {
      const s: Slot = {
        i, def, inst: null, loading: null, compiling: null, compiled: false, targets: [], passes: [], parked: true, grain: 0.02, beat: 0, t: 0, time: 0, warmed: false, rewind: false,
        out: new THREE.RenderTarget(2, 2, { depthBuffer: false }),
        type: new Type2D(o.fonts),
        state: null as unknown as State,
      }
      // one State per scene, refilled every frame: nothing is allocated to describe a frame
      const st: State = {
        beat: 0, t: 0, time: 0, dt: 0, enter: 1, exit: 0, w: 16, h: 9, live: false, mouse: this.mouse,
        k: (b, from, to, ease: Ease = E.io3) => (b < st.beat ? 1 : b > st.beat ? 0 : ease(clamp((st.t - from) / (to - from || 1e-6)))),
        at: (b) => (b < st.beat ? 1e4 : b > st.beat ? -1e4 : st.t),
      }
      s.state = st
      return s
    })

    o.canvas.addEventListener("pointermove", this.onPointer)
    o.canvas.addEventListener("pointerleave", this.onLeave)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(o.canvas)
    this.resize()
  }

  private async describeGPU() {
    try {
      if (this.backend === "webgpu") {
        const dev = (this.renderer.backend as unknown as { device?: { adapterInfo?: { vendor?: string; architecture?: string; device?: string; description?: string; isFallbackAdapter?: boolean } } }).device
        const i = dev?.adapterInfo
        if (i) this.gpu = `WebGPU (${[i.vendor, i.architecture, i.device, i.description].filter(Boolean).join(", ")}${i.isFallbackAdapter ? ", FALLBACK ADAPTER" : ""})`
        else this.gpu = "WebGPU"
      } else {
        const gl = this.renderer.getContext() as WebGL2RenderingContext
        const ext = gl.getExtension("WEBGL_debug_renderer_info")
        this.gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "WebGL2"
      }
    } catch {
      this.gpu = this.backend
    }
  }

  private say(key: string, msg: string) {
    if (this.said.has(key)) return
    this.said.add(key)
    console.info(msg)
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.o.canvas.getBoundingClientRect()
    this.mouseRaw.x = ((e.clientX - r.left) / r.width) * 2 - 1
    this.mouseRaw.y = 1 - ((e.clientY - r.top) / r.height) * 2
  }
  private onLeave = () => {
    this.mouseRaw.x = 0
    this.mouseRaw.y = 0
  }

  // ---------------------------------------------------------------- passes and targets

  /** A full-screen pass (see pass.ts). `owner` collects it for disposal with its scene. */
  pass<U extends Uniforms = Uniforms>(build: PassBuild, uniforms?: U, owner?: Pass[]): Pass<U> {
    const p = createPass(this.env, build, uniforms)
    owner?.push(p as unknown as Pass)
    return p
  }

  private newTarget(o: TargetOpts, w: number, h: number) {
    const hdr = o.hdr ?? true
    return new THREE.RenderTarget(w, h, {
      type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: o.depth ?? false,
      samples: o.samples ?? 0,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    })
  }

  private makeTarget(o: TargetOpts, list: OwnedTarget[]) {
    const [w, h] = this.sizeOf(o)
    const rt = this.newTarget(o, w, h)
    list.push({ rt, o })
    return rt
  }

  /** Borrow a target of this shape from the pool until `releaseScratch`. */
  private scratch(o: TargetOpts): THREE.RenderTarget {
    const [w, h] = this.sizeOf(o)
    const key = `${w}x${h}:${o.hdr ?? true}:${o.depth ?? false}:${o.samples ?? 0}`
    let p: Pooled | undefined
    for (const q of this.pool) if (!q.busy && q.key === key) p = q
    if (!p) {
      p = { rt: this.newTarget(o, w, h), key, busy: false }
      this.pool.push(p)
    }
    p.busy = true
    this.borrowed.push(p)
    return p.rt
  }

  private releaseScratch() {
    for (const p of this.borrowed) p.busy = false
    this.borrowed.length = 0
  }

  /** Free pooled targets (their sizes are stale after a resize). */
  private flushPool() {
    for (const p of this.pool) p.rt.dispose()
    this.pool.length = 0
    this.borrowed.length = 0
  }

  private upsample(src: THREE.Texture, dst: THREE.RenderTarget) {
    if (!this.upPass) {
      const tA = uniformTexture(src)
      const uPx = uniform(new THREE.Vector2(1, 1))
      // a 3×3 tent over the low-res texels: smoother than the bilinear tap alone, no halo
      this.upPass = this.pass(
        ({ uv }) => {
          const s = (x: number, y: number) => tA.sample(rtUV(uv.add(uPx.mul(vec2(x, y))) as V2)).level(L0)
          return s(0, 0).mul(4).add(s(-1, 0).add(s(1, 0)).add(s(0, -1)).add(s(0, 1)).mul(2)).add(s(-1, -1)).add(s(1, -1)).add(s(-1, 1)).add(s(1, 1)).div(16)
        },
        { tA, uPx },
      )
    }
    const img = src.image as { width: number; height: number }
    this.upPass.u.uPx.value.set(0.5 / img.width, 0.5 / img.height)
    this.upPass.u.tA.value = src
    this.upPass.render(dst)
  }

  /**
   * Temporal accumulation for reduced-resolution work. Live, each frame's picture (drawn with the
   * sub-pixel `jitter`) is blended into a history buffer, so a half-res volume converges to
   * full-res detail in a few frames. Under `seek` there is no history: jitter is zero and the
   * current picture is returned as it is, so a seek frame is a pure function of State.
   */
  private makeTemporal(slot: Slot, o: { scale?: number; blend?: number }): Temporal {
    const opts: TargetOpts = { scale: o.scale ?? 0.5 }
    const hist = [this.makeTarget(opts, slot.targets), this.makeTarget(opts, slot.targets)]
    const tCur = uniformTexture(hist[0].texture)
    const tHist = uniformTexture(hist[0].texture)
    const uBlend = uniform(1)
    const blend = this.pass(({ uv }) => mix(sampleRT(tHist, uv), sampleRT(tCur, uv), uBlend), { tCur, tHist, uBlend }, slot.passes)
    const HALTON: [number, number][] = [[0, 0], [0.25, -0.1667], [-0.25, 0.1667], [0.375, -0.3889], [-0.125, 0.2778], [0.125, -0.0556], [-0.375, 0.3889], [0.4375, 0.0556]]
    let flip = 0
    let lastFrame = -9
    let lastW = 0
    const jit: [number, number] = [0, 0]
    return {
      jitter: (s) => {
        const j = s.live ? HALTON[this.frameNo % HALTON.length] : HALTON[0]
        jit[0] = j[0]
        jit[1] = j[1]
        return jit
      },
      resolve: (current, s) => {
        // no history under seek, on the first frame, after a gap or after a resize
        const fresh = !s.live || this.frameNo - lastFrame > 1 || hist[0].width !== lastW
        lastFrame = this.frameNo
        lastW = hist[0].width
        if (fresh) {
          if (!s.live) return current
          uBlend.value = 1
        } else uBlend.value = o.blend ?? 0.12
        tCur.value = current
        tHist.value = hist[flip].texture
        flip = 1 - flip
        blend.render(hist[flip])
        return hist[flip].texture
      },
    }
  }

  private transFor(id: TransitionId): TransInst {
    let t = this.trans.get(id)
    if (t) return t
    const def = TRANSITIONS[id]
    if (def.unported) this.say("t:" + id, `[universe] transition "${id}" is not ported to TSL yet (GLSL original: ${def.unported}); showing a plain mix`)
    if (def.create) {
      t = def.create({
        renderer: this.renderer,
        backend: this.backend,
        pass: (b, u) => this.pass(b, u),
        target: (o = {}) => this.makeTarget(o, this.transTargets),
        compute: (n) => void this.renderer.compute(n),
        size: () => ({ w: this.w, h: this.h }),
      })
    } else {
      const A = uniformTexture(this.mixRT.texture)
      const B = uniformTexture(this.mixRT.texture)
      const u = { A, B, p: uniform(0), pl: uniform(0), HA: uniform(new THREE.Matrix3()), HB: uniform(new THREE.Matrix3()), PA: uniform(new THREE.Vector4()), PB: uniform(new THREE.Vector4()) }
      const p = this.pass(({ uv, res, time }) => {
        const a = (q: V2 = uv) => sampleRT(A, q).rgb as V3
        const b = (q: V2 = uv) => sampleRT(B, q).rgb as V3
        const c = def.trans ? def.trans({ uv, res, time, a, b, A, B, p: u.p as unknown as F, pl: u.pl as unknown as F, HA: u.HA, HB: u.HB, PA: u.PA, PB: u.PB }) : mix(a(), b(), u.p)
        return vec4(c as V3, 1)
      }, u)
      t = {
        render: (a) => {
          u.A.value = a.A
          u.B.value = a.B
          u.p.value = a.p
          u.pl.value = a.pl
          portalMatrix(a.pa?.c ?? FULL, u.HA.value)
          portalMatrix(a.pb?.c ?? FULL, u.HB.value)
          u.PA.value.set(a.pa ? 1 : 0, a.pa?.a ?? 1, a.pa?.shade ?? 1, 0)
          u.PB.value.set(a.pb ? 1 : 0, a.pb?.a ?? 1, a.pb?.shade ?? 1, 0)
          p.render(a.out)
        },
        warm: () => [{ pass: p as unknown as Pass, target: this.mixRT }],
        dispose: () => p.dispose(),
      }
    }
    this.trans.set(id, t)
    return t
  }

  private sizeOf(o: TargetOpts): [number, number] {
    if (o.fixed) return o.fixed
    const s = o.scale ?? 1
    return [Math.max(2, Math.round(this.w * s)), Math.max(2, Math.round(this.h * s))]
  }

  private ctxFor(slot: Slot): Ctx {
    return {
      renderer: this.renderer,
      backend: this.backend,
      def: slot.def,
      fonts: this.o.fonts,
      synth: this.synth,
      size: () => ({ w: this.w, h: this.h }),
      target: (o = {}) => this.makeTarget(o, slot.targets),
      scratch: (o = {}) => this.scratch(o),
      pass: (build, uniforms) => this.pass(build, uniforms, slot.passes),
      upsample: (src, dst) => this.upsample(src, dst),
      temporal: (o = {}) => this.makeTemporal(slot, o),
      compute: (n) => void this.renderer.compute(n),
      finish: (src, post) => this.finish(slot, src, post ?? {}),
      snapshot: (id) => this.snaps.get(id)?.texture ?? null,
      debugLabels: typeof window !== "undefined" && new URLSearchParams(window.location.search).has("labels"),
    }
  }

  /** The current scene's readable in-world labels, for the review tool. */
  labels() {
    const s = this.slots[this.scene]
    return s?.inst?.labels?.(s.state) ?? []
  }

  private finish(slot: Slot, src: THREE.Texture, post: PostOpts) {
    slot.grain = post.grain ?? 0
    if (this.nanTaps) {
      let rt = this.nanTaps.get(slot)
      if (!rt) this.nanTaps.set(slot, (rt = new THREE.RenderTarget(this.w, this.h, { depthBuffer: false, type: THREE.HalfFloatType })))
      this.post.copy.u.tA.value = src
      this.post.copy.render(rt)
    }
    this.post.finish(src, post, slot.type.empty ? null : slot.type.tex, slot.out)
  }

  private resize() {
    const c = this.o.canvas
    const cssW = c.clientWidth
    const cssH = c.clientHeight
    if (!cssW || !cssH) return
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    let w = Math.min(MAX_W, Math.round(cssW * dpr))
    w = Math.max(320, Math.round(w * LADDER[this.ladder]))
    const h = Math.round((w * 9) / 16)
    if (w === this.w && h === this.h) return
    // Not under a compileAsync. It builds each pipeline, slices later, from a render context three
    // shares between every target of one shape, and a frame drawn in between points that context
    // at the scene on screen; resizing disposes that scene's targets, and the pipeline is then
    // asked for with no colour or depth format. The new size is taken once the queue is empty.
    if (this.compiles) {
      if (!this.resizeHeld) {
        this.resizeHeld = true
        void this.compileChain.then(() => {
          this.resizeHeld = false
          if (!this.disposed) this.resize()
        })
      }
      return
    }
    this.w = w
    this.h = h
    this.renderScale = LADDER[this.ladder]
    this.renderer.setSize(w, h, false)
    this.mixRT.setSize(w, h)
    this.post.resize(w, h)
    this.flushPool()
    for (const s of this.slots) if (!s.parked) this.sizeSlot(s)
    for (const t of this.transTargets) {
      const [tw, th] = this.sizeOf(t.o)
      t.rt.setSize(tw, th)
    }
    if (this.frozen || this.o.reducedMotion) this.frame(0)
  }

  private sizeSlot(s: Slot) {
    s.out.setSize(this.w, this.h)
    s.type.resize(this.w, this.h)
    for (const t of s.targets) {
      const [w, h] = this.sizeOf(t.o)
      t.rt.setSize(w, h)
    }
    s.inst?.resize?.(this.w, this.h)
  }

  /**
   * Parking resizes a slot's targets and dropping disposes them, which under a `compileAsync`
   * pulls a target out from under the render context it is building pipelines against (the same
   * hazard `resize` waits out). Either one waits until the queue is empty, then is decided again:
   * a slot that came back within one step of the scene on screen (or into a hand-off) is kept.
   */
  private holdSlot(s: Slot, kind: "park" | "drop"): boolean {
    if (!this.compiles || this.disposed) return false
    if (this.slotsHeld.get(s) !== "drop") this.slotsHeld.set(s, kind)
    if (this.slotsHeld.size === 1) {
      void this.compileChain.then(() => {
        if (this.disposed) return
        const held = [...this.slotsHeld]
        this.slotsHeld.clear()
        for (const [h, k] of held) {
          const inTrans = this.active && (h.i === this.active.from || h.i === this.active.to)
          if (inTrans || Math.abs(h.i - this.scene) <= 1) continue
          if (k === "park") this.park(h)
          else if (!h.compiling) this.drop(h)
        }
      })
    }
    return true
  }

  private park(s: Slot) {
    if (s.parked) return
    if (this.holdSlot(s, "park")) return
    s.parked = true
    s.out.setSize(2, 2)
    for (const t of s.targets) if (!t.o.fixed) t.rt.setSize(2, 2)
  }

  private unpark(s: Slot) {
    if (!s.parked) return
    s.parked = false
    this.sizeSlot(s)
  }

  private drop(s: Slot) {
    if ((s.inst || !s.parked) && this.holdSlot(s, "drop")) return
    this.park(s)
    if (!s.inst) return
    s.inst.dispose?.()
    for (const t of s.targets) t.rt.dispose()
    for (const p of s.passes) p.dispose()
    s.targets = []
    s.passes = []
    s.inst = null
    s.loading = null
    s.compiling = null
    s.compiled = false
    s.warmed = false
  }

  /** Keep a small picture of a scene as the talk leaves it, for scenes that look back. */
  private snapshot(s: Slot) {
    let rt = this.snaps.get(s.def.id)
    if (!rt) {
      rt = new THREE.RenderTarget(640, 360, { depthBuffer: false })
      this.snaps.set(s.def.id, rt)
    }
    this.post.copy.u.tA.value = s.out.texture
    this.post.copy.render(rt)
  }

  // ---------------------------------------------------------------- loading and warm-up

  private ensure(i: number): Promise<void> {
    const s = this.slots[i]
    if (!s || s.inst) return Promise.resolve()
    if (!s.loading) {
      s.loading = LOADERS[s.def.id]()
        .then((m) => m.create(this.ctxFor(s)))
        .then((inst) => {
          if (this.disposed) {
            inst.dispose?.()
            return
          }
          s.inst = inst
        })
      // a failed load is not remembered: the next ask tries again
      s.loading.catch(() => {
        s.loading = null
      })
    }
    return s.loading
  }

  /**
   * `ensure` with a time limit and one more try. A chunk that failed is asked for again; one that
   * is only slow is the same request, given as long again. Rejects with a `StepError`.
   */
  private load(i: number): Promise<void> {
    const s = this.slots[i]
    if (!s || s.inst) return Promise.resolve()
    return attempt(`scene chunk (${s.def.id})`, () => this.ensure(i), { ms: CHUNK_MS, alive: () => !this.disposed })
  }

  /** Stop pre-compiling for this session: three allows one compileAsync at a time, and one that never answers holds the queue for good. */
  private noPrewarm(what: string, e: unknown) {
    if (!this.prewarm) return
    this.prewarm = false
    console.warn(`[universe] ${what}: ${reasonOf(e)}. Pre-warming is off for this session; scenes compile on their first render.`)
  }

  /**
   * Compile pipelines off the critical path. `compileAsync` reads the current render target
   * synchronously when it is called (a pipeline is specific to its target's format and sample
   * count), then builds node graphs in time slices and pipelines in parallel on the GPU process.
   */
  private compileItems(items: WarmItem[]): Promise<void> {
    if (!this.prewarm) return Promise.resolve()
    const r = this.renderer
    this.compiles++
    // Passes that draw into the same kind of target share a render context, so they go to
    // compileAsync together, as the children of one throwaway parent (not re-parented: the
    // meshes stay root objects, which is how `render` draws them).
    const groups = new Map<string, { target: THREE.RenderTarget | null; meshes: THREE.Object3D[] }>()
    const jobs: { target: THREE.RenderTarget | null; scene: THREE.Object3D; camera: THREE.Camera }[] = []
    for (const it of items) {
      if ("pass" in it) {
        const t = it.target
        const key = t ? `${t.texture.type}:${t.samples}:${t.depthBuffer}` : "canvas"
        let g = groups.get(key)
        if (!g) groups.set(key, (g = { target: t, meshes: [] }))
        g.meshes.push(it.pass.mesh)
      } else jobs.push(it)
    }
    for (const g of groups.values()) {
      const parent = new THREE.Object3D()
      parent.children = g.meshes
      jobs.push({ target: g.target, scene: parent, camera: this.fsCam })
    }
    // one compileAsync at a time: the renderer keeps a single precompilation state, and two
    // overlapping calls throw ("Cannot destructure ... _precompilationState")
    const run = async () => {
      try {
        for (const j of jobs) {
          if (this.disposed || !this.prewarm) return
          const keep = r.getRenderTarget()
          // compileAsync reads the target synchronously, before its first await
          r.setRenderTarget(j.target)
          const job = r.compileAsync(j.scene, j.camera)
          r.setRenderTarget(keep)
          await within(job, COMPILE_MS)
        }
      } catch (e) {
        this.noPrewarm("compileAsync failed", e)
      } finally {
        this.compiles--
      }
    }
    this.compileChain = this.compileChain.then(run)
    return this.compileChain
  }

  /** Compute pipelines wait their turn in the same queue as render pipelines. */
  private compileCompute(nodes: THREE.ComputeNode[]): Promise<void> {
    if (!this.prewarm) return Promise.resolve()
    this.compiles++
    const run = async () => {
      try {
        if (!this.disposed && this.prewarm) await within(this.renderer.compileComputeAsync(nodes), COMPILE_MS)
      } catch (e) {
        this.noPrewarm("compileComputeAsync failed", e)
      } finally {
        this.compiles--
      }
    }
    this.compileChain = this.compileChain.then(run)
    return this.compileChain
  }

  /** A scene is safe to draw once this resolves. It always resolves: a compile that fails or does not answer leaves the scene to compile on its first render. */
  private compileSlot(s: Slot): Promise<void> {
    if (s.compiled || !s.inst) return Promise.resolve()
    if (!s.compiling) {
      const inst = s.inst
      const t0 = performance.now()
      this.unpark(s)
      const items = inst.warm?.() ?? []
      const comp = inst.warmCompute?.() ?? []
      s.compiling = Promise.all([items.length ? this.compileItems(items) : null, comp.length ? this.compileCompute(comp) : null]).then(() => {
        if (s.inst !== inst) return
        s.compiled = true
        s.compiling = null
        this.timing.compile[s.def.id] = Math.round(performance.now() - t0)
      })
    }
    return s.compiling
  }

  /**
   * Make a neighbouring scene ready before it is shown: `compileAsync` for what it lists in
   * `warm()`, then every beat rendered at its middle and its end (which compiles anything it did
   * not list, and uploads its textures), then the transition that brings it on. One render per
   * timer tick, so a warm-up never costs the scene on screen more than a frame at a time.
   */
  private warm(s: Slot) {
    if (!s.inst || s.warmed) return
    s.warmed = true
    const t0 = performance.now()
    void this.compileSlot(s).then(() => {
      if (!s.inst || this.disposed) return
      s.def.beats.forEach((b, bi) => {
        for (const t of [b.dur * 0.5, b.dur + b.hold]) {
          this.warmQueue.push(() => {
            if (!s.inst || s.i === this.scene || s.parked) return
            const keep = { beat: s.beat, t: s.t, time: s.time }
            s.beat = bi
            s.t = t
            s.time = this.baseTime(s.def, bi) + t
            this.renderSlot(s, 0, 1, 0, false)
            Object.assign(s, keep)
          })
        }
      })
      this.warmQueue.push(() => {
        const prev = this.slots[s.i - 1]
        if (!s.inst || !prev?.inst || prev.parked || s.parked) return
        const tr = this.transFor(s.def.enterWith)
        const items = tr.warm?.()
        const draw = () => {
          if (!s.inst || !prev.inst || prev.parked || s.parked || this.active) return
          const a = this.targs
          a.A = prev.out.texture
          a.B = s.out.texture
          a.p = a.pl = 0.5
          a.time = 0
          a.pa = a.pb = null
          a.out = this.mixRT
          tr.render(a)
        }
        if (items?.length) void this.compileItems(items).then(draw)
        else draw()
      })
      this.warmQueue.push(() => {
        this.timing.warm[s.def.id] = Math.round(performance.now() - t0)
      })
      this.pump()
    })
  }

  private pump() {
    if (this.warmTimer || !this.warmQueue.length) return
    this.warmTimer = window.setTimeout(() => {
      this.warmTimer = 0
      if (this.disposed) return
      // never compile during a hand-off; pick it up once the scene has landed
      if (!this.active) this.warmQueue.shift()?.()
      this.pump()
    }, this.active ? 400 : 50)
  }

  private housekeeping() {
    const here = this.scene
    for (const s of this.slots) {
      const d = Math.abs(s.i - here)
      const inTrans = this.active && (s.i === this.active.from || s.i === this.active.to)
      if (inTrans || d <= 1) {
        if (s.inst) this.unpark(s)
      } else if (d === 2) this.park(s)
      else if (!s.compiling) this.drop(s)
    }
    for (const j of [here + 1, here - 1]) {
      const n = this.slots[j]
      if (!n) continue
      const waited = () => this.pendingNext && j === this.scene + 1
      void this.load(j)
        .then(() => {
          if (Math.abs(n.i - this.scene) > 1 || this.disposed) return undefined
          if (waited()) this.o.onEvent({ type: "progress", done: 1, total: 2, label: `${n.def.title}: compiling`, scope: "next" })
          return this.compileSlot(n)
        })
        .then(() => {
          if (this.disposed || Math.abs(n.i - this.scene) > 1) return
          this.unpark(n)
          this.warm(n)
          if (waited()) {
            this.pendingNext = false
            this.o.onEvent({ type: "progress", done: 2, total: 2, label: `${n.def.title}: ready`, scope: "next" })
            this.o.onEvent({ type: "status", loading: false })
            this.next()
          }
        })
        .catch((e) => {
          if (this.disposed) return
          // twice asked for and twice failed: a real failure, and the next ask starts over
          console.error(`[universe] scene "${n.def.id}" failed to load`, e)
          if (waited()) {
            this.pendingNext = false
            this.o.onEvent({ type: "status", loading: false })
            this.failed(e, `scene chunk (${n.def.id})`)
          }
        })
    }
  }

  // ---------------------------------------------------------------- clocks and state

  private baseTime(def: SceneDef, beat: number) {
    let t = 0
    for (let b = 0; b < beat; b++) t += def.beats[b].dur + def.beats[b].hold
    return t
  }

  private renderSlot(s: Slot, dt: number, enter: number, exit: number, live: boolean): State | null {
    if (!s.inst) return null
    const st = s.state
    st.beat = s.beat
    st.t = s.t
    st.time = s.time
    st.dt = dt
    st.enter = enter
    st.exit = exit
    st.w = this.w
    st.h = this.h
    st.live = live
    s.inst.update?.(st)
    const g = s.type
    g.begin()
    s.inst.type?.(g, st)
    g.view(null)
    this.hud(s, g, st)
    g.flush()
    s.inst.render(st)
    this.releaseScratch()
    return st
  }

  private hud(s: Slot, g: Type2D, st: State) {
    const style = s.inst?.hud?.(st) ?? { color: "#ffffff" }
    if (style.hide) return
    const beat = s.def.beats[s.beat]
    // a scene's own running clock (see `SceneInstance.hud`), or the beat's page
    const ck = style.clock
    const page = ck ? ck.text : beat.page
    const prev = ck ? (ck.prev ?? null) : s.beat > 0 ? s.def.beats[s.beat - 1].page : null
    const since = ck?.since ?? st.t
    const fadeOut = 1 - clamp(st.exit * 2)
    const o = { size: 22, font: "mono" as const, weight: 500, color: style.color, align: "right" as const, track: 0.02, shadow: style.shadow ? { color: style.shadow, blur: 12 } : undefined }
    const changed = prev !== null && prev !== page
    const q = changed ? clamp(since / 0.9) : clamp((since + 0.4) / 0.9)
    // The clock sits top right: the site keeps a floating button in the bottom-right corner.
    if (q < 1 && changed && prev) g.text(prev, DW - 64, 76, { ...o, style: "fade", by: "line", p: 1 - clamp(q * 3), alpha: 0.75 * fadeOut })
    g.text(page, DW - 64, 76, { ...o, style: "rise", by: "glyph", stagger: 0.06, p: q, alpha: 0.75 * fadeOut })
    const n = String(s.i + 1).padStart(2, "0")
    g.text(`${n} / ${SCENES.length}   ${s.def.title.toUpperCase()}${beat.ill ? "   ·   ILLUSTRATION" : ""}`, 64, DH - 52, { ...o, align: "left", size: 17, track: 0.12, alpha: 0.5 * fadeOut, style: "none" })
  }

  // ---------------------------------------------------------------- navigation

  /** Report a failure that happened after the deck opened; the deck itself keeps running. */
  private failed(e: unknown, step: string) {
    this.o.onEvent({ type: "error", step: e instanceof StepError ? e.step : step, reason: reasonOf(e) })
  }

  private emitPos() {
    this.o.onEvent({ type: "pos", scene: this.scene, beat: this.slots[this.scene].beat })
  }

  get beat() {
    return this.slots[this.scene].beat
  }

  next() {
    const a = this.active
    if (a) {
      // impatience: finish the hand-off quickly, then take the step that was asked for
      if (a.reverse) {
        a.reverse = false
        a.speed = 1
      } else {
        a.speed = HURRY
        a.queued = true
      }
      return
    }
    const s = this.slots[this.scene]
    if (s.rewind) {
      s.rewind = false
      s.t = s.def.beats[s.beat].dur
      return
    }
    if (s.beat < s.def.beats.length - 1) {
      s.beat++
      s.t = this.o.reducedMotion ? 1e3 : 0
      this.emitPos()
      this.kick()
      return
    }
    const n = this.slots[this.scene + 1]
    if (!n) {
      this.setAuto(false)
      return
    }
    // not loaded, or loaded but its pipelines are still compiling: wait, then go
    if (!n.inst || !n.compiled) {
      if (!this.pendingNext) {
        this.pendingNext = true
        this.o.onEvent({ type: "status", loading: true })
        this.o.onEvent({ type: "progress", done: n.inst ? 1 : 0, total: 2, label: `${n.def.title}: ${n.inst ? "compiling" : "loading"}`, scope: "next" })
        this.housekeeping()
      }
      return
    }
    this.go(n.i)
  }

  prev() {
    const a = this.active
    if (a) {
      a.reverse = true
      a.speed = 1 / REVERSE
      a.queued = false
      return
    }
    const s = this.slots[this.scene]
    const rm = this.o.reducedMotion
    if (s.beat > 0) {
      if (rm || this.frozen) {
        s.beat--
        s.t = 1e3
        this.emitPos()
      } else if (s.rewind) {
        // a second press while rewinding: straight to the beat before
        s.beat--
        s.t = s.def.beats[s.beat].dur
        this.emitPos()
      } else {
        s.rewind = true
        s.t = Math.min(s.t, s.def.beats[s.beat].dur)
      }
      this.kick()
      return
    }
    const p = this.slots[this.scene - 1]
    if (!p) return
    if (!p.inst || !p.compiled) {
      void this.load(p.i)
        .then(() => this.compileSlot(p))
        .then(() => !this.disposed && this.scene === p.i + 1 && !this.active && p.compiled && this.prev())
        .catch((e) => {
          if (this.disposed) return
          console.error(`[universe] scene "${p.def.id}" failed to load`, e)
          this.failed(e, `scene chunk (${p.def.id})`)
        })
      return
    }
    // play the transition that brought this scene on, backwards
    const def = TRANSITIONS[s.def.enterWith]
    const dur = rm ? 0.01 : def.dur
    this.unpark(p)
    p.beat = p.def.beats.length - 1
    p.t = p.def.beats[p.beat].dur + p.def.beats[p.beat].hold
    p.time = this.baseTime(p.def, p.beat) + p.t
    p.rewind = false
    s.rewind = false
    this.active = { from: p.i, to: s.i, def, el: dur, dur, reverse: true, speed: 1 / REVERSE, queued: false }
    this.transFor(def.id)
    this.kick()
  }

  private go(to: number) {
    const from = this.scene
    const S = this.slots[to]
    const rm = this.o.reducedMotion
    const def = TRANSITIONS[S.def.enterWith]
    const dur = rm ? 0.01 : def.dur
    this.unpark(S)
    S.beat = 0
    S.t = rm ? 1e3 : -dur * (def.inAt ?? 0.5)
    S.time = 0
    S.rewind = false
    this.snapshot(this.slots[from])
    this.active = { from, to, def, el: 0, dur, reverse: false, speed: 1, queued: false }
    this.scene = to
    this.transFor(def.id)
    if (!rm) for (const c of def.snd ?? []) if (c.p === undefined) this.synth.play(c.s, c.o)
    this.emitPos()
    this.kick()
  }

  /** Jump straight to a beat (hash links, Home and End). */
  async jump(scene: number, beat = 0, end = false) {
    scene = clamp(scene, 0, this.slots.length - 1)
    try {
      await this.load(scene)
    } catch (e) {
      if (this.disposed) return
      console.error(`[universe] scene "${this.slots[scene].def.id}" failed to load`, e)
      this.failed(e, `scene chunk (${this.slots[scene].def.id})`)
      return
    }
    await this.compileSlot(this.slots[scene])
    if (this.disposed) return
    const S = this.slots[scene]
    this.active = null
    this.scene = scene
    this.unpark(S)
    S.beat = clamp(beat, 0, S.def.beats.length - 1)
    S.t = end || this.o.reducedMotion ? 1e3 : 0
    S.time = this.baseTime(S.def, S.beat)
    S.rewind = false
    this.housekeeping()
    this.emitPos()
    this.kick()
  }

  setAuto(on: boolean) {
    if (this.o.reducedMotion) on = false
    if (this.auto === on) return
    this.auto = on
    this.o.onEvent({ type: "auto", on })
  }

  /** Sound is on, or will be at the first gesture because the visitor left it on last time. */
  get soundOn() {
    return this.synth.on || this.armed
  }

  /** The visitor's explicit choice (`M`, the button): applied now and remembered for next time. */
  setSound(on: boolean) {
    this.armed = false
    storeSoundPref(on)
    this.synth.enable(on)
    this.o.onEvent({ type: "sound", on: this.synth.on })
  }

  toggleSound() {
    this.setSound(!this.soundOn)
  }

  /**
   * Call on every key press and pointer press on the deck. Browsers only start audio from a user
   * gesture, so a stored "on" waits here for the first one; nothing is shown and nothing is asked.
   */
  gesture() {
    if (this.armed) {
      this.armed = false
      this.synth.enable(true)
      if (!this.synth.on) this.o.onEvent({ type: "sound", on: false })
    } else this.synth.resume()
  }

  // ---------------------------------------------------------------- the frame

  /**
   * Open the deck on a beat: scene chunk, pipelines, every beat drawn once, first frame, in that
   * order, each counted as it finishes. Resolves when the deck is running. Rejects with a
   * `StepError` naming the stage that could not be done; a compile that does not answer is not one
   * of those (see `compileSlot`).
   */
  async start(scene: number, beat: number) {
    if (this.armed) this.o.onEvent({ type: "sound", on: true })
    scene = clamp(scene, 0, this.slots.length - 1)
    const S = this.slots[scene]
    const n = S.def.beats.length
    const total = n + 3
    let done = 0
    let mark = performance.now()
    const step = (label: string) => this.o.onEvent({ type: "progress", done, total, label, scope: "open" })
    const lap = (stage: string) => {
      const now = performance.now()
      this.timing.boot[stage] = Math.round(now - mark)
      mark = now
    }
    this.o.onEvent({ type: "status", loading: true })
    step("loading the scene")
    await this.load(scene)
    if (this.disposed) return
    lap("scene")
    done++
    step("compiling its pipelines")
    this.scene = scene
    this.unpark(S)
    // the opening scene is compiled behind the loading bar; its neighbours after the first frame
    await this.compileSlot(S)
    if (this.disposed) return
    lap("compile")
    done++
    try {
      // every beat drawn once (this also uploads textures); a breath between them so the bar can move
      for (let bi = 0; bi < n; bi++) {
        step(`drawing beat ${bi + 1} of ${n}`)
        const b = S.def.beats[bi]
        S.beat = bi
        S.t = b.dur * 0.5
        S.time = this.baseTime(S.def, bi) + S.t
        this.renderSlot(S, 0, 1, 0, false)
        done++
        if (n > 1) await new Promise<void>((r) => setTimeout(r, 0))
        if (this.disposed) return
      }
      lap("beats")
      step("drawing the first frame")
      S.warmed = true
      S.beat = clamp(beat, 0, S.def.beats.length - 1)
      S.t = this.o.reducedMotion ? 1e3 : beat > 0 ? 1e3 : 0
      S.time = this.baseTime(S.def, S.beat)
      this.ready = true
      this.emitPos()
      this.lastNow = performance.now()
      this.frame(0)
    } catch (e) {
      this.ready = false
      throw new StepError("first frame", reasonOf(e))
    }
    lap("frame")
    done++
    this.timing.firstFrame = performance.now() - this.timing.t0
    this.timing.nav = performance.now()
    step("running")
    this.o.onEvent({ type: "status", loading: false })
    // the bloom chain compiles in the background, ahead of the neighbours queued behind it, so the
    // first frame that blooms does not stall (the opening scene's own beats were just drawn above)
    void this.compileItems(this.post.warm(S.out))
    this.housekeeping()
    this.kick()
  }

  /** A face arrived after the deck opened with its fallback: lay the type out again. */
  refont() {
    if (this.disposed) return
    for (const s of this.slots) s.type.refont()
    if (this.frozen || this.o.reducedMotion) this.frame(0)
  }

  /** Under reduced motion the loop is stopped; this draws one frame whenever something changed. */
  private kick() {
    if (this.disposed || this.raf || this.frozen) return
    if (this.o.reducedMotion) {
      this.raf = requestAnimationFrame(() => {
        this.raf = 0
        this.frame(this.active ? 1 : 0)
        if (this.active) this.kick()
      })
      return
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.raf = 0
    if (this.disposed || this.frozen) return
    const real = now - this.lastNow
    this.lastNow = now
    const dt = Math.min(0.1, Math.max(0, real / 1000))
    if (document.visibilityState === "visible") {
      const c0 = performance.now()
      this.frame(dt)
      const i = this.ringN % RING
      this.ringGap[i] = real
      this.ringCpu[i] = performance.now() - c0
      this.ringN++
      this.adapt(real)
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Frame-time EMA; down a rung when slow, up again only after a long fast run, and not forever. */
  private adapt(ms: number) {
    if (ms > 200 || this.warmQueue.length || this.compiles) return
    this.frameMs = this.frameMs * 0.94 + ms * 0.06
    const now = this.clock
    if (this.frameMs > 21 && now - this.lastStep > 1.2 && this.ladder < LADDER.length - 1) {
      this.fails[this.ladder]++
      this.ladder++
      this.lastStep = now
      this.frameMs = 14
      this.fastFor = 0
      this.resize()
      return
    }
    if (ms < 18.5) this.fastFor += ms / 1000
    else this.fastFor = Math.max(0, this.fastFor - (ms / 1000) * 12)
    if (this.fastFor > 5 && now - this.lastStep > 6 && !this.active && this.ladder > 0 && this.fails[this.ladder - 1] < 3) {
      this.ladder--
      this.lastStep = now
      this.fastFor = 0
      this.resize()
    }
  }

  private frame(dt: number) {
    if (!this.ready) return
    const info = this.renderer.info
    info.reset()
    this.frameNo++
    ;(info as { frame: number }).frame = this.frameNo // groups timestamp queries per frame (see sampleGPU)
    this.clock += dt
    // The ambient clock every pass sees as `time`. Live it is wall time; under seek it is the
    // scene's own clock, so a seek frame is the same on every run, grain and all.
    const now = this.frozen ? this.slots[this.scene].time : this.clock
    this.uTime.value = now
    const k = 1 - Math.exp(-5 * dt)
    this.mouse.x += (this.mouseRaw.x - this.mouse.x) * k
    this.mouse.y += (this.mouseRaw.y - this.mouse.y) * k
    this.synth.update(dt)
    const a = this.active
    const live = !this.frozen && !this.o.reducedMotion
    let shown: THREE.Texture
    let grain: number
    if (a) {
      a.el += dt * a.speed * (a.reverse ? -1 : 1)
      const pl = clamp(a.el / a.dur)
      const A = this.slots[a.from]
      const B = this.slots[a.to]
      A.t += dt
      A.time += dt
      const prevT = B.t
      if (a.reverse) B.t = Math.max(-a.dur, B.t - dt * a.speed)
      else B.t += dt * Math.min(a.speed, 1.5)
      B.time += dt
      if (live && !a.reverse) this.cues(B, prevT)
      if (live && !a.reverse && this.synth.on) this.transSound(a, clamp((a.el - dt * a.speed) / a.dur), pl)
      const sa = this.renderSlot(A, dt, 1, pl, live)
      const pa: Portal | null = (sa && A.inst?.portal?.(sa)) ?? null
      const sb = this.renderSlot(B, dt, pl, 0, live)
      const pb: Portal | null = (sb && B.inst?.portal?.(sb)) ?? null
      const done = this.frozen ? false : a.reverse ? pl <= 0 : pl >= 1
      if (done) {
        // the ends are exactly the still scenes
        const landed = a.reverse ? A : B
        this.active = null
        this.scene = landed.i
        shown = landed.out.texture
        grain = landed.grain
        this.housekeeping()
        this.emitPos()
        if (a.queued && !a.reverse) queueMicrotask(() => this.next())
      } else {
        const g = this.targs
        g.A = A.out.texture
        g.B = B.out.texture
        g.p = (a.def.ease ?? E.io3)(pl)
        g.pl = pl
        g.time = now
        g.pa = pa
        g.pb = pb
        g.out = this.mixRT
        this.transFor(a.def.id).render(g)
        shown = this.mixRT.texture
        grain = A.grain + (B.grain - A.grain) * pl
      }
    } else {
      const S = this.slots[this.scene]
      const b = S.def.beats[S.beat]
      if (S.rewind) {
        S.t -= dt * 2.4 * Math.max(1, b.dur / 3)
        if (S.t <= 0) {
          S.rewind = false
          S.beat--
          S.t = S.def.beats[S.beat].dur + S.def.beats[S.beat].hold
          this.emitPos()
        }
      } else {
        const prevT = S.t
        S.t += dt
        if (live) this.cues(S, prevT)
      }
      S.time += dt
      this.renderSlot(S, dt, 1, 0, live)
      shown = S.out.texture
      grain = S.grain
      if (this.auto && live && !S.rewind && S.t >= b.dur + b.hold) this.next()
    }
    const pp = this.post.present
    pp.u.tA.value = shown
    pp.u.uGrain.value = grain
    pp.render(null)
    const st = this.stat
    st.drawCalls = info.render.drawCalls
    st.triangles = info.render.triangles
    st.renderCalls = info.render.frameCalls
    st.computeCalls = info.compute.frameCalls
    if (this.o.profile) this.sampleGPU()
  }

  /**
   * Every 20 frames, read back the GPU time of the frames since the last reading (see "GPU time"
   * at the top of this file for what each number means). three groups timestamp queries by
   * `info.frame`, which only its own animation loop advances, so frame() sets it; without that
   * every frame's queries would overwrite one another.
   */
  private sampleGPU() {
    if (++this.gpuFrames < 20 || this.gpuBusy) return
    this.gpuFrames = 0
    this.gpuBusy = true
    void this.readGPU()
      .then((frames) => this.keepGPU(frames))
      .catch(() => {})
      .finally(() => {
        this.gpuBusy = false
      })
  }

  private keepGPU(frames: GpuFrame[] | null) {
    if (!frames?.length) return
    const span = median(frames.filter((f) => f.span !== null).map((f) => f.span as number))
    const busy = median(frames.filter((f) => f.busy !== null).map((f) => f.busy as number))
    const sum = median(frames.map((f) => f.sum))
    this.gpuMs = r2(span)
    this.gpuBusyMs = r2(busy)
    if (sum !== null && sum > 0) this.gpuPassSumMs = r2(sum)
    this.gpuPasses = frames[frames.length - 1].passes
  }

  /**
   * Copy the raw begin/end timestamps of one of three's query pools into buffers of our own.
   * three's own resolve keeps only each pass's duration, so this runs just before it: the same
   * query set, resolved a second time. Must be called in the same task as three's resolve, which
   * is what empties the pool. Null if the pool is not shaped as three 0.187's is.
   */
  private rawStamps(type: "render" | "compute"): Promise<Iv[] | null> | null {
    try {
      if (this.backend !== "webgpu") return null
      const be = this.renderer.backend as unknown as { device?: GpuDev; timestampQueryPool?: Record<string, StampPool | null> }
      const dev = be.device
      const pool = be.timestampQueryPool?.[type]
      if (!dev || !pool || !pool.querySet || !(pool.queryOffsets instanceof Map) || pool.pendingResolve) return null
      const count = pool.currentQueryIndex
      const max = pool.maxQueries
      if (typeof count !== "number" || typeof max !== "number" || count < 2 || count > max) return null
      const offsets = [...(pool.queryOffsets as Map<unknown, unknown>)]
      let bufs = this.gpuBufs[type]
      if (!bufs) {
        // GPUBufferUsage: QUERY_RESOLVE 0x200 | COPY_SRC 0x4, then COPY_DST 0x8 | MAP_READ 0x1
        bufs = this.gpuBufs[type] = {
          resolve: dev.createBuffer({ label: `deck_prof_resolve_${type}`, size: max * 8, usage: 0x204 }),
          read: dev.createBuffer({ label: `deck_prof_read_${type}`, size: max * 8, usage: 0x9 }),
        }
      }
      const read = bufs.read
      if (read.mapState !== "unmapped") return null
      const enc = dev.createCommandEncoder()
      enc.resolveQuerySet(pool.querySet, 0, count, bufs.resolve, 0)
      enc.copyBufferToBuffer(bufs.resolve, 0, read, 0, count * 8)
      dev.queue.submit([enc.finish()])
      return read
        .mapAsync(1, 0, count * 8) // GPUMapMode.READ
        .then(() => {
          const out: Iv[] = []
          try {
            const ns = new BigUint64Array(read.getMappedRange(0, count * 8))
            for (const [uid, off] of offsets) {
              if (typeof uid !== "string" || typeof off !== "number" || off < 0 || off + 1 >= count) continue
              const m = FRAME_OF.exec(uid)
              if (!m) continue
              const b = ns[off]
              const e = ns[off + 1]
              // a pass that was allocated but never ran leaves zeros
              if (!b || !e || e < b) continue
              // one origin for both pools, so their stamps compare; near enough that the difference is exact as a double
              const base = (this.gpuBase ??= b)
              out.push({ frame: +m[1], compute: uid.startsWith("c:"), b: Number(b - base) / 1e6, e: Number(e - base) / 1e6 })
            }
          } finally {
            read.unmap()
          }
          return out
        })
        .catch(() => null)
    } catch {
      return null
    }
  }

  /**
   * Resolve every timestamp query since the last call into one record per frame, oldest first.
   * Span and busy come from the raw stamps (WebGPU only); the pass sum and count from three's own
   * per-pass durations, so `sum` is three's figure whatever happens to the raw path.
   */
  private async readGPU(): Promise<GpuFrame[] | null> {
    try {
      const r = this.renderer
      const pools = (r.backend as unknown as { timestampQueryPool?: Record<string, StampPool | null> }).timestampQueryPool
      const rawR = this.rawStamps("render")
      const rawC = this.rawStamps("compute")
      // three's resolves start in this same task (they empty the pools), before anything is awaited
      const threeR = r.resolveTimestampsAsync("render")
      const threeC = pools?.compute ? r.resolveTimestampsAsync("compute") : null
      const last = await threeR
      await threeC
      const by = new Map<number, GpuFrame>()
      const at = (frame: number) => {
        let f = by.get(frame)
        if (!f) by.set(frame, (f = { frame, span: null, busy: null, sum: 0, passes: 0 }))
        return f
      }
      const durs = pools?.render?.timestamps
      if (durs instanceof Map) {
        for (const [uid, ms] of durs as Map<unknown, unknown>) {
          const m = typeof uid === "string" ? FRAME_OF.exec(uid) : null
          if (!m || typeof ms !== "number") continue
          const f = at(+m[1])
          f.sum += ms
          f.passes++
        }
      }
      const frames = [...by.values()].sort((a, b) => a.frame - b.frame)
      if (!frames.length) {
        // no per-pass durations to be had: three's total for its latest frame is all there is
        return typeof last === "number" && last > 0 ? [{ frame: this.frameNo, span: null, busy: null, sum: last, passes: 0 }] : null
      }
      const ivR = rawR ? await rawR : null
      const ivC = rawC ? await rawC : null
      if (ivR) {
        const per = new Map<number, Iv[]>()
        for (const iv of ivC ? ivR.concat(ivC) : ivR) {
          const l = per.get(iv.frame)
          if (l) l.push(iv)
          else per.set(iv.frame, [iv])
        }
        for (const f of frames) {
          const l = per.get(f.frame)
          if (!l) continue
          // the raw stamps must add up to three's own durations for this frame, or they are not what we think
          let sum = 0
          let n = 0
          for (const iv of l) {
            if (iv.compute) continue
            sum += iv.e - iv.b
            n++
          }
          if (n !== f.passes || Math.abs(sum - f.sum) > 0.01) continue
          l.sort((a, b) => a.b - b.b)
          let busy = 0
          let end = l[0].b
          let hi = l[0].e
          for (const iv of l) {
            if (iv.e > hi) hi = iv.e
            if (iv.e <= end) continue
            busy += iv.e - Math.max(iv.b, end)
            end = iv.e
          }
          f.span = hi - l[0].b
          f.busy = busy
          f.ivs = l
        }
      }
      return frames
    } catch {
      return null
    }
  }

  /** Resolves when the GPU has finished everything submitted so far. */
  private gpuDone(): Promise<void> | void {
    const be = this.renderer.backend as unknown as { device?: GpuDev; gl?: WebGL2RenderingContext }
    if (this.backend === "webgpu") return be.device?.queue.onSubmittedWorkDone()
    const gl = be.gl
    if (!gl) return
    // Reading one pixel back has to wait for everything drawn (gl.finish() is not relied on: a
    // browser may treat it as a flush). The bindings it needs are put back, so three's state
    // cache stays true.
    const fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    const pk = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.profPixel)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pk)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb)
  }
  private profPixel = new Uint8Array(4)

  /**
   * Measuring only (`?prof`; `window.__deckProf.nan()` after a `seek`, or `nan(to, p)` for the
   * hand-off into `to` at `p`, which it seeks itself). Draw the frame once more with every scene's HDR source (what it hands `ctx.finish`, before tone
   * mapping, where a NaN still is one: after it, a NaN is indistinguishable from black) copied to a
   * half-float target, read them back, and count the pixels that are NaN or infinite, per scene.
   */
  async nanProbe(to?: number | string, p = 0.5) {
    if (!this.o.profile || this.disposed || !this.ready || this.nanTaps) return null
    const thaw = !this.frozen
    this.frozen = true
    this.nanTaps = new Map()
    const out: { scene: string; nan: number; inf: number; px: number; read: string; first: [number, number] | null }[] = []
    try {
      if (to !== undefined) await this.seekTransition(to, p)
      else this.frame(0)
      const taps = [...this.nanTaps]
      this.nanTaps = null
      for (const [slot, rt] of taps) {
        const w = rt.width
        const h = rt.height
        const px = (await this.renderer.readRenderTargetPixelsAsync(rt, 0, 0, w, h)) as ArrayLike<number>
        const half = px instanceof Uint16Array
        let nan = 0
        let inf = 0
        let first: [number, number] | null = null
        for (let k = 0; k < w * h * 4; k++) {
          const v = px[k]
          // half: exponent all ones is NaN with a mantissa, infinity without (an overflow past 65504)
          const bad = half ? ((v & 0x7c00) === 0x7c00 ? ((v & 0x3ff) !== 0 ? 1 : 2) : 0) : Number.isNaN(v) ? 1 : Number.isFinite(v) ? 0 : 2
          if (bad === 1) nan++
          else if (bad === 2) inf++
          if (bad && !first) first = [(k >> 2) % w, Math.floor((k >> 2) / w)]
        }
        out.push({ scene: slot.def.id, nan, inf, px: w * h, read: `${(px as object).constructor.name}[${px.length}]`, first })
        rt.dispose()
      }
    } finally {
      for (const rt of this.nanTaps?.values() ?? []) rt.dispose()
      this.nanTaps = null
      if (thaw) this.resume()
    }
    return out
  }

  /**
   * Measuring only (`?prof`; the harness calls it as `window.__deckProf.prof(n)` after a `seek`).
   * Draw the current frozen frame `frames` times, waiting for the GPU after each (span, busy, pass
   * sum), then `frames` times again with one wait at the end (wall), and report the medians, which
   * `info()` then shows too. See "GPU time" at the top
   * of this file. A deck that is running is frozen for the duration and resumed after.
   */
  async prof(frames = 10) {
    if (!this.o.profile || this.disposed || !this.ready) return null
    for (let i = 0; this.gpuBusy && i < 200; i++) await new Promise((r) => setTimeout(r, 10))
    if (this.gpuBusy || this.disposed) return null
    this.gpuBusy = true // also holds off the 20-frame sampler
    const thaw = !this.frozen
    this.frozen = true
    try {
      const n = Math.max(1, Math.min(24, Math.floor(frames))) // three's pool holds 1,024 passes
      const floors: number[] = []
      for (let i = 0; i < 5; i++) {
        const t = performance.now()
        await this.gpuDone()
        floors.push(performance.now() - t)
      }
      for (let i = 0; i < 2; i++) {
        this.frame(0)
        await this.gpuDone()
      }
      await this.readGPU() // empty the pools: only the frames below are counted
      const first = this.frameNo + 1
      const wall: number[] = []
      const cpu: number[] = []
      for (let i = 0; i < n; i++) {
        const t0 = performance.now()
        this.frame(0)
        const t1 = performance.now()
        await this.gpuDone()
        wall.push(performance.now() - t0)
        cpu.push(t1 - t0)
      }
      const got = ((await this.readGPU()) ?? []).filter((f) => f.frame >= first)
      // burst: the same frames with no wait between them, one wait at the end
      const firstB = this.frameNo + 1
      const tb = performance.now()
      for (let i = 0; i < n; i++) this.frame(0)
      const tc = performance.now()
      await this.gpuDone()
      const burstWall = (performance.now() - tb) / n
      const burstCpu = (tc - tb) / n
      const gotB = ((await this.readGPU()) ?? []).filter((f) => f.frame >= firstB)
      const spanB = gotB.filter((f) => f.span !== null).map((f) => f.span as number)
      this.keepGPU(got)
      const span = got.filter((f) => f.span !== null).map((f) => f.span as number)
      const busy = got.filter((f) => f.busy !== null).map((f) => f.busy as number)
      const sum = got.map((f) => f.sum)
      this.gpuWallMs = r2(burstWall)
      const rr = (v: number[]) => v.map((x) => Math.round(x * 1000) / 1000)
      return {
        backend: this.backend,
        size: [this.w, this.h],
        frames: n,
        /** Medians over the frames: `gpuMs` is the span, the number the budget refers to. */
        gpuMs: r2(median(span)),
        gpuBusyMs: r2(median(busy)),
        gpuPassSumMs: r2(median(sum)),
        gpuPasses: got.length ? got[got.length - 1].passes : null,
        gpuWallMs: this.gpuWallMs,
        /** Main-thread time to build and submit one frame; wall contains it. */
        cpuMs: r2(median(cpu)),
        /** One frame, one wait: cpu + GPU (with its wake from idle) + `floorMs`. */
        wallEachMs: r2(median(wall)),
        /** One wait for the GPU with nothing submitted: the round trip every wall figure contains. */
        floorMs: r2(median(floors)),
        drawCalls: this.stat.drawCalls,
        renderCalls: this.stat.renderCalls,
        computeCalls: this.stat.computeCalls,
        perFrame: { span: rr(span), busy: rr(busy), sum: rr(sum), wallEach: rr(wall), cpu: rr(cpu) },
        /** The burst behind `gpuWallMs`. Its spans are shown to be distrusted: queued frames overlap. */
        burst: { cpu: r2(burstCpu), span: rr(spanB) },
        /** The last frame's passes as [begin, end] in ms from its first begin, in begin order ("c" marks a compute pass): the overlap, to look at. */
        lastFrame: (got[got.length - 1]?.ivs ?? []).map((iv, _, l) => [...rr([iv.b - l[0].b, iv.e - l[0].b]), ...(iv.compute ? ["c"] : [])]),
      }
    } finally {
      this.gpuBusy = false
      if (thaw) this.resume()
    }
  }

  private cues(s: Slot, prevT: number) {
    if (!this.synth.on || !s.inst?.cues) return
    for (const c of s.inst.cues) if (c.b === s.beat && (prevT < c.at || (prevT === 0 && c.at === 0 && s.t > 0)) && s.t >= c.at) this.synth.play(c.s, c.pos ? { ...c.o, pos: c.pos } : c.o)
  }

  /** A transition's `p`-timed sounds (forward crossings of its linear progress) and its per-frame hook. */
  private transSound(a: Active, prev: number, pl: number) {
    for (const c of a.def.snd ?? []) if (c.p !== undefined && prev < Math.max(c.p, 1e-6) && pl >= c.p) this.synth.play(c.s, c.o)
    a.def.sound?.(pl, prev, this.synth)
  }

  // ---------------------------------------------------------------- the harness

  /** Stop the clock and render scene `scene`, beat `beat`, `t` seconds in. Deterministic. */
  async seek(scene: number | string, beat = 0, t = 0) {
    const i = typeof scene === "string" ? SCENES.findIndex((s) => s.id === scene) : scene
    if (!this.slots[i]) throw new Error(`seek: no scene ${String(scene)}`)
    await this.ensure(i)
    const S = this.slots[i]
    this.unpark(S)
    await this.compileSlot(S)
    this.frozen = true
    this.active = null
    this.scene = i
    this.unpark(S)
    S.rewind = false
    S.beat = clamp(beat, 0, S.def.beats.length - 1)
    S.t = t
    S.time = this.baseTime(S.def, S.beat) + t
    this.ready = true
    for (const o of this.slots) if (o !== S && Math.abs(o.i - i) > 1 && !o.compiling) this.drop(o)
    this.frame(0)
    this.emitPos()
    return { scene: S.def.id, beat: S.beat, t }
  }

  /** Render the hand-off into scene `to` at linear progress `p`, both scenes at the moment they would be. */
  async seekTransition(to: number | string, p: number) {
    const i = typeof to === "string" ? SCENES.findIndex((s) => s.id === to) : to
    if (i < 1 || !this.slots[i]) return null
    await Promise.all([this.ensure(i - 1), this.ensure(i)])
    const A = this.slots[i - 1]
    const B = this.slots[i]
    this.unpark(A)
    this.unpark(B)
    await Promise.all([this.compileSlot(A), this.compileSlot(B)])
    this.frozen = true
    this.ready = true
    this.unpark(A)
    this.unpark(B)
    const def = TRANSITIONS[B.def.enterWith]
    const tr = this.transFor(def.id)
    const items = tr.warm?.()
    if (items?.length) await this.compileItems(items)
    const lb = A.def.beats.length - 1
    A.beat = lb
    A.t = A.def.beats[lb].dur + A.def.beats[lb].hold + p * def.dur
    A.time = this.baseTime(A.def, lb) + A.t
    B.beat = 0
    B.t = -def.dur * (def.inAt ?? 0.5) + p * def.dur
    B.time = Math.max(0, p * def.dur)
    this.scene = i
    this.active = { from: i - 1, to: i, def, el: p * def.dur, dur: def.dur, reverse: false, speed: 1, queued: false }
    try {
      this.frame(0)
    } finally {
      // a transition that throws must not leave the deck believing it is mid hand-off
      this.active = null
    }
    return { transition: def.id, p }
  }

  /** Leave `seek` mode and run the clock again. */
  resume() {
    if (!this.frozen) return
    this.frozen = false
    this.lastNow = performance.now()
    this.housekeeping()
    this.kick()
  }

  /**
   * Load, compile and draw every scene once, in order, and report how long each took. For
   * measuring only: it is what the deck would cost if nothing were lazy.
   */
  async warmAll() {
    const out: { id: string; ms: number }[] = []
    const t00 = performance.now()
    for (const s of this.slots) {
      const t0 = performance.now()
      const had = !!s.inst
      await this.ensure(s.i)
      const wasParked = s.parked
      this.unpark(s)
      await this.compileSlot(s)
      const keep = { beat: s.beat, t: s.t, time: s.time }
      s.def.beats.forEach((b, bi) => {
        s.beat = bi
        s.t = b.dur * 0.5
        s.time = this.baseTime(s.def, bi) + s.t
        this.renderSlot(s, 0, 1, 0, false)
      })
      Object.assign(s, keep)
      const tr = s.i > 0 ? this.transFor(s.def.enterWith).warm?.() : null
      if (tr?.length) await this.compileItems(tr)
      await (this.renderer.backend as unknown as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device?.queue.onSubmittedWorkDone()
      out.push({ id: s.def.id, ms: Math.round(performance.now() - t0) })
      if (!had && Math.abs(s.i - this.scene) > 1) this.drop(s)
      else if (wasParked && Math.abs(s.i - this.scene) > 1) this.park(s)
    }
    return { total: Math.round(performance.now() - t00), scenes: out }
  }

  info() {
    const n = Math.min(this.ringN, RING)
    const sorted = this.scratchSort
    const q = (ring: Float32Array, at: number) => {
      sorted.set(ring)
      const v = sorted.subarray(0, n)
      v.sort()
      return pct(v, n, at)
    }
    const mem = this.renderer.info.memory as unknown as Record<string, number>
    return {
      backend: this.backend,
      gpu: this.gpu,
      size: [this.w, this.h],
      scale: this.renderScale,
      /** Smoothed interval between frames (what the ladder watches). */
      frameMs: Math.round(this.frameMs * 10) / 10,
      /** Interval between frames over the last 600: the display's refresh when the deck keeps up. */
      p50: q(this.ringGap, 0.5),
      p95: q(this.ringGap, 0.95),
      /** Main-thread time spent building and submitting a frame, over the same frames. */
      cpuP50: q(this.ringCpu, 0.5),
      cpuP95: q(this.ringCpu, 0.95),
      frames: n,
      /**
       * GPU time of a frame in ms, null unless the deck was opened with `?prof`: the span from its
       * first pass's begin to its last pass's end (median of recent frames). This is the figure the
       * frame budget refers to; see "GPU time" at the top of this file for the other three.
       */
      gpuMs: this.gpuMs,
      /** The same span without the gaps in which no pass was open. */
      gpuBusyMs: this.gpuBusyMs,
      /** Sum of the render passes' durations (three's `info.render.timestamp`, the old `gpuMs`): overlaps counted again, not frame time. */
      gpuPassSumMs: this.gpuPassSumMs,
      /** Render passes timed in that frame. */
      gpuPasses: this.gpuPasses,
      /** Wall time per frame over a burst of frames, from the last `prof()` run; null until one has run. */
      gpuWallMs: this.gpuWallMs,
      drawCalls: this.stat.drawCalls,
      triangles: this.stat.triangles,
      renderCalls: this.stat.renderCalls,
      computeCalls: this.stat.computeCalls,
      /** Shader modules alive (three calls them programs on both backends). */
      programs: mem.programs ?? 0,
      renderTargets: mem.renderTargets ?? 0,
      textures: mem.textures ?? 0,
      loaded: this.slots.filter((s) => s.inst).map((s) => s.def.id),
      parked: this.slots.filter((s) => s.inst && s.parked).map((s) => s.def.id),
      warming: this.warmQueue.length + this.compiles,
      /**
       * Milliseconds. `init`: renderer and backend ready. `firstFrame`: first frame drawn, from the
       * moment the engine was asked for. `sinceNavigation`: the same moment on the page's clock.
       * `compile`: each scene's compileAsync. `warm`: each neighbour fully warm (compiled, every beat
       * drawn once, its transition drawn), including the idle gaps between its sliced renders.
       */
      timing: { init: Math.round(this.timing.init), firstFrame: Math.round(this.timing.firstFrame), sinceNavigation: Math.round(this.timing.nav), compile: this.timing.compile, warm: this.timing.warm },
      /** Milliseconds each stage of `start` took: scene chunk, compile, beats drawn, first frame. */
      boot: this.timing.boot,
      /** False if a compileAsync did not answer and scenes now compile on their first render. */
      prewarm: this.prewarm,
    }
  }

  dispose() {
    this.disposed = true
    const g = globalThis as { __deckProf?: unknown }
    if (this.profHook && g.__deckProf === this.profHook) delete g.__deckProf
    for (const b of Object.values(this.gpuBufs)) {
      b.resolve.destroy()
      b.read.destroy()
    }
    this.gpuBufs = {}
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.warmTimer)
    this.ro.disconnect()
    this.o.canvas.removeEventListener("pointermove", this.onPointer)
    this.o.canvas.removeEventListener("pointerleave", this.onLeave)
    for (const s of this.slots) {
      this.drop(s)
      s.out.dispose()
      s.type.dispose()
    }
    for (const rt of [this.mixRT, ...this.snaps.values(), ...this.transTargets.map((t) => t.rt)]) rt.dispose()
    this.flushPool()
    for (const t of this.trans.values()) t.dispose?.()
    this.upPass?.dispose()
    this.post.dispose()
    this.synth.dispose()
    void this.renderer.dispose()
  }
}
