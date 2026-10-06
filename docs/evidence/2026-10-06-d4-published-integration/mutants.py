import subprocess,json,sys
from pathlib import Path
import tempfile,re
def redact(text):
 text=text.replace(str(Path.cwd()), '[worktree]').replace(str(Path.home()), '[home]').replace(tempfile.gettempdir(), '[scratch]')
 return re.sub(r'/private/tmp/[^\s]+|/var/folders/[^\s]+','[scratch]',text)
root=Path.cwd(); folder=Path(__file__).parent
node=lambda *files:['mise','exec','--','node','--test',*files]
mix=lambda *files:['mise','exec','--','mix','test','--force',*files]
controls=[]
def add(name,file,change,old,new):controls.append((name,file,change,old,new))
def without_guard(s):
 a=s.index('  const known = section(ctx.state,'); b=s.index('  if (row !== source)',a); return s[:a]+s[b:]
add('ts-terminal','kernel/ts/src/foundation/compose.ts',without_guard,node('kernel/ts/test/compose.test.ts'),node('kernel/ts/test/food_composition.test.ts'))
add('ex-terminal','lib/loka/core/compose.ex',lambda s:s.replace('      not Loka.Core.ComposeFood.valid?(op, elem(ctx, 0)) ->\n        {:error, "precondition_failed"}\n\n',''),mix('test/loka/core/compose_test.exs'),mix('test/loka/core/food_test.exs'))
add('ts-independent','kernel/ts/src/runtime/invariants.ts',lambda s:s.replace('foodTransferValid(op, s) && ','') ,node('kernel/ts/test/compose.test.ts'),node('kernel/ts/test/food_composition.test.ts'))
add('ex-independent','lib/loka/core/invariants.ex',lambda s:s.replace('      Loka.Core.InvariantsFood.holds?(s, ops) and\n',''),mix('test/loka/core/compose_test.exs'),mix('test/loka/core/food_test.exs'))
add('missing-terminal-write','kernel/ts/src/mechanics/food/shared.ts',lambda s:s[:s.index("      {\n        op: 'entity.transfer'")]+s[s.index('      adjust(',s.index("      {\n        op: 'entity.transfer'")):],node('kernel/ts/test/service.test.ts'),node('kernel/ts/test/food.test.ts'))
add('missing-cap','kernel/ts/src/mechanics/food/shared.ts',lambda s:s.replace('Math.min(edible.amount, spec.maximum - current)','edible.amount'),node('kernel/ts/test/service.test.ts'),node('kernel/ts/test/food.test.ts'))
add('indirect-food','kernel/ts/src/mechanics/food/shared.ts',lambda s:s.replace("if (world.state.containers[p.item_id] !== body) return { code: 'not_owned' };",''),node('kernel/ts/test/service.test.ts'),node('kernel/ts/test/food.test.ts'))
add('full-mv','kernel/ts/src/mechanics/food/shared.ts',lambda s:s.replace("if (current >= spec.maximum) return { code: 'invalid_state' };",''),node('kernel/ts/test/service.test.ts'),node('kernel/ts/test/food.test.ts'))
add('unkeyed-offer','kernel/ts/src/mechanics/food/shared.ts',lambda s:s.replace('refusal(world, p, steps, action)','refusal(world, p, steps)'),node('kernel/ts/test/service.test.ts'),node('kernel/ts/test/food.test.ts'))
add('food-only-save','mobile/authority/local-story/liquid-save.ts',lambda s:s.replace(' &&\n    !fresh.consumed','').replace(' && !fresh.consumed',''),node('mobile/authority/local-story/service.test.ts'),node('mobile/authority/local-story/food.test.ts'))
add('eat-narration-binding','mobile/authority/local-story/save.ts',lambda s:s.replace('return eatReceipt(s.world, command, r.command_id, d);','return undefined;'),node('mobile/authority/local-story/narration_routing.test.ts'),node('mobile/authority/local-story/food.test.ts'))
add('book-eat-route','mobile/app/book/presenter.ts',lambda s:s.replace("['taken', 'dropped', 'eaten']","['taken', 'dropped']"),node('mobile/app/book/item_detail.test.ts'),node('mobile/app/book/food.test.ts'))
add('loader-food','kernel/ts/src/content/cartridge.ts',lambda s:s.replace('    ...food(c),\n',''),node('kernel/ts/test/cartridge_services.test.ts'),node('kernel/ts/test/cartridge_food.test.ts'))
add('compiler-food','lib/loka/content/compiler.ex',lambda s:s.replace('      Loka.Content.Food.check(manifest, defs, v2),\n',''),mix('test/loka/content_services_test.exs'),mix('test/loka/content_food_test.exs'))
add('holder-row-hydration','kernel/ts/src/runtime/created.ts',lambda s:s.replace('      id === world.consumed ||\n',''),node('kernel/ts/test/death.test.ts'),node('kernel/ts/test/food.test.ts'))
add('MV-only-food-binding','kernel/ts/src/content/cartridge_food.ts',lambda s:s.replace("      recovery?.key !== 'mv' ||\n",''),node('kernel/ts/test/cartridge_services.test.ts'),node('kernel/ts/test/cartridge_food.test.ts'))
summary=[]
for index,(name,file,change,old,new) in enumerate(controls):
 if len(sys.argv)>1 and index<int(sys.argv[1]):
  assert (folder/f'mutant-{name}-old.log').read_text().endswith('EXIT 0\n')
  assert not (folder/f'mutant-{name}-new.log').read_text().endswith('EXIT 0\n')
  summary.append({'control':name,'old':'GREEN','new':'RED'});continue
 p=root/file; original=p.read_text(); mutated=change(original)
 if mutated==original:raise RuntimeError('No mutation: '+name)
 try:
  p.write_text(mutated)
  for label,command in [('old',old),('new',new)]:
   r=subprocess.run(command,cwd=root,capture_output=True,text=True)
   (folder/f'mutant-{name}-{label}.log').write_text(redact(r.stdout+r.stderr)+f'\nEXIT {r.returncode}\n')
   if label=='old' and r.returncode:raise RuntimeError('Existing focused control: '+name)
   if label=='new' and not r.returncode:raise RuntimeError('SURVIVED: '+name)
  summary.append({'control':name,'old':'GREEN','new':'RED'})
  print(name+': old GREEN / new RED',flush=True)
 finally:p.write_text(original)
(folder/'mutants.json').write_text(json.dumps(summary,indent=2)+'\n')
