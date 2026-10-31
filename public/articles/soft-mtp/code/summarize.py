"""Summarise results.jsonl into summary.json and write components/articles/soft-mtp/data.ts."""
import json, statistics as st, sys
rows = [json.loads(l) for l in open('results.jsonl')]
objs = ['ntp', 'mtp', 'kl', 'soft']
labels = {'ntp': 'next-token only', 'mtp': 'standard MTP', 'kl': 'explicit KL', 'soft': 'Soft-MTP'}
def vals(o, f):
    return [f(r) for r in sorted([r for r in rows if r['objective'] == o], key=lambda r: r['seed'])]
mean_h = lambda xs: sum(xs) / len(xs)
metrics = {
    'ntp': ('val NTP loss', 'validation next-token loss, nats per token', lambda r: r['val']['val_ntp'], 4, 'Lower is better.', objs),
    'mtp': ('extra-head loss', 'mean cross-entropy of the three extra heads on their own targets', lambda r: mean_h(r['val']['val_mtp_ce']), 3, 'Lower is better.', ['mtp', 'kl', 'soft']),
    'kl': ('KL to verifier', "mean KL from the NTP distribution to each head's distribution (teacher-forced)", lambda r: mean_h(r['val']['kl_to_verifier']), 4, 'Lower is better.', ['mtp', 'kl', 'soft']),
    'agree': ('agreement', "how often each head's top token equals the NTP head's top token at the aligned position, mean over heads", lambda r: mean_h(r['val']['agree_with_verifier']), 3, 'Higher is better.', ['mtp', 'kl', 'soft']),
    'len': ('accepted length', 'expected tokens accepted per draft round if the three heads agree independently, teacher-forced', lambda r: r['val']['exp_accept_len_chain'], 3, 'Higher is better.', ['mtp', 'kl', 'soft']),
}
summary = {'n_rows': len(rows), 'metrics': {}, 'paired': {}}
for mid, (lab, desc, f, dg, better, which) in metrics.items():
    summary['metrics'][mid] = {o: {'values': vals(o, f), 'mean': mean_h(vals(o, f)), 'std': (st.stdev(vals(o, f)) if len(vals(o, f)) > 1 else 0.0)} for o in which if vals(o, f)}
    for a, b in [('soft', 'mtp'), ('soft', 'kl'), ('mtp', 'ntp')]:
        if a in which and b in which and vals(a, f) and vals(b, f):
            d = [x - y for x, y in zip(vals(a, f), vals(b, f))]
            summary['paired'][f'{mid}:{a}-{b}'] = {'diffs': d, 'mean': mean_h(d), 'std': (st.stdev(d) if len(d) > 1 else 0.0), 'n': len(d), 'wins': sum(1 for x in d if (x < 0) == (better == 'Lower is better.'))}
cost = {o: {'sec_per_step': mean_h(vals(o, lambda r: r['sec_per_step'])), 'rss': mean_h(vals(o, lambda r: r['peak_rss_mb']))} for o in objs if vals(o, lambda r: r['sec_per_step'])}
summary['cost'] = cost
snr = {o: [r['snr'] for r in rows if r['objective'] == o and 'snr' in r] for o in ['mtp', 'soft']}
summary['snr'] = snr
json.dump(summary, open('summary.json', 'w'), indent=1)
seeds = len(vals('soft', lambda r: 1))
def ts(x): return json.dumps(x)
out = []
out.append('// Generated from public/articles/soft-mtp/code/results.jsonl by summarize.py; every number is a run output.\n')
out.append('export type TrainMetric = { id: "ntp" | "mtp" | "kl" | "agree" | "len"; label: string; note: string; better: string; digits: number }\n')
out.append('export const TRAIN = {\n  seeds: %d,\n  metrics: %s as TrainMetric[],\n  objectives: [\n' % (seeds, ts([{'id': k, 'label': v[0], 'note': v[1].capitalize() + '.', 'better': v[4], 'digits': v[3]} for k, v in metrics.items()])))
for o in objs:
    v = {mid: summary['metrics'][mid][o]['values'] for mid in metrics if o in summary['metrics'][mid]}
    m = {mid: summary['metrics'][mid][o]['mean'] for mid in metrics if o in summary['metrics'][mid]}
    out.append('    { id: %s, label: %s, values: %s as Partial<Record<TrainMetric["id"], number[]>>, mean: %s as Partial<Record<TrainMetric["id"], number>> },\n' % (ts(o), ts(labels[o]), ts(v), ts(m)))
out.append('  ],\n  snr: %s as [string, string][] | null,\n}\n' % ts(None))
open('data_train.ts.part', 'w').write(''.join(out))
print(json.dumps(summary['paired'], indent=1)[:2500]); print(json.dumps(cost, indent=1))
