from pathlib import Path
import subprocess,re,json
folder=Path('docs/evidence/2026-10-06-d6-water-provisional');folder.mkdir(parents=True,exist_ok=True)
def redact(s):
 s=s.replace(str(Path.cwd()),'[workspace]').replace(str(Path.home()),'[home]')
 s=re.sub(r'/(?:Users|private|tmp|var/folders)/[^\s)\]]+','[redacted-path]',s)
 return re.sub(r'(?im)(?:adb serial|udid|ecid|device name|team id|certificate id|provisioning id)\s*[:=]\s*\S+','[redacted-identifier]',s)
def run(args):
 r=subprocess.run(['mise','exec','--']+args,text=True,capture_output=True);return r.returncode,redact(r.stdout+r.stderr)
old=['node','--test','kernel/ts/test/world.test.ts','kernel/ts/test/combat_flee.test.ts','kernel/ts/test/death.test.ts','kernel/ts/test/transport.test.ts','mobile/authority/local-story/transport.test.ts']
core=['node','--test','kernel/ts/test/water.test.ts'];host=['node','--test','mobile/authority/local-story/water.test.ts']
mutants=[]
def add(name,file,before,after,tests):mutants.append((name,file,before,after,tests))
add('overload-entry','kernel/ts/src/mechanics/water/shared.ts','if (mass > settings.maximum_grams)', 'if (mass > 9007199254740991)',core)
add('posture-blocks-up','kernel/ts/src/mechanics/water/shared.ts','if (!entering) return { ops: [] as DeltaOp[] };', "if (!entering) return standing(world, actor) ? {ops: [] as DeltaOp[]} : 'invalid_state' as const;",core)
add('fare-blocks-up','kernel/ts/src/mechanics/water/shared.ts','if (!entering) return { ops: [] as DeltaOp[] };', "if (!entering) return pay(world, body, [{resource: resourceRef(world, 'mv'), amount: 1}]) ?? 'insufficient_resource' as const;",core)
add('stale-drowns','kernel/ts/src/mechanics/water/expiry.ts','!matches(world, job_id, job, current)', 'false',core)
add('wrong-corpse-owner','kernel/ts/src/mechanics/containment/recovery.ts','    identity.origin.owner_id !== actor ||\n','',core)
add('roots-stay-in-corpse','kernel/ts/src/mechanics/containment/recovery.ts','destination_id: plan.body,','destination_id: p.corpse_id,',core)
add('malformed-job-typed-refusal','mobile/authority/local-story/store.ts','!world || !waterValid(world) || !encountersValid(world)','!world || !encountersValid(world) || !waterValid(world)',host)
add('expired-up-becomes-chapel-up','mobile/authority/local-story/invocation.ts','      reserved.surface_generation !== undefined &&','      false && reserved.surface_generation !== undefined &&',host)
add('empty-corpse-budget','kernel/ts/src/view/water.ts','    if (!nonempty.has(id)) continue;','',core)
add('wrong-move-key','kernel/ts/src/view/view.ts',"steps, 'move' as Key, set",'steps, undefined, set',core)
add('other-death-invalidation','kernel/ts/src/mechanics/death/sequence.ts','...leave(world, owner_id, writer_group),',"...(fatal.cause === 'drowning' ? leave(world, owner_id, writer_group) : []),",core)
rows=[]
for name,file,before,after,tests in mutants:
 original=Path(file).read_bytes();text=original.decode();assert before in text,(name,file)
 try:
  Path(file).write_text(text.replace(before,after,1))
  old_tests = old if name != 'other-death-invalidation' else ['node','--test','--test-name-pattern','water exact-edge|captured free|deadline 70800|Chapel recovery|both real bottoms|empty corpse history|water exit projection','kernel/ts/test/water.test.ts']
  old_exit,old_log=run(old_tests);new_exit,new_log=run(tests)
  (folder/(name+'-old.log')).write_text(old_log);(folder/(name+'-red.log')).write_text(new_log)
  rows.append({'mutation':name,'old_command':old_tests,'old_exit':old_exit,'focused_exit':new_exit,'failing_tests':[line for line in new_log.splitlines() if line.startswith('✖ ')]})
  print(name+' old='+str(old_exit)+' focused='+str(new_exit),flush=True)
 finally:Path(file).write_bytes(original)
 if old_exit!=0 or new_exit==0:break
(folder/'mutation-summary.json').write_text(json.dumps(rows,indent=2)+'\n')
if len(rows)!=len(mutants) or any(r['old_exit']!=0 or r['focused_exit']==0 for r in rows):raise SystemExit(1)
