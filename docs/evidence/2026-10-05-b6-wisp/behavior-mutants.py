import json,subprocess
from pathlib import Path
base=['mise','exec','--','node','--test']
old=['kernel/ts/test/wren_riddle.test.ts','kernel/ts/test/light.test.ts','kernel/ts/test/cartridge_riddle.test.ts']
new=['kernel/ts/test/wisp.test.ts','kernel/ts/test/wisp_contracts.test.ts']
mutants=[
 ('threshold equality','kernel/ts/src/mechanics/action_recipe/rule.ts','world.attributes[key(check.attribute)] >= check.difficulty','world.attributes[key(check.attribute)] > check.difficulty',old,new),
 ('light bypass','kernel/ts/src/mechanics/policy.ts',"if (p.op === 'light_off') return !illuminated(world, actor, steps);","if (p.op === 'light_off') return true;",old,new),
 ('marker exposes ordinary darkness','kernel/ts/src/mechanics/light/shared.ts','if (detail?.room === here && detail.perception?.self_luminous) return true;','if (detail?.room === here && Object.values(w.details).some(d => d.room === here && d.perception?.self_luminous)) return true;',old,new),
 ('wrong grants success','kernel/ts/src/mechanics/dialogue/rule.ts','return wrongAnswer(world, command, row, riddle, participants);','return applyChoice(world, command, mint, row, used, participants);',old,new),
 ('third remains pending','kernel/ts/src/mechanics/dialogue/behavior.ts','if (row.attempts.count + 1 === row.attempts.limit)','if (false)',old,new),
 ('reset retains old count','kernel/ts/src/mechanics/dialogue/rule.ts','attempts: { count: 0, limit: d.riddle.wrong_limit }','attempts: { count: 2, limit: d.riddle.wrong_limit }',old,new),
 ('Aldric selector ignored','kernel/ts/src/mechanics/dialogue/selection.ts','(!selected || world.cartridge.dialogues?.[refString(selected)] === d) &&','true &&',old,new),
 ('attempt foreign source','kernel/ts/src/foundation/compose_choice.ts','encode(r.source) === encode(op.source) &&','true &&',old,new),
 ('saved attempt foreign actor','mobile/authority/local-story/riddle-receipt.ts','actor_id: command.payload.actor_id,','actor_id: op.actor_id,',['mobile/authority/local-story/wren_riddle.test.ts'],['mobile/authority/local-story/wisp.test.ts']),
]
results=[]
for name,file,search,replacement,oldtests,newtests in mutants:
 p=Path(file);original=p.read_bytes();text=original.decode();assert search in text,(name,search)
 try:
  p.write_text(text.replace(search,replacement,1))
  a=subprocess.run(base+oldtests,capture_output=True,text=True)
  b=subprocess.run(base+newtests,capture_output=True,text=True)
  results.append({'mutation':name,'old_focused_status':a.returncode,'new_focused_status':b.returncode,'killed':b.returncode!=0,'failing_tests':[l for l in b.stdout.splitlines() if l.startswith('✖') and 'failing tests' not in l]})
 finally:p.write_bytes(original)
Path('docs/evidence/2026-10-05-b6-wisp/b6-behavior-mutants.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'mutants':len(results),'killed':sum(r['killed'] for r in results),'survivors':[r for r in results if not r['killed']]}))
