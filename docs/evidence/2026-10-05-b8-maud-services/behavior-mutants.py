import subprocess,re
from pathlib import Path
root=Path.cwd()
def redact(text):
 text=text.replace(str(root.resolve()),'[worktree]').replace(str(Path.home()),'[home]')
 text=re.sub(r'(?:/private)?/tmp/[^\s]+','[scratch]',text)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+',r'\1[redacted]',text)
old=['mise','exec','--','node','--test','kernel/ts/test/commerce.test.ts','kernel/ts/test/liquid.test.ts','kernel/ts/test/resources.test.ts']
new=['mise','exec','--','node','--test','kernel/ts/test/service.test.ts','kernel/ts/test/cartridge_services.test.ts','mobile/authority/local-story/service.test.ts']
mutants=[
 ('omitted payment','kernel/ts/src/mechanics/service/shared.ts','let ops: readonly DeltaOp[] = paid.ops;','let ops: readonly DeltaOp[] = [];',old,new),
 ('omitted meal stock','kernel/ts/src/mechanics/service/shared.ts','ops = [...ops, adjust(world, p.provider_id, benefit.stock, -benefit.debit, {}).op];','ops = [...ops];',old,new),
 ('wrong bound service','kernel/ts/src/mechanics/service/shared.ts','world.cartridge.services?.[refString(p.service)]',"Object.values(world.cartridge.services ?? {}).find((s) => s.benefit.kind === 'entitlement')",old,new),
 ('bypassed keyed view admission','kernel/ts/src/mechanics/service/shared.ts','return blocked ? { code: blocked as ErrorCode } : transition(world, p, steps);','return transition(world, p, steps);',old,new),
 ('Book key equals command filter','mobile/app/book/offers.ts','.filter((s) => s.action.available)',".filter((s) => s.action.available && s.action.action_key === 'use_service')",['mise','exec','--','node','--test','mobile/app/book/liquid.test.ts'],new),
 ('omitted service-only history guard','mobile/authority/local-story/liquid-save.ts','if (!expected.length && !Object.keys(fresh.cartridge.services ?? {}).length) return false;','if (!expected.length) return false;',['mise','exec','--','node','--test','mobile/authority/local-story/liquid.test.ts'],['mise','exec','--','node','--test','--test-name-pattern=forged bounded','mobile/authority/local-story/service.test.ts']),
 ('free entitlement writer','kernel/ts/src/mechanics/fact.ts',"owner !== 'service' &&",'false &&',old,new),
 ('loader accepts regenerating service stock','kernel/ts/src/content/cartridge_services.ts','!!r && r.gain === 0 && !r.regen','!!r',old,new),
 ('compiler accepts regenerating service stock','lib/loka/content/services.ex','r["gain"] == 0 and r["regen"] == nil','true',['mise','exec','--','mix','test','--force','test/loka/content_liquids_test.exs','test/loka/content_missing_child_test.exs'],['mise','exec','--','mix','test','--force','test/loka/content_services_test.exs']),
]
summary=[]
for name,file,before,after,prior,current in mutants:
 p=root/file;original=p.read_text()
 if original.count(before)!=1:raise Exception(f'{name}: literal edit count {original.count(before)}')
 try:
  p.write_text(original.replace(before,after))
  previous=subprocess.run(prior,cwd=root,capture_output=True,text=True)
  focused=subprocess.run(current,cwd=root,capture_output=True,text=True)
  status=f'{name}: old exit {previous.returncode}; focused exit {focused.returncode}'
  print(status,flush=True);summary.append(status)
  if previous.returncode or focused.returncode==0:
   Path(__file__).with_name('behavior-control-failure.log').write_text(redact(previous.stdout+previous.stderr+focused.stdout+focused.stderr))
   raise Exception('unexpected red control result')
  failures='\n'.join(line for line in (focused.stdout+focused.stderr).splitlines() if any(token in line for token in ['✖','AssertionError','Expected','test at','Result:','Failed:','code: assert']))
  Path(__file__).with_name('behavior-failing-assertions.log').open('a').write(redact(name+'\n'+failures+'\n'))
 finally:p.write_text(original)
Path(__file__).with_name('behavior-controls.log').write_text(redact('\n'.join(summary)+'\n'))
print(f'{len(summary)} planted breaks observed red; originals restored.',flush=True)
