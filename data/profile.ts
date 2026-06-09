// Single source of truth for identity. Feeds the home/about pages, JSON-LD
// Person, /api/profile, llms.txt, and the chat/MCP context.

export const profile = {
  name: "Satyajit Ghana",
  title: "Head of Engineering",
  company: { name: "Inkers Technology", url: "https://inkers.ai" },
  location: "Bengaluru, India",
  tagline: "I build deep-learning systems, 3D perception, and high-performance infra.",
  bio: [
    "Head of Engineering at Inkers, where I work on industrial AI — 3D perception, deep learning, and the systems that ship it to production.",
    "I write custom neural networks, CUDA kernels, LiDAR/point-cloud pipelines, and high-performance C++/gRPC services. Previously taught MLOps (EMLO 2.0) and computer vision (EVA 4.0) at The School of AI.",
  ],
  links: {
    github: "https://github.com/satyajitghana",
    linkedin: "https://www.linkedin.com/in/satyajitghana/",
    x: "https://x.com/thesudoer_",
    medium: "https://satyajitghana.medium.com/",
    scholar: "https://scholar.google.com/citations?user=rZCRakQAAAAJ&hl=en",
    website: "https://thesatyajit.com/",
    email: "satyajitghana7@gmail.com",
  },
  github: { handle: "satyajitghana" },
  // Seed stats (refreshed live via lib/github.ts; stats-refresher keeps copy current).
  // stars = sum across owned non-fork repos, verified against the GitHub API
  // 2026-06-04 (an earlier research figure of 958 could not be reproduced).
  seedStats: { repos: 287, stars: 222, followers: 181 },
} as const

export type Profile = typeof profile
