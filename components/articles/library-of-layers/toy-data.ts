// Generated from the toy runs (lol_toy.py, 3,000 steps, seeds 0-2).
// Accuracies are exact match on 4,096 fresh examples per split.

export type Run = {
  id: string
  label: string
  sub: string
  detail: string
  train: number[]
  held: number[]
  forced?: number[]
  maps?: number[][][]
  purity?: number[][]
}

export const PRIMS = ["inc", "rev", "rot", "mul3"]

export const RUNS: Run[] = [
  {
    "id": "dense",
    "label": "3 blocks, fixed order",
    "sub": "153k params",
    "detail": "three distinct blocks, always run 1 → 2 → 3",
    "train": [
      1.0,
      1.0,
      1.0
    ],
    "held": [
      0.0916,
      0.1082,
      0.093
    ]
  },
  {
    "id": "looped",
    "label": "1 block x 3",
    "sub": "53k params",
    "detail": "one block applied three times",
    "train": [
      1.0,
      1.0,
      1.0
    ],
    "held": [
      0.116,
      0.0991,
      0.0256
    ]
  },
  {
    "id": "oracle",
    "label": "4 blocks, routing given",
    "sub": "203k params",
    "detail": "step ℓ runs the block numbered by its primitive",
    "train": [
      1.0,
      1.0,
      1.0
    ],
    "held": [
      0.5266,
      0.3921,
      0.4006
    ]
  },
  {
    "id": "lol4",
    "label": "L=4, tied router",
    "sub": "203k params",
    "detail": "learned top-1 router shared across depths",
    "train": [
      1.0,
      1.0,
      1.0
    ],
    "held": [
      0.0679,
      0.0415,
      0.0164
    ],
    "forced": [
      0.0664,
      0.0684,
      0.0
    ],
    "maps": [
      [
        [
          3,
          2,
          2,
          3
        ],
        [
          1,
          1,
          1,
          1
        ],
        [
          0,
          0,
          0,
          0
        ]
      ],
      [
        [
          2,
          2,
          0,
          2
        ],
        [
          1,
          1,
          1,
          0
        ],
        [
          3,
          3,
          3,
          0
        ]
      ],
      [
        [
          3,
          3,
          3,
          3
        ],
        [
          2,
          1,
          1,
          0
        ],
        [
          2,
          1,
          1,
          0
        ]
      ]
    ],
    "purity": [
      [
        0.68,
        0.62,
        0.7
      ],
      [
        0.67,
        0.54,
        0.53
      ],
      [
        0.76,
        0.51,
        0.58
      ]
    ]
  },
  {
    "id": "lol4u",
    "label": "L=4, untied router",
    "sub": "204k params",
    "detail": "one learned router per depth",
    "train": [
      1.0,
      0.9998,
      1.0
    ],
    "held": [
      0.0388,
      0.1069,
      0.104
    ],
    "forced": [
      0.022,
      0.019,
      0.1064
    ],
    "maps": [
      [
        [
          3,
          1,
          1,
          1
        ],
        [
          2,
          2,
          3,
          2
        ],
        [
          0,
          0,
          0,
          0
        ]
      ],
      [
        [
          0,
          0,
          3,
          0
        ],
        [
          2,
          2,
          3,
          2
        ],
        [
          2,
          1,
          1,
          1
        ]
      ],
      [
        [
          3,
          3,
          3,
          3
        ],
        [
          1,
          1,
          1,
          1
        ],
        [
          2,
          2,
          0,
          0
        ]
      ]
    ],
    "purity": [
      [
        0.87,
        0.61,
        0.72
      ],
      [
        0.82,
        0.58,
        0.64
      ],
      [
        0.82,
        0.66,
        0.71
      ]
    ]
  },
  {
    "id": "lol8",
    "label": "L=8, tied router",
    "sub": "404k params",
    "detail": "a library twice the number of primitives",
    "train": [
      0.9944,
      0.9988,
      0.9998
    ],
    "held": [
      0.0742,
      0.1213,
      0.0027
    ],
    "forced": [
      0.0,
      0.0647,
      0.0002
    ],
    "maps": [
      [
        [
          6,
          4,
          5,
          5
        ],
        [
          0,
          3,
          6,
          3
        ],
        [
          7,
          1,
          1,
          7
        ]
      ],
      [
        [
          5,
          5,
          4,
          7
        ],
        [
          0,
          4,
          0,
          1
        ],
        [
          3,
          6,
          2,
          1
        ]
      ],
      [
        [
          2,
          7,
          6,
          5
        ],
        [
          1,
          0,
          0,
          3
        ],
        [
          3,
          4,
          1,
          5
        ]
      ]
    ],
    "purity": [
      [
        0.51,
        0.39,
        0.43
      ],
      [
        0.52,
        0.4,
        0.35
      ],
      [
        0.62,
        0.38,
        0.34
      ]
    ]
  },
  {
    "id": "ro4",
    "label": "router-only program",
    "sub": "203k params",
    "detail": "blocks never see the program; tied router",
    "train": [
      0.6758,
      0.9922,
      0.9673
    ],
    "held": [
      0.0042,
      0.2876,
      0.1514
    ],
    "forced": [
      0.0002,
      0.0635,
      0.0039
    ],
    "maps": [
      [
        [
          1,
          1,
          0,
          3
        ],
        [
          1,
          2,
          0,
          1
        ],
        [
          2,
          2,
          0,
          3
        ]
      ],
      [
        [
          1,
          1,
          3,
          0
        ],
        [
          3,
          2,
          3,
          3
        ],
        [
          2,
          2,
          2,
          0
        ]
      ],
      [
        [
          3,
          0,
          1,
          1
        ],
        [
          3,
          0,
          3,
          2
        ],
        [
          2,
          2,
          0,
          1
        ]
      ]
    ],
    "purity": [
      [
        0.54,
        0.45,
        0.49
      ],
      [
        0.65,
        0.49,
        0.57
      ],
      [
        0.61,
        0.46,
        0.53
      ]
    ]
  },
  {
    "id": "ro4u",
    "label": "router-only, untied",
    "sub": "204k params",
    "detail": "blocks never see the program; one router per depth",
    "train": [
      0.998,
      0.9031,
      0.9956
    ],
    "held": [
      0.1865,
      0.0178,
      0.29
    ],
    "forced": [
      0.1021,
      0.0605,
      0.0642
    ],
    "maps": [
      [
        [
          3,
          2,
          0,
          3
        ],
        [
          3,
          0,
          1,
          1
        ],
        [
          3,
          2,
          2,
          2
        ]
      ],
      [
        [
          1,
          2,
          2,
          0
        ],
        [
          1,
          2,
          0,
          1
        ],
        [
          3,
          3,
          3,
          3
        ]
      ],
      [
        [
          3,
          2,
          0,
          1
        ],
        [
          1,
          1,
          1,
          3
        ],
        [
          2,
          2,
          2,
          0
        ]
      ]
    ],
    "purity": [
      [
        0.48,
        0.6,
        0.59
      ],
      [
        0.72,
        0.5,
        0.57
      ],
      [
        0.66,
        0.51,
        0.64
      ]
    ]
  }
]
