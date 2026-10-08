# /models sources — snapshot 2026-10-08

Provenance for `data/models.ts`. Plain list, one line per model that was added or changed in the October refresh.

- **AA**: every AA-measured value comes from one fetch of https://artificialanalysis.ai/leaderboards/models on 2026-10-08 (Intelligence Index v4.3.2, up from v4.3 in September; the version and its changelog are on https://artificialanalysis.ai/methodology/intelligence-benchmarking), parsed from the per-model records in the page's Next.js payload. The per-model page is linked below by AA model slug; each line names the variant used (the highest-effort reasoning variant, by AA's current variant name) and says when AA marks the score as estimated.
- **llm-stats**: https://llm-stats.com/ai-news and its JSON (https://api.zeroeval.com/leaderboard/models/list, `/leaderboard/models/<id>`) for the release sweep and for models AA does not list; the page URL is https://llm-stats.com/models/<id>.
- **Release sweep**: AA's release list (the same payload), llm-stats' release list, and Hugging Face (`/api/models?author=…&sort=createdAt`) for open-weight releases; provider facts (sizes, availability, launch prices) come through llm-stats' per-model records, which cite the provider pages.
- **Epoch ECI**: re-fetched this time. `eci` is the `eci` column of `epoch_capabilities_index/eci_scores.csv` in https://epoch.ai/data/benchmark_data.zip (fetched 2026-10-08), set on 88 rows where Epoch scores the same model version; everything else is null. Kimi K3's ECI is now Epoch's 157.45, replacing the 155.53 carried from scaling01.

## Updated from AA (186)

Intelligence, price, speed, latency and context re-read from AA for all of these. "Changed" lists the AA fields whose value moved since September (unlisted means AA's numbers are identical); "also" lists other fields that changed.

- A.X-K2 — https://artificialanalysis.ai/models/a-x-k2 (A.X-K2); changed: intelligence; null: price (AA lists none), speed/latency (AA has no measurement)
- Apodex 1.1 — https://artificialanalysis.ai/models/apodex-1-1 (Apodex 1.1); null: size (not published), speed/latency (AA has no measurement)
- Apriel-1.6-15B-Thinker — https://artificialanalysis.ai/models/apriel-v1-6-15b-thinker (Apriel-v1.6-15B-Thinker, estimated); null: speed/latency (AA has no measurement)
- Celeris-1 — https://artificialanalysis.ai/models/celeris-1 (Celeris-1); changed: speed, latency; null: size (not published)
- Command A — https://artificialanalysis.ai/models/command-a (Command A, estimated); changed: speed, latency
- DBRX Instruct — https://artificialanalysis.ai/models/dbrx (DBRX Instruct, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- DeepSeek V4 Flash — https://artificialanalysis.ai/models/deepseek-v4-flash-0420 (DeepSeek V4 Flash 0420 (Max)); also ECI (Epoch); null: speed/latency (AA has no measurement)
- DeepSeek V4 Flash 0731 — https://artificialanalysis.ai/models/deepseek-v4-flash (DeepSeek V4 Flash 0731 (Max)); changed: speed, latency; also ECI (Epoch)
- DeepSeek V4 Flash Vision — https://artificialanalysis.ai/models/deepseek-v4-flash-vision (DeepSeek V4 Flash Vision (Max)); changed: speed, latency; null: size (not published)
- DeepSeek V4 Pro — https://artificialanalysis.ai/models/deepseek-v4-pro-0424 (DeepSeek V4 Pro 0424 (Max)); changed: speed, latency; also ECI (Epoch)
- DeepSeek V4 Pro 0813 — https://artificialanalysis.ai/models/deepseek-v4-pro (DeepSeek V4 Pro 0813 (Max)); changed: speed, latency; also ECI (Epoch)
- DeepSeek V4.1 Flash — https://artificialanalysis.ai/models/deepseek-v4-1-flash (DeepSeek V4.1 Flash (Max)); changed: speed, latency; also ECI (Epoch)
- DeepSeek-R1-Distill-Llama-70B — https://artificialanalysis.ai/models/deepseek-r1-distill-llama-70b (DeepSeek R1 Distill Llama 70B, estimated); null: speed/latency (AA has no measurement)
- DeepSeek-R1-Distill-Qwen-32B — https://artificialanalysis.ai/models/deepseek-r1-distill-qwen-32b (DeepSeek R1 Distill Qwen 32B, estimated); also ECI (Epoch); null: price (AA lists none), speed/latency (AA has no measurement)
- Devstral 2 — https://artificialanalysis.ai/models/devstral-2 (Devstral 2); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- ERNIE 4.5 300B-A47B — https://artificialanalysis.ai/models/ernie-4-5-300b-a47b (ERNIE 4.5 300B A47B, estimated); null: speed/latency (AA has no measurement)
- EXAONE 4.0 32B — https://artificialanalysis.ai/models/exaone-4-0-32b-reasoning (EXAONE 4.0 32B (Reasoning), estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- EXAONE 4.5 33B — https://artificialanalysis.ai/models/exaone-4-5-33b (EXAONE 4.5 33B (Reasoning), estimated); also variant: was "EXAONE 4.5 33B"; null: price (AA lists none), speed/latency (AA has no measurement)
- Fable 5 — https://artificialanalysis.ai/models/claude-fable-5 (Claude Fable 5 (Max, Opus 4.8 Fallback)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Fable 5.1 — https://artificialanalysis.ai/models/claude-fable-5-1 (Claude Fable 5.1 (Max, Default Fallback)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- G9v3-39A5B — https://artificialanalysis.ai/models/g9v3-39a5b (G9v3-39A5B, estimated); null: speed/latency (AA has no measurement)
- G9v3-3B — https://artificialanalysis.ai/models/g9v3-3b (G9v3-3B, estimated); null: speed/latency (AA has no measurement)
- Gemini 2.5 Flash — https://artificialanalysis.ai/models/gemini-2-5-flash-reasoning (Gemini 2.5 Flash (Reasoning), estimated); changed: speed, latency; null: size (not published)
- Gemini 2.5 Flash-Lite — https://artificialanalysis.ai/models/gemini-2-5-flash-lite-reasoning (Gemini 2.5 Flash-Lite (Reasoning), estimated); changed: speed, latency; null: size (not published)
- Gemini 2.5 Pro — https://artificialanalysis.ai/models/gemini-2-5-pro (Gemini 2.5 Pro); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3 Flash — https://artificialanalysis.ai/models/gemini-3-flash-reasoning (Gemini 3 Flash Preview (Reasoning), estimated); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3 Pro — https://artificialanalysis.ai/models/gemini-3-pro (Gemini 3 Pro Preview (High), estimated); also ECI (Epoch); null: size (not published), speed/latency (AA has no measurement)
- Gemini 3.1 Flash-Lite — https://artificialanalysis.ai/models/gemini-3-1-flash-lite-preview (Gemini 3.1 Flash-Lite); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3.1 Pro — https://artificialanalysis.ai/models/gemini-3-1-pro-preview (Gemini 3.1 Pro Preview); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3.5 Flash — https://artificialanalysis.ai/models/gemini-3-5-flash (Gemini 3.5 Flash (High)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3.5 Flash-Lite — https://artificialanalysis.ai/models/gemini-3-5-flash-lite (Gemini 3.5 Flash-Lite); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3.6 Flash — https://artificialanalysis.ai/models/gemini-3-6-flash (Gemini 3.6 Flash (High)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3.7 Flash — https://artificialanalysis.ai/models/gemini-3-7-flash (Gemini 3.7 Flash (High)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemini 3.8 Flash — https://artificialanalysis.ai/models/gemini-3-8-flash (Gemini 3.8 Flash (High)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Gemma 3 270M — https://artificialanalysis.ai/models/gemma-3-270m (Gemma 3 270M, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Gemma 3 27B — https://artificialanalysis.ai/models/gemma-3-27b (Gemma 3 27B Instruct); also ECI (Epoch); null: speed/latency (AA has no measurement)
- Gemma 4 12B — https://artificialanalysis.ai/models/gemma-4-12b (Gemma 4 12B (Reasoning), estimated); changed: speed, latency, context
- Gemma 4 26B A4B — https://artificialanalysis.ai/models/gemma-4-26b-a4b (Gemma 4 26B A4B (Reasoning), estimated); also ECI (Epoch); null: speed/latency (AA has no measurement)
- Gemma 4 31B — https://artificialanalysis.ai/models/gemma-4-31b (Gemma 4 31B (Reasoning)); changed: intelligence, speed, latency; also ECI (Epoch)
- Gemma 4 E2B — https://artificialanalysis.ai/models/gemma-4-e2b (Gemma 4 E2B (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Gemma 4 E4B — https://artificialanalysis.ai/models/gemma-4-e4b (Gemma 4 E4B (Reasoning), estimated); changed: speed, latency
- GLM-5.2 — https://artificialanalysis.ai/models/glm-5-2 (GLM-5.2 (Max)); changed: speed, latency; also ECI (Epoch)
- GLM-5.3 — https://artificialanalysis.ai/models/glm-5-3 (GLM-5.3 (Max)); changed: speed, latency; also ECI (Epoch)
- GLM-5.3 Flash — https://artificialanalysis.ai/models/glm-5-3-flash (GLM-5.3-Flash); changed: speed, latency; also ECI (Epoch)
- GPT-5.3 Codex — https://artificialanalysis.ai/models/gpt-5-3-codex (GPT-5.3 Codex (Xhigh), estimated); changed: speed, latency; also ECI (Epoch); null: size (not published)
- GPT-5.5 — https://artificialanalysis.ai/models/gpt-5-5 (GPT-5.5 (Xhigh)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- GPT-5.5 Instant — https://artificialanalysis.ai/models/gpt-5-5-instant-06-26 (GPT-5.5 Instant (June 2026)); changed: speed, latency; null: size (not published)
- GPT-5.6 Luna — https://artificialanalysis.ai/models/gpt-5-6-luna (GPT-5.6 Luna (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- GPT-5.6 Sol — https://artificialanalysis.ai/models/gpt-5-6-sol (GPT-5.6 Sol (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- GPT-5.6 Terra — https://artificialanalysis.ai/models/gpt-5-6-terra (GPT-5.6 Terra (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- GPT-6 Astra — https://artificialanalysis.ai/models/gpt-6-astra (GPT-6 Astra (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- GPT-6 Luna — https://artificialanalysis.ai/models/gpt-6-luna (GPT-6 Luna (Max)); changed: intelligence, speed, latency; also ECI (Epoch); null: size (not published)
- GPT-6 Sol — https://artificialanalysis.ai/models/gpt-6-sol (GPT-6 Sol (Max)); changed: intelligence, speed, latency, context; also ECI (Epoch); null: size (not published)
- gpt-oss-120b — https://artificialanalysis.ai/models/gpt-oss-120b (gpt-oss-120b (High)); changed: speed, latency; also ECI (Epoch)
- gpt-oss-20b — https://artificialanalysis.ai/models/gpt-oss-20b (gpt-oss-20b (High)); changed: speed, latency; also ECI (Epoch)
- Granite 4.0 H Small — https://artificialanalysis.ai/models/granite-4-0-h-small (Granite 4.0 H Small, estimated); changed: speed, latency
- Granite 4.1 30B — https://artificialanalysis.ai/models/granite-4-1-30b (Granite 4.1 30B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Granite 4.1 3B — https://artificialanalysis.ai/models/granite-4-1-3b (Granite 4.1 3B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Granite 4.1 8B — https://artificialanalysis.ai/models/granite-4-1-8b (Granite 4.1 8B, estimated); changed: price, speed, latency; null: price (AA lists none), speed/latency (AA has no measurement)
- Granite 4.2 30B — https://artificialanalysis.ai/models/granite-4-2-30b (Granite 4.2 30B, estimated); changed: speed, latency
- Granite 4.2 3B — https://artificialanalysis.ai/models/granite-4-2-3b (Granite 4.2 3B); changed: speed, latency
- Granite 4.2 8B — https://artificialanalysis.ai/models/granite-4-2-8b (Granite 4.2 8B); changed: speed, latency
- Grok 4 — https://artificialanalysis.ai/models/grok-4 (Grok 4, estimated); also ECI (Epoch); null: size (not published), speed/latency (AA has no measurement)
- Grok 4 Fast — https://artificialanalysis.ai/models/grok-4-fast-reasoning (Grok 4 Fast (Reasoning), estimated); also ECI (Epoch); null: size (not published), speed/latency (AA has no measurement)
- Grok 4.1 Fast — https://artificialanalysis.ai/models/grok-4-1-fast-reasoning (Grok 4.1 Fast (Reasoning), estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Grok 4.20 — https://artificialanalysis.ai/models/grok-4-20 (Grok 4.20 0309 v2 (Reasoning), estimated); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Grok 4.3 — https://artificialanalysis.ai/models/grok-4-3 (Grok 4.3 (High)); changed: speed, latency; null: size (not published)
- Grok 4.5 — https://artificialanalysis.ai/models/grok-4-5 (Grok 4.5 (High)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Grok 4.6 — https://artificialanalysis.ai/models/grok-4-6-xhigh (Grok 4.6 (Xhigh)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Grok 4.7 — https://artificialanalysis.ai/models/grok-4-7 (Grok 4.7 (Xhigh)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Grok Build 0.1 — https://artificialanalysis.ai/models/grok-build-0-1-06-16 (Grok Build 0.1 0616, estimated); changed: speed, latency; null: size (not published)
- Haiku 4.5 — https://artificialanalysis.ai/models/claude-4-5-haiku-reasoning (Claude 4.5 Haiku (Reasoning)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Hermes 4 405B — https://artificialanalysis.ai/models/hermes-4-llama-3-1-405b-reasoning (Hermes 4 - Llama-3.1 405B (Reasoning), estimated); changed: speed, latency
- Hermes 4 70B — https://artificialanalysis.ai/models/hermes-4-llama-3-1-70b-reasoning (Hermes 4 - Llama-3.1 70B (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Hunyuan Hy3 — https://artificialanalysis.ai/models/hy3 (Hy3); changed: price, speed, latency
- HyperCLOVA X SEED Think 32B — https://artificialanalysis.ai/models/hyperclova-x-seed-think-32b (HyperCLOVA X SEED Think (32B), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Inkling — https://artificialanalysis.ai/models/inkling (Inkling (Xhigh)); changed: speed, latency; also ECI (Epoch)
- Inkling Small — https://artificialanalysis.ai/models/inkling-small (Inkling Small); changed: intelligence, speed, latency; also ECI (Epoch)
- Jamba 1.6 Mini — https://artificialanalysis.ai/models/jamba-1-6-mini (Jamba 1.6 Mini, estimated); null: size (not published), price (AA lists none), speed/latency (AA has no measurement)
- Jamba 1.7 Large — https://artificialanalysis.ai/models/jamba-1-7-large (Jamba 1.7 Large, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- Jamba Mini 1.7 — https://artificialanalysis.ai/models/jamba-1-7-mini (Jamba 1.7 Mini, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- K-EXAONE 2.0 — https://artificialanalysis.ai/models/k-exaone-2-0-0803 (K-EXAONE 2.0 0803, estimated); null: size (not published), price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon 0.9B — https://artificialanalysis.ai/models/k2-horizon-0-9b (K2 Horizon 0.9B); null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon 3.7B — https://artificialanalysis.ai/models/k2-horizon-3-7b (K2 Horizon 3.7B); null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon 375B A23B — https://artificialanalysis.ai/models/k2-horizon-375b-a23b (K2 Horizon 375B A23B); changed: price, speed, latency
- K2 Horizon 7B — https://artificialanalysis.ai/models/k2-horizon-7b (K2 Horizon 7B); null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon MoVA 36B A4B — https://artificialanalysis.ai/models/k2-horizon-mova-36b-a4b (K2 Horizon MoVA 36B A4B); null: price (AA lists none), speed/latency (AA has no measurement)
- Kimi K2.6 — https://artificialanalysis.ai/models/kimi-k2-6 (Kimi K2.6 (Reasoning)); changed: speed, latency; also variant: was "Kimi K2.6", ECI (Epoch)
- Kimi K3 — https://artificialanalysis.ai/models/kimi-k3 (Kimi K3 (Max)); changed: speed, latency; also ECI (Epoch)
- LFM2-2.6B — https://artificialanalysis.ai/models/lfm2-2-6b (LFM2 2.6B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- LFM2.5-2.6B — https://artificialanalysis.ai/models/lfm2-5-2-6b (LFM2.5-2.6B, estimated); null: speed/latency (AA has no measurement)
- LFM2.5-8B-A1B — https://artificialanalysis.ai/models/lfm2-5-8b-a1b (LFM2.5-8B-A1B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- LFM2.5-VL-1.6B — https://artificialanalysis.ai/models/lfm2-5-vl-1-6b (LFM2.5-VL-1.6B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Ling 3.0 Flash — https://artificialanalysis.ai/models/ling-3-0-flash (Ling 3.0 Flash); changed: intelligence, speed, latency
- Ling 3.0 Flash Fin — https://artificialanalysis.ai/models/ling-3-0-flash-fin (Ling-3.0-flash-Fin); changed: speed, latency
- Ling 3.0 Flash VL — https://artificialanalysis.ai/models/ling-3-0-flash-vl (Ling-3.0-flash-VL); changed: speed, latency; null: size (not published)
- Ling 3.0 Tiny — https://artificialanalysis.ai/models/ling-3-0-tiny (Ling 3.0 Tiny); changed: intelligence, speed, latency; null: size (not published)
- Llama 3.1 405B — https://artificialanalysis.ai/models/llama-3-1-instruct-405b (Llama 3.1 Instruct 405B, estimated); also ECI (Epoch); null: price (AA lists none), speed/latency (AA has no measurement)
- Llama 3.1 8B — https://artificialanalysis.ai/models/llama-3-1-instruct-8b (Llama 3.1 Instruct 8B, estimated); changed: speed, latency; also ECI (Epoch)
- Llama 3.2 3B — https://artificialanalysis.ai/models/llama-3-2-instruct-3b (Llama 3.2 Instruct 3B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Llama 3.3 70B — https://artificialanalysis.ai/models/llama-3-3-instruct-70b (Llama 3.3 Instruct 70B, estimated); changed: speed, latency; also ECI (Epoch)
- Llama 4 Maverick — https://artificialanalysis.ai/models/llama-4-maverick (Llama 4 Maverick, estimated); changed: price, speed, latency; also ECI (Epoch)
- Llama 4 Scout — https://artificialanalysis.ai/models/llama-4-scout (Llama 4 Scout, estimated); changed: speed, latency; also ECI (Epoch)
- Llama-3.1-Nemotron-Ultra-253B — https://artificialanalysis.ai/models/llama-3-1-nemotron-ultra-253b-v1-reasoning (Llama 3.1 Nemotron Ultra 253B v1 (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Llama-3.3-Nemotron-Super-49B v1.5 — https://artificialanalysis.ai/models/llama-nemotron-super-49b-v1-5-reasoning (Llama Nemotron Super 49B v1.5 (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- LongCat 2.0 — https://artificialanalysis.ai/models/longcat-2-0 (LongCat 2.0); null: speed/latency (AA has no measurement)
- Magistral Medium 1.2 — https://artificialanalysis.ai/models/magistral-medium-2509 (Magistral Medium 1.2, estimated); null: size (not published), price (AA lists none), speed/latency (AA has no measurement)
- Mercury 2 — https://artificialanalysis.ai/models/mercury-2 (Mercury 2, estimated); changed: speed, latency; null: size (not published)
- Mercury 2.5 — https://artificialanalysis.ai/models/mercury-2-5 (Mercury 2.5); changed: speed, latency; null: size (not published)
- MiMo-V2-Flash — https://artificialanalysis.ai/models/mimo-v2-flash-reasoning (MiMo-V2-Flash (Reasoning), estimated); null: speed/latency (AA has no measurement)
- MiMo-V2.6-Flash — https://artificialanalysis.ai/models/mimo-v2-6-flash (MiMo-V2.6-Flash); changed: intelligence, speed, latency, context; also newly listed by AA (was a non-AA row)
- MiMo-V2.6-Pro — https://artificialanalysis.ai/models/mimo-v2-6-pro (MiMo-V2.6-Pro); changed: speed, latency
- MiniCPM5-2B — https://artificialanalysis.ai/models/minicpm5-2b (MiniCPM5-2B); null: price (AA lists none), speed/latency (AA has no measurement)
- MiniMax M3 — https://artificialanalysis.ai/models/minimax-m3 (MiniMax-M3); changed: speed, latency; also ECI (Epoch)
- Mistral Large 3 — https://artificialanalysis.ai/models/mistral-large-3 (Mistral Large 3); changed: speed, latency
- Mistral Medium 3.1 — https://artificialanalysis.ai/models/mistral-medium-3-1 (Mistral Medium 3.1); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Mistral Medium 3.5 — https://artificialanalysis.ai/models/mistral-medium-3-5 (Mistral Medium 3.5); changed: speed, latency; also ECI (Epoch)
- Mistral Small 3.2 — https://artificialanalysis.ai/models/mistral-small-3-2 (Mistral Small 3.2, estimated); also ECI (Epoch); null: speed/latency (AA has no measurement)
- Mistral Small 4 — https://artificialanalysis.ai/models/mistral-small-4 (Mistral Small 4 (Reasoning)); changed: speed, latency
- Mixtral 8x22B — https://artificialanalysis.ai/models/mistral-8x22b-instruct (Mixtral 8x22B Instruct, estimated); also ECI (Epoch); null: price (AA lists none), speed/latency (AA has no measurement)
- Mixtral 8x7B — https://artificialanalysis.ai/models/mixtral-8x7b-instruct (Mixtral 8x7B Instruct, estimated); also ECI (Epoch); null: speed/latency (AA has no measurement)
- Motif 3 — https://artificialanalysis.ai/models/motif-3 (Motif 3, estimated); null: size (not published), price (AA lists none), speed/latency (AA has no measurement)
- Muse Glimmer — https://artificialanalysis.ai/models/muse-glimmer (Muse Glimmer (High)); changed: speed, latency
- Muse Spark — https://artificialanalysis.ai/models/muse-spark (Muse Spark, estimated); also ECI (Epoch); null: size (not published), price (AA lists none), speed/latency (AA has no measurement)
- Muse Spark 1.1 — https://artificialanalysis.ai/models/muse-spark-1-1 (Muse Spark 1.1 (Xhigh)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Muse Spark 1.2 — https://artificialanalysis.ai/models/muse-spark-1-2 (Muse Spark 1.2 (Xhigh)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Muse Spark 1.3 — https://artificialanalysis.ai/models/muse-spark-1-3 (Muse Spark 1.3 (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Nemotron 3 Nano 30B A3B — https://artificialanalysis.ai/models/nvidia-nemotron-3-nano-30b-a3b-reasoning (NVIDIA Nemotron 3 Nano 30B A3B (Reasoning)); changed: speed, latency
- Nemotron 3 Nano Omni 30B A3B — https://artificialanalysis.ai/models/nemotron-3-nano-omni-30b-a3b (Nemotron 3 Nano Omni 30B A3B Reasoning, estimated); changed: price, speed, latency
- Nemotron 3 Super 120B A12B — https://artificialanalysis.ai/models/nvidia-nemotron-3-super-120b-a12b (Nemotron 3 Super 120B A12B (Reasoning)); changed: speed, latency
- Nemotron 3 Ultra 550B A55B — https://artificialanalysis.ai/models/nvidia-nemotron-3-ultra-550b-a55b (Nemotron 3 Ultra 550B A55B (Reasoning)); changed: speed, latency; also ECI (Epoch)
- Nemotron 3.5 Lightning 30B A3B — https://artificialanalysis.ai/models/nemotron-3-5-lightning (Nemotron 3.5 Lightning); changed: price, speed, latency
- Nemotron Nano 9B v2 — https://artificialanalysis.ai/models/nvidia-nemotron-nano-9b-v2-reasoning (NVIDIA Nemotron Nano 9B V2 (Reasoning), estimated); changed: speed, latency
- North Mini Code — https://artificialanalysis.ai/models/north-mini-code (North Mini Code); changed: speed, latency
- Nova 2.0 Lite — https://artificialanalysis.ai/models/nova-2-0-lite-reasoning (Nova 2.0 Lite (High), estimated); changed: speed, latency; null: size (not published)
- Nova 2.0 Pro Preview — https://artificialanalysis.ai/models/nova-2-0-pro-reasoning-medium (Nova 2.0 Pro Preview (Medium), estimated); changed: speed, latency; null: size (not published)
- Nova Lite — https://artificialanalysis.ai/models/nova-lite (Nova Lite, estimated); changed: speed, latency; null: size (not published)
- Nova Micro — https://artificialanalysis.ai/models/nova-micro (Nova Micro, estimated); changed: speed, latency; null: size (not published)
- Nova Premier — https://artificialanalysis.ai/models/nova-premier (Nova Premier, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Nova Pro — https://artificialanalysis.ai/models/nova-pro (Nova Pro, estimated); also ECI (Epoch); null: size (not published), speed/latency (AA has no measurement)
- o3 — https://artificialanalysis.ai/models/o3 (o3, estimated); changed: speed, latency; also ECI (Epoch); null: size (not published)
- o3-mini — https://artificialanalysis.ai/models/o3-mini-high (o3-mini (High)); changed: intelligence, speed, latency; also variant: was "o3-mini", ECI (Epoch); null: size (not published)
- OLMo 3 32B Think — https://artificialanalysis.ai/models/olmo-3-32b-think (Olmo 3 32B Think, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- OLMo 3 7B Instruct — https://artificialanalysis.ai/models/olmo-3-7b-instruct (Olmo 3 7B Instruct, estimated); null: speed/latency (AA has no measurement)
- OLMo 3.1 32B Think — https://artificialanalysis.ai/models/olmo-3-1-32b-think (Olmo 3.1 32B Think, estimated); null: speed/latency (AA has no measurement)
- Opus 4.6 — https://artificialanalysis.ai/models/claude-opus-4-6-adaptive (Claude Opus 4.6 (Max), estimated); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Opus 4.7 — https://artificialanalysis.ai/models/claude-opus-4-7 (Claude Opus 4.7 (Max), estimated); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Opus 4.8 — https://artificialanalysis.ai/models/claude-opus-4-8 (Claude Opus 4.8 (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Opus 5 — https://artificialanalysis.ai/models/claude-opus-5 (Claude Opus 5 (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Opus 5.5 — https://artificialanalysis.ai/models/claude-opus-5-5 (Claude Opus 5.5 (Max, Default Fallback)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Phi-4 — https://artificialanalysis.ai/models/phi-4 (Phi-4, estimated); changed: speed, latency; also ECI (Epoch)
- Phi-4 Multimodal — https://artificialanalysis.ai/models/phi-4-multimodal (Phi-4 Multimodal Instruct, estimated); changed: speed, latency; null: size (not published), speed/latency (AA has no measurement)
- Quasar 438B — https://artificialanalysis.ai/models/quasar-438b (Quasar 438B (Max, Based on GLM-5.2)); changed: speed, latency
- Qwen2.5-72B — https://artificialanalysis.ai/models/qwen2-5-72b-instruct (Qwen2.5 Instruct 72B, estimated); also ECI (Epoch); null: speed/latency (AA has no measurement)
- Qwen2.5-Coder-32B — https://artificialanalysis.ai/models/qwen2-5-coder-32b-instruct (Qwen2.5 Coder Instruct 32B, estimated); also ECI (Epoch); null: price (AA lists none), speed/latency (AA has no measurement)
- Qwen3-14B — https://artificialanalysis.ai/models/qwen3-14b-instruct-reasoning (Qwen3 14B (Reasoning), estimated); changed: speed, latency; also ECI (Epoch)
- Qwen3-235B-A22B — https://artificialanalysis.ai/models/qwen3-235b-a22b-instruct-reasoning (Qwen3 235B A22B (Reasoning), estimated); changed: speed, latency; also ECI (Epoch)
- Qwen3-30B-A3B — https://artificialanalysis.ai/models/qwen3-30b-a3b-instruct-reasoning (Qwen3 30B A3B (Reasoning), estimated); changed: speed, latency; also ECI (Epoch)
- Qwen3-32B — https://artificialanalysis.ai/models/qwen3-32b-instruct-reasoning (Qwen3 32B (Reasoning), estimated); changed: speed; also ECI (Epoch)
- Qwen3-4B — https://artificialanalysis.ai/models/qwen3-4b-instruct-reasoning (Qwen3 4B (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Qwen3-8B — https://artificialanalysis.ai/models/qwen3-8b-instruct-reasoning (Qwen3 8B (Reasoning), estimated); changed: speed, latency; also ECI (Epoch)
- Qwen3-Coder-480B-A35B — https://artificialanalysis.ai/models/qwen3-coder-480b-a35b-instruct (Qwen3 Coder 480B A35B Instruct, estimated); changed: speed, latency
- Qwen3-VL-235B-A22B — https://artificialanalysis.ai/models/qwen3-vl-235b-a22b-reasoning (Qwen3 VL 235B A22B (Reasoning), estimated); changed: speed, latency
- Qwen3.7 Max — https://artificialanalysis.ai/models/qwen3-7-max (Qwen3.7 Max); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Qwen3.8 2.4T A95B — https://artificialanalysis.ai/models/qwen3-8-2-4t-a95b (Qwen3.8 2.4T A95B); changed: speed, latency, context
- Qwen3.8 27B — https://artificialanalysis.ai/models/qwen3-8-27b (Qwen3.8 27B (Xhigh)); changed: speed, latency; also ECI (Epoch)
- Qwen3.8 Max — https://artificialanalysis.ai/models/qwen3-8-max (Qwen3.8 Max (0902)); changed: speed, latency; also ECI (Epoch)
- Qwen3.8 Max (0803) — https://artificialanalysis.ai/models/qwen3-8-max-0803 (Qwen3.8 Max); changed: speed, latency; also ECI (Epoch)
- Qwen3.8-Flash-Next — https://artificialanalysis.ai/models/qwen3-8-flash-next (Qwen3.8-Flash-Next); changed: speed, latency
- QwQ-32B — https://artificialanalysis.ai/models/qwq-32b (QwQ 32B, estimated); also ECI (Epoch); null: speed/latency (AA has no measurement)
- Reka Flash 3 — https://artificialanalysis.ai/models/reka-flash-3 (Reka Flash 3, estimated); changed: speed, latency
- Sarvam 105B — https://artificialanalysis.ai/models/sarvam-105b (Sarvam 105B (High), estimated); null: speed/latency (AA has no measurement)
- Sarvam 30B — https://artificialanalysis.ai/models/sarvam-30b (Sarvam 30B (High), estimated); null: speed/latency (AA has no measurement)
- Sarvam-M — https://artificialanalysis.ai/models/sarvam-m-reasoning (Sarvam M (Reasoning, Based on Mistral Small 3.1), estimated); null: speed/latency (AA has no measurement)
- Snowflake Arctic — https://artificialanalysis.ai/models/arctic-instruct (Arctic Instruct, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Solar Open2 250B — https://artificialanalysis.ai/models/solar-open2-250b (Solar Open2 250B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Solar Pro 2 — https://artificialanalysis.ai/models/solar-pro-2-reasoning (Solar Pro 2 (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Solar Pro 3 — https://artificialanalysis.ai/models/solar-pro-3 (Solar Pro 3); changed: speed, latency; null: size (not published)
- Solar Pro 4 — https://artificialanalysis.ai/models/solar-pro4 (Solar Pro 4, estimated); changed: speed, latency; null: size (not published)
- Sonar — https://artificialanalysis.ai/models/sonar (Sonar, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Sonar Pro — https://artificialanalysis.ai/models/sonar-pro (Sonar Pro, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Sonar Reasoning Pro — https://artificialanalysis.ai/models/sonar-reasoning-pro (Sonar Reasoning Pro, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Sonnet 4.6 — https://artificialanalysis.ai/models/claude-sonnet-4-6-adaptive (Claude Sonnet 4.6 (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Sonnet 5 — https://artificialanalysis.ai/models/claude-sonnet-5 (Claude Sonnet 5 (Max)); changed: speed, latency; also ECI (Epoch); null: size (not published)
- Step 3.7 Flash — https://artificialanalysis.ai/models/step-3-7-flash (Step 3.7 Flash, estimated); changed: speed, latency
- Step 5 Preview — https://artificialanalysis.ai/models/step-5 (Step 5 Preview); changed: speed, latency; null: size (not published)

## Added from AA (7)

- Gemini 4 Argon — https://artificialanalysis.ai/models/gemini-4-argon (Gemini 4 Argon (High)); https://llm-stats.com/models/gemini-4-argon (rollout limited to the Fairwind trusted-tester program; introductory and later price per Google's launch blog as summarised there); null: size (not published), speed/latency (AA has no measurement)
- GPT-6.1 Sol — https://artificialanalysis.ai/models/gpt-6-1-sol (GPT-6.1 Sol (Max)); https://llm-stats.com/models/gpt-6.1-sol; ECI (Epoch); null: size (not published)
- Haiku 5.5 — https://artificialanalysis.ai/models/claude-haiku-5-5 (Claude Haiku 5.5 (Max)); https://llm-stats.com/models/claude-haiku-5-5; article /articles/claude-haiku-5-5; null: size (not published)
- Ling 3.1 Flash — https://artificialanalysis.ai/models/ling-3-1-flash (Ling 3.1 Flash); https://llm-stats.com/models/ling-3.1-flash (size ~560B/25B active; API only, weights not yet released)
- Mistral Large 4 Preview — https://artificialanalysis.ai/models/mistral-large-4 (Mistral Large 4 Preview); https://llm-stats.com/models/mistral-large-4 (1.05T/52B active per Mistral docs; weights promised for end of October); article /articles/mistral-large-4
- Solar Mini 4 — https://artificialanalysis.ai/models/solar-mini4 (Solar Mini 4); https://llm-stats.com/models/solar-mini4 (35B/3B active, proprietary)
- Sonnet 5.5 — https://artificialanalysis.ai/models/claude-sonnet-5-5 (Claude Sonnet 5.5 (Max, Default Fallback)); https://llm-stats.com/models/claude-sonnet-5-5; ECI (Epoch); null: size (not published)

## Added from other sources, not on AA (4)

- IQuest-Q1 — https://huggingface.co/IQuestLab/IQuest-Q1 (320B total, 15B active, 524,288 ctx, IQuest-Q1 licence = modified MIT; repo created 2026-09-28); article /articles/iquest-q1; origin "Other" (not stated by the source); null: intelligence/speed/latency (not on AA), price (none published)
- Kolibri-1 — https://huggingface.co/Aleph-Alpha/kolibri-1 (78.1B/3.46B active, Apache-2.0; context 262,144 from config.json `max_position_embeddings`, 1M is Aleph Alpha's extrapolation claim); released 2026-10-03 per the article; article /articles/kolibri-1; null: intelligence/speed/latency (not on AA), price (none published)
- Mellum2.1 — https://huggingface.co/JetBrains/Mellum2.1-12B-A2.5B-Thinking (12B/2.5B active, Apache-2.0, 131,072 ctx), https://blog.jetbrains.com/ai/2026/10/mellum2-1-gets-to-work-a-fast-open-model-for-coding-agents/ (released 2026-10-08); not on llm-stats; null: intelligence/speed/latency (not on AA), price (none published)
- Naive-N0.5-Flash — https://huggingface.co/NaiveAI/Naive-N0.5-Flash (309B/15.5B active, MIT, 1,048,576 ctx; repo created 2026-09-27), https://naive.ai/en/research/; article /articles/naive-n05-flash; origin "Other" (not stated by the source); null: intelligence/speed/latency (not on AA), price (none published)

## Removed/renamed

- Nothing removed: every model that carried an AA score in September is still on AA.
- MiMo-V2.6-Flash moved from the non-AA list to AA (above).
- AA renamed its variants (e.g. "Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback)" is now "Claude Opus 5.5 (Max, Default Fallback)"); notes use the new names. Rows keep their names.
- AA re-split two releases: "Kimi K2.6" and "EXAONE 4.5 33B" are now "(Reasoning)" variants of the same release. "o3-mini" is now shown as AA's "o3-mini (High)", the highest-effort variant the method calls for (the September row used AA's default-effort "o3-mini").
- Qwen3.8 Max: AA's variant slug `qwen3-8-max` is the 0902 version (release `qwen3-8-max-0902`), while its release slug `qwen3-8-max` is the 0803 version (variant `qwen3-8-max-0803`). Rows are matched by variant, so both read the same versions as in September.

## Not on AA, ECI added (3)

- Command R+ (08-2024) — Epoch ECI 119.34; nothing else changed
- Falcon-180B — Epoch ECI 112.13; nothing else changed
- Mistral NeMo 12B — Epoch ECI 118.68; nothing else changed

## Unchanged non-AA (58)

These were never AA-scored and AA still does not list them, so nothing was re-read: Agents-A1, Apple On-Device Foundation, Atria Dawn Preview, Audex, Bonsai 27B, Codestral Mamba 7B, Command R7B, Cosmos 3, ERNIE 5.1, Falcon-H1-34B, Gemini 3.5 Flash Cyber, Gemini 3.8 Flash Cyber, Gemma 4, GPT-5.6 Cyber, Hy4 preview, iFlytek Spark X1, iLLaDA, Intern-S2, KAT-Coder-V2.5, Kimi K2.8 Preview, Laguna M.1, Laguna S 2.1, Leanstral 1.5, LFM2.5-VL-3B, Llama 4 Behemoth, LOTUS, Mach-Mind-4-Flash, MAI-1-preview, MAI-Code-1.1-Flash, MAI-Thinking-1, Monolith 1.0, Motif 2.6B, MusaCoder, Nemotron NVFP4, Nemotron TwoTower, Nemotron-H 56B, North Micro Vision Instruct, Palmyra X5, Phi-3.5-MoE, Phi-4-reasoning-plus, Qwen-Audio-3.0-TTS, Qwen3.8-Omni-Flash, Ring-Zero, Sakana Fugu, Sakana Namazu, SmolLM3-3B, SOLAR-10.7B, Soofi S, SWE-1.7, TabFM, Tapered LM, Tinfield 1, Un-0, VideoChat3, Yi-1.5-34B, Yi-Lightning, Zamba2-7B, ZUNA 1.1.

## ECI matches left out

Epoch scores a different version than the row, so `eci` stays null: GPT-5.5 Instant (Epoch's is the May release; the row is AA's June 2026 version), Grok 4.3 (Epoch scores the April beta), Gemini 2.5 Flash and Gemini 2.5 Flash-Lite (Epoch has several dated previews; AA's row does not say which), Yi-1.5-34B (Epoch has Yi-34B, a different model). New releases Epoch has not scored yet: Haiku 5.5, Gemini 4 Argon, Mistral Large 4 Preview and others.

## Considered and left out

- GPT-6 Sol (Daybreak Blue, max) — a separate AA release (`gpt-6-sol-daybreak-blue`, 2026-09-22) with no Intelligence Index, speed or latency yet; a deployment variant of GPT-6 Sol, not a new model.
- interfaze-1-lite — a bundle, not a model: 76 of its 79 large files are byte-identical to eight public checkpoints (Qwen3.8-27B-FP8, Chandra OCR 2, Whisper large-v3 turbo, SAM 2.1, PaddleOCR…) wired together with a tool loop (/articles/interfaze-1-lite). Its LLM is already the Qwen3.8 27B row.
- Ember-1 (Fireworks AI, llm-stats `ember-1`, 2026-09-23) — a research-preview post-train of Kimi K3 that shortens reasoning traces; a derivative, same convention as the community fine-tunes below.
- GPT-Rosalind (llm-stats `gpt-rosalind-research`) — a trusted-access life-sciences model first released in April 2026; the Sep 11 change is general availability in that program, not a new model.
- MiMo-V2.6-Pro-MOPD / -Flash-MOPD (2026-09-27) — MOPD checkpoint upgrades of the same MiMo-V2.6 weights (https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-MOPD); folded into the existing rows. MiMo-V2.6-Distill-Qwen-9B is a distillation into Qwen, left out.
- Marin 535B-A23B (/articles/marin-535b) — a training run past its halfway mark, not a release.
- Spark-X2.5-4B (/articles/spark-x2-5-4b), Hunyuan-A13B (/articles/hunyuan-a13b), LensVLM-9B, Limite 1B Violetto — covered by articles since September, but released before this window (Spark-X in August, Hunyuan-A13B in 2025) or not general LLMs (LensVLM is a document VLM built on Qwen3.5; Violetto is a 1B math model).
- Decision models (Open d1, Jev and its alternatives) — not general LLMs; the page has no convention for them.
- AA releases from June–August not on the page (Qwen3.7 Plus, Nex-N2-Pro, DiffusionGemma 26B A4B, Kimi K2.7 Code, JT-4.1 Flash, Motif 3 Beta) — dated before September and not taken in the September curation; not re-litigated here.
- Community fine-tunes and quants the site has covered (Qwen3.8-2B-Distill, ThinkingCap-Qwen3.8-27B, Whittle MoE 27B, Penjing-27B, GLM-5.3-Flash-MLX / -Uncensored, altar-1, Project Maya and kaggle-tpu-320b which run GLM-5.3-Flash) — derivatives or deployments, not releases. Tinfield 1 stays the one exception.
- Checked and already on the page from September, so only re-read: Kimi K3, MiniMax M3, DeepSeek V4.1 Flash, GLM-5.3 and GLM-5.3 Flash, Muse Glimmer, Nemotron 3.5 Lightning (NVIDIA has released no other Nemotron 3.5 LLM size), MAI-Code-1.1-Flash (still not on AA), the Gemma 4 sizes (no new Gemma since June), and the Qwen3.8 sizes (Hugging Face has no Qwen3.8 weights beyond 2.4T-A95B, 27B and Flash-Next).
- Not found anywhere as of 2026-10-08: no GPT-6.1 Astra or Luna (only GPT-6.1 Sol), no Grok after 4.7, no Gemini 4 model besides Argon and no Gemma 5, on AA or llm-stats. Provider model pages were not re-read this time; the sweep used AA, llm-stats and Hugging Face.
