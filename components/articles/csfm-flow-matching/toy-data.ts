// Generated from my own 2-D check of the flow-matching variance decomposition
// (scratch script ivtoy.py: exact Gaussian-mixture posteriors, 200,000 Monte Carlo
// pairs per row, t uniform on [0.02, 0.98]; Euler errors over 4,000 samples against
// a 256-step reference). Six conditions on a ring of radius 2, target modes of std 0.16.
// iv      E[tr Var(Delta | x_t (, C))], the intrinsic-variance term
// lossV   L_FM of a deliberately bent field v = u + bend, measured directly
// approx  E||v - u||^2 for that field; approx + iv should equal lossV
// path    mean |x1 - x0|
// euler   mean distance of an N-step Euler endpoint from the 256-step endpoint

export type ToyRow = {
  cond: boolean
  target: "uni" | "bi"
  source: "fixed" | "mean" | "mean_narrow" | "collapsed"
  iv: number
  lossV: number
  approx: number
  path: number
  euler: Record<string, number>
}

export const TOY: ToyRow[] = [
  { cond: true, target: "uni", source: "fixed", iv: 0.481, lossV: 0.616, approx: 0.135, path: 2.28, euler: { "1": 0.196, "2": 0.165, "3": 0.137, "5": 0.096, "10": 0.051, "50": 0.009 } },
  { cond: true, target: "uni", source: "mean", iv: 0.48, lossV: 0.611, approx: 0.131, path: 1.27, euler: { "1": 0.201, "2": 0.169, "3": 0.141, "5": 0.098, "10": 0.052, "50": 0.01 } },
  { cond: true, target: "uni", source: "mean_narrow", iv: 0.152, lossV: 0.237, approx: 0.085, path: 0.43, euler: { "1": 0.205, "2": 0.12, "3": 0.082, "5": 0.052, "10": 0.027, "50": 0.005 } },
  { cond: true, target: "uni", source: "collapsed", iv: 0.025, lossV: 0.094, approx: 0.069, path: 0.21, euler: { "1": 0.2, "2": 0.143, "3": 0.103, "5": 0.064, "10": 0.033, "50": 0.006 } },
  { cond: true, target: "bi", source: "fixed", iv: 1.349, lossV: 1.517, approx: 0.167, path: 2.28, euler: { "1": 0.861, "2": 0.432, "3": 0.22, "5": 0.105, "10": 0.053, "50": 0.01 } },
  { cond: true, target: "bi", source: "mean", iv: 1.348, lossV: 1.52, approx: 0.17, path: 1.48, euler: { "1": 0.857, "2": 0.434, "3": 0.222, "5": 0.107, "10": 0.054, "50": 0.01 } },
  { cond: true, target: "bi", source: "mean_narrow", iv: 0.402, lossV: 0.543, approx: 0.142, path: 0.92, euler: { "1": 0.854, "2": 0.304, "3": 0.194, "5": 0.113, "10": 0.056, "50": 0.009 } },
  { cond: true, target: "bi", source: "collapsed", iv: 0.054, lossV: 0.183, approx: 0.129, path: 0.86, euler: { "1": 0.853, "2": 0.759, "3": 0.625, "5": 0.423, "10": 0.217, "50": 0.035 } },
  { cond: false, target: "uni", source: "fixed", iv: 3.651, lossV: 3.799, approx: 0.135, path: 2.28, euler: { "1": 1.999, "2": 0.734, "3": 0.287, "5": 0.111, "10": 0.056, "50": 0.01 } },
  { cond: false, target: "uni", source: "mean", iv: 0.997, lossV: 1.129, approx: 0.131, path: 1.27, euler: { "1": 0.441, "2": 0.168, "3": 0.123, "5": 0.079, "10": 0.041, "50": 0.007 } },
  { cond: false, target: "uni", source: "mean_narrow", iv: 0.152, lossV: 0.237, approx: 0.085, path: 0.43, euler: { "1": 0.198, "2": 0.116, "3": 0.079, "5": 0.05, "10": 0.026, "50": 0.005 } },
  { cond: false, target: "uni", source: "collapsed", iv: 0.025, lossV: 0.094, approx: 0.069, path: 0.21, euler: { "1": 0.199, "2": 0.142, "3": 0.103, "5": 0.064, "10": 0.033, "50": 0.006 } },
  { cond: false, target: "bi", source: "fixed", iv: 3.737, lossV: 3.897, approx: 0.167, path: 2.28, euler: { "1": 2.003, "2": 0.704, "3": 0.273, "5": 0.113, "10": 0.057, "50": 0.01 } },
  { cond: false, target: "bi", source: "mean", iv: 1.701, lossV: 1.87, approx: 0.17, path: 1.48, euler: { "1": 0.664, "2": 0.312, "3": 0.162, "5": 0.077, "10": 0.037, "50": 0.006 } },
  { cond: false, target: "bi", source: "mean_narrow", iv: 0.424, lossV: 0.564, approx: 0.142, path: 0.92, euler: { "1": 0.836, "2": 0.284, "3": 0.177, "5": 0.098, "10": 0.045, "50": 0.007 } },
  { cond: false, target: "bi", source: "collapsed", iv: 0.08, lossV: 0.21, approx: 0.13, path: 0.86, euler: { "1": 0.831, "2": 0.737, "3": 0.605, "5": 0.404, "10": 0.2, "50": 0.03 } },
]
