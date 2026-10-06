"""Controlled redaction inputs; prints labels only, never input values."""
import importlib.util
import sys
from pathlib import Path

script = Path(__file__).with_name('d4_schema_sweep.py')
spec = importlib.util.spec_from_file_location('d4_schema_sweep', script)
sweep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sweep)

cases = [
    ('worktree', str(sweep.root / 'probe'), '<WORKTREE>'),
    ('home', str(Path.home() / 'probe'), '<HOME>'),
    ('private scratch', '/private/tmp/probe', '<SCRATCH>'),
    ('ordinary scratch', '/tmp/probe', '<SCRATCH>'),
    ('Darwin scratch', '/var/folders/aa/bb/T/probe', '<SCRATCH>'),
    ('private Darwin scratch', '/private/var/folders/aa/bb/T/probe', '<SCRATCH>'),
    ('adb serial', 'adb serial: SECRET_ADB', '<REDACTED>'),
    ('Android serial key', 'ANDROID_SERIAL=SECRET_ADB', '<REDACTED>'),
    ('adb devices row', 'SECRET_ADB device', '<DEVICE>'),
    ('iPhone UDID', 'UDID: SECRET_UDID', '<REDACTED>'),
    ('iPhone ECID', 'ECID: SECRET_ECID', '<REDACTED>'),
    ('iPhone serial', 'Serial Number: SECRET_SERIAL', '<REDACTED>'),
    ('device name', 'Device Name: SECRET_NAME', '<REDACTED>'),
    ('device name key', 'device_name=SECRET_NAME', '<REDACTED>'),
    ('team ID', 'DEVELOPMENT_TEAM = SECRET_TEAM', '<REDACTED>'),
    ('certificate', 'Certificate ID: SECRET_CERT', '<REDACTED>'),
    ('signing certificate', 'Signing Certificate: SECRET_CERT', '<REDACTED>'),
    ('provisioning', 'PROVISIONING_PROFILE_SPECIFIER = SECRET_PROFILE', '<REDACTED>'),
    ('app-container UUID',
     '/Containers/Data/Application/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/probe',
     '<APP-CONTAINER>'),
]

redact = (lambda value: value) if sys.argv[1:] == ['--broken'] else sweep.redact
failed = 0
for label, sample, marker in cases:
    result = redact(sample)
    if marker not in result or result == sample:
        print(f'{label}: RED')
        failed += 1
    else:
        print(f'{label}: GREEN')
print(f'TOTAL={len(cases)} FAILED={failed}')
sys.exit(bool(failed))
