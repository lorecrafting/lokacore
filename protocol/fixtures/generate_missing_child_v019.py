"""Independent B5 known answer from reviewed B3 payload plus hand-authored B5 source.

Uses Python JSON/SHA-256, never imports the compiler or kernel. Reference
expansion below covers only B5's declared fields; unaffected B3 values retain
 their reviewed literals. UUID answers follow the numeric profile enumeration.
"""
import hashlib
import json
from pathlib import Path
import uuid

here=Path(__file__).parent
source=here.parent.parent/'cartridges/ashmere_missing_child'
v=json.loads(here.joinpath('missing_child_v018_hash.json').read_text())['value']
v=json.loads(json.dumps(v).replace('0.0.18','0.0.19'))
v['manifest']['requires']['kernel_api']['at_least']='1.17'
def ref(kind,key):return {'cartridge_id':'ashmere_missing_child','cartridge_version':'0.0.19','kind':kind,'key':key}
def expand(value):
 if isinstance(value,list):return [expand(x) for x in value]
 if not isinstance(value,dict):return value
 out={}
 for k,x in value.items():
  if k in ['npc','quest','fact','accept','faction','contribution'] and isinstance(x,str):out[k]=ref({'accept':'quest','faction':'fact','contribution':'fact'}.get(k,k),x)
  elif k=='to' and isinstance(x,str):out[k]=ref('room',x)
  elif k in ['outgoing','incoming'] or (k=='items' and 'narration' in value):out[k]=[ref('item',i) for i in x]
  elif k=='room' and isinstance(x,str):out[k]=ref('room',x)
  else:out[k]=expand(x)
 return out
for kind,keys in [('item',[f'{family}_{i:02}' for family in ['fenwort','bandage'] for i in range(1,13)]),('npc',['wick']),('room',['chapel_nave','willow_shade','cloister','infirmary']),('dialogue',['a_wick_offer','b_wick_turn_in']),('quest',['infirmary_herbs'])]:
 for k in keys:
  d=expand(json.loads((source/f'{kind}s/{k}.json').read_text()));d['key']=k
  v[f'{kind}s'][f'ashmere_missing_child@0.0.19:{kind}/{k}']=d
f=json.loads((source/'facts.json').read_text())['facts']['infirmary.contribution'];f['key']='infirmary_contribution';v['facts']['ashmere_missing_child@0.0.19:fact/infirmary_contribution']=f
v['text'].update(json.loads((source/'text.json').read_text()))
canonical=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
hash=hashlib.sha256(canonical.encode()).hexdigest()
here.joinpath('missing_child_v019_hash.json').write_text(json.dumps({'description':'Independent B5 known answer: reviewed B3 plus finite fenwort/Wick stocks and immediate repeated exchanges.','value':v,'canonical':canonical,'sha256':hash},indent=2,ensure_ascii=False)+'\n')
labels=['character','body'];rooms=sorted(v['rooms'].items())
labels += [f"room/{r['key']}" for _,r in rooms]
labels += [f"detail/{r['key']}/{k}" for _,r in rooms for k in sorted(r.get('details',{}))]
labels += [f"npc/{n['key']}" for _,n in sorted(v['npcs'].items())]
labels += [f"item/{i['key']}" for _,i in sorted(v['items'].items()) if i['location']['in']!='template']
labels += [f"job/{n['key']}" for _,n in sorted(v['npcs'].items()) if n.get('daily_schedule')]
labels += [f'slot/{slot}' for slot in sorted({i['slot'] for i in v['items'].values() if 'slot' in i})]
answers={}
for ordinal,label in enumerate(labels):
 domain=['loka-id-v1','0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f','00000000-0000-0000-0000-000000000000',ordinal]
 digest=bytearray(hashlib.sha256(json.dumps(domain,separators=(',',':')).encode()).digest()[:16]);digest[6]=(digest[6]&15)|128;digest[8]=(digest[8]&63)|128
 answers[label]=str(uuid.UUID(bytes=bytes(digest)))
print(f'Independent v019: {hash}, {len(answers)} initial IDs.')
