import re,subprocess,sys,tempfile
from pathlib import Path
root=Path.cwd(); out=Path(__file__).parent
def redact(text):
 text=text.replace(str(root.resolve()),'[worktree]').replace(str(Path.home()),'[home]').replace(tempfile.gettempdir(),'[scratch]')
 text=re.sub(r'(?:/private)?/tmp/[^\s]+','[scratch]',text)
 return re.sub(r'(?im)((?:UDID|ECID|device serial|device name|team ID|certificate ID|provisioning ID|app-container UUID)\s*[:=]\s*)[^\n,]+',r'\1[redacted]',text)
if __name__=='__main__':
 name=sys.argv[1]; command=sys.argv[2:]
 p=subprocess.run(command,cwd=root,capture_output=True,text=True)
 (out/name).write_text(redact(p.stdout+p.stderr)+f'\nEXIT {p.returncode}\n')
 print(f'{name}: EXIT {p.returncode}',flush=True)
 sys.exit(p.returncode)
