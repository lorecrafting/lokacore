"""Independent B8 answer from reviewed C2 v024 plus exact authored immediate services.
Python JSON/SHA-256/UUID; no compiler/kernel helpers.
"""
import hashlib
import json
from pathlib import Path
import uuid
here = Path(__file__).parent
source = here.parent.parent / 'cartridges/ashmere_missing_child'
v = json.loads((here / 'missing_child_v024_hash.json').read_text())['value']
v = json.loads(json.dumps(v).replace('0.0.24', '0.0.25'))
v['manifest'] = {k: value for k, value in json.loads((source / 'cartridge.json').read_text()).items()
                 if k not in ['entry', 'calendar', 'world', 'chapters']}
v['manifest']['requires']['capabilities']['resource'] = 1
v['lock']['capabilities'] = v['manifest']['requires']['capabilities']
def ref(kind, key):
    return {'cartridge_id':'ashmere_missing_child','cartridge_version':'0.0.25','kind':kind,'key':key}
def expand(value):
    if isinstance(value,list): return [expand(x) for x in value]
    if not isinstance(value,dict): return value
    result = {key:expand(item) for key,item in value.items()}
    fields = {'provider':'npc','currency':'resource','fact':'fact','stock':'resource','recovery':'resource',
              'vessel':'item','liquid':'liquid','entitlement':'fact','room':'room','npc':'npc','to':'room'}
    for key,kind in fields.items():
        if key in result and isinstance(result[key],str): result[key]=ref(kind,result[key])
    if 'services' in result: result['services']=[ref('service',x) for x in result['services']]
    if 'quantity' in result and isinstance(result.get('kind'),str): result['kind']=ref('liquid',result['kind'])
    return result
for kind,keys in [('npc',['maud']),('room',['inn_rooms']),('item',['lantern_ale_cask']),('liquid',['ale']),
                  ('service',['lantern_room','lantern_meal','lantern_ale']),
                  ('action',['rent_lantern_room','eat_lantern_meal','drink_lantern_ale'])]:
    for key in keys:
        d=json.loads((source/f'{kind}s/{key}.json').read_text())
        v.setdefault(f'{kind}s',{})[f'ashmere_missing_child@0.0.25:{kind}/{key}']={'key':key,**expand(d)}
v['facts']['ashmere_missing_child@0.0.25:fact/lantern_bed_paid']={'key':'lantern_bed_paid',**json.loads((source/'facts.json').read_text())['facts']['lantern_bed_paid']}
v['resources']['ashmere_missing_child@0.0.25:resource/lantern_meals']={'key':'lantern_meals',**json.loads((source/'resources.json').read_text())['resources']['lantern_meals']}
v['text'].update(json.loads((source/'text.json').read_text()))
canonical=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
digest=hashlib.sha256(canonical.encode()).hexdigest()
(here/'missing_child_v025_hash.json').write_text(json.dumps({'description':'Independent B8: exact Maud room entitlement, finite meal and conserved ale with immediate capped MV benefits; real Inn Rooms bed.','value':v,'canonical':canonical,'sha256':digest},indent=2,ensure_ascii=False)+'\n')
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
(here / 'missing_child_v025_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'Independent B8 v025: {digest}, {len(answers)} initial IDs.')
