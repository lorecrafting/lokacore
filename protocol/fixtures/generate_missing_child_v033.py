"""Independent D3 v033 over published C4+D4 v032. Literal declarations; no compiler/kernel imports."""
import hashlib
import json
from pathlib import Path

import uuid
here = Path(__file__).parent
version = '0.0.33'
v = json.loads((here / 'missing_child_v032_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.32', version))

def ref(kind, key):
    return {'cartridge_id': 'ashmere_missing_child', 'cartridge_version': version, 'kind': kind, 'key': key}

def expand(value):
    if isinstance(value, list):
        return [expand(x) for x in value]
    if not isinstance(value, dict):
        return value
    result = {k: expand(x) for (k, x) in value.items()}
    for (name, kind) in {'to': 'room', 'room': 'room', 'npc': 'npc'}.items():
        if isinstance(result.get(name), str):
            result[name] = ref(kind, result[name])
    if 'daily_schedule' in result:
        result['daily_schedule'] = {h: ref('room', room) for (h, room) in result['daily_schedule'].items()}
    return result
rooms = {'old_mill': {'title': 'room.old_mill.title',
              'description': 'room.old_mill.description',
              'exits': {'north': {'to': 'boathouse'},
                        'south': {'to': 'empty_cottage'},
                        'up': {'to': 'mill_loft'},
                        'down': {'to': 'mill_cellar'}},
              'details': {'millstone': {'aliases': ['millstone', 'stone'],
                                        'description': 'detail.old_mill.millstone.description'},
                          'grain_sacks': {'aliases': ['grain_sacks', 'sacks'],
                                          'description': 'detail.old_mill.grain_sacks.description'},
                          'ledger': {'aliases': ['ledger', 'hob_ledger'],
                                     'description': 'detail.old_mill.ledger.description',
                                     'readable': {'title': 'detail.old_mill.ledger.title',
                                                  'label': 'actions.read_book',
                                                  'text': 'readable.old_mill.ledger'}}}},
 'mill_loft': {'title': 'room.mill_loft.title',
               'description': 'room.mill_loft.description',
               'exits': {'down': {'to': 'old_mill'}},
               'details': {'owl': {'aliases': ['owl'],
                                   'description': 'detail.mill_loft.owl.description'},
                           'loose_board': {'aliases': ['loose_board', 'board'],
                                           'description': 'detail.mill_loft.loose_board.description'}},
               'dark_description': 'room.mill_loft.dark'},
 'mill_cellar': {'title': 'room.mill_cellar.title',
                 'description': 'room.mill_cellar.description',
                 'exits': {'up': {'to': 'old_mill'}},
                 'details': {'grain_bins': {'aliases': ['grain_bins', 'bins'],
                                            'description': 'detail.mill_cellar.grain_bins.description'},
                             'rat_holes': {'aliases': ['rat_holes', 'holes'],
                                           'description': 'detail.mill_cellar.rat_holes.description'}},
                 'dark_description': 'room.mill_cellar.dark'},
 'empty_cottage': {'title': 'room.empty_cottage.title',
                   'description': 'room.empty_cottage.description',
                   'exits': {'north': {'to': 'old_mill'}, 'up': {'to': 'cottage_loft'}},
                   'details': {'sign': {'aliases': ['sign', 'for_sale_sign'],
                                        'description': 'detail.empty_cottage.sign.description',
                                        'readable': {'title': 'detail.empty_cottage.sign.title',
                                                     'label': 'actions.read_book',
                                                     'text': 'readable.empty_cottage.sign'}},
                               'hearth': {'aliases': ['hearth', 'cold_hearth'],
                                          'description': 'detail.empty_cottage.hearth.description'}}},
 'cottage_loft': {'title': 'room.cottage_loft.title',
                  'description': 'room.cottage_loft.description',
                  'exits': {'down': {'to': 'empty_cottage'}},
                  'details': {'rafters': {'aliases': ['rafters', 'bare_rafters'],
                                          'description': 'detail.cottage_loft.rafters.description'}}}}
for (key, room) in rooms.items():
    v['rooms'][f'ashmere_missing_child@{version}:room/{key}'] = {'key': key, **expand(room)}
v['rooms'][f'ashmere_missing_child@{version}:room/boathouse']['exits']['south'] = {'to': ref('room', 'old_mill')}
v['npcs'][f'ashmere_missing_child@{version}:npc/hob'] = {'key': 'hob', **expand({'keywords': ['hob', 'miller'], 'short': 'npc.hob.short', 'room_line': 'npc.hob.room', 'description': 'npc.hob.description', 'room': 'mill_loft', 'daily_schedule': {'6': 'old_mill', '18': 'mill_loft'}})}
v['dialogues'][f'ashmere_missing_child@{version}:dialogue/hob'] = {'key': 'hob', **expand({'prompt': 'dialogue.hob.prompt', 'choices': {'leave': {'label': 'dialogue.hob.leave', 'narration': 'dialogue.hob.prompt'}}, 'npc': 'hob', 'policy': {'policy_version': 1, 'root': {'op': 'all', 'items': []}}, 'roles': {'hob': {'role': 'npc', 'npc': 'hob'}}})}
v['text'].update(
{'room.old_mill.title': 'Old Mill',
 'room.old_mill.description': 'The still [millstone](millstone) fills the floor. [Grain '
                              "sacks](grain_sacks) lean against its base, and [Hob's "
                              'ledger](ledger) lies open beside it. Stairs lead up to the loft '
                              'and down to the cellar; the southern door opens toward an empty '
                              'cottage.',
 'detail.old_mill.millstone.description': 'A worn millstone rests over a scatter of flour.',
 'detail.old_mill.grain_sacks.description': 'The sacks smell of dry grain and the river.',
 'detail.old_mill.ledger.description': 'A clothbound ledger lies beside the millstone.',
 'detail.old_mill.ledger.title': "Hob's ledger",
 'readable.old_mill.ledger': 'Grain received, flour delivered. Hob has balanced every line; a '
                             'note in the margin reads: Mind the loose board upstairs.',
 'room.mill_loft.title': 'Mill Loft',
 'room.mill_loft.description': 'An [owl](owl) watches from the rafters. One [loose '
                               'board](loose_board) stands proud of the dusty floor; the stair '
                               'descends to the mill.',
 'detail.mill_loft.owl.description': 'The owl follows your movements with round, quiet eyes.',
 'detail.mill_loft.loose_board.description': 'The board creaks underfoot. Pale scratches run '
                                             'along its edge, but it reveals no passage.',
 'room.mill_loft.dark': 'Darkness fills the loft. The stair leads down.',
 'room.mill_cellar.title': 'Mill Cellar',
 'room.mill_cellar.description': '[Grain bins](grain_bins) crowd the stone cellar. Small [rat '
                                 'holes](rat_holes) open beneath them; the stair returns to '
                                 'the mill above.',
 'detail.mill_cellar.grain_bins.description': 'The wooden bins hold a thin layer of old grain.',
 'detail.mill_cellar.rat_holes.description': 'Tiny holes disappear into the masonry. Nothing '
                                             'stirs inside them.',
 'room.mill_cellar.dark': 'Darkness fills the cellar. The stair leads up.',
 'room.empty_cottage.title': 'Empty Cottage',
 'room.empty_cottage.description': 'A [for-sale sign](sign) hangs by the door. The [cold '
                                   'hearth](hearth) is swept clean, and a narrow stair climbs '
                                   'to the loft. The mill stands to the north.',
 'detail.empty_cottage.sign.description': 'A weathered sign hangs from a nail beside the door.',
 'detail.empty_cottage.hearth.description': 'The hearth is cold and empty. No ashes remain.',
 'detail.empty_cottage.sign.title': 'For-sale sign',
 'readable.empty_cottage.sign': 'This cottage is for sale. Enquiries may be left with the '
                                'miller. No terms have been agreed.',
 'room.cottage_loft.title': 'Cottage Loft',
 'room.cottage_loft.description': '[Bare rafters](rafters) frame the small loft. Dust lies '
                                  'undisturbed beneath the sloping roof; the stair descends to '
                                  'the empty room below.',
 'detail.cottage_loft.rafters.description': 'The unpainted rafters bear the marks of an old '
                                            "carpenter's tools.",
 'npc.hob.short': 'Hob',
 'npc.hob.room': '[Hob](hob) brushes flour from his sleeves.',
 'npc.hob.description': 'The miller has flour in the seams of his coat and a patient, watchful '
                        'manner.',
 'dialogue.hob.prompt': 'Hob says, “The wheel is quiet tonight. Mind your footing on the loft '
                        'boards.”',
 'dialogue.hob.leave': 'Leave'}
)
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v033_hash.json').write_text(json.dumps({'description': 'D3 Western Ashmere rooms, Hob and ordinary readable mill/cottage details over published C4+D4 v032.', 'value': v, 'canonical': canonical, 'sha256': digest}, indent=2, ensure_ascii=False) + '\n')
rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + ['room/' + room['key'] for (_, room) in rooms]
labels += ['detail/' + room['key'] + '/' + key for (_, room) in rooms for key in sorted(room.get('details', {}))]
labels += ['npc/' + npc['key'] for (_, npc) in sorted(v['npcs'].items()) if not npc.get('spawn_template')]
labels += ['item/' + item['key'] for (_, item) in sorted(v['items'].items()) if item['location']['in'] != 'template']
labels += ['job/' + npc['key'] for (_, npc) in sorted(v['npcs'].items()) if npc.get('daily_schedule')]
labels += ['slot/' + slot for slot in sorted({item['slot'] for item in v['items'].values() if 'slot' in item})]
labels += ['consumed']
labels += ['population/fen_hounds/slot' + str(slot) + '/' + kind for slot in range(1, 5) for kind in ('member', 'pelt')]
labels += ['population/fen_hounds/job']
answers = {}
for (ordinal, label) in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = raw[6] & 15 | 128
    raw[8] = raw[8] & 63 | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v033_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent D3 successor {version}/API1.28: {digest}, {len(answers)} initial IDs.')
