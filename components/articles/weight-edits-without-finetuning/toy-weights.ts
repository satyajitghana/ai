// The toy SwiGLU unit's base weights and the new task's labelled points.
// Chosen by a seeded search (seed 2296) for a unit whose sign map has a
// region the new task needs flipped, then frozen here so every edit in toy.ts
// is computed from the same numbers on the server and in the browser.

export type Unit = {
  wg: number[][]
  bg: number[]
  wu: number[][]
  bu: number[]
  d: number[]
  c: number
}

export const BASE: Unit = {
  wg: [[-2.39, 1.55], [2.17, 0.67], [1.14, 2.44], [0.96, 0.82], [0.18, 0.25], [2.88, -2.75]],
  bg: [-0.83, 0.81, 0.8, -0.41, 0.75, -0.98],
  wu: [[-0.36, -0.43], [1.37, 1.52], [-1.49, -1.54], [1.92, -1.24], [-0.08, -1.94], [1.77, 1.51]],
  bu: [-0.08, -0.31, 0.72, -0.84, -0.69, 0.27],
  d: [0.38, -0.47, -0.06, 0.64, 0.69, -0.56],
  c: 0.03,
}

export const NEW_POINTS: { x: number; y: number; label: 1 | -1 }[] = [{"x": -0.4, "y": 0.1, "label": -1}, {"x": -0.64, "y": 0.1, "label": -1}, {"x": -0.4, "y": -0.14, "label": -1}, {"x": -0.64, "y": -0.14, "label": -1}, {"x": 0.08, "y": -0.02, "label": -1}, {"x": -0.52, "y": 0.58, "label": -1}, {"x": -0.52, "y": -0.62, "label": -1}]
