from pathlib import Path
import subprocess,json,re
folder=Path('docs/evidence/2026-10-06-d6-water-provisional');rows=[]
def run(cmd):
 r=subprocess.run(['mise','exec','--']+cmd,text=True,capture_output=True)
 out=(r.stdout+r.stderr).replace(str(Path.cwd()),'[workspace]').replace(str(Path.home()),'[home]');out=re.sub(r'/(?:Users|private|tmp|var/folders)/[^\s)\]]+','[redacted-path]',out)
 return r.returncode,out
for name,file,old_cmd,new_cmd,before,after in [
 ('ts-full-prior','kernel/ts/src/foundation/compose_water.ts',['node','--test','kernel/ts/test/compose.test.ts'],['node','--test','kernel/ts/test/water_composition.test.ts'],'same(row, before) &&','true &&'),
 ('elixir-full-prior','lib/loka/core/compose_water.ex',['mix','test','--force','test/loka/core/compose_test.exs'],['mix','test','--force','test/loka/core/water_composition_test.exs'],'row == before and','true and'),
 ('ts-independent-job-check','kernel/ts/src/runtime/invariants_encounter.ts',['node','--test','kernel/ts/test/encounter_composition.test.ts'],['node','--test','kernel/ts/test/water_composition.test.ts'],'if (!bindingValid(op)) return undefined;','if (false) return undefined;'),
 ('elixir-independent-job-check','lib/loka/core/invariants_encounter.ex',['mix','test','--force','test/loka/core/encounter_composition_test.exs'],['mix','test','--force','test/loka/core/water_composition_test.exs'],'and binding?(op),',',')]:
 original=Path(file).read_bytes();assert before in original.decode(),name
 try:
  Path(file).write_text(original.decode().replace(before,after,1));old_exit,old_log=run(old_cmd);new_exit,new_log=run(new_cmd)
  (folder/(name+'-old.log')).write_text(old_log);(folder/(name+'-red.log')).write_text(new_log)
  rows.append({'mutation':name,'old_exit':old_exit,'focused_exit':new_exit});print(name+' old='+str(old_exit)+' focused='+str(new_exit),flush=True)
 finally:Path(file).write_bytes(original)
 if old_exit!=0 or new_exit==0:break
(folder/'portable-mutation-summary.json').write_text(json.dumps(rows,indent=2)+'\n')
if len(rows)!=4 or any(r['old_exit']!=0 or r['focused_exit']==0 for r in rows):raise SystemExit(1)
