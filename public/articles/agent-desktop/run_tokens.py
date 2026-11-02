"""Measure what each `snapshot` flag costs in tokens on two synthetic trees, using our port of the ref allocator.

Needs: `pip install tokenizers`, and Qwen3's tokenizer file, e.g.
  curl -L -o tokenizer.json https://huggingface.co/Qwen/Qwen3-0.6B/resolve/main/tokenizer.json
Run:   TOKENIZER_JSON=tokenizer.json python3 run_tokens.py     (writes results_all.json next to the script)
"""
import copy, json, os
from tokenizers import Tokenizer
from axport import RefMap, allocate_refs, compact_json, count_nodes, observe
from gen_apps import chat_app, file_manager, find_by_name

TOK = Tokenizer.from_file(os.environ.get("TOKENIZER_JSON", "tokenizer.json"))


def tokens(s):
    return len(TOK.encode(s).ids)


def envelope(tree_json, app, refs):
    # the fixed fields of the snapshot envelope (docs/json-output.md, README example)
    return json.dumps({"version": "2.5", "ok": True, "command": "snapshot", "data": {
        "app": app, "window": {"id": "w-204749", "title": app}, "snapshot_id": "s8f3k2p9",
        "ref_count": refs, "complete": True, "tree": "@@TREE@@"}}, separators=(",", ":")
    ).replace('"@@TREE@@"', tree_json)


def snapshot(raw, app, depth=10, interactive=False, compact=False, skeleton=False):
    t = observe(raw, min(depth, 3) if skeleton else depth)
    rm = RefMap()
    t = allocate_refs(t, rm, interactive_only=interactive, compact=compact)
    js = envelope(compact_json(t), app, len(rm))
    return dict(nodes=count_nodes(t), refs=len(rm), chars=len(js), tokens=tokens(js))


def drill(raw, region, app, seed_counter=0):
    t = observe(find_by_name(raw, region), 10)
    rm = RefMap()
    rm.counter = seed_counter  # a drill continues the snapshot's ref numbering
    t = allocate_refs(t, rm, interactive_only=True, compact=True, root_ref="@e1")
    js = envelope(compact_json(t), app, len(rm))
    return dict(nodes=count_nodes(t), refs=len(rm), chars=len(js), tokens=tokens(js))


MODES = [("snapshot", {}), ("snapshot -i", dict(interactive=True)), ("snapshot --compact", dict(compact=True)),
         ("snapshot -i --compact", dict(interactive=True, compact=True)),
         ("snapshot --skeleton -i --compact", dict(interactive=True, compact=True, skeleton=True))]

if __name__ == "__main__":
    out = {"apps": {}, "grid": {}}
    for label, raw, app, regions in [("file-manager", file_manager(), "Finder", ["Sidebar", "Toolbar"]),
                                      ("chat-app", chat_app(), "Slack", ["Composer", "Channel header"])]:
        rows = {m: snapshot(copy.deepcopy(raw), app, **kw) for m, kw in MODES}
        sk = snapshot(copy.deepcopy(raw), app, interactive=True, compact=True, skeleton=True)
        for reg in regions:
            rows[f"drill --root <{reg}> -i --compact"] = drill(copy.deepcopy(raw), reg, app, seed_counter=sk["refs"])
        out["apps"][label] = {"raw_nodes": count_nodes(raw), "modes": rows}
        out["grid"][label] = {"rawNodes": count_nodes(raw), "rows": [
            dict(skeleton=s, interactive=i, compact=c, **snapshot(copy.deepcopy(raw), app, interactive=i, compact=c, skeleton=s))
            for s in (False, True) for i in (False, True) for c in (False, True)]}
        print(f"\n== {label}: {count_nodes(raw)} raw nodes")
        for k, v in rows.items():
            print(f"  {k:46s} nodes={v['nodes']:5d} refs={v['refs']:5d} tokens={v['tokens']:6d}")
    out["scaling"] = []
    for n in [25, 50, 100, 150, 300, 600]:
        raw = chat_app(messages=n)
        full = snapshot(copy.deepcopy(raw), "Slack", interactive=True, compact=True)
        sk = snapshot(copy.deepcopy(raw), "Slack", interactive=True, compact=True, skeleton=True)
        dr = drill(copy.deepcopy(raw), "Composer", "Slack", seed_counter=sk["refs"])
        out["scaling"].append(dict(messages=n, raw_nodes=count_nodes(raw), full_i_compact=full["tokens"],
                                    skeleton=sk["tokens"], drill_composer=dr["tokens"]))
    print("\nscaling:", *out["scaling"], sep="\n  ")
    here = os.path.dirname(os.path.abspath(__file__))
    json.dump(out, open(os.path.join(here, "results_all.json"), "w"), indent=1)
