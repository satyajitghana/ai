// Measured on CPU with distilroberta-base (82M parameters) as a stand-in masked language model. NOT Clover.
// Rows: 24 paragraphs from this site, a 48-token prefix, then a block of 16 (or 32) masked slots with nothing to the right,
// LowConfidence rule with the threshold in the row (a threshold above 1 commits one slot per step). "first" is the mean number
// of slots committed by step 1. "dup" is the share of adjacent block tokens that are the same token.
export const EXP_A: { block: number; tau: number; steps: number; perStep: number; first: number; dup: number }[] = [
  {
    "block": 16,
    "tau": 1.01,
    "steps": 16.0,
    "perStep": 1.0,
    "first": 1.0,
    "dup": 0.192
  },
  {
    "block": 16,
    "tau": 0.95,
    "steps": 13.79,
    "perStep": 1.16,
    "first": 1.0,
    "dup": 0.192
  },
  {
    "block": 16,
    "tau": 0.9,
    "steps": 12.71,
    "perStep": 1.259,
    "first": 1.0,
    "dup": 0.228
  },
  {
    "block": 16,
    "tau": 0.8,
    "steps": 11.08,
    "perStep": 1.444,
    "first": 1.0,
    "dup": 0.306
  },
  {
    "block": 16,
    "tau": 0.6,
    "steps": 9.5,
    "perStep": 1.684,
    "first": 1.0,
    "dup": 0.358
  },
  {
    "block": 16,
    "tau": 0.4,
    "steps": 7.67,
    "perStep": 2.087,
    "first": 1.0,
    "dup": 0.425
  },
  {
    "block": 32,
    "tau": 0.95,
    "steps": 22.71,
    "perStep": 1.409,
    "first": 1.0,
    "dup": 0.379
  }
]

// One paragraph's block, resolved under four thresholds: [slot, token, confidence] committed at each step.
export const TRACE_PREFIX = "an assistant, character or robot, Bolt is a drop-in swap. It has the same architecture, the same runtime support and the same memory. In NVIDIA's own"

export const TRACES: { tau: number; rounds: [number, string, number][][]; final: string; truth: string }[] = [
 {
  "tau": 1.01,
  "rounds": [
   [
    [
     0,
     " GeForce",
     0.233
    ]
   ],
   [
    [
     1,
     " GTX",
     0.926
    ]
   ],
   [
    [
     3,
     " Ti",
     0.597
    ]
   ],
   [
    [
     13,
     " GTX",
     0.481
    ]
   ],
   [
    [
     12,
     " GeForce",
     0.978
    ]
   ],
   [
    [
     15,
     " Ti",
     0.956
    ]
   ],
   [
    [
     5,
     " GeForce",
     0.515
    ]
   ],
   [
    [
     6,
     " GTX",
     0.969
    ]
   ],
   [
    [
     8,
     " Ti",
     0.989
    ]
   ],
   [
    [
     2,
     " 980",
     0.43
    ]
   ],
   [
    [
     7,
     " 980",
     0.853
    ]
   ],
   [
    [
     14,
     " 980",
     0.957
    ]
   ],
   [
    [
     10,
     " GTX",
     0.313
    ]
   ],
   [
    [
     9,
     " GeForce",
     0.939
    ]
   ],
   [
    [
     11,
     " 980",
     0.662
    ]
   ],
   [
    [
     4,
     " NVIDIA",
     0.145
    ]
   ]
  ],
  "final": " GeForce GTX 980 Ti NVIDIA GeForce GTX 980 Ti GeForce GTX 980 GeForce GTX 980 Ti",
  "truth": " harness it follows system prompts and personas much better and says less. If your"
 },
 {
  "tau": 0.95,
  "rounds": [
   [
    [
     0,
     " GeForce",
     0.233
    ]
   ],
   [
    [
     1,
     " GTX",
     0.926
    ]
   ],
   [
    [
     3,
     " Ti",
     0.597
    ]
   ],
   [
    [
     13,
     " GTX",
     0.481
    ]
   ],
   [
    [
     12,
     " GeForce",
     0.978
    ]
   ],
   [
    [
     15,
     " Ti",
     0.956
    ]
   ],
   [
    [
     5,
     " GeForce",
     0.515
    ]
   ],
   [
    [
     6,
     " GTX",
     0.969
    ]
   ],
   [
    [
     8,
     " Ti",
     0.989
    ]
   ],
   [
    [
     2,
     " 980",
     0.43
    ]
   ],
   [
    [
     7,
     " 980",
     0.853
    ]
   ],
   [
    [
     14,
     " 980",
     0.957
    ]
   ],
   [
    [
     10,
     " GTX",
     0.313
    ]
   ],
   [
    [
     9,
     " GeForce",
     0.939
    ]
   ],
   [
    [
     11,
     " 980",
     0.662
    ]
   ],
   [
    [
     4,
     " NVIDIA",
     0.145
    ]
   ]
  ],
  "final": " GeForce GTX 980 Ti NVIDIA GeForce GTX 980 Ti GeForce GTX 980 GeForce GTX 980 Ti",
  "truth": " harness it follows system prompts and personas much better and says less. If your"
 },
 {
  "tau": 0.8,
  "rounds": [
   [
    [
     0,
     " GeForce",
     0.233
    ]
   ],
   [
    [
     1,
     " GTX",
     0.926
    ]
   ],
   [
    [
     3,
     " Ti",
     0.597
    ]
   ],
   [
    [
     13,
     " GTX",
     0.481
    ]
   ],
   [
    [
     12,
     " GeForce",
     0.978
    ],
    [
     15,
     " Ti",
     0.932
    ]
   ],
   [
    [
     5,
     " GeForce",
     0.515
    ]
   ],
   [
    [
     6,
     " GTX",
     0.969
    ],
    [
     8,
     " Ti",
     0.94
    ]
   ],
   [
    [
     2,
     " 980",
     0.43
    ]
   ],
   [
    [
     7,
     " 980",
     0.853
    ],
    [
     14,
     " 980",
     0.811
    ]
   ],
   [
    [
     10,
     " GTX",
     0.313
    ]
   ],
   [
    [
     9,
     " GeForce",
     0.939
    ]
   ],
   [
    [
     11,
     " 980",
     0.662
    ]
   ],
   [
    [
     4,
     " NVIDIA",
     0.145
    ]
   ]
  ],
  "final": " GeForce GTX 980 Ti NVIDIA GeForce GTX 980 Ti GeForce GTX 980 GeForce GTX 980 Ti",
  "truth": " harness it follows system prompts and personas much better and says less. If your"
 },
 {
  "tau": 0.4,
  "rounds": [
   [
    [
     0,
     " GeForce",
     0.233
    ]
   ],
   [
    [
     1,
     " GTX",
     0.926
    ],
    [
     11,
     " GeForce",
     0.413
    ]
   ],
   [
    [
     3,
     " Ti",
     0.555
    ],
    [
     5,
     " GeForce",
     0.516
    ],
    [
     6,
     " GeForce",
     0.508
    ],
    [
     12,
     " GTX",
     0.988
    ]
   ],
   [
    [
     7,
     " GTX",
     0.991
    ],
    [
     9,
     " Ti",
     0.967
    ],
    [
     14,
     " Ti",
     0.906
    ]
   ],
   [
    [
     8,
     " 980",
     0.396
    ]
   ],
   [
    [
     2,
     " 980",
     0.916
    ],
    [
     13,
     " 980",
     0.869
    ]
   ],
   [
    [
     10,
     " NVIDIA",
     0.101
    ]
   ],
   [
    [
     4,
     " NVIDIA",
     0.827
    ]
   ],
   [
    [
     15,
     " SLI",
     0.029
    ]
   ]
  ],
  "final": " GeForce GTX 980 Ti NVIDIA GeForce GeForce GTX 980 Ti NVIDIA GeForce GTX 980 Ti SLI",
  "truth": " harness it follows system prompts and personas much better and says less. If your"
 }
]
// Measured on CPU: pythia-70m drafts 8 tokens, pythia-160m verifies them, 8 paragraphs from this site, 32 tokens generated each.
// "same" is the share of positions where the text equals pythia-160m's own greedy text (one early difference changes all that follows).
export const EXP_B: { rule: string; perRound: number; same: number }[] = [
  {
    "rule": "exact match",
    "perRound": 3.55,
    "same": 0.906
  },
  {
    "rule": "threshold, delta 0.6 (Clover default)",
    "perRound": 8.69,
    "same": 0.125
  },
  {
    "rule": "threshold, delta 3",
    "perRound": 5.4,
    "same": 0.098
  },
  {
    "rule": "threshold, delta 10",
    "perRound": 2.33,
    "same": 0.223
  }
]

