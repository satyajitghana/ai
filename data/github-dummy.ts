// Typed shape + deterministic dummy seed for the GitHub stats page.
// When no GITHUB_TOKEN exists, lib/github.ts returns `dummyGitHubStats` verbatim
// so the site builds and renders fully offline. The contribution calendar is
// generated deterministically (no Math.random) from a hash of each date string.

export type GitHubUser = {
  login: string
  name: string
  followers: number
  following: number
  publicRepos: number
  totalStars: number
  createdAt: string
}

export type GitHubRepo = {
  name: string
  description: string
  language: string
  stars: number
  url: string
}

export type GitHubLanguage = {
  name: string
  colorHex: string
  pct: number
}

export type ContributionDay = {
  date: string
  count: number
}

export type ContributionWeek = {
  days: ContributionDay[]
}

export type ContributionCalendar = {
  weeks: ContributionWeek[]
  totalContributions: number
}

export type GitHubStats = {
  source: "live" | "seed"
  user: GitHubUser
  topRepos: GitHubRepo[]
  topLanguages: GitHubLanguage[]
  contributions: ContributionCalendar
}

const dummyUser: GitHubUser = {
  login: "satyajitghana",
  name: "Satyajit Ghana",
  followers: 181,
  following: 45,
  publicRepos: 287,
  totalStars: 222, // verified vs GitHub API 2026-06-04 (owned non-fork repos)
  createdAt: "2014-07-07",
}

const dummyRepos: GitHubRepo[] = [
  {
    name: "PadhAI-Course",
    description:
      "Notebooks and assignments from the PadhAI deep-learning course — from perceptrons to CNNs.",
    language: "Jupyter",
    stars: 48,
    url: "https://github.com/satyajitghana/PadhAI-Course",
  },
  {
    name: "TSAI-DeepVision-EVA4.0",
    description:
      "Extensive Vision AI 4.0 — computer vision course work, CNN architectures, and training pipelines.",
    language: "Jupyter",
    stars: 22,
    url: "https://github.com/satyajitghana/TSAI-DeepVision-EVA4.0",
  },
  {
    name: "ige_lio",
    description:
      "Incremental generalized-ICP LiDAR-inertial odometry for fast, robust 3D state estimation.",
    language: "C++",
    stars: 11,
    url: "https://github.com/satyajitghana/ige_lio",
  },
  {
    name: "PV-LIO-for-HBA",
    description:
      "Point-to-voxel LiDAR-inertial odometry tuned as a front end for hierarchical bundle adjustment.",
    language: "C++",
    stars: 9,
    url: "https://github.com/satyajitghana/PV-LIO-for-HBA",
  },
  {
    name: "sdxl-dreambooth-finetune",
    description:
      "DreamBooth fine-tuning pipeline for SDXL with LoRA, prior preservation, and inference scripts.",
    language: "Python",
    stars: 7,
    url: "https://github.com/satyajitghana/sdxl-dreambooth-finetune",
  },
  {
    name: "torch-point-ops",
    description:
      "Custom CUDA/PyTorch ops for point clouds — chamfer distance, EMD, and nearest-neighbour kernels.",
    language: "Python",
    stars: 5,
    url: "https://github.com/satyajitghana/torch-point-ops",
  },
  {
    name: "TSAI-DeepNLP-END2.0",
    description:
      "Extensive NLP 2.0 — transformers, attention, and sequence models from scratch and with PyTorch.",
    language: "Jupyter",
    stars: 3,
    url: "https://github.com/satyajitghana/TSAI-DeepNLP-END2.0",
  },
  {
    name: "GPU-Programming",
    description:
      "CUDA kernels and exercises covering memory hierarchy, tiling, reductions, and performance tuning.",
    language: "Cuda",
    stars: 2,
    url: "https://github.com/satyajitghana/GPU-Programming",
  },
]

export const dummyLanguages: GitHubLanguage[] = [
  { name: "Python", colorHex: "#3572A5", pct: 38 },
  { name: "C++", colorHex: "#f34b7d", pct: 22 },
  { name: "Jupyter", colorHex: "#DA5B0B", pct: 14 },
  { name: "TypeScript", colorHex: "#3178c6", pct: 10 },
  { name: "Cuda", colorHex: "#3A4E3A", pct: 8 },
  { name: "Rust", colorHex: "#dea584", pct: 5 },
  { name: "Other", colorHex: "#8b8b8b", pct: 3 },
]

// Deterministic per-date contribution count. Hash the ISO date string, bias
// weekdays busier than weekends, clamp to 0–12. No Math.random — same output
// on every build so server/client and snapshots stay stable.
function hashDate(date: string): number {
  let h = 2166136261
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 1000
}

function contributionCount(date: string, weekday: number): number {
  const h = hashDate(date)
  const weekend = weekday === 0 || weekday === 6
  // Roughly a third of days are empty; weekends skew emptier.
  if (h % (weekend ? 3 : 5) === 0) return 0
  const base = h % (weekend ? 6 : 13)
  return Math.min(12, base)
}

function buildCalendar(endDate: string, weeks: number): ContributionCalendar {
  const end = new Date(`${endDate}T00:00:00Z`)
  // Walk back to the Sunday that starts the first visible week.
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (weeks * 7 - 1))
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())

  const weekList: ContributionWeek[] = []
  let total = 0
  const cursor = new Date(start)

  for (let w = 0; w < weeks; w++) {
    const days: ContributionDay[] = []
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().slice(0, 10)
      // Don't count days past the requested end date.
      const count = cursor > end ? 0 : contributionCount(iso, cursor.getUTCDay())
      total += count
      days.push({ date: iso, count })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weekList.push({ days })
  }

  return { weeks: weekList, totalContributions: total }
}

export const dummyGitHubStats: GitHubStats = {
  source: "seed",
  user: dummyUser,
  topRepos: dummyRepos,
  topLanguages: dummyLanguages,
  contributions: buildCalendar("2026-06-03", 52),
}
