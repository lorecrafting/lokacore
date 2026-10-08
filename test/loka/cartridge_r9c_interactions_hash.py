# Independent known answer for the synthetic R9C interaction cartridge (E2 S1).
# Base: the frozen, independently reviewed v042 chapter answer, renamed; the removals and the
# changed numbers below are literal. Only the text catalog is copied from source. Python
# stdlib only: no compiler or kernel supplies an expected value.
#   python3 test/loka/cartridge_r9c_interactions_hash.py   (from the repository root)
import hashlib
import json
import uuid
from pathlib import Path

ID, VERSION = 'r9c_interactions', '0.0.1'
fixtures = Path('protocol/fixtures')
base = json.loads((fixtures / 'missing_child_v042_hash.json').read_text())
assert base['sha256'] == '5d8b0e3a16b209733707a8450cee5a4330965092498cf1d31ab8fdae9a50fc8b'


def renamed(v):
    if isinstance(v, dict):
        return {k.replace('ashmere_missing_child@0.0.42:', f'{ID}@{VERSION}:'): renamed(x) for k, x in v.items()}
    if isinstance(v, list):
        return [renamed(x) for x in v]
    return {'ashmere_missing_child': ID, '0.0.42': VERSION}.get(v, v) if isinstance(v, str) else v


def ref(kind, key):
    return {'cartridge_id': ID, 'cartridge_version': VERSION, 'kind': kind, 'key': key}


def named(kind, key):
    return f'{ID}@{VERSION}:{kind}/{key}'


v = renamed(base['value'])
v['manifest']['title'] = 'R9C interactions (synthetic)'
# Rooms outside the seven families' shared topology, and everything that only they used.
dropped_rooms = {
    'spire', 'scriptorium', 'kitchen_garden', 'prior_study', 'old_mill', 'empty_cottage', 'cottage_loft',
    'mill_loft', 'mill_cellar', 'elspeth_cottage', 'watch_cell', 'gate_tower', 'inn_attic', 'lantern_cellar',
    'chandler_storeroom', 'black_pool', 'pool_bottom', 'fishing_shallows', 'oak_crown', 'marsh_light',
    'old_causeway', 'tide_flats', 'fox_den_deep', 'herb_garden', 'isle_shrine', 'isle_hut', 'hut_loft',
    'smithy', 'orchard', 'cloister', 'infirmary'}
d9 = [f'a0_d9_{who}_{pair}' for who in ('elspeth', 'maud') for pair in ('lost_prior', 'rescued_fox', 'rescued_prior', 'stays_fox', 'stays_prior')]
d9 += [f'a0_d9_{who}_{side}' for who in ('aldric', 'sedge', 'vesper') for side in ('fox', 'prior')]
dropped = {
    'rooms': ('room', dropped_rooms),
    'npcs': ('npc', {'ada', 'ash', 'hale', 'gareth', 'hob', 'wisp', 'orchard_deer'} | {f'cellar_rat_{i}' for i in range(1, 6)}),
    'items': ('item', {'bell_rites', 'ward_of_the_fen', 'brass_key', 'trunk', 'tin_whistle', 'cellar_key',
                       'storage_chest', 'silver_ring', 'sunken_chest', 'tithe_ledger'}),
    'barriers': ('barrier', {'trunk_lid', 'storage_chest_lid'}),
    'quests': ('quest', {'chandlers_debt', 'mauds_cellar', 'wisp_ward'}),
    'recipes': ('recipe', {'seek_wisp'}),
    'topics': ('topic', {'bell', 'ward'}),
    'populations': ('population', {'orchard_deer'}),
    'population_bundles': ('population_bundle', {'orchard_deer'}),
    'dialogues': ('dialogue', set(d9) | {'a_aldric_debt', 'a_peg_debt', 'c_aldric_ward', 'a_wisp_offer', 'b_wisp_riddle',
                                         'ada', 'ash', 'gareth', 'hale', 'hob', 'maud_offer', 'maud_turn_in'}),
    'facts': ('fact', {f'rat_{i}_killed' for i in range(1, 6)} | {'maud_trust', 'inn_cellar_cleared', 'peg_trust',
                       'priory_tithe_delivered', 'fen_wisp_discovered', 'fen_wisp_answered', 'topic_ward_known', 'topic_bell_known'}),
}
for field, (kind, keys) in dropped.items():
    for key in keys:
        del v[field][named(kind, key)]
del v['topics']  # an artifact omits the optional topic map when no topic remains
for room in v['rooms'].values():
    room['exits'] = {d: e for d, e in room['exits'].items() if e['to']['key'] not in dropped_rooms}
# The inn's rumor board only advertised the removed whistle and cellar quest.
del v['rooms'][named('room', 'drowned_lantern')]['details']
v['map_positions'] = [p for p in v['map_positions'] if p['room']['key'] not in dropped_rooms]
for caps in (v['manifest']['requires']['capabilities'], v['lock']['capabilities']):
    del caps['check'], caps['topics']
world = v['world']
del world['death_credit']
world['water']['routes'] = [{'surface': ref('room', 'well_shaft'), 'bottom': ref('room', 'well_bottom')}]
world['bell_cue']['rooms'] = [r for r in world['bell_cue']['rooms'] if r['key'] not in dropped_rooms]
# Literal moves: Sedge and Wick join kept rooms; the apples lie on the Green.
v['npcs'][named('npc', 'sedge')]['room'] = ref('room', 'fen_isle_landing')
v['npcs'][named('npc', 'wick')]['room'] = ref('room', 'chapel_nave')
for n in (1, 2, 3):
    v['items'][named('item', f'apple_0{n}')]['location'] = {'in': 'room', 'room': ref('room', 'village_green')}
# Synthetic numbers differ from the chapter's, so an engine literal equal to a chapter value shows.
outbound = v['transports'][named('transport', 'fen_outbound')]
outbound['fare'] = 5
outbound['recovery_rooms'] = [ref('room', 'fen_isle_landing')]
v['services'][named('service', 'lantern_room')]['price'] = 4
v['text'] = json.loads(Path(f'cartridges/{ID}/text.json').read_text())
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(fixtures / f'{ID}_hash.json').write_text(json.dumps({
    'description': 'E2 S1 synthetic R9C interaction cartridge: frozen v042 answer renamed, literal removals, moves and numbers; catalog copied from source. Independent Python known answer.',
    'value': json.loads(canonical), 'canonical': canonical, 'sha256': digest,
}, indent=2, ensure_ascii=False) + '\n')

# Allocation: the reviewed v041/v042 label order over this value, then the IdSource formula.
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
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(fixtures / f'{ID}_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'{ID}@{VERSION}: {digest}, {len(v["rooms"])} rooms, {len(answers)} initial IDs.')
