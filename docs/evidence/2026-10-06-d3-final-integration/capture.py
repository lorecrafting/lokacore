import ast, re, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[3]
original=ast.parse((root/'docs/evidence/2026-10-06-c4-hound-behavior/d4_schema_sweep.py').read_text())
redact_node=next(n for n in original.body if isinstance(n,ast.FunctionDef) and n.name=='redact')
exec(compile(ast.Module(body=[redact_node],type_ignores=[]),'<redact>','exec'))
evidence=Path(__file__).parent
evidence.mkdir(exist_ok=True)
name,cmd=sys.argv[1],sys.argv[2]
r=subprocess.run(cmd,shell=True,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
(evidence/(name+'.log')).write_text('command: '+redact(cmd)+'\n'+redact(r.stdout)+'\nexit: '+str(r.returncode)+'\n')
print(name+': exit '+str(r.returncode))
if r.returncode:print(redact(r.stdout[-2500:]))

sys.exit(r.returncode)
