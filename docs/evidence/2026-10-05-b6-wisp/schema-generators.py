import json,subprocess
from pathlib import Path
mutations=json.load(open('docs/evidence/2026-10-05-b6-wisp/b6-schema-mutants.json'))
files={'ChoiceAttempts':'delta','DeltaOp':'delta','TopicDefinition':'cartridge','InspectableDetail':'room','NpcDefinition':'entity','DialogueDefinition':'dialogue','DialogueChoice':'dialogue','ActionRecipe':'action','Policy':'policy','GameView':'gameview','CompiledCartridge':'cartridge'}
generated=['docs/contracts.gen.md','docs/residency.gen.json','kernel/ts/src/contracts.gen.ts','kernel/ts/test/subset.gen.ts']
snap={n:Path(n).read_bytes() for n in generated}
results=[]
try:
 for m in mutations:
  if m['killed']:continue
  path=Path('protocol')/(files[m['contract']]+'.schema.json');original=path.read_bytes();d=json.loads(original);node=d['$defs'][m['contract']]
  for k in m['path']:node=node[k]
  if 'field' in m:node['required'].remove(m['field'])
  else:node.pop(m['keyword'])
  try:
   path.write_text(json.dumps(d,indent=2)+'\n')
   r=subprocess.run(['mise','exec','--','elixir','bin/contracts.exs'],capture_output=True,text=True)
   result={**m,'generator_status':r.returncode,'generator_rejected':r.returncode!=0}
   if r.returncode==0:
    t=subprocess.run(['mise','exec','--','node','--test','kernel/ts/test/wisp_contracts.test.ts'],capture_output=True,text=True)
    result['fixture_status']=t.returncode
   results.append(result)
  finally:
   path.write_bytes(original)
   for n,b in snap.items():Path(n).write_bytes(b)
finally:
 for n,b in snap.items():Path(n).write_bytes(b)
Path('docs/evidence/2026-10-05-b6-wisp/b6-schema-generator-results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'guard_mutants':len(results),'generator_rejected':sum(x['generator_rejected'] for x in results),'survivors':[x for x in results if not x['generator_rejected'] and x.get('fixture_status')==0]}))
