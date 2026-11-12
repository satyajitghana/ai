// Single source of truth for the resume. Feeds the /resume HTML page, the
// build-time PDF (lib/resume/ResumeDocument.tsx → public/satyajit-ghana-resume.pdf),
// and the JSON Resume endpoint (/resume.json). Keep this typed and verified —
// it is one of the public, machine-readable surfaces of the site.

export interface ResumeContact {
  name: string
  title: string
  company: { name: string; url: string }
  location: string
  email: string
  github: string
  linkedin: string
  website: string
}

export interface ResumeExperienceRole {
  title: string
  // ISO month "YYYY-MM". `end` omitted/undefined means current.
  // NOTE: dates are estimates and need Satyajit's confirmation (see header note).
  start: string
  end?: string
}

export interface ResumeExperience {
  organization: string
  url?: string
  location?: string
  // Multiple roles at the same org, most-recent first (a single timeline entry).
  roles: ResumeExperienceRole[]
  summary: string
  highlights: string[]
}

export interface ResumeEducation {
  institution: string
  location?: string
  degree: string
  // "YYYY"
  end: string
  highlights: string[]
}

export interface ResumeSkillGroup {
  name: string
  skills: string[]
}

export interface ResumeProject {
  name: string
  description: string
  url: string
}

export interface ResumePublication {
  title: string
  publisher: string
  // "YYYY-MM-DD"
  date: string
  details: string
  doi?: string
  url?: string
}

export interface ResumePatent {
  title: string
  status: string
  applicationNumber: string
  // "YYYY-MM-DD"
  filed: string
  assignee: string
}

export interface Resume {
  contact: ResumeContact
  summary: string
  experience: ResumeExperience[]
  education: ResumeEducation[]
  skills: ResumeSkillGroup[]
  projects: ResumeProject[]
  publications: ResumePublication[]
  patents: ResumePatent[]
}

export const resume: Resume = {
  contact: {
    name: "Satyajit Ghana",
    title: "Head of Engineering",
    company: { name: "Inkers Technology", url: "https://inkers.ai" },
    location: "Bengaluru, India",
    email: "satyajitghana7@gmail.com",
    github: "https://github.com/satyajitghana",
    linkedin: "https://www.linkedin.com/in/satyajitghana/",
    website: "https://ai.satyajit.si",
  },

  summary:
    "Engineering leader building AI agents and reality-capture systems for construction. " +
    "I architect, build and research Kaël, Inkers' AI-native PMC platform, and build the " +
    "capture-to-BIM work around it: 360° and fisheye site scans to metric splats, meshes " +
    "and point clouds, and point-cloud-to-BIM. Before that, 3D perception, LiDAR pipelines " +
    "and C++/CUDA/gRPC services. Two USPTO patents pending. Previously taught MLOps and computer vision.",

  experience: [
    {
      organization: "Inkers Technology",
      url: "https://inkers.ai",
      location: "Bengaluru, India",
      // Dates follow the portfolio's experience list (satyajit.si, lib/data.ts),
      // which is the more authoritative source. It overlaps the first two roles
      // by a month (Apr-May 2023); kept as written there.
      roles: [
        { title: "Head of Engineering", start: "2023-04" },
        {
          title: "Deep Learning Software Engineer",
          start: "2022-04",
          end: "2023-05",
        },
        {
          title: "Deep Learning Associate",
          start: "2021-07",
          end: "2022-04",
        },
      ],
      summary:
        "Lead engineering for industrial-AI products across 3D perception, " +
        "LiDAR/point-cloud pipelines, and structural-defect analysis.",
      highlights: [
        "Lead the architecture of Kaël, Inkers' AI-native PMC (construction project-management) platform, and implement it across the agent backend (FastAPI, Agno, Gemini) and the React frontend; its agents turn recorded project meetings into drafted project documents.",
        "Built a pipeline from Insta360 dual-fisheye site walks to metric, gravity-aligned Gaussian splats, meshes and dense point clouds (SAM 3.1 masking, rig SfM with IMU scale and gravity, OpenMVS), with a three.js viewer that overlays the design model.",
        "Building point-cloud-to-BIM (a model writes a building as an element program that compiles to IFC and Revit) and an MCP agent workspace inside Revit for drawings-to-BIM.",
        "Lead engineering for industrial-AI products: 3D perception, LiDAR/point-cloud pipelines, and structural-defect analysis.",
        "Design custom neural networks, CUDA kernels, and high-performance C++/gRPC services for production deployment.",
        "Named inventor on 2 USPTO patents pending (assigned to Inkers); grew from Deep Learning Associate to Head of Engineering.",
      ],
    },
    {
      organization: "The School of A.I.",
      location: "Remote",
      roles: [
        // Part-time / contributing instructor alongside Inkers work.
        { title: "MLOps Instructor", start: "2022-01", end: "2023-01" },
      ],
      summary:
        "Designed and taught MLOps and contributed to computer-vision curriculum.",
      highlights: [
        "Designed and taught EMLO 2.0 — an end-to-end MLOps course (training, packaging, deployment, monitoring).",
        "Contributed to EVA 4.0, the deep computer-vision program.",
      ],
    },
  ],

  education: [
    {
      institution: "M.S. Ramaiah University of Applied Sciences",
      location: "Bangalore, India",
      degree: "B.Tech",
      end: "2021",
      highlights: ["CGPA 9.78/10", "Silver Medalist"],
    },
  ],

  skills: [
    {
      name: "Deep Learning",
      skills: [
        "PyTorch",
        "TensorFlow",
        "Computer Vision",
        "3D / Point Clouds / LiDAR",
        "GenAI (SDXL, LLMs)",
      ],
    },
    {
      name: "Systems",
      skills: ["C++", "C", "Rust", "CUDA", "gRPC", "MongoDB"],
    },
    {
      name: "MLOps",
      skills: ["Kubernetes", "AWS", "GCP", "Docker"],
    },
    {
      name: "Web",
      skills: ["TypeScript", "React", "Next.js"],
    },
  ],

  projects: [
    {
      name: "Hagrid",
      description:
        "Multi-agent research system for Indian equities: analyst, manager, CIO and risk agents on Agno and Gemini, market data via the Fyers API, FastAPI and Next.js.",
      url: "https://hagrid.satyajit.si",
    },
    {
      name: "Vritti UI",
      description:
        "Copy-paste React component registry with page blocks and a theme editor.",
      url: "https://vritti.satyajit.si",
    },
    {
      name: "Quantum Orbital Visualizer",
      description:
        "Atomic orbitals computed in Rust and C++ compiled to WebAssembly, rendered with three.js.",
      url: "https://atoms.satyajit.si",
    },
    {
      name: "torch-point-ops",
      description:
        "High-performance PyTorch operators for point-cloud and 3D geometry processing.",
      url: "https://github.com/satyajitghana/torch-point-ops",
    },
    {
      name: "PV-LIO-for-HBA",
      description:
        "Point-to-voxel LiDAR-inertial odometry adapted for hierarchical bundle adjustment.",
      url: "https://github.com/satyajitghana/PV-LIO-for-HBA",
    },
    {
      name: "ige_lio",
      description:
        "Iterated error-state Kalman-filter LiDAR-inertial odometry experiments.",
      url: "https://github.com/satyajitghana/ige_lio",
    },
    {
      name: "sdxl-dreambooth-finetune",
      description:
        "DreamBooth fine-tuning pipeline for Stable Diffusion XL subject personalization.",
      url: "https://github.com/satyajitghana/sdxl-dreambooth-finetune",
    },
    {
      name: "TSAI-DeepVision-EVA4.0",
      description:
        "Coursework and experiments from The School of AI's EVA 4.0 computer-vision program.",
      url: "https://github.com/satyajitghana/TSAI-DeepVision-EVA4.0",
    },
    {
      name: "PadhAI-Course",
      description:
        "Implementations and notes from the PadhAI deep-learning course.",
      url: "https://github.com/satyajitghana/PadhAI-Course",
    },
  ],

  publications: [
    {
      title:
        "Adaptive Visual Learning Using Augmented Reality and Machine Learning Techniques",
      publisher: "Journal of Computational and Theoretical Nanoscience",
      date: "2020-01-01",
      details: "Vol. 17, No. 11, pp. 4952–4956",
      doi: "10.1166/jctn.2020.8982",
      url: "https://doi.org/10.1166/jctn.2020.8982",
    },
  ],

  patents: [
    {
      title:
        "Method and System for Performing Structural Defect Analysis in a Structural Environment",
      status: "Pending",
      applicationNumber: "US 19/634,310",
      filed: "2026-03-31",
      assignee: "Inkers Technology",
    },
    {
      title: "Data Acquisition Device",
      status: "Pending",
      applicationNumber: "US 19/634,339",
      filed: "2026-03-31",
      assignee: "Inkers Technology",
    },
  ],
}
