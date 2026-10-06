"""Independent C3 successor: published B9 v028 plus frozen C3-only delta.
Python JSON/SHA-256/UUID only; preserve both frozen predecessor answers.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
v = json.loads((here / 'missing_child_v028_hash.json').read_text())['value']
c3 = json.loads((here / 'missing_child_c3_b8_hash.json').read_text())['value']
version = json.loads((source / 'cartridge.json').read_text())['version']
v = json.loads(json.dumps(v).replace('0.0.28', version))
c3 = json.loads(json.dumps(c3).replace('0.0.26', version))
for section, keys in {
    'rooms': ['adder_nest', 'hound_run', 'reed_bank'],
    'npcs': ['fen_hound'],
    'items': ['hound_pelt', 'hound_corpse'],
    'population_bundles': ['fen_hounds'],
    'populations': ['fen_hounds'],
}.items():
    for key in keys:
        name = next(k for k in c3[section] if k.endswith('/' + key))
        v.setdefault(section, {})[name] = c3[section][name]
v['lock']['capabilities']['population'] = 1
v['manifest']['requires']['capabilities']['population'] = 1
c3_text = json.loads((here / 'missing_child_c3_b8_hash.json').read_text())['value']['text']
b8_text = json.loads((here / 'missing_child_v025_hash.json').read_text())['value']['text']
v['text'].update({key: value for key, value in c3_text.items() if b8_text.get(key) != value})
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v029_hash.json').write_text(json.dumps({
    'description': 'C3 living Fen hounds and corpse loot on published B9/D2/D5 predecessor v028.',
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
(here / 'missing_child_v029_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent C3+B9 successor {version}: {digest}, {len(answers)} initial IDs.')
