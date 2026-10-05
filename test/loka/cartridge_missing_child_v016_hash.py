# Independent B2 release answer: prior pinned value plus hand-declared new definitions.
# The compiler and TypeScript loader are never used to derive this value.
import hashlib
import json
from pathlib import Path

ID, OLD, VERSION = 'ashmere_missing_child', '0.0.15', '0.0.16'
def ref(kind, name):
    return {'cartridge_id': ID, 'cartridge_version': VERSION, 'kind': kind, 'key': name}
def key(kind, name):
    return f'{ID}@{VERSION}:{kind}/{name}'
def definition(name, **fields):
    return dict(key=name, **fields)
def policy(root):
    return {'policy_version': 1, 'root': root}
def state(name):
    return {'op': 'quest_state', 'quest': ref('quest', 'chandlers_debt'), 'state': name}
def recurse(value):
    if isinstance(value, dict):
        return {k.replace('@'+OLD+':', '@'+VERSION+':'): recurse(v) for k, v in value.items()}
    if isinstance(value, list):
        return [recurse(v) for v in value]
    return VERSION if value == OLD else value

v = recurse(json.loads(Path('protocol/fixtures/missing_child_v015_hash.json').read_text())['value'])
v['manifest']['version'] = VERSION
v['manifest']['requires']['kernel_api']['at_least'] = '1.14'
v['rooms'][key('room', 'well_lane')]['exits']['west'] = {'to': ref('room', 'chandler')}
for name, exits in {
    'chandler': {'east': 'well_lane', 'down': 'chandler_storeroom'},
    'chandler_storeroom': {'up': 'chandler'},
}.items():
    v['rooms'][key('room', name)] = definition(name, title=f'room.{name}.title', description=f'room.{name}.description', exits={direction: {'to': ref('room', target)} for direction, target in exits.items()})
v['npcs'][key('npc', 'peg')] = definition('peg', keywords=['peg', 'harrow', 'chandler'], short='npc.peg.short', room_line='npc.peg.room', description='npc.peg.description', room=ref('room', 'chandler'))
v['npcs'][key('npc', 'aldric')]['resource_starts'] = {'pennies': 10}
v['items'][key('item', 'tithe_ledger')] = definition('tithe_ledger', keywords=['ledger', 'tithe_ledger'], short='item.tithe_ledger.short', room_line='item.tithe_ledger.room', description='item.tithe_ledger.description', mass_grams=200, location={'in':'npc','npc':ref('npc','peg')})
for name, meaning, value_type, scopes in [
    ('priory_fen_axis','The player’s standing between Priory and Fen.',dict(type='int',minimum=-10,maximum=10,default=0),['player']),
    ('peg_trust','Peg’s trust in the player.',dict(type='int',minimum=-100,maximum=100,default=0),['player']),
    ('priory_tithe_delivered','The outcome of the original bound tithe ledger obligation.',dict(type='enum',values=['unoffered','pending','on_time','late','never'],default='unoffered'),['instance']),
]:
    v['facts'][key('fact',name)] = definition(name,version=1,value_type=value_type,scopes=scopes,meaning=meaning)
v['resources'][key('resource','pennies')] = definition('pennies',minimum=0,maximum=1000,start=20,gain=0)
q = ref('quest','chandlers_debt')
v['quests'][key('quest','chandlers_debt')] = definition('chandlers_debt', title='quest.chandlers_debt.title', objective=dict(evidence='current_state',policy=policy(dict(op='has_item',item=ref('item','tithe_ledger')))), deadline=dict(at=237601,outcome='never',fact=ref('fact','priory_tithe_delivered'),trust_fact=ref('fact','peg_trust'),trust_amount=-5), journal=dict(active='quest.chandlers_debt.active',objectives_met='quest.chandlers_debt.ready',resolved='quest.chandlers_debt.resolved',failed='quest.chandlers_debt.failed',abandoned='quest.chandlers_debt.abandoned',outcomes={name:f'quest.chandlers_debt.{name}' for name in ['on_time','late','never']}))
peg_roles={'peg':dict(role='npc',npc=ref('npc','peg')),'aldric':dict(role='npc',npc=ref('npc','aldric')),'ledger':dict(role='item',item=ref('item','tithe_ledger'))}
not_taken=policy(dict(op='not',item=dict(op='any',items=[state(s) for s in ['active','objectives_complete','resolved','failed','abandoned']])))
peg_choices={}
for name, bounds in [('accept_on_time',{'through':151200}),('accept_late',{'from':151201,'through':237600})]:
    peg_choices[name]=dict(label=f'dialogue.peg_debt.{name}',narration=f'narration.peg_debt.{name}',accept=q,receive={'item':'ledger','from':'peg'},availability=bounds,sequence=[dict(op='fact.assign',fact=ref('fact','priory_tithe_delivered'),value='pending')])
peg_choices['elapsed']=dict(label='dialogue.peg_debt.elapsed',narration='narration.peg_debt.elapsed',availability={'from':237601})
v['dialogues'][key('dialogue','a_peg_debt')]=definition('a_peg_debt',npc=ref('npc','peg'),policy=not_taken,prompt='dialogue.peg_debt.prompt',roles=peg_roles,choices=peg_choices)
aldric_choices={}
for name,bounds,axis in [('on_time',{'through':151200},2),('late',{'from':151201,'through':237600},-1)]:
    choice=dict(label=f'dialogue.aldric_debt.{name}',narration=f'narration.aldric_debt.{name}',hand_over={'item':'ledger','to':'aldric'},availability=bounds,sequence=[dict(op='fact.assign',fact=ref('fact','priory_tithe_delivered'),value=name),dict(op='fact.adjust',fact=ref('fact','priory_fen_axis'),amount=axis)])
    if name=='on_time': choice['payment']={'from':'aldric','resource':ref('resource','pennies'),'amount':10}
    aldric_choices[name]=choice
v['dialogues'][key('dialogue','a_aldric_debt')]=definition('a_aldric_debt',npc=ref('npc','aldric'),quest=q,policy=policy(dict(op='any',items=[state('active'),state('objectives_complete')])),prompt='dialogue.aldric_debt.prompt',roles={'aldric':peg_roles['aldric'],'ledger':peg_roles['ledger']},choices=aldric_choices)
# Catalog prose is content, not a semantic answer, and is copied verbatim.
v['text']=json.loads(Path('cartridges/ashmere_missing_child/text.json').read_text())
canonical=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
sha=hashlib.sha256(canonical.encode()).hexdigest()
Path('protocol/fixtures/missing_child_v016_hash.json').write_text(json.dumps({'description':'Independent B2 known answer from the pinned v015 baseline and hand-declared Peg, funded ledger, exact deadlines and typed outcomes. Catalog prose copied from source.','value':v,'canonical':canonical,'sha256':sha},indent=2,ensure_ascii=False)+'\n')
print(sha)

# Independently allocate the reviewed initial world order with Python's SHA-256.
rooms=sorted(v['rooms'])
details=[f"detail/{name}" for room in rooms for name in sorted(v['rooms'][room].get('details',{}))]
npcs=sorted(v['npcs'])
items=sorted(k for k,item in v['items'].items() if item['location']['in']!='template')
names=['character','body']+[f"room/{v['rooms'][r]['key']}" for r in rooms]+details+[f"npc/{v['npcs'][n]['key']}" for n in npcs]+[f"item/{v['items'][i]['key']}" for i in items]+['slot/cloak']
ids={}
for ordinal,name in enumerate(names):
    b=bytearray(hashlib.sha256(json.dumps(['loka-id-v1','0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f','00000000-0000-0000-0000-000000000000',ordinal],separators=(',',':')).encode()).digest()[:16])
    b[6]=(b[6]&15)|128
    b[8]=(b[8]&63)|128
    s=b.hex()
    ids[name]='-'.join([s[:8],s[8:12],s[12:16],s[16:20],s[20:]])
Path('protocol/fixtures/missing_child_v016_ids.json').write_text(json.dumps(ids,indent=2)+'\n')
