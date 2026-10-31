"""Toy 4: a small execpolicy matcher run on 32 commands.

Rules are loaded from the repo's only shipped rule file, codex-rs/execpolicy/examples/example.codexpolicy
(the README says 'not recommended for actual use'; the repo ships no default.rules: the user file is
$CODEX_HOME/rules/default.rules). Semantics ported from execpolicy/README.md and core/src/exec_policy.rs:
  - prefix_rule: tokens match in order, a list entry means alternatives, decision allow|prompt|forbidden
  - effective decision across all matched rules and all segments = the strictest (forbidden > prompt > allow)
  - 'bash -lc SCRIPT' is split into commands only if the script is word-only commands joined by && || ; |
    (shell-command/src/bash.rs:29-52); otherwise the whole argv is one command that no rule matches
  - unmatched commands: dangerous (rm with a force flag, looking through sudo/env, wrapper depth 8) -> Prompt;
    else under approval policy on-request with a restricted filesystem sandbox -> Allow (run in the sandbox)
  - bypass_sandbox is true only if EVERY segment is allowed by an explicit rule (exec_policy.rs:468-481)
Our re-implementation: the shell is parsed by a small scanner, not tree-sitter; Windows rules are not modelled.
Checked against the real engine and parser in verify/ (2026-10-31): 37 of 37 segments agree; the one miss, a trailing ";", is fixed here.
"""
import json, re, shlex, sys

SRC = sys.argv[1]
RANK = {"allow": 0, "prompt": 1, "forbidden": 2}

def load_rules(path):
    text = re.sub(r"#.*", "", open(path).read())
    rules = []
    for m in re.finditer(r"prefix_rule\(", text):
        i, depth = m.end(), 1
        while depth:
            depth += (text[i] == "(") - (text[i] == ")"); i += 1
        body = text[m.end():i - 1]
        pat = re.search(r"pattern\s*=\s*(\[.*?\])\s*,\s*(?:decision|justification|match|not_match)|pattern\s*=\s*(\[.*?\])\s*,?\s*$", body, re.S)
        raw = (pat.group(1) or pat.group(2)) if pat else None
        # a pattern is a (possibly nested) list of strings: evaluate it safely
        pattern = json.loads(raw.replace("'", '"'))
        dec = re.search(r'decision\s*=\s*"(\w+)"', body)
        just = re.search(r'justification\s*=\s*"([^"]*)"', body)
        rules.append({"pattern": pattern, "decision": dec.group(1) if dec else "allow", "justification": just.group(1) if just else None})
    return rules

def rule_matches(rule, argv):
    p = rule["pattern"]
    if len(argv) < len(p): return False
    return all((argv[i] in e) if isinstance(e, list) else argv[i] == e for i, e in enumerate(p))

def plain_commands(script):
    """Word-only commands joined by && || ; | . Returns list of argv, or None if the script is not plain."""
    cmds, cur, i, n = [], "", 0, len(script)
    parts, quote = [], None
    while i < n:
        c = script[i]
        if quote == "'":
            cur += c
            if c == "'": quote = None
        elif quote == '"':
            if c in "$`": return None
            cur += c
            if c == '"': quote = None
        else:
            if c in "'\"": quote = c; cur += c
            elif c in "$`<>(){}~*?[]#\\" : return None
            elif script.startswith("&&", i) or script.startswith("||", i):
                parts.append(cur); cur = ""; i += 1
            elif c == "&": return None
            elif c in ";|\n": parts.append(cur); cur = ""   # newline also separates (real parser, verify/)
            else: cur += c
        i += 1
    if quote: return None
    # the real tree-sitter splitter accepts one trailing ';' ('ls; ' is a plain command): found by running it, see verify/
    if cur.strip() == "" and parts and script.rstrip()[-1:] in ";\n": pass
    else: parts.append(cur)
    for p in parts:
        try: w = shlex.split(p)
        except ValueError: return None
        if not w or re.match(r"^\w+=", w[0]): return None   # an empty segment or a VAR=x prefix is not a plain command
        cmds.append(w)
    return cmds

def dangerous(argv, depth=0):
    if depth > 8: return True
    if not argv: return False
    c = argv[0].split("/")[-1]
    if c in ("sudo",): return dangerous(argv[1:], depth + 1)
    if c == "env":
        rest = argv[1:]
        while rest and (rest[0] == "-i" or re.match(r"^\w+=", rest[0])): rest = rest[1:]
        return dangerous(rest, depth + 1)
    if c in ("bash", "sh", "zsh") and len(argv) == 3 and argv[1] in ("-c", "-lc"):
        inner = plain_commands(argv[2])
        return any(dangerous(x, depth + 1) for x in inner) if inner else bool(re.search(r"\brm\s+-\w*f", argv[2]))
    if c == "rm":
        for a in argv[1:]:
            if a == "--": break
            if a == "--force" or (a.startswith("-") and not a.startswith("--") and "f" in a): return True
    return False

def classify(argv, rules):
    cmds = None
    if len(argv) == 3 and argv[0].split("/")[-1] in ("bash", "sh", "zsh") and argv[1] in ("-c", "-lc"):
        cmds = plain_commands(argv[2])
    split = cmds is not None
    cmds = cmds or [argv]
    segs, worst, all_rule_allow = [], "allow", True
    for c in cmds:
        hit = [r for r in rules if rule_matches(r, c)]
        if hit:
            d = max((r["decision"] for r in hit), key=RANK.get); why = f"rule {hit[0]['pattern']} -> {d}"
            if d != "allow": all_rule_allow = False
        else:
            all_rule_allow = False
            if dangerous(c): d, why = "prompt", "no rule; dangerous (rm with force)"
            else: d, why = "allow", "no rule; allowed to run inside the sandbox (on-request, restricted fs)"
        segs.append({"argv": c, "decision": d, "why": why})
        if RANK[d] > RANK[worst]: worst = d
    return {"command": " ".join(shlex.quote(a) for a in argv), "split_into_segments": split, "segments": segs,
            "effective": worst, "bypass_sandbox": worst == "allow" and all_rule_allow}

COMMANDS = [
 ["ls", "-la"], ["cat", "README.md"], ["pwd"], ["which", "python3"], ["head", "-n", "5", "CHANGELOG.md"],
 ["git", "status"], ["git", "reset", "--hard", "HEAD~1"], ["git", "reset", "--keep"], ["git", "reset"],
 ["cp", "a", "b"], ["rm", "-rf", "build"], ["rm", "file.txt"], ["sudo", "rm", "-rf", "/tmp/x"],
 ["env", "A=1", "rm", "-f", "x"], ["printenv"], ["printenv", "SECRET_TOKEN"],
 ["bash", "-lc", "ls && git status"], ["bash", "-lc", "ls && git reset --hard"], ["bash", "-lc", "cat a.txt | head -n 3"],
 ["bash", "-lc", "cp a b; rm -rf c"], ["bash", "-lc", "ls > out.txt"], ["bash", "-lc", "ls $(pwd)"],
 ["bash", "-lc", "git reset --hard $(git rev-parse HEAD)"], ["bash", "-lc", "echo hi & rm -rf z"], ["bash", "-lc", "cd sub && ls"],
 ["bash", "-lc", "cat 'a b.txt'"], ["bash", "-c", "git reset --keep && ls"], ["/usr/bin/ls", "-l"], ["curl", "https://example.com"],
 ["python3", "-c", "print(1)"], ["bash", "-lc", "ls; "], ["sh", "-c", "head README.md"],
]
rules = load_rules(SRC)
rows = [classify(c, rules) for c in COMMANDS]
json.dump({"rules": rules, "results": rows}, open("toy4_execpolicy.json", "w"), indent=1)
print(f"{len(rules)} rules loaded:", [(r['pattern'], r['decision']) for r in rules][:3], "...")
for r in rows:
    print(f"{r['effective']:9} bypass={str(r['bypass_sandbox']):5} split={str(r['split_into_segments']):5}  {r['command']}")
from collections import Counter
print(Counter(r['effective'] for r in rows), "bypass_sandbox:", sum(r['bypass_sandbox'] for r in rows))
