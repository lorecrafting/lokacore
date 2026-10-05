# Independent M20-B1 KAT: preserved frozen M6 artifact plus literal controlled consumer semantics.
# Never import the compiler, kernel, or source overlay to supply expected mechanics.
import json
import hashlib
from pathlib import Path
v = json.loads(Path('protocol/fixtures/sampler_v009_hash.json').read_text())['value']
old, prefix = 'ashmere_sampler@0.0.9', 'reward_storage@0.0.1'
def rekey(x):
    if isinstance(x, list): return [rekey(a) for a in x]
    if isinstance(x, dict):
        return {(k.replace(old, prefix)): ('reward_storage' if k == 'cartridge_id' else '0.0.1' if k == 'cartridge_version' else rekey(a)) for k,a in x.items()}
    return x
v = rekey(v)
v['manifest'].update(id='reward_storage',version='0.0.1',title='Controlled reward/storage')
v['manifest']['requires']['kernel_api']['at_least']='1.7'
v['entry']['key']='lantern_cellar'
v['world']['combat']['player_attack']={'chance':100,'damage_min':1,'damage_max':1}
def ref(kind,name): return dict(cartridge_id='reward_storage',cartridge_version='0.0.1',kind=kind,key=name)
def add(kind,name,**fields): v[kind+'s'][prefix+':'+kind+'/'+name]=dict(key=name,**fields)
def text(name): return dict(keywords=[name],short='fixture.'+name,room_line='fixture.'+name+'.room',description='fixture.'+name)
def policy(root): return dict(policy_version=1,root=root)
def state(s): return dict(op='quest_state',quest=ref('quest','mauds_cellar'),state=s)
for n in [1,2,3,4,5]:
    rat=v['npcs'][prefix+':npc/cellar_rat_'+str(n)]
    rat['hp']={'minimum':0,'maximum':1,'start':1,'gain':0}
    rat['attack']['chance']=0
add('npc','maud',**text('maud'),room=ref('room','drowned_lantern'))
add('item','reward_key',**text('reward_key'),mass_grams=100,location={'in':'npc','npc':ref('npc','maud')})
add('item','reward_chest',**text('reward_chest'),mass_grams=8000,capacity=12,location={'in':'room','room':ref('room','inn_rooms')},barrier=ref('barrier','reward_lid'))
add('barrier','reward_lid',keywords=['reward_lid'],short='fixture.reward_chest',initial='locked',key_item=ref('item','reward_key'))
add('fact','maud_trust',version=1,scopes=['player'],value_type={'type':'int','minimum':-100,'maximum':100,'default':0},meaning='Controlled trust')
add('fact','inn_cellar_cleared',version=1,scopes=['instance'],value_type={'type':'bool','default':False},meaning='Controlled completion')
add('quest','mauds_cellar',title='fixture.quest',objective=dict(evidence='current_state',policy=policy(dict(op='all',items=[dict(op='fact_compare',fact=ref('fact',f'rat_{n}_killed'),equals=True) for n in [1,2,3,4,5]]))),journal={s:'fixture.quest' for s in ['active','objectives_met','resolved','failed','abandoned']})
add('dialogue','maud_offer',npc=ref('npc','maud'),policy=policy(dict(op='not',item=dict(op='any',items=[state(s) for s in ['active','objectives_complete','resolved','failed','abandoned']]))),prompt='fixture.offer',roles=dict(maud=dict(role='npc',npc=ref('npc','maud'))),choices=dict(accept=dict(label='fixture.accept',narration='fixture.accepted',accept=ref('quest','mauds_cellar'))))
add('dialogue','maud_turn_in',npc=ref('npc','maud'),quest=ref('quest','mauds_cellar'),policy=policy(state('active')),prompt='fixture.turn_in',roles=dict(maud=dict(role='npc',npc=ref('npc','maud')),key=dict(role='item',item=ref('item','reward_key'))),choices=dict(done=dict(label='fixture.done',narration='fixture.completed',receive={'item':'key','from':'maud'},sequence=[dict(op='fact.adjust',fact=ref('fact','maud_trust'),amount=5),dict(op='fact.assign',fact=ref('fact','inn_cellar_cleared'),value=True)])))
v['text'].update({'fixture.maud.room':'[Maud]', 'fixture.reward_key.room':'[reward_key]', 'fixture.reward_chest.room':'[reward_chest]', 'fixture.maud':'Maud','fixture.reward_key':'Test key','fixture.reward_chest':'Test chest','fixture.quest':'Test quest','fixture.offer':'Test offer','fixture.accept':'Accept test quest','fixture.accepted':'Test quest accepted.','fixture.turn_in':'Test reward','fixture.done':'Receive test reward','fixture.completed':'Test reward received.','action.put':'Put'})
canonical=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
sha=hashlib.sha256(canonical.encode()).hexdigest()
Path('protocol/fixtures/reward_storage_hash.json').write_text(json.dumps(dict(description='Independent Python KAT: frozen M6 semantics plus literal controlled reward/storage consumer; no compiler or kernel expected values.',value=v,canonical=canonical,sha256=sha),indent=2,ensure_ascii=False)+'\n')
print(sha)
