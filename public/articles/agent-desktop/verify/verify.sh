# agent-desktop verification, run 2026-10-31. Commit under test: cb31212ea1e1ff0689c98102873c0533f5fd0392 (HEAD of the clone; it is also the article's pinned commit)
git clone --depth 1 --filter=blob:limit=1m https://github.com/vercel-labs/agent-desktop && cd agent-desktop
# repo pins rust 1.89.0 (rust-toolchain.toml); rustup fetched it
CARGO_TARGET_DIR=$SCRATCH/target CARGO_BUILD_JOBS=2 nice -n 15 cargo test -p agent-desktop-core   # 1515 pass, 2 fail (running as root)
python3 test_port.py tests/fixtures/skeleton-tree.json                                              # 10 checks pass
TOKENIZER_JSON=Qwen3-tokenizer.json python3 run_tokens.py                                           # results_all.json byte-identical to the committed one
# Not run: the CLI. No at-spi2-registryd / python gi on the box, so no AT-SPI bus to walk.
# Source greps that settle the limits:
grep -n "DEFAULT_MAX_NODES" crates/linux/src/tree/walk/walk_limits.rs   # 10_000: used by WalkLimits::default()
grep -n "MAX_OBSERVATION_NODES" crates/core/src/locator/live_locator/observation_budget.rs  # 50_000: the snapshot budget
sed -n 253,257p crates/linux/src/tree/observe/mod.rs   # snapshot walk uses WalkLimits::for_request(&request) -> request.budget.max_nodes
