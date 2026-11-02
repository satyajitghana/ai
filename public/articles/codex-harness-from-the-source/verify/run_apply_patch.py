"""Feed the 18 constructed patches of toy 1 to the REAL codex-apply-patch binary and compare with our Python port.

Usage: run_apply_patch.py APPLY_PATCH_BIN VERIFY_PROBE_BIN TOY1_SOURCE OUT_JSON
The binary is `apply_patch` built from openai/codex @ 67f0994b (codex-rs/apply-patch, unmodified; only the exec-server
file-system trait is stubbed, see README.log). Each case runs in a fresh temp directory. The "apply loop alone" and
"second write fails" cases cannot be reproduced the same way (the real binary has no flag that skips verification, and
this box runs as root so a read-only file does not block a write); they are reported as such.
"""
import json, os, subprocess, sys, tempfile, re
binp, vprobe, toy_src, out = sys.argv[1:5]
src = open(toy_src).read()
head = src.split("rows = []")[0]
ns = {}
exec(compile(head, toy_src, "exec"), ns)   # defines CASES and apply_patch(); the toy's own tail (which writes JSON) is not run
CASES, FS, apply_patch = ns["CASES"], ns["FS"], ns["apply_patch"]
rows = []
for name, files, patch, intent in CASES:
    verified = "(apply loop alone)" not in name
    skip = "write fails" in name
    # our port
    fs = FS(files, fail_writes=("b.txt",) if skip else ())
    try: apply_patch(patch, fs, verified=verified); perr = None
    except Exception as e: perr = f"{type(e).__name__}: {str(e).splitlines()[0]}"
    ours = {k: v for k, v in fs.files.items()}
    # the real binary
    d = tempfile.mkdtemp(prefix="ap-")
    for p, c in files.items():
        os.makedirs(os.path.dirname(os.path.join(d, p)) or d, exist_ok=True)
        open(os.path.join(d, p), "w", newline="").write(c)
    v = subprocess.run([vprobe, patch], cwd=d, capture_output=True, text=True).stdout.strip()   # core's pre-approval step: reads, never writes
    r = subprocess.run([binp, patch], cwd=d, capture_output=True, text=True)
    real = {}
    for root, _, fl in os.walk(d):
        for f in fl:
            full = os.path.join(root, f); real[os.path.relpath(full, d)] = open(full, newline="").read()
    # what the harness does: verify first; only a verified patch is applied. The standalone binary applies without verifying.
    pipeline = dict(files) if v.startswith("REJECTED") else real
    pipeline_ok = not v.startswith("REJECTED") and r.returncode == 0
    same = (pipeline == ours) and (pipeline_ok == (perr is None)) if verified else (real == ours) and ((r.returncode == 0) == (perr is None))
    rows.append({"case": name, "real_exit": r.returncode, "real_stderr": r.stderr.strip()[:300], "real_stdout": r.stdout.strip()[:200],
                 "port_error": perr, "real_verify": v, "real_standalone_files": real, "real_pipeline_files": pipeline, "same_final_state": same, "skipped_reason": ("root cannot make a write fail" if skip else None),
                 "real_files": real, "port_files": ours, "intended": intent})
    flag = "SAME" if same else "DIFFERENT"
    print(f"{flag:9} verify={v[:44]:44} exit={r.returncode} port_err={perr is not None!s:5} {name}" + (f"   [{r.stderr.strip().splitlines()[0][:90]}]" if r.stderr.strip() else ""))
json.dump(rows, open(out, "w"), indent=1)
