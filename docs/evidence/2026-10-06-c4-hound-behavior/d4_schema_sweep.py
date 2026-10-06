"""Delete each C4-added schema guard, regenerate, and run the literal C4 contract test."""
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).parent
schemas = {
    name: root / f'protocol/{name}.schema.json'
    for name in ('cartridge', 'delta', 'gameview', 'relation')
}
generated = [root / name for name in (
    'docs/contracts.gen.md', 'docs/residency.gen.json',
    'kernel/ts/src/contracts.gen.ts', 'kernel/ts/test/subset.gen.ts',
)]
original = {p: p.read_bytes() for p in [*schemas.values(), *generated]}


def redact(value):
    return re.sub(r'/private/tmp/[^\s:]+', '<SCRATCH>',
                  value.replace(str(root), '<WORKTREE>').replace(str(Path.home()), '<HOME>'))


def path(*parts):
    return parts


pack = path('$defs', 'PopulationPlan', 'properties', 'pack')
narration = pack + path('properties', 'narration')
enemy_fled = narration + path('properties', 'enemy_fled')
roster = path('$defs', 'CombatView', 'properties', 'active_opponents')
mutations = [
    ('flight minimum', 'cartridge', pack + path('properties', 'flight_below_percent', 'minimum')),
    ('flight maximum', 'cartridge', pack + path('properties', 'flight_below_percent', 'maximum')),
    ('flight fare const', 'cartridge', pack + path('properties', 'flight_fare', 'const')),
    ('enemy exit pattern', 'cartridge', enemy_fled + path('propertyNames', 'pattern')),
    ('enemy exit value', 'cartridge', enemy_fled + path('additionalProperties')),
    ('narration closed keys', 'cartridge', narration + path('additionalProperties')),
    ('pack closed keys', 'cartridge', pack + path('additionalProperties')),
    *[(f'pack requires {key}', 'cartridge', pack + path('required', key))
      for key in ('flight_below_percent', 'flight_fare', 'narration')],
    *[(f'narration requires {key}', 'cartridge', narration + path('required', key))
      for key in ('helper_joined', 'enemy_fled', 'primary_changed', 'pack_withdrew')],
    ('open roster cap', 'delta', path('$defs', 'DeltaOp', 'oneOf', 14, 'properties', 'active_ids', 'maxItems')),
    ('advance roster cap', 'delta', path('$defs', 'DeltaOp', 'oneOf', 15, 'properties', 'active_ids', 'maxItems')),
    ('saved encounter roster cap', 'delta', path('$defs', 'EncounterRow', 'properties', 'active_ids', 'maxItems')),
    ('view roster minimum', 'gameview', roster + path('minItems')),
    ('view roster maximum', 'gameview', roster + path('maxItems')),
    ('view member requires ID', 'gameview', roster + path('items', 'required', 'id')),
    ('view member requires name', 'gameview', roster + path('items', 'required', 'name')),
    ('view member closed keys', 'gameview', roster + path('items', 'additionalProperties')),
    ('flight clock minimum', 'relation', path('$defs', 'PopulationSlot', 'properties', 'last_flight_at', 'anyOf', 0, 'minimum')),
]
generation_red = {
    'flight fare const', 'enemy exit pattern', 'enemy exit value',
    'narration closed keys', 'pack closed keys', 'view member closed keys',
}


def restore():
    for file, contents in original.items():
        file.write_bytes(contents)


def run(*command):
    return subprocess.run(command, cwd=root, capture_output=True, text=True)


log = evidence / 'd4-schema-sweep.log'
try:
    with log.open('w') as output:
        for label, schema_name, parts in mutations:
            restore()
            schema_file = schemas[schema_name]
            schema = json.loads(schema_file.read_text())
            parent = schema
            for segment in parts[:-1]:
                parent = parent[segment]
            last = parts[-1]
            if isinstance(parent, list):
                parent.remove(last)
            else:
                del parent[last]
            schema_file.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + '\n')
            generated_result = run('mise', 'exec', '--', 'elixir', 'bin/contracts.exs')
            output.write(f'CASE {label}\nGEN_EXIT={generated_result.returncode}\n')
            output.write(redact(generated_result.stdout + generated_result.stderr))
            assert (generated_result.returncode != 0) == (label in generation_red), label
            if generated_result.returncode:
                print(f'{label}: RED generation', flush=True)
                continue
            tested = run('mise', 'exec', '--', 'node', '--test',
                         'kernel/ts/test/c4_schema_contracts.test.ts')
            output.write(f'TEST_EXIT={tested.returncode}\n')
            output.write(redact(tested.stdout + tested.stderr))
            assert tested.returncode != 0 and label in tested.stdout, f'{label} survived'
            print(f'{label}: RED literal contract', flush=True)
        output.write(f'TOTAL={len(mutations)} RED={len(mutations)}\n')
finally:
    restore()
