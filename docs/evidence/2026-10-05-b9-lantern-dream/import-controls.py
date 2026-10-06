import tempfile
"""Old-suite-first controls for the new explicit pure-helper and renderer import permissions."""
import subprocess,re
from pathlib import Path
root=Path.cwd();d=Path(__file__).parent

def redact(s):
 s=s.replace(str(root.resolve()),'[worktree]').replace(str(Path.home()),'[home]').replace(tempfile.gettempdir(),'[scratch]');s=re.sub(r'(?:/private)?/tmp/[^\s]+','[scratch]',s)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+',r'\1[redacted]',s)

logs=[]
for name,rule,test,before,after in [
 ('DreamPage','mobile-renderer-imports','mobile-renderer-imports','DreamPage|',''),
 ('dreams','mobile-renderer-imports','mobile-renderer-imports','dreams|',''),
 ('positions','mobile-renderer-imports','mobile-renderer-imports','positions|',''),
 ('scene sequence','ts-rule-module-imports','ts-rule-module-imports','(patrol|scene)/sequence','patrol/sequence')]:
 rp=Path('lint/rules/'+rule+'.yml');tp=Path('lint/tests/'+test+'-test.yml')
 original=rp.read_text();current=tp.read_text();old=subprocess.check_output(['git','show','594b8ae1:'+str(tp)],text=True)
 assert original.count(before)==1
 try:
  rp.write_text(original.replace(before,after));tp.write_text(old)
  command=['mise','exec','--','ast-grep','test','--skip-snapshot-tests','--filter',rule]
  prior=subprocess.run(command,capture_output=True,text=True)
  tp.write_text(current);new=subprocess.run(command,capture_output=True,text=True)
  assert prior.returncode==0 and new.returncode!=0
  logs.append(name+': old exit 0; current exit '+str(new.returncode)+'\ncommand: '+' '.join(command)+'\n'+new.stdout+new.stderr)
 finally:rp.write_text(original);tp.write_text(current)
restored=subprocess.run(['mise','exec','--','ast-grep','test','--skip-snapshot-tests','--filter','mobile-renderer-imports|ts-rule-module-imports'],capture_output=True,text=True)
assert restored.returncode==0
logs.append('Restored controls exit 0\n'+restored.stdout+restored.stderr)
d.joinpath('import-controls.log').write_text(redact('\n'.join(logs)))
print('Four explicit import permissions observed red against new controlled cases; older cases pass; originals restored and green.')
