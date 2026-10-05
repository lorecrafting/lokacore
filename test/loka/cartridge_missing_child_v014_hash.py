# Independent declared chapter semantics; only the approved catalog is copied from source.
# The versioned release pin stays outside the simulator’s frozen cartridge_*hash demo catalog.
# Numeric-profile canonical encoding and IdSource use Python stdlib, never either kernel.
import hashlib
import json
from pathlib import Path

ID = 'ashmere_missing_child'
VERSION = '0.0.14'
CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'
def ref(kind, key):
    return dict(cartridge_id=ID, cartridge_version=VERSION, kind=kind, key=key)
def key(kind, name):
    return f'{ID}@{VERSION}:{kind}/{name}'
def policy(root):
    return dict(policy_version=1, root=root)
def definition(name, **parts):
    return dict(key=name, **parts)
caps = dict.fromkeys(['movement', 'containment', 'barrier', 'equipment', 'position', 'policy', 'fact', 'quest', 'dialogue', 'resource', 'schedule', 'description_variant', 'calendar', 'death', 'combat', 'inspectable_detail', 'readable', 'reaction', 'action_recipe', 'escort', 'scene'], 1)
v = dict(format='loka-cartridge-v2', manifest=dict(api_version='loka/v3', id=ID, version=VERSION, title='Ashmere — The Missing Child', requires=dict(kernel_api=dict(at_least='1.13', below='2.0'), content_schema=1, rule_ir=1, capabilities=caps, client_features=[]), supported_profiles=['offline_private']), lock=dict(format='loka-capability-lock-v1', capabilities=caps), entry=ref('room', 'ferry_landing'), chapters=[dict(title='chapter.missing_child')])
v['manifest']['time_policy'] = dict(profile='real_elapsed', rate=50)
v['calendar'] = dict(start=64800, units_per_hour=3600, hours_per_day=24, subdivisions_per_hour=60,
    solar=[dict(at=at, phase=phase) for at, phase in [(18000, 'dawn'), (25200, 'day'), (64800, 'dusk'), (72000, 'night')]],
    lunar=dict(period=2419200, origin=0, phases=[dict(at=i*302400, phase=phase) for i, phase in enumerate(['new', 'waxing_crescent', 'first_quarter', 'waxing_gibbous', 'full', 'waning_gibbous', 'last_quarter', 'waning_crescent'])]))
v['facts'] = {key('fact', 'position'): definition('position', version=1, value_type=dict(type='enum', values=['standing', 'sitting', 'resting', 'sleeping'], default='standing'), scopes=['player'], meaning="The character's position (position@1): only its rule writes it.")}
v['policies'] = {}
v['actions'] = {}
# Literal reciprocal geometry; barrier faces share one reference.
geometry = {
    'ferry_landing': [('north', 'well_lane', None), ('south', 'reed_path', None)],
    'well_lane': [('south', 'ferry_landing', None), ('east', 'drowned_lantern', None), ('north', 'village_green', None)],
    'village_green': [('north', 'north_gate', None), ('south', 'well_lane', None)],
    'north_gate': [('south', 'village_green', None), ('north', 'chapel_steps', None)],
    'chapel_steps': [('south', 'north_gate', None), ('north', 'chapel_nave', None)],
    'chapel_nave': [('south', 'chapel_steps', None), ('up', 'bell_tower', None)],
    'bell_tower': [('down', 'chapel_nave', None), ('up', 'belfry', None)],
    'belfry': [('down', 'bell_tower', None)],
    'drowned_lantern': [('west', 'well_lane', None), ('up', 'inn_rooms', None), ('down', 'lantern_cellar', None)],
    'inn_rooms': [('down', 'drowned_lantern', None), ('up', 'inn_attic', None)],
    'inn_attic': [('down', 'inn_rooms', None)],
    'lantern_cellar': [('up', 'drowned_lantern', None)],
    'reed_path': [('north', 'ferry_landing', None), ('south', 'reed_bank', None)],
    'reed_bank': [('north', 'reed_path', None), ('west', 'willow_shade', None), ('south', 'mire_crossing', None)],
    'willow_shade': [('east', 'reed_bank', None), ('south', 'drowned_oak', None)],
    'drowned_oak': [('north', 'willow_shade', None), ('east', 'mire_crossing', None)],
    'mire_crossing': [('north', 'reed_bank', None), ('west', 'drowned_oak', None), ('south', 'fox_hollow', None)],
    'fox_hollow': [('north', 'mire_crossing', None)]}
v['rooms'] = {key('room', name): definition(name, title=f'room.{name}.title', description=f'room.{name}.description', exits={direction: dict(to=ref('room', dest), **(dict(barrier=ref('barrier', barrier)) if barrier else {})) for direction, dest, barrier in exits}) for name, exits in geometry.items()}
# M12-A independently declared fixed detail metadata; no compiler supplies these answers.
v['rooms'][key('room', 'ferry_landing')]['details'] = dict(notice=dict(aliases=['notice', 'landing_notice'], description='detail.notice.description', readable=dict(label='actions.read_notice', text='readable.notice', title='detail.notice.title')))
v['rooms'][key('room', 'reed_path')]['details'] = dict(fox_prints=dict(aliases=['fox_prints', 'prints'], description='detail.fox_prints.description', readable=dict(label='actions.read_fox_prints', text='readable.fox_prints', title='detail.fox_prints.title')))
v['rooms'][key('room', 'reed_bank')]['details'] = dict(tracks=dict(aliases=['tracks'], description='detail.tracks.description', readable=dict(label='actions.read_tracks', text='readable.tracks', title='detail.tracks.title')))
for room, detail in [('mire_crossing', 'plank'), ('fox_hollow', 'hollow')]:
    v['rooms'][key('room', room)]['details'] = {detail: dict(aliases=[detail], description=f'detail.{detail}.description', readable=dict(label=f'actions.read_{detail}', text=f'readable.{detail}', title=f'detail.{detail}.title'))}
v['rooms'][key('room', 'drowned_lantern')]['details'] = dict(
    rumor_board=dict(aliases=['rumor_board', 'board'], description='detail.rumor_board.description', notice_board=dict(title='detail.rumor_board.title', notices=[dict(detail='lost_whistle', title='detail.lost_whistle.title'), dict(detail='cellar_help', title='detail.cellar_help.title')])),
    lost_whistle=dict(aliases=['lost_whistle'], description='detail.lost_whistle.description', readable=dict(label='actions.read_lost_whistle', text='readable.lost_whistle')),
    cellar_help=dict(aliases=['cellar_help'], description='detail.cellar_help.description', readable=dict(label='actions.read_cellar_help', text='readable.cellar_help')))
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
for name in ['hp', 'ma']:
    v['resources'][key('resource', name)]['gain_every'] = 3600
# M5-A independently declared HP10/MV100; M2 rates/fractions and MA unchanged.
v['resources'][key('resource', 'mv')].update(
    regen=dict(every=3600, by_position=dict(standing=18, sitting=18, resting=36, sleeping=36)),
    bands=[dict(at_percent=100, key='mv_ready', tone='normal'),
           dict(at_percent=75, key='steady', tone='normal'),
           dict(at_percent=25, key='tired', tone='warning'),
           dict(at_percent=0, key='exhausted', tone='danger')])
v['quests'] = {}
v['dialogues'] = {}
# Opening Elspeth: fixed landing placement, informational directions and explicit Q1 acceptance.
v['npcs'][key('npc', 'elspeth')] = definition('elspeth', keywords=['elspeth', 'mother'], short='npc.elspeth.short', room_line='npc.elspeth.room', description='npc.elspeth.description', room=ref('room', 'ferry_landing'))
v['dialogues'][key('dialogue', 'elspeth')] = definition('elspeth', npc=ref('npc', 'elspeth'), policy=policy(dict(op='all', items=[])), prompt='dialogue.elspeth.prompt', roles=dict(elspeth=dict(role='npc', npc=ref('npc', 'elspeth'))), choices={name: dict(label=f'dialogue.elspeth.{name}', narration=f'narration.elspeth.{name}') for name in ['directions', 'inn', 'wren']})
# Q1-A independently declared village clue, current possession and report priority.
v['items'][key('item', 'fox_drawing')] = definition('fox_drawing', keywords=['drawing', 'fox_drawing'], short='item.fox_drawing.short', room_line='item.fox_drawing.room', description='item.fox_drawing.description', mass_grams=20, location={'in': 'room', 'room': ref('room', 'village_green')})
v['quests'][key('quest', 'first_lead')] = definition('first_lead', title='quest.first_lead.title', objective=dict(evidence='current_state', policy=policy(dict(op='has_item', item=ref('item', 'fox_drawing')))), journal={state: f'quest.first_lead.{text}' for state, text in [('active', 'active'), ('objectives_met', 'ready'), ('resolved', 'resolved'), ('failed', 'failed'), ('abandoned', 'abandoned')]})
v['dialogues'][key('dialogue', 'elspeth')]['choices']['accept'] = dict(label='dialogue.elspeth.accept', narration='narration.elspeth.accept', accept=ref('quest', 'first_lead'))
v['dialogues'][key('dialogue', 'a_elspeth_report')] = definition('a_elspeth_report', npc=ref('npc', 'elspeth'), quest=ref('quest', 'first_lead'), policy=policy(dict(op='all', items=[dict(op='quest_state', quest=ref('quest', 'first_lead'), state='active'), dict(op='has_item', item=ref('item', 'fox_drawing'))])), prompt='dialogue.elspeth_report.prompt', roles=dict(elspeth=dict(role='npc', npc=ref('npc', 'elspeth'))), choices=dict(report=dict(label='dialogue.elspeth_report.report', narration='narration.elspeth.report')))
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
# Q2-A independently declared producer and guarded first-lead consumer.
v['facts'][key('fact', 'fen_tracks_found')] = definition('fen_tracks_found', version=1, value_type=dict(type='bool', default=False), scopes=['player'], meaning='The player studied the Reed Bank tracks during the search for Wren.')
v['quests'][key('quest', 'missing_child')] = definition('missing_child', title='quest.missing_child.title', objective=dict(evidence='current_state', policy=policy(dict(op='fact_compare', fact=ref('fact', 'fen_tracks_found'), equals=True))), journal={state: f'quest.missing_child.{text}' for state, text in [('active', 'active'), ('objectives_met', 'lead'), ('resolved', 'resolved'), ('failed', 'failed'), ('abandoned', 'abandoned')]})
v['reactions'] = {key('reaction', 'start_search'): definition('start_search', on=dict(event='quest_resolved', quest=ref('quest', 'first_lead'), outcome='report'), apply=[dict(op='quest.activate', quest=ref('quest', 'missing_child'))])}
v['recipes'] = {key('recipe', 'study_tracks'): definition('study_tracks', label='actions.study_tracks', aliases=['study'], target=dict(kind='detail', room=ref('room', 'reed_bank'), detail='tracks'), priority=10, policy=policy(dict(op='all', items=[dict(op='quest_state', quest=ref('quest', 'missing_child'), state='active'), dict(op='fact_compare', fact=ref('fact', 'fen_tracks_found'), equals=False)])), outcomes=dict(success=dict(sequence=[dict(op='fact.assign', fact=ref('fact', 'fen_tracks_found'), value=True)], narration=dict(actor='narration.study_tracks'))))}
# Q2-B literal encounter roles, progression and answer bank, independent of the compiler/source.
for name, meaning in [('fen_wren_met', 'The player accepted the bound meeting with Wren and Vesper.'), ('fen_vesper_riddle_answered', 'Vesper accepted the player’s letter-bank answer.')]:
    v['facts'][key('fact', name)] = definition(name, version=1, value_type=dict(type='bool', default=False), scopes=['player'], meaning=meaning)
for name in ['vesper', 'wren']:
    v['npcs'][key('npc', name)] = definition(name, keywords=[name], short=f'npc.{name}.short', room_line=f'npc.{name}.room', description=f'npc.{name}.description', room=ref('room', 'fox_hollow'))
def flag(name, value):
    return dict(op='fact_compare', fact=ref('fact', name), equals=value)
search_active = dict(op='quest_state', quest=ref('quest', 'missing_child'), state='active')
for name, conditions, choice, assignment in [
    ('a_vesper_meeting', [search_active, flag('fen_tracks_found', True), flag('fen_wren_met', False)], 'meet_wren', 'fen_wren_met'),
    ('b_vesper_riddle', [search_active, flag('fen_wren_met', True), flag('fen_vesper_riddle_answered', False)], 'answer', 'fen_vesper_riddle_answered'),
    ('vesper', [], 'greet', None)]:
    option = dict(label=f'dialogue.{name}.{choice}', narration=f'narration.{name}')
    if assignment:
        option['sequence'] = [dict(op='fact.assign', fact=ref('fact', assignment), value=True)]
    d = definition(name, npc=ref('npc', 'vesper'), policy=policy(dict(op='all', items=conditions)), prompt=f'dialogue.{name}.prompt', roles={role: dict(role='npc', npc=ref('npc', role)) for role in ['vesper', 'wren']}, choices={choice: option})
    if name == 'b_vesper_riddle':
        d['riddle'] = dict(choice_id='answer', answer='lantern', bank=['R', 'N', 'A', 'O', 'L', 'T', 'E', 'N', 'S'], wrong='narration.vesper_wrong')
    v['dialogues'][key('dialogue', name)] = d
v['dialogues'][key('dialogue', 'wren')] = definition('wren', npc=ref('npc', 'wren'), policy=policy(dict(op='all', items=[])), prompt='dialogue.wren.prompt', roles=dict(wren=dict(role='npc', npc=ref('npc', 'wren'))), choices=dict(greet=dict(label='dialogue.wren.greet', narration='narration.wren')))
v['quests'][key('quest', 'missing_child')]['journal']['active_variants'] = [dict(when=policy(dict(op='all', items=[flag('fen_vesper_riddle_answered', True)])), text='quest.missing_child.answered'), dict(when=policy(dict(op='all', items=[flag('fen_wren_met', True)])), text='quest.missing_child.met')]
# Q2-C-stays literal custody, branch guards and terminal status, independent of source/compiler.
v['facts'][key('fact', 'fen_return_branch')] = definition('fen_return_branch', version=1, value_type=dict(type='enum', values=['unselected', 'stays', 'rescue'], default='unselected'), scopes=['player'], meaning='The player’s chosen return: Vesper’s message while Wren stays, or escorting Wren to Elspeth.')
v['facts'][key('fact', 'village_child_status')] = definition('village_child_status', version=1, value_type=dict(type='enum', values=['missing', 'rescued', 'stays', 'lost'], default='missing'), scopes=['instance'], meaning='The committed outcome of the search for Wren.')
v['items'][key('item', 'vesper_message')] = definition('vesper_message', keywords=['message', 'vesper_message'], short='item.vesper_message.short', room_line='item.vesper_message.room', description='item.vesper_message.description', mass_grams=20, location={'in': 'npc', 'npc': ref('npc', 'vesper')}, give_allowed=False)
v['dialogues'][key('dialogue', 'c_vesper_answered')] = definition('c_vesper_answered', npc=ref('npc', 'vesper'), policy=policy(dict(op='all', items=[search_active, flag('fen_vesper_riddle_answered', True), flag('fen_return_branch', 'unselected'), flag('village_child_status', 'missing')])), prompt='dialogue.c_vesper_answered.prompt', roles=dict(vesper=dict(role='npc', npc=ref('npc', 'vesper')), wren=dict(role='npc', npc=ref('npc', 'wren')), message=dict(role='item', item=ref('item', 'vesper_message'))), choices=dict(carry_message=dict(label='dialogue.c_vesper_answered.carry_message', narration='narration.c_vesper_answered', receive=dict(item='message', **{'from': 'vesper'}), sequence=[dict(op='fact.assign', fact=ref('fact', 'fen_return_branch'), value='stays')])))
v['dialogues'][key('dialogue', 'a_elspeth_return')] = definition('a_elspeth_return', npc=ref('npc', 'elspeth'), quest=ref('quest', 'missing_child'), policy=policy(dict(op='all', items=[search_active, flag('fen_vesper_riddle_answered', True), flag('fen_return_branch', 'stays'), flag('village_child_status', 'missing'), dict(op='has_item', item=ref('item', 'vesper_message'))])), prompt='dialogue.elspeth_return.prompt', roles=dict(elspeth=dict(role='npc', npc=ref('npc', 'elspeth')), message=dict(role='item', item=ref('item', 'vesper_message'))), choices=dict(stays=dict(label='dialogue.elspeth_return.stays', narration='narration.elspeth_return', hand_over=dict(item='message', to='elspeth'), sequence=[dict(op='fact.assign', fact=ref('fact', 'village_child_status'), value='stays')])))
v['dialogues'][key('dialogue', 'b_elspeth_stays')] = definition('b_elspeth_stays', npc=ref('npc', 'elspeth'), policy=policy(dict(op='all', items=[flag('village_child_status', 'stays')])), prompt='dialogue.elspeth_stays.prompt', roles=dict(elspeth=dict(role='npc', npc=ref('npc', 'elspeth'))), choices=dict(acknowledge=dict(label='dialogue.elspeth_stays.acknowledge', narration='narration.elspeth_stays'), directions=dict(label='dialogue.elspeth.directions', narration='narration.elspeth.directions'), inn=dict(label='dialogue.elspeth.inn', narration='narration.elspeth.inn')))
v['quests'][key('quest', 'missing_child')]['journal']['active_variants'].insert(0, dict(when=policy(dict(op='all', items=[flag('fen_return_branch', 'stays')])), text='quest.missing_child.deliver'))
v['rooms'][key('room', 'village_green')]['variants'] = [dict(when=policy(dict(op='all', items=[flag('village_child_status', 'stays')])), description='room.village_green.stays')]
# Q2-C-rescue literal branch, immutable Wren role and legal escort transitions.
v['dialogues'][key('dialogue', 'a_wren_escort')] = definition('a_wren_escort', npc=ref('npc', 'wren'), policy=policy(dict(op='all', items=[search_active, flag('fen_vesper_riddle_answered', True), flag('fen_return_branch', 'unselected'), flag('village_child_status', 'missing')])), prompt='dialogue.wren_escort.prompt', roles=dict(wren=dict(role='npc', npc=ref('npc', 'wren')), vesper=dict(role='npc', npc=ref('npc', 'vesper'))), choices=dict(rescue=dict(label='dialogue.wren_escort.rescue', narration='narration.wren_escort', escort=dict(npc='wren', quest=ref('quest', 'missing_child'), transition='start'), sequence=[dict(op='fact.assign', fact=ref('fact', 'fen_return_branch'), value='rescue')])))
v['dialogues'][key('dialogue', 'b_wren_rejoin')] = definition('b_wren_rejoin', npc=ref('npc', 'wren'), policy=policy(dict(op='all', items=[search_active, flag('fen_vesper_riddle_answered', True), flag('fen_return_branch', 'rescue'), flag('village_child_status', 'missing'), dict(op='escort_state', quest=ref('quest', 'missing_child'), state='separated')])), prompt='dialogue.wren_rejoin.prompt', roles=dict(wren=dict(role='npc', npc=ref('npc', 'wren'))), choices=dict(rejoin=dict(label='dialogue.wren_rejoin.rejoin', narration='narration.wren_rejoin', escort=dict(npc='wren', quest=ref('quest', 'missing_child'), transition='rejoin'))))
v['dialogues'][key('dialogue', 'a_elspeth_rescue')] = definition('a_elspeth_rescue', npc=ref('npc', 'elspeth'), quest=ref('quest', 'missing_child'), policy=policy(dict(op='all', items=[search_active, flag('fen_vesper_riddle_answered', True), flag('fen_return_branch', 'rescue'), flag('village_child_status', 'missing'), dict(op='escort_state', quest=ref('quest', 'missing_child'), state='following')])), prompt='dialogue.elspeth_rescue.prompt', roles=dict(elspeth=dict(role='npc', npc=ref('npc', 'elspeth')), wren=dict(role='npc', npc=ref('npc', 'wren'))), choices=dict(rescued=dict(label='dialogue.elspeth_rescue.rescued', narration='narration.elspeth_rescue', escort=dict(npc='wren', quest=ref('quest', 'missing_child'), transition='complete'), sequence=[dict(op='fact.assign', fact=ref('fact', 'village_child_status'), value='rescued')])))
v['dialogues'][key('dialogue', 'b_elspeth_rescued')] = definition('b_elspeth_rescued', npc=ref('npc', 'elspeth'), policy=policy(dict(op='all', items=[flag('village_child_status', 'rescued')])), prompt='dialogue.elspeth_rescued.prompt', roles=dict(elspeth=dict(role='npc', npc=ref('npc', 'elspeth'))), choices=dict(acknowledge=dict(label='dialogue.elspeth_rescued.acknowledge', narration='narration.elspeth_rescued'), directions=dict(label='dialogue.elspeth.directions', narration='narration.elspeth.directions'), inn=dict(label='dialogue.elspeth.inn', narration='narration.elspeth.inn')))
v['quests'][key('quest', 'missing_child')]['journal']['active_variants'] = [dict(when=policy(dict(op='all', items=[flag('fen_return_branch', 'rescue'), dict(op='escort_state', quest=ref('quest', 'missing_child'), state=state)])), text=f'quest.missing_child.{state}') for state in ['separated', 'following']] + v['quests'][key('quest', 'missing_child')]['journal']['active_variants']
v['quests'][key('quest', 'missing_child')]['journal']['outcomes'] = dict(stays='quest.missing_child.stays', rescued='quest.missing_child.rescued')
v['rooms'][key('room', 'village_green')]['variants'].insert(0, dict(when=policy(dict(op='all', items=[flag('village_child_status', 'rescued')])), description='room.village_green.rescued'))
# Q3-B: independently declared bell route, exact recipe, terminal reactions and scene.
v['rooms'][key('room', 'belfry')]['details'] = dict(bell=dict(aliases=['bell'], description='detail.bell.description', readable=dict(label='actions.read_bell', text='readable.bell', title='detail.bell.title')))
v['rooms'][key('room', 'village_green')]['variants'].insert(0, dict(when=policy(flag('village_child_status', 'lost')), description='room.village_green.lost'))
v['npcs'][key('npc', 'aldric')] = definition('aldric', keywords=['aldric', 'prior'], short='npc.aldric.short', room_line='npc.aldric.room', description='npc.aldric.description', room=ref('room', 'chapel_nave'))
v['facts'][key('fact', 'chapel_bell_rung')] = definition('chapel_bell_rung', version=1, value_type=dict(type='bool', default=False), scopes=['player'], meaning='The player rang the Belfry bell for the priory in the accepted Q3 action.')
v['facts'][key('fact', 'chapel_allegiance')] = definition('chapel_allegiance', version=1, value_type=dict(type='enum', values=['unknown', 'prior', 'fox'], default='unknown'), scopes=['player'], meaning="The player's committed chapel allegiance; first set by Ring.")
v['quests'][key('quest', 'missing_child')]['journal']['outcomes']['lost'] = 'quest.missing_child.lost'
v['quests'][key('quest', 'bell_of_ashmere')] = definition('bell_of_ashmere', title='quest.bell.title', objective=dict(evidence='current_state', policy=policy(flag('chapel_allegiance', 'prior'))), journal=dict(active='quest.bell.active', objectives_met='quest.bell.ready', resolved='quest.bell.resolved', failed='quest.bell.failed', abandoned='quest.bell.abandoned', outcomes=dict(prior='quest.bell.prior')))
q3 = lambda state: dict(op='quest_state', quest=ref('quest', 'bell_of_ashmere'), state=state)
q2 = lambda state: dict(op='quest_state', quest=ref('quest', 'missing_child'), state=state)
complete = dict(op='all', items=[q2('resolved'), dict(op='any', items=[flag('village_child_status', 'rescued'), flag('village_child_status', 'stays')])])
eligible = dict(op='any', items=[dict(op='all', items=[q2('active'), flag('fen_tracks_found', True)]), complete])
v['dialogues'][key('dialogue', 'a_aldric_offer')] = definition('a_aldric_offer', npc=ref('npc', 'aldric'), policy=policy(dict(op='all', items=[eligible, dict(op='not', item=dict(op='any', items=[q3(s) for s in ['active', 'objectives_complete', 'resolved', 'failed']]))])), prompt='dialogue.aldric.offer.prompt', roles=dict(aldric=dict(role='npc', npc=ref('npc', 'aldric'))), choices=dict(accept=dict(label='dialogue.aldric.offer.accept', narration='narration.aldric.accept', accept=ref('quest', 'bell_of_ashmere'))))
v['dialogues'][key('dialogue', 'b_aldric')] = definition('b_aldric', npc=ref('npc', 'aldric'), policy=policy(dict(op='all', items=[])), prompt='dialogue.aldric.prompt', roles=dict(aldric=dict(role='npc', npc=ref('npc', 'aldric'))), choices={name: dict(label=f'dialogue.aldric.{name}', narration=f'narration.aldric.{name}') for name in ['bell', 'leave']})
v['dialogues'][key('dialogue', 'a_elspeth_lost')] = definition('a_elspeth_lost', npc=ref('npc', 'elspeth'), policy=policy(flag('village_child_status', 'lost')), prompt='dialogue.elspeth_lost.prompt', roles=dict(elspeth=dict(role='npc', npc=ref('npc', 'elspeth'))), choices=dict(acknowledge=dict(label='dialogue.elspeth_lost.acknowledge', narration='narration.elspeth_lost'), directions=dict(label='dialogue.elspeth.directions', narration='narration.elspeth.directions')))
v['recipes'][key('recipe', 'ring_bell')] = definition('ring_bell', label='actions.ring_bell', aliases=['ring'], target=dict(kind='detail', room=ref('room', 'belfry'), detail='bell'), priority=10, policy=policy(dict(op='all', items=[q3('active'), flag('chapel_bell_rung', False), eligible])), outcomes=dict(success=dict(sequence=[dict(op='fact.assign', fact=ref('fact', 'chapel_bell_rung'), value=True), dict(op='fact.assign', fact=ref('fact', 'chapel_allegiance'), value='prior')], narration=dict(actor='narration.ring_bell'))))
v['reactions'][key('reaction', 'a_resolve_bell')] = definition('a_resolve_bell', on=dict(event='fact_changed', fact=ref('fact', 'chapel_bell_rung')), when=policy(dict(op='all', items=[flag('chapel_bell_rung', True), q3('active')])), apply=[dict(op='quest.resolve', quest=ref('quest', 'bell_of_ashmere'), outcome='prior')])
v['reactions'][key('reaction', 'b_lost_before_meeting')] = definition('b_lost_before_meeting', on=dict(event='fact_changed', fact=ref('fact', 'chapel_bell_rung')), when=policy(dict(op='all', items=[flag('chapel_bell_rung', True), q2('active'), flag('fen_wren_met', False), flag('fen_return_branch', 'unselected'), flag('village_child_status', 'missing')])), apply=[dict(op='quest.fail', quest=ref('quest', 'missing_child'), outcome='lost'), dict(op='fact.assign', fact=ref('fact', 'village_child_status'), value='lost')])
v['scenes'] = {key('scene', 'bell_rung'): definition('bell_rung', on=dict(quest=ref('quest', 'bell_of_ashmere'), outcome='prior'), control='modal', steps=[dict(type='narrate', text=f'scene.bell_rung.{name}') for name in ['bell', 'fen', 'fox']] + [dict(type='await_ack'), dict(type='end')])}
v['facts'][key('fact', 'scene_bell_rung')] = definition('scene_bell_rung', version=1, value_type=dict(type='int', minimum=-1, maximum=3, default=0), scopes=['player'], meaning="Scene bell_rung's line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it.")
v['text'] = json.loads(Path('cartridges/ashmere_missing_child/text.json').read_text())
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
sha = hashlib.sha256(canonical.encode()).hexdigest()
fixture = dict(description='Independent Python known answer: literal approved chapter semantics and compiler-owned defaults; only the chapter text catalog is copied from source. No compiler or kernel supplies expected values.', value=v, canonical=canonical, sha256=sha)
Path('protocol/fixtures/missing_child_v014_hash.json').write_text(json.dumps(fixture, indent=2, ensure_ascii=False)+'\n')
print(sha)
# Reviewed allocation order: character, body, eighteen rooms, nine details, ten NPCs, eight items, cloak holder.
names = ['character', 'body'] + ['room/'+name for name in sorted(geometry)] + ['detail/bell', 'detail/cellar_help', 'detail/lost_whistle', 'detail/rumor_board', 'detail/notice', 'detail/hollow', 'detail/plank', 'detail/tracks', 'detail/fox_prints'] + ['npc/'+name for name in ['aldric', 'cellar_rat_1', 'cellar_rat_2', 'cellar_rat_3', 'cellar_rat_4', 'cellar_rat_5', 'elspeth', 'maud', 'vesper', 'wren']] + ['item/'+name for name in ['brass_key', 'cellar_key', 'fox_drawing', 'storage_chest', 'tin_whistle', 'trunk', 'vesper_message', 'wool_cloak']] + ['slot/cloak']
ids = {}
for ordinal, name in enumerate(names):
    b = bytearray(hashlib.sha256(json.dumps(['loka-id-v1', CONTEXT, '00000000-0000-0000-0000-000000000000', ordinal], separators=(',', ':')).encode()).digest()[:16])
    b[6] = (b[6] & 15) | 128
    b[8] = (b[8] & 63) | 128
    s = b.hex()
    ids[name] = '-'.join([s[:8], s[8:12], s[12:16], s[16:20], s[20:]])
Path('protocol/fixtures/missing_child_v014_ids.json').write_text(json.dumps(ids, indent=2)+'\n')
