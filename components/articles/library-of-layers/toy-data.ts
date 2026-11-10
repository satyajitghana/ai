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
      0.9998
    ],
    "held": [
      0.0388,
      0.1069
    ],
    "forced": [
      0.022,
      0.019
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
      ]
    ]
  }
]
