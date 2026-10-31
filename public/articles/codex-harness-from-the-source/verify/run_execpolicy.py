"""Run the REAL codex-execpolicy engine and the REAL shell-command parser / danger check on toy 4's 32 commands.

Built from openai/codex @ 67f0994b with the repo's own sources (see verify/README.log).
  - rule matching:      codex-execpolicy `check` binary, rules = codex-rs/execpolicy/examples/example.codexpolicy
  - bash -lc splitting: shell-command/src/bash.rs parse_shell_lc_plain_commands (tree-sitter-bash)
  - danger heuristic:   shell-command is_dangerous_command::dangerous_command_match
Usage: run_execpolicy.py EXECPOLICY_BIN PROBE_BIN RULES TOY4_JSON OUT_JSON
The tool never executes the commands; they are passed as data.
"""
import json, shlex, subprocess, sys
ep, probe, rules, toy, out = sys.argv[1:6]
toy = json.load(open(toy))["results"]
RANK = {"allow": 0, "prompt": 1, "forbidden": 2}
def real_rule(argv, extra=()):
    r = subprocess.run([ep, "check", "--rules", rules, *extra, "--", *argv], capture_output=True, text=True)
    j = json.loads(r.stdout)
    return j.get("decision"), [m["prefixRuleMatch"]["matchedPrefix"] for m in j["matchedRules"]]
rows = []
for t in toy:
    argv = shlex.split(t["command"])
    p = json.loads(subprocess.run([probe], input=json.dumps(argv) + "\n", capture_output=True, text=True).stdout)
    segs = p["plain_split"] or [argv]
    seg_real = []
    worst, all_rule_allow = "allow", True
    for s in segs:
        d, m = real_rule(s)
        if d is None: all_rule_allow = False
        elif d != "allow": all_rule_allow = False
        seg_real.append({"argv": s, "rule_decision": d, "matched": m})
        if d and RANK[d] > RANK[worst]: worst = d
    rows.append({"command": t["command"], "toy_split": t["split_into_segments"], "real_split": p["plain_split"] is not None,
                 "real_segments": seg_real, "real_rule_effective": worst if any(s["rule_decision"] for s in seg_real) else None,
                 "real_dangerous": p["dangerous"], "toy_effective": t["effective"], "toy_bypass": t["bypass_sandbox"],
                 "real_all_segments_rule_allowed": all_rule_allow,
                 "host_resolved": real_rule(argv, ["--resolve-host-executables"])[0] if argv[0].startswith("/") else None})
json.dump(rows, open(out, "w"), indent=1)
for r in rows:
    flag = "" 
    if r["toy_split"] != r["real_split"]: flag += " SPLIT-DIFFERS"
    if r["toy_bypass"] != r["real_all_segments_rule_allowed"]: flag += " BYPASS-DIFFERS"
    print(f"{r['command'][:52]:52} real_rule={str(r['real_rule_effective']):9} split={r['real_split']!s:5} danger={r['real_dangerous']!s:5} toy={r['toy_effective']:9}{flag}")
