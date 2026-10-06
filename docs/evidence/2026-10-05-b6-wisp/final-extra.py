import subprocess,json
from pathlib import Path
mutants=[('dead opted NPC revealed','kernel/ts/src/mechanics/light/shared.ts','living(w, id as EntityId) &&','true &&'),('bound NPC key forgery','kernel/ts/src/mechanics/dialogue/shared.ts',"if (entity.key !== (expected.role === 'npc' ? expected.npc : expected.item).key)","if (false)")]
results=[]
for name,file,search,replacement in mutants:
 p=Path(file);original=p.read_bytes();assert search in original.decode(),name
 baseline=subprocess.run(['mise','exec','--','node','--test','kernel/ts/test/wisp.test.ts'],capture_output=True,text=True)
 assert baseline.returncode==0,baseline.stdout+baseline.stderr
 try:
  p.write_text(original.decode().replace(search,replacement,1))
  old=subprocess.run(['mise','exec','--','node','--test','kernel/ts/test/dialogue.test.ts','kernel/ts/test/wren_riddle.test.ts'],capture_output=True,text=True)
  new=subprocess.run(['mise','exec','--','node','--test','kernel/ts/test/wisp.test.ts'],capture_output=True,text=True)
  results.append({'mutation':name,'baseline_status':baseline.returncode,'old_focused_status':old.returncode,'new_focused_status':new.returncode,'killed':new.returncode!=0,'failing_tests':[l for l in new.stdout.splitlines() if l.startswith('✖')]})
 finally:p.write_bytes(original)
Path('docs/evidence/2026-10-05-b6-wisp/b6-final-extra.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results))
