// Single source of truth for identity. Feeds the home/about pages, JSON-LD
// Person, /api/profile, llms.txt, and the chat/MCP context.
//
// `bio[0]` is reused on the home page and in the JSON-LD description, so it
// stays one sentence. `work` is rendered on /about and returned by
// /api/profile. Hagrid is a trading system: describe its architecture and
// decision boundary only, never strategy, targets, returns or results.

export type WorkItem = {
  name: string
  kind: "inkers" | "indie"
  what: string
  stack: string[]
  status: string
  url?: string
}

const work: readonly WorkItem[] = [
  {
    name: "Kaël",
    kind: "inkers",
    what: "Inkers' PMC platform: AI-native construction project management for project management consultants and contractors, covering safety, permits, quality, schedule, cost and documents. I lead the architecture, write code on both the agent backend and the frontend, and do the research behind it. The agents run meeting capture (record, transcribe, notes) and a pipeline that drafts eight project documents, from BOQ and budget to schedule and cash flow, out of a project brief.",
    stack: ["Python", "FastAPI", "Agno", "Gemini", "faster-whisper", "Frappe/ERPNext", "React", "Vite"],
    status: "In production",
    url: "https://kael.build",
  },
  {
    name: "fisheye-to-scan",
    kind: "inkers",
    what: "A 360° site walk (Insta360 dual-fisheye video) in; a metric, Z-up Gaussian splat, textured mesh and dense point cloud out, with people, machines and sky masked by SAM 3.1 and scale and gravity taken from the camera's IMU. A three.js viewer measures on it and overlays the design model, registered to the scan.",
    stack: ["Python", "COLMAP", "SAM 3.1", "OpenMVS", "Gaussian splatting", "React", "three.js", "Potree"],
    status: "Running on real captures; per-element progress scoring is next",
  },
  {
    name: "FABRIC",
    kind: "inkers",
    what: "Scan-to-BIM as language: a model (LOOM) reads a noisy point cloud and writes the building as WEFT, a typed program of walls, slabs, openings, columns, pipes and ducts, which compiles to IFC and Revit and is then fitted back to the scan.",
    stack: ["PyTorch", "IfcOpenShell", "Revit API"],
    status: "In progress",
  },
  {
    name: "Satya Revit AI",
    kind: "inkers",
    what: "A chat pane docked inside Revit plus an MCP tool server, so Claude Code or Codex can read and edit a live model, with tool calls and approvals visible. Used to take 2D drawing sets to quantity-ready Revit models.",
    stack: ["Python", "pyRevit", "MCP", "React"],
    status: "In use",
  },
  {
    name: "Hagrid",
    kind: "indie",
    what: "A multi-agent research system for Indian equities. Department analyst agents (technical, fundamentals, news, derivatives and more) report to manager agents and a CIO agent; a risk agent checks every pick against its risk limits. Market data comes through the Fyers broker API and public sources. The scheduled daily run ends at a list of picks; placing orders is a separate workflow, not part of the schedule.",
    stack: ["Python", "Agno", "Gemini", "FastAPI", "APScheduler", "Next.js", "Fyers API"],
    status: "Research site live",
    url: "https://hagrid.satyajit.si",
  },
  {
    name: "Vritti UI",
    kind: "indie",
    what: "A copy-paste React component registry: components, page blocks and a theme editor.",
    stack: ["React", "Next.js", "Tailwind CSS", "Motion"],
    status: "Live",
    url: "https://vritti.satyajit.si",
  },
  {
    name: "Quantum Orbital Visualizer",
    kind: "indie",
    what: "Atomic electron orbitals computed in Rust and C++ compiled to WebAssembly, rendered in three.js.",
    stack: ["Rust", "C++", "WebAssembly", "three.js", "Next.js"],
    status: "Live",
    url: "https://atoms.satyajit.si",
  },
  {
    name: "minime",
    kind: "indie",
    what: "An offline AI appliance on a Radxa Cubie A7S: an on-device LLM, text-to-speech, I2S audio, an e-paper dashboard and haptics, in a CAD-designed enclosure.",
    stack: ["C", "ARM", "on-device LLM", "CAD"],
    status: "Hardware prototype",
  },
  {
    name: "Ohara",
    kind: "indie",
    what: "A mobile AI nutrition companion for Indian consumers: scan a packaged food's barcode and get its ingredients, additive warnings, macros and a health score, and compare products. Backed by an API and a scraped catalogue of Indian packaged foods.",
    stack: ["React Native", "Expo", "Python", "OpenAPI"],
    status: "Expo app, last worked on in Nov 2025",
  },
  {
    name: "satyajit.fun",
    kind: "indie",
    what: "A collection of small, odd browser games and toys: a perfect-circle test, a password game, a colour geo-guesser, a tab-escape puzzle and about thirty more.",
    stack: ["Next.js", "React", "Motion"],
    status: "Live",
    url: "https://fun.satyajit.si",
  },
]

export const profile = {
  name: "Satyajit Ghana",
  title: "Head of Engineering",
  company: { name: "Inkers Technology", url: "https://inkers.ai" },
  location: "Bengaluru, India",
  tagline:
    "I build AI agents, reality capture that ends in BIM, and the 3D and deep-learning systems under them.",
  bio: [
    "Head of Engineering at Inkers, where I architect, build and research Kaël, our AI-native PMC platform for construction, and the reality capture around it: 360° and fisheye site scans, point clouds, and BIM.",
    "Most of my time now goes into agents. On Kaël I work across the agent backend and the React frontend; one agent pipeline takes a recorded project meeting, transcribes it, and drafts the brief, BOQ, budget, schedule and cash flow as a PDF. On the side I build Hagrid, a multi-agent research system for Indian equities, where a hierarchy of analyst agents reads market data and reports up to a CIO agent and a risk agent.",
    "On capture, I turn an Insta360 dual-fisheye walk of a site into a metric, gravity-aligned Gaussian splat, mesh and dense point cloud, then register the design model to it; reading progress per element from that is the next step. FABRIC, still in progress, is my point-cloud-to-BIM work: a model that writes a building as a compact element program that compiles to IFC and Revit. I also drive Revit from Claude Code and Codex over MCP to take 2D drawing sets to BIM models.",
    "Before agents, my work was 3D perception and deep learning: LiDAR and point-cloud pipelines, CUDA kernels, and C++/gRPC services. I taught MLOps (EMLO 2.0) and computer vision (EVA 4.0) at The School of AI.",
  ],
  work,
  links: {
    github: "https://github.com/satyajitghana",
    linkedin: "https://www.linkedin.com/in/satyajitghana/",
    x: "https://x.com/thesudoer_",
    medium: "https://satyajitghana.medium.com/",
    scholar: "https://scholar.google.com/citations?user=rZCRakQAAAAJ&hl=en",
    website: "https://satyajit.si/",
    email: "satyajitghana7@gmail.com",
  },
  github: { handle: "satyajitghana" },
  // Seed stats (refreshed live via lib/github.ts; stats-refresher keeps copy current).
  // stars = sum across owned non-fork repos, verified against the GitHub API
  // 2026-06-04 (an earlier research figure of 958 could not be reproduced).
  seedStats: { repos: 287, stars: 222, followers: 181 },
} as const

export type Profile = typeof profile
