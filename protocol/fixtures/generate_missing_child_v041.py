"""Independent C6 successor over frozen published D9 v040; no compiler/kernel helpers."""
import hashlib
import json
import uuid
from pathlib import Path

here = Path(__file__).parent
source = here.parents[1] / 'cartridges' / 'ashmere_missing_child'
version = '0.0.41'
base = json.loads((here / 'missing_child_v040_hash.json').read_text())
assert base['sha256'] == 'f67b09edee64dc0449e35cd129663a12d7ea74b180859c06b55ba10c1150f89f'
v = json.loads(json.dumps(base['value']).replace('0.0.40', version))

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version,
            'kind': kind, 'key': key}

def named(kind, key):
    return f'ashmere_missing_child@{version}:{kind}/{key}'

def read(path):
    return json.loads((source / path).read_text())

v['manifest']['requires']['kernel_api']['at_least'] = '1.36'
for caps in (v['manifest']['requires']['capabilities'], v['lock']['capabilities']):
    caps['expedition'] = 1
for key in ('begin_marsh_watch', 'retry_marsh_watch', 'use_marsh_shelter'):
    action = read(f'actions/{key}.json')
    action['key'] = key
    v['actions'][named('action', key)] = action
quest = read('quests/a_night_in_the_marsh.json')
quest['key'] = 'a_night_in_the_marsh'
e = quest['expedition']
for field, kind in [('start_room', 'room'), ('shelter_room', 'room'),
                    ('survived_fact', 'fact'), ('faction', 'fact'), ('hound_population', 'population')]:
    e[field] = ref(kind, e[field])
e['footprint'] = [ref('room', key) for key in e['footprint']]
for edge in e['route']:
    for field in ('from', 'to'):
        edge[field] = ref('room', edge[field])
assert [(edge['from']['key'], edge['direction'], edge['to']['key']) for edge in e['route']] == [
    ('hound_run', 'west', 'reed_bank'), ('reed_bank', 'west', 'willow_shade'),
    ('willow_shade', 'south', 'drowned_oak'), ('drowned_oak', 'north', 'willow_shade'),
    ('willow_shade', 'east', 'reed_bank')]
assert e['faction_delta'] == -1
v['quests'][named('quest', quest['key'])] = quest
fact = read('facts.json')['facts']['fen.night_survived']
fact['key'] = 'fen_night_survived'
v['facts'][named('fact', fact['key'])] = fact
dialogue = read('dialogues/sedge_marsh.json')
dialogue['key'] = 'sedge_marsh'
dialogue['npc'] = ref('npc', dialogue['npc'])
for role in dialogue['roles'].values():
    role['npc'] = ref('npc', role['npc'])
dialogue['policy']['root']['fact'] = ref('fact', dialogue['policy']['root']['fact'])
v['dialogues'][named('dialogue', dialogue['key'])] = dialogue
v['rooms'][named('room', 'drowned_oak')]['details'] = read('rooms/drowned_oak.json')['details']
v['text'].update({key: text for key, text in read('text.json').items()
                  if key.startswith('marsh.') or key in ('detail.marsh_shelter.description', 'quest.a_night_in_the_marsh.title', 'room.drowned_oak.description')})
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v041_hash.json').write_text(json.dumps({
    'description': 'C6 real marsh expedition over published D9 v040 without Bram; independent successor answer.',
    'value': json.loads(canonical), 'canonical': canonical, 'sha256': digest,
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
    bundle = v['population_bundles'][named('population_bundle', plan['bundle']['key'])]
    roles = ('deer', 'hide') if 'sight' in plan else (('member', 'pelt') if 'item' in bundle else ('member',))
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
(here / 'missing_child_v041_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'C6 successor {version}/API1.36: {digest}, {len(answers)} initial IDs.')
