// /reading — papers and books in the queue, in progress, or finished.
// PLACEHOLDER: seeded with plausible entries; curate via the `/me` agent.

export type ReadingItem = {
  type: "paper" | "book"
  title: string
  author?: string
  url?: string
  status: "reading" | "read" | "queued"
  note?: string
}

export const reading: ReadingItem[] = [
  {
    type: "paper",
    title:
      "PV-LIO: A Probabilistic Voxel-based LiDAR-Inertial Odometry Framework",
    status: "reading",
    note: "PLACEHOLDER — voxel-probabilistic front-end ideas for tighter LIO.",
  },
  {
    type: "book",
    title: "Programming Massively Parallel Processors",
    author: "Hwu, Kirk, El Hajj",
    status: "reading",
    note: "PLACEHOLDER — the CUDA reference I keep coming back to.",
  },
  {
    type: "paper",
    title: "FAST-LIO2: Fast Direct LiDAR-Inertial Odometry",
    status: "read",
    note: "PLACEHOLDER — iterated Kalman filter without feature extraction.",
  },
  {
    type: "book",
    title: "Multiple View Geometry in Computer Vision",
    author: "Hartley & Zisserman",
    status: "queued",
    note: "PLACEHOLDER — geometry fundamentals refresher.",
  },
  {
    type: "paper",
    title: "3D Gaussian Splatting for Real-Time Radiance Field Rendering",
    status: "queued",
    note: "PLACEHOLDER — splatting as a reconstruction primitive.",
  },
]
