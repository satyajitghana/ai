// Measured: numpy toy, 3 seeds, 600 held-out actual-coarse inputs. See the article for the script.
export type ToyRow = {
  n: number
  paired_only: [number, number]
  pseudo_no_bottleneck: [number, number]
  pseudo_bottleneck: [number, number]
  oracle_true_coarse: [number, number]
}

export const TOY: ToyRow[] = [
  {
    "n": 20,
    "paired_only": [
      0.0664,
      0.0051
    ],
    "pseudo_no_bottleneck": [
      0.127,
      0.0067
    ],
    "pseudo_bottleneck": [
      0.0349,
      0.0005
    ],
    "oracle_true_coarse": [
      0.0278,
      0.0004
    ]
  },
  {
    "n": 100,
    "paired_only": [
      0.0696,
      0.001
    ],
    "pseudo_no_bottleneck": [
      0.1645,
      0.0063
    ],
    "pseudo_bottleneck": [
      0.0309,
      0.0002
    ],
    "oracle_true_coarse": [
      0.028,
      0.0
    ]
  },
  {
    "n": 1000,
    "paired_only": [
      0.0335,
      0.0006
    ],
    "pseudo_no_bottleneck": [
      0.1614,
      0.0104
    ],
    "pseudo_bottleneck": [
      0.0313,
      0.0009
    ],
    "oracle_true_coarse": [
      0.0282,
      0.0003
    ]
  }
]
