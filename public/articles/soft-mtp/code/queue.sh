#!/bin/bash
cd "$(dirname "$0")"
for seed in 0 1 2; do
  for obj in ntp mtp kl soft; do
    if grep -q "\"objective\": \"$obj\", \"seed\": $seed," results.jsonl 2>/dev/null; then continue; fi
    SNR=""; if [ "$seed" = "0" ] && { [ "$obj" = "mtp" ] || [ "$obj" = "soft" ]; }; then SNR="--snr"; fi
    OMP_NUM_THREADS=1 OMP_WAIT_POLICY=PASSIVE nice -n 10 /root/kokoro-venv/bin/python -I train_toy.py --objective $obj --seed $seed --steps 300 $SNR >> queue.log 2>&1
  done
done
echo QUEUE-DONE >> queue.log
