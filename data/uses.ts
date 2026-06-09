// /uses — the gear, editor, and stack I reach for. PLACEHOLDER notes mark
// guessed details; correct via the `/me` profile-keeper agent.

export type UsesItem = {
  name: string
  note?: string
}

export type UsesSection = {
  section: string
  items: UsesItem[]
}

export const uses: UsesSection[] = [
  {
    section: "Workstation",
    items: [
      // PLACEHOLDER: exact rig specs to confirm.
      { name: "Custom GPU workstation", note: "NVIDIA RTX-class GPU for CUDA + training" },
      { name: "Linux", note: "Ubuntu — primary dev OS" },
    ],
  },
  {
    section: "Editor",
    items: [
      { name: "VS Code", note: "daily driver" },
      { name: "Claude Code", note: "agentic pair-programming in the terminal" },
      {
        name: "Fonts",
        // PLACEHOLDER: leaning toward switching editor font.
        note: "JetBrains Mono today, migrating toward IBM Plex Mono",
      },
    ],
  },
  {
    section: "Terminal",
    items: [
      { name: "zsh", note: "shell" },
      { name: "tmux", note: "session multiplexing" },
    ],
  },
  {
    section: "Stack highlights",
    items: [
      { name: "PyTorch + CUDA", note: "custom kernels for point-cloud ops" },
      { name: "C++ / gRPC", note: "high-performance perception services" },
      { name: "Next.js + Tailwind", note: "this site" },
    ],
  },
]
