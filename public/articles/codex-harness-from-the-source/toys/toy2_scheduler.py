"""Toy 2: the tool admission gate as a discrete-event simulation.

Rule read from codex-rs/core/src/tools/parallel.rs:54,92,284-300: one tokio RwLock<()> per turn;
a call whose runtime supports parallel calls takes lock.read(), every other call takes lock.write().
Each call is tokio::spawn'ed when the model finishes emitting it (stream_events_utils.rs:365), so
calls reach the lock in emission order. tokio's RwLock is documented as fair (FIFO queue, a waiting
writer blocks later readers): REPORTED from the tokio docs, not verified here; the toy models that.
Durations and arrival gaps are our assumptions (the point is the shape, not the seconds).
"""
import json, random, statistics

def fifo_rw(calls):
    """calls: list of (arrival, duration, exclusive). FIFO fair readers-writer lock. Returns finish times."""
    n = len(calls); start = [None] * n; finish = [None] * n
    t = 0.0; queue = []; active_readers = []; active_writer = None
    events = sorted(range(n), key=lambda i: (calls[i][0], i)); ei = 0
    while ei < n or queue or active_readers or active_writer is not None:
        nxt = []
        if ei < n: nxt.append(calls[events[ei]][0])
        for r in active_readers: nxt.append(finish[r])
        if active_writer is not None: nxt.append(finish[active_writer])
        t = max(t, min(nxt))
        active_readers = [r for r in active_readers if finish[r] > t + 1e-12]
        if active_writer is not None and finish[active_writer] <= t + 1e-12: active_writer = None
        while ei < n and calls[events[ei]][0] <= t + 1e-12: queue.append(events[ei]); ei += 1
        while queue:
            i = queue[0]; _, dur, excl = calls[i]
            if excl:
                if active_readers or active_writer is not None: break
                queue.pop(0); start[i] = t; finish[i] = t + dur; active_writer = i
            else:
                if active_writer is not None: break
                queue.pop(0); start[i] = t; finish[i] = t + dur; active_readers.append(i)
    return start, finish

def serial(calls):
    t = 0.0; fin = []
    for a, d, _ in sorted(calls, key=lambda c: c[0]):
        t = max(t, a) + d; fin.append(t)
    return fin

def span(finish): return max(finish)

# 1. named scenarios, 8 calls, 1 s each, all emitted at once (gap 0) and spread 0.5 s apart
scen = {
  "8 reads": "RRRRRRRR", "7 reads then a write": "RRRRRRRW", "a write in the middle": "RRRWRRRR",
  "write first": "WRRRRRRR", "alternating": "RWRWRWRW", "all writes": "WWWWWWWW",
}
out = {"scenarios": []}
for name, pat in scen.items():
    for gap in (0.0, 0.5):
        calls = [(i * gap, 1.0, ch == "W") for i, ch in enumerate(pat)]
        s, f = fifo_rw(calls)
        out["scenarios"].append({"name": name, "pattern": pat, "gap_s": gap, "gate_makespan": round(span(f), 2),
            "serial_makespan": round(span(serial(calls)), 2),
            "starts": [round(x, 2) for x in s], "finishes": [round(x, 2) for x in f]})
# 2. exclusive fraction sweep, N=8, random placement, 400 seeds
sweep = []
for p in (0, 1, 2, 3, 4, 6, 8):   # number of exclusive calls among 8
    gate, ser = [], []
    for seed in range(400):
        rnd = random.Random(seed * 31 + p)
        pat = [True] * p + [False] * (8 - p); rnd.shuffle(pat)
        calls = [(0.0, 1.0, x) for x in pat]
        gate.append(span(fifo_rw(calls)[1])); ser.append(span(serial(calls)))
    sweep.append({"exclusive_of_8": p, "gate_mean": round(statistics.mean(gate), 3), "serial": round(statistics.mean(ser), 3),
                  "speedup": round(statistics.mean(ser) / statistics.mean(gate), 3), "gate_min": min(gate), "gate_max": max(gate)})
out["sweep"] = sweep
json.dump(out, open("toy2_scheduler.json", "w"), indent=1)
print(f"{'scenario':26} {'gap':>4} {'gate':>5} {'serial':>6}  starts")
for r in out["scenarios"]: print(f"{r['name']:26} {r['gap_s']:>4} {r['gate_makespan']:>5} {r['serial_makespan']:>6}  {r['starts']}")
print("\nexclusive calls among 8 (400 random placements, 1 s each, emitted together):")
for r in sweep: print(f"  {r['exclusive_of_8']} exclusive: gate mean {r['gate_mean']} s (min {r['gate_min']}, max {r['gate_max']}) vs serial {r['serial']} s -> {r['speedup']}x")
