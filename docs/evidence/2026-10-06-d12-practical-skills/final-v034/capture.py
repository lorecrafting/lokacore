"""Retain redacted local D12 check transcripts with per-command status and hashes."""
import hashlib
import re
from pathlib import Path

root = Path(__file__).resolve().parents[4]
evidence = Path(__file__).parent


def redact(value):
    value = re.sub(r'(?i)(/Containers/(?:Data/Application|Shared/AppGroup)/)[0-9a-f-]{36}',
                   r'\1<APP-CONTAINER>', value)
    value = value.replace(str(root), '<WORKTREE>').replace(str(Path.home()), '<HOME>')
    value = re.sub(r'(?:/private)?/(?:tmp|var/folders)/[^\s:,]+', '<SCRATCH>', value)
    value = re.sub(r'(?im)^\S+\s+(device|offline|unauthorized)(?=\s|$)',
                   r'<DEVICE> \1', value)
    return re.sub(
        r'(?im)((?:adb[_ ]serial|ANDROID_SERIAL|UDID|ECID|(?:iPhone )?serial(?:[ _]?number)?|'
        r'device[_ ]name|team[_ ]ID|(?:signing )?certificate(?:[ _](?:ID|name))?|'
        r'provisioning(?:[ _]profile)?(?:[ _](?:ID|name))?|'
        r'DEVELOPMENT_TEAM|CODE_SIGN_IDENTITY|PROVISIONING_PROFILE_SPECIFIER|'
        r'app-container UUID)\s*[:=]\s*)[^\r\n,]+', r'\1<REDACTED>', value)


checks = {
    'pin-compare': ('/tmp/loka-d12-pin-compare.log', 0),
    'focused-elixir': ('/tmp/loka-d12-focused-elixir.log', 0),
    'focused-kernel': ('/tmp/loka-d12-focused-kernel.log', 0),
    'focused-host-initial': ('/tmp/loka-d12-focused-host.log', 1),
    'focused-host-restored': ('/tmp/loka-d12-focused-host-restored.log', 0),
    'browser-initial': ('/tmp/loka-d12-browser.log', 1),
    'browser-restored': ('/tmp/loka-d12-browser-restored.log', 0),
    'red-count': ('/tmp/loka-d12-red-count.log', 1),
    'green-count': ('/tmp/loka-d12-green-count.log', 0),
    'mismatch-initial': ('/tmp/loka-d12-active-mismatch.log', 1),
    'mismatch-restored': ('/tmp/loka-d12-active-mismatch-restored.log', 0),
    'types-kernel': ('/tmp/loka-d12-types-kernel.log', 0),
    'types-app': ('/tmp/loka-d12-app-types.log', 0),
    'full-initial': ('/tmp/loka-d12-full-check.log', 1),
    'full-final': ('/tmp/loka-d12-full-final.log', 0),
}
for name, (source, code) in checks.items():
    content = redact(Path(source).read_text())
    (evidence / f'{name}.log').write_text(f'check: {name}\nexit_status: {code}\n{content}')
files = sorted(evidence.glob('*.log'))
(evidence / 'SHA256SUMS').write_text(''.join(
    f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in files))
(evidence / 'SHA256SUMS.verify.log').write_text(''.join(
    f'{p.name}: OK\n' for p in files if hashlib.sha256(p.read_bytes()).hexdigest() ==
    next(line.split()[0] for line in (evidence / 'SHA256SUMS').read_text().splitlines()
         if line.endswith(f'  {p.name}'))))
print(f'{len(files)} redacted transcripts hashed and verified')
