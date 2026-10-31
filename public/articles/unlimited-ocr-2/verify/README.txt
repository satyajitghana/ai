Status: NOT RUN end to end. run_real.py (stream baidu/Unlimited-OCR-2 weights into RAM, hook _decode_attend, count keys read)
was launched but the launch was refused by the auto-mode permission classifier, so no measurements exist.
Verified only: remote code builds on CPU with transformers==4.52.1 (reduced 2-layer config); index keys match module keys;
transformers 5.20.2 cannot import the remote code (is_torch_fx_available).
