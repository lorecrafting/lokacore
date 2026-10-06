import subprocess,json
from pathlib import Path
mutants=[('duplicate increment','kernel/ts/src/foundation/compose_choice.ts','a.count === op.prior_count','true'),('third fails quest','kernel/ts/src/mechanics/dialogue/behavior.ts',"ops.push({ op: 'choice.close', writer_group: 0, continuation_id: p.continuation_id });", "ops.push({ op: 'choice.close', writer_group: 0, continuation_id: p.continuation_id }, {op:'quest.transition',writer_group:0,instance_id:row.quest_instance_id!,from:'active',to:'failed',outcome:'wrong'} as never);")]
results=[]
for name,file,search,replacement in mutants:
 p=Path(file);original=p.read_bytes();assert search in original.decode(),name
 try:
  p.write_text(original.decode().replace(search,replacement,1))
  old=subprocess.run(['mise','exec','--','node','--test','kernel/ts/test/wren_riddle.test.ts'],capture_output=True,text=True)
  new=subprocess.run(['mise','exec','--','node','--test','kernel/ts/test/wisp.test.ts','kernel/ts/test/wisp_contracts.test.ts'],capture_output=True,text=True)
  results.append({'mutation':name,'old_focused_status':old.returncode,'new_focused_status':new.returncode,'killed':new.returncode!=0,'failing_tests':[l for l in new.stdout.splitlines() if l.startswith('✖')]})
 finally:p.write_bytes(original)
Path('docs/evidence/2026-10-05-b6-wisp/b6-extra-mutants.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results))
