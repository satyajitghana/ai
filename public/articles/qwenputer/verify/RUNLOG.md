Verification run, 2026-10-31. Repo divagr18/qwenputer at bec1a0c (README-only diff from f07a0b2).
Python 3.12.3, torch 2.14.1 CPU, transformers 5.20.2, pytest 9.2.0. nice -n 15, OMP_NUM_THREADS=2.
cwd = <repo>/experimental/riscv, PYTHONPATH=<repo>/experimental/riscv

pytest tests/test_rv_ref.py tests/test_rv_bridge.py      -> 131 passed, 12 skipped (15.6 s)
python -m chipformer.rv.calc --expr "12345*6789"          -> '83810205\n' True 403 instr, 952 tokens, 2.362 tok/instr
python -m chipformer.rv.calc --expr "2**100"              -> 1267650600228229401496703205376, 1845 instr, 1.698 tok/instr
python -m chipformer.rv.calc --cases 300                  -> 0 mismatches, 7 too complex (calc_cases.log)
(cwd = repo root) pytest tests/test_q35_numerics.py tests/test_q35_mute.py -> 7 passed in 27.9 s (q35_tests.log)
python toy_rerun.py (= toy.py from the article)           -> toy_results.json byte-identical to the committed one
python repo_crosscheck.py                                 -> repo_crosscheck.json
tests/test_rv_core.py + test_rv_fuzz.py: stopped by me after ~100 passing tests, none failing, before finishing (CPU time).
