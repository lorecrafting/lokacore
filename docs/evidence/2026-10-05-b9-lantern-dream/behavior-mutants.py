import tempfile
import subprocess,re,sys
from pathlib import Path
root=Path.cwd()
def redact(text):
 text=text.replace(str(root.resolve()),'[worktree]').replace(str(Path.home()),'[home]').replace(tempfile.gettempdir(),'[scratch]')
 text=re.sub(r'(?:/private)?/tmp/[^\s]+','[scratch]',text)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+',r'\1[redacted]',text)
def node(*files):return ['mise','exec','--','node','--test',*files]
old=node('kernel/ts/test/position.test.ts','kernel/ts/test/scene.test.ts','kernel/ts/test/dialogue.test.ts','kernel/ts/test/resources.test.ts')
new=node('kernel/ts/test/dream.test.ts')
oldsave=node('mobile/authority/local-story/service.test.ts','mobile/authority/local-story/scene.test.ts','mobile/authority/local-story/vesper_message.test.ts')
newsave=node('mobile/authority/local-story/dream.test.ts','mobile/app/book/dream.test.ts')
mutants=[
 ('missing typed Rest producer','kernel/ts/src/mechanics/position/rule.ts',"type === 'rest'","false",old,new),
 ('presentation checkpoint becomes modal','kernel/ts/src/mechanics/scene/shared.ts',"if (s.control !== 'modal') continue;",'',old,new),
 ('scene choice hijacks ordinary dialogue','kernel/ts/src/mechanics/dialogue/selection.ts',"c.source.kind === 'dialogue' &&",'',old,new),
 ('missing acknowledged memory','kernel/ts/src/mechanics/scene/sequence.ts','for (const assign of scene.on_end.assign)','for (const assign of [])',old,new),
 ('foreign captured draw accepted','kernel/ts/src/mechanics/scene/dream_shared.ts','!same(p.dream, draw(world, p.actor_id, scene, row)) ||','',old,new),
 ('free dream memory writer','kernel/ts/src/mechanics/fact.ts',"owner !== 'scene' &&",'false &&',old,new),
 ('bed view bypasses keyed policy','kernel/ts/src/view/dreams.ts','const blocked = refusal(world, p, steps, action.key);','const blocked = undefined;',old,new),
 ('save binds scene row as dialogue','mobile/authority/local-story/dialogue-save.ts',".filter(([, r]) => r.source.kind === 'dialogue')",'',oldsave,newsave),
 ('receipt routes dream to World','mobile/authority/local-story/save.ts','const dream = dreamDetail(s, command);','const dream = undefined;',oldsave,newsave),
 ('loader accepts unsafe dream graph','kernel/ts/src/content/cartridge_dreams.ts',"bad('.steps');",'undefined;',node('kernel/ts/test/cartridge_services.test.ts','kernel/ts/test/scene.test.ts'),node('kernel/ts/test/cartridge_dreams.test.ts')),
 ('compiler accepts unsafe dream graph','lib/loka/content/dreams.ex','Enum.map(s["steps"], & &1["type"]) == want','true',['mise','exec','--','mix','test','--force','test/loka/content_scenes_test.exs','test/loka/content_services_test.exs'],['mise','exec','--','mix','test','--force','test/loka/content_dreams_test.exs']),
 ('checker ignores wrong authored key','kernel/ts/src/view/invariants_view.ts','if (!entry || (key && entry.action_key !== key))','if (!entry)',old,new),
 ('Book substitutes semantic Choose','mobile/app/book/dreams.ts','action_key: c.action_key!,',"action_key: 'choose',",node('mobile/app/book/liquid.test.ts','mobile/app/book/live_actions.test.ts'),node('mobile/app/book/dream.test.ts')),
 ('eligibility ignores shared query budget','kernel/ts/src/mechanics/scene/dream_shared.ts','if (++steps.n > LIMITS.query_steps)', 'if (steps.n > LIMITS.query_steps)',old,new),
 ('Rest delivery credits a nonliving body','kernel/ts/src/mechanics/scene/rest.ts',"(level(world, p.body_id, resourceRef(world, 'hp')) ?? 0) <= 0",'false',old,new),
 ('wrong declared final quest outcome','kernel/ts/src/mechanics/scene/sequence.ts','scene.on_end.outcome,', "'wrong_outcome',",old,new),
]
summary=[]; detail=[]
if len(sys.argv)>1:mutants=[m for m in mutants if m[0] in sys.argv[1:]]
for name,file,before,after,prior,current in mutants:
 p=root/file; original=p.read_text()
 if original.count(before)!=1:raise Exception(f'{name}: literal edit count {original.count(before)}')
 try:
  p.write_text(original.replace(before,after))
  previous=subprocess.run(prior,cwd=root,capture_output=True,text=True)
  focused=subprocess.run(current,cwd=root,capture_output=True,text=True)
  status=f'{name}: old exit {previous.returncode}; focused exit {focused.returncode}'
  print(status,flush=True);summary.append(status)
  detail.append(name+'\nold command: '+' '.join(prior)+'\nfocused command: '+' '.join(current)+'\n'+focused.stdout+focused.stderr)
  if previous.returncode or focused.returncode==0:
   Path(__file__).with_name('behavior-control-failure.log').write_text(redact(previous.stdout+previous.stderr+focused.stdout+focused.stderr))
   raise Exception('unexpected red control result')
 finally:p.write_text(original)
Path(__file__).with_name('behavior-controls.log').open('a' if len(sys.argv)>1 else 'w').write(redact('\n'.join(summary)+'\n'))
Path(__file__).with_name('behavior-failing-assertions.log').open('a' if len(sys.argv)>1 else 'w').write(redact('\n'.join(detail)+'\n'))
print(f'{len(summary)} planted breaks observed red; originals restored.',flush=True)
