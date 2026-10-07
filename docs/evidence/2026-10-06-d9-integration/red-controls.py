"""One temporary production mutation per core D9 break; always restore source."""
from pathlib import Path
import subprocess

cases = [
    ('suppression ignored', 'kernel/ts/src/mechanics/population/shared.ts',
     'at < until', 'at > until', 'kernel/ts/test/d9_suppression.test.ts'),
    ('audible area leaks', 'kernel/ts/src/mechanics/bell/cue.ts',
     '!cue.rooms.some((r) => world.roomIds[refString(r)] === room_id)',
     'false', 'kernel/ts/test/d9_suppression.test.ts'),
    ('foreign corpse admits owner', 'kernel/ts/src/mechanics/movement/shared.ts',
     'identity.origin.owner_id !== actor ||', 'false ||', 'kernel/ts/test/study_ingress.test.ts'),
]
for label, filename, old, new, test in cases:
    path = Path(filename)
    original = path.read_text()
    assert original.count(old) == 1, label
    try:
        path.write_text(original.replace(old, new))
        result = subprocess.run(['mise', 'exec', '--', 'node', '--test', '--test-reporter=dot', test], capture_output=True, text=True)
        assert result.returncode == 1 and 'AssertionError' in result.stdout, label + ' did not produce an assertion failure'
        print('RED:', label, 'exit', result.returncode)
    finally:
        path.write_text(original)
result = subprocess.run(['mise', 'exec', '--', 'node', '--test', '--test-reporter=dot', 'kernel/ts/test/d9_suppression.test.ts', 'kernel/ts/test/study_ingress.test.ts'], capture_output=True, text=True)
assert result.returncode == 0, 'restored core checks failed'
print('GREEN: restored core checks exit', result.returncode)
