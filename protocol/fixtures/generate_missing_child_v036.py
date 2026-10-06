"""Independent D7 answer from published v035 and literal deer source declarations."""
import hashlib
import json
import uuid
from pathlib import Path

here = Path(__file__).parent
source = here.parent.parent / 'cartridges' / 'ashmere_missing_child'
version = '0.0.36'
v = json.loads((here / 'missing_child_v035_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.35', version))
v['manifest']['requires']['kernel_api']['at_least'] = '1.31'

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version,
            'kind': kind, 'key': key}

def named(kind, key):
    return f'ashmere_missing_child@{version}:{kind}/{key}'

for key in ('deer_corpse', 'deer_hide'):
    value = json.loads((source / 'items' / f'{key}.json').read_text())
    v['items'][named('item', key)] = {'key': key, **value}
for key in ('oak_deer', 'orchard_deer', 'willow_deer'):
    npc = json.loads((source / 'npcs' / f'{key}.json').read_text())
    npc['room'] = ref('room', npc['room'])
    v['npcs'][named('npc', key)] = {'key': key, **npc}
    b = json.loads((source / 'population_bundles' / f'{key}.json').read_text())
    v['population_bundles'][named('population_bundle', key)] = {
        'key': key, 'npc': ref('npc', b['npc']), 'item': ref('item', b['item']),
        'corpse': ref('item', b['corpse']), 'member_role': b['member_role'],
        'loot_role': b['loot_role'],
    }
    plan = json.loads((source / 'populations' / f'{key}.json').read_text())
    plan['home'] = ref('room', plan['home'])
    plan['area'] = [ref('room', room) for room in plan['area']]
    plan['bundle'] = ref('population_bundle', plan['bundle'])
    v['populations'][named('population', key)] = {'key': key, **plan}
text = json.loads((source / 'text.json').read_text())
v['text'].update({key: value for key, value in text.items() if 'deer' in key})
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v036_hash.json').write_text(json.dumps({
    'description': 'D7 three bounded deer, delayed sight flight and conserved hides over published D6 v035.',
    'value': v, 'canonical': canonical, 'sha256': digest,
}, indent=2, ensure_ascii=False) + '\n')

rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + ['room/' + room['key'] for _, room in rooms]
labels += ['detail/' + room['key'] + '/' + key for _, room in rooms for key in sorted(room.get('details', {}))]
labels += ['npc/' + npc['key'] for _, npc in sorted(v['npcs'].items()) if not npc.get('spawn_template')]
labels += ['item/' + item['key'] for _, item in sorted(v['items'].items()) if item['location']['in'] != 'template']
labels += ['job/' + npc['key'] for _, npc in sorted(v['npcs'].items()) if npc.get('daily_schedule')]
labels += ['slot/' + slot for slot in sorted({item['slot'] for item in v['items'].values() if 'slot' in item})]
labels += ['consumed']
for plan in sorted(v['populations'].values(), key=lambda p: p['key']):
    for slot in range(1, plan['day_target'] + 1):
        labels += [f"population/{plan['key']}/slot{slot}/{role}" for role in (
            'deer', 'hide') if 'sight' in plan] if 'sight' in plan else [
            f"population/{plan['key']}/slot{slot}/{role}" for role in ('member', 'pelt')]
    labels += [f"population/{plan['key']}/job"]
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f',
              '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v036_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent D7 successor {version}/API1.31: {digest}, {len(answers)} initial IDs.')
