// Display names for the shootout's system keys (<system>[__<variant>] as the harness writes them).
// Hand-written: names, years and variant meanings only, no measurements.

export const SYS_LABEL: Record<string, string> = {
  "fast-lio2": "FAST-LIO2",
  "faster-lio": "Faster-LIO",
  "point-lio": "Point-LIO",
  "super-lio": "Super-LIO",
  "far-lio": "FAR-LIO (CPU)",
  "alpha-lidar": "α-LiDAR (no actuation)",
  "pv-lio": "PV-LIO",
  "voxel-slam": "Voxel-SLAM",
  "kiss-icp": "KISS-ICP",
  "kiss-slam": "KISS-SLAM",
  "rko-lio": "RKO-LIO",
  glim: "GLIM (CPU)",
  dlio: "DLIO",
  "ig-lio": "iG-LIO",
  superodom: "SuperOdom",
  "genz-lio": "GenZ-LIO",
  "bievr-lio": "BIEVR-LIO",
  gtreplay: "reference replay",
}

export const VARIANT_LABEL: Record<string, string> = {
  default: "",
  indoor: "0.25 m map",
  beast2: "beast2 settings",
  v1: "1 m voxels",
  drift: "1°/min drift",
  slam: "full SLAM",
  odom: "odometry only",
  ekf: "EKF front end",
  slam_outdoor: "full SLAM, outdoor config",
  odom_outdoor: "odometry, outdoor config",
  slam_v05: "full SLAM, 0.5 m voxels",
  odom_v05: "odometry, 0.5 m voxels",
  exp: "per-sequence config",
  minr1: "min range 1 m",
  fixedR: "fixed residual weight",
  velodyne: "velodyne config",
}

export function label(key: string): string {
  const [sys, variant] = key.split("__")
  if (sys === "voxel-slam" && variant === "slam") return "Voxel-SLAM"
  const base = SYS_LABEL[sys] ?? sys
  const v = variant ? (VARIANT_LABEL[variant] ?? variant) : ""
  return v ? `${base} (${v})` : base
}
