"""Review regressions: restore each production defect, observe failure, then restore."""
from pathlib import Path
import json
import subprocess

def run(args):
    return subprocess.run(['mise', 'exec', '--', *args], capture_output=True, text=True)

path = Path('mobile/authority/local-story/deer-save.ts')
original = path.read_text()
old = subprocess.check_output(['git', 'show', '50b3e67f:mobile/authority/local-story/deer-save.ts'], text=True)
try:
    path.write_text(old)
    result = run(['node', '--test', '--test-name-pattern=uncertain bell', 'mobile/authority/local-story/d9.test.ts'])
    assert result.returncode == 1 and 'save_corrupt' in result.stdout
    print('RED: regular-first cold reopen at 237600, exit1 (save_corrupt)')
finally:
    path.write_text(original)

for name in ['a_aldric_debt', 'maud_offer', 'maud_turn_in']:
    path = Path(f'cartridges/ashmere_missing_child/dialogues/{name}.json')
    original = path.read_text()
    try:
        value = json.loads(original)
        del value['label']
        path.write_text(json.dumps(value))
        # This source mutant is mirrored into the candidate artifact without touching frozen predecessors.
        fixture = Path('protocol/fixtures/missing_child_v040_hash.json')
        saved = fixture.read_text()
        value = json.loads(saved)
        key = f'ashmere_missing_child@0.0.40:dialogue/{name}'
        del value['value']['dialogues'][key]['label']
        import hashlib
        value['canonical'] = json.dumps(value['value'], sort_keys=True, separators=(',', ':'), ensure_ascii=False)
        value['sha256'] = hashlib.sha256(value['canonical'].encode()).hexdigest()
        fixture.write_text(json.dumps(value))
        result = run(['node', '--test', '--test-name-pattern=terminal profiles', 'mobile/authority/local-story/d9.test.ts'])
        assert result.returncode == 1 and 'AssertionError' in result.stdout, name
        print(f'RED: {name} explicit binding removed, exit1 (terminal profile shadows service)')
    finally:
        path.write_text(original)
        fixture.write_text(saved)
result = run(['node', '--test', 'mobile/authority/local-story/d9.test.ts', 'mobile/authority/local-story/deer.test.ts'])
assert result.returncode == 0, 'restored SQLite/deer guards failed'
print('GREEN: restored SQLite D9 and deer guards, exit0')

for filename in [
    'lib/loka/core/compose_population.ex',
    'lib/loka/core/invariants_population.ex',
    'kernel/ts/src/foundation/compose_population.ts',
    'kernel/ts/src/runtime/invariants_population.ts',
]:
    path = Path(filename)
    original = path.read_text()
    try:
        path.write_text(subprocess.check_output(['git', 'show', f'de8b1cb5:{filename}'], text=True))
        args = ['mix', 'test', '--force', 'test/loka/core/population_composition_test.exs'] if filename.endswith('.ex') else ['node', '--test', 'kernel/ts/test/population_composition.test.ts']
        result = run(args)
        assert result.returncode in [1, 2] and ('Failed:' in result.stdout or 'AssertionError' in result.stdout), filename
        print(f'RED: pre-D9 {filename}, exit{result.returncode} (suppression literal/oracle rejects removal)')
    finally:
        path.write_text(original)
for args in [
    ['mix', 'test', '--force', 'test/loka/core/population_composition_test.exs'],
    ['node', '--test', 'kernel/ts/test/population_composition.test.ts'],
]:
    result = run(args)
    assert result.returncode == 0, 'restored portable checks failed'
print('GREEN: restored both-kernel literals and 120 randomized suppression cases, exit0')
