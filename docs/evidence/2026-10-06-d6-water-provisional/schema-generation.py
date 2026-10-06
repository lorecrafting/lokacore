from pathlib import Path
import json,subprocess,copy,re
folder=Path('docs/evidence/2026-10-06-d6-water-provisional')
summary=json.loads((folder/'schema-direct-summary.json').read_text())
files=['protocol/water.schema.json','protocol/delta.schema.json','protocol/event.schema.json','protocol/command.schema.json']
generated=['kernel/ts/src/contracts.gen.ts','docs/contracts.gen.md','docs/residency.gen.json','kernel/ts/test/subset.gen.ts']
original={f:Path(f).read_bytes() for f in files+generated}
rows=[]
try:
 for g in summary['survivors']:
  file='protocol/water.schema.json' if g['contract'].startswith(('Water','Corpse')) else 'protocol/delta.schema.json' if g['contract'] in ['DeltaOp','MutationTarget'] else 'protocol/command.schema.json' if g['contract']=='CommandPayload' else 'protocol/event.schema.json'
  schema=json.loads(original[file]);at=schema['$defs'][g['contract']]
  for key in g['path'][:-1]:at=at[key]
  del at[g['path'][-1]]
  Path(file).write_text(json.dumps(schema,indent=2)+'\n')
  result=subprocess.run(['mise','exec','--','elixir','bin/contracts.exs'],text=True,capture_output=True)
  output=re.sub(r'/(?:Users|private|tmp|var/folders)/[^\s)\]]+','[redacted-path]',result.stdout+result.stderr)
  rows.append({'guard':g,'generation_exit':result.returncode,'output':output[:1200]})
  for f,b in original.items():Path(f).write_bytes(b)
finally:
 for f,b in original.items():Path(f).write_bytes(b)
remaining=[r for r in rows if r['generation_exit']==0]
summary['generator_rejected']=len(rows)-len(remaining);summary['survivors']=[r['guard'] for r in remaining]
(folder/'schema-generation-red.json').write_text(json.dumps(rows,indent=2)+'\n')
(folder/'schema-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['guards','killed','generator_rejected','survivors']}))
if remaining:raise SystemExit(1)
