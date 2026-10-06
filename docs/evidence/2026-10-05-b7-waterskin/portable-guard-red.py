from pathlib import Path
import hashlib,json,os,re,subprocess
folder=Path('tmp/b7-liquid-schema-sweep')
files=['kernel/ts/src/foundation/compose_liquid.ts','lib/loka/core/liquid.ex']
original={name:Path(name).read_text() for name in files}
fixture=Path('protocol/fixtures/liquid_composition.json');original_fixture=fixture.read_text();logs=[]
def redact(value):
 value=value.replace(str(Path.cwd()),'[workspace]').replace(str(Path.home()),'[home]')
 value=re.sub(r'/(?:Users|private|tmp|var/folders)/[^\s)\]]+','[redacted-path]',value)
 return re.sub(r'(?im)(?:adb serial|udid|ecid|device name|team id|certificate id|provisioning id)\s*[:=]\s*\S+','[redacted-identifier]',value)
def run(label,lang,expected_fail=True):
 cmd=['mise','exec','--']+(['node','--test','kernel/ts/test/liquid_composition.test.ts'] if lang=='TS' else ['mix','test','test/loka/core/liquid_test.exs','--force'])
 result=subprocess.run(cmd,text=True,capture_output=True,env=dict(os.environ,MIX_BUILD_PATH='_build/liquid_foundation'))
 logs.append(label+' '+lang+' exit '+str(result.returncode)+'\n'+redact(result.stdout+result.stderr))
 print(label,lang,'exit',result.returncode,flush=True)
 assert (result.returncode != 0)==expected_fail,label
try:
 # Before its one new malformed-row case, the old focused liquid suite missed the throw.
 name=files[0];text=original[name].replace("validate('DefinitionRef', value.kind).length === 0 &&",'')
 assert text!=original[name]
 Path(name).write_text(text)
 d=json.loads(original_fixture);d['cases']=[c for c in d['cases'] if c['id']!='malformed-kind-faults-without-canonical-throw'];fixture.write_text(json.dumps(d,indent=2)+'\n')
 run('malformed-reference-old-focused-fixture','TS',False)
 fixture.write_text(original_fixture)
 run('malformed-reference-new-fixture','TS')
 Path(name).write_text(original[name])
 mutants=[('missing-precondition',[(' && same(row, op.from)',''),('row == op["from"] and ','')]),('missing-debit',[('{ value: op.to }','{ value: op.from }'),('{:ok, op["to"]}','{:ok, op["from"]}')]),('unchecked-row-capacity',[('value.quantity <= spec.capacity &&',''),('and quantity <= cap','')]),('unchecked-immutable-capacity',[('spec.capacity > 2_147_483_647 ||',''),('and cap <= 2_147_483_647','')])]
 for label,changes in mutants:
  for name,(old,new) in zip(files,changes):
   assert old in original[name],(label,name)
   Path(name).write_text(original[name].replace(old,new))
  run(label,'TS');run(label,'Elixir')
  for name in files:Path(name).write_text(original[name])
finally:
 for name,text in original.items():Path(name).write_text(text)
 fixture.write_text(original_fixture)
 (folder/'guard-red.log').write_text('\n\n'.join(logs)+'\n')
 checked=['sweep.py','sweep.log','summary.json','guard_red.py','guard-red.log']
 (folder/'SHA256SUMS').write_text(''.join(hashlib.sha256((folder/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in checked))
 r=subprocess.run(['shasum','-a','256','-c','SHA256SUMS'],cwd=folder,text=True,capture_output=True)
 (folder/'verify.txt').write_text(r.stdout+r.stderr)
