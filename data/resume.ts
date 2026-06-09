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
    website: "https://ai.thesatyajit.com",
  },

  summary:
    "Engineering leader and deep-learning systems builder. I lead engineering for " +
    "industrial-AI products — 3D perception, LiDAR/point-cloud pipelines, and " +
    "structural-defect analysis — and ship them as high-performance C++/CUDA/gRPC " +
    "services. Two USPTO patents pending. Previously taught MLOps and computer vision.",

  experience: [
    {
      organization: "Inkers Technology",
      url: "https://inkers.ai",
      location: "Bengaluru, India",
      // NOTE: employment dates below are sensible estimates and require
      // Satyajit's confirmation before this resume is treated as final.
      roles: [
        // Head of Engineering — current. Estimated promotion ~2024.
        { title: "Head of Engineering", start: "2024-01" },
        // Deep Learning Software Engineer — estimated ~2022–2024.
        {
          title: "Deep Learning Software Engineer",
          start: "2022-06",
          end: "2024-01",
        },
        // Deep Learning Associate — estimated start ~2021.
        {
          title: "Deep Learning Associate",
          start: "2021-07",
          end: "2022-06",
        },
      ],
      summary:
        "Lead engineering for industrial-AI products across 3D perception, " +
        "LiDAR/point-cloud pipelines, and structural-defect analysis.",
      highlights: [
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
