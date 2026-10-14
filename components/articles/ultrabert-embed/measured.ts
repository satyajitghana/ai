// Measured, not reported: cosine similarities from dmis-lab/UltraBERT-Embed-150M
// run on CPU (torch 2.14.1+cpu, sentence-transformers 6, SDPA attention, float32,
// 2 threads) on 2026-10-14. Rows are queries, columns are passages; the diagonal
// is the passage written to answer that query. "instructed" encodes the queries
// with the model's default prompt_name="query" instruction; "raw" encodes them
// bare. Passages never take an instruction.
export const SIM = {
  "labels": [
    "python dict",
    "lidar drift",
    "long attention",
    "rope",
    "mercury",
    "git undo"
  ],
  "queries": [
    "How do I stop a Python dict from raising KeyError when a key is missing?",
    "Why does my LiDAR point cloud drift over a long drive?",
    "What lowers the memory cost of attention on long inputs?",
    "How is a rotary position embedding applied to queries and keys?",
    "Which metal is liquid at room temperature?",
    "How do I undo the last git commit but keep my changes?"
  ],
  "docs": [
    "Use dict.get(key, default) or collections.defaultdict so a missing key returns a fallback value instead of an exception.",
    "Odometry accumulates small registration errors scan after scan; without loop closure the trajectory slowly drifts away from the true path.",
    "Sliding-window attention lets each token attend only to nearby tokens, so cost grows linearly with length instead of quadratically.",
    "RoPE rotates each pair of query and key dimensions by an angle proportional to the token position before the dot product.",
    "Mercury is the only metal that is liquid at standard room temperature and pressure.",
    "Run git reset --soft HEAD~1 to remove the last commit while leaving its changes staged."
  ],
  "sim_instructed": [
    [
      0.5259,
      0.0569,
      0.0435,
      0.0959,
      0.0231,
      0.1213
    ],
    [
      -0.0346,
      0.3988,
      0.1352,
      0.0933,
      -0.0303,
      0.0769
    ],
    [
      0.0305,
      0.1084,
      0.4803,
      0.0316,
      0.0287,
      0.0531
    ],
    [
      0.1054,
      0.1258,
      0.1148,
      0.5619,
      -0.019,
      0.0093
    ],
    [
      0.0408,
      -0.0154,
      0.0619,
      0.0131,
      0.6558,
      0.0516
    ],
    [
      0.0241,
      0.0766,
      0.0525,
      0.0351,
      -0.0582,
      0.5156
    ]
  ],
  "sim_raw": [
    [
      0.5283,
      0.0719,
      0.0271,
      0.0712,
      0.1213,
      0.1291
    ],
    [
      0.0728,
      0.5021,
      0.2014,
      0.137,
      0.1355,
      0.1651
    ],
    [
      0.1785,
      0.2794,
      0.5674,
      0.1056,
      0.1691,
      0.1783
    ],
    [
      0.2181,
      0.2677,
      0.2522,
      0.5821,
      0.1116,
      0.1246
    ],
    [
      0.1713,
      0.1241,
      0.1627,
      0.0567,
      0.7897,
      0.1945
    ],
    [
      0.0491,
      0.1102,
      0.0626,
      0.032,
      0.0626,
      0.5467
    ]
  ]
} as const
