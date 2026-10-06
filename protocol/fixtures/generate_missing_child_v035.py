"""Independent D6 water answer over frozen published D12 v034; literal selected values."""
import hashlib
import json
import uuid
from pathlib import Path

here = Path(__file__).parent
version = '0.0.35'
v = json.loads((here / 'missing_child_v034_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.34', version))

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version,
            'kind': kind, 'key': key}

def named(kind, key):
    return f'ashmere_missing_child@{version}:{kind}/{key}'

v['manifest']['requires']['kernel_api']['at_least'] = '1.30'
v['manifest']['requires']['capabilities']['water'] = 1
v['lock']['capabilities']['water'] = 1
v['rooms'][named('room', 'well_shaft')]['exits']['down'] = {'to': ref('room', 'well_bottom')}
v['rooms'][named('room', 'black_pool')]['exits']['down'] = {'to': ref('room', 'pool_bottom')}
v['rooms'][named('room', 'well_bottom')] = {
    'key': 'well_bottom', 'title': 'room.well_bottom.title',
    'description': 'room.well_bottom.description',
    'dark_description': 'room.well_bottom.dark',
    'exits': {'up': {'to': ref('room', 'well_shaft')}},
    'details': {'initials': {'aliases': ['initials', 'carving'],
                            'description': 'detail.bottom_initials.description'}},
}
v['rooms'][named('room', 'pool_bottom')] = {
    'key': 'pool_bottom', 'title': 'room.pool_bottom.title',
    'description': 'room.pool_bottom.description',
    'dark_description': 'room.pool_bottom.dark',
    'exits': {'up': {'to': ref('room', 'black_pool')}},
}
for key, mass, location in [
    ('old_coin', 10, {'in': 'room', 'room': ref('room', 'well_bottom')}),
    ('sunken_chest', 2000, {'in': 'room', 'room': ref('room', 'pool_bottom')}),
    ('silver_ring', 5, {'in': 'item', 'item': ref('item', 'sunken_chest')}),
]:
    v['items'][named('item', key)] = {
        'key': key, 'keywords': [key], 'short': f'item.{key}.short',
        'room_line': f'item.{key}.room', 'description': f'item.{key}.description',
        'mass_grams': mass, 'location': location,
    }
v['items'][named('item', 'sunken_chest')].update({'container': True, 'capacity': 1})
v['world']['water'] = {
    'skill': ref('skill', 'swim'), 'maximum_grams': 6000, 'entry_cost': 10,
    'duration': 6000, 'warning': 'water.warning', 'drowned': 'water.drowned',
    'routes': [
        {'surface': ref('room', 'well_shaft'), 'bottom': ref('room', 'well_bottom')},
        {'surface': ref('room', 'black_pool'), 'bottom': ref('room', 'pool_bottom')},
    ],
}
v['text'].update({
    'water.warning': 'You must know how to swim and carry at most 6000g. Diving costs 10 MV. Surface within 120 real seconds or drown.',
    'water.drowned': 'Your breath fails. Your belongings remain in your corpse below; you return to the Chapel.',
    'action.recover_corpse': 'Recover belongings',
    'room.well_bottom.title': 'Well Bottom',
    'room.well_bottom.description': 'The drowned stones bear [carved initials](initials). An old coin rests in the silt. The shaft leads up.',
    'room.well_bottom.dark': 'The water is black. You know the shaft leads up.',
    'detail.bottom_initials.description': 'Two worn initials are cut deep into the drowned masonry.',
    'room.pool_bottom.title': 'Pool Bottom',
    'room.pool_bottom.description': 'A sunken chest rests on the bottom. The bank lies above.',
    'room.pool_bottom.dark': 'Dark water presses around you. You know the bank lies above.',
    'item.old_coin.short': 'old coin',
    'item.old_coin.room': 'A [old coin] lies here.',
    'item.old_coin.description': 'A worn coin, green with age.',
    'item.sunken_chest.short': 'sunken chest',
    'item.sunken_chest.room': 'A [sunken chest] lies here.',
    'item.sunken_chest.description': 'A heavy chest rests open, its corners dark with silt.',
    'item.silver_ring.short': 'silver ring',
    'item.silver_ring.room': 'A [silver ring] lies here.',
    'item.silver_ring.description': 'A plain silver band, cold from the water.',
    'item.recovered': 'You recover',
})
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v035_hash.json').write_text(json.dumps({
    'description': 'D6 two water bottoms, bound drowning deadline and owned-corpse recovery over published D12 v034.',
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
(here / 'missing_child_v035_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent D6 successor {version}/API1.30: {digest}, {len(answers)} initial IDs.')
