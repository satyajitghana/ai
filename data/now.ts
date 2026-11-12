// "What I'm focused on now" — a /now page in the nownownow.com tradition.
// Edit via the `/me` profile-keeper agent; keep `updated` current whenever the
// list changes. Every item should trace to real, current work.

export type Now = {
  updated: string // YYYY-MM-DD
  items: string[]
}

export const now: Now = {
  updated: "2026-11-12",
  items: [
    "Kaël at Inkers: agents for construction project management, from meeting capture to drafted project documents, running on Agno and Gemini behind FastAPI.",
    "Turning Insta360 dual-fisheye site walks into metric, gravity-aligned Gaussian splats, meshes and point clouds, and registering the design model to them so progress can be read per element.",
    "FABRIC: point cloud in, BIM out, by having a model write the building as an element program that compiles to IFC and Revit. Most recent work is on rebuilding the geometry cleanly in Revit.",
    "Driving Revit from Claude Code and Codex over MCP to take 2D drawing sets to BIM models.",
    "Hagrid, on the side: a multi-agent research system for Indian equities, with analyst, manager and risk agents reading market data through the Fyers API.",
    "Building ai.satyajit.si, a site maintained by a crew of Claude agents that ship every change as a reviewed PR.",
  ],
}
