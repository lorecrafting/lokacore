"""Current Rest expectations from retained inputs and independent JSON/SHA-256/UUID arithmetic."""
import copy,hashlib,json,subprocess,uuid
from pathlib import Path
version='loka-kernel@'+subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()+'-dirty'
for path in [Path('cartridges/ashmere_rest/transcripts/position.jsonl'),Path('cartridges/ashmere_missing_child/transcripts/service.jsonl')]:
 prior=subprocess.check_output(['git','show','594b8ae1:'+str(path)],text=True)
 rows=[json.loads(line) for line in prior.splitlines()]
 context=rows[0]['data']['world_context_id']; content_hash=rows[0]['ids']['content_hash']
 artifact=next(json.loads(p.read_text())['value'] for p in Path('protocol/fixtures').glob('*hash.json') if json.loads(p.read_text()).get('sha256')==content_hash)
 def mint(command,ordinal):
  raw=bytearray(hashlib.sha256(json.dumps(['loka-id-v1',context,command,ordinal],separators=(',',':')).encode()).digest()[:16])
  raw[6]=(raw[6]&15)|128;raw[8]=(raw[8]&63)|128
  return str(uuid.UUID(bytes=bytes(raw)))
 body=mint('00000000-0000-0000-0000-000000000000',1)
 entry=artifact['entry']; room_ref=f"{entry['cartridge_id']}@{entry['cartridge_version']}:room/{entry['key']}"
 room=mint('00000000-0000-0000-0000-000000000000',2+sorted(artifact['rooms']).index(room_ref))
 for row in rows:
  row['ids']['kernel_version']=version
  if row.get('event')!='trace.command':continue
  data=row['data']
  for event in data['commit'].get('events',[]):
   p=event['event']['payload']
   if p['type']=='entity_entered_room' and p['entity_id']==body:room=p['room_id']
  if data['command']['payload']['type']!='rest':continue
  c=data['command']; old=data['commit']['events'][0]['event']
  assert old['id']==mint(c['id'],0)
  old['id']=mint(c['id'],1)
  rested={k:copy.deepcopy(v) for k,v in old.items() if k!='payload'}
  rested.update(id=mint(c['id'],0),position=2,payload={'type':'rested','body_id':body,'room_id':room})
  data['commit']['events'].append({'committed_revision':data['commit']['revision'],'event':rested})
 path.write_text(''.join(json.dumps(row,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n' for row in rows))
 print(f'{path}: retained decisions/deltas; typed Rest evidence and independent UUID answers; current dirty source stamp.')
