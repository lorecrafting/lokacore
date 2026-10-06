"""Independent D8 authored delta over frozen published D11 v038."""
import hashlib
import json
import uuid
from pathlib import Path

here = Path(__file__).parent
version = '0.0.39'
base = json.loads((here / 'missing_child_v038_hash.json').read_text())
assert base['sha256'] == '69fddb2135ff438c7de008a27f7328426c3511db352890498662e819dad5743e'
v = json.loads(json.dumps(base['value']).replace('0.0.38', version))
v['manifest']['requires']['kernel_api']['at_least'] = '1.34'

def named(kind, key):
    return f'ashmere_missing_child@{version}:{kind}/{key}'

# The pre-D8 trace is an independently retained transport answer. Only its
# authored additions belong here; its test entry/clock/coin relocation do not.
trace = json.loads((here / 'missing_child_d8_trace_hash.json').read_text())['value']
predecessor = json.loads((here / 'missing_child_v035_hash.json').read_text())['value']
for section in ('barriers', 'items', 'npcs', 'population_bundles', 'populations', 'text'):
    for key, value in trace[section].items():
        if key not in predecessor[section]:
            v[section][key.replace('0.0.35', version)] = json.loads(
                json.dumps(value).replace('0.0.35', version))
canonical = json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / 'missing_child_v039_hash.json').write_text(json.dumps({
    'description': 'D8 exact crow transport over frozen published D11 v038.',
    'value': v, 'canonical': canonical, 'sha256': digest,
}, indent=2, ensure_ascii=False) + '\n')

rooms = sorted(v['rooms'].items())
labels = ['character', 'body'] + ['room/' + room['key'] for _, room in rooms]
labels += ['detail/' + room['key'] + '/' + key for _, room in rooms for key in sorted(room.get('details', {}))]
labels += ['npc/' + npc['key'] for _, npc in sorted(v['npcs'].items()) if not npc.get('spawn_template')]
labels += ['item/' + item['key'] for _, item in sorted(v['items'].items()) if item['location']['in'] != 'template']
labels += ['job/' + npc['key'] for _, npc in sorted(v['npcs'].items()) if npc.get('daily_schedule')]
labels += ['slot/' + slot for slot in sorted({item['slot'] for item in v['items'].values() if 'slot' in item})]
labels += ['consumed']
for plan in sorted(v['populations'].values(), key=lambda p: p['key']):
    for slot in range(1, plan['day_target'] + 1):
        labels += [f"population/{plan['key']}/slot{slot}/{role}" for role in (
            'deer', 'hide') if 'sight' in plan] if 'sight' in plan else [
            f"population/{plan['key']}/slot{slot}/{role}" for role in (('member', 'pelt') if 'pelt' in v['population_bundles'][named('population_bundle', plan['bundle']['key'])] else ('member',))]
    labels += [f"population/{plan['key']}/job"]
answers = {}
for ordinal, label in enumerate(labels):
    domain = ['loka-id-v1', '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f',
              '00000000-0000-0000-0000-000000000000', ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(',', ':')).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / 'missing_child_v039_ids.json').write_text(json.dumps(answers, indent=2) + '\n')
print(f'D8 successor {version}/API1.34: {digest}, {len(answers)} initial IDs.')
