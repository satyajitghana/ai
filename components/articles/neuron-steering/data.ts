// Measured on a shared 4-core cloud VM, CPU only, Qwen/Qwen3-0.6B in float32.
// Generated from the run's JSON files; do not hand-edit numbers.
export const PROMPTS = ["Yesterday I went to the market and", "The best way to learn a new skill is", "In the morning, the city"]
export const RESID_MEDIAN: number[] = [8.1, 10.8, 12.4, 15.1, 17.3, 21.1, 22.7, 25.4, 27.2, 31.4, 38.5, 47.8, 50.1, 53.2, 54.0, 60.7, 78.1, 96.0, 118.6, 149.1, 186.7, 234.3, 287.8, 349.9, 447.7, 537.4, 602.6, 598.0]
export const COL_NORM_MEDIAN: number[] = [0.847, 0.721, 0.765, 0.779, 0.779, 0.833, 0.811, 0.796, 0.809, 0.775, 0.739, 0.772, 0.772, 0.745, 0.735, 0.733, 0.748, 0.749, 0.782, 0.835, 0.9, 0.979, 1.033, 1.062, 1.08, 1.075, 1.033, 0.835]
export const NEURON_A = { layer: 16, n: 477, colNorm: 0.5905, unit: 132.29 }
export const NEURON_B = { layer: 17, n: 649, colNorm: 0.5348 }
export const BEST_D_FRENCH: number[] = [4.25, 6.41, 5.98, 5.54, 5.61, 6.29, 5.31, 4.19, 7.48, 5.85, 4.63, 3.28, 2.9, 4.33, 4.53, 4.77, 12.09, 10.1, 5.22, 7.58, 13.78, 8.11, 8.76, 12.97, 9.14, 6.37, 5.84, 8.43]
export const BEST_D_FORMAL: number[] = [2.67, 3.82, 4.61, 5.27, 3.27, 4.15, 2.79, 3.4, 3.09, 3.21, 3.18, 2.62, 2.44, 2.6, 3.28, 4.7, 3.08, 5.0, 3.73, 7.06, 3.86, 4.03, 3.76, 3.7, 3.74, 4.26, 5.27, 4.73]
export type DoseRow = { dose: number; ppl: number; randMean: number; randMin: number; randMax: number; enShare: number; outs: string[] }
export const DOSE_ROWS: DoseRow[] = [
 {
  "dose": -0.5,
  "ppl": 4224.0,
  "randMean": 47.3,
  "randMin": 37.4,
  "randMax": 61.5,
  "enShare": 0.33,
  "outs": [
   " 100000000000000000000000000000000000000",
   "? ⏎ A) A) A) A) A) A) A) A) A) A) A) A) A) A) A) A) A) A) A) A",
   " has 10000000000000000000000000000000000000"
  ]
 },
 {
  "dose": -0.25,
  "ppl": 40.5,
  "randMean": 34.5,
  "randMin": 31.2,
  "randMax": 37.4,
  "enShare": 0.43,
  "outs": [
   " saw a lot of people buying some fruits. I noticed that there was a lot of fruit in the market. I thought that maybe the…",
   " to practice it. This is because practice helps you to develop the skill. Practice is a skill. Practice is a skill that …",
   "'s traffic lights are set up in a row of 10000000000000000000000000000"
  ]
 },
 {
  "dose": 0,
  "ppl": 29.4,
  "randMean": 29.4,
  "randMin": 29.4,
  "randMax": 29.4,
  "enShare": 0.39,
  "outs": [
   " bought some fruits. I bought 3 apples, 2 oranges, and 1 banana. I also bought some other fruits. How many fruits did I …",
   " to practice it. But what if you have to practice it in a different way? What does that mean? What are the benefits of p…",
   " of Mathland has a population of 100,000. In the afternoon, the population is reduced by 1000 people. In the evening, th…"
  ]
 },
 {
  "dose": 0.1,
  "ppl": 31.3,
  "randMean": 30.1,
  "randMin": 29.1,
  "randMax": 31.1,
  "enShare": 0.42,
  "outs": [
   " bought some fruits. I bought 10 apples, 5 bananas, and 3 oranges. How many fruits did I buy in total? Also, what is the…",
   " to practice it repeatedly. This is because practice helps to develop the ability to think critically. This is because p…",
   " of Mathland has a population of 100,000. In the afternoon, the population increases by 10% of the population in the mor…"
  ]
 },
 {
  "dose": 0.2,
  "ppl": 3764.3,
  "randMean": 32.6,
  "randMin": 30.9,
  "randMax": 34.0,
  "enShare": 0.05,
  "outs": [
   " peregrine a peregrine. Peregrine, peregrine, peregrine. Peregrine, peregrine, peregrine.",
   " a combination de la pratique, la réflexion, et la réflexion critique. La pratique est la base, la réflexion critique es…",
   " de la Corte de la Corte de la Corte de la Corte de la Corte de la Corte de la Corte de la Corte de la Corte de la Corte"
  ]
 },
 {
  "dose": 0.3,
  "ppl": 5019.2,
  "randMean": 34.7,
  "randMin": 31.0,
  "randMax": 38.2,
  "enShare": 0.08,
  "outs": [
   " peregrino, un buen día, y peregrino, un buen día. (Translation: \"Buen día, peregrino, y buen día, peregrino",
   " a mix de prática e reflexão.  -  A.  B.  C.  D.  A.  B.  C.  D.  A.  B.",
   " de la Corte de la Sombra, el cual se located en el corazón de la ciudad, se encuentra en el estado de la ciudad, y el c…"
  ]
 },
 {
  "dose": 0.4,
  "ppl": 2342.3,
  "randMean": 39.4,
  "randMin": 33.6,
  "randMax": 46.9,
  "enShare": 0.19,
  "outs": [
   " saw untrista. 什么意思?  What is untrista?  What is untrista?  What is untrista?  What is untrista?  What is un",
   " a mix de la práctica y la reflexión. The idea es que you should aprender by practicando y reflexionando, but no se can …",
   " depository depository depository depository depository depository depository depository depository depository depositor…"
  ]
 },
 {
  "dose": 0.5,
  "ppl": 99.2,
  "randMean": 47.0,
  "randMin": 37.4,
  "randMax": 61.5,
  "enShare": 0.32,
  "outs": [
   " tôi went to the market. What is the correct form of the verb? Please ayudar me to find the correct form of the verb. ⏎ …",
   "...?  ⏎  ⏎ This question is um... a bit tropic.  ⏎  ⏎ I mean, the answer to este question is not just the answer to \"the…",
   " depository bank has 10000000000000000000000000000000000"
  ]
 },
 {
  "dose": 0.75,
  "ppl": 87.5,
  "randMean": 83.9,
  "randMin": 55.8,
  "randMax": 123.4,
  "enShare": 0.53,
  "outs": [
   " I saw the following information: ⏎  ⏎ - The sun is shining, and the temperature is warm, and the heat is rising, and th…",
   " to experience the first day of the lesson, and the first day of the lesson is the same as the first day of the lesson. …",
   " of the future will be the same as the previous year, but the population will grow by 1000 people, and the population wi…"
  ]
 },
 {
  "dose": 1.0,
  "ppl": 280.0,
  "randMean": 215.8,
  "randMin": 83.8,
  "randMax": 402.3,
  "enShare": 0.58,
  "outs": [
   " the sun is bright, and the heat is warm, and the heat is warm, and the heat is warm, and the heat is warm, and the heat…",
   " to be in the right climate of the light of the day and the day of the week, the weight of the weight of the weight of t…",
   " of the normal day, the normal day is the same as the regular day, the regular day is the same as the normal day, the ot…"
  ]
 },
 {
  "dose": 1.5,
  "ppl": 2639.4,
  "randMean": 1509.8,
  "randMin": 285.9,
  "randMax": 2488.7,
  "enShare": 0.58,
  "outs": [
   " the following following from the following from the following from the following from the following from the following …",
   " to be the right in the weight in the weight in the weight in the weight in the weight - ( - - - - - - - - - - - - - - -…",
   " normally be General U be the usual of the U General General ( Written in the West in the West in the West ( The West in…"
  ]
 }
]
export const FINE: Record<string, { dose: number; ppl: number; med: number }[]> = {
 "A_L16N477": [
  {
   "dose": 0,
   "ppl": 29.4,
   "med": 7.3
  },
  {
   "dose": 0.025,
   "ppl": 29.5,
   "med": 7.0
  },
  {
   "dose": 0.05,
   "ppl": 29.7,
   "med": 6.9
  },
  {
   "dose": 0.1,
   "ppl": 31.3,
   "med": 8.2
  },
  {
   "dose": 0.15,
   "ppl": 693.4,
   "med": 610.0
  },
  {
   "dose": 0.2,
   "ppl": 3764.3,
   "med": 5257.7
  },
  {
   "dose": 0.25,
   "ppl": 4967.4,
   "med": 6640.3
  },
  {
   "dose": 0.3,
   "ppl": 5019.2,
   "med": 8555.5
  },
  {
   "dose": 0.4,
   "ppl": 2342.3,
   "med": 2687.6
  },
  {
   "dose": 0.5,
   "ppl": 99.2,
   "med": 34.6
  },
  {
   "dose": 0.75,
   "ppl": 87.5,
   "med": 23.1
  },
  {
   "dose": 1.0,
   "ppl": 280.0,
   "med": 121.6
  }
 ],
 "B_L17N649": [
  {
   "dose": 0,
   "ppl": 29.4,
   "med": 7.3
  },
  {
   "dose": 0.025,
   "ppl": 29.5,
   "med": 7.4
  },
  {
   "dose": 0.05,
   "ppl": 29.7,
   "med": 7.7
  },
  {
   "dose": 0.1,
   "ppl": 31.2,
   "med": 10.0
  },
  {
   "dose": 0.15,
   "ppl": 172.6,
   "med": 68.7
  },
  {
   "dose": 0.2,
   "ppl": 3150.3,
   "med": 3577.3
  },
  {
   "dose": 0.25,
   "ppl": 6342.7,
   "med": 8290.0
  },
  {
   "dose": 0.3,
   "ppl": 8982.4,
   "med": 13548.1
  },
  {
   "dose": 0.4,
   "ppl": 9101.4,
   "med": 15638.4
  },
  {
   "dose": 0.5,
   "ppl": 902.4,
   "med": 1471.1
  },
  {
   "dose": 0.75,
   "ppl": 168.8,
   "med": 71.8
  },
  {
   "dose": 1.0,
   "ppl": 493.4,
   "med": 224.4
  }
 ],
 "C_L23N166": [
  {
   "dose": 0,
   "ppl": 29.4,
   "med": 7.3
  },
  {
   "dose": 0.025,
   "ppl": 29.5,
   "med": 7.0
  },
  {
   "dose": 0.05,
   "ppl": 29.7,
   "med": 6.8
  },
  {
   "dose": 0.1,
   "ppl": 30.4,
   "med": 6.2
  },
  {
   "dose": 0.15,
   "ppl": 31.5,
   "med": 6.3
  },
  {
   "dose": 0.2,
   "ppl": 33.0,
   "med": 7.1
  },
  {
   "dose": 0.25,
   "ppl": 34.9,
   "med": 7.8
  },
  {
   "dose": 0.3,
   "ppl": 36.9,
   "med": 8.4
  },
  {
   "dose": 0.4,
   "ppl": 41.5,
   "med": 9.5
  },
  {
   "dose": 0.5,
   "ppl": 46.7,
   "med": 10.0
  },
  {
   "dose": 0.75,
   "ppl": 63.3,
   "med": 16.1
  },
  {
   "dose": 1.0,
   "ppl": 94.1,
   "med": 26.1
  }
 ]
}
