// The creature toolkit: model real animals from an anatomical spec, pose them with closed-form
// gaits, shade them with the scene's own light, and draw herds of them in a handful of calls.
// Documentation for scene builders: R/BUILD.md, "The creature toolkit".
//
//   spec.ts      the anatomical spec (plain data)
//   build.ts     spec -> welded, skinned tube geometry and a skeleton, at a level of detail
//   rig.ts       paths, and the pose: gaits with planted feet, undulation, flap rows, secondary motion
//   gpu.ts       the bone palette, vertex-stage skinning, and the herd (culling, LOD, instancing)
//   shade.ts     skin, chitin, scales, feathers and underwater material factories
//   shadow.ts    ground shadows: the herd's silhouettes flattened along the light, two draws
//   anatomy.ts   helpers that write spec data: a body lofted from profile curves, limbs with muscle, digits
//   grip.ts      close a hand's digits round a primitive: a held pose, solved once
//   examples.ts  Anomalocaris and Triceratops: worked examples, not stock animals

export * from "./creature/spec"
export { buildCreature, surf, surfNormal, type Built, type PartInfo, type Skeleton } from "./creature/build"
export { makePath, makeAim, makeRig, makeDrive, HEADER, paletteWidth, GAIT_OFFSETS, type Path, type Rig, type Drive } from "./creature/rig"
export { makeHerd, makePalette, makePress, skinNodes, occCaps, type OccCaps, type Press, type Herd, type HerdOpts, type LodSpec, type Palette, type SkinNodes } from "./creature/gpu"
export { skinMaterial, chitinMaterial, scalesMaterial, featherMaterial, underwaterMaterial, waterAbsorb, waterCaustics, type Lights, type Look, type Water } from "./creature/shade"
export { makeShadow, type Shadow, type ShadowOpts } from "./creature/shadow"
export { loft, limb, digit, muscle, type Station, type Loft, type Girth, type LimbSpec, type DigitSpec } from "./creature/anatomy"
export { solveGrip, gripDistance, type GripShape, type GripOpts } from "./creature/grip"
export * as examples from "./creature/examples"

// The posable human figure (body types, poses, skin): see BUILD.md, "The creature toolkit".
export * as human from "./creature/human"

// The macro hand (a forearm and hand for close-ups, and the generator the figure's hands come from): see BUILD.md, "The creature toolkit".
export * as hand from "./creature/hand"
