# In-browser models: the browser's own, or ours

**Status:** parked, researched 2026-10-07. The web search budget ran out during
the research, so Firefox and Safari were not checked; re-verify every status
line below before building.

## Question

Can readers' browsers answer questions on their own device, with a model the
browser ships or one we load, instead of calling our server?

## What exists

### Built into the browser (one shared model, nothing for us to host)

**Chrome: Gemini Nano** behind the built-in AI APIs
([overview](https://developer.chrome.com/docs/ai/built-in-apis),
[Prompt API](https://developer.chrome.com/docs/ai/prompt-api)):

| API | Status as documented |
|---|---|
| Translator, Language Detector, Summarizer | stable since Chrome 138 |
| Writer, Rewriter, Proofreader | developer trial |
| Prompt API (general prompting) | the two pages disagree: the Prompt API page (updated 2026-08-26) says web pages got it in Chrome 138, with an origin trial for `samplingMode`; the overview (updated 2025-09-12) lists "Chrome 148 stable (extensions only); origin trial for web". Feature-detect, don't assume. |

- Streaming (`promptStreaming`), output constrained by JSON Schema or regex
  (`responseConstraint`), image and audio input (audio needs a GPU), text
  output.
- Requirements: Windows 10/11, macOS 13+, Linux or Chromebook Plus; at least
  22 GB free on the profile volume; more than 4 GB VRAM, or 16 GB RAM and 4
  cores; an unmetered connection for the first download.
- "Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are
  not yet supported." Most phone readers will not have it.

**Edge: Phi-4-mini** behind the same `LanguageModel` API
([docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api),
updated 2026-10-06): developer preview in Canary/Dev only, behind a flag, from
138.0.3309.2. Needs 5.5 GB VRAM and 20 GB free disk. From 150.0.4070 a smaller
prerelease model, Aion-1.0-Instruct, runs on weaker GPUs or on CPU.

**Firefox, Safari:** not checked.

### Our own model, in any WebGPU browser

- **WebLLM** ([mlc-ai/web-llm](https://github.com/mlc-ai/web-llm)): Llama, Phi,
  Gemma, Mistral, Qwen (from 0.5B) entirely in the tab; OpenAI-compatible API,
  streaming, JSON mode; runs in a web or service worker.
- **transformers.js**: ONNX models on WebGPU or WASM. Already used on this
  site: `content/articles/jev-in-the-browser.mdx` loads a scorer on click.
- **Tiny task models** (28–250 KB, `content/articles/tiny-browser-models.mdx`):
  nearly free to ship, but each does one narrow job.
- Cost: a useful chat model is roughly 300 MB–1 GB per visitor on first use.
  Too heavy to push on someone reading an article; fine behind an explicit
  opt-in.

## Recommendation

1. **Default stays server-side** (`/api/ask`): grounded on the site's content,
   works on every device.
2. **Built-in fast path** where `LanguageModel` / `Summarizer` / `Translator`
   report `available`: instant, private, free quick actions on a passage
   (explain, summarise, translate), labelled "on-device". Questions that need
   the rest of the site still go to the server: a small local model knows only
   what is in its prompt.
3. **Later, optional:** a "run privately on my device" toggle using WebLLM with
   a small Qwen, downloaded only on request and cached.

Gemini Nano and Phi-4-mini are small: good at rewriting and summarising the
text they are given, weak at answering from knowledge. Keep them on
passage-level tasks.

## First consumer

[ask-ai-on-selection.md](ask-ai-on-selection.md).

## Before building

- Re-check every status line above (they move each Chrome release).
- Check Firefox and Safari.
- Measure on real hardware: time to first token and download size from
  `chrome://on-device-internals`; a WebLLM Qwen 0.5B/1.5B on a mid laptop and a
  phone.
- Decide the privacy copy for the "on-device" label.
