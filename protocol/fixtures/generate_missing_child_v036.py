"""Independent D11 character-choice answer over frozen published D6 v035."""
import hashlib
import json
import uuid
from pathlib import Path

here = Path(__file__).parent
version = '0.0.36'
v = json.loads((here / 'missing_child_v035_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.35', version))
v['manifest']['requires']['kernel_api']['at_least'] = '1.31'

def ref(kind, name):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version,
            'kind': kind, 'key': name}

def named(kind, name):
    return f'ashmere_missing_child@{version}:{kind}/{name}'

for name, start in [('con', 10), ('spi', 10)]:
    v['attributes'][named('attribute', name)] = {'key': name, 'start': start}

v['ancestries'] = {
    'fen_born': {'label': 'ancestry.fen_born.label',
                 'description': 'ancestry.fen_born.description',
                 'attribute': ref('attribute', 'per'), 'modifier': 1,
                 'skill': ref('skill', 'swim'),
                 'faction': {'fact': ref('fact', 'priory_fen_axis'), 'value': -2}},
    'road_born': {'label': 'ancestry.road_born.label',
                  'description': 'ancestry.road_born.description',
                  'attribute': ref('attribute', 'dex'), 'modifier': 1,
                  'skill': ref('skill', 'haggle')},
    'hill_folk': {'label': 'ancestry.hill_folk.label',
                  'description': 'ancestry.hill_folk.description',
                  'attribute': ref('attribute', 'con'), 'modifier': 1,
                  'dark_sight': True},
    'fey_touched': {'label': 'ancestry.fey_touched.label',
                     'description': 'ancestry.fey_touched.description',
                     'attribute': ref('attribute', 'spi'), 'modifier': 1,
                     'faction': {'fact': ref('fact', 'priory_fen_axis'), 'value': -2}},
}
v['text'].update({
    'ancestry.fen_born.label': 'Fen-born',
    'ancestry.fen_born.description': '+1 PER, Swim learned, Fen standing +2.',
    'ancestry.road_born.label': 'Road-born',
    'ancestry.road_born.description': '+1 DEX, Haggle learned. Crown standing comes in a later chapter.',
    'ancestry.hill_folk.label': 'Hill-folk',
    'ancestry.hill_folk.description': '+1 CON, sight in dark places. Mining comes in a later chapter.',
    'ancestry.fey_touched.label': 'Fey-touched',
    'ancestry.fey_touched.description': '+1 SPI, Fen standing +2. Spell words come in chapter two.',
})

canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v036_hash.json').write_text(json.dumps({
    'description': 'D11 once-only saved ancestry choice and six authored attributes over published D6 v035.',
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
labels += ['population/fen_hounds/slot' + str(slot) + '/' + kind for slot in range(1, 5) for kind in ('member', 'pelt')]
labels += ['population/fen_hounds/job']
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f',
              '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v036_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'D11 successor {version}/API1.31: {digest}, {len(answers)} initial IDs.')
