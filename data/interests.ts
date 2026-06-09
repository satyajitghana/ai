// Research interest profile — drives the paper-scout's arXiv ranking and the
// daily digest. Edit via the `/me` profile-keeper agent; weights are relative.

export const interests = {
  // arXiv categories to pull daily (free Atom API).
  categories: ["cs.CV", "cs.LG", "cs.AI", "cs.CL", "cs.RO"],
  // Keyword → weight. Scoring is mechanical (title/abstract match) before the
  // paper-scout agent applies judgment to the top candidates.
  keywords: [
    { term: "point cloud", weight: 5 },
    { term: "lidar", weight: 5 },
    { term: "3d reconstruction", weight: 5 },
    { term: "gaussian splatting", weight: 4 },
    { term: "slam", weight: 4 },
    { term: "odometry", weight: 4 },
    { term: "nerf", weight: 3 },
    { term: "depth estimation", weight: 4 },
    { term: "3d", weight: 2 },
    { term: "diffusion", weight: 3 },
    { term: "vision transformer", weight: 3 },
    { term: "quantization", weight: 3 },
    { term: "distillation", weight: 3 },
    { term: "cuda", weight: 4 },
    { term: "kernel fusion", weight: 4 },
    { term: "inference optimization", weight: 4 },
    { term: "llm agents", weight: 3 },
    { term: "reasoning", weight: 2 },
    { term: "structural inspection", weight: 5 },
    { term: "defect detection", weight: 5 },
  ],
  maxPapersPerDay: 10,
} as const

export type Interests = typeof interests
