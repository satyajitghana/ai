// Generated from my runs of rfdetr 1.11.1 with the official Nano/Small weights on one RTX 3090
// (2026-11-13): COCO val2017, all 5,000 images, pycocotools, predict() in FP32. Do not hand-edit.

export type KnobRun = {
  size: "nano" | "small"
  res: number
  dec: number
  queries: number
  windows: number
  AP: number
  AP50: number
}

export const KNOB_RUNS: KnobRun[] = [{"size": "nano", "res": 384, "dec": 2, "queries": 300, "windows": 2, "AP": 48.03, "AP50": 67.1}, {"size": "small", "res": 512, "dec": 3, "queries": 300, "windows": 2, "AP": 52.8, "AP50": 71.96}, {"size": "nano", "res": 384, "dec": 1, "queries": 300, "windows": 2, "AP": 45.72, "AP50": 64.29}, {"size": "nano", "res": 384, "dec": 0, "queries": 300, "windows": 2, "AP": 44.16, "AP50": 64.93}, {"size": "nano", "res": 384, "dec": 2, "queries": 100, "windows": 2, "AP": 47.37, "AP50": 66.39}, {"size": "nano", "res": 384, "dec": 2, "queries": 200, "windows": 2, "AP": 47.91, "AP50": 66.99}, {"size": "nano", "res": 320, "dec": 2, "queries": 300, "windows": 2, "AP": 44.67, "AP50": 63.42}, {"size": "nano", "res": 448, "dec": 2, "queries": 300, "windows": 2, "AP": 50.1, "AP50": 69.44}, {"size": "nano", "res": 512, "dec": 2, "queries": 300, "windows": 2, "AP": 51.36, "AP50": 71.0}, {"size": "small", "res": 512, "dec": 2, "queries": 300, "windows": 2, "AP": 52.16, "AP50": 71.25}, {"size": "small", "res": 512, "dec": 1, "queries": 300, "windows": 2, "AP": 49.51, "AP50": 68.38}, {"size": "nano", "res": 384, "dec": 2, "queries": 300, "windows": 1, "AP": 48.81, "AP50": 67.97}, {"size": "nano", "res": 384, "dec": 2, "queries": 300, "windows": 4, "AP": 46.83, "AP50": 65.77}, {"size": "small", "res": 640, "dec": 3, "queries": 300, "windows": 2, "AP": 54.84, "AP50": 73.88}]

export const BASE: Record<"nano" | "small", KnobRun> = {"nano": {"size": "nano", "res": 384, "dec": 2, "queries": 300, "windows": 2, "AP": 48.03, "AP50": 67.1}, "small": {"size": "small", "res": 512, "dec": 3, "queries": 300, "windows": 2, "AP": 52.8, "AP50": 71.96}}
