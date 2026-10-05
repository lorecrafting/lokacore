# Independent declared chapter semantics; only the approved catalog is copied from source.
# The versioned release pin stays outside the simulator’s frozen cartridge_*hash demo catalog.
# Numeric-profile canonical encoding and IdSource use Python stdlib, never either kernel.
import hashlib
import json
from pathlib import Path

ID = 'ashmere_missing_child'
VERSION = '0.0.3'
CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'
def ref(kind, key):
    return dict(cartridge_id=ID, cartridge_version=VERSION, kind=kind, key=key)
def key(kind, name):
    return f'{ID}@{VERSION}:{kind}/{name}'
def policy(root):
    return dict(policy_version=1, root=root)
def definition(name, **parts):
    return dict(key=name, **parts)
caps = dict.fromkeys(['movement', 'containment', 'barrier', 'equipment', 'position', 'policy', 'fact', 'quest', 'dialogue', 'resource', 'schedule', 'description_variant', 'calendar', 'death', 'combat', 'inspectable_detail', 'readable'], 1)
v = dict(format='loka-cartridge-v2', manifest=dict(api_version='loka/v3', id=ID, version=VERSION, title='Ashmere — The Missing Child', requires=dict(kernel_api=dict(at_least='1.7', below='2.0'), content_schema=1, rule_ir=1, capabilities=caps, client_features=[]), supported_profiles=['offline_private']), lock=dict(format='loka-capability-lock-v1', capabilities=caps), entry=ref('room', 'ferry_landing'), chapters=[dict(title='chapter.missing_child')])
v['manifest']['time_policy'] = dict(profile='real_elapsed', rate=50)
v['calendar'] = dict(start=64800)
v['facts'] = {key('fact', 'position'): definition('position', version=1, value_type=dict(type='enum', values=['standing', 'sitting', 'resting', 'sleeping'], default='standing'), scopes=['player'], meaning="The character's position (position@1): only its rule writes it.")}
v['policies'] = {}
v['actions'] = {}
# Literal reciprocal geometry; barrier faces share one reference.
geometry = {
    'ferry_landing': [('north', 'well_lane', None)],
    'well_lane': [('south', 'ferry_landing', None), ('east', 'drowned_lantern', None), ('north', 'village_green', None)],
    'village_green': [('north', 'north_gate', None), ('south', 'well_lane', None)],
    'north_gate': [('south', 'village_green', None), ('north', 'chapel_steps', None)],
    'chapel_steps': [('south', 'north_gate', None), ('north', 'chapel_nave', None)],
    'chapel_nave': [('south', 'chapel_steps', None)],
    'drowned_lantern': [('west', 'well_lane', None), ('up', 'inn_rooms', None), ('down', 'lantern_cellar', None)],
    'inn_rooms': [('down', 'drowned_lantern', None), ('up', 'inn_attic', None)],
    'inn_attic': [('down', 'inn_rooms', None)],
    'lantern_cellar': [('up', 'drowned_lantern', None)]}
v['rooms'] = {key('room', name): definition(name, title=f'room.{name}.title', description=f'room.{name}.description', exits={direction: dict(to=ref('room', dest), **(dict(barrier=ref('barrier', barrier)) if barrier else {})) for direction, dest, barrier in exits}) for name, exits in geometry.items()}
# M12-A independently declared fixed detail metadata; no compiler supplies these answers.
v['rooms'][key('room', 'ferry_landing')]['details'] = dict(notice=dict(aliases=['notice', 'landing_notice'], description='detail.notice.description', readable=dict(label='actions.read_notice', text='readable.notice')))
v['rooms'][key('room', 'drowned_lantern')]['details'] = dict(rumor_board=dict(aliases=['rumor_board', 'board'], description='detail.rumor_board.description', readable=dict(label='actions.read_rumor_board', text='readable.rumor_board')))
items = [('brass_key', ['key', 'brass_key'], 'room', 'inn_rooms'), ('tin_whistle', ['whistle', 'tin_whistle'], 'item', 'trunk'), ('trunk', ['trunk'], 'room', 'inn_attic'), ('wool_cloak', ['cloak', 'wool_cloak'], 'room', 'inn_rooms')]
v['rooms'][key('room', 'chapel_nave')]['sanctuary'] = True
v['items'] = {key('item', name): definition(name, keywords=words, short=f'item.{name}.short', room_line=f'item.{name}.room', description=f'item.{name}.description', location={'in': kind, kind: ref(kind, place)}) for name, words, kind, place in items}
# M3 independently declared shell masses; nested/worn custody does not change them.
for name, grams in [('wool_cloak', 3000), ('brass_key', 100), ('tin_whistle', 200), ('trunk', 8000)]:
    v['items'][key('item', name)]['mass_grams'] = grams
v['items'][key('item', 'trunk')]['barrier'] = ref('barrier', 'trunk_lid')
v['items'][key('item', 'wool_cloak')]['slot'] = 'cloak'
for name in ['player_corpse', 'rat_corpse']:
    v['items'][key('item', name)] = definition(name, keywords=['corpse', name], short=f'item.{name}.short', room_line=f'item.{name}.room', description=f'item.{name}.description', location=dict(**{'in': 'template'}), mass_grams=0)
v['npcs'] = {}
# Five authored finite attackable rats; numeric values are literal PM-approved inputs.
for name in ['cellar_rat_1', 'cellar_rat_2', 'cellar_rat_3', 'cellar_rat_4', 'cellar_rat_5']:
    v['npcs'][key('npc', name)] = definition(name, keywords=['rat', name], short='npc.cellar_rat.short', room_line=f'npc.{name}.room', description='npc.cellar_rat.description', room=ref('room', 'lantern_cellar'), hp=dict(minimum=0, maximum=6, start=6, gain=0), attack=dict(chance=50, damage_min=1, damage_max=1))
v['barriers'] = {key('barrier', name): definition(name, keywords=words, short=f'barrier.{name}.short', initial='locked', key_item=ref('item', item)) for name, words, item in [('trunk_lid', ['lid', 'trunk_lid'], 'brass_key')]}
v['resources'] = {key('resource', name): definition(name, minimum=0, maximum=maximum, start=maximum, gain=gain) for name, maximum, gain in [('hp', 10, 5), ('ma', 100, 4), ('mv', 100, 18)]}
# M5-A independently declared HP10/MV100; M2 rates/fractions and MA unchanged.
v['resources'][key('resource', 'mv')].update(
    regen=dict(every=3600, by_position=dict(standing=18, sitting=18, resting=36, sleeping=36)),
    bands=[dict(at_percent=100, key='mv_ready', tone='normal'),
           dict(at_percent=75, key='steady', tone='normal'),
           dict(at_percent=25, key='tired', tone='warning'),
           dict(at_percent=0, key='exhausted', tone='danger')])
v['quests'] = {}
v['dialogues'] = {}
# PM acceptance repair: hand-literal baseline table, independently declared.
v['world'] = {'bands': [
    {'at_percent': 100, 'key': 'ready', 'tone': 'normal'},
    {'at_percent': 90, 'key': 'slightly_scratched', 'tone': 'normal'},
    {'at_percent': 80, 'key': 'few_bruises', 'tone': 'normal'},
    {'at_percent': 70, 'key': 'some_cuts', 'tone': 'warning'},
    {'at_percent': 60, 'key': 'several_wounds', 'tone': 'warning'},
    {'at_percent': 50, 'key': 'many_nasty_wounds', 'tone': 'warning'},
    {'at_percent': 40, 'key': 'bleeding_freely', 'tone': 'warning'},
    {'at_percent': 30, 'key': 'covered_in_blood', 'tone': 'danger'},
    {'at_percent': 20, 'key': 'leaking_guts', 'tone': 'danger'},
    {'at_percent': 10, 'key': 'almost_dead', 'tone': 'danger'},
    {'at_percent': 0, 'key': 'dying', 'tone': 'danger'},
]}
v['world']['carry'] = dict(max_grams=12000)
v['world']['movement'] = dict(cost=dict(resource=ref('resource', 'mv'), amount=1))
v['world']['death'] = dict(player_corpse=ref('item', 'player_corpse'), npc_corpse=ref('item', 'rat_corpse'), shrine=ref('room', 'chapel_nave'), restore=dict(hp=10, mv=100))
v['world']['combat'] = dict(player_attack=dict(chance=75, damage_min=1, damage_max=2), interval=150, sleep_multiplier=2, flee_multiplier=2)
v['world']['combat']['narration'] = {name: f'combat.{name}' for name in ['player_hit', 'player_miss', 'npc_hit', 'npc_miss', 'player_died', 'npc_died']}
v['world']['death_credit'] = [dict(npc=ref('npc', f'cellar_rat_{i}'), room=ref('room', 'lantern_cellar'), fact=ref('fact', f'rat_{i}_killed')) for i in range(1, 6)]
for i in range(1, 6):
    v['facts'][key('fact', f'rat_{i}_killed')] = definition(f'rat_{i}_killed', version=1, value_type=dict(type='bool', default=False), scopes=['player'], meaning=f'The player defeated the authored cellar rat {i} in the lantern cellar.')
# M20-B2 independently declared production reward/storage consumer, not fixture bindings.
v['npcs'][key('npc', 'maud')] = definition('maud', keywords=['maud', 'widow', 'innkeeper'], short='npc.maud.short', room_line='npc.maud.room', description='npc.maud.description', room=ref('room', 'drowned_lantern'))
v['items'][key('item', 'cellar_key')] = definition('cellar_key', keywords=['key', 'storage_key', 'cellar_key'], short='item.cellar_key.short', room_line='item.cellar_key.room', description='item.cellar_key.description', mass_grams=100, location={'in': 'npc', 'npc': ref('npc', 'maud')})
v['items'][key('item', 'storage_chest')] = definition('storage_chest', keywords=['chest', 'storage_chest'], short='item.storage_chest.short', room_line='item.storage_chest.room', description='item.storage_chest.description', mass_grams=8000, capacity=12, location={'in': 'room', 'room': ref('room', 'inn_rooms')}, barrier=ref('barrier', 'storage_chest_lid'))
v['barriers'][key('barrier', 'storage_chest_lid')] = definition('storage_chest_lid', keywords=['lid', 'storage_chest_lid'], short='barrier.storage_chest_lid.short', initial='locked', key_item=ref('item', 'cellar_key'))
v['facts'][key('fact', 'maud_trust')] = definition('maud_trust', version=1, value_type=dict(type='int', minimum=-100, maximum=100, default=0), scopes=['player'], meaning='Maud’s trust in the player.')
v['facts'][key('fact', 'inn_cellar_cleared')] = definition('inn_cellar_cleared', version=1, value_type=dict(type='bool', default=False), scopes=['instance'], meaning='Maud’s cellar quest has been completed.')
v['quests'][key('quest', 'mauds_cellar')] = definition('mauds_cellar', title='quest.mauds_cellar.title', objective=dict(evidence='current_state', policy=policy(dict(op='all', items=[dict(op='fact_compare', fact=ref('fact', f'rat_{i}_killed'), equals=True) for i in range(1, 6)]))), journal={state: f'quest.mauds_cellar.{text}' for state, text in [('active', 'active'), ('objectives_met', 'ready'), ('resolved', 'resolved'), ('failed', 'failed'), ('abandoned', 'abandoned')]})
maud_state = lambda state: dict(op='quest_state', quest=ref('quest', 'mauds_cellar'), state=state)
maud_roles = dict(maud=dict(role='npc', npc=ref('npc', 'maud')))
v['dialogues'][key('dialogue', 'maud_offer')] = definition('maud_offer', npc=ref('npc', 'maud'), policy=policy(dict(op='not', item=dict(op='any', items=[maud_state(s) for s in ['active', 'objectives_complete', 'resolved', 'failed', 'abandoned']]))), prompt='dialogue.maud_offer.prompt', roles=maud_roles, choices=dict(accept=dict(label='quest.mauds_cellar.accept', narration='narration.maud.accept', accept=ref('quest', 'mauds_cellar'))))
v['dialogues'][key('dialogue', 'maud_turn_in')] = definition('maud_turn_in', npc=ref('npc', 'maud'), quest=ref('quest', 'mauds_cellar'), policy=policy(maud_state('active')), prompt='dialogue.maud_turn_in.prompt', roles=dict(**maud_roles, key=dict(role='item', item=ref('item', 'cellar_key'))), choices=dict(done=dict(label='dialogue.maud_turn_in.done', narration='narration.maud.done', receive=dict(item='key', **{'from': 'maud'}), sequence=[dict(op='fact.adjust', fact=ref('fact', 'maud_trust'), amount=5), dict(op='fact.assign', fact=ref('fact', 'inn_cellar_cleared'), value=True)])))
for name in ['trunk', 'storage_chest', 'player_corpse', 'rat_corpse']:
    v['items'][key('item', name)]['container'] = True
v['text'] = json.loads(Path('cartridges/ashmere_missing_child/text.json').read_text())
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
sha = hashlib.sha256(canonical.encode()).hexdigest()
fixture = dict(description='Independent Python known answer: literal approved chapter semantics and compiler-owned defaults; only the chapter text catalog is copied from source. No compiler or kernel supplies expected values.', value=v, canonical=canonical, sha256=sha)
Path('protocol/fixtures/missing_child_v003_hash.json').write_text(json.dumps(fixture, indent=2, ensure_ascii=False)+'\n')
print(sha)
# Reviewed allocation order: character, body, ten rooms, board/notice details, five rats/Maud, six items, cloak holder.
names = ['character', 'body'] + ['room/'+name for name in sorted(geometry)] + ['detail/rumor_board', 'detail/notice'] + ['npc/'+name for name in ['cellar_rat_1', 'cellar_rat_2', 'cellar_rat_3', 'cellar_rat_4', 'cellar_rat_5', 'maud']] + ['item/'+name for name in ['brass_key', 'cellar_key', 'storage_chest', 'tin_whistle', 'trunk', 'wool_cloak']] + ['slot/cloak']
ids = {}
for ordinal, name in enumerate(names):
    b = bytearray(hashlib.sha256(json.dumps(['loka-id-v1', CONTEXT, '00000000-0000-0000-0000-000000000000', ordinal], separators=(',', ':')).encode()).digest()[:16])
    b[6] = (b[6] & 15) | 128
    b[8] = (b[8] & 63) | 128
    s = b.hex()
    ids[name] = '-'.join([s[:8], s[8:12], s[12:16], s[16:20], s[20:]])
Path('protocol/fixtures/missing_child_v003_ids.json').write_text(json.dumps(ids, indent=2)+'\n')
