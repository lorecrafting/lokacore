"""Retain sanitized D5 outcomes; input directory is supplied by the caller."""
import hashlib
from pathlib import Path
import re
import sys

source = Path(sys.argv[1])
here = Path(__file__).parent

def redact(text):
    text = re.sub(r'(?i)\b(?:adb[_ ]serial|udid|ecid|device[_ ]name|team[_ ]id|certificate[_ ]id|provisioning[_ ]id)\s*[:=]\s*\S+', '[redacted-device]', text)
    return re.sub(r'(?:/Users/|/private/var/|/var/folders/|/tmp/)[^\s]+', '[redacted-path]', text)


logs = {
    'focused.log': 'd5-focused.log',
    'existing-authority.log': 'd5-existing-authority.log',
    'compiler.log': 'd5-final-compiler.log',
    'full-check.log': 'd5-check-all-exact.log',
    'initial-full-check-red.log': 'd5-check-all.log',
    'synthetic-fatal-refused.log': 'd5-fatal.log',
    'behavior-mutants.json': 'd5-red-controls.json',
}
for target, origin in logs.items():
    (here / target).write_text(redact((source / origin).read_text()))
files = [*logs, 'behavior-mutants.py', 'capture.py']
(here / 'SHA256SUMS').write_text(''.join(
    f'{hashlib.sha256((here / name).read_bytes()).hexdigest()}  {name}\n'
    for name in sorted(files)
))
