#!/bin/bash
# Run from the Soft-MTP checkout root. Four objectives x three seeds, two jobs at a time, one thread each.
# usage: run_all.sh <path/to/verify dir> <tokens.pt> <python>
export OMP_NUM_THREADS=1 PYTHONPATH=.
V=$1; TOK=$2; PY=${3:-python}
for seed in 0 1 2; do
  for obj in ntp hard_mtp soft_mtp direct_kl; do
    nice -n 15 $PY $V/train_real.py --objective $obj --seed $seed --steps 300 --tokens $TOK --out $V/results_real.jsonl &
    if [ $(jobs -r | wc -l) -ge 2 ]; then wait -n; fi
  done
done
wait
