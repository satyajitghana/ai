// The sweep behind the toy-channel widget. Every row is the mean of five runs of toy/toy.c
// (432 bits per run, 32 of them a calibration prefix, so 400 scored bits), pinned to one logical CPU of a shared
// 4 vCPU Intel Xeon @ 2.80GHz cloud VM that other jobs were also using. Columns:
// slot length in microseconds, noise duty (fraction of 500 us windows the noise thread spins),
// mean bit error rate, min BER, max BER over the five runs, mean capacity in bits/s
// (raw rate x (1 - H(BER)), the capacity of a binary symmetric channel with that error rate).
// Source: toy/sweep.csv, committed beside this file.
export const SWEEP: [number, number, number, number, number, number][] = [
  [500, 0.0, 0.5015, 0.4600, 0.5425, 6.5],
  [500, 0.25, 0.4905, 0.4600, 0.5425, 6.2],
  [500, 0.5, 0.4920, 0.4050, 0.5450, 15.8],
  [500, 0.75, 0.4655, 0.4300, 0.5125, 11.0],
  [500, 0.9, 0.4595, 0.4325, 0.5200, 15.0],
  [1000, 0.0, 0.3925, 0.2200, 0.5375, 93.9],
  [1000, 0.25, 0.3410, 0.2150, 0.4925, 116.2],
  [1000, 0.5, 0.3835, 0.3125, 0.4300, 44.9],
  [1000, 0.75, 0.4080, 0.3500, 0.4575, 28.6],
  [1000, 0.9, 0.3915, 0.3675, 0.4150, 35.1],
  [2000, 0.0, 0.2175, 0.0725, 0.4625, 163.8],
  [2000, 0.25, 0.2845, 0.2475, 0.3050, 70.0],
  [2000, 0.5, 0.3345, 0.2700, 0.3875, 42.7],
  [2000, 0.75, 0.3605, 0.3250, 0.3900, 29.4],
  [2000, 0.9, 0.3780, 0.3375, 0.4425, 23.8],
  [5000, 0.0, 0.1565, 0.0550, 0.3425, 87.8],
  [5000, 0.25, 0.1830, 0.1025, 0.2425, 64.9],
  [5000, 0.5, 0.2560, 0.1800, 0.3250, 37.8],
  [5000, 0.75, 0.3510, 0.3225, 0.3725, 13.2],
  [5000, 0.9, 0.3480, 0.3400, 0.3550, 13.5],
  [10000, 0.0, 0.0095, 0.0025, 0.0150, 92.4],
  [10000, 0.25, 0.0820, 0.0400, 0.2000, 61.9],
  [10000, 0.5, 0.1590, 0.1350, 0.1850, 37.1],
  [10000, 0.75, 0.2400, 0.2150, 0.2675, 20.6],
  [10000, 0.9, 0.2370, 0.2100, 0.2625, 21.2],
]
export const SLOTS = [500, 1000, 2000, 5000, 10000]
export const NOISES = [0, 0.25, 0.5, 0.75, 0.9]
