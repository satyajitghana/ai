// The creature toolkit, part 1: the anatomical spec. Plain data a scene author writes from
// skeletal diagrams and published reconstructions. Everything an animal is made of is one
// primitive, a swept tube: a centre line with a cross-section at stations along it. A body is a
// tube along the spine; a limb is a tube through its joints; a horn, a plate, a fin, a flap, a
// frill and an eye are tubes whose sections are round, flat, bowed or pinched. So one builder
// welds, caps, skins and blends all of them (build.ts), and one solver poses them (rig.ts).
//
// Model space: +x is forward (the head), +y is up, +z is the animal's right. Lengths are in
// whatever unit the author measures the diagram in; `scale` on an instance maps them to the scene.

export type Vec3 = readonly [number, number, number]

/**
 * A cross-section at `at` (0..1 along the part). A superellipse with separate upper and lower
 * halves: `w` is the half-width along the section's side axis, `up` and `dn` the half-heights
 * above and below the centre line (dn defaults to up), `n`/`nb` the exponents of the upper and
 * lower half (2 = ellipse, 4+ = boxy, 1.3 = pinched, a keel), and `bow` droops the sides (a saddle:
 * a frill or a carapace wrapping round), as a fraction of `w`.
 */
export type Section = {
  at: number; w: number; up: number; dn?: number; n?: number; nb?: number; bow?: number
  /** A ridge along the dorsal line: [height, half-width] in model units (a vertebral ridge on a back or tail, a sagittal crest). */
  ridge?: [number, number]
  /** The same along the ventral line (a keel, a breastbone). */
  keel?: [number, number]
}

/**
 * A local swelling (or, with a negative `h`, a hollow) of a part's surface: a muscle belly, a
 * shoulder blade, a hip, a knee cap, an elbow point, a cheek, a brow boss, a knuckle; a nostril,
 * an eye socket, the hollow behind a jaw. It is part of the surface itself, so children anchor on
 * it, normals follow it and every level of detail carries it (as far as its rings resolve it).
 */
export type Bulge = {
  /** Centre along the part, 0..1, and its half-extent along it (also 0..1 of the part's length). */
  at: number
  len: number
  /** Centre round the section in degrees from the dorsal line toward the right, and its half-extent in degrees. */
  around: number
  arc: number
  /** Height in model units; negative digs a hollow. */
  h: number
  /** Also on the other side (default true unless `around` is 0 or 180). */
  mirror?: boolean
}

/** Material ids a vertex carries (aBody.z); the shading factories branch on them. */
export const MAT = { skin: 0, horn: 1, eye: 2, membrane: 3, shell: 4, mouth: 5, /** a held object riding the skeleton (a stone, a shaft): `Look.prop` */ prop: 6, /** lips: skin, tinted by `Look.lip` */ lip: 7, /** hair as solid geometry (brows, a cap): matte, `Look.hair` */ hair: 8, /** a hide or bark-cloth garment: matte, `Look.hide` */ hide: 9, /** the skin of a finger or thumb: skin everywhere, plus flexion creases, knuckle wrinkles and fingerprint ridges by `vBody` (row = digit, v = along it) when the Look has `hand` */ digit: 10 } as const

export type Cap = "round" | "point" | "flat" | "none"

export type BodySpec = {
  /** The spine's rest curve, tail tip first, snout last (Catmull-Rom through these points). */
  spine: Vec3[]
  /** Sections along it, `at` 0 = tail tip, 1 = snout. */
  sect: Section[]
  rings?: number
  sides?: number
  /** Spine frames: a count (evenly spaced) or their positions 0..1. A frame is a bone the solver places on the path. */
  bones: number | number[]
  caps?: [Cap, Cap]
  /** Arthropod segmentation: `count` grooves of relative `depth` between `from` and `to`. */
  segments?: { from: number; to: number; count: number; depth: number }
  mat?: number
  /** Breathing: the stretch [from, to] of the trunk whose flanks swell, and by how much: MODEL UNITS of outward travel at the flank (not a fraction of the radius). */
  breath?: [number, number, number]
  /**
   * Which way the section's dorsal line faces at the first station (it is carried along the curve
   * from there without twisting). Default +y; for a spine that starts within about 30 degrees of
   * vertical (an upright torso, a rearing animal) the default is -x: the back of a figure facing +x,
   * so `around: 0` is the back, 180 the chest, 90 the right side.
   */
  up?: Vec3
  /** Muscle and bone under the skin: shoulder, hip, rib cage, cheek, brow; hollows for a nostril or a socket. */
  bulges?: Bulge[]
}

/**
 * A part: a limb or an attachment. It grows from a point on its parent's surface (`on`, `at`,
 * `around`) and follows `path`. Where it leaves the parent it is flared and laid onto the parent's
 * surface with the parent's normals and skin weights (the `fillet`), so the junction shades as one skin.
 */
export type PartSpec = {
  name: string
  /** Parent part (default "body"). */
  on?: string
  /** Where on the parent: along it 0..1, and degrees round its section from the dorsal line toward the right side. */
  at?: number
  around?: number
  /** Or an explicit joint position in model space (a hip socket read off a skeletal diagram); the parent is still `on`. */
  origin?: Vec3
  /** Also build the mirror image on the other side (names get "R" and "L"). */
  mirror?: boolean
  /** Start this far beneath the parent's surface (model units), so the joint sits inside the body. */
  sink?: number
  /** Centre line in model axes, relative to the anchor; the anchor itself is the implicit first point. */
  path: Vec3[]
  /**
   * Axes `path` is written in. "model" (default): the model's own. "surface": x along the parent
   * (toward its far end), y out of its skin, z across it; for rows of spines on a curled parent.
   */
  frame?: "model" | "surface"
  /** Segment grooves along the part (podomeres of an arthropod limb): how many, and their relative depth. */
  segments?: { count: number; depth: number }
  /** True: `path` is a polyline of joints (a limb). False (default): a smooth curve through the points. */
  jointed?: boolean
  /** Which way the section's "up" (its thin axis, for a flat part) faces. Default +y, or +x if the part points up. */
  up?: Vec3
  sect: Section[]
  rings?: number
  sides?: number
  /** Height of the blend onto the parent, in model units (0 = none). */
  fillet?: number
  /** How far the root flares out as it meets the parent, as a fraction of its own radius (default 0.55; less for a part that continues its parent end to end). */
  flare?: number
  cap?: Cap
  /** Cap of the root end (default "none": the root is buried in its parent). Give a free part (a held stone) a cap at both ends. */
  cap0?: Cap
  /** Swellings and hollows of this part's surface: a calf, a knee, an elbow point, a knuckle (see Bulge). */
  bulges?: Bulge[]
  /**
   * On a leg of four segments (hip, knee, ankle, ball of the foot, toe tip): the last segment is
   * the toes. It stays flat on the ground through stance while the segment above rolls over it
   * (the heel peels up first), and only leaves at toe-off.
   */
  toes?: boolean
  /**
   * Bones: 0 = rigid, riding the parent (a horn); "joints" = one per path segment (a limb);
   * a number = that many along the part (a flap, an antenna, a grasping appendage).
   */
  bones?: 0 | "joints" | number
  mat?: number
  /**
   * Joint limits, radians. On a leg: the least and most the knee or elbow may flex (0 = straight),
   * so a column limb never locks dead straight or folds. On any other chain: the range each bone's
   * motion angle is clamped to.
   */
  limits?: [number, number]
  /** What the solvers call this part: "leg", "flap", "jaw", "stalk", "fan", anything you name in a Motion. */
  role?: string
  /** Position in a row of like parts (flap 0, 1, 2 ...): the phase index of a metachronal wave. */
  row?: number
  /** 0..1 translucency of a thin part (a membrane, a fin); the shading lets light through it. */
  thin?: number
  /** Drop the part below this detail level (1 = hero only, 0.5 = hero and reduced, 0 = always). */
  minDetail?: number
  /**
   * A rigid part (`bones` 0) whose far end follows the first bone of each named part, averaged,
   * blending from its parent's bone at `followFrom` (0..1 along it, default 0) to them at its tip:
   * a web of skin between two fingers, a membrane between two limbs. Same-side names resolve to the
   * same mirrored copy; "thumb.1" names a part's second bone. The named parts must come before this one.
   */
  follow?: string[]
  followFrom?: number
}

/** Cards (feathers, scales, bristles, setae) scattered over a region of a part and riding its skin. */
export type CardSpec = {
  on?: string
  from: number
  to: number
  /** Degrees round the section, from the dorsal line: [a0, a1] on the right side, mirrored to the left. */
  arc: [number, number]
  count: number
  len: number
  w: number
  /** How far the card lifts off the skin (radians). */
  lift?: number
  /** Jitter of direction (radians) and size (fraction). */
  jitter?: number
  seed?: number
  /** In ordered rows (`rows` along the part) instead of scattered. */
  rows?: number
  /** Lowest detail level that carries these cards (default 1: the hero mesh only). */
  minDetail?: number
}

export type GaitName = "walk" | "amble" | "trot" | "biped" | "metachronal"

/** How a legged animal walks. Distances are model units, angles radians, phases fractions of a stride. */
export type GaitSpec = {
  gait: GaitName
  /** Distance the body travels in one full cycle. Speed = stride x frequency: the scene supplies distance. */
  stride: number
  /** Fraction of the cycle a foot is on the ground (walk 0.6 to 0.75, trot 0.45, a heavy amble 0.7+). */
  duty: number
  /** Height of the swing arc. */
  lift: number
  /** Lateral distance of the footfalls from the midline, per leg pair front to back (default: where the rest pose puts the foot). */
  track?: number[]
  /** Phase lag between successive leg pairs for "metachronal" (front to back). */
  lag?: number
  /** Trunk motion amplitudes: vertical bob, lateral weight shift, roll, pitch (model units / radians). */
  bob?: number
  shift?: number
  roll?: number
  pitch?: number
  /** Girdle yaw: how far the hips and shoulders swing with the legs (radians). */
  girdle?: number
  /** Tail counter-sway: lateral amplitude at the tip (model units) and the lag along it (cycles). */
  tail?: [number, number]
  /** Head sway amplitude at the snout and its lag. */
  head?: [number, number]
  /** Spine positions (0..1) where the tail ends and the neck begins. */
  tailAt?: number
  neckAt?: number
  /**
   * Weight. `drop`: how far a girdle sinks as each of its feet takes the load (model units): a
   * sharp dip just after the footfall and a slow recovery, not a sine. `dropRoll`: radians the
   * girdle tips toward the foot that has just landed.
   */
  drop?: number
  dropRoll?: number
  /** The belly swings between the girdles: [lateral amplitude, lag in cycles]; it also bounces a third of that, late. */
  belly?: [number, number]
  /** The tail's root rides the hip's drop and the rest follows late: vertical amplitude at the tip as a multiple of `drop`. */
  tailBob?: number
}

/**
 * A held pose of jointed or chained parts: per part (its spec name; a mirrored part takes the
 * same pose on both sides, or name one side with "R" / "L"), per bone from the root out,
 * [flex, spread, twist] in radians. Flex bends toward the side opposite the part's `up` (a finger
 * curling to the palm, a toe to the sole); spread turns about `up`; twist about its length.
 * The pose is weighted by `drive.ch[<pose name>]`, so poses blend (an open hand into a grip).
 */
export type Pose = Record<string, [number, number?, number?][]>

/** How a swimmer undulates. */
export type SwimSpec = {
  /** Body lengths per wave along the body. */
  wavelength: number
  /** Distance travelled per wave cycle (stride of a swimmer). */
  stride: number
  /** Amplitude envelope: [at 0..1, amplitude in model units] pairs, tail to head. A stiff front is a row of zeros. */
  amp: [number, number][]
  plane?: "lateral" | "vertical"
  /** Bank into turns: roll radians per unit of path curvature. */
  bank?: number
}

/**
 * A sine motion of every bone of every part with a given role: a flap cycle, a metachronal ripple
 * along a row, the curl of an appendage, a chewing jaw, a swaying antenna. For bone k of the part
 * at row i: angle = bias + biasK*k + (amp + ampK*k) * sin(2pi*(cycles*rate - i*lag - k*tipLag) + offset).
 * `cycles` is the instance's cycle count (distance / stride) unless `clock` is "time".
 */
export type Motion = {
  role: string
  /** Rotation axis in the part's own frame: "side" (its chord: a flap beating), "up" (yaw), "tan" (twist). */
  axis: "side" | "up" | "tan"
  bias?: number
  biasK?: number
  amp?: number
  ampK?: number
  rate?: number
  lag?: number
  tipLag?: number
  offset?: number
  /** "cycle" (default): driven by distance travelled. "time": driven by seconds (rate in Hz). */
  clock?: "cycle" | "time"
  /** Left and right sides half a cycle apart. */
  alternate?: boolean
  /** Scale the whole motion by `drive.ch[channel]` (0 when the scene has not set it): a jaw, a grasp. */
  channel?: string
}

export type CreatureSpec = {
  name: string
  body: BodySpec
  parts: PartSpec[]
  cards?: CardSpec[]
  gait?: GaitSpec
  swim?: SwimSpec
  motions?: Motion[]
  /**
   * Vertex skinning: "linear" (default, the classic blend) or "dq" (dual quaternions: no candy
   * wrapper at a twisted wrist, no collapse at a shoulder raised far from rest, at the price of a
   * slight bulge at a sharply bent joint). Read by `makeHerd`; pass it to `skinNodes` if you call that yourself.
   */
  skinning?: "linear" | "dq"
  /**
   * Contact occlusion between parts that crowd each other (fingers on a hand): capsules riding
   * bones (rest-space ends `a`, `b`, radius `r`) darken the skin that faces them, computed per
   * vertex from the posed bones, so it follows a grip. Only vertices inside one of the rest-space
   * `gates` spheres ([x, y, z, radius]) pay for it. Hero and reduced levels only.
   */
  occlusion?: { gates: [number, number, number, number][]; caps: { bone: string; a: Vec3; b: Vec3; r: number }[]; strength?: number }
  /** Named poses, each weighted by the drive channel of the same name (see Pose). */
  poses?: Record<string, Pose>
  /** Ground clearance is whatever the rest pose says: y = 0 is the ground for a walker. */
}
