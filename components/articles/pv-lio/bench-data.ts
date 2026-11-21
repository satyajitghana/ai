// PV-LIO rows: my runs through the LIO shootout harness on the Blackwell box (Intel i7-14700),
// RESULT lines in remote-out/pvlio.out. ATE: SE(3) Umeyama without scale; RPE: evo, 1 m; ms per scan
// and peak RSS from the serial timing pass (4 threads, taskset -c 0-3, the box otherwise quiet).
// FAST-LIO2 / Super-LIO rows: the FAST-LIO2 article's earlier runs on beast2 (Intel i7-6850K, ROS 2
// bag playback, a different harness), so only their trajectory errors are shown here.
export type BenchRow = { name: string; pv?: boolean; status: string; ate: number | null; rpe: number | null; ms: number | null; rss: number | null; note?: string }
export type BenchSeq = { short: string; label: string; note: string; rows: BenchRow[] }

const BEAST = "beast2 run, other machine"

export const BENCH: Record<string, BenchSeq> = {
  hilti14: {
    short: "Hilti 14",
    label: "Hilti 2022 exp14_basement_2 · 38 m handheld, 74 s, median return 1.08 m",
    note: "All three PV-LIO configurations track the basement. The FAST-LIO2 row is its shipped 0.5 m voxel on beast2, which starved the map indoors; Super-LIO is the best of that earlier run. Their timing is from another machine and is left out.",
    rows: [
      { name: "PV-LIO, hesai.yaml", pv: true, status: "ok", ate: 0.0395, rpe: 0.0317, ms: 8.642, rss: 506 },
      { name: "PV-LIO, fixed weight", pv: true, status: "ok", ate: 0.0389, rpe: 0.0262, ms: 8.383, rss: 506 },
      { name: "PV-LIO, velodyne.yaml", pv: true, status: "ok", ate: 0.0728, rpe: 0.0496, ms: 4.558, rss: 203 },
      { name: "Super-LIO (beast2)", status: "ok", ate: 0.0931, rpe: 0.0475, ms: null, rss: null, note: BEAST },
      { name: "FAST-LIO2 (beast2)", status: "ok", ate: 0.5011, rpe: 0.2197, ms: null, rss: null, note: BEAST },
    ],
  },
  spires: {
    short: "Spires",
    label: "Oxford Spires keble-college-03 · 283 m backpack walk, 286 s, median return 5.6 m",
    note: "Outdoors the Hilti config is the wrong one: 0.25 m voxels that are never forgotten cost 8.7 GB and 48 ms a scan, and its weighted run is the least accurate of the three. The generic 1 m config tracks to 4.7 cm at half the time and a fifth of the memory.",
    rows: [
      { name: "PV-LIO, hesai.yaml", pv: true, status: "ok", ate: 0.109, rpe: 0.0066, ms: 48.32, rss: 8718 },
      { name: "PV-LIO, fixed weight", pv: true, status: "ok", ate: 0.0465, rpe: 0.0065, ms: 48.04, rss: 8768 },
      { name: "PV-LIO, velodyne.yaml", pv: true, status: "ok", ate: 0.0471, rpe: 0.0092, ms: 25.57, rss: 1651 },
      { name: "FAST-LIO2 (beast2)", status: "ok", ate: 0.0717, rpe: 0.0097, ms: null, rss: null, note: BEAST },
      { name: "Super-LIO (beast2)", status: "ok", ate: 0.08, rpe: 0.0152, ms: null, rss: null, note: BEAST },
    ],
  },
  hilti16: {
    short: "Hilti 16",
    label: "Hilti 2022 exp16_attic_to_upper_gallery_2 · 117 m handheld, 200 s, two stairwells",
    note: "The hard one. Only the shipped weighted config finishes, at 1.73 m. With the weights fixed it leaves the reference on the climb back to the attic. velodyne.yaml also diverges; it differs in blind radius and IMU noise as well as voxel size, and I did not isolate which mattered. No FAST-LIO2 run on this sequence yet.",
    rows: [
      { name: "PV-LIO, hesai.yaml", pv: true, status: "ok", ate: 1.735, rpe: 0.207, ms: 17.51, rss: 2139 },
      { name: "PV-LIO, fixed weight", pv: true, status: "diverged", ate: null, rpe: null, ms: 14.37, rss: 2461, note: "ATE 414 m" },
      { name: "PV-LIO, velodyne.yaml", pv: true, status: "diverged", ate: null, rpe: null, ms: 4.981, rss: 1875, note: "matched 81 of 1,878 points a scan" },
    ],
  },
}
