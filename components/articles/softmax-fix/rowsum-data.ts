// Measured by exp/rowsum.py (PyTorch 2.14.1 CPU, 150 draws per cell, one attention row,
// n = 256 keys, d = 64). Each method is [mean |row sum of dS|, draws of 150 where the
// sink-key dS error is within 1x of the true value, mean relative dS error].
export type Cell = { row: string; fmt: string; sr: boolean; p0: number; stored: number[]; aux: number[]; perdraw: number[] }
export const CELLS: Cell[] = [
 {
  "row": "sink6",
  "fmt": "bf16",
  "sr": false,
  "p0": 0.687,
  "stored": [
   2.74e-05,
   150,
   0.00133
  ],
  "aux": [
   0.00039,
   150,
   0.00133
  ],
  "perdraw": [
   1.54e-08,
   150,
   0.00135
  ]
 },
 {
  "row": "sink6",
  "fmt": "bf16",
  "sr": true,
  "p0": 0.687,
  "stored": [
   0.000697,
   150,
   0.00199
  ],
  "aux": [
   0.000638,
   150,
   0.00188
  ],
  "perdraw": [
   1.55e-08,
   150,
   0.00213
  ]
 },
 {
  "row": "sink6",
  "fmt": "fp8",
  "sr": false,
  "p0": 0.687,
  "stored": [
   0.00766,
   150,
   0.0243
  ],
  "aux": [
   0.00741,
   150,
   0.0242
  ],
  "perdraw": [
   1.51e-08,
   150,
   0.0262
  ]
 },
 {
  "row": "sink6",
  "fmt": "fp8",
  "sr": true,
  "p0": 0.687,
  "stored": [
   0.0104,
   150,
   0.0317
  ],
  "aux": [
   0.0104,
   150,
   0.0317
  ],
  "perdraw": [
   1.54e-08,
   150,
   0.0347
  ]
 },
 {
  "row": "sink6",
  "fmt": "fp4",
  "sr": false,
  "p0": 0.687,
  "stored": [
   0.0234,
   150,
   0.0753
  ],
  "aux": [
   0.0232,
   150,
   0.0753
  ],
  "perdraw": [
   1.67e-08,
   150,
   0.0855
  ]
 },
 {
  "row": "sink6",
  "fmt": "fp4",
  "sr": true,
  "p0": 0.687,
  "stored": [
   0.0318,
   150,
   0.108
  ],
  "aux": [
   0.0318,
   150,
   0.108
  ],
  "perdraw": [
   1.59e-08,
   150,
   0.118
  ]
 },
 {
  "row": "sink12",
  "fmt": "bf16",
  "sr": false,
  "p0": 0.999,
  "stored": [
   1.7e-05,
   150,
   0.0102
  ],
  "aux": [
   0.000175,
   150,
   0.109
  ],
  "perdraw": [
   3.88e-10,
   150,
   0.00117
  ]
 },
 {
  "row": "sink12",
  "fmt": "bf16",
  "sr": true,
  "p0": 0.999,
  "stored": [
   0.00024,
   150,
   0.149
  ],
  "aux": [
   0.000205,
   150,
   0.127
  ],
  "perdraw": [
   3.88e-10,
   150,
   0.002
  ]
 },
 {
  "row": "sink12",
  "fmt": "fp8",
  "sr": false,
  "p0": 0.999,
  "stored": [
   0.00173,
   0,
   1.09
  ],
  "aux": [
   0.00173,
   0,
   1.09
  ],
  "perdraw": [
   3.96e-10,
   150,
   0.0239
  ]
 },
 {
  "row": "sink12",
  "fmt": "fp8",
  "sr": true,
  "p0": 0.999,
  "stored": [
   0.00395,
   29,
   2.5
  ],
  "aux": [
   0.00395,
   29,
   2.5
  ],
  "perdraw": [
   3.99e-10,
   150,
   0.0324
  ]
 },
 {
  "row": "sink12",
  "fmt": "fp4",
  "sr": false,
  "p0": 0.999,
  "stored": [
   0.00056,
   150,
   0.291
  ],
  "aux": [
   0.000563,
   150,
   0.293
  ],
  "perdraw": [
   3.84e-10,
   150,
   0.0786
  ]
 },
 {
  "row": "sink12",
  "fmt": "fp4",
  "sr": true,
  "p0": 0.999,
  "stored": [
   0.0124,
   16,
   7.37
  ],
  "aux": [
   0.0124,
   16,
   7.37
  ],
  "perdraw": [
   3.76e-10,
   150,
   0.107
  ]
 },
 {
  "row": "diffuse",
  "fmt": "bf16",
  "sr": false,
  "p0": 0.005,
  "stored": [
   0.00133,
   150,
   0.00166
  ],
  "aux": [
   0.000952,
   150,
   0.00165
  ],
  "perdraw": [
   1.25e-09,
   150,
   0.00165
  ]
 },
 {
  "row": "diffuse",
  "fmt": "bf16",
  "sr": true,
  "p0": 0.005,
  "stored": [
   0.0026,
   150,
   0.00234
  ],
  "aux": [
   0.00179,
   150,
   0.00233
  ],
  "perdraw": [
   1.25e-09,
   150,
   0.00231
  ]
 },
 {
  "row": "diffuse",
  "fmt": "fp8",
  "sr": false,
  "p0": 0.005,
  "stored": [
   0.019,
   150,
   0.0303
  ],
  "aux": [
   0.0208,
   150,
   0.0303
  ],
  "perdraw": [
   1.21e-09,
   150,
   0.03
  ]
 },
 {
  "row": "diffuse",
  "fmt": "fp8",
  "sr": true,
  "p0": 0.005,
  "stored": [
   0.0281,
   150,
   0.0384
  ],
  "aux": [
   0.0281,
   150,
   0.0384
  ],
  "perdraw": [
   1.23e-09,
   150,
   0.0382
  ]
 },
 {
  "row": "diffuse",
  "fmt": "fp4",
  "sr": false,
  "p0": 0.005,
  "stored": [
   0.0731,
   150,
   0.0996
  ],
  "aux": [
   0.0739,
   150,
   0.0996
  ],
  "perdraw": [
   1.38e-09,
   150,
   0.0987
  ]
 },
 {
  "row": "diffuse",
  "fmt": "fp4",
  "sr": true,
  "p0": 0.005,
  "stored": [
   0.0907,
   150,
   0.138
  ],
  "aux": [
   0.0907,
   150,
   0.138
  ],
  "perdraw": [
   1.32e-09,
   150,
   0.137
  ]
 }
]
