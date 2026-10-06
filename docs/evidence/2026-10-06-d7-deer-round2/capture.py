"""Retain D7 round 2 red controls and gates without local identifiers."""
from pathlib import Path
import hashlib
import re
import subprocess

here = Path(__file__).resolve().parent
repo = here.parents[2]


def redact(value: str) -> str:
    value = value.replace(str(repo), '<repo>')
    value = re.sub(r'file://[^\s:)]*', '<local-path>', value)
    value = re.sub(r'(?<![\w:/>])/(?:[^\s/:()]+/)+[^\s/:()]+', '<local-path>', value)
    value = re.sub(r'(?i)(serial|udid|ecid|team[_ -]?id)\s*[:=]\s*\S+', r'\1=<redacted>', value)
    value = re.sub(r'(?i)(app-container|container)/[0-9a-f-]{36}', r'\1/<redacted>', value)
    return value


inputs = {
    'full-gate.log': '/tmp/d7-s3-full.log',
    'focused.log': '/tmp/d7-s3-focused.log',
    'sqlite.log': '/tmp/d7-s3-sqlite.log',
    'sight-only-red.log': '/tmp/d7-s3-red.log',
    'save-red.log': '/tmp/d7-s3-save-red.log',
}
for name, source in inputs.items():
    (here / name).write_text(redact(Path(source).read_text()))

files = sorted(p for p in here.iterdir() if p.is_file() and p.name not in {'SHA256SUMS', 'verify.txt'})
(here / 'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in files))
result = subprocess.run(['shasum', '-a', '256', '-c', 'SHA256SUMS'], cwd=here, text=True, capture_output=True)
(here / 'verify.txt').write_text(result.stdout + result.stderr + f'exit {result.returncode}\n')
if result.returncode:
    raise SystemExit(result.returncode)
