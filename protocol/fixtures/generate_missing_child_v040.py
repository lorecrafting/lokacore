"""Provisional D9 v040 answer from frozen D7 v036 plus authored D9 source fields; re-pin after predecessors publish."""
import hashlib
import json
import uuid
from pathlib import Path

here = Path(__file__).parent
source = here.parents[1] / 'cartridges' / 'ashmere_missing_child'
version = '0.0.40'
v = json.loads((here / 'missing_child_v036_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.36', version))

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version,
            'kind': kind, 'key': key}

def named(kind, key):
    return f'ashmere_missing_child@{version}:{kind}/{key}'

def read(path):
    return json.loads((source / path).read_text())

def policy(node):
    if isinstance(node, list):
        return [policy(x) for x in node]
    if isinstance(node, dict):
        node = {k: policy(x) for k, x in node.items()}
        if node.get('op') == 'fact_compare':
            node['fact'] = ref('fact', node['fact'])
    return node

v['manifest']['requires']['kernel_api']['at_least'] = '1.35'
for path in sorted((source / 'dialogues').glob('a0_d9_*.json')) + [source / 'dialogues' / 'bram.json']:
    d = policy(json.loads(path.read_text()))
    d['key'] = path.stem
    d['npc'] = ref('npc', d['npc'])
    for role in d['roles'].values():
        role['npc'] = ref('npc', role['npc'])
    v['dialogues'][named('dialogue', path.stem)] = d
bram = read('npcs/bram.json')
bram.update(key='bram', room=ref('room', bram['room']))
v['npcs'][named('npc', 'bram')] = bram
reaction = policy(read('reactions/d9_suppress_hounds.json'))
reaction['key'] = 'd9_suppress_hounds'
reaction['on']['fact'] = ref('fact', reaction['on']['fact'])
reaction['apply'][0]['plan'] = ref('population', reaction['apply'][0]['plan'])
assert reaction['apply'][0]['duration'] == 172800
v['reactions'][named('reaction', reaction['key'])] = reaction
v['rooms'][named('room', 'chapel_nave')]['exits']['west']['corpse_ingress'] = {
    'fact': ref('fact', 'chapel_allegiance'), 'equals': 'fox'}
for name in ('village_green', 'reed_path', 'mire_crossing'):
    v['rooms'][named('room', name)]['variants'] = policy(read(f'rooms/{name}.json')['variants'])
cue = read('cartridge.json')['world']['bell_cue']
assert len(cue['rooms']) == 35 and len(set(cue['rooms'])) == 35
assert cue['fact'] == 'chapel_bell_rung'
v['world']['bell_cue'] = {'fact': ref('fact', cue['fact']),
                          'rooms': [ref('room', r) for r in cue['rooms']], 'text': cue['text']}
v['text'] = read('text.json')
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v040_hash.json').write_text(json.dumps({
    'description': 'D9 village reactions, bounded bell cue and suppression, and fox Study ingress over published D7 v036; provisional pending C5/D11/D8.',
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
    roles = ('deer', 'hide') if 'sight' in plan else ('member', 'pelt')
    for slot in range(1, plan['day_target'] + 1):
        labels += [f"population/{plan['key']}/slot{slot}/{role}" for role in roles]
    labels += [f"population/{plan['key']}/job"]
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f',
              '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v040_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Provisional D9 successor {version}/API1.35: {digest}, {len(answers)} initial IDs.')
