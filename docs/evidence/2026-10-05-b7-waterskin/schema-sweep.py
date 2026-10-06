import copy, hashlib, json, os, re, subprocess
from pathlib import Path

folder = Path('tmp/b7-liquid-schema-sweep')
files = ['protocol/liquid.schema.json', 'protocol/command.schema.json', 'protocol/event.schema.json', 'protocol/delta.schema.json']
generated = ['kernel/ts/src/contracts.gen.ts', 'kernel/ts/test/subset.gen.ts', 'docs/contracts.gen.md', 'docs/residency.gen.json']
original = {name: Path(name).read_bytes() for name in files + generated}
schemas = {name: json.loads(original[name]) for name in files}
roots = [(files[0], ['$defs', name], value) for name, value in schemas[files[0]]['$defs'].items()]
for file, name, field, values in [
    (files[1], 'CommandPayload', 'type', ['fill','pour','drink']),
    (files[2], 'EventPayload', 'type', ['filled','poured','drank']),
    (files[3], 'DeltaOp', 'op', ['liquid.set']),
    (files[3], 'MutationTarget', 'kind', ['liquid'])]:
    roots += [(file, ['$defs', name, 'oneOf', i], b) for i, b in enumerate(schemas[file]['$defs'][name]['oneOf']) if b.get('properties',{}).get(field,{}).get('const') in values]
mutants=[]
def walk(file, path, value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == 'required':
                mutants.extend((file, path+[key], index, key) for index in range(len(child)))
            elif key in ['minimum','maximum','const','type','additionalProperties']:
                mutants.append((file,path+[key],None,key))
            walk(file,path+[key],child)
    elif isinstance(value,list):
        for index, child in enumerate(value):walk(file,path+[index],child)
for file,path,value in roots:walk(file,path,value)

def redact(value):
    value=value.replace(str(Path.cwd()), '[workspace]').replace(str(Path.home()), '[home]')
    value=re.sub(r'/(?:Users|private|tmp|var/folders)/[^\s)\]]+', '[redacted-path]', value)
    return re.sub(r'(?im)(?:adb serial|udid|ecid|device name|team id|certificate id|provisioning id)\s*[:=]\s*\S+', '[redacted-identifier]', value)

def run(command):
    result=subprocess.run(['mise','exec','--']+command,text=True,capture_output=True,env=dict(os.environ,MIX_BUILD_PATH='_build/liquid_foundation'))
    return result.returncode,redact(result.stdout+result.stderr)

survivors=[];counts={'generation':0,'both_tests':0};rows=[]
try:
    for index,(file,path,entry,kind) in enumerate(mutants,1):
        value=copy.deepcopy(schemas[file]);at=value
        for key in path[:-1]:at=at[key]
        if entry is None:del at[path[-1]]
        else:del at[path[-1]][entry]
        Path(file).write_text(json.dumps(value,indent=2)+'\n')
        label=file+':'+('/'.join(str(x) for x in path))+('['+str(entry)+']' if entry is not None else '')
        log=['MUTANT '+str(index)+'/'+str(len(mutants))+' '+label]
        gen_code,gen_output=run(['elixir','bin/contracts.exs'])
        log += ['generation exit '+str(gen_code),gen_output]
        if gen_code:
            counts['generation']+=1;outcome='generation rejected'
        else:
            ts_code,ts_output=run(['node','--test','kernel/ts/test/liquid_contracts.test.ts'])
            ex_code,ex_output=run(['mix','test','test/loka/core/liquid_contracts_test.exs','--force'])
            log += ['TS exit '+str(ts_code),ts_output,'Elixir exit '+str(ex_code),ex_output]
            if ts_code and ex_code:
                counts['both_tests']+=1;outcome='both tests rejected'
            else:
                survivors.append({'mutation':label,'ts':ts_code,'elixir':ex_code});outcome='SURVIVOR'
        rows.append('\n'.join(log))
        for name in files+generated:Path(name).write_bytes(original[name])
        if index%10==0 or outcome=='SURVIVOR' or index==len(mutants):print(str(index)+'/'+str(len(mutants))+' '+outcome,flush=True)
finally:
    for name,data in original.items():Path(name).write_bytes(data)
    summary={'mutants':len(mutants),'counts':counts,'survivors':survivors,'required_entries':sum(x[3]=='required' for x in mutants),'numeric_bounds':sum(x[3] in ['minimum','maximum'] for x in mutants),'const':sum(x[3]=='const' for x in mutants),'types':sum(x[3]=='type' for x in mutants),'closed_shapes':sum(x[3]=='additionalProperties' for x in mutants)}
    (folder/'sweep.log').write_text('\n\n'.join(rows)+'\n')
    (folder/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    checked=['sweep.py','sweep.log','summary.json']
    (folder/'SHA256SUMS').write_text(''.join(hashlib.sha256((folder/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in checked))
    result=subprocess.run(['shasum','-a','256','-c','SHA256SUMS'],cwd=folder,text=True,capture_output=True)
    (folder/'verify.txt').write_text(result.stdout+result.stderr)
    print(json.dumps(summary),flush=True)
if survivors:raise SystemExit(1)
