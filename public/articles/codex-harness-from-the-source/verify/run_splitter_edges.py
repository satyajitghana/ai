"""Ten extra scripts for the bash -lc splitter: real shell-command/bash.rs (via the probe binary) vs toy 4's scanner.
Usage: run_splitter_edges.py PROBE_BIN TOY4_SOURCE OUT_JSON"""
import json, subprocess, sys
probe, toy, out = sys.argv[1:4]
src = open(toy).read().split("rules = load_rules")[0].replace("SRC = sys.argv[1]", "SRC = ''")
ns = {}; exec(compile(src, toy, "exec"), ns)
S = ["ls;", "ls ;", ";ls", "ls;;", "ls &&", "ls | ", "ls\ncat a", "ls & ", "FOO=1 ls", 'echo "a b" && ls']
rows = []
for sc in S:
    r = json.loads(subprocess.run([probe], input=json.dumps(["bash", "-lc", sc]) + "\n", capture_output=True, text=True).stdout)
    t = ns["plain_commands"](sc)
    rows.append({"script": sc, "real": r["plain_split"], "toy": t, "agree": r["plain_split"] == t})
    print(("AGREE   " if rows[-1]["agree"] else "DIFFER  "), repr(sc), "real:", r["plain_split"], "toy:", t)
json.dump(rows, open(out, "w"), indent=1)
