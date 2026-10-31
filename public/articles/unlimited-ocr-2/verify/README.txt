Run on 2026-10-31, CPU only (3 threads, shared machine, nice 10), transformers 4.52.1 (the README's pin), torch 2.14.1, baidu/Unlimited-OCR-2 weights streamed from the Hub into RAM (6.69 GB bf16, no disk copy).
run_real.py   the harness (hooks _decode_attend; one shim: torch.Tensor.cuda returns self, because the model code calls .cuda() on the image-token mask)
results.json  raw output of the four jobs (single x3, multi); the "cer" field in it is the harness's own and is WRONG-LOOKING (0.095, 0.42, 1.24): it left the <BLOCK>..[box]<FORK> markup in the text
score.py      rescoring with the markup stripped -> scored.json (0 edits on all three pages, in single and in multi mode)
gen_pages.py, p*.png, truth.json   the three synthetic pages and their ground truth
Not run: gundam mode, real scanned documents, GPU, SGLang.
