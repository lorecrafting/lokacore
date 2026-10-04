# Independent oracle from frozen Ferry + literal scene, fact, reaction; catalog from authored source.
import json,hashlib
from pathlib import Path
ID='ashmere_scene'
def renamed(v):
 if isinstance(v,dict):return {k.replace('ashmere_ferry@',ID+'@'):renamed(x) for k,x in v.items()}
 if isinstance(v,list):return [renamed(x) for x in v]
 return ID if v=='ashmere_ferry' else v
def ref(kind,key):return {'cartridge_id':ID,'cartridge_version':'0.0.1','kind':kind,'key':key}
def k(kind,key):return f'{ID}@0.0.1:{kind}/{key}'
v=renamed(json.loads(Path('protocol/fixtures/cartridge_ferry_hash.json').read_text())['value'])
for caps in [v['manifest']['requires']['capabilities'],v['lock']['capabilities']]:caps.update(scene=1,reaction=1)
v['scenes']={k('scene','bell_rung'):{'key':'bell_rung','on':{'story_point':ref('story_point','lantern_resolved'),'outcome':'carry'},'control':'modal','steps':[{'type':'narrate','text':'scene.bell_rung.'+x} for x in ['bell','fen','fox']]+[{'type':'await_ack'},{'type':'end'}]}}
v['facts'][k('fact','scene_bell_rung')]={'key':'scene_bell_rung','version':1,'value_type':{'type':'int','minimum':-1,'maximum':3,'default':0},'scopes':['player'],'meaning':"Scene bell_rung's line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it."}
v['facts'][k('fact','bell_heard')]={'key':'bell_heard','version':1,'value_type':{'type':'bool','default':False},'scopes':['player'],'meaning':'Whether bell_rung has ended (scene@1 reaction composition).'}
v['reactions']={k('reaction','bell_after'):{'key':'bell_after','on':{'event':'fact_changed','fact':ref('fact','scene_bell_rung')},'when':{'policy_version':1,'root':{'op':'fact_compare','fact':ref('fact','scene_bell_rung'),'equals':-1}},'apply':[{'op':'fact.assign','fact':ref('fact','bell_heard'),'value':True}]}}
v['text']=json.loads(Path('cartridges/ashmere_scene/text.json').read_text())
s=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False);sha=hashlib.sha256(s.encode()).hexdigest()
Path('protocol/fixtures/cartridge_scene_hash.json').write_text(json.dumps({'description':'Independent Python known answer: frozen Ferry renamed, literal scene and engine FactSpec, bell_heard and bell_after; only text catalog copied from source. mechanics.md scene@1; c1-scenes-modal. No kernel supplies expected values.','value':v,'canonical':s,'sha256':sha},indent=2,ensure_ascii=False)+'\n')
print(sha)
