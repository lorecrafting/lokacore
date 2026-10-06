"""Independent D4 v031 answers over published C3/D1 v030; no compiler/kernel imports."""
import hashlib,json,uuid
from pathlib import Path
here=Path(__file__).parent; source=here.parent.parent/'cartridges/ashmere_missing_child'
v=json.loads((here/'missing_child_v030_hash.json').read_text())['value']
v=json.loads(json.dumps(v).replace('0.0.30','0.0.31'))
v['manifest']={k:x for k,x in json.loads((source/'cartridge.json').read_text()).items() if k not in ['entry','calendar','world','chapters']}
v['lock']['capabilities']=v['manifest']['requires']['capabilities']
def ref(kind,key):return {'cartridge_id':'ashmere_missing_child','cartridge_version':'0.0.31','kind':kind,'key':key}
def expand(x):
 if isinstance(x,list):return [expand(y) for y in x]
 if not isinstance(x,dict):return x
 r={k:expand(y) for k,y in x.items()}
 for k,kind in {'room':'room','to':'room','npc':'npc','fact':'fact','resource':'resource'}.items():
  if isinstance(r.get(k),str):r[k]=ref(kind,r[k])
 if 'items' in r and 'narration' in r: r['items']=[ref('item',i) for i in r['items']]
 if 'daily_schedule' in r:r['daily_schedule']={h:ref('room',key) for h,key in r['daily_schedule'].items()}
 return r
for kind,keys in [('room',['village_green','north_gate','smithy','orchard','elspeth_cottage']),('npc',['gareth','ada']),('dialogue',['gareth','ada']),('item',['apple_01','apple_02','apple_03'])]:
 for key in keys:v.setdefault(kind+'s',{})[f'ashmere_missing_child@0.0.31:{kind}/{key}']={'key':key,**expand(json.loads((source/f'{kind}s/{key}.json').read_text()))}
v['text']=json.loads((source/'text.json').read_text())
canonical=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False);digest=hashlib.sha256(canonical.encode()).hexdigest()
(here/'missing_child_v031_hash.json').write_text(json.dumps({'description':'D4 homes/orchard over published C3/D1 c20addb0.','value':v,'canonical':canonical,'sha256':digest},indent=2,ensure_ascii=False)+'\n')
rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + [f"room/{r['key']}" for _, r in rooms]
labels += [f"detail/{r['key']}/{key}" for _, r in rooms for key in sorted(r.get('details', {}))]
labels += [f"npc/{n['key']}" for _, n in sorted(v['npcs'].items()) if not n.get('spawn_template')]
labels += [f"item/{i['key']}" for _, i in sorted(v['items'].items()) if i['location']['in'] != 'template']
labels += [f"job/{n['key']}" for _, n in sorted(v['npcs'].items()) if n.get('daily_schedule')]
labels += [f'slot/{slot}' for slot in sorted({i['slot'] for i in v['items'].values() if 'slot' in i})]
labels += ['consumed']
# Published C3 night start appends four member/pelt pairs, then its job.
labels += [f'population/fen_hounds/slot{slot}/{kind}' for slot in range(1,5) for kind in ('member','pelt')]
labels += ['population/fen_hounds/job']
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here/'missing_child_v031_ids.json').write_text(json.dumps(answers,indent=2)+'\n')
print(f'Independent D4 v031/API1.27: {digest}; {len(answers)} independently derived initial IDs.')
