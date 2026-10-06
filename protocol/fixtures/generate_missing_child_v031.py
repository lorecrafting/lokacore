"""Independent C4 v031 successor over published D1 v030.
Only the C4 pack and narration literals below change; no compiler/kernel import.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
version = '0.0.31'
v = json.loads((here / 'missing_child_v030_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.30', version))
v['manifest']['requires']['kernel_api']['at_least'] = '1.27'
v['populations']['ashmere_missing_child@0.0.31:population/fen_hounds']['pack'] = {
    'flight_below_percent': 25,
    'flight_fare': 0,
    'narration': {
        'helper_joined': 'combat.hound_helper_joined',
        'enemy_fled': {'east': 'combat.hound_fled_east', 'west': 'combat.hound_fled_west'},
        'primary_changed': 'combat.hound_primary_changed',
        'pack_withdrew': 'combat.hound_pack_withdrew',
    },
}
v['text'].update({
    'combat.hound_helper_joined': 'Another fen hound turns to defend its pack.',
    'combat.hound_fled_east': 'A wounded fen hound bolts east into Adder Nest.',
    'combat.hound_fled_west': 'A wounded fen hound bolts west into Hound Run.',
    'combat.hound_primary_changed': 'Another fen hound becomes your immediate opponent.',
    'combat.hound_pack_withdrew': 'No hound remains in this fight.',
})
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v031_hash.json').write_text(json.dumps({
    'description': 'C4 hound aggression, bounded pack help and wounded flight over published D1 v030.',
    'value': v, 'canonical': canonical, 'sha256': digest,
}, indent=2, ensure_ascii=False) + '\n')
rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + ['room/' + room['key'] for _, room in rooms]
labels += ['detail/' + room['key'] + '/' + key for _, room in rooms for key in sorted(room.get('details', {}))]
labels += ['npc/' + npc['key'] for _, npc in sorted(v['npcs'].items()) if not npc.get('spawn_template')]
labels += ['item/' + item['key'] for _, item in sorted(v['items'].items()) if item['location']['in'] != 'template']
labels += ['job/' + npc['key'] for _, npc in sorted(v['npcs'].items()) if npc.get('daily_schedule')]
labels += ['slot/' + slot for slot in sorted({item['slot'] for item in v['items'].values() if 'slot' in item})]
labels += ['population/fen_hounds/slot' + str(slot) + '/' + kind
           for slot in range(1, 5) for kind in ('member', 'pelt')]
labels += ['population/fen_hounds/job']
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f',
              '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v031_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent C4+D1 successor {version}/API1.27: {digest}, {len(answers)} initial IDs.')
