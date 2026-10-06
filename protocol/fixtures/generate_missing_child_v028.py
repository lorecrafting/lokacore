"""Independent B9 successor on published D5/D2 v027: Python JSON/SHA/UUID only."""
import hashlib,json,uuid
from pathlib import Path
here=Path(__file__).parent;source=here.parent.parent/'cartridges/ashmere_missing_child'
v=json.loads((here/'missing_child_v027_hash.json').read_text())['value']
v=json.loads(json.dumps(v).replace('0.0.27','0.0.28'))
v['manifest']={k:x for k,x in json.loads((source/'cartridge.json').read_text()).items() if k not in ['entry','calendar','world','chapters']}
v['lock']['capabilities']=v['manifest']['requires']['capabilities']
def ref(kind,key):return {'cartridge_id':'ashmere_missing_child','cartridge_version':'0.0.28','kind':kind,'key':key}
def expand(x):
 if isinstance(x,list):return [expand(y) for y in x]
 if not isinstance(x,dict):return x
 r={k:expand(y) for k,y in x.items()}
 for k,kind in {'room':'room','entitlement':'fact','credit':'fact','quest':'quest','fact':'fact'}.items():
  if isinstance(r.get(k),str):r[k]=ref(kind,r[k])
 return r
for kind,keys in [('scene',['dream_of_the_fen']),('quest',['a_room_at_the_lantern']),('action',['dream_next','dream_choose'])]:
 for key in keys:v.setdefault(kind+'s',{})[f'ashmere_missing_child@0.0.28:{kind}/{key}']={'key':key,**expand(json.loads((source/f'{kind}s/{key}.json').read_text()))}
facts=json.loads((source/'facts.json').read_text())['facts']
for key in ['slept_at_lantern','dream_seen']:v['facts'][f'ashmere_missing_child@0.0.28:fact/{key}']={'key':key,**facts[key]}
v['facts']['ashmere_missing_child@0.0.28:fact/scene_dream_of_the_fen']={'key':'scene_dream_of_the_fen','version':1,'value_type':{'type':'int','minimum':-1,'maximum':5,'default':0},'scopes':['player'],'meaning':"Scene dream_of_the_fen's line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it."}
v['text']=json.loads((source/'text.json').read_text())
canonical=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False);digest=hashlib.sha256(canonical.encode()).hexdigest()
(here/'missing_child_v028_hash.json').write_text(json.dumps({'description':'Independent B9 on published D5/D2 predecessor 4bcb2eaf.','value':v,'canonical':canonical,'sha256':digest},indent=2,ensure_ascii=False)+'\n')
rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + [f"room/{r['key']}" for _, r in rooms]
labels += [f"detail/{r['key']}/{key}" for _, r in rooms for key in sorted(r.get('details', {}))]
labels += [f"npc/{n['key']}" for _, n in sorted(v['npcs'].items())]
labels += [f"item/{i['key']}" for _, i in sorted(v['items'].items()) if i['location']['in'] != 'template']
labels += [f"job/{n['key']}" for _, n in sorted(v['npcs'].items()) if n.get('daily_schedule')]
labels += [f'slot/{slot}' for slot in sorted({i['slot'] for i in v['items'].values() if 'slot' in i})]
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here/'missing_child_v028_ids.json').write_text(json.dumps(answers,indent=2)+'\n')
print(f'Integrated B9 v028/API1.25: {digest}; {len(answers)} independently derived initial IDs.')
