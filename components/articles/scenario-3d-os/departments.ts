// The six departments are the tweet's grouping, not the repository's: nothing in
// scenario-labs/skills names them. This assignment of skills to departments is
// ours (reasoned), made from each skill's own description.
export const DEPARTMENTS: { id: string; label: string; skills: string[] }[] = [
  { id: "animation", label: "Animation", skills: ["video-to-motion", "motion-loops", "sprite-animation", "blender-2d-animation", "blender-animation", "blender-rigging", "maya-animation", "maya-rigging", "maya-deformation", "unity-animation", "godot-animation", "roblox-animation", "unreal-animation"] },
  { id: "art", label: "Art", skills: ["storyboards", "game-assets", "seedance-storyboard", "blender-previs-storyboard", "blender-grease-pencil", "blender-sculpting", "zbrush-sculpting", "zbrush-character-creature", "zbrush-stylized"] },
  { id: "modeling", label: "Modeling", skills: ["3d", "meshy", "rodin", "sparc3d", "blender-blockout", "blender-hard-surface", "blender-geometry-nodes", "zbrush-hard-surface", "maya-modeling"] },
  { id: "lookdev", label: "Look dev and lighting", skills: ["textures", "patina-retexture", "blender-texturing-shading", "blender-lighting-rendering", "maya-lookdev", "maya-lighting-rendering", "unreal-materials", "unreal-lighting-rendering", "zbrush-paint-render"] },
  { id: "worlds", label: "Worlds", skills: ["3d-worlds", "skyboxes", "walkable-room", "orbit-views", "unity-world-building", "unreal-world-building", "godot-3d-world", "roblox-environment"] },
  { id: "pipeline", label: "Pipeline", skills: ["blender-retopology", "blender-uv-baking", "blender-export", "maya-retopology-uv", "zbrush-retopology-export", "zbrush-pose-print", "maya-pipeline-scripting", "unity-pipeline-automation", "unreal-pipeline-automation", "godot-pipeline-automation", "godot-performance-export"] },
]
