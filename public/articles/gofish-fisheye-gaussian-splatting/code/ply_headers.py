"""Read the vertex count and property list of every released GOFish scene's point_cloud.ply with HTTP range requests
(4 KiB per file; nothing else is downloaded). Dataset: https://huggingface.co/datasets/AllenTu/GOFish-scenes (CC BY-NC 4.0)."""
import json, re, statistics, urllib.request

BASE = 'https://huggingface.co/datasets/AllenTu/GOFish-scenes'
tree = json.load(urllib.request.urlopen(BASE.replace('huggingface.co/', 'huggingface.co/api/') + '/tree/main?recursive=true', timeout=60))
files = {x['path']: x['size'] for x in tree if x['type'] == 'file'}
rows = []
for scene in sorted({p.split('/')[0] for p in files if '/' in p and p.split('/')[0] != 'assets'}):
    for variant in ('gaussians', 'gaussians_geo'):
        path = f'{scene}/{variant}/point_cloud.ply'
        if path not in files:
            continue
        req = urllib.request.Request(f'{BASE}/resolve/main/{path}', headers={'Range': 'bytes=0-4095'})
        head = urllib.request.urlopen(req, timeout=60).read()
        text = head[:head.find(b'end_header')].decode('latin1')
        n = int(re.search(r'element vertex (\d+)', text).group(1))
        props = re.findall(r'property \w+ (\w+)', text)
        rows.append(dict(scene=scene, variant=variant, gaussians=n, file_bytes=files[path], properties=len(props)))
fiord = [r['gaussians'] for r in rows if r['scene'].startswith('FIORD') and r['variant'] == 'gaussians']
out = dict(rows=rows, fiord_mean_gaussians=statistics.mean(fiord), fiord_scenes=len(fiord), property_names=props,
           dataset_total_bytes=sum(files.values()))
json.dump(out, open('results-ply.json', 'w'), indent=1)
print(out['fiord_mean_gaussians'], out['fiord_scenes'], out['dataset_total_bytes'])
