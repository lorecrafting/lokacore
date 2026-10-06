import subprocess
from pathlib import Path
root=Path.cwd()
def redact(text):
 import re
 text=text.replace(str(root.resolve()), '[worktree]').replace(str(Path.home()), '[home]')
 text=re.sub(r'(?:/private)?/tmp/[^\s]+', '[scratch]', text)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+', r'\1[redacted]', text)

old_ts=['mise','exec','--','node','--test','kernel/ts/test/escort_contracts.test.ts','kernel/ts/test/quest_dialogue.test.ts','kernel/ts/test/combat_flee.test.ts']
new_ts=['mise','exec','--','node','--test','kernel/ts/test/patrol.test.ts','kernel/ts/test/patrol_contracts.test.ts','kernel/ts/test/patrol_content.test.ts']
mutants=[
('TS full-prior comparison','kernel/ts/src/foundation/compose_patrol.ts','same(before, op.expected)','true',old_ts,new_ts),
('drawn attempt/cursor comparison','kernel/ts/src/mechanics/patrol/shared.ts','!same(input, drawn(row))','false',old_ts,new_ts),
('leader departure improperly grants credit','kernel/ts/src/mechanics/patrol/sequence.ts',"cursor: edge.next, status: 'awaiting'","cursor: edge.next, credit: [edge.there], status: 'awaiting'",old_ts,new_ts),
('checkpoint deduplication','kernel/ts/src/mechanics/patrol/sequence.ts','!before.credit.includes(destination_id)','true',old_ts,new_ts),
('fatal attempt reset','kernel/ts/src/mechanics/patrol/sequence.ts',"{ ...before, credit: [], status: 'failed' }","{ ...before, credit: before.credit, status: 'failed' }",old_ts,new_ts),
('reserved trust authoring','kernel/ts/src/content/cartridge_position.ts','[...refs, ...patrolRefs].includes(refString(s.fact))','refs.includes(refString(s.fact))',old_ts,new_ts),
('EX original identity','lib/loka/core/compose_patrol.ex','Map.take(before, @identity) == Map.take(value, @identity)','true',['mise','exec','--','mix','test','--force','test/loka/core/escort_test.exs'],['mise','exec','--','mix','test','--force','test/loka/core/patrol_test.exs']),
('EX route adjacency','lib/loka/content/patrol.ex','room != next and Enum.any?(r["exits"], fn {_, e} -> e["to"] == next end)','true',['mise','exec','--','mix','test','--force','test/loka/content_escort_test.exs'],['mise','exec','--','mix','test','--force','test/loka/content_patrol_test.exs']),
]
summary=[]
for name,file,before,after,old,new in mutants:
 p=root/file;original=p.read_text()
 if original.count(before)!=1:raise Exception(f'{name}: expected one literal edit, found {original.count(before)}')
 try:
  p.write_text(original.replace(before,after))
  previous=subprocess.run(old,cwd=root,capture_output=True,text=True)
  current=subprocess.run(new,cwd=root,capture_output=True,text=True)
  status=f'{name}: old exit {previous.returncode}; new exit {current.returncode}'
  print(status,flush=True);summary.append(status)
  if previous.returncode or current.returncode==0:
   log=redact(previous.stdout+previous.stderr+current.stdout+current.stderr)
   Path(__file__).with_name('behavior-control-failure.log').write_text(log)
   raise Exception('unexpected control outcome; inspect red-failure summary')
 finally:p.write_text(original)
Path(__file__).with_name('behavior-controls.log').write_text(redact('\n'.join(summary)+'\n'))
print(f'Behavior controls: {len(summary)} planted breaks observed red; originals restored.',flush=True)
