// "What I'm focused on now" — a /now page in the nownownow.com tradition.
// PLACEHOLDER: seeded with plausible items. Edit via the `/me` profile-keeper
// agent; keep `updated` current whenever the list changes.

export type Now = {
  updated: string // YYYY-MM-DD
  items: string[]
}

export const now: Now = {
  updated: "2026-06-04",
  items: [
    "Building ai.thesatyajit.com — a dual-native personal site maintained by a crew of Claude agents that ship every change as a reviewed PR.",
    "Leading industrial-AI 3D perception at Inkers: turning LiDAR and camera capture into structural-defect analysis that runs in production.",
    "Writing CUDA point-cloud kernels — fused nearest-neighbour, sampling, and grouping ops to take the Python side out of the hot path.",
    "Reading deeply on LiDAR odometry and point-cloud registration, with an eye toward tighter, faster SLAM front-ends.",
  ],
}
