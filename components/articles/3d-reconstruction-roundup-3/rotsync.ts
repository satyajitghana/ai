// Written from the output of the article's numpy toy (tools/rotsync.py in the
// author's scratch, seed 0, numpy 2.5.3, Python 3.13): rotation synchronisation
// of 20 rotations over 30 relative measurements (a ring plus random chords),
// isotropic noise of sigma radians per axis. Per noise level: random problems,
// each solved from random starts by Riemannian descent on SO(3) (rank 3), and once
// by a Burer-Monteiro staircase that lifts the rank until the dual certificate
// (min eigenvalue of Q - Lambda >= 0) holds. 'tight' = the certified solution rounds
// back to SO(3) at the same cost. 'stuck' = a local run ended above the certified cost.

export const ROTSYNC_SETUP = { nodes: 20, edges: 30, inits: 10, seed: 0 }

export type RotRow = {
  sigma: number
  problems: number
  localRuns: number
  localCertified: number
  localStuck: number
  sdpCertified: number
  tight: number
  rankNeeded: Record<string, number>
  meanErrDeg: number
}

export const ROTSYNC: RotRow[] = [
  { sigma: 0.05, problems: 20, localRuns: 200, localCertified: 173, localStuck: 27, sdpCertified: 20, tight: 20, rankNeeded: {"3": 16, "4": 1, "5": 3}, meanErrDeg: 3.4 },
  { sigma: 0.1, problems: 20, localRuns: 200, localCertified: 176, localStuck: 24, sdpCertified: 20, tight: 20, rankNeeded: {"3": 17, "5": 3}, meanErrDeg: 7.2 },
  { sigma: 0.2, problems: 20, localRuns: 200, localCertified: 177, localStuck: 23, sdpCertified: 20, tight: 20, rankNeeded: {"3": 18, "4": 2}, meanErrDeg: 13.4 },
  { sigma: 0.3, problems: 20, localRuns: 200, localCertified: 141, localStuck: 59, sdpCertified: 20, tight: 20, rankNeeded: {"3": 13, "4": 2, "5": 5}, meanErrDeg: 20.9 },
  { sigma: 0.4, problems: 20, localRuns: 200, localCertified: 128, localStuck: 68, sdpCertified: 20, tight: 19, rankNeeded: {"3": 10, "4": 2, "5": 8}, meanErrDeg: 27.3 },
  { sigma: 0.5, problems: 20, localRuns: 200, localCertified: 50, localStuck: 148, sdpCertified: 20, tight: 10, rankNeeded: {"3": 4, "4": 2, "5": 13, "6": 1}, meanErrDeg: 39.4 },
  { sigma: 0.6, problems: 20, localRuns: 200, localCertified: 12, localStuck: 185, sdpCertified: 20, tight: 5, rankNeeded: {"3": 2, "4": 1, "5": 16, "7": 1}, meanErrDeg: 49.2 },
]
