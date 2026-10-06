"""Retain redacted D2 round-1 outcomes from a caller-supplied input directory."""
import hashlib
from pathlib import Path
import re
import sys

source = Path(sys.argv[1])
here = Path(__file__).parent

def redact(text):
    text = re.sub(r'(?i)\b(?:adb[_ ]serial|udid|ecid|device[_ ]name|team[_ ]id|certificate[_ ]id|provisioning[_ ]id)\s*[:=]\s*\S+', '[redacted-device]', text)
    return re.sub(r'(?:/Users/|/private/var/|/var/folders/|/tmp/)[^\s]+', '[redacted-path]', text)

logs = ['book-red', 'save-red', 'restored', 'compiler', 'integrated-focused',
        'focused', 'pins', 'full', 'mobile-full', 'tsc']
for name in logs:
    (here / f'round-1-{name}.log').write_text(redact((source / f'd2-r1-{name}.log').read_text()))
files = [f'round-1-{name}.log' for name in logs] + ['round-1-capture.py']
(here / 'ROUND1-SHA256SUMS').write_text(''.join(
    f'{hashlib.sha256((here / name).read_bytes()).hexdigest()}  {name}\n'
    for name in sorted(files)
))
