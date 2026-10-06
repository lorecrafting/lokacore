"""Independent provisional C3+D5 answer: frozen C3 plus seven D5 room sources.
Python JSON/SHA-256/UUID only; final successor version re-pins after D2 integration.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
v = json.loads((here / 'missing_child_v026_hash.json').read_text())['value']
version = json.loads((source / 'cartridge.json').read_text())['version']
v = json.loads(json.dumps(v).replace('0.0.26', version))

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version, 'kind': kind, 'key': key}

for key in ['drowned_oak', 'fox_hollow', 'oak_branches', 'oak_crown', 'black_pool', 'fox_den_deep', 'fishing_shallows']:
    room = json.loads((source / 'rooms' / f'{key}.json').read_text())
    for edge in room['exits'].values():
        edge['to'] = ref('room', edge['to'])
    v['rooms'][f'ashmere_missing_child@{version}:room/{key}'] = {'key': key, **room}
v['text'].update(json.loads((source / 'text.json').read_text()))
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_c3_provisional_hash.json').write_text(json.dumps({
    'description': 'Provisional C3+D5: persistent Fen hounds and corpse loot on published dry Deep Fen rooms.',
    'value': v, 'canonical': canonical, 'sha256': digest,
}, indent=2, ensure_ascii=False) + '\n')
rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + [f"room/{r['key']}" for _, r in rooms]
labels += [f"detail/{r['key']}/{key}" for _, r in rooms for key in sorted(r.get('details', {}))]
labels += [f"npc/{n['key']}" for _, n in sorted(v['npcs'].items()) if n['key'] != 'fen_hound']
labels += [f"item/{i['key']}" for _, i in sorted(v['items'].items()) if i['location']['in'] != 'template']
labels += [f"job/{n['key']}" for _, n in sorted(v['npcs'].items()) if n.get('daily_schedule')]
labels += [f'slot/{slot}' for slot in sorted({i['slot'] for i in v['items'].values() if 'slot' in i})]
labels += [f'population/fen_hounds/slot{i}/{kind}' for i in range(1, 5) for kind in ('member', 'pelt')]
labels += ['population/fen_hounds/job']
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_c3_provisional_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent provisional C3+D5 {version}: {digest}, {len(answers)} initial IDs.')
