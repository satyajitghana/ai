"""Toy 3: compaction thresholds for every model in codex-rs/models-manager/models.json,
using the exact formulas read from protocol/src/openai_models.rs (resolved_context_window,
usable_context_window, auto_compact_token_limit) and core/src/session/context_window.rs.
Our arithmetic, not an execution of the Rust code."""
import json, sys
CATALOG = sys.argv[1]
d = json.load(open(CATALOG))
models = d["models"] if isinstance(d, dict) and "models" in d else d
rows = []
for m in models:
    cw, mx = m.get("context_window"), m.get("max_context_window")
    resolved = cw if cw is not None else mx
    pct = m.get("effective_context_window_percent", 95)
    cfg = m.get("auto_compact_token_limit")
    ctx_limit = (resolved * 9) // 10 if resolved is not None else None
    auto = (min(cfg, ctx_limit) if cfg is not None else ctx_limit) if ctx_limit is not None else cfg
    full = (resolved * pct) // 100 if resolved is not None else None
    tb = (m.get("model_messages") or {}).get("token_budget") or {}
    rows.append({
        "slug": m["slug"], "context_window": cw, "max_context_window": mx, "resolved": resolved,
        "effective_percent": pct, "auto_compact_limit": auto, "full_limit": full,
        "headroom_between": (full - auto) if full is not None and auto is not None else None,
        "use_responses_lite": m.get("use_responses_lite"), "tool_mode": m.get("tool_mode"),
        "supports_parallel_tool_calls": m.get("supports_parallel_tool_calls"),
        "truncation": m.get("truncation_policy"),
        "template_words": len(((m.get("model_messages") or {}).get("instructions_template") or "").split()),
        "token_budget_enabled": tb.get("enabled"), "fallback_buffer": tb.get("auto_compact_fallback_buffer_tokens"),
    })
json.dump(rows, open("toy3_compaction.json", "w"), indent=1)
print(f"{'slug':26} {'window':>8} {'auto90%':>9} {'full95%':>9} {'gap':>7} lite  tool_mode      words")
for r in rows:
    print(f"{r['slug']:26} {r['resolved']:>8} {r['auto_compact_limit']:>9} {r['full_limit']:>9} {r['headroom_between']:>7} {str(r['use_responses_lite']):5} {str(r['tool_mode']):14} {r['template_words']}")
