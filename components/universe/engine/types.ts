import type * as THREE from "three/webgpu"

import type { SceneDef, TransitionId } from "../script"
import type { Ease } from "./ease"
import type { Pos, Snd, SndOpts, Synth } from "./synth"
import type { FontMap, Type2D } from "./text"
import type { F, V2, V3 } from "./tsl"

/**
 * A frame within the frame, for linked transitions: four clip-space corners (TL, TR, BR, BL),
 * how much of the flat texture still shows (`a`, so a lit 3D stand-in can take over without a
 * seam) and how much it is darkened as it becomes an object in the scene.
 */
export type Portal = { c: [[number, number], [number, number], [number, number], [number, number]]; a?: number; shade?: number }

/**
 * What a scene is told every frame. Everything it draws must be a pure function of this.
 * The object is reused from frame to frame: read it, do not keep it.
 */
export type State = {
  /** Current beat index. */
  beat: number
  /** Seconds since that beat started (negative while the scene is still arriving). */
  t: number
  /** Seconds since the scene's first beat: for ambient motion only. Deterministic under `seek`. */
  time: number
  dt: number
  /** 0..1 while this scene is being transitioned in, 1 afterwards. */
  enter: number
  /** 0..1 while this scene is being transitioned out, 0 before. */
  exit: number
  /** Render size in pixels. */
  w: number
  h: number
  /** False under `seek` and reduced motion: no sound, no accumulated state. */
  live: boolean
  /** Pointer in clip space (-1..1), smoothed; (0,0) when away. For parallax only. */
  mouse: { x: number; y: number }
  /** Keyframe: 0..1 over seconds [from, to] of beat `b`; 0 before that beat, 1 once it has passed. */
  k(b: number, from: number, to: number, ease?: Ease): number
  /** Seconds into beat `b`: negative before it, a large number after it. */
  at(b: number): number
}

/**
 * A sound on the story clock: `s` plays when beat `b` crosses `at` seconds going forward (never
 * on the way back, under `seek` or under reduced motion). `o` is pitch (`f`, use `H(n)`), level,
 * length and placement; `pos` here is shorthand for `o.pos`: where the source is in listener space
 * (`[x right, y up, z into the screen]`, -1..1 across the frame, see `listenerPos` in synth.ts), or
 * a function returning that, called when the cue fires, for a source that moves.
 */
export type Cue = { b: number; at: number; s: Snd; o?: SndOpts; pos?: Pos | (() => Pos) }

export type PostOpts = {
  exposure?: number
  tone?: "none" | "aces" | "agx"
  /** Bloom strength (0 = skip the bloom chain). */
  bloom?: number
  bloomThresh?: number
  vignette?: number
  /** Chromatic aberration, in fractions of the frame at the corners. */
  ca?: number
  sat?: number
  contrast?: number
  /** Colour grade: added in shadows, multiplied in highlights. */
  lift?: [number, number, number]
  gain?: [number, number, number]
  /** Film grain strength for this scene (the final pass adds it, weighted to the midtones). */
  grain?: number
  /** Red-shifts the bloom, the way film halates around highlights. */
  halation?: number
  bloomRadius?: number
  /** Fade the finished frame toward a colour (0..1). */
  fade?: number
  fadeColor?: [number, number, number]
}

/**
 * A bag of TSL inputs: `uniform(...)` nodes and `texture(...)` nodes. Build them with three/tsl,
 * hand them to `ctx.pass`, close over them in the builder, and set `.value` every frame.
 */
export type Uniforms = Record<string, { value: unknown }>

/** What a pass builder is given. */
export type PassIn = {
  /** Full-screen uv, origin bottom-left (y up): the old `vUv`. */
  uv: V2
  /** Size in pixels of the target being drawn into: the old `uRes`. */
  res: V2
  /** The deck's ambient clock in seconds: the old `uTime`. (Never three's own `time` node.) */
  time: F
}

/** A colour node (vec3 or vec4), or a function from the pass inputs to one. */
export type PassBuild = THREE.Node | ((p: PassIn) => THREE.Node)

export type Pass<U extends Uniforms = Uniforms> = {
  u: U
  mat: THREE.NodeMaterial
  mesh: THREE.Mesh
  render(target: THREE.RenderTarget | null): void
  dispose(): void
}

export type TargetOpts = {
  /** Half-float linear colour (default true). */
  hdr?: boolean
  depth?: boolean
  samples?: number
  /** Fraction of the frame size (default 1). */
  scale?: number
  /** Fixed size instead of a fraction of the frame. */
  fixed?: [number, number]
}

/**
 * Something the engine can compile ahead of time with `renderer.compileAsync`: a 3D scene with
 * the camera and target it is drawn with, or a full-screen pass with the target it is drawn into.
 * The target matters: a pipeline is specific to its format and sample count.
 */
export type WarmItem = { scene: THREE.Object3D; camera: THREE.Camera; target: THREE.RenderTarget | null } | { pass: Pass<Uniforms>; target: THREE.RenderTarget | null }

/** Half-resolution work that converges over frames. See `ctx.temporal`. */
export type Temporal = {
  /** This frame's sub-pixel offset in pixels of the low-res target (0,0 under `seek`). */
  jitter(s: State): [number, number]
  /** Blend this frame's low-res picture into the history and return the accumulated texture. */
  resolve(current: THREE.Texture, s: State): THREE.Texture
}

export type Ctx = {
  renderer: THREE.WebGPURenderer
  /** "webgpu", or "webgl2" when the fallback backend is live. */
  backend: "webgpu" | "webgl2"
  def: SceneDef
  fonts: FontMap
  synth: Synth
  /** A render target owned by this scene: resized with the frame, shrunk to 2×2 while parked. */
  target(o?: TargetOpts): THREE.RenderTarget
  /**
   * A pooled target for this frame only: valid from the call until this scene's `render` returns,
   * then handed to whoever asks next. For blur chains and other intermediates nobody keeps.
   */
  scratch(o?: TargetOpts): THREE.RenderTarget
  /** A full-screen pass: a TSL colour node, or a builder given `{ uv, res, time }`. */
  pass<U extends Uniforms = Uniforms>(build: PassBuild, uniforms?: U): Pass<U>
  /** Draw `src` (a render target's texture) into `dst`, filtered: for reduced-resolution layers. */
  upsample(src: THREE.Texture, dst: THREE.RenderTarget): void
  /** A jittered accumulation buffer for reduced-resolution work (`scale` .5 or .25). */
  temporal(o?: { scale?: number; blend?: number }): Temporal
  /**
   * Run a TSL compute node now (`Fn(() => { buf.element(instanceIndex).assign(...) })().compute(n)`,
   * with `buf = instancedArray(n, "vec3")` read by a material through `buf.toAttribute()`).
   * The rule: what it writes must be a pure function of `State`. Write the buffer from the story
   * parameter every frame, or, if you integrate, reset to a deterministic state and re-integrate
   * whenever `!s.live` or time jumps, so `seek` equals live play.
   * On the WebGL 2 backend three runs the same node as transform feedback: one pass over the
   * instances, a single count. Per-instance writes give the identical picture there (tested);
   * keep to that shape. List the node in `warmCompute()`.
   */
  compute(node: THREE.ComputeNode | THREE.ComputeNode[]): void
  /** Post-process a linear HDR texture into this scene's output, with its type layer on top. */
  finish(src: THREE.Texture, post?: PostOpts): void
  size(): { w: number; h: number }
  /**
   * True when the page was opened with `?labels`: draw every in-world label's plate as flat
   * magenta (1, 0, 1), unlit, with its normal depth test, so the review tool can count how much of
   * each survives occlusion. Costs nothing when false.
   */
  debugLabels: boolean
  /** A 640×360 picture of a scene the talk has already left, or null if it was never shown. */
  snapshot(id: string): THREE.Texture | null
}

export type LabelInfo = { id: string; corners: [[number, number], [number, number], [number, number], [number, number]] }

export type SceneInstance = {
  update?(s: State): void
  /** Draw the scene, ending with `ctx.finish(...)`. */
  render(s: State): void
  /** Describe the type layer for this frame. */
  type?(g: Type2D, s: State): void
  /** Where the frame-within-the-frame is, if this scene has one. */
  portal?(s: State): Portal | null
  /**
   * Colour of the corner clock, or `hide` when the scene draws its own. `clock` replaces the
   * beat's `page` for this frame, for a clock that runs within a beat: `text` is shown, and when
   * `prev` is given and differs, `prev` fades out and `text` rises in over 0.9 s from `since`
   * seconds ago, the same motion as a beat change. Keep it a pure function of `s` (derive `since`
   * from the beat clock) so `seek` matches live play. Without `clock`, nothing changes.
   */
  hud?(s: State): { color: string; hide?: boolean; shadow?: string; clock?: { text: string; prev?: string; since?: number } }
  /**
   * Every piece of in-world print the viewer is meant to read right now (tags, plaques, engraved
   * numerals), as four clip-space corners each. The review tool `tools/labels.mjs` uses this with
   * `ctx.debugLabels` to measure how much of each label is really visible. See `labelReport`.
   */
  labels?(s: State): LabelInfo[]
  /**
   * What to compile before the scene is first shown: its 3D scenes and passes with their targets.
   * Optional: anything not listed is compiled by the first render that draws it, in the sliced
   * warm-up, which blocks the frame it lands on.
   */
  warm?(): WarmItem[]
  /** Compute nodes to compile ahead of time. */
  warmCompute?(): THREE.ComputeNode[]
  cues?: Cue[]
  resize?(w: number, h: number): void
  dispose?(): void
}

export type SceneModule = { create(ctx: Ctx): SceneInstance | Promise<SceneInstance> }

export type TransArgs = {
  /** Finished frames of the outgoing and incoming scene (sRGB, 8-bit render targets). */
  A: THREE.Texture
  B: THREE.Texture
  /** Eased and linear progress. */
  p: number
  pl: number
  time: number
  /** Portals of the outgoing and incoming scene, if they expose one. */
  pa: Portal | null
  pb: Portal | null
  /** Where to draw. */
  out: THREE.RenderTarget
}

export type TransCtx = {
  renderer: THREE.WebGPURenderer
  backend: "webgpu" | "webgl2"
  pass<U extends Uniforms = Uniforms>(build: PassBuild, uniforms?: U): Pass<U>
  /** A target owned by the transition (freed when the deck is). */
  target(o?: TargetOpts): THREE.RenderTarget
  compute(node: THREE.ComputeNode | THREE.ComputeNode[]): void
  size(): { w: number; h: number }
}

/** What the simple form of a transition is given. Everything is a TSL node. */
export type TransIn = PassIn & {
  /** Outgoing and incoming frame at a y-up uv (sRGB values, as they will be shown). */
  a(uv?: V2): V3
  b(uv?: V2): V3
  /** The texture nodes themselves, for `quadTex` (sample them with `sampleRT`). */
  A: THREE.TextureNode
  B: THREE.TextureNode
  /** Eased and linear progress, 0..1. */
  p: F
  pl: F
  /** Inverse homography of each scene's portal: use `quadUV(HA, uv)`. */
  HA: THREE.Node<"mat3">
  HB: THREE.Node<"mat3">
  /** x: 1 if that portal exists, y: its coverage `a`, z: its shade. */
  PA: THREE.Node<"vec4">
  PB: THREE.Node<"vec4">
}

export type TransitionDef = {
  id: TransitionId
  /** Seconds. */
  dur: number
  /** Fraction of the transition after which the incoming scene's first beat starts its clock. */
  inAt?: number
  ease?: Ease
  /**
   * The transition's sounds. Without `p` an entry is scheduled when the transition starts (`o.at`
   * seconds in). With `p` (0..1) it fires when the linear progress crosses that fraction going
   * forward, so it stays on its picture when a key press speeds the transition up.
   */
  snd?: { s: Snd; o?: SndOpts; p?: number }[]
  /**
   * Called every live forward frame with the linear progress now and a frame ago: drive a bed
   * (`synth.bed("wind", pl)`) or play a positioned sound on something that moves.
   */
  sound?(pl: number, prev: number, synth: Synth): void
  /**
   * The simple form: a TSL function of the two frames returning the colour (vec3) for this pixel.
   * Left out, the transition is a plain mix by `p`.
   */
  trans?(t: TransIn): THREE.Node
  /** The full form, for transitions with their own geometry or several passes. */
  create?(ctx: TransCtx): { render(a: TransArgs): void; warm?(): WarmItem[]; dispose?(): void }
  /** Set while the transition's GLSL original has not been ported: the engine says so once and mixes. */
  unported?: string
}
