import copy,json,subprocess
from pathlib import Path
root=Path.cwd()
def redact(text):
 import re
 text=text.replace(str(root.resolve()), '[worktree]').replace(str(Path.home()), '[home]')
 text=re.sub(r'(?:/private)?/tmp/[^\s]+', '[scratch]', text)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+', r'\1[redacted]', text)

files=['protocol/service.schema.json','protocol/action.schema.json','protocol/command.schema.json','protocol/gameview.schema.json','protocol/cartridge.schema.json','protocol/entity.schema.json','protocol/room.schema.json']
original={f:(root/f).read_text() for f in files}
current={f:json.loads(v) for f,v in original.items()}
old={}
for f in files:
 prior=subprocess.run(['git','show','e15c420b:'+f],cwd=root,capture_output=True,text=True)
 old[f]=json.loads(prior.stdout) if prior.returncode==0 else {}
targets=[]
keys={'minimum','maximum','minItems','maxItems','const','enum','pattern','minLength','maxLength','additionalProperties'}
def discover(f,new,prior,path=()):
 if isinstance(new,dict):
  for k,v in new.items():
   before=prior.get(k) if isinstance(prior,dict) else None
   if k=='required' and isinstance(v,list):
    for i,name in enumerate(v):
     if not isinstance(before,list) or name not in before:targets.append((f,path+(k,i),str(name)))
   elif k in keys and (before is None or v!=before):targets.append((f,path+(k,),k))
   else:discover(f,v,before,path+(k,))
 elif isinstance(new,list):
  for i,v in enumerate(new):
   previous=prior[i] if isinstance(prior,list) and i<len(prior) else None
   def identity(value):
    if not isinstance(value,dict):return None
    if '$ref' in value:return ('$ref',value['$ref'])
    for field in ['op','kind','type','evidence']:
     guard=value.get('properties',{}).get(field,{})
     if 'const' in guard:return (field,guard['const'])
   named=identity(v)
   if named:previous=next((candidate for candidate in (prior or []) if identity(candidate)==named),None)
   discover(f,v,previous,path+(i,))
for f in files:discover(f,current[f],old[f])
summary=[]
try:
 for number,(f,path,name) in enumerate(targets,1):
  changed=copy.deepcopy(current[f]);at=changed
  for field in path[:-1]:at=at[field]
  del at[path[-1]]
  (root/f).write_text(json.dumps(changed,indent=2)+'\n')
  generated=subprocess.run(['mise','exec','--','elixir','bin/contracts.exs'],cwd=root,capture_output=True,text=True)
  if generated.returncode:
   result='RED generation'
  else:
   run=subprocess.run(['mise','exec','--','node','--test','kernel/ts/test/service_contracts.test.ts'],cwd=root,capture_output=True,text=True)
   result='RED fixture' if run.returncode else 'SURVIVED'
  (root/f).write_text(original[f])
  summary.append(f'{number}/{len(targets)} {result}: {f} /'+ '/'.join(map(str,path)))
  Path(__file__).with_name('schema-controls.log').write_text(redact('\n'.join(summary)+'\n'))
  if result=='SURVIVED':print(summary[-1],flush=True)
  if number%20==0:print(f'Checked {number}/{len(targets)} schema controls; survivors {sum("SURVIVED" in s for s in summary)}',flush=True)
finally:
 for f,v in original.items():(root/f).write_text(v)
 subprocess.run(['mise','exec','--','elixir','bin/contracts.exs'],cwd=root,capture_output=True)
print(f'Schema sweep: {len(targets)} controls, {sum("SURVIVED" in s for s in summary)} survivors',flush=True)
