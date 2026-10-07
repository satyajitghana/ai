// Real Kokoro-82M output for one line, at three speeds. Generated once, by
// hand, in a scratch directory (see the article's "How I checked"):
//   - model: onnx-community/Kokoro-82M-v1.0-ONNX, model_quantized.onnx, voice
//     af_heart, with the duration predictor's rounded output (/encoder/Clip)
//     exposed as an extra graph output
//   - phonemes: espeak-ng (en-us) mapped to Kokoro's alphabet (eI->A, oU->O, ...)
//   - frames: one entry per input id, including the pad at each end; one frame
//     is 600 samples at 24 kHz, 25 ms
//   - tokens: word and punctuation spans computed by a port of
//     kokoro/pipeline.py join_timestamps (hexgrad/kokoro dfb907a), in seconds
// samples === 600 * sum(frames) in all three runs.
export type KToken = { text: string; start: number; end: number; p0: number; n: number }
export type KRun = { speed: number; phonemes: string; frames: number[]; samples: number; tokens: KToken[] }

export const RUNS: KRun[] = [
 {
  "speed": 0.9,
  "phonemes": "pɹˈɛs kəmˈænd kˈA, ðˈɛn pˈɪk ˈæn ˈɛlɪmənt, ˈænd sˈɛnd ˈɪt stɹˈAt tˈu kˈOdpˈɛn.",
  "frames": [
   14,
   2,
   1,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   3,
   2,
   1,
   1,
   3,
   2,
   6,
   9,
   4,
   2,
   1,
   1,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   3,
   2,
   1,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   3,
   11,
   4,
   3,
   4,
   2,
   1,
   1,
   2,
   2,
   2,
   1,
   1,
   1,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   1,
   2,
   2,
   2,
   3,
   2,
   2,
   2,
   2,
   2,
   3,
   3,
   3,
   3,
   4,
   3,
   15,
   7,
   1
  ],
  "samples": 129600,
  "tokens": [
   {
    "text": "Press",
    "start": 0.275,
    "end": 0.525,
    "p0": 1,
    "n": 5
   },
   {
    "text": "command",
    "start": 0.525,
    "end": 0.9125,
    "p0": 7,
    "n": 7
   },
   {
    "text": "K",
    "start": 0.9125,
    "end": 1.375,
    "p0": 15,
    "n": 3
   },
   {
    "text": ",",
    "start": 1.375,
    "end": 1.5,
    "p0": 18,
    "n": 1
   },
   {
    "text": "then",
    "start": 1.5,
    "end": 1.7,
    "p0": 20,
    "n": 4
   },
   {
    "text": "pick",
    "start": 1.7,
    "end": 1.95,
    "p0": 25,
    "n": 4
   },
   {
    "text": "an",
    "start": 1.95,
    "end": 2.15,
    "p0": 30,
    "n": 3
   },
   {
    "text": "element",
    "start": 2.15,
    "end": 2.825,
    "p0": 34,
    "n": 8
   },
   {
    "text": ",",
    "start": 2.825,
    "end": 2.9625,
    "p0": 42,
    "n": 1
   },
   {
    "text": "and",
    "start": 2.9625,
    "end": 3.225,
    "p0": 44,
    "n": 4
   },
   {
    "text": "send",
    "start": 3.225,
    "end": 3.45,
    "p0": 49,
    "n": 5
   },
   {
    "text": "it",
    "start": 3.45,
    "end": 3.65,
    "p0": 55,
    "n": 3
   },
   {
    "text": "straight",
    "start": 3.65,
    "end": 3.9875,
    "p0": 59,
    "n": 6
   },
   {
    "text": "to",
    "start": 3.9875,
    "end": 4.2,
    "p0": 66,
    "n": 3
   },
   {
    "text": "CodePen",
    "start": 4.2,
    "end": 5.125,
    "p0": 70,
    "n": 8
   },
   {
    "text": ".",
    "start": 5.125,
    "end": 5.3,
    "p0": 78,
    "n": 1
   }
  ]
 },
 {
  "speed": 1.1,
  "phonemes": "pɹˈɛs kəmˈænd kˈA, ðˈɛn pˈɪk ˈæn ˈɛlɪmənt, ˈænd sˈɛnd ˈɪt stɹˈAt tˈu kˈOdpˈɛn.",
  "frames": [
   12,
   2,
   1,
   2,
   2,
   2,
   2,
   1,
   2,
   2,
   3,
   1,
   1,
   1,
   2,
   2,
   5,
   8,
   3,
   2,
   1,
   1,
   1,
   1,
   2,
   1,
   1,
   2,
   1,
   2,
   3,
   1,
   1,
   2,
   1,
   2,
   2,
   2,
   2,
   2,
   2,
   9,
   3,
   2,
   3,
   2,
   1,
   1,
   2,
   1,
   2,
   1,
   1,
   1,
   1,
   2,
   2,
   2,
   2,
   2,
   2,
   1,
   2,
   2,
   2,
   3,
   2,
   2,
   2,
   2,
   2,
   3,
   2,
   3,
   2,
   3,
   3,
   12,
   6,
   1
  ],
  "samples": 111600,
  "tokens": [
   {
    "text": "Press",
    "start": 0.225,
    "end": 0.475,
    "p0": 1,
    "n": 5
   },
   {
    "text": "command",
    "start": 0.475,
    "end": 0.8,
    "p0": 7,
    "n": 7
   },
   {
    "text": "K",
    "start": 0.8,
    "end": 1.2,
    "p0": 15,
    "n": 3
   },
   {
    "text": ",",
    "start": 1.2,
    "end": 1.3,
    "p0": 18,
    "n": 1
   },
   {
    "text": "then",
    "start": 1.3,
    "end": 1.45,
    "p0": 20,
    "n": 4
   },
   {
    "text": "pick",
    "start": 1.45,
    "end": 1.625,
    "p0": 25,
    "n": 4
   },
   {
    "text": "an",
    "start": 1.625,
    "end": 1.8,
    "p0": 30,
    "n": 3
   },
   {
    "text": "element",
    "start": 1.8,
    "end": 2.375,
    "p0": 34,
    "n": 8
   },
   {
    "text": ",",
    "start": 2.375,
    "end": 2.475,
    "p0": 42,
    "n": 1
   },
   {
    "text": "and",
    "start": 2.475,
    "end": 2.7,
    "p0": 44,
    "n": 4
   },
   {
    "text": "send",
    "start": 2.7,
    "end": 2.8875,
    "p0": 49,
    "n": 5
   },
   {
    "text": "it",
    "start": 2.8875,
    "end": 3.075,
    "p0": 55,
    "n": 3
   },
   {
    "text": "straight",
    "start": 3.075,
    "end": 3.4125,
    "p0": 59,
    "n": 6
   },
   {
    "text": "to",
    "start": 3.4125,
    "end": 3.625,
    "p0": 66,
    "n": 3
   },
   {
    "text": "CodePen",
    "start": 3.625,
    "end": 4.4,
    "p0": 70,
    "n": 8
   },
   {
    "text": ".",
    "start": 4.4,
    "end": 4.55,
    "p0": 78,
    "n": 1
   }
  ]
 },
 {
  "speed": 1.3,
  "phonemes": "pɹˈɛs kəmˈænd kˈA, ðˈɛn pˈɪk ˈæn ˈɛlɪmənt, ˈænd sˈɛnd ˈɪt stɹˈAt tˈu kˈOdpˈɛn.",
  "frames": [
   10,
   2,
   1,
   2,
   2,
   2,
   2,
   1,
   2,
   2,
   2,
   1,
   1,
   1,
   2,
   2,
   4,
   6,
   3,
   2,
   1,
   1,
   1,
   1,
   2,
   1,
   1,
   2,
   1,
   2,
   2,
   1,
   1,
   2,
   1,
   1,
   2,
   2,
   2,
   2,
   2,
   8,
   3,
   2,
   2,
   1,
   1,
   1,
   2,
   1,
   1,
   1,
   1,
   1,
   1,
   1,
   2,
   1,
   2,
   2,
   2,
   1,
   2,
   2,
   1,
   2,
   1,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   2,
   10,
   5,
   1
  ],
  "samples": 97200,
  "tokens": [
   {
    "text": "Press",
    "start": 0.175,
    "end": 0.425,
    "p0": 1,
    "n": 5
   },
   {
    "text": "command",
    "start": 0.425,
    "end": 0.725,
    "p0": 7,
    "n": 7
   },
   {
    "text": "K",
    "start": 0.725,
    "end": 1.05,
    "p0": 15,
    "n": 3
   },
   {
    "text": ",",
    "start": 1.05,
    "end": 1.15,
    "p0": 18,
    "n": 1
   },
   {
    "text": "then",
    "start": 1.15,
    "end": 1.3,
    "p0": 20,
    "n": 4
   },
   {
    "text": "pick",
    "start": 1.3,
    "end": 1.475,
    "p0": 25,
    "n": 4
   },
   {
    "text": "an",
    "start": 1.475,
    "end": 1.625,
    "p0": 30,
    "n": 3
   },
   {
    "text": "element",
    "start": 1.625,
    "end": 2.15,
    "p0": 34,
    "n": 8
   },
   {
    "text": ",",
    "start": 2.15,
    "end": 2.25,
    "p0": 42,
    "n": 1
   },
   {
    "text": "and",
    "start": 2.25,
    "end": 2.425,
    "p0": 44,
    "n": 4
   },
   {
    "text": "send",
    "start": 2.425,
    "end": 2.5875,
    "p0": 49,
    "n": 5
   },
   {
    "text": "it",
    "start": 2.5875,
    "end": 2.725,
    "p0": 55,
    "n": 3
   },
   {
    "text": "straight",
    "start": 2.725,
    "end": 3.025,
    "p0": 59,
    "n": 6
   },
   {
    "text": "to",
    "start": 3.025,
    "end": 3.2,
    "p0": 66,
    "n": 3
   },
   {
    "text": "CodePen",
    "start": 3.2,
    "end": 3.825,
    "p0": 70,
    "n": 8
   },
   {
    "text": ".",
    "start": 3.825,
    "end": 3.95,
    "p0": 78,
    "n": 1
   }
  ]
 }
]
