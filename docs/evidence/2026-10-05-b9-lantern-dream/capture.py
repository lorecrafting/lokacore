import tempfile
"""Focused final checks; logs always redact private host/scratch/device labels."""
import json,re,subprocess,time
from pathlib import Path
root=Path.cwd(); destination=Path(__file__).parent

def redact(text):
 text=text.replace(str(root.resolve()),'[worktree]').replace(str(Path.home()),'[home]').replace(tempfile.gettempdir(),'[scratch]')
 text=re.sub(r'(?:/private)?/tmp/[^\s]+','[scratch]',text)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+',r'\1[redacted]',text)

def run(name,args):
 started=time.monotonic(); result=subprocess.run(args,capture_output=True,text=True)
 destination.joinpath(name+'.log').write_text(redact('command: '+' '.join(args)+'\nexit: '+str(result.returncode)+'\n'+result.stdout+result.stderr))
 print(name+': exit '+str(result.returncode),flush=True)
 return {'name':name,'command':args,'exit':result.returncode,'seconds':round(time.monotonic()-started,3)}

jobs=[
 ('pins',['mise','exec','--','node','docs/evidence/2026-10-05-b9-lantern-dream/pins.mjs']),
 ('focused',['mise','exec','--','node','--test','kernel/ts/test/dream.test.ts','kernel/ts/test/dream_contracts.test.ts','kernel/ts/test/cartridge_dreams.test.ts','kernel/ts/test/position.test.ts','kernel/ts/test/scene.test.ts','kernel/ts/test/dialogue.test.ts','kernel/ts/test/quest_dialogue.test.ts','kernel/ts/test/missing_child.test.ts','mobile/authority/local-story/dream.test.ts','mobile/authority/local-story/service.test.ts','mobile/authority/local-story/scene.test.ts','mobile/authority/local-story/death.test.ts','mobile/authority/local-story/vesper_message.test.ts','mobile/app/book/dream.test.ts','mobile/app/book/live_actions.test.ts','mobile/app/book/notice_board.test.ts']),
 ('elixir-focused',['mise','exec','--','mix','test','--force','test/loka/content_dreams_test.exs','test/loka/content_services_test.exs','test/loka/content_scenes_test.exs','test/loka/content_missing_child_test.exs','test/loka/content_patrol_test.exs']),
 ('kernel-types',['mise','exec','--','npm','--prefix','kernel/ts','run','typecheck']),
 ('app-types',['mise','exec','--','mobile/app/node_modules/.bin/tsc','-p','mobile/app']),
 ('renderer-imports',['mise','exec','--','ast-grep','test','--skip-snapshot-tests','--filter','mobile-renderer-imports|ts-rule-module-imports']),
 ('renderer-boundary',['mise','exec','--','ast-grep','scan','--error','--filter','mobile-renderer-imports','mobile/app/book']),
 ('docs',['mise','exec','--','elixir','bin/check_docs.exs']),
 ('trace-capture',['mise','exec','--','node','docs/evidence/2026-10-05-b9-lantern-dream/trace-capture.mjs']),
]
results=[run(name,args) for name,args in jobs]
destination.joinpath('checks.json').write_text(json.dumps({'base':'594b8ae1b6c790891e49d160ff4d023c9db1e9f1','source_checkpoint':None,'candidate_provisional':True,'checks':results},indent=2)+'\n')
raise SystemExit(0 if all(r['exit']==0 for r in results) else 1)
