# /models sources — snapshot 2026-09-26

Provenance for `data/models.ts`. Plain list, one line per model that was added or changed in the September refresh.

- **AA**: every AA-measured value comes from one fetch of https://artificialanalysis.ai/leaderboards/models on 2026-09-26 (Intelligence Index v4.3), parsed from the per-model records in the page's Next.js payload. The per-model page is linked below by AA model slug; each line names the variant used (the highest-effort reasoning variant) and says when AA marks the score as estimated.
- **llm-stats**: https://llm-stats.com/ai-news and its JSON (https://api.zeroeval.com/leaderboard/models/list, `/leaderboard/models/<id>`) for the release sweep and for models AA does not list; the page URL is https://llm-stats.com/models/<id>.
- **Provider docs** used for the sweep: https://developers.openai.com/api/docs/models, https://platform.claude.com/docs/en/models/overview, https://docs.x.ai/docs/models, https://ai.google.dev/gemini-api/docs/models.
- `eci` is null everywhere except Kimi K3 (scaling01, carried over); Epoch was not re-fetched.

## Updated from AA (131)

Intelligence, price, speed, latency and context re-read from AA for all of these. "Also" lists other fields that changed.

- Apriel-1.6-15B-Thinker — https://artificialanalysis.ai/models/apriel-v1-6-15b-thinker (Apriel-v1.6-15B-Thinker, estimated); null: speed/latency (AA has no measurement)
- Command A — https://artificialanalysis.ai/models/command-a (Command A, estimated)
- DBRX Instruct — https://artificialanalysis.ai/models/dbrx (DBRX Instruct, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- DeepSeek V4 Flash — https://artificialanalysis.ai/models/deepseek-v4-flash-0420 (DeepSeek V4 Flash 0420 (Reasoning, Max Effort)); null: speed/latency (AA has no measurement)
- DeepSeek V4 Pro — https://artificialanalysis.ai/models/deepseek-v4-pro-0424 (DeepSeek V4 Pro 0424 (Reasoning, Max Effort))
- DeepSeek-R1-Distill-Llama-70B — https://artificialanalysis.ai/models/deepseek-r1-distill-llama-70b (DeepSeek R1 Distill Llama 70B, estimated); null: speed/latency (AA has no measurement)
- DeepSeek-R1-Distill-Qwen-32B — https://artificialanalysis.ai/models/deepseek-r1-distill-qwen-32b (DeepSeek R1 Distill Qwen 32B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Devstral 2 — https://artificialanalysis.ai/models/devstral-2 (Devstral 2); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- ERNIE 4.5 300B-A47B — https://artificialanalysis.ai/models/ernie-4-5-300b-a47b (ERNIE 4.5 300B A47B, estimated); null: speed/latency (AA has no measurement)
- EXAONE 4.0 32B — https://artificialanalysis.ai/models/exaone-4-0-32b-reasoning (EXAONE 4.0 32B (Reasoning), estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- EXAONE 4.5 33B — https://artificialanalysis.ai/models/exaone-4-5-33b (EXAONE 4.5 33B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Fable 5 — https://artificialanalysis.ai/models/claude-fable-5 (Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)); null: size (not published)
- Gemini 2.5 Flash — https://artificialanalysis.ai/models/gemini-2-5-flash-reasoning (Gemini 2.5 Flash (Reasoning), estimated); also released; null: size (not published)
- Gemini 2.5 Flash-Lite — https://artificialanalysis.ai/models/gemini-2-5-flash-lite-reasoning (Gemini 2.5 Flash-Lite (Reasoning), estimated); also released; null: size (not published)
- Gemini 2.5 Pro — https://artificialanalysis.ai/models/gemini-2-5-pro (Gemini 2.5 Pro); also released; null: size (not published)
- Gemini 3 Flash — https://artificialanalysis.ai/models/gemini-3-flash-reasoning (Gemini 3 Flash Preview (Reasoning), estimated); also released; null: size (not published)
- Gemini 3 Pro — https://artificialanalysis.ai/models/gemini-3-pro (Gemini 3 Pro Preview (high), estimated); also released; null: size (not published), speed/latency (AA has no measurement)
- Gemini 3.1 Flash-Lite — https://artificialanalysis.ai/models/gemini-3-1-flash-lite-preview (Gemini 3.1 Flash-Lite); null: size (not published)
- Gemini 3.1 Pro — https://artificialanalysis.ai/models/gemini-3-1-pro-preview (Gemini 3.1 Pro Preview); null: size (not published)
- Gemini 3.5 Flash — https://artificialanalysis.ai/models/gemini-3-5-flash (Gemini 3.5 Flash (high)); null: size (not published)
- Gemma 3 270M — https://artificialanalysis.ai/models/gemma-3-270m (Gemma 3 270M, estimated); also released; null: price (AA lists none), speed/latency (AA has no measurement)
- Gemma 3 27B — https://artificialanalysis.ai/models/gemma-3-27b (Gemma 3 27B Instruct); also released; null: speed/latency (AA has no measurement)
- Gemma 4 12B — https://artificialanalysis.ai/models/gemma-4-12b (Gemma 4 12B (Reasoning), estimated); also article
- Gemma 4 26B A4B — https://artificialanalysis.ai/models/gemma-4-26b-a4b (Gemma 4 26B A4B (Reasoning), estimated); also article; null: speed/latency (AA has no measurement)
- Gemma 4 31B — https://artificialanalysis.ai/models/gemma-4-31b (Gemma 4 31B (Reasoning), estimated); also article
- Gemma 4 E2B — https://artificialanalysis.ai/models/gemma-4-e2b (Gemma 4 E2B (Reasoning), estimated); also article; null: price (AA lists none), speed/latency (AA has no measurement)
- Gemma 4 E4B — https://artificialanalysis.ai/models/gemma-4-e4b (Gemma 4 E4B (Reasoning), estimated); also article
- GLM-5.2 — https://artificialanalysis.ai/models/glm-5-2 (GLM-5.2 (max))
- GPT-5.3 Codex — https://artificialanalysis.ai/models/gpt-5-3-codex (GPT-5.3 Codex (xhigh), estimated); also released; null: size (not published)
- GPT-5.5 — https://artificialanalysis.ai/models/gpt-5-5 (GPT-5.5 (xhigh)); null: size (not published)
- GPT-5.5 Instant — https://artificialanalysis.ai/models/gpt-5-5-instant-06-26 (GPT-5.5 Instant (June 2026)); null: size (not published)
- GPT-5.6 Luna — https://artificialanalysis.ai/models/gpt-5-6-luna (GPT-5.6 Luna (max)); null: size (not published)
- GPT-5.6 Sol — https://artificialanalysis.ai/models/gpt-5-6-sol (GPT-5.6 Sol (max)); null: size (not published)
- GPT-5.6 Terra — https://artificialanalysis.ai/models/gpt-5-6-terra (GPT-5.6 Terra (max)); null: size (not published)
- gpt-oss-120b — https://artificialanalysis.ai/models/gpt-oss-120b (gpt-oss-120b (high)); also released
- gpt-oss-20b — https://artificialanalysis.ai/models/gpt-oss-20b (gpt-oss-20b (high)); also released
- Granite 4.0 H Small — https://artificialanalysis.ai/models/granite-4-0-h-small (Granite 4.0 H Small, estimated)
- Granite 4.1 30B — https://artificialanalysis.ai/models/granite-4-1-30b (Granite 4.1 30B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Granite 4.1 3B — https://artificialanalysis.ai/models/granite-4-1-3b (Granite 4.1 3B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Granite 4.1 8B — https://artificialanalysis.ai/models/granite-4-1-8b (Granite 4.1 8B, estimated)
- Grok 4 — https://artificialanalysis.ai/models/grok-4 (Grok 4, estimated); null: size (not published), speed/latency (AA has no measurement)
- Grok 4 Fast — https://artificialanalysis.ai/models/grok-4-fast-reasoning (Grok 4 Fast (Reasoning), estimated); null: size (not published), speed/latency (AA has no measurement)
- Grok 4.1 Fast — https://artificialanalysis.ai/models/grok-4-1-fast-reasoning (Grok 4.1 Fast (Reasoning), estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Grok 4.20 — https://artificialanalysis.ai/models/grok-4-20 (Grok 4.20 0309 v2 (Reasoning), estimated); null: size (not published)
- Grok 4.3 — https://artificialanalysis.ai/models/grok-4-3 (Grok 4.3 (high)); null: size (not published)
- Grok 4.5 — https://artificialanalysis.ai/models/grok-4-5 (Grok 4.5 (high)); null: size (not published)
- Grok Build 0.1 — https://artificialanalysis.ai/models/grok-build-0-1-06-16 (Grok Build 0.1 0616, estimated); null: size (not published)
- Haiku 4.5 — https://artificialanalysis.ai/models/claude-4-5-haiku-reasoning (Claude 4.5 Haiku (Reasoning)); null: size (not published)
- Hermes 4 405B — https://artificialanalysis.ai/models/hermes-4-llama-3-1-405b-reasoning (Hermes 4 - Llama-3.1 405B (Reasoning), estimated)
- Hermes 4 70B — https://artificialanalysis.ai/models/hermes-4-llama-3-1-70b-reasoning (Hermes 4 - Llama-3.1 70B (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Hunyuan Hy3 — https://artificialanalysis.ai/models/hy3 (Hy3)
- HyperCLOVA X SEED Think 32B — https://artificialanalysis.ai/models/hyperclova-x-seed-think-32b (HyperCLOVA X SEED Think (32B), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Inkling — https://artificialanalysis.ai/models/inkling (Inkling (xhigh)); also released
- Jamba 1.6 Mini — https://artificialanalysis.ai/models/jamba-1-6-mini (Jamba 1.6 Mini, estimated); also released; null: size (not stated by a source), price (AA lists none), speed/latency (AA has no measurement)
- Jamba 1.7 Large — https://artificialanalysis.ai/models/jamba-1-7-large (Jamba 1.7 Large, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- Jamba Mini 1.7 — https://artificialanalysis.ai/models/jamba-1-7-mini (Jamba 1.7 Mini, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- Kimi K2.6 — https://artificialanalysis.ai/models/kimi-k2-6 (Kimi K2.6)
- Kimi K3 — https://artificialanalysis.ai/models/kimi-k3 (Kimi K3 (max))
- LFM2-2.6B — https://artificialanalysis.ai/models/lfm2-2-6b (LFM2 2.6B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- LFM2.5-8B-A1B — https://artificialanalysis.ai/models/lfm2-5-8b-a1b (LFM2.5-8B-A1B, estimated); also released; null: price (AA lists none), speed/latency (AA has no measurement)
- LFM2.5-VL-1.6B — https://artificialanalysis.ai/models/lfm2-5-vl-1-6b (LFM2.5-VL-1.6B, estimated); also released; null: price (AA lists none), speed/latency (AA has no measurement)
- Llama 3.1 405B — https://artificialanalysis.ai/models/llama-3-1-instruct-405b (Llama 3.1 Instruct 405B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Llama 3.1 8B — https://artificialanalysis.ai/models/llama-3-1-instruct-8b (Llama 3.1 Instruct 8B, estimated)
- Llama 3.2 3B — https://artificialanalysis.ai/models/llama-3-2-instruct-3b (Llama 3.2 Instruct 3B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Llama 3.3 70B — https://artificialanalysis.ai/models/llama-3-3-instruct-70b (Llama 3.3 Instruct 70B, estimated)
- Llama 4 Maverick — https://artificialanalysis.ai/models/llama-4-maverick (Llama 4 Maverick, estimated)
- Llama 4 Scout — https://artificialanalysis.ai/models/llama-4-scout (Llama 4 Scout, estimated)
- Llama-3.1-Nemotron-Ultra-253B — https://artificialanalysis.ai/models/llama-3-1-nemotron-ultra-253b-v1-reasoning (Llama 3.1 Nemotron Ultra 253B v1 (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Llama-3.3-Nemotron-Super-49B v1.5 — https://artificialanalysis.ai/models/llama-nemotron-super-49b-v1-5-reasoning (Llama Nemotron Super 49B v1.5 (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- LongCat 2.0 — https://artificialanalysis.ai/models/longcat-2-0 (LongCat 2.0); also released; null: speed/latency (AA has no measurement)
- Magistral Medium 1.2 — https://artificialanalysis.ai/models/magistral-medium-2509 (Magistral Medium 1.2, estimated); also released; null: size (not published), price (AA lists none), speed/latency (AA has no measurement)
- Mercury 2 — https://artificialanalysis.ai/models/mercury-2 (Mercury 2, estimated); null: size (not published)
- MiMo-V2-Flash — https://artificialanalysis.ai/models/mimo-v2-flash-reasoning (MiMo-V2-Flash (Reasoning), estimated); also released; null: speed/latency (AA has no measurement)
- MiniMax M3 — https://artificialanalysis.ai/models/minimax-m3 (MiniMax-M3)
- Mistral Large 3 — https://artificialanalysis.ai/models/mistral-large-3 (Mistral Large 3)
- Mistral Medium 3.1 — https://artificialanalysis.ai/models/mistral-medium-3-1 (Mistral Medium 3.1); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Mistral Medium 3.5 — https://artificialanalysis.ai/models/mistral-medium-3-5 (Mistral Medium 3.5)
- Mistral Small 3.2 — https://artificialanalysis.ai/models/mistral-small-3-2 (Mistral Small 3.2, estimated); null: speed/latency (AA has no measurement)
- Mistral Small 4 — https://artificialanalysis.ai/models/mistral-small-4 (Mistral Small 4 (Reasoning))
- Mixtral 8x22B — https://artificialanalysis.ai/models/mistral-8x22b-instruct (Mixtral 8x22B Instruct, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Mixtral 8x7B — https://artificialanalysis.ai/models/mixtral-8x7b-instruct (Mixtral 8x7B Instruct, estimated); null: speed/latency (AA has no measurement)
- Muse Spark — https://artificialanalysis.ai/models/muse-spark (Muse Spark, estimated); null: size (not published), price (AA lists none), speed/latency (AA has no measurement)
- Muse Spark 1.1 — https://artificialanalysis.ai/models/muse-spark-1-1 (Muse Spark 1.1 (xhigh)); null: size (not published), speed/latency (AA has no measurement)
- Nemotron 3 Nano 30B A3B — https://artificialanalysis.ai/models/nvidia-nemotron-3-nano-30b-a3b-reasoning (NVIDIA Nemotron 3 Nano 30B A3B (Reasoning))
- Nemotron 3 Nano Omni 30B A3B — https://artificialanalysis.ai/models/nemotron-3-nano-omni-30b-a3b (Nemotron 3 Nano Omni 30B A3B Reasoning, estimated)
- Nemotron 3 Super 120B A12B — https://artificialanalysis.ai/models/nvidia-nemotron-3-super-120b-a12b (Nemotron 3 Super 120B A12B (Reasoning))
- Nemotron 3 Ultra 550B A55B — https://artificialanalysis.ai/models/nvidia-nemotron-3-ultra-550b-a55b (Nemotron 3 Ultra 550B A55B (Reasoning))
- Nemotron Nano 9B v2 — https://artificialanalysis.ai/models/nvidia-nemotron-nano-9b-v2-reasoning (NVIDIA Nemotron Nano 9B V2 (Reasoning), estimated)
- North Mini Code — https://artificialanalysis.ai/models/north-mini-code (North Mini Code)
- Nova 2.0 Lite — https://artificialanalysis.ai/models/nova-2-0-lite-reasoning (Nova 2.0 Lite (high), estimated); null: size (not published)
- Nova 2.0 Pro Preview — https://artificialanalysis.ai/models/nova-2-0-pro-reasoning-medium (Nova 2.0 Pro Preview (medium), estimated); null: size (not published)
- Nova Lite — https://artificialanalysis.ai/models/nova-lite (Nova Lite, estimated); null: size (not published)
- Nova Micro — https://artificialanalysis.ai/models/nova-micro (Nova Micro, estimated); null: size (not published)
- Nova Premier — https://artificialanalysis.ai/models/nova-premier (Nova Premier, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Nova Pro — https://artificialanalysis.ai/models/nova-pro (Nova Pro, estimated); null: size (not published), speed/latency (AA has no measurement)
- o3 — https://artificialanalysis.ai/models/o3 (o3, estimated); also released; null: size (not published)
- o3-mini — https://artificialanalysis.ai/models/o3-mini (o3-mini, estimated); also released; null: size (not published)
- OLMo 3 32B Think — https://artificialanalysis.ai/models/olmo-3-32b-think (Olmo 3 32B Think, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: speed/latency (AA has no measurement)
- OLMo 3 7B Instruct — https://artificialanalysis.ai/models/olmo-3-7b-instruct (Olmo 3 7B Instruct, estimated); null: speed/latency (AA has no measurement)
- OLMo 3.1 32B Think — https://artificialanalysis.ai/models/olmo-3-1-32b-think (Olmo 3.1 32B Think, estimated); null: speed/latency (AA has no measurement)
- Opus 4.6 — https://artificialanalysis.ai/models/claude-opus-4-6-adaptive (Claude Opus 4.6 (Adaptive Reasoning, Max Effort), estimated); null: size (not published)
- Opus 4.7 — https://artificialanalysis.ai/models/claude-opus-4-7 (Claude Opus 4.7 (Adaptive Reasoning, Max Effort), estimated); null: size (not published)
- Opus 4.8 — https://artificialanalysis.ai/models/claude-opus-4-8 (Claude Opus 4.8 (Adaptive Reasoning, Max Effort)); null: size (not published)
- Phi-4 — https://artificialanalysis.ai/models/phi-4 (Phi-4, estimated)
- Phi-4 Multimodal — https://artificialanalysis.ai/models/phi-4-multimodal (Phi-4 Multimodal Instruct, estimated); also released; null: size (not stated by a source)
- Qwen2.5-72B — https://artificialanalysis.ai/models/qwen2-5-72b-instruct (Qwen2.5 Instruct 72B, estimated); null: speed/latency (AA has no measurement)
- Qwen2.5-Coder-32B — https://artificialanalysis.ai/models/qwen2-5-coder-32b-instruct (Qwen2.5 Coder Instruct 32B, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Qwen3-14B — https://artificialanalysis.ai/models/qwen3-14b-instruct-reasoning (Qwen3 14B (Reasoning), estimated)
- Qwen3-235B-A22B — https://artificialanalysis.ai/models/qwen3-235b-a22b-instruct-reasoning (Qwen3 235B A22B (Reasoning), estimated)
- Qwen3-30B-A3B — https://artificialanalysis.ai/models/qwen3-30b-a3b-instruct-reasoning (Qwen3 30B A3B (Reasoning), estimated)
- Qwen3-32B — https://artificialanalysis.ai/models/qwen3-32b-instruct-reasoning (Qwen3 32B (Reasoning), estimated)
- Qwen3-4B — https://artificialanalysis.ai/models/qwen3-4b-instruct-reasoning (Qwen3 4B (Reasoning), estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Qwen3-8B — https://artificialanalysis.ai/models/qwen3-8b-instruct-reasoning (Qwen3 8B (Reasoning), estimated)
- Qwen3-Coder-480B-A35B — https://artificialanalysis.ai/models/qwen3-coder-480b-a35b-instruct (Qwen3 Coder 480B A35B Instruct, estimated)
- Qwen3-VL-235B-A22B — https://artificialanalysis.ai/models/qwen3-vl-235b-a22b-reasoning (Qwen3 VL 235B A22B (Reasoning), estimated)
- Qwen3.7 Max — https://artificialanalysis.ai/models/qwen3-7-max (Qwen3.7 Max); null: size (not published)
- Qwen3.8 Max — https://artificialanalysis.ai/models/qwen3-8-max (Qwen3.8 Max (0902)); also released, article
- QwQ-32B — https://artificialanalysis.ai/models/qwq-32b (QwQ 32B, estimated); null: speed/latency (AA has no measurement)
- Reka Flash 3 — https://artificialanalysis.ai/models/reka-flash-3 (Reka Flash 3, estimated); null: speed/latency (AA has no measurement)
- Sarvam 105B — https://artificialanalysis.ai/models/sarvam-105b (Sarvam 105B (high), estimated); null: speed/latency (AA has no measurement)
- Sarvam 30B — https://artificialanalysis.ai/models/sarvam-30b (Sarvam 30B (high), estimated); null: speed/latency (AA has no measurement)
- Sarvam-M — https://artificialanalysis.ai/models/sarvam-m-reasoning (Sarvam M (Reasoning, based on Mistral Small 3.1), estimated); null: speed/latency (AA has no measurement)
- Snowflake Arctic — https://artificialanalysis.ai/models/arctic-instruct (Arctic Instruct, estimated); null: price (AA lists none), speed/latency (AA has no measurement)
- Solar Pro 2 — https://artificialanalysis.ai/models/solar-pro-2-reasoning (Solar Pro 2 (Reasoning), estimated); also released, open weights; null: price (AA lists none), speed/latency (AA has no measurement)
- Solar Pro 3 — https://artificialanalysis.ai/models/solar-pro-3 (Solar Pro 3); null: size (not published)
- Sonar — https://artificialanalysis.ai/models/sonar (Sonar, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Sonar Pro — https://artificialanalysis.ai/models/sonar-pro (Sonar Pro, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Sonar Reasoning Pro — https://artificialanalysis.ai/models/sonar-reasoning-pro (Sonar Reasoning Pro, estimated); list price kept from the Jul 2026 snapshot (AA lists none); null: size (not published), speed/latency (AA has no measurement)
- Sonnet 4.6 — https://artificialanalysis.ai/models/claude-sonnet-4-6-adaptive (Claude Sonnet 4.6 (Adaptive Reasoning, Max Effort)); null: size (not published)
- Sonnet 5 — https://artificialanalysis.ai/models/claude-sonnet-5 (Claude Sonnet 5 (Adaptive Reasoning, Max Effort)); null: size (not published)
- Step 3.7 Flash — https://artificialanalysis.ai/models/step-3-7-flash (Step 3.7 Flash, estimated)

## Added from AA (54)

- A.X-K2 — https://artificialanalysis.ai/models/a-x-k2 (A.X-K2, estimated); article /articles/ax-k2; null: price (AA lists none), speed/latency (AA has no measurement)
- Apodex 1.1 — https://artificialanalysis.ai/models/apodex-1-1 (Apodex 1.1); article /articles/apodex-frontier-agent; null: size (not published), speed/latency (AA has no measurement)
- Celeris-1 — https://artificialanalysis.ai/models/celeris-1 (Celeris-1); null: size (not published)
- DeepSeek V4 Flash 0731 — https://artificialanalysis.ai/models/deepseek-v4-flash (DeepSeek V4 Flash 0731 (Reasoning, Max Effort)); https://llm-stats.com/models/deepseek-v4-flash-0731
- DeepSeek V4 Flash Vision — https://artificialanalysis.ai/models/deepseek-v4-flash-vision (DeepSeek V4 Flash Vision (Reasoning, Max Effort)); https://llm-stats.com/models/deepseek-v4-flash-vision-exp, https://api-docs.deepseek.com/updates/; null: size (not published)
- DeepSeek V4 Pro 0813 — https://artificialanalysis.ai/models/deepseek-v4-pro (DeepSeek V4 Pro 0813 (Reasoning, Max Effort)); https://llm-stats.com/models/deepseek-v4-pro-0813
- DeepSeek V4.1 Flash — https://artificialanalysis.ai/models/deepseek-v4-1-flash (DeepSeek V4.1 Flash (Reasoning, Max Effort)); https://llm-stats.com/models/deepseek-v4.1-flash, https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash
- Fable 5.1 — https://artificialanalysis.ai/models/claude-fable-5-1 (Claude Fable 5.1 (Adaptive Reasoning, Max Effort, Default Fallback)); https://platform.claude.com/docs/en/models/overview, https://llm-stats.com/models/claude-mythos-5-1; null: size (not published)
- G9v3-39A5B — https://artificialanalysis.ai/models/g9v3-39a5b (G9v3-39A5B, estimated); https://huggingface.co/ai9stars; null: speed/latency (AA has no measurement)
- G9v3-3B — https://artificialanalysis.ai/models/g9v3-3b (G9v3-3B, estimated); https://huggingface.co/ai9stars; null: speed/latency (AA has no measurement)
- Gemini 3.5 Flash-Lite — https://artificialanalysis.ai/models/gemini-3-5-flash-lite (Gemini 3.5 Flash-Lite); https://ai.google.dev/gemini-api/docs/models; null: size (not published)
- Gemini 3.6 Flash — https://artificialanalysis.ai/models/gemini-3-6-flash (Gemini 3.6 Flash (high)); https://ai.google.dev/gemini-api/docs/models; null: size (not published)
- Gemini 3.7 Flash — https://artificialanalysis.ai/models/gemini-3-7-flash (Gemini 3.7 Flash (high)); https://ai.google.dev/gemini-api/docs/models; null: size (not published)
- Gemini 3.8 Flash — https://artificialanalysis.ai/models/gemini-3-8-flash (Gemini 3.8 Flash (high)); https://ai.google.dev/gemini-api/docs/models; null: size (not published)
- GLM-5.3 — https://artificialanalysis.ai/models/glm-5-3 (GLM-5.3 (max)); https://llm-stats.com/models/glm-5.3, https://huggingface.co/zai-org/GLM-5.3; article /articles/glm-5-3
- GLM-5.3 Flash — https://artificialanalysis.ai/models/glm-5-3-flash (GLM 5.3 Flash); https://llm-stats.com/models/glm-5.3-flash, https://huggingface.co/zai-org/GLM-5.3-Flash; article /articles/glm-5-3-flash
- GPT-6 Astra — https://artificialanalysis.ai/models/gpt-6-astra (GPT-6 Astra (max)); https://developers.openai.com/api/docs/models; null: size (not published)
- GPT-6 Luna — https://artificialanalysis.ai/models/gpt-6-luna (GPT-6 Luna (max)); https://developers.openai.com/api/docs/models; null: size (not published)
- GPT-6 Sol — https://artificialanalysis.ai/models/gpt-6-sol (GPT-6 Sol (max)); https://developers.openai.com/api/docs/models; null: size (not published)
- Granite 4.2 30B — https://artificialanalysis.ai/models/granite-4-2-30b (Granite 4.2 30B, estimated); https://llm-stats.com/models/granite-4.2-30b
- Granite 4.2 3B — https://artificialanalysis.ai/models/granite-4-2-3b (Granite 4.2 3B); https://llm-stats.com/models/granite-4.2-3b
- Granite 4.2 8B — https://artificialanalysis.ai/models/granite-4-2-8b (Granite 4.2 8B); https://llm-stats.com/models/granite-4.2-8b
- Grok 4.6 — https://artificialanalysis.ai/models/grok-4-6-xhigh (Grok 4.6 (xhigh)); https://docs.x.ai/docs/models; null: size (not published)
- Grok 4.7 — https://artificialanalysis.ai/models/grok-4-7 (Grok 4.7 (xhigh)); https://docs.x.ai/docs/models; null: size (not published)
- Inkling Small — https://artificialanalysis.ai/models/inkling-small (Inkling Small, estimated); https://llm-stats.com/models/inkling-small; article /articles/inkling-small
- K-EXAONE 2.0 — https://artificialanalysis.ai/models/k-exaone-2-0-0803 (K-EXAONE 2.0 0803, estimated); null: size (not stated by a source), price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon 0.9B — https://artificialanalysis.ai/models/k2-horizon-0-9b (K2 Horizon 0.9B); null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon 3.7B — https://artificialanalysis.ai/models/k2-horizon-3-7b (K2 Horizon 3.7B); null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon 375B A23B — https://artificialanalysis.ai/models/k2-horizon-375b-a23b (K2 Horizon 375B A23B); null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon 7B — https://artificialanalysis.ai/models/k2-horizon-7b (K2 Horizon 7B); null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon MoVA 36B A4B — https://artificialanalysis.ai/models/k2-horizon-mova-36b-a4b (K2 Horizon MoVA 36B A4B); https://huggingface.co/IFM/K2-Horizon-MoVA-36B-A4B; article /articles/k2-horizon-mova; null: price (AA lists none), speed/latency (AA has no measurement)
- K2 Horizon origin (all five rows: provider "MBZUAI IFM", origin UAE) — the Institute of Foundation Models is MBZUAI's: https://mbzuai.ac.ae/research/our-institutes-centers/institute-foundation-models ; launch: https://mbzuai.ac.ae/news/mbzuais-institute-of-foundation-models-launches-k2-horizon-the-worlds-largest-fully-open-ai-models-in-history/
- LFM2.5-2.6B — https://artificialanalysis.ai/models/lfm2-5-2-6b (LFM2.5-2.6B, estimated); https://llm-stats.com/models/lfm-2.5-2.6b; null: speed/latency (AA has no measurement)
- Ling 3.0 Flash — https://artificialanalysis.ai/models/ling-3-0-flash (Ling 3.0 Flash, estimated); https://llm-stats.com/models/ling-3.0-flash; article /articles/ling-3-0-flash
- Ling 3.0 Flash Fin — https://artificialanalysis.ai/models/ling-3-0-flash-fin (Ling-3.0-flash-Fin); https://llm-stats.com/models/ling-3.0-flash-fin; article /articles/ling-3-0-flash-fin
- Ling 3.0 Flash VL — https://artificialanalysis.ai/models/ling-3-0-flash-vl (Ling-3.0-flash-VL); null: size (not stated by a source)
- Ling 3.0 Tiny — https://artificialanalysis.ai/models/ling-3-0-tiny (Ling 3.0 Tiny, estimated); null: size (not stated by a source)
- Mercury 2.5 — https://artificialanalysis.ai/models/mercury-2-5 (Mercury 2.5); null: size (not published)
- MiMo-V2.6-Pro — https://artificialanalysis.ai/models/mimo-v2-6-pro (MiMo-V2.6-Pro); https://llm-stats.com/models/mimo-v2.6-pro, https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL; article /articles/mimo-v2-6
- MiniCPM5-2B — https://artificialanalysis.ai/models/minicpm5-2b (MiniCPM5-2B); https://huggingface.co/openbmb/MiniCPM5-2B; article /articles/minicpm5-2b; null: price (AA lists none), speed/latency (AA has no measurement)
- Motif 3 — https://artificialanalysis.ai/models/motif-3 (Motif 3, estimated); null: size (not stated by a source), price (AA lists none), speed/latency (AA has no measurement)
- Muse Glimmer — https://artificialanalysis.ai/models/muse-glimmer (Muse Glimmer (high)); https://huggingface.co/meta-models/Muse-Glimmer-30B; article /articles/muse-glimmer
- Muse Spark 1.2 — https://artificialanalysis.ai/models/muse-spark-1-2 (Muse Spark 1.2 (xhigh)); null: size (not published)
- Muse Spark 1.3 — https://artificialanalysis.ai/models/muse-spark-1-3 (Muse Spark 1.3 (max)); null: size (not published)
- Nemotron 3.5 Lightning 30B A3B — https://artificialanalysis.ai/models/nemotron-3-5-lightning (Nemotron 3.5 Lightning); https://llm-stats.com/models/nemotron-3.5-lightning-30b-a3b
- Opus 5 — https://artificialanalysis.ai/models/claude-opus-5 (Claude Opus 5 (Adaptive Reasoning, Max Effort)); null: size (not published)
- Opus 5.5 — https://artificialanalysis.ai/models/claude-opus-5-5 (Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback)); https://platform.claude.com/docs/en/models/overview; null: size (not published), speed/latency (AA has no measurement)
- Quasar 438B — https://artificialanalysis.ai/models/quasar-438b (Quasar 438B (max, based on GLM-5.2))
- Qwen3.8 2.4T A95B — https://artificialanalysis.ai/models/qwen3-8-2-4t-a95b (Qwen3.8 2.4T A95B); https://llm-stats.com/models/qwen3.8-2.4t-a95b, https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B; article /articles/qwen3-8-open-weights
- Qwen3.8 27B — https://artificialanalysis.ai/models/qwen3-8-27b (Qwen3.8 27B (xhigh)); https://llm-stats.com/models/qwen3.8-27b, https://huggingface.co/Qwen/Qwen3.8-27B; article /articles/qwen3-8-27b-variants
- Qwen3.8 Max (0803) — https://artificialanalysis.ai/models/qwen3-8-max-0803 (Qwen3.8 Max); https://llm-stats.com/models/qwen3.8-max; article /articles/qwen3-8-max
- Qwen3.8-Flash-Next — https://artificialanalysis.ai/models/qwen3-8-flash-next (Qwen3.8-Flash-Next); https://llm-stats.com/models/qwen3.8-flash-next, https://llm-stats.com/models/qwen3.8-flash; article /articles/qwen3-8-flash-next
- Solar Open2 250B — https://artificialanalysis.ai/models/solar-open2-250b (Solar Open2 250B, estimated); https://huggingface.co/upstage/Solar-Open2-250B; article /articles/solar-open2-250b; null: price (AA lists none), speed/latency (AA has no measurement)
- Solar Pro 4 — https://artificialanalysis.ai/models/solar-pro4 (Solar Pro 4, estimated); https://llm-stats.com/models/solar-pro4; null: size (not published)
- Step 5 Preview — https://artificialanalysis.ai/models/step-5 (Step 5 Preview); null: size (not published)

## Added from other sources, not on AA (14)

- Atria Dawn Preview — https://llm-stats.com/models/atria-dawn-preview, https://huggingface.co/internlm/Atria-Dawn-Preview; null: intelligence/speed/latency (not on AA), price (none published)
- Gemini 3.5 Flash Cyber — https://llm-stats.com/models/gemini-3.5-flash-cyber; null: size (not published), intelligence/speed/latency (not on AA), price (none published), context (not stated)
- Gemini 3.8 Flash Cyber — https://llm-stats.com/models/gemini-3.8-flash-cyber; null: size (not published), intelligence/speed/latency (not on AA), price (none published), context (not stated)
- GPT-5.6 Cyber — https://llm-stats.com/models/gpt-5.6-cyber, https://developers.openai.com/api/docs/models/gpt-5.6-cyber; null: size (not published), intelligence/speed/latency (not on AA)
- Hy4 preview — https://llm-stats.com/models/hy4-preview, https://huggingface.co/tencent/Hy4-preview; article /articles/hy4-preview; null: intelligence/speed/latency (not on AA), price (none published)
- Kimi K2.8 Preview — https://llm-stats.com/models/kimi-k2.8, https://www.kimi.com/code/docs/en/kimi-code/models.html; null: size (not published), intelligence/speed/latency (not on AA), price (none published)
- Laguna S 2.1 — https://llm-stats.com/models/laguna-s-2.1, https://poolside.ai/blog/introducing-laguna-s-2-1; article /articles/laguna-s-2-1; null: intelligence/speed/latency (not on AA)
- LFM2.5-VL-3B — https://llm-stats.com/models/lfm-2.5-vl-3b, https://huggingface.co/LiquidAI/LFM2.5-VL-3B; article /articles/lfm2-5-vl-3b; null: intelligence/speed/latency (not on AA), price (none published)
- MAI-Code-1.1-Flash — https://llm-stats.com/models/mai-code-1.1-flash, https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing; null: intelligence/speed/latency (not on AA)
- MiMo-V2.6-Flash — https://llm-stats.com/models/mimo-v2.6-flash, https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL; article /articles/mimo-v2-6; null: intelligence/speed/latency (not on AA)
- North Micro Vision Instruct — https://llm-stats.com/models/north-micro-vision-instruct, https://huggingface.co/CohereLabs/North-Micro-Vision-Instruct; null: intelligence/speed/latency (not on AA), price (none published)
- Qwen3.8-Omni-Flash — https://qwen.ai/blog?id=qwen3.8-omni-flash, https://www.alibabacloud.com/help/en/model-studio/model-pricing; article /articles/qwen3-8-omni-flash; null: size (not published), intelligence/speed/latency (not on AA), released (no dated source)
- Sakana Namazu — https://llm-stats.com/models/sakana-namazu, https://sakana.ai/namazu-api/; null: size (not published), intelligence/speed/latency (not on AA)
- Tinfield 1 — https://huggingface.co/badtheorylabs/Tinfield-1; article /articles/tinfield-1; null: intelligence/speed/latency (not on AA), price (none published), context (not stated)

## Not on AA, left as they were (48)

These were never AA-scored and AA still does not list them, so nothing was re-read: Agents-A1, Apple On-Device Foundation, Audex, Bonsai 27B, Codestral Mamba 7B, Command R+ (08-2024), Command R7B, Cosmos 3, ERNIE 5.1, Falcon-180B, Falcon-H1-34B, Gemma 4, iFlytek Spark X1, iLLaDA, Intern-S2, KAT-Coder-V2.5, Laguna M.1, Leanstral 1.5, Llama 4 Behemoth, LOTUS, Mach-Mind-4-Flash, MAI-1-preview, MAI-Thinking-1, Mistral NeMo 12B, Monolith 1.0, Motif 2.6B, MusaCoder, Nemotron NVFP4, Nemotron TwoTower, Nemotron-H 56B, Palmyra X5, Phi-3.5-MoE, Phi-4-reasoning-plus, Qwen-Audio-3.0-TTS, Ring-Zero, Sakana Fugu, SmolLM3-3B, SOLAR-10.7B, Soofi S, SWE-1.7, TabFM, Tapered LM, Un-0, VideoChat3, Yi-1.5-34B, Yi-Lightning, Zamba2-7B, ZUNA 1.1.

No model that carried an AA score in July has dropped off AA.

## Considered and left out

- Claude Mythos 5.1 — the trusted-access deployment of the Fable 5.1 weights (llm-stats `claude-mythos-5-1`); noted on the Fable 5.1 row instead.
- Qwen3.8 Flash — the QwenCloud API name for Qwen3.8-Flash-Next (llm-stats `qwen3.8-flash`); folded into that row.
- Qwen3.8 Max 0803 vs 0902 — both are AA rows; "Qwen3.8 Max" is the 0902 version, dated 2026-09 (it was a July preview entry with no scores).
- Shieldstral 1.0 3B (Mistral, safety classifier), Cohere Parse (document parser), MiniMax H3 (video generator) — not general language models.
- Community fine-tunes and quants the site has covered (Qwen3.8-2B-Distill, ThinkingCap-Qwen3.8-27B, Whittle MoE 27B, GLM-5.3-Flash-MLX / -Uncensored, altar-1) — derivatives, not releases. Tinfield 1 is the one exception, as a named notable release.
- Rigel (open-lm-engine, 2.3B research base model) — no dated release to cite.
- Not found anywhere as of 2026-09-26: no GPT-6 mini, instant or codex (OpenAI's model page lists only Astra, Sol and Luna), no new Sonnet or Haiku (Anthropic lists Sonnet 5 and Haiku 4.5), no Grok 4.6/4.7 Fast or Build (xAI lists grok-build-0.1 from June), no Qwen3.8 Plus, and no Gemma since June, on AA or llm-stats.
