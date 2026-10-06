"""Independent B4 answer: reviewed v020 payload plus exact authored fuel/well additions.

Only Python JSON/SHA-256/UUID; no compiler or kernel expected-result helpers.
The predecessor supplies unaffected literal definitions; IDs follow numeric profile order.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
v = json.loads((here / 'missing_child_v020_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.20', '0.0.21'))
manifest = json.loads((source / 'cartridge.json').read_text())
v['manifest']['requires']['kernel_api'] = manifest['requires']['kernel_api']
v['manifest']['requires']['capabilities'].update(manifest['requires']['capabilities'])
v['lock']['capabilities'] = v['manifest']['requires']['capabilities']
def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': '0.0.21', 'kind': kind, 'key': key}
for name in ['torch', 'lamp_oil']:
    fuel = json.loads((source / f'items/{name}.json').read_text())['fuel']
    if 'supply' in fuel:
        fuel['supply'] = ref('item', fuel['supply'])
    v['items'][f'ashmere_missing_child@0.0.21:item/{name}']['fuel'] = fuel
for name in ['well_lane', 'well_shaft']:
    room = json.loads((source / f'rooms/{name}.json').read_text())
    for exit in room['exits'].values():
        for field, value in list(exit.items()):
            exit[field] = ref('room' if field == 'to' else field, value)
    v['rooms'][f'ashmere_missing_child@0.0.21:room/{name}'] = {'key': name, **room}
v['text'].update(json.loads((source / 'text.json').read_text()))
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v021_hash.json').write_text(json.dumps({'description': 'Independent B4 known answer: C1 source plus refillable torch/oil and optional dark Well Shaft with public recovery stairs.', 'value': v, 'canonical': canonical, 'sha256': digest}, indent=2, ensure_ascii=False) + '\n')
rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + [f"room/{r['key']}" for _, r in rooms]
labels += [f"detail/{r['key']}/{key}" for _, r in rooms for key in sorted(r.get('details', {}))]
labels += [f"npc/{n['key']}" for _, n in sorted(v['npcs'].items())]
labels += [f"item/{i['key']}" for _, i in sorted(v['items'].items()) if i['location']['in'] != 'template']
labels += [f"job/{n['key']}" for _, n in sorted(v['npcs'].items()) if n.get('daily_schedule')]
labels += [f'slot/{slot}' for slot in sorted({i['slot'] for i in v['items'].values() if 'slot' in i})]
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v021_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent v021: {digest}, {len(answers)} initial IDs.')
