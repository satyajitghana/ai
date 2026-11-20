// What three.js scene code meets in ThreeRT, read from the repository at 65a4eb9 (16 November 2026):
// packages/scene/src (the exports of @threert/scene), its compat.ts, tests/three-compat/README.md ("Where ThreeRT
// differs, on purpose"), docs/ROADMAP.md step 2f, and tools/three/engine.ts (the same Engine API drawn by three.js
// r187 in a browser, and what that mapping drops). "absent" means I searched packages/scene/src for the name and
// found nothing; it is a sample of three.js names that scene code often uses, not a census of three.js.

export type Status = "same" | "mapped" | "ignored" | "absent" | "extra"

export type Entry = { name: string; group: string; status: Status; native: string; web: string }

export const STATUS: Record<Status, { label: string; cls: string }> = {
  same: { label: "works as in three.js", cls: "bg-emerald-500/15 border-emerald-500/50 text-emerald-800 dark:text-emerald-300" },
  mapped: { label: "accepted, behaves differently", cls: "bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-300" },
  ignored: { label: "accepted, does nothing", cls: "bg-slate-500/15 border-slate-500/50 text-slate-700 dark:text-slate-300" },
  absent: { label: "not in @threert/scene", cls: "bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-300" },
  extra: { label: "ThreeRT only", cls: "bg-sky-500/15 border-sky-500/50 text-sky-800 dark:text-sky-300" },
}

const PATH = "Traced: shadows from every light, bounce light and reflections come from the path tracer."

export const ENTRIES: Entry[] = [
  // scene graph
  { name: "Scene", group: "Scene graph", status: "same", native: "The root a game's setup returns. scene.background is shown at the scene's light level, not as a raw colour.", web: "A THREE.Scene." },
  { name: "Object3D / Group", group: "Scene graph", status: "same", native: "add, attach, clone, traverse, lookAt, localToWorld, getWorldQuaternion and the is* flags (ROADMAP step 2f). Objects report their own changes to the engine (SceneBinding).", web: "THREE.Group holders, one per engine object." },
  { name: "Mesh", group: "Scene graph", status: "same", native: "Including material arrays with geometry groups. Moving a mesh promotes it to its own acceleration structure (instance in the TLAS) instead of rebuilding the scene.", web: "THREE.Mesh." },
  { name: "InstancedMesh", group: "Scene graph", status: "same", native: "Instance matrices, colours and per-instance data reach the kernel as instance records.", web: "THREE.InstancedMesh." },
  // geometry
  { name: "BufferGeometry", group: "Geometry", status: "same", native: "setAttribute, setIndex, addGroup, translate, center, computeBoundingBox, toNonIndexed. Vertex colours since step 2g.", web: "THREE.BufferGeometry from the same typed arrays." },
  { name: "Box / Sphere / Plane / Cylinder / Cone / Torus / TorusKnot / Capsule / Circle / Ring / Lathe / polyhedra", group: "Geometry", status: "same", native: "Generated in TypeScript, sent as triangles.", web: "The same triangles." },
  { name: "DynamicDrawUsage", group: "Geometry", status: "mapped", native: "Gives the mesh its own BLAS ahead of a change. Without it, the first change rebuilds once and promotes the mesh (frame log: fallback \"promote\").", web: "Plain buffer updates." },
  { name: "Shape / ExtrudeGeometry", group: "Geometry", status: "absent", native: "Still open in the compatibility set (polygon triangulation): the one snippet of 34 that does not pass.", web: "Not reachable: scene code imports @threert/scene, not three." },
  { name: "TubeGeometry", group: "Geometry", status: "absent", native: "Not exported.", web: "Not reachable." },
  // materials
  { name: "MeshStandardMaterial", group: "Materials", status: "same", native: "UE5 DefaultLit: Lambert + GGX with multiple-scattering compensation. " + PATH, web: "MeshStandardMaterial with shadow maps and PMREM image lighting." },
  { name: "MeshPhysicalMaterial", group: "Materials", status: "same", native: "Clearcoat, transmission and ior are traced (refraction is real glass, not a screen-space trick).", web: "MeshPhysicalMaterial." },
  { name: "MeshLambertMaterial", group: "Materials", status: "mapped", native: "Standard, roughness 1, metalness 0 (noted once with compatNotes).", web: "Standard, as natively." },
  { name: "MeshPhongMaterial", group: "Materials", status: "mapped", native: "Standard with roughness √(2 / (shininess + 2)), metalness 0.", web: "Standard, as natively." },
  { name: "MeshBasicMaterial", group: "Materials", status: "mapped", native: "Unlit: its colour seen by camera rays and mirror paths, lighting nothing. A kernel switch compiled only into scenes that use it.", web: "MeshBasicMaterial." },
  { name: "MeshToon / MeshNormal / MeshDepth", group: "Materials", status: "mapped", native: "Standard, with a warning.", web: "Standard." },
  { name: "wireframe, BackSide", group: "Materials", status: "mapped", native: "Not drawn: wireframe is ignored, BackSide is drawn double-sided (noted unsupported).", web: "As three.js draws them." },
  { name: "ShaderMaterial / RawShaderMaterial", group: "Materials", status: "absent", native: "No GLSL. A custom look is a MaterialFunction: a WGSL body the path tracer runs at every hit.", web: "Not reachable." },
  // lights
  { name: "DirectionalLight", group: "Lights", status: "same", native: "Physical units: lux. setSunAngles places a sun. Traced shadow.", web: "DirectionalLight, lux 1:1, a shadow map fitted to the scene." },
  { name: "PointLight / SpotLight", group: "Lights", status: "mapped", native: "Candela; decay is always 2 (inverse square) whatever decay says. Many lights are resampled (RIS, 8 candidates) with one shadow ray.", web: "Point and spot lights, decay 2, shadow maps (point ones only when few)." },
  { name: "RectAreaLight", group: "Lights", status: "same", native: "Nits over its area, sampled as an area light, casts real soft shadows.", web: "RectAreaLight with LTC; it casts no shadow in three.js." },
  { name: "AmbientLight / HemisphereLight", group: "Lights", status: "mapped", native: "An environment: a uniform or gradient sky of radiance colour × intensity / π, lighting the scene and not seen.", web: "The three.js lights." },
  { name: "castShadow / receiveShadow", group: "Lights", status: "mapped", native: "Shadows are always on, from every light. castShadow = false is honoured.", web: "Shadow maps where three.js can afford them." },
  { name: "light.shadow.*", group: "Lights", status: "ignored", native: "mapSize, bias, camera: accepted, nothing to set on a path tracer.", web: "Used by the adapter's own fitted shadow maps." },
  { name: "Emissive surfaces", group: "Lights", status: "mapped", native: "An emissive triangle is a light: it sits in a light tree (power and a bounding sphere per node) and receives shadow rays.", web: "Emission lights nothing in three.js. The adapter places up to 16 point lights at the brightest emissive clusters." },
  // cameras
  { name: "PerspectiveCamera", group: "Cameras", status: "same", native: "Plus physical exposure (EV100, auto by default; setManualExposure for night scenes) and depth of field as a post pass.", web: "PerspectiveCamera, toneMappingExposure = 2^-EV100." },
  { name: "OrthographicCamera", group: "Cameras", status: "absent", native: "Not exported.", web: "Not reachable." },
  // math, picking
  { name: "Vector2/3, Quaternion, Euler, Matrix4, Color, Box3, Sphere, Ray, MathUtils", group: "Math & picking", status: "same", native: "Reimplemented in @threert/scene (pure TS, no DOM).", web: "The same TS." },
  { name: "Raycaster", group: "Math & picking", status: "same", native: "On scene code's own geometry: meshes, groups, instances with instanceId, procedural boxes. Runs wherever the game runs.", web: "The same TS." },
  // renderer, loaders
  { name: "WebGLRenderer", group: "Renderer & loaders", status: "ignored", native: "Every setting accepted, render() does nothing, domElement is null: the engine draws on its own surface.", web: "The page owns a real WebGLRenderer." },
  { name: "toneMapping, outputColorSpace, *ShadowMap constants", group: "Renderer & loaders", status: "ignored", native: "Accepted. Tone mapping is the preset's (UE filmic, bloom, vignette).", web: "ACES in the output pass." },
  { name: "setAnimationLoop", group: "Renderer & loaders", status: "ignored", native: "Kept, not called: a game's frame(f) runs every frame instead.", web: "The page's loop calls frame(f)." },
  { name: "GLTFLoader", group: "Renderer & loaders", status: "absent", native: "Replaced by GLTFModel(uri): the engine loads the file itself (Rust gltf crate), skinning and animation included.", web: "GLTFLoader inside the adapter." },
  { name: "TextureLoader", group: "Renderer & loaders", status: "absent", native: "A Texture takes a uri; the engine reads and packs it into texture pages.", web: "The adapter loads it." },
  { name: "AnimationMixer", group: "Renderer & loaders", status: "absent", native: "A model's pose is set through GLTFModel's animation (the engine skins it).", web: "SkeletonUtils in the adapter." },
  { name: "EffectComposer", group: "Renderer & loaders", status: "absent", native: "Post is the engine's: UE bloom, auto exposure, filmic tone map, vignette.", web: "The adapter's own composer; bloom and grading dropped." },
  // ThreeRT only
  { name: "MaterialFunction (WGSL)", group: "ThreeRT only", status: "extra", native: "A WGSL body with named params and textures, run by the path tracer at every hit: wet asphalt, signs, windows.", web: "Dropped: the base parameters are drawn and the drop is counted." },
  { name: "SkyAtmosphere", group: "ThreeRT only", status: "extra", native: "Hillaire sky, matched to UE's SkyAtmosphere defaults; its sun can move without a rebuild.", web: "three.js's Preetham Sky addon, scaled to nits." },
  { name: "ExponentialHeightFog, volumes", group: "ThreeRT only", status: "extra", native: "Height fog with volumetric single scattering; homogeneous and grid volumes.", web: "FogExp2 at the camera's height; volumetrics dropped." },
  { name: "mesh.physics", group: "ThreeRT only", status: "extra", native: "Rapier, stepped by the engine at 1/60 s; the script never steps it.", web: "The same Rapier, compiled to wasm." },
  { name: "GpuParticles, DensityGrid", group: "ThreeRT only", status: "extra", native: "Particle and grid programs in WGSL.", web: "Not drawn." },
]

export const GROUPS = Array.from(new Set(ENTRIES.map((e) => e.group)))
