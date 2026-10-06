from pathlib import Path
import subprocess
root=Path.cwd()
def redact(text):
 import re
 text=text.replace(str(root.resolve()), '[worktree]').replace(str(Path.home()), '[home]')
 text=re.sub(r'(?:/private)?/tmp/[^\s]+', '[scratch]', text)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+', r'\1[redacted]', text)

rows=[('TS exclusive quest lifecycle','kernel/ts/src/content/cartridge_patrol.ts',"if (s.quest && refString(s.quest) === quest)","if (false)",['mise','exec','--','node','--test','kernel/ts/test/quest_dialogue.test.ts'],['mise','exec','--','node','--test','kernel/ts/test/patrol_content.test.ts']),('EX exclusive quest lifecycle','lib/loka/content/patrol.ex','s["quest"] && s["quest"]["key"] == q["key"],','false,',['mise','exec','--','mix','test','--force','test/loka/content_escort_test.exs'],['mise','exec','--','mix','test','--force','test/loka/content_patrol_test.exs'])]
for name,file,before,after,old,new in rows:
 p=root/file;s=p.read_text();assert s.count(before)==1
 try:
  p.write_text(s.replace(before,after));a=subprocess.run(old,cwd=root,capture_output=True);b=subprocess.run(new,cwd=root,capture_output=True);print(f'{name}: old exit {a.returncode}; new exit {b.returncode}',flush=True);assert a.returncode==0 and b.returncode!=0
 finally:p.write_text(s)
